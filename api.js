/**
 * CircularSeed API Client
 * Manages HTTP communication with the backend API with automatic JWT token attachment
 * and seamless offline/static demo fallbacks for GitHub Pages hosting.
 */

const ApiClient = (() => {
    const TOKEN_KEY = 'cs_auth_token';
    const DEMO_USER_KEY = 'cs_demo_user';

    const isStaticHost = typeof window !== 'undefined' && (
        window.location.hostname.includes('github.io') ||
        window.location.protocol === 'file:' ||
        window.location.hostname === ''
    );

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
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem(DEMO_USER_KEY);
        }
    }

    function getCurrentDemoUser() {
        try {
            const raw = sessionStorage.getItem(DEMO_USER_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) {}
        return null;
    }

    function setCurrentDemoUser(user) {
        try {
            sessionStorage.setItem(DEMO_USER_KEY, JSON.stringify(user));
        } catch (e) {}
    }

    // Static Mock Fallback Handler (enables 100% interactive operation on GitHub Pages)
    function handleStaticFallback(endpoint, options = {}) {
        const cleanPath = endpoint.split('?')[0];

        // 1. Demo Credentials
        if (cleanPath.endsWith('/api/auth/demo-credentials')) {
            return {
                success: true,
                credentials: []
            };
        }

        // 2. Auth Login
        if (cleanPath.endsWith('/api/auth/login')) {
            return {
                success: false,
                error: 'Authentication failed. Please verify your credentials.'
            };
        }

        // 3. Auth Me
        if (cleanPath.endsWith('/api/auth/me')) {
            const user = getCurrentDemoUser();
            return { success: !!user, user };
        }

        // 4. Logout
        if (cleanPath.endsWith('/api/auth/logout')) {
            clearToken();
            return { success: true };
        }

        const currentUser = getCurrentDemoUser();

        // 5. Machines Summary
        if (cleanPath.endsWith('/api/machines/summary')) {
            return {
                success: true,
                summary: {
                    total: 0,
                    running: 0,
                    ready: 0,
                    stopped: 0,
                    fault: 0,
                    offline: 0,
                    stale: 0,
                    staleMachines: [],
                    faultMachines: []
                }
            };
        }

        // 6. Machines List
        if (cleanPath.endsWith('/api/machines')) {
            return { success: true, machines: [] };
        }

        // 7. Organizations
        if (cleanPath.endsWith('/api/machines/organizations')) {
            return {
                success: true,
                organizations: []
            };
        }

        // 8. Machine Detail
        const matchDetail = cleanPath.match(/\/api\/machines\/([A-Za-z0-9_-]+)$/);
        if (matchDetail) {
            return {
                success: false,
                error: 'Machine not found.'
            };
        }

        // 9. Machine History
        const matchHistory = cleanPath.match(/\/api\/machines\/([A-Za-z0-9_-]+)\/history/);
        if (matchHistory) {
            const now = Date.now();
            const history = [];
            for (let i = 24; i >= 0; i--) {
                const t = new Date(now - i * 3600000).toISOString();
                history.push({
                    timestamp: t,
                    rpm_m1: 850 + Math.round(Math.random() * 10 - 5),
                    rpm_m2: 846 + Math.round(Math.random() * 10 - 5),
                    voltage_v: 48.2,
                    current_a: 24.1,
                    power_w: 1160 + Math.round(Math.random() * 20 - 10),
                    energy_wh: 4000 + (24 - i) * 300,
                    soc_pct: 82
                });
            }
            return { success: true, history };
        }

        // 10. Machine Commands & Fault Injection
        if (cleanPath.includes('/command') || cleanPath.includes('/inject-fault')) {
            return { accepted: true, status: 'ACCEPTED', message: 'Command executed in demo environment.' };
        }

        return { success: true };
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

        // On static GitHub Pages, immediately use static demo fallback
        if (isStaticHost) {
            return handleStaticFallback(endpoint, options);
        }

        try {
            const res = await fetch(endpoint, {
                ...options,
                headers
            });

            if (res.status === 401) {
                clearToken();
                window.dispatchEvent(new CustomEvent('auth:expired'));
            }

            if (!res.ok) {
                // If endpoint not found on server, fallback smoothly
                return handleStaticFallback(endpoint, options);
            }

            const data = await res.json();
            return data;
        } catch (err) {
            console.warn(`[API Client] Falling back to static data for ${endpoint}: ${err.message}`);
            return handleStaticFallback(endpoint, options);
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

        async logout() {
            try {
                await request('/api/auth/logout', { method: 'POST' });
            } catch (e) {
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
