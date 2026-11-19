/**
 * CircularSeed Multi-Machine Monitoring Platform
 * Master Application Controller & Client-Side Router
 */
const App = (() => {
    let currentUser = null;
    let wsClient = null;
    let currentRoute = '';
    let currentMachineId = null;
    let confirmCallback = null;

    // View Mount container in DOM
    let mainMount = null;

    /**
     * Maps raw Firebase Realtime Database telemetry to MachineDetail packet structure
     */
    function mapFirebaseTelemetryToPacket(data, machineId = 'CS001') {
        if (!data) return null;
        if (data.machine && data.dcPower) {
            return { ...data, machineId: data.machineId || machineId, isDemo: false };
        }

        const state = (data.status || 'RUNNING').toUpperCase();
        const runtimeSec = typeof data.runtime === 'number' ? data.runtime : parseInt(data.runtime || 0, 10);
        // Note: Firebase RTDB provides Voltage with capital 'V' or lowercase 'voltage'
        const volt = typeof data.Voltage === 'number' ? data.Voltage : (typeof data.voltage === 'number' ? data.voltage : parseFloat(data.Voltage || data.voltage || 0));
        const curr = typeof data.current === 'number' ? data.current : parseFloat(data.current || 0);
        const power = typeof data.power === 'number' ? data.power : (Math.round(volt * curr) || 0);
        const rpm = typeof data.rpm === 'number' ? data.rpm : parseInt(data.rpm || 0, 10);
        const temp = typeof data.motorTemperature === 'number' ? data.motorTemperature : parseFloat(data.motorTemperature || 0);
        const energy = typeof data.energy === 'number' ? data.energy : parseFloat(data.energy || 0);
        const fault = data.fault ? (typeof data.fault === 'string' ? data.fault : 'ACTIVE_FAULT') : 'NORMAL';
        const estop = !!data.emergencyStop;
        const jam = !!data.jam;
        const wifi = data.wifi !== false;
        const lastUpdateIso = data.lastUpdate ? (typeof data.lastUpdate === 'number' ? new Date(data.lastUpdate).toISOString() : new Date(data.lastUpdate).toISOString()) : new Date().toISOString();

        return {
            type: 'telemetry',
            machineId: machineId,
            timestamp: lastUpdateIso,
            isDemo: false,
            machine: {
                state: state,
                runId: 'RUN-' + machineId,
                runtimeSeconds: runtimeSec
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
            rawFirebase: data
        };
    }

    function initFirebaseSubscription() {
        const handleData = (data) => {
            console.log("[Firebase RTDB] Live machine update received:", data);
            if (!data) return;

            const packet = mapFirebaseTelemetryToPacket(data, 'CS001');

            // 1. Update MachineDetail view if open
            if (typeof MachineDetail !== 'undefined' && MachineDetail && typeof MachineDetail.updateLiveTelemetry === 'function') {
                MachineDetail.updateLiveTelemetry(packet);
            }

            // 2. Update FleetOverview live machine card in-place if active
            if (typeof FleetOverview !== 'undefined' && FleetOverview && typeof FleetOverview.updateCardTelemetry === 'function') {
                FleetOverview.updateCardTelemetry({
                    machineId: 'CS001',
                    state: packet.machine.state,
                    rpm: packet.motors[0].rpm,
                    voltage: packet.dcPower.voltage,
                    power: packet.dcPower.power,
                    lastSeen: packet.timestamp
                });

                // Update fleet counters in real time
                const isRunning = packet.machine.state === 'RUNNING';
                const elRunning = document.getElementById('stat-running');
                if (elRunning) elRunning.textContent = isRunning ? '1' : '0';
                const elStopped = document.getElementById('stat-stopped');
                if (elStopped) elStopped.textContent = isRunning ? '0' : '1';
                const elFaults = document.getElementById('stat-faults');
                if (elFaults) elFaults.textContent = packet.safety.faultCode && packet.safety.faultCode !== 'NORMAL' ? '1' : '0';
                const elOffline = document.getElementById('stat-offline');
                if (elOffline) elOffline.textContent = packet.wifi === false ? '1' : '0';
            }

            // 3. Update top connection status pill to ONLINE
            updateHeaderConnectionStatus('CONNECTED', 'ONLINE');
        };

        if (typeof window !== 'undefined' && window.FirebaseService && typeof window.FirebaseService.subscribeToMachine === 'function') {
            window.FirebaseService.subscribeToMachine(handleData);
        } else if (typeof window !== 'undefined') {
            window.addEventListener('firebase:ready', (e) => {
                const svc = (e && e.detail) || window.FirebaseService;
                if (svc && typeof svc.subscribeToMachine === 'function') {
                    svc.subscribeToMachine(handleData);
                }
            }, { once: true });
        }
    }

    function mapFirebaseUser(user) {
        if (!user) return null;
        const email = user.email || '';
        let role = 'CEO';
        const lowerEmail = email.toLowerCase();
        if (lowerEmail.includes('customer')) {
            role = 'CUSTOMER';
        } else if (lowerEmail.includes('operator')) {
            role = 'OPERATOR';
        } else if (lowerEmail.includes('admin') || lowerEmail.includes('ceo')) {
            role = 'CEO';
        }

        const prefix = lowerEmail.split('@')[0] || 'User';
        const displayName = user.displayName || (prefix.charAt(0).toUpperCase() + prefix.slice(1));
        const avatar = displayName.substring(0, 2).toUpperCase();

        return {
            id: user.uid,
            email: email,
            role: role,
            name: displayName,
            organizationId: 'ORG-CIRCULARSEED',
            organization_id: 'ORG-CIRCULARSEED',
            organizationName: 'CircularSeed Internal Fleet',
            avatar: avatar
        };
    }

    function setupFirebaseAuthObserver() {
        const attachObserver = (svc) => {
            const observeFn = (svc && svc.observeAuthState) || window.observeAuthState;
            if (typeof observeFn === 'function') {
                observeFn((firebaseUser) => {
                    if (firebaseUser) {
                        currentUser = mapFirebaseUser(firebaseUser);
                        hideLoginOverlay();
                        updateHeaderUserProfile();
                        if (wsClient) wsClient.connect();
                        routeInitialView();
                    } else {
                        currentUser = null;
                        if (wsClient) wsClient.disconnect();
                        showLoginOverlay();
                        const userPill = document.getElementById('user-pill');
                        if (userPill) userPill.style.display = 'none';
                    }
                });
            }
        };

        if (typeof window !== 'undefined' && window.FirebaseService) {
            attachObserver(window.FirebaseService);
        } else if (typeof window !== 'undefined') {
            window.addEventListener('firebase:ready', (e) => {
                attachObserver((e && e.detail) || window.FirebaseService);
            }, { once: true });
        }
    }

    function init() {
        mainMount = document.getElementById('main-content-mount');
        wsClient = new GatewayWebSocketClient();

        setupHeaderEvents();
        setupAuthEvents();
        setupAddMachineModal();
        setupGlobalRouting();
        initFirebaseSubscription();
        setupFirebaseAuthObserver();

        // WebSocket Status Handlers
        wsClient.onStatusChange = (status, detail) => {
            if (typeof window !== 'undefined' && window.FirebaseService) {
                updateHeaderConnectionStatus('CONNECTED', 'ONLINE');
                return;
            }
            updateHeaderConnectionStatus(status, detail);
        };

        wsClient.onTelemetry = (packet) => {
            // CS001 telemetry is authoritatively driven by Firebase Realtime Database
            if (packet && packet.machineId === 'CS001') {
                return;
            }
            if (typeof MachineDetail !== 'undefined' && MachineDetail && typeof MachineDetail.updateLiveTelemetry === 'function') {
                MachineDetail.updateLiveTelemetry(packet);
            }
        };
    }

    function routeInitialView() {
        const path = window.location.pathname;
        const hash = window.location.hash;

        // Check if explicit path was requested
        if (hash.startsWith('#/machines/')) {
            const mId = hash.replace('#/machines/', '');
            navigateToMachine(mId, false);
            return;
        }
        if (path.startsWith('/machines/')) {
            const mId = path.replace('/machines/', '');
            navigateToMachine(mId, false);
            return;
        }

        // Role default routing
        if (currentUser.role === 'CEO') {
            navigateTo('/ceo/dashboard');
        } else if (currentUser.role === 'CUSTOMER') {
            navigateTo('/customer/dashboard');
        } else if (currentUser.role === 'OPERATOR') {
            navigateTo('/operator/dashboard');
        }
    }

    function setupGlobalRouting() {
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.route) {
                renderRoute(e.state.route, e.state.params, false);
            } else {
                routeInitialView();
            }
        });
    }

    function navigateTo(route, params = {}, pushState = true) {
        currentRoute = route;
        if (pushState) {
            window.history.pushState({ route, params }, '', route);
        }
        renderRoute(route, params);
    }

    function navigateToMachine(machineId, pushState = true) {
        currentMachineId = machineId;
        const url = `/machines/${machineId}`;
        if (pushState) {
            window.history.pushState({ route: 'machine_detail', params: { machineId } }, '', url);
        }
        renderRoute('machine_detail', { machineId });
    }

    function navigateBack() {
        if (currentUser.role === 'CEO') {
            navigateTo('/ceo/dashboard');
        } else if (currentUser.role === 'CUSTOMER') {
            navigateTo('/customer/dashboard');
        } else if (currentUser.role === 'OPERATOR') {
            navigateTo('/operator/dashboard');
        } else {
            window.history.back();
        }
    }

    async function renderRoute(route, params = {}) {
        if (!mainMount) {
            mainMount = document.getElementById('main-content-mount');
        }
        if (!mainMount) return;

        // Unsubscribe from machine if leaving detail
        if (route !== 'machine_detail' && currentMachineId) {
            wsClient.unsubscribeMachine(currentMachineId);
            currentMachineId = null;
        }

        if (route === '/' || route === '/ceo/dashboard' || (route === 'default' && (!currentUser || currentUser.role === 'CEO'))) {
            if (currentUser && currentUser.role !== 'CEO') {
                return navigateBack();
            }
            mainMount.innerHTML = `<div class="detail-loading"><div class="login-spinner"></div><p>Loading manufactured fleet...</p></div>`;
            try {
                const [machinesRes, summaryRes] = await Promise.all([
                    ApiClient.getMachines(),
                    ApiClient.getSummary()
                ]);
                FleetOverview.render(mainMount, {
                    machines: machinesRes.machines,
                    summary: summaryRes.summary
                });
                wsClient.subscribeFleet();
            } catch (err) {
                console.error('[Dashboard] Error loading fleet:', err);
                mainMount.innerHTML = `<div class="empty-filter-state"><p>Error loading fleet: ${err.message}</p></div>`;
            }
            return;
        }

        if (route === '/customer/dashboard' || (route === 'default' && currentUser.role === 'CUSTOMER')) {
            mainMount.innerHTML = `<div class="detail-loading"><div class="login-spinner"></div><p>Loading assigned machines...</p></div>`;
            try {
                const [machinesRes, summaryRes] = await Promise.all([
                    ApiClient.getMachines(),
                    ApiClient.getSummary()
                ]);
                CustomerView.render(mainMount, {
                    machines: machinesRes.machines,
                    summary: summaryRes.summary,
                    user: currentUser
                });
                wsClient.subscribeFleet();
            } catch (err) {
                mainMount.innerHTML = `<div class="empty-filter-state"><p>Error loading customer machines: ${err.message}</p></div>`;
            }
            return;
        }

        if (route === '/operator/dashboard' || (route === 'default' && currentUser.role === 'OPERATOR')) {
            mainMount.innerHTML = `<div class="detail-loading"><div class="login-spinner"></div><p>Loading operator workspace...</p></div>`;
            try {
                const machinesRes = await ApiClient.getMachines();
                OperatorView.render(mainMount, {
                    machines: machinesRes.machines,
                    user: currentUser
                });
            } catch (err) {
                mainMount.innerHTML = `<div class="empty-filter-state"><p>Error loading operator view: ${err.message}</p></div>`;
            }
            return;
        }

        if (route === 'machine_detail') {
            const machineId = params.machineId || currentMachineId;
            currentMachineId = machineId;
            if (wsClient) {
                wsClient.subscribeMachine(machineId);
            }
            MachineDetail.loadAndRender(mainMount, machineId);
            return;
        }
    }

    function refreshCurrentView() {
        if (currentMachineId) {
            MachineDetail.loadAndRender(mainMount, currentMachineId);
        } else {
            renderRoute(currentRoute || '/');
        }
    }

    // Header Updates
    function updateHeaderUserProfile() {
        if (!currentUser) return;
        const avatarEl = document.getElementById('user-avatar');
        const nameEl = document.getElementById('user-name');
        const roleBadgeEl = document.getElementById('user-role-badge');
        const userPill = document.getElementById('user-pill');

        if (avatarEl) avatarEl.textContent = currentUser.avatar || currentUser.role.substring(0, 2);
        if (nameEl) nameEl.textContent = currentUser.name;
        if (roleBadgeEl) {
            roleBadgeEl.textContent = currentUser.role;
            roleBadgeEl.className = `user-role-badge role-badge-${currentUser.role.toLowerCase()}`;
        }
        if (userPill) userPill.style.display = 'flex';
    }

    function updateHeaderConnectionStatus(status, detail) {
        const dot = document.getElementById('conn-dot');
        const text = document.getElementById('conn-status');
        if (!dot || !text) return;

        switch (status) {
            case 'CONNECTED':
                dot.className = 'status-dot dot-connected';
                text.textContent = 'ONLINE';
                break;
            case 'CONNECTING':
                dot.className = 'status-dot dot-stale';
                text.textContent = 'CONNECTING';
                break;
            case 'STALE':
                dot.className = 'status-dot dot-stale';
                text.textContent = 'STALE';
                break;
            case 'DISCONNECTED':
            default:
                dot.className = 'status-dot dot-disconnected';
                text.textContent = 'OFFLINE';
        }
    }

    // Authentication UI
    function showLoginOverlay() {
        const overlay = document.getElementById('login-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
            overlay.classList.remove('hidden');
        }
    }

    function hideLoginOverlay() {
        const overlay = document.getElementById('login-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 400);
        }
    }

    function setupAuthEvents() {
        const form = document.getElementById('login-form');
        const emailInput = document.getElementById('login-username');
        const passwordInput = document.getElementById('login-password');
        const errorEl = document.getElementById('login-error');
        const btnText = document.getElementById('login-btn-text');
        const spinner = document.getElementById('login-spinner');
        const togglePw = document.getElementById('login-toggle-pw');
        const btnLogout = document.getElementById('btn-logout');

        if (togglePw && passwordInput) {
            togglePw.addEventListener('click', () => {
                const isPw = passwordInput.type === 'password';
                passwordInput.type = isPw ? 'text' : 'password';
            });
        }

        if (btnLogout) {
            btnLogout.addEventListener('click', handleLogout);
        }

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                errorEl.textContent = '';
                errorEl.style.display = 'none';
                errorEl.classList.remove('visible');
                btnText.textContent = 'Signing In...';
                spinner.style.display = 'block';

                const email = emailInput.value.trim();
                const password = passwordInput.value;

                try {
                    const loginFn = window.loginUser || (window.FirebaseService && window.FirebaseService.loginUser);
                    if (typeof loginFn === 'function') {
                        const res = await loginFn(email, password);
                        if (res.success && res.user) {
                            currentUser = mapFirebaseUser(res.user);
                            hideLoginOverlay();
                            updateHeaderUserProfile();
                            if (wsClient) wsClient.connect();
                            routeInitialView();
                        } else {
                            errorEl.textContent = res.error || 'Authentication failed. Please verify your credentials.';
                            errorEl.style.display = 'block';
                            errorEl.classList.add('visible');
                        }
                    } else {
                        const res = await ApiClient.login(email, password, true);
                        if (res.success && res.user) {
                            currentUser = res.user;
                            hideLoginOverlay();
                            updateHeaderUserProfile();
                            if (wsClient) wsClient.connect();
                            routeInitialView();
                        } else {
                            errorEl.textContent = res.error || 'Invalid credentials.';
                            errorEl.style.display = 'block';
                            errorEl.classList.add('visible');
                        }
                    }
                } catch (err) {
                    console.error('[AUTH] Login exception:', err);
                    errorEl.textContent = err.message || 'Login failed. Please verify credentials.';
                    errorEl.style.display = 'block';
                    errorEl.classList.add('visible');
                } finally {
                    btnText.textContent = 'Sign In';
                    spinner.style.display = 'none';
                }
            });
        }
    }

    async function handleLogout() {
        try {
            const logoutFn = window.logoutUser || (window.FirebaseService && window.FirebaseService.logoutUser);
            if (typeof logoutFn === 'function') {
                await logoutFn();
            }
        } catch (e) {
            console.error('[AUTH] Sign out error:', e);
        }
        try {
            await ApiClient.logout();
        } catch (e) {}
        currentUser = null;
        if (wsClient) wsClient.disconnect();
        showLoginOverlay();
        const userPill = document.getElementById('user-pill');
        if (userPill) userPill.style.display = 'none';
    }

    // Modal Confirmation Dialog
    function setupHeaderEvents() {
        const modal = document.getElementById('confirm-modal');
        const btnYes = document.getElementById('btn-confirm-yes');
        const btnNo = document.getElementById('btn-confirm-no');
        const btnSettings = document.getElementById('btn-settings');
        const settingsModal = document.getElementById('settings-modal');
        const btnCloseSettings = document.getElementById('btn-close-settings');
        const btnSaveSettings = document.getElementById('btn-save-settings');

        if (btnYes) {
            btnYes.addEventListener('click', () => {
                if (modal) modal.style.display = 'none';
                if (typeof confirmCallback === 'function') {
                    confirmCallback();
                    confirmCallback = null;
                }
            });
        }

        if (btnNo) {
            btnNo.addEventListener('click', () => {
                if (modal) modal.style.display = 'none';
                confirmCallback = null;
            });
        }

        if (btnSettings && settingsModal) {
            btnSettings.addEventListener('click', () => {
                settingsModal.style.display = 'flex';
            });
        }

        if (btnCloseSettings && settingsModal) {
            btnCloseSettings.addEventListener('click', () => {
                settingsModal.style.display = 'none';
            });
        }

        if (btnSaveSettings && settingsModal) {
            btnSaveSettings.addEventListener('click', () => {
                const urlInput = document.getElementById('settings-input-url');
                if (urlInput && urlInput.value) {
                    wsClient.disconnect();
                    wsClient.connect(urlInput.value.trim());
                }
                settingsModal.style.display = 'none';
            });
        }
    }

    function showConfirmModal(title, message, onConfirm) {
        const modal = document.getElementById('confirm-modal');
        const titleEl = document.getElementById('confirm-modal-title');
        const msgEl = document.getElementById('confirm-modal-message');

        if (titleEl) titleEl.textContent = title;
        if (msgEl) msgEl.textContent = message;
        confirmCallback = onConfirm;

        if (modal) modal.style.display = 'flex';
    }

    function setupAddMachineModal() {
        const modal = document.getElementById('add-machine-modal');
        const btnClose = document.getElementById('btn-close-add-machine');
        const btnCancel = document.getElementById('btn-cancel-add-machine');
        const form = document.getElementById('add-machine-form');
        const errorEl = document.getElementById('add-machine-error');
        const spinner = document.getElementById('add-machine-spinner');
        const btnText = document.getElementById('add-machine-btn-text');

        const closeAddModal = () => {
            if (modal) modal.style.display = 'none';
            if (errorEl) {
                errorEl.textContent = '';
                errorEl.style.display = 'none';
            }
        };

        if (btnClose) btnClose.addEventListener('click', closeAddModal);
        if (btnCancel) btnCancel.addEventListener('click', closeAddModal);

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (errorEl) {
                    errorEl.textContent = '';
                    errorEl.style.display = 'none';
                }
                if (spinner) spinner.style.display = 'block';
                if (btnText) btnText.textContent = 'Registering...';

                const id = document.getElementById('new-machine-id').value.trim();
                const model = document.getElementById('new-machine-model').value;
                const orgSelect = document.getElementById('new-machine-org');
                const organizationId = orgSelect ? orgSelect.value : null;
                const state = document.getElementById('new-machine-state').value;
                const location = document.getElementById('new-machine-location').value.trim();

                try {
                    const res = await ApiClient.addMachine({
                        id,
                        model,
                        organizationId,
                        state,
                        location
                    });

                    if (res.success) {
                        closeAddModal();
                        refreshCurrentView();
                    } else {
                        throw new Error(res.error || 'Failed to create machine.');
                    }
                } catch (err) {
                    if (errorEl) {
                        errorEl.textContent = err.message || 'Error creating machine.';
                        errorEl.style.display = 'block';
                    }
                } finally {
                    if (spinner) spinner.style.display = 'none';
                    if (btnText) btnText.textContent = 'Register Machine';
                }
            });
        }
    }

    async function showAddMachineModal() {
        if (!currentUser || (currentUser.role !== 'CEO' && currentUser.role !== 'CUSTOMER')) {
            return;
        }

        const modal = document.getElementById('add-machine-modal');
        const form = document.getElementById('add-machine-form');
        const idInput = document.getElementById('new-machine-id');
        const orgSelect = document.getElementById('new-machine-org');
        const errorEl = document.getElementById('add-machine-error');
        const locInput = document.getElementById('new-machine-location');

        if (form) form.reset();
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.style.display = 'none';
        }

        // Auto-generate next ID proposal
        try {
            const listRes = await ApiClient.getMachines();
            const machines = listRes.machines || [];
            let maxNum = 0;
            for (const m of machines) {
                const match = (m.id || '').match(/^CS-FS-(\d+)$/);
                if (match) {
                    const num = parseInt(match[1], 10);
                    if (num > maxNum) maxNum = num;
                }
            }
            if (idInput) {
                idInput.value = `CS-FS-${String(maxNum + 1).padStart(4, '0')}`;
            }
        } catch (e) {
            if (idInput) idInput.value = 'CS-FS-0007';
        }

        // Populate Organization options
        if (orgSelect) {
            try {
                const orgRes = await ApiClient.getOrganizations();
                const orgs = orgRes.organizations || [];

                if (currentUser.role === 'CEO') {
                    orgSelect.disabled = false;
                    orgSelect.innerHTML = orgs.map(o => `
                        <option value="${o.id}">${o.name} (${o.code || o.id})</option>
                    `).join('');
                } else {
                    // Customer: preselect their own org and lock
                    const userOrg = orgs.find(o => o.id === currentUser.organizationId) || {
                        id: currentUser.organizationId,
                        name: currentUser.organizationName || 'My Organization'
                    };
                    orgSelect.innerHTML = `<option value="${userOrg.id}" selected>${userOrg.name}</option>`;
                    orgSelect.disabled = true;
                }
            } catch (e) {
                console.error('Failed to load organizations:', e);
            }
        }

        if (locInput) {
            locInput.value = currentUser.role === 'CUSTOMER' ? 'Facility Processing Bay - Primary Shredder' : 'Processing Floor - Unit 5 Bay A';
        }

        if (modal) modal.style.display = 'flex';
    }

    function confirmDeleteMachine(machineId, machineModel, isFromDetail = false) {
        if (!currentUser || (currentUser.role !== 'CEO' && currentUser.role !== 'CUSTOMER')) {
            return;
        }

        const modelLabel = machineModel ? ` (${machineModel})` : '';
        showConfirmModal(
            `Remove Machine ${machineId}`,
            `Are you sure you want to permanently remove ${machineId}${modelLabel}? This will unregister the unit, delete its recorded historical sensor telemetry, and disconnect real-time streams.`,
            async () => {
                try {
                    const res = await ApiClient.deleteMachine(machineId);
                    if (res.success) {
                        if (isFromDetail) {
                            navigateBack();
                        } else {
                            refreshCurrentView();
                        }
                    } else {
                        alert(res.error || 'Failed to remove machine.');
                    }
                } catch (err) {
                    alert(err.message || 'Error occurred while removing machine.');
                }
            }
        );
    }

    return {
        init,
        navigateTo,
        navigateToMachine,
        navigateBack,
        refreshCurrentView,
        showConfirmModal,
        showAddMachineModal,
        confirmDeleteMachine,
        getCurrentUser: () => currentUser,
        get wsClient() { return wsClient; },
        getWsClient: () => wsClient
    };
})();

if (typeof window !== 'undefined') {
    window.App = App;
}

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
