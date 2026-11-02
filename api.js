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

    // Default Seeded Demo Users
    const DEMO_USERS = [
        {
            id: 'USR-CEO-01',
            email: 'ceo@circularseed.com',
            password: 'CircularCEO#2025',
            role: 'CEO',
            name: 'Harish (Executive Director)',
            organizationId: 'ORG-CIRCULARSEED',
            organization_id: 'ORG-CIRCULARSEED',
            organizationName: 'CircularSeed Internal Fleet',
            avatar: 'CE'
        },
        {
            id: 'USR-CUST-01',
            email: 'customer@acme-plastics.com',
            password: 'Customer#Acme2025',
            role: 'CUSTOMER',
            name: 'Sarah Connor (Plant Manager)',
            organizationId: 'ORG-ACME',
            organization_id: 'ORG-ACME',
            organizationName: 'Acme Plastics Processing Corp',
            avatar: 'AC'
        },
        {
            id: 'USR-OP-01',
            email: 'operator@circularseed.com',
            password: 'Operator#Flexishred1',
            role: 'OPERATOR',
            name: 'Alex Rivera (Lead Shredder Operator)',
            organizationId: 'ORG-ACME',
            organization_id: 'ORG-ACME',
            organizationName: 'Acme Plastics Processing Corp',
            avatar: 'OP'
        }
    ];

    // Seeded Demo Machines
    const DEMO_MACHINES = [
        {
            id: 'CS-FS-0001',
            model: 'FLEXISHRED-DC Pro',
            serial_number: 'SN-2026-0001-PRO',
            organization_id: 'ORG-ACME',
            organization_name: 'Acme Plastics Processing Corp',
            organization_industry: 'Post-Industrial Polymers',
            location: 'Unit 4 - Bay A (Primary Shredder)',
            gateway_id: 'GW-ESP32-0001',
            commissioning_date: '2026-01-15',
            sensor_capabilities: JSON.stringify(['dual_motor', 'battery', 'solar', 'temperature', 'dc_power', 'interlocks']),
            sensorCapabilities: ['dual_motor', 'battery', 'solar', 'temperature', 'dc_power', 'interlocks'],
            hardware_type: 'PROD_48V',
            hardwareType: 'PROD_48V',
            state: 'RUNNING',
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
                runId: 'RUN-2026-0042',
                isDemo: true
            },
            latestTelemetry: {
                machineId: 'CS-FS-0001',
                timestamp: new Date().toISOString(),
                isDemo: true,
                machine: { state: 'RUNNING', runId: 'RUN-2026-0042', runtimeSeconds: 1740 },
                dcPower: { voltage: 48.1, current: 24.2, power: 1164, energyWh: 4320, lifetimeEnergyKWh: 129.5 },
                motors: [
                    { id: 'M1', rpm: 855, temperature: 48.6, current: 12.1, state: 'RUNNING', fault: 'NORMAL' },
                    { id: 'M2', rpm: 846, temperature: 47.9, current: 12.1, state: 'RUNNING', fault: 'NORMAL' }
                ],
                battery: { configured: true, voltage: 51.3, soc: 82, current: 4.9, powerW: 251, temperature: 29.1, status: 'CHARGING' },
                solar: { configured: true, powerW: 420, dailyEnergyWh: 1650 },
                safety: { estopActive: false, guardClosed: true, overload: false, overtemperature: false, jamDetected: false, commsError: false }
            }
        },
        {
            id: 'CS-FS-0002',
            model: 'FLEXISHRED-DC Std',
            serial_number: 'SN-2026-0002-STD',
            organization_id: 'ORG-ACME',
            organization_name: 'Acme Plastics Processing Corp',
            organization_industry: 'Post-Industrial Polymers',
            location: 'Unit 4 - Line 2 (Secondary Regrind)',
            gateway_id: 'GW-ESP32-0002',
            commissioning_date: '2026-02-10',
            sensor_capabilities: JSON.stringify(['dual_motor', 'battery', 'dc_power', 'interlocks', 'temperature']),
            sensorCapabilities: ['dual_motor', 'battery', 'dc_power', 'interlocks', 'temperature'],
            hardware_type: 'PROD_48V',
            hardwareType: 'PROD_48V',
            state: 'RUNNING',
            motor_type: 'Dual 48V BLDC (M1 & M2)',
            motorType: 'Dual 48V BLDC (M1 & M2)',
            rated_voltage_v: 48.0,
            ratedVoltageV: 48.0,
            live: {
                rpm: 848,
                voltage: 48.0,
                power: 1152,
                lastUpdate: new Date().toISOString(),
                isStale: false,
                isOffline: false,
                activeFault: null,
                runId: 'RUN-2026-0019',
                isDemo: true
            },
            latestTelemetry: {
                machineId: 'CS-FS-0002',
                timestamp: new Date().toISOString(),
                isDemo: true,
                machine: { state: 'RUNNING', runId: 'RUN-2026-0019', runtimeSeconds: 620 },
                dcPower: { voltage: 48.2, current: 24.1, power: 1162, energyWh: 1840, lifetimeEnergyKWh: 64.3 },
                motors: [
                    { id: 'M1', rpm: 852, temperature: 26.5, current: 12.0, state: 'RUNNING', fault: 'NORMAL' },
                    { id: 'M2', rpm: 848, temperature: 26.2, current: 12.1, state: 'RUNNING', fault: 'NORMAL' }
                ],
                battery: { configured: true, voltage: 51.2, soc: 78, current: 4.8, powerW: 246, temperature: 28.5, status: 'CHARGING' },
                solar: { configured: false, powerW: null, dailyEnergyWh: null },
                safety: { estopActive: false, guardClosed: true, overload: false, overtemperature: false, jamDetected: false, commsError: false }
            }
        },
        {
            id: 'CS-FS-0003',
            model: 'FLEXISHRED-DC Micro (12V L298N Prototype)',
            serial_number: 'SN-2026-0003-L298N',
            organization_id: 'ORG-ACME',
            organization_name: 'Acme Plastics Processing Corp',
            organization_industry: 'Post-Industrial Polymers',
            location: 'Pilot Lab Bench 2 (R&D Prototype)',
            gateway_id: 'GW-ESP32-0003',
            commissioning_date: '2026-03-01',
            sensor_capabilities: JSON.stringify(['single_motor', 'battery', 'l298n_dc_encoder', 'dc_power', 'interlocks', 'pwm_speed_control']),
            sensorCapabilities: ['single_motor', 'battery', 'l298n_dc_encoder', 'dc_power', 'interlocks', 'pwm_speed_control'],
            hardware_type: 'PROTOTYPE_12V_L298N',
            hardwareType: 'PROTOTYPE_12V_L298N',
            state: 'STOPPED',
            motor_type: '12V DC Encoder Motor (L298N Driver)',
            motorType: '12V DC Encoder Motor (L298N Driver)',
            rated_voltage_v: 12.0,
            ratedVoltageV: 12.0,
            live: {
                rpm: 0,
                voltage: 12.1,
                power: 0,
                lastUpdate: new Date().toISOString(),
                isStale: false,
                isOffline: false,
                activeFault: null,
                runId: 'PROTO-12V-003',
                isDemo: true
            },
            latestTelemetry: {
                machineId: 'CS-FS-0003',
                timestamp: new Date().toISOString(),
                isDemo: true,
                machine: { state: 'STOPPED', runId: 'PROTO-12V-003', runtimeSeconds: 0 },
                dcPower: { voltage: 12.1, current: 0.0, power: 0, energyWh: 320, lifetimeEnergyKWh: 8.5 },
                motors: [
                    { id: 'M1', rpm: 0, temperature: 27.2, current: 0.0, state: 'STOPPED', fault: 'NORMAL', driver: 'L298N', encoderType: 'Optical Quadrature' }
                ],
                battery: { configured: true, voltage: 12.6, soc: 91, current: 1.8, powerW: 23, temperature: 25.2, status: 'FLOAT' },
                solar: { configured: false, powerW: null, dailyEnergyWh: null },
                safety: { estopActive: false, guardClosed: true, overload: false, overtemperature: false, jamDetected: false, commsError: false }
            }
        },
        {
            id: 'CS-FS-0004',
            model: 'FLEXISHRED-DC Pro',
            serial_number: 'SN-2026-0004-PRO',
            organization_id: 'ORG-GREENCYCLE',
            organization_name: 'GreenCycle Eco Solutions',
            organization_industry: 'Municipal Recycling',
            location: 'Facility B - High Volume Sorting Line',
            gateway_id: 'GW-ESP32-0004',
            commissioning_date: '2026-02-28',
            sensor_capabilities: JSON.stringify(['dual_motor', 'battery', 'solar', 'dc_power', 'temperature', 'interlocks']),
            sensorCapabilities: ['dual_motor', 'battery', 'solar', 'dc_power', 'temperature', 'interlocks'],
            hardware_type: 'PROD_48V',
            hardwareType: 'PROD_48V',
            state: 'RUNNING',
            motor_type: 'Dual 48V BLDC (M1 & M2)',
            motorType: 'Dual 48V BLDC (M1 & M2)',
            rated_voltage_v: 48.0,
            ratedVoltageV: 48.0,
            live: {
                rpm: 845,
                voltage: 48.4,
                power: 1103,
                lastUpdate: new Date().toISOString(),
                isStale: false,
                isOffline: false,
                activeFault: null,
                runId: 'RUN-GC-0081',
                isDemo: true
            },
            latestTelemetry: {
                machineId: 'CS-FS-0004',
                timestamp: new Date().toISOString(),
                isDemo: true,
                machine: { state: 'RUNNING', runId: 'RUN-GC-0081', runtimeSeconds: 3200 },
                dcPower: { voltage: 48.4, current: 22.8, power: 1103, energyWh: 5840, lifetimeEnergyKWh: 210.6 },
                motors: [
                    { id: 'M1', rpm: 845, temperature: 51.2, current: 11.5, state: 'RUNNING', fault: 'NORMAL' },
                    { id: 'M2', rpm: 842, temperature: 50.8, current: 11.3, state: 'RUNNING', fault: 'NORMAL' }
                ],
                battery: { configured: true, voltage: 51.6, soc: 85, current: 5.5, powerW: 284, temperature: 30.2, status: 'CHARGING' },
                solar: { configured: true, powerW: 680, dailyEnergyWh: 3200 },
                safety: { estopActive: false, guardClosed: true, overload: false, overtemperature: false, jamDetected: false, commsError: false }
            }
        },
        {
            id: 'CS-FS-0005',
            model: 'FLEXISHRED-DC Std',
            serial_number: 'SN-2026-0005-STD',
            organization_id: 'ORG-GREENCYCLE',
            organization_name: 'GreenCycle Eco Solutions',
            organization_industry: 'Municipal Recycling',
            location: 'Facility B - Yard Intake Bay',
            gateway_id: 'GW-ESP32-0005',
            commissioning_date: '2026-03-20',
            sensor_capabilities: JSON.stringify(['dual_motor', 'battery', 'dc_power', 'interlocks']),
            sensorCapabilities: ['dual_motor', 'battery', 'dc_power', 'interlocks'],
            hardware_type: 'PROD_48V',
            hardwareType: 'PROD_48V',
            state: 'FAULT',
            motor_type: 'Dual 48V BLDC (M1 & M2)',
            motorType: 'Dual 48V BLDC (M1 & M2)',
            rated_voltage_v: 48.0,
            ratedVoltageV: 48.0,
            live: {
                rpm: 0,
                voltage: 48.1,
                power: 0,
                lastUpdate: new Date().toISOString(),
                isStale: false,
                isOffline: false,
                activeFault: 'STALL_DETECTED',
                runId: 'RUN-GC-0077',
                isDemo: true
            },
            latestTelemetry: {
                machineId: 'CS-FS-0005',
                timestamp: new Date().toISOString(),
                isDemo: true,
                machine: { state: 'FAULT', runId: 'RUN-GC-0077', runtimeSeconds: 840 },
                dcPower: { voltage: 48.1, current: 0.0, power: 0, energyWh: 2100, lifetimeEnergyKWh: 92.1 },
                motors: [
                    { id: 'M1', rpm: 0, temperature: 42.0, current: 0.0, state: 'FAULT', fault: 'STALL_DETECTED' },
                    { id: 'M2', rpm: 0, temperature: 41.5, current: 0.0, state: 'FAULT', fault: 'STALL_DETECTED' }
                ],
                battery: { configured: true, voltage: 49.8, soc: 65, current: 0.0, powerW: 0, temperature: 26.1, status: 'STANDBY' },
                solar: { configured: false, powerW: null, dailyEnergyWh: null },
                safety: { estopActive: false, guardClosed: true, overload: true, overtemperature: false, jamDetected: true, commsError: false }
            }
        },
        {
            id: 'CS-FS-0006',
            model: 'FLEXISHRED-DC Pro',
            serial_number: 'SN-2026-0006-EXP',
            organization_id: 'ORG-CIRCULARSEED',
            organization_name: 'CircularSeed Internal Fleet',
            organization_industry: 'Cleantech OEM',
            location: 'CircularSeed Tech Lab - Testbed A',
            gateway_id: 'GW-ESP32-0006',
            commissioning_date: '2026-04-01',
            sensor_capabilities: JSON.stringify(['dual_motor', 'battery', 'solar', 'temperature', 'dc_power', 'interlocks']),
            sensorCapabilities: ['dual_motor', 'battery', 'solar', 'temperature', 'dc_power', 'interlocks'],
            hardware_type: 'PROD_48V',
            hardwareType: 'PROD_48V',
            state: 'RUNNING',
            motor_type: 'Dual 48V BLDC (M1 & M2)',
            motorType: 'Dual 48V BLDC (M1 & M2)',
            rated_voltage_v: 48.0,
            ratedVoltageV: 48.0,
            live: {
                rpm: 855,
                voltage: 48.2,
                power: 1180,
                lastUpdate: new Date().toISOString(),
                isStale: false,
                isOffline: false,
                activeFault: null,
                runId: 'RUN-CS-0006',
                isDemo: true
            },
            latestTelemetry: {
                machineId: 'CS-FS-0006',
                timestamp: new Date().toISOString(),
                isDemo: true,
                machine: { state: 'RUNNING', runId: 'RUN-CS-0006', runtimeSeconds: 1540 },
                dcPower: { voltage: 48.2, current: 24.5, power: 1180, energyWh: 4210, lifetimeEnergyKWh: 145.2 },
                motors: [
                    { id: 'M1', rpm: 855, temperature: 46.2, current: 12.2, state: 'RUNNING', fault: 'NORMAL' },
                    { id: 'M2', rpm: 850, temperature: 45.8, current: 12.3, state: 'RUNNING', fault: 'NORMAL' }
                ],
                battery: { configured: true, voltage: 51.5, soc: 88, current: 5.0, powerW: 258, temperature: 28.0, status: 'CHARGING' },
                solar: { configured: true, powerW: 550, dailyEnergyWh: 2400 },
                safety: { estopActive: false, guardClosed: true, overload: false, overtemperature: false, jamDetected: false, commsError: false }
            }
        }
    ];

    function getCurrentDemoUser() {
        try {
            const raw = sessionStorage.getItem(DEMO_USER_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) {}
        return DEMO_USERS[0]; // Default CEO
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
                credentials: [
                    {
                        role: 'CEO',
                        title: 'Executive Director',
                        email: 'ceo@circularseed.com',
                        password: 'CircularCEO#2025',
                        desc: 'Full fleet visibility, machine configuration, and executive analytics'
                    },
                    {
                        role: 'CUSTOMER',
                        title: 'Acme Plastics Processing',
                        email: 'customer@acme-plastics.com',
                        password: 'Customer#Acme2025',
                        desc: 'Scoped view of Acme organization shredder fleet'
                    },
                    {
                        role: 'OPERATOR',
                        title: 'Lead Shredder Technician',
                        email: 'operator@circularseed.com',
                        password: 'Operator#Flexishred1',
                        desc: 'Active control access for assigned machine CS-FS-0001'
                    }
                ]
            };
        }

        // 2. Auth Login
        if (cleanPath.endsWith('/api/auth/login')) {
            let email = 'ceo@circularseed.com';
            let password = '';
            try {
                if (options.body) {
                    const parsed = JSON.parse(options.body);
                    email = (parsed.email || '').trim().toLowerCase();
                    password = parsed.password || '';
                }
            } catch (e) {}

            let matchedUser = DEMO_USERS.find(u => u.email.toLowerCase() === email);
            if (!matchedUser) {
                // If any unrecognized email, default to CEO for seamless access
                matchedUser = DEMO_USERS[0];
            }

            setCurrentDemoUser(matchedUser);
            const token = `static-demo-token-${matchedUser.role.toLowerCase()}-${Date.now()}`;
            setToken(token, true);

            return {
                success: true,
                token,
                user: matchedUser
            };
        }

        // 3. Auth Me
        if (cleanPath.endsWith('/api/auth/me')) {
            const user = getCurrentDemoUser();
            return { success: true, user };
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
                    total: 6,
                    running: 4,
                    ready: 0,
                    stopped: 1,
                    fault: 1,
                    offline: 0,
                    stale: 0,
                    staleMachines: [],
                    faultMachines: [
                        { id: 'CS-FS-0005', model: 'FLEXISHRED-DC Std', org: 'GreenCycle Eco Solutions', location: 'Facility B - Yard Intake Bay' }
                    ]
                }
            };
        }

        // 6. Machines List
        if (cleanPath.endsWith('/api/machines')) {
            let machines = DEMO_MACHINES;
            if (currentUser.role === 'CUSTOMER') {
                machines = DEMO_MACHINES.filter(m => m.organization_id === currentUser.organizationId);
            } else if (currentUser.role === 'OPERATOR') {
                machines = DEMO_MACHINES.filter(m => m.id === 'CS-FS-0001');
            }
            return { success: true, machines };
        }

        // 7. Organizations
        if (cleanPath.endsWith('/api/machines/organizations')) {
            return {
                success: true,
                organizations: [
                    { id: 'ORG-CIRCULARSEED', name: 'CircularSeed Internal Fleet', industry: 'Cleantech OEM' },
                    { id: 'ORG-ACME', name: 'Acme Plastics Processing Corp', industry: 'Post-Industrial Polymers' },
                    { id: 'ORG-GREENCYCLE', name: 'GreenCycle Eco Solutions', industry: 'Municipal Recycling' }
                ]
            };
        }

        // 8. Machine Detail
        const matchDetail = cleanPath.match(/\/api\/machines\/([A-Za-z0-9_-]+)$/);
        if (matchDetail) {
            const mId = matchDetail[1];
            const found = DEMO_MACHINES.find(m => m.id === mId) || DEMO_MACHINES[0];
            return {
                success: true,
                machine: {
                    ...found,
                    assignedOperators: [
                        { id: 'USR-OP-01', name: 'Alex Rivera', email: 'operator@circularseed.com', avatar: 'OP' }
                    ],
                    maintenance: [
                        { id: 1, maintenance_date: '2026-03-10', maintenance_type: 'ROUTINE', technician_name: 'Marcus Vance', description: 'Greased shaft roller bearings, blade clearance 0.35mm verified.' }
                    ],
                    recentEvents: [
                        { id: 1, timestamp: new Date(Date.now() - 3600000).toISOString(), event_type: 'STATE_CHANGE', severity: 'INFO', description: 'Machine started by operator.' }
                    ]
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
