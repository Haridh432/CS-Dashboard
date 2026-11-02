/**
 * CircularSeed Dashboard - WebSocket Communication Client
 * Handles real-time telemetry streaming, subscriptions, reconnection, and staleness watchdog.
 */

class GatewayWebSocketClient {
    constructor() {
        this.socket = null;
        this.url = '';
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
        this.staleWatchdogTimer = null;
        this.heartbeatTimer = null;
        this.lastTelemetryTime = null;
        this.isExplicitlyClosed = false;
        this.status = 'DISCONNECTED'; // 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'STALE'
        this.subscribedMachineId = null;
        this.isSubscribedToFleet = false;

        // Callbacks
        this.onStatusChange = null;
        this.onTelemetry = null;
        this.onFleetUpdate = null;
        this.onAck = null;
        this.onError = null;
        this.demoSimTimer = null;
    }

    startStaticDemoSimulator() {
        if (this.demoSimTimer) clearInterval(this.demoSimTimer);
        this.setStatus('CONNECTED', 'DEMO LIVE');
        let simSeconds = 1740;

        this.demoSimTimer = setInterval(() => {
            simSeconds += 1;
            const mId = this.subscribedMachineId || 'CS-FS-0001';
            const isProto = mId === 'CS-FS-0003';
            const baseRpm = isProto ? 350 : 850;
            const rpm1 = Math.round(baseRpm + (Math.random() * 8 - 4));
            const rpm2 = Math.round(baseRpm + (Math.random() * 8 - 4));
            const volt = isProto ? 12.1 : +(48.2 + (Math.random() * 0.2 - 0.1)).toFixed(1);
            const curr = isProto ? 1.8 : +(24.2 + (Math.random() * 0.4 - 0.2)).toFixed(1);
            const power = Math.round(volt * curr);
            const bVolt = isProto ? 12.6 : +(51.3 + (Math.random() * 0.2 - 0.1)).toFixed(1);
            const bCurr = isProto ? 1.8 : +(5.0 + (Math.random() * 0.2 - 0.1)).toFixed(1);
            const bPower = Math.round(bVolt * bCurr);

            const packet = {
                type: 'telemetry',
                machineId: mId,
                timestamp: new Date().toISOString(),
                sequence: Math.floor(Date.now() / 1000),
                isDemo: true,
                isLive: true,
                machine: {
                    state: 'RUNNING',
                    runId: 'RUN-2026-DEMO',
                    runtimeSeconds: simSeconds
                },
                dcPower: {
                    voltage: volt,
                    current: curr,
                    power: power,
                    energyWh: 3500 + Math.round((simSeconds - 1740) * 0.3),
                    lifetimeEnergyKWh: 128.5
                },
                motors: isProto ? [
                    { id: 'M1', rpm: rpm1, temperature: 27.2, current: curr, state: 'RUNNING', fault: 'NORMAL', driver: 'L298N', encoderType: 'Optical Quadrature' }
                ] : [
                    { id: 'M1', rpm: rpm1, temperature: 48.6, current: +(curr / 2).toFixed(1), state: 'RUNNING', fault: 'NORMAL' },
                    { id: 'M2', rpm: rpm2, temperature: 47.9, current: +(curr / 2).toFixed(1), state: 'RUNNING', fault: 'NORMAL' }
                ],
                battery: {
                    configured: true,
                    voltage: bVolt,
                    soc: 82,
                    current: bCurr,
                    powerW: bPower,
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
                    commsError: false
                }
            };

            if (typeof this.onTelemetry === 'function') {
                this.onTelemetry(packet);
            }
        }, 1000);
    }

    setStatus(newStatus, detail = '') {
        if (this.status === newStatus && !detail) return;
        this.status = newStatus;
        if (typeof this.onStatusChange === 'function') {
            this.onStatusChange(newStatus, detail);
        }
    }

    connect(endpointUrl) {
        if (this.socket && (this.socket.readyState === WebSocket.CONNECTING || this.socket.readyState === WebSocket.OPEN)) {
            return;
        }

        const isStaticHost = typeof window !== 'undefined' && (
            window.location.hostname.includes('github.io') ||
            window.location.protocol === 'file:'
        );

        if (isStaticHost) {
            this.startStaticDemoSimulator();
            return;
        }

        // Determine default WS URL: use backend server WS (/ws) with auth token
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host || 'localhost:3000';
        const token = ApiClient.getToken() || '';
        const defaultBackendWs = `${protocol}//${host}/ws?token=${encodeURIComponent(token)}`;

        this.url = endpointUrl || defaultBackendWs;
        this.isExplicitlyClosed = false;
        this.clearTimers();
        this.setStatus('CONNECTING', `Connecting to WebSocket gateway...`);

        try {
            this.socket = new WebSocket(this.url);
        } catch (err) {
            this.setStatus('DISCONNECTED', `Failed to initialize socket: ${err.message}`);
            this.scheduleReconnect();
            return;
        }

        this.socket.onopen = () => {
            this.reconnectAttempts = 0;
            this.setStatus('CONNECTED', 'Connected to gateway');
            this.startHeartbeat();
            this.resetStaleWatchdog();

            // Re-subscribe to active subscriptions
            if (this.isSubscribedToFleet) {
                this.subscribeFleet();
            }
            if (this.subscribedMachineId) {
                this.subscribeMachine(this.subscribedMachineId);
            }
        };

        this.socket.onmessage = (event) => {
            this.handleMessage(event.data);
        };

        this.socket.onclose = (event) => {
            this.clearTimers();
            if (!this.isExplicitlyClosed) {
                this.setStatus('DISCONNECTED', `Gateway disconnected (Code ${event.code})`);
                this.scheduleReconnect();
            } else {
                this.setStatus('DISCONNECTED', 'Connection closed');
            }
        };

        this.socket.onerror = (err) => {
            if (typeof this.onError === 'function') {
                this.onError(`WebSocket connection error`);
            }
        };
    }

    disconnect() {
        this.isExplicitlyClosed = true;
        this.clearTimers();
        if (this.socket) {
            try {
                this.socket.close();
            } catch (e) {
                // Ignore close error
            }
            this.socket = null;
        }
        this.setStatus('DISCONNECTED', 'Disconnected');
    }

    handleMessage(rawData) {
        try {
            const parsed = JSON.parse(rawData);

            if (parsed.type === 'telemetry') {
                this.lastTelemetryTime = Date.now();
                this.resetStaleWatchdog();

                if (this.status === 'STALE') {
                    this.setStatus('CONNECTED');
                }

                if (typeof this.onTelemetry === 'function') {
                    this.onTelemetry(parsed);
                }

                // Also update active machine detail if open
                if (window.MachineDetail && typeof MachineDetail.updateLiveTelemetry === 'function') {
                    MachineDetail.updateLiveTelemetry(parsed);
                }
            } else if (parsed.type === 'fleet_update') {
                if (typeof this.onFleetUpdate === 'function') {
                    this.onFleetUpdate(parsed);
                }
                if (window.FleetOverview && typeof FleetOverview.updateCardTelemetry === 'function') {
                    FleetOverview.updateCardTelemetry(parsed);
                }
                if (window.CustomerView && typeof CustomerView.updateCardTelemetry === 'function') {
                    CustomerView.updateCardTelemetry(parsed);
                }
            } else if (parsed.type === 'command_ack') {
                if (typeof this.onAck === 'function') {
                    this.onAck(parsed);
                }
            } else if (parsed.type === 'error') {
                console.warn('[WebSocket Server Error]', parsed.message);
                if (typeof this.onError === 'function') {
                    this.onError(parsed.message);
                }
            } else if (parsed.type === 'pong') {
                // Heartbeat reply
            }
        } catch (err) {
            console.error('[WebSocket] Failed to parse message:', err);
        }
    }

    subscribeFleet() {
        this.isSubscribedToFleet = true;
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type: 'subscribe', target: 'fleet' }));
        }
    }

    subscribeMachine(machineId) {
        // Unsubscribe from previous machine if different
        if (this.subscribedMachineId && this.subscribedMachineId !== machineId) {
            this.unsubscribeMachine(this.subscribedMachineId);
        }
        this.subscribedMachineId = machineId;
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type: 'subscribe', machineId }));
        }
    }

    unsubscribeMachine(machineId) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type: 'unsubscribe', machineId }));
        }
        if (this.subscribedMachineId === machineId) {
            this.subscribedMachineId = null;
        }
    }

    sendCommand(machineId, action, params = {}) {
        const cmdId = `CMD-${Date.now()}`;
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            // Fallback to HTTP API command
            return ApiClient.sendCommand(machineId, action, params);
        }

        try {
            this.socket.send(JSON.stringify({
                type: 'command',
                machineId,
                action,
                command_id: cmdId,
                params
            }));
            return Promise.resolve({ success: true, commandId: cmdId, status: 'PENDING' });
        } catch (err) {
            return Promise.reject(err);
        }
    }

    scheduleReconnect() {
        if (this.isExplicitlyClosed || this.reconnectTimer) return;

        const delay = Math.min(1500 * Math.pow(1.5, this.reconnectAttempts), 10000);
        this.reconnectAttempts++;

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            if (!this.isExplicitlyClosed) {
                this.connect(this.url);
            }
        }, delay);
    }

    resetStaleWatchdog() {
        if (this.staleWatchdogTimer) clearTimeout(this.staleWatchdogTimer);
        const timeout = 3500;

        this.staleWatchdogTimer = setTimeout(() => {
            if (this.status === 'CONNECTED') {
                this.setStatus('STALE', `Telemetry delayed > ${timeout / 1000}s`);
            }
        }, timeout);
    }

    startHeartbeat() {
        this.heartbeatTimer = setInterval(() => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
            }
        }, 5000);
    }

    clearTimers() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.staleWatchdogTimer) {
            clearTimeout(this.staleWatchdogTimer);
            this.staleWatchdogTimer = null;
        }
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GatewayWebSocketClient;
}
