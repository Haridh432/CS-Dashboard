/**
 * Database Seed Script for CircularSeed Platform
 * Populates realistic organizations, machines, users, assignments, maintenance, and history.
 */

const bcrypt = require('bcryptjs');
const db = require('./db');

function seedDatabase() {
    console.log('[Seed] Checking database records...');

    // 1. Seed Organizations
    const orgs = [
        { id: 'ORG-CIRCULARSEED', name: 'CircularSeed Internal Fleet', industry: 'Cleantech OEM', code: 'CS-INTERNAL', contact_email: 'ops@circularseed.com' },
        { id: 'ORG-ACME', name: 'Acme Plastics Processing Corp', industry: 'Post-Industrial Polymers', code: 'ACME-PLAST', contact_email: 'plant@acme-plastics.com' },
        { id: 'ORG-GREENCYCLE', name: 'GreenCycle Eco Solutions', industry: 'Municipal Recycling', code: 'GREEN-CYCLE', contact_email: 'facility@green-cycle.com' }
    ];

    for (const org of orgs) {
        const existing = db.get('SELECT id FROM organizations WHERE id = ?', [org.id]);
        if (!existing) {
            db.run(
                'INSERT INTO organizations (id, name, industry, code, contact_email) VALUES (?, ?, ?, ?, ?)',
                [org.id, org.name, org.industry, org.code, org.contact_email]
            );
        }
    }

    // 2. Seed Users
    const salt = bcrypt.genSaltSync(10);
    const users = [
        {
            id: 'USR-CEO-01',
            email: 'ceo@circularseed.com',
            password_hash: bcrypt.hashSync('CircularCEO#2025', salt),
            role: 'CEO',
            name: 'Harish (Executive Director)',
            organization_id: 'ORG-CIRCULARSEED',
            avatar: 'CE'
        },
        {
            id: 'USR-CUST-01',
            email: 'customer@acme-plastics.com',
            password_hash: bcrypt.hashSync('Customer#Acme2025', salt),
            role: 'CUSTOMER',
            name: 'Sarah Connor (Plant Manager)',
            organization_id: 'ORG-ACME',
            avatar: 'AC'
        },
        {
            id: 'USR-CUST-02',
            email: 'customer@green-cycle.com',
            password_hash: bcrypt.hashSync('Customer#Green2025', salt),
            role: 'CUSTOMER',
            name: 'David Atten (Sustainability Lead)',
            organization_id: 'ORG-GREENCYCLE',
            avatar: 'GC'
        },
        {
            id: 'USR-OP-01',
            email: 'operator@circularseed.com',
            password_hash: bcrypt.hashSync('Operator#Flexishred1', salt),
            role: 'OPERATOR',
            name: 'Alex Rivera (Lead Shredder Operator)',
            organization_id: 'ORG-ACME',
            avatar: 'OP'
        },
        {
            id: 'USR-OP-02',
            email: 'operator2@circularseed.com',
            password_hash: bcrypt.hashSync('Operator#Flexishred2', salt),
            role: 'OPERATOR',
            name: 'Maya Lin (Technician & Operator)',
            organization_id: 'ORG-ACME',
            avatar: 'ML'
        }
    ];

    for (const u of users) {
        const existing = db.get('SELECT id FROM users WHERE id = ? OR email = ?', [u.id, u.email]);
        if (!existing) {
            db.run(
                'INSERT INTO users (id, email, password_hash, role, name, organization_id, avatar) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [u.id, u.email, u.password_hash, u.role, u.name, u.organization_id, u.avatar]
            );
        }
    }

    // 3. Seed Machines
    const machines = [
        {
            id: 'CS-FS-0001',
            model: 'FLEXISHRED-DC Pro',
            serial_number: 'SN-2026-0001-PRO',
            organization_id: 'ORG-ACME',
            location: 'Unit 4 - Bay A (Primary Shredder)',
            gateway_id: 'GW-ESP32-0001',
            commissioning_date: '2026-01-15',
            sensor_capabilities: JSON.stringify(['dual_motor', 'battery', 'solar', 'temperature', 'dc_power', 'interlocks']),
            hardware_type: 'PROD_48V',
            state: 'RUNNING',
            motor_type: 'Dual 48V BLDC (M1 & M2)',
            rated_voltage_v: 48.0
        },
        {
            id: 'CS-FS-0002',
            model: 'FLEXISHRED-DC Std',
            serial_number: 'SN-2026-0002-STD',
            organization_id: 'ORG-ACME',
            location: 'Unit 4 - Line 2 (Secondary Regrind)',
            gateway_id: 'GW-ESP32-0002',
            commissioning_date: '2026-02-10',
            sensor_capabilities: JSON.stringify(['dual_motor', 'battery', 'dc_power', 'interlocks', 'temperature']),
            hardware_type: 'PROD_48V',
            state: 'READY',
            motor_type: 'Dual 48V BLDC (M1 & M2)',
            rated_voltage_v: 48.0
        },
        {
            id: 'CS-FS-0003',
            model: 'FLEXISHRED-DC Micro (12V L298N Prototype)',
            serial_number: 'SN-2026-0003-L298N',
            organization_id: 'ORG-ACME',
            location: 'Pilot Lab Bench 2 (R&D Prototype)',
            gateway_id: 'GW-ESP32-0003',
            commissioning_date: '2026-03-01',
            sensor_capabilities: JSON.stringify(['single_motor', 'battery', 'l298n_dc_encoder', 'dc_power', 'interlocks', 'pwm_speed_control']),
            hardware_type: 'PROTOTYPE_12V_L298N',
            state: 'STOPPED',
            motor_type: '12V DC Encoder Motor (L298N Driver)',
            rated_voltage_v: 12.0
        },
        {
            id: 'CS-FS-0004',
            model: 'FLEXISHRED-DC Pro',
            serial_number: 'SN-2026-0004-PRO',
            organization_id: 'ORG-GREENCYCLE',
            location: 'Facility B - High Volume Sorting Line',
            gateway_id: 'GW-ESP32-0004',
            commissioning_date: '2026-02-28',
            sensor_capabilities: JSON.stringify(['dual_motor', 'battery', 'solar', 'dc_power', 'temperature', 'interlocks']),
            hardware_type: 'PROD_48V',
            state: 'RUNNING',
            motor_type: 'Dual 48V BLDC (M1 & M2)',
            rated_voltage_v: 48.0
        },
        {
            id: 'CS-FS-0005',
            model: 'FLEXISHRED-DC Std',
            serial_number: 'SN-2026-0005-STD',
            organization_id: 'ORG-GREENCYCLE',
            location: 'Facility B - Yard Intake Bay',
            gateway_id: 'GW-ESP32-0005',
            commissioning_date: '2026-03-20',
            sensor_capabilities: JSON.stringify(['dual_motor', 'battery', 'dc_power', 'interlocks']),
            hardware_type: 'PROD_48V',
            state: 'FAULT',
            motor_type: 'Dual 48V BLDC (M1 & M2)',
            rated_voltage_v: 48.0
        },
        {
            id: 'CS-FS-0006',
            model: 'FLEXISHRED-DC Pro',
            serial_number: 'SN-2026-0006-EXP',
            organization_id: 'ORG-CIRCULARSEED',
            location: 'CircularSeed Tech Lab - Testbed A',
            gateway_id: 'GW-ESP32-0006',
            commissioning_date: '2026-04-01',
            sensor_capabilities: JSON.stringify(['dual_motor', 'battery', 'solar', 'temperature', 'dc_power', 'interlocks']),
            hardware_type: 'PROD_48V',
            state: 'OFFLINE',
            motor_type: 'Dual 48V BLDC (M1 & M2)',
            rated_voltage_v: 48.0
        }
    ];

    for (const m of machines) {
        const existing = db.get('SELECT id FROM machines WHERE id = ?', [m.id]);
        if (!existing) {
            db.run(
                `INSERT INTO machines (id, model, serial_number, organization_id, location, gateway_id, commissioning_date, sensor_capabilities, hardware_type, state, motor_type, rated_voltage_v)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [m.id, m.model, m.serial_number, m.organization_id, m.location, m.gateway_id, m.commissioning_date, m.sensor_capabilities, m.hardware_type, m.state, m.motor_type, m.rated_voltage_v]
            );
        }
    }

    // 4. Seed User Machine Assignments
    const assignments = [
        { user_id: 'USR-OP-01', machine_id: 'CS-FS-0001' },
        { user_id: 'USR-OP-02', machine_id: 'CS-FS-0002' },
        { user_id: 'USR-OP-02', machine_id: 'CS-FS-0003' }
    ];

    for (const a of assignments) {
        const existing = db.get('SELECT user_id FROM user_machine_assignments WHERE user_id = ? AND machine_id = ?', [a.user_id, a.machine_id]);
        if (!existing) {
            db.run(
                'INSERT INTO user_machine_assignments (user_id, machine_id) VALUES (?, ?)',
                [a.user_id, a.machine_id]
            );
        }
    }

    // 5. Seed Events
    const events = [
        { machine_id: 'CS-FS-0001', event_type: 'STATE_CHANGE', severity: 'INFO', description: 'Machine started by operator in normal dual drive mode.' },
        { machine_id: 'CS-FS-0001', event_type: 'COMMAND', severity: 'INFO', description: 'Ramp sequence completed at 850 RPM target.' },
        { machine_id: 'CS-FS-0005', event_type: 'FAULT', severity: 'CRITICAL', description: 'Rotor Jam detected on cutting shaft - automatic reverse disengaged.' },
        { machine_id: 'CS-FS-0003', event_type: 'STATE_CHANGE', severity: 'INFO', description: '12V L298N Prototype stopped. Optical encoder feedback calibrated.' },
        { machine_id: 'CS-FS-0006', event_type: 'INTERLOCK', severity: 'WARNING', description: 'Gateway wireless heartbeat timeout > 120s.' }
    ];

    const eventCount = db.get('SELECT COUNT(*) as count FROM machine_events');
    if (eventCount && eventCount.count === 0) {
        for (const ev of events) {
            db.run(
                'INSERT INTO machine_events (machine_id, event_type, severity, description) VALUES (?, ?, ?, ?)',
                [ev.machine_id, ev.event_type, ev.severity, ev.description]
            );
        }
    }

    // 6. Seed Maintenance
    const maintenance = [
        { machine_id: 'CS-FS-0001', maintenance_date: '2026-03-10', next_due_date: '2026-06-10', technician: 'Marcus Vance', notes: 'Greased shaft roller bearings, verified rotary blade clearance at 0.35mm, checked LFP battery BMS balance.', operating_hours: 342.5 },
        { machine_id: 'CS-FS-0002', maintenance_date: '2026-02-15', next_due_date: '2026-05-15', technician: 'Marcus Vance', notes: 'Torqued M10 cutter assembly bolts, calibrated current shunt amplifiers.', operating_hours: 188.0 },
        { machine_id: 'CS-FS-0003', maintenance_date: '2026-03-05', next_due_date: '2026-06-05', technician: 'Harish / Lab Team', notes: 'L298N H-bridge heatsink thermal paste renewed. Quadrature encoder pulse verification complete.', operating_hours: 45.2 },
        { machine_id: 'CS-FS-0004', maintenance_date: '2026-03-25', next_due_date: '2026-06-25', technician: 'Elena Rostova', notes: 'Cleaned solar intake panels, tested hopper interlock safety switch response time (12ms).', operating_hours: 512.8 },
        { machine_id: 'CS-FS-0005', maintenance_date: '2026-03-20', next_due_date: '2026-04-20', technician: 'Elena Rostova', notes: 'Inspected cutting teeth after hard plastic contamination event. Recommended blade sharpening.', operating_hours: 215.4 }
    ];

    const maintCount = db.get('SELECT COUNT(*) as count FROM maintenance_records');
    if (maintCount && maintCount.count === 0) {
        for (const m of maintenance) {
            db.run(
                'INSERT INTO maintenance_records (machine_id, maintenance_date, next_due_date, technician, notes, operating_hours) VALUES (?, ?, ?, ?, ?, ?)',
                [m.machine_id, m.maintenance_date, m.next_due_date, m.technician, m.notes, m.operating_hours]
            );
        }
    }

    // 7. Seed sample historical telemetry points for charts
    const histCount = db.get('SELECT COUNT(*) as count FROM telemetry_history');
    if (histCount && histCount.count === 0) {
        console.log('[Seed] Seeding sample historical telemetry for charts...');
        const now = Date.now();
        // Generate 24 hours of points (1 point per 30 minutes = 48 points) for CS-FS-0001
        for (let i = 48; i >= 0; i--) {
            const time = new Date(now - i * 30 * 60 * 1000).toISOString();
            const isRun = i % 8 !== 0;
            const volt = +(48.0 + (Math.sin(i) * 0.8)).toFixed(1);
            const curr = isRun ? +(12.0 + (Math.cos(i) * 2.5)).toFixed(1) : 0;
            const power = +(volt * curr).toFixed(0);
            const energy = +(1200 + (48 - i) * 25).toFixed(0);
            const rpm1 = isRun ? Math.round(850 + Math.sin(i) * 15) : 0;
            const rpm2 = isRun ? Math.round(846 + Math.cos(i) * 15) : 0;
            const temp = +(32 + (isRun ? (48 - i) * 0.3 : 0)).toFixed(1);

            db.run(
                `INSERT INTO telemetry_history (machine_id, timestamp, state, voltage_v, current_a, power_w, energy_wh, rpm_m1, rpm_m2, temp_m1, temp_m2, estop_active, guard_closed, fault_code, is_demo)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                ['CS-FS-0001', time, isRun ? 'RUNNING' : 'READY', volt, curr, power, energy, rpm1, rpm2, temp, temp, 0, 1, null]
            );
        }

        // Generate points for CS-FS-0003 (12V L298N Prototype)
        for (let i = 24; i >= 0; i--) {
            const time = new Date(now - i * 60 * 60 * 1000).toISOString();
            const isRun = i % 4 !== 0;
            const volt = +(12.2 + (Math.sin(i) * 0.3)).toFixed(1);
            const curr = isRun ? +(1.8 + (Math.cos(i) * 0.4)).toFixed(1) : 0;
            const power = +(volt * curr).toFixed(1);
            const energy = +(180 + (24 - i) * 8).toFixed(0);
            const rpm1 = isRun ? Math.round(220 + Math.sin(i) * 10) : 0;

            db.run(
                `INSERT INTO telemetry_history (machine_id, timestamp, state, voltage_v, current_a, power_w, energy_wh, rpm_m1, rpm_m2, temp_m1, temp_m2, estop_active, guard_closed, fault_code, is_demo)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                ['CS-FS-0003', time, isRun ? 'RUNNING' : 'STOPPED', volt, curr, power, energy, rpm1, null, 28.5, null, 0, 1, null]
            );
        }
    }

    console.log('[Seed] Database initialization complete.');
}

module.exports = { seedDatabase };

if (require.main === module) {
    seedDatabase();
}
