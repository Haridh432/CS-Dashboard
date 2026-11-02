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

    function init() {
        mainMount = document.getElementById('main-content-mount');
        wsClient = new GatewayWebSocketClient();

        setupHeaderEvents();
        setupAuthEvents();
        setupAddMachineModal();
        setupGlobalRouting();
        populateDemoCredentials();

        // WebSocket Status Handlers
        wsClient.onStatusChange = (status, detail) => {
            updateHeaderConnectionStatus(status, detail);
        };

        wsClient.onTelemetry = (packet) => {
            if (typeof MachineDetail !== 'undefined' && MachineDetail && typeof MachineDetail.updateLiveTelemetry === 'function') {
                MachineDetail.updateLiveTelemetry(packet);
            }
        };

        // Global auth expired event
        window.addEventListener('auth:expired', () => {
            handleLogout();
        });

        // Check active session
        checkSession();
    }

    async function checkSession() {
        const token = ApiClient.getToken();
        if (!token) {
            // Keep login screen open for user authentication
            showLoginOverlay();
            return;
        }

        try {
            const res = await ApiClient.getCurrentUser();
            if (res.success && res.user) {
                currentUser = res.user;
                hideLoginOverlay();
                updateHeaderUserProfile();
                wsClient.connect();
                routeInitialView();
            } else {
                ApiClient.clearToken();
                showLoginOverlay();
            }
        } catch (err) {
            ApiClient.clearToken();
            showLoginOverlay();
        }
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
        if (!mainMount) return;

        // Unsubscribe from machine if leaving detail
        if (route !== 'machine_detail' && currentMachineId) {
            wsClient.unsubscribeMachine(currentMachineId);
            currentMachineId = null;
        }

        if (route === '/ceo/dashboard' || (route === 'default' && currentUser.role === 'CEO')) {
            if (currentUser.role !== 'CEO') {
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
        const hintToggle = document.getElementById('login-hint-toggle');
        const hintPanel = document.getElementById('login-hint-panel');
        const btnLogout = document.getElementById('btn-logout');

        if (togglePw && passwordInput) {
            togglePw.addEventListener('click', () => {
                const isPw = passwordInput.type === 'password';
                passwordInput.type = isPw ? 'text' : 'password';
            });
        }

        if (hintToggle) {
            hintToggle.addEventListener('click', (e) => {
                toggleDemoAccounts(e);
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
                    const res = await ApiClient.login(email, password, true);
                    if (res.success && res.user) {
                        currentUser = res.user;
                        hideLoginOverlay();
                        updateHeaderUserProfile();
                        wsClient.connect();
                        routeInitialView();
                    } else {
                        errorEl.textContent = res.error || 'Invalid credentials.';
                        errorEl.style.display = 'block';
                        errorEl.classList.add('visible');
                    }
                } catch (err) {
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

    function toggleDemoAccounts(e) {
        if (e) {
            if (e.preventDefault) e.preventDefault();
            if (e.stopPropagation) e.stopPropagation();
        }
        const panel = document.getElementById('login-hint-panel');
        const toggle = document.getElementById('login-hint-toggle');
        if (!panel) return;
        
        const isCurrentlyOpen = panel.classList.contains('open') || panel.style.display === 'block';
        if (isCurrentlyOpen) {
            panel.classList.remove('open');
            panel.style.display = 'none';
            if (toggle) toggle.classList.remove('open');
        } else {
            panel.classList.add('open');
            panel.style.display = 'block';
            if (toggle) toggle.classList.add('open');
            setTimeout(() => {
                panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 50);
        }
    }

    async function populateDemoCredentials() {
        const grid = document.getElementById('hint-grid');
        if (!grid) return;

        // If pre-rendered HTML cards exist in index.html, preserve them
        if (grid.children && grid.children.length >= 3) {
            return;
        }

        try {
            const res = await ApiClient.getDemoCredentials();
            const creds = res.credentials || [];

            const roleColors = {
                CEO: '#7C3AED',
                CUSTOMER: '#047857',
                OPERATOR: '#0369A1'
            };

            grid.innerHTML = creds.map(c => `
                <div class="hint-card">
                    <div class="hint-card-header" style="background: ${roleColors[c.role] || '#374151'}; display: flex; justify-content: space-between; align-items: center; padding: 8px 12px;">
                        <span>${c.role}</span>
                        <span style="font-size: 10px; font-weight: normal; opacity: 0.85;">${c.title}</span>
                    </div>
                    <div class="hint-card-body" style="padding: 10px 12px; display: flex; flex-direction: column; gap: 6px;">
                        <div class="hint-field">
                            <span class="hint-label" style="font-size: 9px; opacity: 0.6;">Email</span>
                            <span class="hint-value" style="font-size: 12px; font-weight: 600;">${c.email}</span>
                        </div>
                        <div class="hint-field">
                            <span class="hint-label" style="font-size: 9px; opacity: 0.6;">Password</span>
                            <span class="hint-value" style="font-size: 12px; font-weight: 600;">${c.password}</span>
                        </div>
                        <button type="button" class="hint-autofill" onclick="App.autofillCredentials('${c.email}', '${c.password}')" style="margin-top: 4px; padding: 7px; font-size: 11px; font-weight: 700; background: ${roleColors[c.role] || '#4F46E5'}; color: white; border: none; border-radius: 6px; cursor: pointer;">
                            Autofill ${c.role} Credentials
                        </button>
                    </div>
                </div>
            `).join('');
        } catch (e) {
            console.warn('Failed to load demo credentials:', e);
        }
    }

    function autofillCredentials(email, password) {
        const uInput = document.getElementById('login-username');
        const pInput = document.getElementById('login-password');
        const panel = document.getElementById('login-hint-panel');
        const toggle = document.getElementById('login-hint-toggle');
        if (uInput) uInput.value = email;
        if (pInput) pInput.value = password;
        if (panel) {
            panel.classList.remove('open');
            panel.style.display = 'none';
        }
        if (toggle) toggle.classList.remove('open');
    }

    async function handleLogout() {
        await ApiClient.logout();
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
        toggleDemoAccounts,
        autofillCredentials,
        showConfirmModal,
        showAddMachineModal,
        confirmDeleteMachine,
        getCurrentUser: () => currentUser,
        get wsClient() { return wsClient; },
        getWsClient: () => wsClient
    };
})();

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
