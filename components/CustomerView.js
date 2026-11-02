/**
 * CustomerView Component
 * Implements Section 5: Organization-specific machines overview, customer summary,
 * search/filters, and read-only detailed machine navigation.
 */

const CustomerView = (() => {
    let cachedMachines = [];
    let cachedSummary = null;
    let searchQuery = '';
    let statusFilter = 'ALL';

    function render(container, data) {
        if (!container) return;
        cachedMachines = data.machines || [];
        cachedSummary = data.summary || {};
        const user = data.user || {};

        const summary = cachedSummary;

        container.innerHTML = `
            <div class="customer-view-container">
                <!-- Customer Header -->
                <div class="view-header-bar">
                    <div>
                        <div class="customer-org-badge">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            <span>${user.organizationName || 'Assigned Organization'}</span>
                        </div>
                        <h2 class="view-title">Organization Machine Fleet</h2>
                        <p class="view-subtitle">Live status, runtime, and maintenance telemetry for your organization's shredders</p>
                    </div>
                    <div class="view-actions">
                        <button class="btn btn-secondary btn-sm" onclick="App.refreshCurrentView()">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                            Refresh
                        </button>
                        <button class="btn btn-primary btn-sm" onclick="App.showAddMachineModal()">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            Add Machine
                        </button>
                    </div>
                </div>

                <!-- 1. Customer Summary (Section 5.A) -->
                <div class="fleet-stats-grid customer-stats-grid">
                    <div class="stat-card" onclick="CustomerView.setStatusFilter('ALL')">
                        <div class="stat-icon stat-icon-blue">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                        </div>
                        <div class="stat-body">
                            <span class="stat-label">Assigned Machines</span>
                            <span class="stat-value">${summary.totalAssigned ?? cachedMachines.length}</span>
                        </div>
                    </div>

                    <div class="stat-card" onclick="CustomerView.setStatusFilter('RUNNING')">
                        <div class="stat-icon stat-icon-green">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        </div>
                        <div class="stat-body">
                            <span class="stat-label">Running</span>
                            <span class="stat-value text-green">${summary.running ?? 0}</span>
                        </div>
                    </div>

                    <div class="stat-card" onclick="CustomerView.setStatusFilter('STOPPED')">
                        <div class="stat-icon stat-icon-graphite">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
                        </div>
                        <div class="stat-body">
                            <span class="stat-label">Stopped</span>
                            <span class="stat-value">${summary.stopped ?? 0}</span>
                        </div>
                    </div>

                    <div class="stat-card ${summary.faultsOrConnectivity > 0 ? 'stat-card-alert' : ''}" onclick="CustomerView.setStatusFilter('FAULT')">
                        <div class="stat-icon stat-icon-red">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        </div>
                        <div class="stat-body">
                            <span class="stat-label">Faults / Connectivity</span>
                            <span class="stat-value text-red">${summary.faultsOrConnectivity ?? 0}</span>
                        </div>
                    </div>
                </div>

                <!-- 2. Search & Filter Bar -->
                <div class="filter-toolbar">
                    <div class="search-box">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input type="text" id="cust-search-input" placeholder="Search your assigned machines..." value="${searchQuery}">
                    </div>

                    <div class="filter-controls">
                        <div class="filter-group">
                            <label>Status:</label>
                            <select id="cust-status-filter" class="filter-select">
                                <option value="ALL" ${statusFilter === 'ALL' ? 'selected' : ''}>All Statuses</option>
                                <option value="RUNNING" ${statusFilter === 'RUNNING' ? 'selected' : ''}>Running</option>
                                <option value="READY" ${statusFilter === 'READY' ? 'selected' : ''}>Ready</option>
                                <option value="STOPPED" ${statusFilter === 'STOPPED' ? 'selected' : ''}>Stopped</option>
                                <option value="FAULT" ${statusFilter === 'FAULT' ? 'selected' : ''}>Faults</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="fleet-results-info">
                    <span id="cust-match-count">Showing ${cachedMachines.length} machines</span>
                    <span class="read-only-notice">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                        Customer Read-Only Access
                    </span>
                </div>

                <!-- 3. Machine Cards Grid -->
                <div class="fleet-cards-grid" id="cust-cards-grid">
                    <!-- Populated by applyFilters() -->
                </div>
            </div>
        `;

        bindEvents();
        applyFilters();
    }

    function bindEvents() {
        const searchInput = document.getElementById('cust-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value.trim().toLowerCase();
                applyFilters();
            });
        }

        const statusSelect = document.getElementById('cust-status-filter');
        if (statusSelect) {
            statusSelect.addEventListener('change', (e) => {
                statusFilter = e.target.value;
                applyFilters();
            });
        }
    }

    function setStatusFilter(status) {
        statusFilter = status;
        const sel = document.getElementById('cust-status-filter');
        if (sel) sel.value = status;
        applyFilters();
    }

    function applyFilters() {
        const grid = document.getElementById('cust-cards-grid');
        const countSpan = document.getElementById('cust-match-count');
        if (!grid) return;

        let filtered = cachedMachines.slice();

        if (searchQuery) {
            filtered = filtered.filter(m =>
                m.id.toLowerCase().includes(searchQuery) ||
                (m.model && m.model.toLowerCase().includes(searchQuery)) ||
                (m.location && m.location.toLowerCase().includes(searchQuery))
            );
        }

        if (statusFilter !== 'ALL') {
            filtered = filtered.filter(m => {
                const liveState = (m.live && m.live.isOffline ? 'OFFLINE' : m.state) || 'OFFLINE';
                return liveState.toUpperCase() === statusFilter;
            });
        }

        if (countSpan) {
            countSpan.textContent = `Showing ${filtered.length} of ${cachedMachines.length} machines`;
        }

        if (filtered.length === 0) {
            grid.innerHTML = `
                <div class="empty-filter-state">
                    <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                    <h4>No matching machines found</h4>
                    <p>No machines match the selected filter criteria.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = filtered.map(m => MachineCard.render(m)).join('');
    }

    function updateCardTelemetry(update) {
        const m = cachedMachines.find(x => x.id === update.machineId);
        if (!m) return;

        m.state = update.state || m.state;
        if (!m.live) m.live = {};
        if (update.rpm !== undefined) m.live.rpm = update.rpm;
        if (update.voltage !== undefined) m.live.voltage = update.voltage;
        if (update.power !== undefined) m.live.power = update.power;
        m.live.lastUpdate = update.lastSeen || new Date().toISOString();

        const cardEl = document.getElementById(`card-${m.id}`);
        if (cardEl) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = MachineCard.render(m);
            const newCard = tempDiv.firstElementChild;
            cardEl.replaceWith(newCard);
        }
    }

    return {
        render,
        setStatusFilter,
        applyFilters,
        updateCardTelemetry
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CustomerView;
}
