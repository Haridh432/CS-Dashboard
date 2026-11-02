/**
 * Machine Service
 * Manages machine registry, role-based fleet summaries, telemetry enrichment, and history.
 */

const db = require('../database/db');

class MachineService {
    constructor() {
        // In-memory latest telemetry cache keyed by machineId
        this.latestTelemetry = new Map();
        // Telemetry stream listeners
        this.listeners = new Set();
    }

    /**
     * Update latest telemetry for a machine from gateway or simulator
     */
    updateTelemetry(machineId, telemetry) {
        const existing = this.latestTelemetry.get(machineId) || {};
        const updated = {
            ...existing,
            ...telemetry,
            machineId,
            lastSeen: new Date().toISOString()
        };
        this.latestTelemetry.set(machineId, updated);

        // Update database machine state if changed
        if (telemetry.machine && telemetry.machine.state) {
            try {
                db.run('UPDATE machines SET state = ? WHERE id = ?', [telemetry.machine.state, machineId]);
            } catch (e) {
                console.error('[MachineService] Failed to update machine state in DB:', e.message);
            }
        }

        // Notify listeners (e.g. WebSocket router)
        for (const listener of this.listeners) {
            try {
                listener(machineId, updated);
            } catch (err) {
                console.error('[MachineService] Listener error:', err);
            }
        }

        return updated;
    }

    getLatestTelemetry(machineId) {
        return this.latestTelemetry.get(machineId) || null;
    }

    removeTelemetry(machineId) {
        this.latestTelemetry.delete(machineId);
    }

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Get machines filtered by user role
     */
    getMachinesForUser(user) {
        let sql = `
            SELECT m.*, o.name as organization_name, o.industry as organization_industry, o.code as organization_code
            FROM machines m
            JOIN organizations o ON m.organization_id = o.id
        `;
        let params = [];

        if (user.role === 'CEO') {
            // CEO sees all
            sql += ` ORDER BY m.id ASC`;
        } else if (user.role === 'CUSTOMER') {
            // Customer sees only their organization's machines
            sql += ` WHERE m.organization_id = ? ORDER BY m.id ASC`;
            params = [user.organizationId];
        } else if (user.role === 'OPERATOR') {
            // Operator sees only assigned machines
            sql += ` 
                JOIN user_machine_assignments uma ON m.id = uma.machine_id 
                WHERE uma.user_id = ? 
                ORDER BY m.id ASC
            `;
            params = [user.id];
        }

        const rows = db.query(sql, params);

        // Enrich with live telemetry, sensor capabilities parsed, and stale status
        const now = Date.now();
        return rows.map(m => {
            const telemetry = this.latestTelemetry.get(m.id) || null;
            let lastUpdate = null;
            let isStale = false;
            let isOffline = m.state === 'OFFLINE';
            let currentRpm = null;
            let currentVoltage = m.rated_voltage_v;
            let currentPower = null;
            let activeFault = null;
            let runId = '--';

            if (telemetry) {
                lastUpdate = telemetry.lastSeen || telemetry.timestamp;
                const lastTime = new Date(lastUpdate).getTime();
                if (now - lastTime > 4000 && telemetry.mode !== 'OFFLINE') {
                    isStale = true;
                }

                if (telemetry.motors && telemetry.motors.length > 0) {
                    currentRpm = telemetry.motors[0].rpm;
                }
                if (telemetry.dcPower) {
                    currentVoltage = telemetry.dcPower.voltage;
                    currentPower = telemetry.dcPower.power;
                }
                if (telemetry.safety) {
                    if (telemetry.safety.estopActive) activeFault = 'E-STOP ACTIVATED';
                    else if (!telemetry.safety.guardClosed) activeFault = 'HOPPER GUARD OPEN';
                    else if (telemetry.safety.jamDetected) activeFault = 'ROTOR JAM DETECTED';
                    else if (telemetry.safety.faultCode) activeFault = telemetry.safety.faultCode;
                }
                if (telemetry.machine) {
                    runId = telemetry.machine.runId || '--';
                }
            }

            return {
                id: m.id,
                model: m.model,
                serialNumber: m.serial_number,
                organizationId: m.organization_id,
                organizationName: m.organization_name,
                organizationIndustry: m.organization_industry,
                location: m.location,
                gatewayId: m.gateway_id,
                commissioningDate: m.commissioning_date,
                sensorCapabilities: m.sensor_capabilities ? JSON.parse(m.sensor_capabilities) : [],
                hardwareType: m.hardware_type,
                motorType: m.motor_type,
                ratedVoltageV: m.rated_voltage_v,
                state: m.state,
                // Enriched live telemetry metrics
                live: {
                    rpm: currentRpm,
                    voltage: currentVoltage,
                    power: currentPower,
                    lastUpdate: lastUpdate,
                    isStale,
                    isOffline,
                    activeFault,
                    runId,
                    isDemo: telemetry ? telemetry.isDemo !== false : true
                }
            };
        });
    }

    /**
     * Calculate summary statistics for CEO
     */
    getCeoFleetSummary() {
        const allMachines = db.query(`
            SELECT m.*, o.name as organization_name 
            FROM machines m 
            JOIN organizations o ON m.organization_id = o.id
        `);

        let running = 0;
        let ready = 0;
        let stopped = 0;
        let fault = 0;
        let offline = 0;
        let staleCount = 0;

        const now = Date.now();
        const staleMachines = [];
        const faultMachines = [];

        for (const m of allMachines) {
            const telemetry = this.latestTelemetry.get(m.id);
            const state = (telemetry && telemetry.machine && telemetry.machine.state) ? telemetry.machine.state : m.state;

            if (state === 'RUNNING') running++;
            else if (state === 'READY') ready++;
            else if (state === 'STOPPED') stopped++;
            else if (state === 'FAULT') {
                fault++;
                faultMachines.push({ id: m.id, model: m.model, org: m.organization_name, location: m.location });
            } else if (state === 'OFFLINE') {
                offline++;
            }

            if (telemetry && telemetry.lastSeen) {
                const diff = now - new Date(telemetry.lastSeen).getTime();
                if (diff > 4000 && state !== 'OFFLINE') {
                    staleCount++;
                    staleMachines.push({ id: m.id, model: m.model, org: m.organization_name, lastSeen: telemetry.lastSeen });
                }
            }
        }

        // Recent fleet events
        const recentEvents = db.query(`
            SELECT me.*, m.model 
            FROM machine_events me 
            JOIN machines m ON me.machine_id = m.id 
            ORDER BY me.timestamp DESC LIMIT 6
        `);

        return {
            totalRegistered: allMachines.length,
            running,
            idleStopped: ready + stopped,
            activeFaults: fault,
            disconnectedOffline: offline,
            staleTelemetryCount: staleCount,
            staleMachines,
            faultMachines,
            recentEvents
        };
    }

    /**
     * Calculate summary statistics for Customer
     */
    getCustomerSummary(organizationId) {
        const orgMachines = db.query('SELECT * FROM machines WHERE organization_id = ?', [organizationId]);
        let running = 0;
        let stopped = 0;
        let faultsIssues = 0;

        for (const m of orgMachines) {
            const telemetry = this.latestTelemetry.get(m.id);
            const state = (telemetry && telemetry.machine && telemetry.machine.state) ? telemetry.machine.state : m.state;

            if (state === 'RUNNING') running++;
            else if (state === 'READY' || state === 'STOPPED') stopped++;
            else if (state === 'FAULT' || state === 'OFFLINE') faultsIssues++;
        }

        return {
            totalAssigned: orgMachines.length,
            running,
            stopped,
            faultsOrConnectivity: faultsIssues
        };
    }

    /**
     * Detailed machine info
     */
    getMachineDetail(machineId) {
        const machine = db.get(`
            SELECT m.*, o.name as organization_name, o.industry as organization_industry, o.contact_email as organization_email
            FROM machines m
            JOIN organizations o ON m.organization_id = o.id
            WHERE m.id = ?
        `, [machineId]);

        if (!machine) return null;

        const assignedOperators = db.query(`
            SELECT u.id, u.name, u.email, u.avatar 
            FROM users u
            JOIN user_machine_assignments uma ON u.id = uma.user_id
            WHERE uma.machine_id = ?
        `, [machineId]);

        const maintenance = db.query(`
            SELECT * FROM maintenance_records 
            WHERE machine_id = ? 
            ORDER BY maintenance_date DESC
        `, [machineId]);

        const events = db.query(`
            SELECT * FROM machine_events 
            WHERE machine_id = ? 
            ORDER BY timestamp DESC LIMIT 20
        `, [machineId]);

        const latest = this.latestTelemetry.get(machineId) || null;

        return {
            ...machine,
            sensorCapabilities: machine.sensor_capabilities ? JSON.parse(machine.sensor_capabilities) : [],
            assignedOperators,
            maintenance,
            recentEvents: events,
            latestTelemetry: latest
        };
    }

    /**
     * Fetch historical telemetry for charts
     */
    getMachineHistory(machineId, range = '24h') {
        let intervalClause = "-24 hours";
        if (range === '1h') intervalClause = "-1 hour";
        else if (range === '7d') intervalClause = "-7 days";
        else if (range === 'all') intervalClause = "-30 days";

        const rows = db.query(`
            SELECT timestamp, state, voltage_v, current_a, power_w, energy_wh, rpm_m1, rpm_m2, temp_m1, temp_m2, estop_active, guard_closed, fault_code
            FROM telemetry_history
            WHERE machine_id = ? AND timestamp >= datetime('now', ?)
            ORDER BY timestamp ASC
        `, [machineId, intervalClause]);

        return rows;
    }

    /**
     * Record a historical sample in the database
     */
    recordHistorySample(machineId, packet) {
        try {
            const time = packet.timestamp instanceof Date ? packet.timestamp.toISOString() : (packet.timestamp || new Date().toISOString());
            const state = packet.machine ? packet.machine.state : 'UNKNOWN';
            const volt = packet.dcPower ? packet.dcPower.voltage : null;
            const curr = packet.dcPower ? packet.dcPower.current : null;
            const power = packet.dcPower ? packet.dcPower.power : null;
            const energy = packet.dcPower ? packet.dcPower.energyWh : null;
            const rpm1 = (packet.motors && packet.motors[0]) ? packet.motors[0].rpm : null;
            const rpm2 = (packet.motors && packet.motors[1]) ? packet.motors[1].rpm : null;
            const temp1 = (packet.motors && packet.motors[0]) ? packet.motors[0].temperature : null;
            const temp2 = (packet.motors && packet.motors[1]) ? packet.motors[1].temperature : null;
            const estop = (packet.safety && packet.safety.estopActive) ? 1 : 0;
            const guard = (packet.safety && packet.safety.guardClosed) ? 1 : 0;
            const fault = (packet.safety && packet.safety.faultCode) || null;

            db.run(`
                INSERT INTO telemetry_history (machine_id, timestamp, state, voltage_v, current_a, power_w, energy_wh, rpm_m1, rpm_m2, temp_m1, temp_m2, estop_active, guard_closed, fault_code, is_demo)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            `, [machineId, time, state, volt, curr, power, energy, rpm1, rpm2, temp1, temp2, estop, guard, fault]);
        } catch (err) {
            console.error('[MachineService] Record history error:', err.message);
        }
    }

    /**
     * Log an operational event
     */
    logEvent(machineId, eventType, severity, description, userId = null) {
        try {
            db.run(
                'INSERT INTO machine_events (machine_id, event_type, severity, description, user_id) VALUES (?, ?, ?, ?, ?)',
                [machineId, eventType, severity, description, userId]
            );
        } catch (err) {
            console.error('[MachineService] Log event error:', err.message);
        }
    }

    /**
     * Get all organizations
     */
    getAllOrganizations() {
        return db.query('SELECT id, name, industry, code FROM organizations ORDER BY name ASC');
    }

    /**
     * Auto-generate the next CS-FS-XXXX machine ID
     */
    getNextMachineId() {
        const rows = db.query("SELECT id FROM machines WHERE id LIKE 'CS-FS-%'");
        let maxNum = 0;
        for (const r of rows) {
            const match = r.id.match(/^CS-FS-(\d+)$/);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxNum) maxNum = num;
            }
        }
        return `CS-FS-${String(maxNum + 1).padStart(4, '0')}`;
    }

    /**
     * Register a new machine into the platform (CEO or Customer)
     */
    createMachine(data, user) {
        if (!user || (user.role !== 'CEO' && user.role !== 'CUSTOMER')) {
            throw new Error('Access denied: Only CEO and Customer roles can add machines.');
        }

        let orgId = user.organizationId;
        if (user.role === 'CEO') {
            orgId = data.organizationId || data.organization_id || 'ORG-CIRCULARSEED';
        }

        const org = db.get('SELECT id, name FROM organizations WHERE id = ?', [orgId]);
        if (!org) {
            throw new Error(`Organization '${orgId}' does not exist.`);
        }

        const id = (data.id && data.id.trim()) ? data.id.trim().toUpperCase() : this.getNextMachineId();
        const existing = db.get('SELECT id FROM machines WHERE id = ?', [id]);
        if (existing) {
            throw new Error(`Machine with ID '${id}' already exists.`);
        }

        const model = (data.model && data.model.trim()) ? data.model.trim() : 'FLEXISHRED-DC Pro';
        const isPrototype = data.hardwareType === 'PROTOTYPE_12V_L298N' || model.includes('12V') || model.includes('Prototype');
        const hardwareType = isPrototype ? 'PROTOTYPE_12V_L298N' : 'PROD_48V';
        const ratedVoltageV = isPrototype ? 12.0 : (parseFloat(data.ratedVoltageV) || 48.0);
        const motorType = isPrototype ? '12V DC Encoder Motor (L298N)' : (data.motorType || 'Dual BLDC');
        const location = (data.location && data.location.trim()) ? data.location.trim() : 'Processing Floor - Unassigned Bay';
        const state = ['READY', 'STOPPED', 'RUNNING', 'OFFLINE'].includes(data.state) ? data.state : 'READY';
        const serialNumber = data.serialNumber || `SN-${id}-${Date.now().toString().slice(-4)}`;
        const gatewayId = data.gatewayId || `GW-ESP32-${id.replace('CS-FS-', '')}`;
        const commissioningDate = data.commissioningDate || new Date().toISOString().slice(0, 10);
        const sensorCapabilities = JSON.stringify(
            isPrototype 
                ? ['l298n_dc_encoder', 'single_motor', 'temperature', 'safety_estop', 'safety_guard']
                : ['dual_motor', 'battery', 'solar', 'temperature', 'safety_estop', 'safety_guard']
        );

        db.run(`
            INSERT INTO machines (id, model, serial_number, organization_id, location, gateway_id, commissioning_date, sensor_capabilities, hardware_type, state, motor_type, rated_voltage_v)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [id, model, serialNumber, orgId, location, gatewayId, commissioningDate, sensorCapabilities, hardwareType, state, motorType, ratedVoltageV]);

        // Log commissioning event
        this.logEvent(id, 'STATE_CHANGE', 'INFO', `Machine registered and commissioned by ${user.name} (${user.role})`, user.id);

        // Add baseline maintenance record
        db.run(`
            INSERT INTO maintenance_records (machine_id, maintenance_date, next_due_date, technician, notes, operating_hours)
            VALUES (?, ?, datetime('now', '+90 days'), ?, 'Initial commissioning, safety interlock verification, and factory calibration completed.', 0.0)
        `, [id, commissioningDate, user.name]);

        const created = db.get(`
            SELECT m.*, o.name as organization_name, o.industry as organization_industry, o.code as organization_code
            FROM machines m
            JOIN organizations o ON m.organization_id = o.id
            WHERE m.id = ?
        `, [id]);

        return created;
    }

    /**
     * Delete a machine from the platform (CEO or Customer within their org)
     */
    deleteMachine(machineId, user) {
        if (!user || (user.role !== 'CEO' && user.role !== 'CUSTOMER')) {
            throw new Error('Access denied: Only CEO and Customer roles can remove machines.');
        }

        const machine = db.get('SELECT * FROM machines WHERE id = ?', [machineId]);
        if (!machine) {
            throw new Error(`Machine '${machineId}' not found.`);
        }

        if (user.role === 'CUSTOMER' && machine.organization_id !== user.organizationId) {
            throw new Error('Access denied: You can only remove machines belonging to your organization.');
        }

        this.removeTelemetry(machineId);
        db.run('DELETE FROM machines WHERE id = ?', [machineId]);
        return machine;
    }
}

module.exports = new MachineService();
