/**
 * CircularSeed Dashboard - Protocol Module
 * Handles message validation, formatting, normalization, and safety rules.
 */

const DashboardProtocol = (() => {
    let commandCounter = 1;

    return {
        /**
         * Validates and normalizes incoming telemetry message.
         * Returns normalized object or throws an Error if invalid.
         */
        parseTelemetry(raw) {
            let data = raw;
            if (typeof raw === 'string') {
                try {
                    data = JSON.parse(raw);
                } catch (err) {
                    throw new Error(`Invalid JSON syntax: ${err.message}`);
                }
            }

            if (!data || typeof data !== 'object') {
                throw new Error('Telemetry payload is not an object');
            }

            if (data.type !== 'telemetry') {
                throw new Error(`Unexpected message type: ${data.type}`);
            }

            // Normalization with safe fallbacks and explicit null preservation
            const normalized = {
                type: 'telemetry',
                timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
                sequence: typeof data.sequence === 'number' ? data.sequence : null,
                
                machine: {
                    state: (data.machine && typeof data.machine.state === 'string') 
                        ? data.machine.state.toUpperCase() 
                        : 'UNKNOWN',
                    runId: (data.machine && data.machine.run_id) || '--',
                    runtimeSeconds: (data.machine && typeof data.machine.runtime_s === 'number') 
                        ? data.machine.runtime_s 
                        : 0
                },

                dcPower: {
                    voltage: (data.dc_power && typeof data.dc_power.voltage_v === 'number') 
                        ? data.dc_power.voltage_v 
                        : null,
                    current: (data.dc_power && typeof data.dc_power.current_a === 'number') 
                        ? data.dc_power.current_a 
                        : null,
                    power: (data.dc_power && typeof data.dc_power.power_w === 'number') 
                        ? data.dc_power.power_w 
                        : null,
                    energyWh: (data.dc_power && typeof data.dc_power.energy_wh === 'number') 
                        ? data.dc_power.energy_wh 
                        : null,
                    lifetimeEnergyKWh: (data.dc_power && typeof data.dc_power.lifetime_energy_kwh === 'number')
                        ? data.dc_power.lifetime_energy_kwh
                        : null
                },

                motors: Array.isArray(data.motors) ? data.motors.map((m, idx) => ({
                    id: m.id || `M${idx + 1}`,
                    rpm: typeof m.rpm === 'number' ? m.rpm : null,
                    temperature: typeof m.temperature_c === 'number' ? m.temperature_c : null,
                    current: typeof m.current_a === 'number' ? m.current_a : null,
                    state: (m.state && typeof m.state === 'string') ? m.state.toUpperCase() : 'UNKNOWN',
                    fault: (m.fault && typeof m.fault === 'string') ? m.fault.toUpperCase() : 'NORMAL'
                })) : [],

                battery: {
                    configured: Boolean(data.battery && data.battery.configured),
                    voltage: (data.battery && typeof data.battery.voltage_v === 'number') 
                        ? data.battery.voltage_v 
                        : null,
                    soc: (data.battery && typeof data.battery.soc_percent === 'number') 
                        ? data.battery.soc_percent 
                        : null,
                    current: (data.battery && typeof data.battery.current_a === 'number') 
                        ? data.battery.current_a 
                        : null,
                    temperature: (data.battery && typeof data.battery.temperature_c === 'number')
                        ? data.battery.temperature_c
                        : null,
                    status: (data.battery && data.battery.status) || 'NOT_CONFIGURED',
                    chargingState: (data.battery && data.battery.charging_state) || '--'
                },

                safety: {
                    estopActive: Boolean(data.safety && data.safety.estop_active),
                    guardClosed: data.safety ? Boolean(data.safety.guard_closed) : false,
                    overload: Boolean(data.safety && data.safety.overload),
                    overtemperature: Boolean(data.safety && data.safety.overtemperature),
                    jamDetected: Boolean(data.safety && data.safety.jam_detected),
                    commsError: Boolean(data.safety && data.safety.comms_error),
                    faultCode: (data.safety && data.safety.fault_code) || null
                }
            };

            return normalized;
        },

        /**
         * Validates incoming command acknowledgement message.
         */
        parseAck(raw) {
            let data = raw;
            if (typeof raw === 'string') {
                try {
                    data = JSON.parse(raw);
                } catch (e) {
                    return null;
                }
            }
            if (data && data.type === 'command_ack') {
                return {
                    type: 'command_ack',
                    commandId: data.command_id,
                    status: (data.status || 'UNKNOWN').toUpperCase(), // ACCEPTED, REJECTED, PENDING
                    message: data.message || '',
                    timestamp: data.timestamp ? new Date(data.timestamp) : new Date()
                };
            }
            return null;
        },

        /**
         * Formats a control command for the ESP32 / STM32 gateway.
         */
        createCommand(action) {
            const validActions = ['START', 'STOP', 'RESET_FAULT'];
            if (!validActions.includes(action)) {
                throw new Error(`Unsupported command action: ${action}`);
            }

            const cmdId = `CMD-${String(commandCounter++).padStart(4, '0')}`;
            return {
                type: 'command',
                command_id: cmdId,
                action: action,
                client_timestamp: new Date().toISOString()
            };
        }
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DashboardProtocol;
}
