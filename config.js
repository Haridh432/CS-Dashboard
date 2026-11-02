/**
 * CircularSeed Dashboard - Configuration Module
 * Manages runtime settings, endpoints, and timeouts with localStorage persistence.
 */

const DashboardConfig = (() => {
    const STORAGE_KEY_WS = 'circularseed_ws_endpoint';
    const STORAGE_KEY_MODE = 'circularseed_mode'; // 'DEMO' | 'LIVE'

    // Default configuration
    const DEFAULTS = {
        // Default ESP32 gateway WebSocket URL (often default AP IP 192.168.4.1 or local mDNS)
        wsEndpoint: 'ws://192.168.4.1/ws',
        mode: 'DEMO', // Always default to DEMO mode for safety until explicitly toggled
        staleTimeoutMs: 3000, // Telemetry older than 3s without update marked STALE
        commandTimeoutMs: 5000, // Command ACK timeout
        reconnectBaseDelayMs: 1500, // Initial reconnect retry delay
        reconnectMaxDelayMs: 10000, // Maximum reconnect backoff delay
        reconnectBackoffFactor: 1.5,
        heartbeatIntervalMs: 2000,
        energyAccumulationRateSec: 1.0 // update cadence
    };

    return {
        getWsEndpoint() {
            try {
                return localStorage.getItem(STORAGE_KEY_WS) || DEFAULTS.wsEndpoint;
            } catch (e) {
                return DEFAULTS.wsEndpoint;
            }
        },

        setWsEndpoint(url) {
            try {
                localStorage.setItem(STORAGE_KEY_WS, url.trim());
            } catch (e) {
                console.warn('localStorage access failed:', e);
            }
        },

        getMode() {
            try {
                return localStorage.getItem(STORAGE_KEY_MODE) || DEFAULTS.mode;
            } catch (e) {
                return DEFAULTS.mode;
            }
        },

        setMode(mode) {
            if (mode !== 'DEMO' && mode !== 'LIVE') return;
            try {
                localStorage.setItem(STORAGE_KEY_MODE, mode);
            } catch (e) {
                console.warn('localStorage access failed:', e);
            }
        },

        getStaleTimeoutMs() {
            return DEFAULTS.staleTimeoutMs;
        },

        getCommandTimeoutMs() {
            return DEFAULTS.commandTimeoutMs;
        },

        getReconnectSettings() {
            return {
                baseDelay: DEFAULTS.reconnectBaseDelayMs,
                maxDelay: DEFAULTS.reconnectMaxDelayMs,
                factor: DEFAULTS.reconnectBackoffFactor
            };
        },

        getHeartbeatIntervalMs() {
            return DEFAULTS.heartbeatIntervalMs;
        }
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DashboardConfig;
}
