/**
 * CircularSeed API Client
 * Manages HTTP communication with the backend API with automatic JWT token attachment
 * and seamless offline/static demo fallbacks for GitHub Pages hosting.
 */

const ApiClient = (() => {
    const TOKEN_KEY = 'cs_auth_token';
    const AUTH_USER_KEY = 'cs_auth_user';

    const isStaticHost = typeof window !== 'undefined' && (
        window.location.hostname.includes('github.io') ||
        window.location.protocol === 'file:' ||
        window.location.hostname === ''
    );

    async function getFirebaseService(timeoutMs = 2500) {
        if (typeof window !== 'undefined' && window.FirebaseService) {
            return window.FirebaseService;
        }
        if (typeof window === 'undefined') return null;
        return new Promise((resolve) => {
            const timer = setTimeout(() => resolve(window.FirebaseService || null), timeoutMs);
            window.addEventListener('firebase:ready', (e) => {
                clearTimeout(timer);
                resolve((e && e.detail) || window.FirebaseService || null);
            }, { once: true });
        });
    }

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
        localStorage.removeItem(AUTH_USER_KEY);
        sessionStorage.removeItem(AUTH_USER_KEY);
        localStorage.removeItem('cs_demo_user');
        sessionStorage.removeItem('cs_demo_user');
    }

    function getStoredUser() {
        try {
            const raw = localStorage.getItem(AUTH_USER_KEY) || sessionStorage.getItem(AUTH_USER_KEY) || sessionStorage.getItem('cs_demo_user');
            if (raw) return JSON.parse(raw);
        } catch (e) {}
        return null;
    }

    function setStoredUser(user, persist = false) {
        try {
            const val = JSON.stringify(user);
            if (persist) {
                localStorage.setItem(AUTH_USER_KEY, val);
            } else {
                sessionStorage.setItem(AUTH_USER_KEY, val);
            }
        } catch (e) {}
    }

    function buildUserFromEmail(email, uid = null, displayName = null) {
        const lowerEmail = (email || '').toLowerCase().trim();
        let role = 'CEO';
        if (lowerEmail.includes('customer')) {
            role = 'CUSTOMER';
        } else if (lowerEmail.includes('operator')) {
            role = 'OPERATOR';
        } else if (lowerEmail.includes('admin') || lowerEmail.includes('ceo')) {
            role = 'CEO';
        }

        const prefix = lowerEmail.split('@')[0] || 'User';
        const formattedName = displayName || (prefix.charAt(0).toUpperCase() + prefix.slice(1));
        const avatar = formattedName.substring(0, 2).toUpperCase();

        return {
            id: uid || `USR-${role}-01`,
            email: lowerEmail,
            role: role,
            name: formattedName,
            organizationId: 'ORG-CIRCULARSEED',
            organization_id: 'ORG-CIRCULARSEED',
            organizationName: 'CircularSeed Internal Fleet',
            avatar: avatar
        };
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
                error: 'Please sign in with your Firebase account credentials.'
            };
        }

        // 3. Auth Me
        if (cleanPath.endsWith('/api/auth/me')) {
            const user = getStoredUser();
            return { success: !!user, user };
        }

        // 4. Logout
        if (cleanPath.endsWith('/api/auth/logout')) {
            clearToken();
            return { success: true };
        }

        const currentUser = getStoredUser();

        // 5. Machines Summary
        if (cleanPath.endsWith('/api/machines/summary')) {
            return {
                success: true,
                summary: {
                    total: 1,
                    running: 1,
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
            return {
                success: true,
                machines: [
                    {
                        id: 'CS001',
                        machine_id: 'CS001',
                        model: 'FLEXISHRED-DC Pro',
                        name: 'CircularSeed-001',
                        serial_number: 'SN-CS001-PRO',
                        organization_id: 'ORG-CIRCULARSEED',
                        organization_name: 'CircularSeed Internal Fleet',
                        location: 'Processing Floor - Bay 1',
                        hardware_type: 'PROD_48V',
                        hardwareType: 'PROD_48V',
                        state: 'RUNNING',
                        status: 'RUNNING',
                        motor_type: 'Dual 48V BLDC (M1 & M2)',
                        motorType: 'Dual 48V BLDC (M1 & M2)',
                        rated_voltage_v: 48.0,
                        ratedVoltageV: 48.0,
                        live: {
                            rpm: 850,
                            voltage: 48.2,
                            power: 1165,
                            lastUpdate: new Date().toISOString(),
                            isStale: false,
                            isOffline: false,
                            activeFault: null,
                            runId: 'RUN-2026-0001',
                            isDemo: false
                        }
                    }
                ]
            };
        }

        // 7. Organizations
        if (cleanPath.endsWith('/api/machines/organizations')) {
            return {
                success: true,
                organizations: [
                    { id: 'ORG-CIRCULARSEED', name: 'CircularSeed Internal Fleet', industry: 'Headquarters' }
                ]
            };
        }

        // 8. Machine Detail
        const matchDetail = cleanPath.match(/\/api\/machines\/([A-Za-z0-9_-]+)$/);
        if (matchDetail) {
            const machineId = matchDetail[1];
            return {
                success: true,
                machine: {
                    id: machineId,
                    machine_id: machineId,
                    model: 'FLEXISHRED-DC Pro',
                    name: 'CircularSeed-001',
                    serial_number: `SN-${machineId}-PRO`,
                    organization_id: 'ORG-CIRCULARSEED',
                    organization_name: 'CircularSeed Internal Fleet',
                    location: 'Processing Floor - Bay 1',
                    hardware_type: 'PROD_48V',
                    hardwareType: 'PROD_48V',
                    state: 'RUNNING',
                    status: 'RUNNING',
                    motor_type: 'Dual 48V BLDC (M1 & M2)',
                    motorType: 'Dual 48V BLDC (M1 & M2)',
                    rated_voltage_v: 48.0,
                    ratedVoltageV: 48.0,
                    live: {
                        rpm: 850,
                        voltage: 48.2,
                        power: 1165,
                        lastUpdate: new Date().toISOString(),
                        isStale: false,
                        isOffline: false,
                        activeFault: null,
                        runId: 'RUN-2026-0001',
                        isDemo: false
                    },
                    latestTelemetry: {
                        machineId: machineId,
                        timestamp: new Date().toISOString(),
                        isDemo: false,
                        machine: { state: 'RUNNING', runId: 'RUN-2026-0001', runtimeSeconds: 1200 },
                        dcPower: { voltage: 48.2, current: 24.1, power: 1165, energyWh: 4000, lifetimeEnergyKWh: 120.0 },
                        motors: [
                            { id: 'M1', rpm: 850, temperature: 45.0, current: 12.0, state: 'RUNNING', fault: 'NORMAL' },
                            { id: 'M2', rpm: 850, temperature: 45.0, current: 12.1, state: 'RUNNING', fault: 'NORMAL' }
                        ],
                        battery: { configured: true, voltage: 51.2, soc: 85, current: 4.8, powerW: 245, temperature: 28.5, status: 'CHARGING' },
                        solar: { configured: true, powerW: 420, dailyEnergyWh: 1500 },
                        safety: { estopActive: false, guardClosed: true, overload: false, overtemperature: false, jamDetected: false, commsError: false }
                    }
                }
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
            const fbService = await getFirebaseService(2000);

            // If Firebase is available, authenticate with Firebase
            if (fbService && typeof fbService.loginWithFirebase === 'function') {
                try {
                    const fbUser = await fbService.loginWithFirebase(email, password);
                    let token = '';
                    try {
                        token = await fbUser.getIdToken();
                    } catch (tErr) {
                        token = fbUser.accessToken || ('fb_token_' + Date.now());
                    }
                    const user = buildUserFromEmail(fbUser.email || email, fbUser.uid, fbUser.displayName);

                    setStoredUser(user, remember);
                    setToken(token, remember);

                    return {
                        success: true,
                        user,
                        token
                    };
                } catch (fbErr) {
                    console.error('[Firebase Auth] Sign in failed:', fbErr);
                    let errMsg = fbErr.message || 'Authentication failed.';
                    const code = fbErr.code || '';
                    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
                        errMsg = 'Invalid email or password.';
                    } else if (code === 'auth/invalid-email') {
                        errMsg = 'Please enter a valid email address.';
                    } else if (code === 'auth/too-many-requests') {
                        errMsg = 'Too many attempts. Access is temporarily disabled. Please try again later.';
                    } else if (code === 'auth/network-request-failed') {
                        errMsg = 'Network error. Please check your internet connection.';
                    }
                    return {
                        success: false,
                        error: errMsg
                    };
                }
            }

            // Fallback for non-Firebase environments (e.g. backend server API)
            const data = await request('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });
            if (data.success && data.token) {
                setToken(data.token, remember);
                if (data.user) {
                    setStoredUser(data.user, remember);
                }
            }
            return data;
        },

        async getCurrentUser() {
            const stored = getStoredUser();
            if (stored) {
                return { success: true, user: stored };
            }
            return request('/api/auth/me');
        },

        async logout() {
            try {
                const fbService = await getFirebaseService(500);
                if (fbService && typeof fbService.logoutFromFirebase === 'function') {
                    await fbService.logoutFromFirebase();
                }
            } catch (e) {}
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
