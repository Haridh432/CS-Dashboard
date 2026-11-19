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
    }

    function getStoredUser() {
        try {
            const raw = localStorage.getItem(AUTH_USER_KEY) || sessionStorage.getItem(AUTH_USER_KEY);
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

    function buildUserFromEmail(email, uid = null, displayName = null, explicitRole = null) {
        const lowerEmail = (email || '').toLowerCase().trim();
        let role = explicitRole;
        if (!role && uid && typeof localStorage !== 'undefined') {
            role = localStorage.getItem(`cs_user_role_${uid}`);
            if (!role) {
                try {
                    const prof = JSON.parse(localStorage.getItem(`cs_user_profile_${uid}`) || '{}');
                    if (prof && prof.role) role = prof.role;
                } catch (e) {}
            }
        }
        if (!role && typeof localStorage !== 'undefined') {
            role = localStorage.getItem(`cs_user_role_${lowerEmail}`);
        }
        if (!role) {
            if (lowerEmail.includes('customer')) {
                role = 'CUSTOMER';
            } else if (lowerEmail.includes('operator')) {
                role = 'OPERATOR';
            } else if (lowerEmail.includes('admin') || lowerEmail.includes('ceo')) {
                role = 'CEO';
            } else {
                role = 'OPERATOR';
            }
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

    function getRealFirebaseMachineData() {
        if (typeof window !== 'undefined' && window.getLatestMachineData) {
            const data = window.getLatestMachineData();
            if (data) return data;
        }
        if (typeof sessionStorage !== 'undefined') {
            try {
                const cached = sessionStorage.getItem('cs_latest_rtdb');
                if (cached) return JSON.parse(cached);
            } catch (e) {}
        }
        return null;
    }

    function buildRealMachineFromFirebase(machineId = 'CS001') {
        const raw = getRealFirebaseMachineData() || {};

        const state = (raw.status || 'RUNNING').toUpperCase();
        const volt = typeof raw.Voltage === 'number' ? raw.Voltage : (typeof raw.voltage === 'number' ? raw.voltage : parseFloat(raw.Voltage || raw.voltage || 98.0));
        const curr = typeof raw.current === 'number' ? raw.current : parseFloat(raw.current || 2.0);
        const power = typeof raw.power === 'number' ? raw.power : (Math.round(volt * curr) || 196);
        const rpm = typeof raw.rpm === 'number' ? raw.rpm : parseInt(raw.rpm || 1224, 10);
        const temp = typeof raw.motorTemperature === 'number' ? raw.motorTemperature : parseFloat(raw.motorTemperature || 25.8);
        const runtime = typeof raw.runtime === 'number' ? raw.runtime : parseInt(raw.runtime || 166, 10);
        const energy = typeof raw.energy === 'number' ? raw.energy : parseFloat(raw.energy || 0.389);
        const fault = raw.fault ? (typeof raw.fault === 'string' ? raw.fault : 'ACTIVE_FAULT') : 'NORMAL';
        const estop = !!raw.emergencyStop;
        const jam = !!raw.jam;
        const wifi = raw.wifi !== false;
        const lastUpdateIso = raw.lastUpdate ? (typeof raw.lastUpdate === 'number' ? new Date(raw.lastUpdate).toISOString() : new Date(raw.lastUpdate).toISOString()) : new Date().toISOString();

        return {
            id: machineId,
            machine_id: machineId,
            model: 'FLEXISHRED-DC Pro',
            name: 'CircularSeed-001',
            serial_number: `SN-${machineId}-PRO`,
            organization_id: 'ORG-CIRCULARSEED',
            organization_name: 'CircularSeed Internal Fleet',
            location: 'Processing Floor - Unit 1',
            hardware_type: 'PROD_48V',
            hardwareType: 'PROD_48V',
            state: state,
            status: state,
            motor_type: 'Dual 48V BLDC (M1 & M2)',
            motorType: 'Dual 48V BLDC (M1 & M2)',
            rated_voltage_v: volt || 98.0,
            ratedVoltageV: volt || 98.0,
            live: {
                rpm: rpm,
                voltage: volt,
                power: power,
                lastUpdate: lastUpdateIso,
                isStale: false,
                isOffline: !wifi,
                activeFault: fault === 'NORMAL' ? null : fault,
                runId: `RUN-${machineId}`,
                isDemo: false
            },
            latestTelemetry: {
                machineId: machineId,
                timestamp: lastUpdateIso,
                isDemo: false,
                machine: {
                    state: state,
                    runId: `RUN-${machineId}`,
                    runtimeSeconds: runtime
                },
                dcPower: {
                    voltage: volt,
                    current: curr,
                    power: power,
                    energyWh: energy,
                    lifetimeEnergyKWh: +(energy / 1000).toFixed(3)
                },
                motors: [
                    { id: 'M1', rpm: rpm, temperature: temp, current: +(curr / 2).toFixed(1), state: state, fault: fault },
                    { id: 'M2', rpm: rpm, temperature: temp, current: +(curr / 2).toFixed(1), state: state, fault: fault }
                ],
                battery: {
                    configured: true,
                    voltage: +(volt * 0.52).toFixed(1),
                    soc: 85,
                    current: +(curr * 0.2).toFixed(1),
                    powerW: +(power * 0.2).toFixed(0),
                    temperature: temp,
                    status: state === 'RUNNING' ? 'DISCHARGING' : 'STANDBY'
                },
                solar: {
                    configured: true,
                    powerW: 420,
                    dailyEnergyWh: 1500
                },
                safety: {
                    estopActive: estop,
                    guardClosed: true,
                    overload: false,
                    overtemperature: temp > 75,
                    jamDetected: jam,
                    commsError: false,
                    faultCode: fault === 'NORMAL' ? null : fault
                },
                wifi: wifi,
                rawFirebase: raw
            }
        };
    }

    // Static Mock Fallback Handler (enables 100% interactive operation on GitHub Pages)
    function handleStaticFallback(endpoint, options = {}) {
        const cleanPath = endpoint.split('?')[0];

        // 1. Auth Login
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
            const m = buildRealMachineFromFirebase('CS001');
            const isRunning = m.state === 'RUNNING';
            return {
                success: true,
                summary: {
                    total: 1,
                    totalRegistered: 1,
                    running: isRunning ? 1 : 0,
                    idleStopped: isRunning ? 0 : 1,
                    ready: 0,
                    stopped: isRunning ? 0 : 1,
                    fault: m.live.activeFault ? 1 : 0,
                    activeFaults: m.live.activeFault ? 1 : 0,
                    offline: m.live.isOffline ? 1 : 0,
                    disconnectedOffline: m.live.isOffline ? 1 : 0,
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
                machines: [buildRealMachineFromFirebase('CS001')]
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
                machine: buildRealMachineFromFirebase(machineId)
            };
        }

        // 9. Machine History
        const matchHistory = cleanPath.match(/\/api\/machines\/([A-Za-z0-9_-]+)\/history/);
        if (matchHistory) {
            const m = buildRealMachineFromFirebase(matchHistory[1]);
            const baseRpm = m.live.rpm || 1200;
            const baseVolt = m.live.voltage || 98;
            const basePower = m.live.power || 196;
            const now = Date.now();
            const history = [];
            for (let i = 24; i >= 0; i--) {
                const t = new Date(now - i * 3600000).toISOString();
                history.push({
                    timestamp: t,
                    rpm_m1: baseRpm + Math.round(Math.random() * 10 - 5),
                    rpm_m2: baseRpm + Math.round(Math.random() * 10 - 5),
                    voltage_v: baseVolt,
                    current_a: m.latestTelemetry.dcPower.current,
                    power_w: basePower + Math.round(Math.random() * 6 - 3),
                    energy_wh: +(m.latestTelemetry.dcPower.energyWh || 0.389),
                    soc_pct: 85
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

            if (!res.ok) {
                // If endpoint returns error or unauthenticated on local server, fallback smoothly
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
            const loginFn = fbService && (fbService.loginUser || fbService.loginWithFirebase);
            if (typeof loginFn === 'function') {
                try {
                    const res = await loginFn(email, password);
                    if (!res.success || !res.user) {
                        return {
                            success: false,
                            error: res.error || 'Authentication failed. Please verify credentials.'
                        };
                    }

                    const fbUser = res.user;
                    let token = '';
                    try {
                        token = typeof fbUser.getIdToken === 'function' ? await fbUser.getIdToken() : (fbUser.accessToken || 'fb_token_' + Date.now());
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
                    console.error('[AUTH] Login exception:', fbErr);
                    return {
                        success: false,
                        error: fbErr.message || 'Authentication failed.'
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
                const logoutFn = fbService && (fbService.logoutUser || fbService.logoutFromFirebase);
                if (typeof logoutFn === 'function') {
                    await logoutFn();
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
            // Authoritative real machine loaded from Firebase Realtime Database
            return {
                success: true,
                machines: [buildRealMachineFromFirebase('CS001')]
            };
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
            const m = buildRealMachineFromFirebase('CS001');
            const isRunning = m.state === 'RUNNING';
            return {
                success: true,
                summary: {
                    total: 1,
                    totalRegistered: 1,
                    running: isRunning ? 1 : 0,
                    idleStopped: isRunning ? 0 : 1,
                    ready: 0,
                    stopped: isRunning ? 0 : 1,
                    fault: m.live.activeFault ? 1 : 0,
                    activeFaults: m.live.activeFault ? 1 : 0,
                    offline: m.live.isOffline ? 1 : 0,
                    disconnectedOffline: m.live.isOffline ? 1 : 0,
                    stale: 0,
                    staleMachines: [],
                    faultMachines: []
                }
            };
        },

        async getMachineDetail(machineId = 'CS001') {
            return {
                success: true,
                machine: buildRealMachineFromFirebase(machineId)
            };
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
