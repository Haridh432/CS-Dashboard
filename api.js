/**
 * CircularSeed API Client
 * Manages HTTP communication with the backend API with automatic JWT token attachment.
 */

const ApiClient = (() => {
    const TOKEN_KEY = 'cs_auth_token';

    function getToken() {
        return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
    }

    function setToken(token, persist = false) {
        if (persist) {
            localStorage.setItem(TOKEN_KEY, token);
        } else {
            sessionStorage.setItem(TOKEN_KEY, token);
        }
    }

    function clearToken() {
        localStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(TOKEN_KEY);
    }

    async function request(endpoint, options = {}) {
        const token = getToken();
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const res = await fetch(endpoint, {
                ...options,
                headers
            });

            if (res.status === 401) {
                clearToken();
                // If not already on login, trigger auth event
                window.dispatchEvent(new CustomEvent('auth:expired'));
            }

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || `HTTP ${res.status}: ${res.statusText}`);
            }

            return data;
        } catch (err) {
            console.error(`[API Error ${endpoint}]`, err.message);
            throw err;
        }
    }

    return {
        getToken,
        setToken,
        clearToken,

        // Auth
        async login(email, password, remember = false) {
            const data = await request('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });
            if (data.success && data.token) {
                setToken(data.token, remember);
            }
            return data;
        },

        async getCurrentUser() {
            return request('/api/auth/me');
        },

        async getDemoCredentials() {
            return request('/api/auth/demo-credentials');
        },

        async logout() {
            try {
                await request('/api/auth/logout', { method: 'POST' });
            } catch (e) {
                // Ignore logout network failure
            } finally {
                clearToken();
            }
        },

        // Machines
        async getMachines() {
            return request('/api/machines');
        },

        async getOrganizations() {
            return request('/api/machines/organizations');
        },

        async addMachine(data) {
            return request('/api/machines', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        },

        async deleteMachine(machineId) {
            return request(`/api/machines/${encodeURIComponent(machineId)}`, {
                method: 'DELETE'
            });
        },

        async getSummary() {
            return request('/api/machines/summary');
        },

        async getMachineDetail(machineId) {
            return request(`/api/machines/${encodeURIComponent(machineId)}`);
        },

        async getMachineHistory(machineId, range = '24h') {
            return request(`/api/machines/${encodeURIComponent(machineId)}/history?range=${encodeURIComponent(range)}`);
        },

        async getMachineEvents(machineId, limit = 20) {
            return request(`/api/machines/${encodeURIComponent(machineId)}/events?limit=${limit}`);
        },

        async getMachineMaintenance(machineId) {
            return request(`/api/machines/${encodeURIComponent(machineId)}/maintenance`);
        },

        async sendCommand(machineId, action, params = {}) {
            return request(`/api/machines/${encodeURIComponent(machineId)}/command`, {
                method: 'POST',
                body: JSON.stringify({ action, params })
            });
        },

        async injectFault(machineId, faultType, value = null) {
            return request(`/api/machines/${encodeURIComponent(machineId)}/inject-fault`, {
                method: 'POST',
                body: JSON.stringify({ faultType, value })
            });
        },

        getExportUrl(machineId, format = 'csv', range = 'all') {
            const token = getToken();
            return `/api/machines/${encodeURIComponent(machineId)}/export?format=${format}&range=${range}&token=${token || ''}`;
        }
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApiClient;
}
