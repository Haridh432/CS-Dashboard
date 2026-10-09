/**
 * CircularSeed Dashboard Application
 */

const USE_MOCK_DATA = true;
const REALTIME_MODE = false;

// Mock data generator state
let mockDataInterval;
let currentMockData = {
    machine: {
        state: "RUNNING",
        runId: "CS-000124",
        runtime: 222
    },
    power: {
        voltage: 48.2,
        current: 12.4,
        power: 598,
        energy: 1.82
    },
    motor: {
        rpm: 850,
        temperature: 48,
        current: 12.4,
        load: 64
    },
    battery: {
        voltage: 51.2,
        soc: 78,
        current: 12.4,
        status: "DISCHARGING"
    },
    processing: {
        material: "Mixed Plastic",
        inputWeight: 5.0,
        processedWeight: 4.2,
        processingTime: 222,
        throughput: 14.2,
        outputSize: 10
    },
    safety: {
        emergencyStop: "NORMAL",
        jam: "NORMAL",
        thermal: "NORMAL",
        interlock: "NORMAL",
        batteryProtection: "NORMAL",
        activeFault: "NONE"
    },
    solar: {
        connected: false,
        voltage: 0,
        current: 0,
        power: 0
    }
};

/**
 * Main function to update UI.
 * All UI updates must go through this function.
 * @param {Object} data 
 */
function updateMachineData(data) {
    // 1. Header & Machine Status
    const headerState = document.getElementById('header-machine-state');
    const mState = document.getElementById('m-state');
    
    headerState.textContent = data.machine.state;
    mState.textContent = data.machine.state;
    
    // Update colors based on state
    headerState.style.backgroundColor = getStateColor(data.machine.state);
    mState.style.color = getStateColor(data.machine.state);
    
    document.getElementById('m-runid').textContent = data.machine.runId;
    document.getElementById('m-runtime').textContent = formatTime(data.machine.runtime);

    // 2. DC Power
    document.getElementById('p-volt').textContent = `${data.power.voltage.toFixed(1)} V`;
    document.getElementById('p-curr').textContent = `${data.power.current.toFixed(1)} A`;
    document.getElementById('p-power').textContent = `${Math.round(data.power.power)} W`;
    document.getElementById('p-energy').textContent = `${data.power.energy.toFixed(2)} kWh`;

    // 3. Motor
    document.getElementById('mo-rpm').textContent = Math.round(data.motor.rpm);
    document.getElementById('mo-temp').textContent = `${Math.round(data.motor.temperature)} °C`;
    document.getElementById('mo-curr').textContent = `${data.motor.current.toFixed(1)} A`;
    document.getElementById('mo-load').textContent = `${Math.round(data.motor.load)} %`;

    // 4. Battery
    document.getElementById('b-volt').textContent = `${data.battery.voltage.toFixed(1)} V`;
    document.getElementById('b-soc').textContent = `${Math.round(data.battery.soc)} %`;
    document.getElementById('b-curr').textContent = `${data.battery.current.toFixed(1)} A`;
    document.getElementById('b-status').textContent = data.battery.status;

    // 5. Processing
    document.getElementById('pr-material').textContent = data.processing.material;
    document.getElementById('pr-input').textContent = `${data.processing.inputWeight.toFixed(1)} kg`;
    document.getElementById('pr-processed').textContent = `${data.processing.processedWeight.toFixed(1)} kg`;
    document.getElementById('pr-time').textContent = formatTime(data.processing.processingTime);
    document.getElementById('pr-throughput').textContent = `${data.processing.throughput.toFixed(1)} kg/h`;
    document.getElementById('pr-size').textContent = `${data.processing.outputSize} mm`;

    // 6. Safety / Fault
    updateSafetyIndicator('s-estop', data.safety.emergencyStop);
    updateSafetyIndicator('s-jam', data.safety.jam);
    updateSafetyIndicator('s-therm', data.safety.thermal);
    updateSafetyIndicator('s-interlock', data.safety.interlock);
    updateSafetyIndicator('s-batt', data.safety.batteryProtection);
    
    const faultEl = document.getElementById('s-fault');
    faultEl.textContent = data.safety.activeFault;
    if (data.safety.activeFault !== "NONE") {
        faultEl.style.color = "var(--color-fault)";
    } else {
        faultEl.style.color = "var(--text-main)";
    }

    // 7. Optional Solar
    const solarBadge = document.getElementById('so-conn-badge');
    if (data.solar.connected) {
        solarBadge.textContent = "Connected";
        solarBadge.style.backgroundColor = "var(--color-normal)";
        solarBadge.style.color = "white";
        document.getElementById('so-volt').textContent = `${data.solar.voltage.toFixed(1)} V`;
        document.getElementById('so-curr').textContent = `${data.solar.current.toFixed(1)} A`;
        document.getElementById('so-power').textContent = `${Math.round(data.solar.power)} W`;
    } else {
        solarBadge.textContent = "Not Connected";
        solarBadge.style.backgroundColor = "var(--border-color)";
        solarBadge.style.color = "var(--text-muted)";
        document.getElementById('so-volt').textContent = "-- V";
        document.getElementById('so-curr').textContent = "-- A";
        document.getElementById('so-power').textContent = "-- W";
    }
}

/**
 * Utility: Format seconds into HH:MM:SS
 */
function formatTime(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Utility: Get color variable based on state
 */
function getStateColor(state) {
    switch (state) {
        case 'RUNNING': return 'var(--color-running)';
        case 'IDLE': return 'var(--color-idle)';
        case 'STOPPED': return 'var(--color-stopped)';
        case 'FAULT':
        case 'JAM':
        case 'EMERGENCY STOP': return 'var(--color-fault)';
        default: return 'var(--text-muted)';
    }
}

/**
 * Utility: Update safety indicator text and color
 */
function updateSafetyIndicator(id, status) {
    const el = document.getElementById(id);
    el.textContent = status;
    el.className = ''; // reset classes
    if (status === 'NORMAL') {
        el.classList.add('status-normal');
    } else if (status === 'WARNING') {
        el.classList.add('status-warning');
    } else {
        el.classList.add('status-fault');
    }
}

/**
 * Frontend command sending.
 * The frontend only sends commands. STM32 validates safety.
 * @param {string} cmd 
 */
function sendCommand(cmd) {
    console.log(`Command sent: ${cmd}`);
    
    if (REALTIME_MODE) {
        // Future WebSocket implementation
        /*
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'command', command: cmd }));
        }
        */
    } else if (USE_MOCK_DATA) {
        // Simulate local command effect for demonstration
        if (cmd === 'START') currentMockData.machine.state = 'RUNNING';
        if (cmd === 'STOP') currentMockData.machine.state = 'STOPPED';
        if (cmd === 'REVERSE') currentMockData.machine.state = 'IDLE'; // e.g. reversing state
        if (cmd === 'RESET_FAULT') currentMockData.safety.activeFault = 'NONE';
        
        updateMachineData(currentMockData);
    }
}

/**
 * Update Connection Status Indicator
 */
function updateConnectionStatus(status) {
    const dot = document.getElementById('conn-dot');
    const text = document.getElementById('conn-status');
    
    text.textContent = status;
    
    switch (status) {
        case 'DEMO':
            dot.style.backgroundColor = 'var(--color-warning)';
            break;
        case 'CONNECTING':
            dot.style.backgroundColor = 'var(--color-warning)';
            break;
        case 'CONNECTED':
            dot.style.backgroundColor = 'var(--color-normal)';
            break;
        case 'DISCONNECTED':
            dot.style.backgroundColor = 'var(--color-fault)';
            break;
    }
}

/**
 * Mock Data Generator
 */
function startMockData() {
    updateConnectionStatus('DEMO');
    
    mockDataInterval = setInterval(() => {
        if (currentMockData.machine.state === 'RUNNING') {
            currentMockData.machine.runtime += 1;
            currentMockData.processing.processingTime += 1;
            
            // Randomly vary values slightly
            currentMockData.motor.rpm = 850 + (Math.random() * 20 - 10);
            currentMockData.motor.current = 12.4 + (Math.random() * 0.4 - 0.2);
            currentMockData.motor.temperature = 48 + (Math.random() * 1 - 0.5);
            currentMockData.motor.load = 64 + (Math.random() * 4 - 2);
            
            currentMockData.power.voltage = 48.2 + (Math.random() * 0.5 - 0.25);
            currentMockData.power.current = currentMockData.motor.current;
            currentMockData.power.power = currentMockData.power.voltage * currentMockData.power.current;
            currentMockData.power.energy += (currentMockData.power.power / 3600000); // rough conversion to kWh per sec
            
            currentMockData.processing.processedWeight += (14.2 / 3600);
        } else {
            currentMockData.motor.rpm = 0;
            currentMockData.motor.current = 0;
            currentMockData.motor.load = 0;
            currentMockData.power.current = 0;
            currentMockData.power.power = 0;
        }

        updateMachineData(currentMockData);
    }, 1000);
}

/**
 * Future WebSocket Connection
 */
let socket;
function connectRealtime() {
    updateConnectionStatus('CONNECTING');
    
    socket = new WebSocket('ws://localhost:8080');
    
    socket.onopen = () => {
        console.log('WebSocket Connected');
        updateConnectionStatus('CONNECTED');
    };
    
    socket.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            if (message.type === "machine_update") {
                updateMachineData(message.data);
            }
        } catch (e) {
            console.error("Error parsing WebSocket message:", e);
        }
    };
    
    socket.onclose = () => {
        console.log('WebSocket Disconnected. Reconnecting...');
        updateConnectionStatus('DISCONNECTED');
        setTimeout(connectRealtime, 5000);
    };
    
    socket.onerror = (error) => {
        console.error('WebSocket Error:', error);
    };
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Initial paint
    updateMachineData(currentMockData);
    
    if (REALTIME_MODE) {
        connectRealtime();
    } else if (USE_MOCK_DATA) {
        startMockData();
    }
});
