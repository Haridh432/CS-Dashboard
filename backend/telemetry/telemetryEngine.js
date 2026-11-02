/**
 * Telemetry Simulation & Ingestion Engine
 * Generates high-fidelity simulated telemetry for registered machines,
 * manages interactive fault injection, and bridges real hardware ESP32 packets.
 */

const machineService = require('../machines/machineService');

class TelemetryEngine {
    constructor() {
        this.machinesState = new Map();
        this.timer = null;
        this.historySaveCounter = 0;

        // Initialize state machines for all default units
        this.initStates();
    }

    initStates() {
        // CS-FS-0001: 48V Dual BLDC, Battery + Solar equipped, RUNNING
        this.machinesState.set('CS-FS-0001', {
            id: 'CS-FS-0001',
            isDemo: true,
            isLive: false,
            machineState: 'RUNNING',
            runId: 'RUN-2026-0042',
            runtimeSeconds: 1420,
            dcVoltage: 48.2,
            dcCurrent: 24.5,
            dcPower: 1180,
            energyWh: 3450,
            lifetimeKwh: 128.4,
            motors: [
                { id: 'M1', rpm: 852, temp: 48.6, current: 12.3, state: 'RUNNING', fault: 'NORMAL' },
                { id: 'M2', rpm: 848, temp: 47.9, current: 12.2, state: 'RUNNING', fault: 'NORMAL' }
            ],
            battery: {
                configured: true,
                voltage: 51.4,
                soc: 82,
                current: 5.2,
                temperature: 29.1,
                status: 'CHARGING',
                chargingState: 'BULK'
            },
            solar: {
                configured: true,
                powerW: 420,
                dailyEnergyWh: 1650
            },
            safety: {
                estopActive: false,
                guardClosed: true,
                overload: false,
                overtemperature: false,
                jamDetected: false,
                commsError: false,
                faultCode: null
            }
        });

        // CS-FS-0002: 48V Dual BLDC, Battery Not Configured, READY
        this.machinesState.set('CS-FS-0002', {
            id: 'CS-FS-0002',
            isDemo: true,
            isLive: false,
            machineState: 'READY',
            runId: 'RUN-2026-0019',
            runtimeSeconds: 0,
            dcVoltage: 48.0,
            dcCurrent: 0.0,
            dcPower: 0,
            energyWh: 1820,
            lifetimeKwh: 64.2,
            motors: [
                { id: 'M1', rpm: 0, temp: 26.5, current: 0.0, state: 'STOPPED', fault: 'NORMAL' },
                { id: 'M2', rpm: 0, temp: 26.2, current: 0.0, state: 'STOPPED', fault: 'NORMAL' }
            ],
            battery: {
                configured: true,
                voltage: 51.2,
                soc: 78,
                current: 4.8,
                powerW: 246,
                temperature: 27.8,
                status: 'CHARGING',
                chargingState: 'BULK'
            },
            solar: {
                configured: false,
                powerW: null,
                dailyEnergyWh: null
            },
            safety: {
                estopActive: false,
                guardClosed: true,
                overload: false,
                overtemperature: false,
                jamDetected: false,
                commsError: false,
                faultCode: null
            }
        });

        // CS-FS-0003: 12V DC Encoder Motor with L298N Prototype, STOPPED
        this.machinesState.set('CS-FS-0003', {
            id: 'CS-FS-0003',
            isDemo: true,
            isLive: false,
            machineState: 'STOPPED',
            runId: 'PROTO-12V-003',
            runtimeSeconds: 0,
            targetPwm: 180, // 0 - 255
            dcVoltage: 12.1,
            dcCurrent: 0.0,
            dcPower: 0,
            energyWh: 320,
            lifetimeKwh: 8.5,
            motors: [
                { id: 'M1', rpm: 0, temp: 27.2, current: 0.0, state: 'STOPPED', fault: 'NORMAL', driver: 'L298N', encoderType: 'Optical Quadrature' }
            ],
            battery: {
                configured: true,
                voltage: 12.6,
                soc: 91,
                current: 1.8,
                powerW: 23,
                temperature: 25.2,
                status: 'FLOAT',
                chargingState: 'FLOAT'
            },
            solar: {
                configured: false,
                powerW: null,
                dailyEnergyWh: null
            },
            safety: {
                estopActive: false,
                guardClosed: true,
                overload: false,
                overtemperature: false,
                jamDetected: false,
                commsError: false,
                faultCode: null
            }
        });

        // CS-FS-0004: GreenCycle Pro 48V, Solar equipped, RUNNING
        this.machinesState.set('CS-FS-0004', {
            id: 'CS-FS-0004',
            isDemo: true,
            isLive: false,
            machineState: 'RUNNING',
            runId: 'RUN-GC-0081',
            runtimeSeconds: 3120,
            dcVoltage: 48.4,
            dcCurrent: 22.8,
            dcPower: 1103,
            energyWh: 5800,
            lifetimeKwh: 210.5,
            motors: [
                { id: 'M1', rpm: 845, temp: 51.2, current: 11.5, state: 'RUNNING', fault: 'NORMAL' },
                { id: 'M2', rpm: 842, temp: 50.8, current: 11.3, state: 'RUNNING', fault: 'NORMAL' }
            ],
            battery: {
                configured: true,
                voltage: 51.6,
                soc: 85,
                current: 5.5,
                powerW: 284,
                temperature: 30.2,
                status: 'CHARGING',
                chargingState: 'BULK'
            },
            solar: {
                configured: true,
                powerW: 680,
                dailyEnergyWh: 3200
            },
            safety: {
                estopActive: false,
                guardClosed: true,
                overload: false,
                overtemperature: false,
                jamDetected: false,
                commsError: false,
                faultCode: null
            }
        });

        // CS-FS-0005: GreenCycle Std 48V, FAULT (Rotor Jam)
        this.machinesState.set('CS-FS-0005', {
            id: 'CS-FS-0005',
            isDemo: true,
            isLive: false,
            machineState: 'FAULT',
            runId: 'RUN-GC-0077',
            runtimeSeconds: 840,
            dcVoltage: 48.1,
            dcCurrent: 0.0,
            dcPower: 0,
            energyWh: 2100,
            lifetimeKwh: 92.1,
            motors: [
                { id: 'M1', rpm: 0, temp: 42.0, current: 0.0, state: 'FAULT', fault: 'STALL_DETECTED' },
                { id: 'M2', rpm: 0, temp: 41.5, current: 0.0, state: 'FAULT', fault: 'STALL_DETECTED' }
            ],
            battery: {
                configured: true,
                voltage: 49.8,
                soc: 65,
                current: 0.0,
                powerW: 0,
                temperature: 26.1,
                status: 'STANDBY',
                chargingState: 'IDLE'
            },
            solar: {
                configured: false,
                powerW: null,
                dailyEnergyWh: null
            },
            safety: {
                estopActive: false,
                guardClosed: true,
                overload: true,
                overtemperature: false,
                jamDetected: true,
                commsError: false,
                faultCode: 'ERR_ROTOR_JAM_04'
            }
        });

        // CS-FS-0006: OFFLINE Unit (no telemetry broadcasted)
    }

    start() {
        if (this.timer) return;
        this.timer = setInterval(() => this.tick(), 1000);
        console.log('[TelemetryEngine] Telemetry simulation started (1 Hz cadence)');
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    tick() {
        this.historySaveCounter++;

        for (const [mId, s] of this.machinesState.entries()) {
            try {
                // Update running machines
                if (s.machineState === 'RUNNING') {
                    s.runtimeSeconds += 1;

                    const isSingleMotor = !s.motors || s.motors.length <= 1 || s.id === 'CS-FS-0003';
                    if (isSingleMotor && s.motors && s.motors[0]) {
                        // 12V L298N Prototype / Single Motor
                        const pwm = s.targetPwm || 180;
                        const baseRpm = Math.round((pwm / 255) * 350);
                        s.motors[0].rpm = Math.max(0, Math.round(baseRpm + (Math.random() * 8 - 4)));
                        s.motors[0].current = +(1.8 + (Math.random() * 0.2 - 0.1)).toFixed(1);
                        s.dcVoltage = +(12.1 + (Math.random() * 0.2 - 0.1)).toFixed(1);
                        s.dcCurrent = s.motors[0].current;
                        s.dcPower = +(s.dcVoltage * s.dcCurrent).toFixed(1);
                    } else if (s.motors && s.motors.length > 0) {
                        // Standard 48V dual BLDC or multi-motor
                        let totalCurrent = 0;
                        for (let i = 0; i < s.motors.length; i++) {
                            const motor = s.motors[i];
                            if (motor) {
                                motor.rpm = Math.round((i === 0 ? 850 : 846) + (Math.random() * 16 - 8));
                                motor.current = +(12.1 + (Math.random() * 0.4 - 0.2)).toFixed(1);
                                totalCurrent += motor.current;
                            }
                        }

                        s.dcVoltage = +(48.2 + (Math.random() * 0.4 - 0.2)).toFixed(1);
                        s.dcCurrent = +totalCurrent.toFixed(1);
                        s.dcPower = Math.round(s.dcVoltage * s.dcCurrent);
                    }

                    s.energyWh += (s.dcPower / 3600);
                    s.lifetimeKwh += (s.dcPower / 3600000);
                } else {
                    // Stopped / Ready / Fault
                    if (Array.isArray(s.motors)) {
                        for (const m of s.motors) {
                            if (m) {
                                m.rpm = 0;
                                m.current = 0.0;
                            }
                        }
                    }
                    s.dcCurrent = 0.0;
                    s.dcPower = 0;
                }

                // Dynamic live battery power simulation
                if (s.battery && s.battery.configured) {
                    if (s.battery.status === 'CHARGING') {
                        const baseV = s.id === 'CS-FS-0003' ? 12.6 : 51.4;
                        const baseA = s.id === 'CS-FS-0003' ? 1.8 : 5.0;
                        s.battery.voltage = +(baseV + (Math.random() * 0.2 - 0.1)).toFixed(1);
                        s.battery.current = +(baseA + (Math.random() * 0.2 - 0.1)).toFixed(1);
                        s.battery.powerW = Math.round(s.battery.voltage * s.battery.current);
                    } else if (s.battery.status === 'FLOAT') {
                        s.battery.current = +(0.4 + (Math.random() * 0.1)).toFixed(1);
                        s.battery.powerW = Math.round((s.battery.voltage || 12.6) * s.battery.current);
                    } else {
                        s.battery.current = 0.0;
                        s.battery.powerW = 0;
                    }
                }

                // Generate protocol packet
                const packet = {
                    type: 'telemetry',
                    machineId: mId,
                    timestamp: new Date().toISOString(),
                    sequence: Math.floor(Date.now() / 1000),
                    isDemo: s.isDemo,
                    isLive: s.isLive,
                    machine: {
                        state: s.machineState,
                        runId: s.runId,
                        runtimeSeconds: s.runtimeSeconds
                    },
                    dcPower: {
                        voltage: s.dcVoltage,
                        current: s.dcCurrent,
                        power: s.dcPower,
                        energyWh: Math.round(s.energyWh || 0),
                        lifetimeEnergyKWh: +((s.lifetimeKwh || 0)).toFixed(2)
                    },
                    motors: Array.isArray(s.motors) ? s.motors.map(m => ({
                        id: m.id,
                        rpm: m.rpm,
                        temperature: m.temp,
                        current: m.current,
                        state: m.state,
                        fault: m.fault,
                        driver: m.driver || 'BLDC_3PH',
                        encoderType: m.encoderType || 'Hall / Quadrature'
                    })) : [],
                    battery: s.battery,
                    solar: s.solar,
                    safety: s.safety
                };

                // Update machine service
                machineService.updateTelemetry(mId, packet);

                // Record periodic historical sample every 60 seconds
                if (this.historySaveCounter % 60 === 0) {
                    machineService.recordHistorySample(mId, packet);
                }
            } catch (err) {
                console.error(`[TelemetryEngine] Error ticking machine ${mId}:`, err.message);
            }
        }
    }

    /**
     * Handle command from authorized user
     */
    handleCommand(machineId, user, action, params = {}) {
        const s = this.machinesState.get(machineId);
        if (!s) {
            return { accepted: false, error: `Machine ${machineId} is not online in telemetry service.` };
        }

        // Safety verification before START
        if (action === 'START') {
            if (s.safety.estopActive) {
                return { accepted: false, error: 'Cannot start: Emergency-Stop is physically latched active.' };
            }
            if (!s.safety.guardClosed) {
                return { accepted: false, error: 'Cannot start: Hopper guard interlock switch is open.' };
            }
            if (s.safety.jamDetected || s.machineState === 'FAULT') {
                return { accepted: false, error: 'Cannot start: Active fault code must be acknowledged and cleared first.' };
            }

            s.machineState = 'RUNNING';
            for (const m of s.motors) {
                m.state = 'RUNNING';
                m.fault = 'NORMAL';
            }
            s.runId = `RUN-${Date.now().toString().slice(-6)}`;
            s.runtimeSeconds = 0;

            machineService.logEvent(machineId, 'COMMAND', 'INFO', `START command executed by ${user.name} (${user.role})`, user.id);
            return { accepted: true, status: 'ACCEPTED', message: 'Motor ramp sequence initiated.' };
        }

        if (action === 'STOP') {
            s.machineState = 'STOPPED';
            for (const m of s.motors) {
                m.state = 'STOPPED';
            }
            machineService.logEvent(machineId, 'COMMAND', 'INFO', `STOP command executed by ${user.name} (${user.role})`, user.id);
            return { accepted: true, status: 'ACCEPTED', message: 'Controlled ramp stop executed.' };
        }

        if (action === 'RESET_FAULT') {
            s.safety.estopActive = false;
            s.safety.guardClosed = true;
            s.safety.jamDetected = false;
            s.safety.overload = false;
            s.safety.faultCode = null;
            s.machineState = 'READY';
            for (const m of s.motors) {
                m.fault = 'NORMAL';
                m.state = 'STOPPED';
            }
            machineService.logEvent(machineId, 'COMMAND', 'INFO', `Fault reset executed by ${user.name}`, user.id);
            return { accepted: true, status: 'ACCEPTED', message: 'Faults cleared. Machine in READY state.' };
        }

        if (action === 'SET_SPEED') {
            const speed = parseInt(params.speed, 10);
            if (isNaN(speed) || speed < 0 || speed > 255) {
                return { accepted: false, error: 'Speed PWM setting must be between 0 and 255.' };
            }
            s.targetPwm = speed;
            machineService.logEvent(machineId, 'COMMAND', 'INFO', `Speed PWM updated to ${speed} by ${user.name}`, user.id);
            return { accepted: true, status: 'ACCEPTED', message: `Target PWM adjusted to ${speed}.` };
        }

        return { accepted: false, error: `Unsupported command action: ${action}` };
    }

    /**
     * Interactive fault injection for testing and demonstration
     */
    injectFault(machineId, faultType, value = null) {
        const s = this.machinesState.get(machineId);
        if (!s) return false;

        switch (faultType) {
            case 'TOGGLE_ESTOP':
                s.safety.estopActive = !s.safety.estopActive;
                if (s.safety.estopActive) {
                    s.machineState = 'FAULT';
                    s.safety.faultCode = 'ERR_ESTOP_TRIPPED';
                    for (const m of s.motors) m.state = 'FAULT';
                    machineService.logEvent(machineId, 'FAULT', 'CRITICAL', 'Simulation: Emergency-Stop button depressed.');
                } else {
                    if (s.machineState === 'FAULT' && !s.safety.jamDetected) {
                        s.machineState = 'STOPPED';
                        s.safety.faultCode = null;
                    }
                    machineService.logEvent(machineId, 'FAULT', 'INFO', 'Simulation: Emergency-Stop reset.');
                }
                break;

            case 'TOGGLE_GUARD':
                s.safety.guardClosed = !s.safety.guardClosed;
                if (!s.safety.guardClosed) {
                    s.machineState = 'FAULT';
                    s.safety.faultCode = 'ERR_GUARD_INTERLOCK_OPEN';
                    for (const m of s.motors) m.state = 'FAULT';
                    machineService.logEvent(machineId, 'INTERLOCK', 'WARNING', 'Simulation: Hopper safety guard opened.');
                } else {
                    if (s.machineState === 'FAULT' && !s.safety.estopActive && !s.safety.jamDetected) {
                        s.machineState = 'STOPPED';
                        s.safety.faultCode = null;
                    }
                    machineService.logEvent(machineId, 'INTERLOCK', 'INFO', 'Simulation: Hopper safety guard closed.');
                }
                break;

            case 'TRIGGER_JAM':
                s.safety.jamDetected = true;
                s.safety.overload = true;
                s.machineState = 'FAULT';
                s.safety.faultCode = 'ERR_ROTOR_JAM_04';
                for (const m of s.motors) {
                    m.state = 'FAULT';
                    m.fault = 'STALL_DETECTED';
                }
                machineService.logEvent(machineId, 'FAULT', 'CRITICAL', 'Simulation: Shredder rotor mechanical jam detected.');
                break;

            case 'TOGGLE_BATTERY':
                s.battery.configured = !s.battery.configured;
                if (s.battery.configured) {
                    s.battery.voltage = 51.2;
                    s.battery.soc = 78;
                    s.battery.current = 4.2;
                    s.battery.temperature = 28.5;
                    s.battery.status = 'HEALTHY';
                    s.battery.chargingState = 'STANDBY';
                } else {
                    s.battery.voltage = null;
                    s.battery.soc = null;
                    s.battery.current = null;
                    s.battery.temperature = null;
                    s.battery.status = 'NOT_CONFIGURED';
                    s.battery.chargingState = '--';
                }
                break;

            case 'INGEST_REAL_HARDWARE':
                // Ingesting verified hardware packet from ESP32
                if (value && typeof value === 'object') {
                    s.isDemo = false;
                    s.isLive = true;
                    if (value.machine) s.machineState = value.machine.state || s.machineState;
                    if (value.dcPower) {
                        s.dcVoltage = value.dcPower.voltage;
                        s.dcCurrent = value.dcPower.current;
                        s.dcPower = value.dcPower.power;
                    }
                    if (Array.isArray(value.motors)) s.motors = value.motors;
                    if (value.safety) s.safety = value.safety;
                    machineService.logEvent(machineId, 'STATE_CHANGE', 'INFO', 'Live telemetry received from hardware ESP32 gateway.');
                }
                break;
        }

        return true;
    }

    /**
     * Register a newly created machine into the simulation engine
     */
    registerMachine(machine) {
        if (!machine || !machine.id) return;
        if (machine.state === 'OFFLINE') {
            return;
        }

        const isProto = machine.hardware_type === 'PROTOTYPE_12V_L298N';
        const ratedV = machine.rated_voltage_v || (isProto ? 12.0 : 48.0);
        const motors = isProto ? [
            { id: 'M1', rpm: 0, temp: 24.5, current: 0.0, state: 'STOPPED', fault: 'NORMAL', driver: 'L298N Dual H-Bridge', encoderType: 'Optical Quadrature' }
        ] : [
            { id: 'M1', rpm: 0, temp: 25.0, current: 0.0, state: 'STOPPED', fault: 'NORMAL' },
            { id: 'M2', rpm: 0, temp: 25.0, current: 0.0, state: 'STOPPED', fault: 'NORMAL' }
        ];

        const s = {
            id: machine.id,
            isDemo: true,
            isLive: false,
            machineState: machine.state || 'READY',
            runId: `RUN-${machine.id.replace(/[^a-zA-Z0-9]/g, '')}-0001`,
            runtimeSeconds: 0,
            dcVoltage: ratedV,
            dcCurrent: 0.0,
            dcPower: 0,
            energyWh: 0,
            lifetimeKwh: 0.0,
            motors,
            battery: {
                configured: false,
                voltage: null,
                soc: null,
                current: null,
                temperature: null,
                status: 'NOT_CONFIGURED',
                chargingState: '--'
            },
            solar: {
                configured: false,
                powerW: null,
                dailyEnergyWh: null
            },
            safety: {
                estopActive: false,
                guardClosed: true,
                overload: false,
                overtemperature: false,
                jamDetected: false,
                commsError: false,
                faultCode: null
            }
        };

        this.machinesState.set(machine.id, s);

        // Immediate initial packet
        const packet = {
            type: 'telemetry',
            machineId: machine.id,
            timestamp: new Date().toISOString(),
            sequence: Math.floor(Date.now() / 1000),
            isDemo: s.isDemo,
            isLive: s.isLive,
            machine: {
                state: s.machineState,
                runId: s.runId,
                runtimeSeconds: s.runtimeSeconds
            },
            dcPower: {
                voltage: s.dcVoltage,
                current: s.dcCurrent,
                power: s.dcPower,
                energyWh: 0,
                lifetimeEnergyKWh: 0.0
            },
            motors: s.motors.map(m => ({
                id: m.id,
                rpm: m.rpm,
                temperature: m.temp,
                current: m.current,
                state: m.state,
                fault: m.fault,
                driver: m.driver || 'BLDC_3PH',
                encoderType: m.encoderType || 'Hall / Quadrature'
            })),
            battery: s.battery,
            solar: s.solar,
            safety: s.safety
        };
        machineService.updateTelemetry(machine.id, packet);
    }

    /**
     * Unregister a removed machine from telemetry engine
     */
    unregisterMachine(machineId) {
        if (!machineId) return;
        this.machinesState.delete(machineId);
        machineService.removeTelemetry(machineId);
    }
}

module.exports = new TelemetryEngine();

