/**
 * FleetOverview Component (CEO Dashboard)
 * Implements Section 4: Summary statistics, minimal cards grid, search/filter/sort,
 * and compact fleet health section with direct machine navigation.
 */

const FleetOverview = (() => {
    // Preserved filter state across navigations
    let state = {
        searchQuery: '',
        statusFilter: 'ALL',
        orgFilter: 'ALL',
        modelFilter: 'ALL',
        sortBy: 'ID_ASC'
    };

    let cachedMachines = [];
    let cachedSummary = null;

    function render(container, data) {
        if (!container) return;
        cachedMachines = data.machines || [];
        cachedSummary = data.summary || {};

        const summary = cachedSummary;

        container.innerHTML = `
            <div class="ceo-view-container">
                <!-- Fleet Header & Title -->
                <div class="view-header-bar">
                    <div>
                        <h2 class="view-title">Manufactured Fleet Overview</h2>
                        <p class="view-subtitle">Real-time status of all registered CircularSeed shredders across customer deployments</p>
                    </div>
                    <div class="view-actions">
                        <button class="btn btn-secondary btn-sm" onclick="App.refreshCurrentView()">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                            Refresh Fleet
                        </button>
                        <button class="btn btn-primary btn-sm" onclick="App.showAddMachineModal()">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            Add Machine
                        </button>
                    </div>
                </div>

                <!-- 1. Summary Statistics Cards (Section 4.A) -->
                <div class="fleet-stats-grid">
                    <div class="stat-card" onclick="FleetOverview.setStatusFilter('ALL')">
                        <div class="stat-icon stat-icon-blue">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                        </div>
                        <div class="stat-body">
                            <span class="stat-label">Total Registered</span>
                            <span class="stat-value" id="stat-total">${summary.totalRegistered ?? cachedMachines.length}</span>
                        </div>
                    </div>

                    <div class="stat-card" onclick="FleetOverview.setStatusFilter('RUNNING')">
                        <div class="stat-icon stat-icon-green">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        </div>
                        <div class="stat-body">
                            <span class="stat-label">Running Units</span>
                            <span class="stat-value text-green" id="stat-running">${summary.running ?? 0}</span>
                        </div>
                    </div>

                    <div class="stat-card" onclick="FleetOverview.setStatusFilter('STOPPED')">
                        <div class="stat-icon stat-icon-graphite">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
                        </div>
                        <div class="stat-body">
                            <span class="stat-label">Idle / Stopped</span>
                            <span class="stat-value" id="stat-stopped">${summary.idleStopped ?? 0}</span>
                        </div>
                    </div>

                    <div class="stat-card ${summary.activeFaults > 0 ? 'stat-card-alert' : ''}" onclick="FleetOverview.setStatusFilter('FAULT')">
                        <div class="stat-icon stat-icon-red">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        </div>
                        <div class="stat-body">
                            <span class="stat-label">Active Faults</span>
                            <span class="stat-value text-red" id="stat-faults">${summary.activeFaults ?? 0}</span>
                        </div>
                    </div>

                    <div class="stat-card" onclick="FleetOverview.setStatusFilter('OFFLINE')">
                        <div class="stat-icon stat-icon-muted">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.58 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/></svg>
                        </div>
                        <div class="stat-body">
                            <span class="stat-label">Disconnected / Offline</span>
                            <span class="stat-value" id="stat-offline">${summary.disconnectedOffline ?? 0}</span>
                        </div>
                    </div>
                </div>

                <!-- 2. Search & Filter Bar (Section 4.B) -->
                <div class="filter-toolbar">
                    <div class="search-box">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input type="text" id="fleet-search-input" placeholder="Search by Machine ID, Customer, or Location..." value="${state.searchQuery}">
                    </div>

                    <div class="filter-controls">
                        <div class="filter-group">
                            <label>Status:</label>
                            <select id="fleet-status-filter" class="filter-select">
                                <option value="ALL" ${state.statusFilter === 'ALL' ? 'selected' : ''}>All Statuses</option>
                                <option value="RUNNING" ${state.statusFilter === 'RUNNING' ? 'selected' : ''}>Running</option>
                                <option value="READY" ${state.statusFilter === 'READY' ? 'selected' : ''}>Ready</option>
                                <option value="STOPPED" ${state.statusFilter === 'STOPPED' ? 'selected' : ''}>Stopped</option>
                                <option value="FAULT" ${state.statusFilter === 'FAULT' ? 'selected' : ''}>Faults</option>
                                <option value="OFFLINE" ${state.statusFilter === 'OFFLINE' ? 'selected' : ''}>Offline</option>
                            </select>
                        </div>

                        <div class="filter-group">
                            <label>Customer:</label>
                            <select id="fleet-org-filter" class="filter-select">
                                <option value="ALL">All Customers</option>
                                ${getUniqueOrgsOptions(cachedMachines, state.orgFilter)}
                            </select>
                        </div>

                        <div class="filter-group">
                            <label>Model:</label>
                            <select id="fleet-model-filter" class="filter-select">
                                <option value="ALL">All Models</option>
                                ${getUniqueModelsOptions(cachedMachines, state.modelFilter)}
                            </select>
                        </div>

                        <div class="filter-group">
                            <label>Sort:</label>
                            <select id="fleet-sort-select" class="filter-select">
                                <option value="ID_ASC" ${state.sortBy === 'ID_ASC' ? 'selected' : ''}>Machine ID (A-Z)</option>
                                <option value="ID_DESC" ${state.sortBy === 'ID_DESC' ? 'selected' : ''}>Machine ID (Z-A)</option>
                                <option value="STATUS" ${state.sortBy === 'STATUS' ? 'selected' : ''}>Operating State</option>
                            </select>
                        </div>

                        <button class="btn btn-sm btn-clear-filters" id="btn-clear-filters" title="Reset all filters">Reset</button>
                    </div>
                </div>

                <!-- Match Results Counter -->
                <div class="fleet-results-info">
                    <span id="fleet-match-count">Showing ${cachedMachines.length} machines</span>
                    <span class="fleet-live-indicator"><span class="dot-live"></span> Live Fleet Telemetry Active</span>
                </div>

                <!-- 3. Responsive Machine Cards Grid (Section 4.B) -->
                <div class="fleet-cards-grid" id="fleet-cards-grid">
                    <!-- Populated by applyFiltersAndRender() -->
                </div>

                <!-- 4. Compact Fleet Health Section (Section 4.D) -->
                <div class="fleet-health-section">
                    <div class="fleet-health-header">
                        <h3>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                            Fleet Health &amp; Diagnostics
                        </h3>
                        <span class="badge">SYSTEM WATCHDOG</span>
                    </div>

                    <div class="fleet-health-grid">
                        <!-- Active Faults Card -->
                        <div class="health-card">
                            <div class="health-card-header">
                                <span class="health-card-title text-red">Active Machine Faults</span>
                                <span class="badge badge-sm badge-fault">${(summary.faultMachines && summary.faultMachines.length) || 0}</span>
                            </div>
                            <div class="health-list" id="health-faults-list">
                                ${renderFaultsList(summary.faultMachines)}
                            </div>
                        </div>

                        <!-- Stale Telemetry Card -->
                        <div class="health-card">
                            <div class="health-card-header">
                                <span class="health-card-title text-amber">Stale Telemetry (>3s)</span>
                                <span class="badge badge-sm badge-stale">${(summary.staleMachines && summary.staleMachines.length) || 0}</span>
                            </div>
                            <div class="health-list" id="health-stale-list">
                                ${renderStaleList(summary.staleMachines)}
                            </div>
                        </div>

                        <!-- Recent Events -->
                        <div class="health-card">
                            <div class="health-card-header">
                                <span class="health-card-title">Recent Fleet Events</span>
                                <span class="badge badge-sm">LATEST 6</span>
                            </div>
                            <div class="health-events-list">
                                ${renderRecentEventsList(summary.recentEvents)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        bindEvents();
        applyFiltersAndRender();
    }

    function getUniqueOrgsOptions(machines, selected) {
        const orgs = new Map();
        machines.forEach(m => {
            if (m.organizationId && m.organizationName) {
                orgs.set(m.organizationId, m.organizationName);
            }
        });
        let html = '';
        for (const [id, name] of orgs.entries()) {
            html += `<option value="${id}" ${selected === id ? 'selected' : ''}>${name}</option>`;
        }
        return html;
    }

    function getUniqueModelsOptions(machines, selected) {
        const models = new Set();
        machines.forEach(m => {
            if (m.model) models.add(m.model);
        });
        let html = '';
        for (const model of models) {
            html += `<option value="${model}" ${selected === model ? 'selected' : ''}>${model}</option>`;
        }
        return html;
    }

    function renderFaultsList(faults) {
        if (!faults || faults.length === 0) {
            return `<div class="health-empty-item text-green">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                No active machine faults detected across fleet.
            </div>`;
        }
        return faults.map(f => `
            <div class="health-alert-item" onclick="App.navigateToMachine('${f.id}')">
                <div class="health-item-id"><strong>${f.id}</strong> &bull; ${f.model}</div>
                <div class="health-item-sub">${f.org} &bull; ${f.location}</div>
                <span class="health-link">Inspect &rarr;</span>
            </div>
        `).join('');
    }

    function renderStaleList(stale) {
        if (!stale || stale.length === 0) {
            return `<div class="health-empty-item text-green">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                All connected machines reporting healthy telemetry.
            </div>`;
        }
        return stale.map(s => `
            <div class="health-stale-item" onclick="App.navigateToMachine('${s.id}')">
                <div class="health-item-id"><strong>${s.id}</strong> &bull; ${s.model}</div>
                <div class="health-item-sub">${s.org} &bull; Delayed since ${new Date(s.lastSeen).toLocaleTimeString()}</div>
                <span class="health-link">Inspect &rarr;</span>
            </div>
        `).join('');
    }

    function renderRecentEventsList(events) {
        if (!events || events.length === 0) {
            return `<div class="health-empty-item">No recent events recorded.</div>`;
        }
        return events.map(ev => {
            const timeStr = new Date(ev.timestamp).toLocaleTimeString();
            const sevClass = ev.severity === 'CRITICAL' ? 'text-red' : (ev.severity === 'WARNING' ? 'text-amber' : 'text-blue');
            return `
                <div class="health-event-item" onclick="App.navigateToMachine('${ev.machine_id}')">
                    <span class="event-time">[${timeStr}]</span>
                    <span class="event-m-id"><strong>${ev.machine_id}</strong>:</span>
                    <span class="${sevClass}">${ev.description}</span>
                </div>
            `;
        }).join('');
    }

    function bindEvents() {
        const searchInput = document.getElementById('fleet-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                state.searchQuery = e.target.value.trim().toLowerCase();
                applyFiltersAndRender();
            });
        }

        const statusFilter = document.getElementById('fleet-status-filter');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                state.statusFilter = e.target.value;
                applyFiltersAndRender();
            });
        }

        const orgFilter = document.getElementById('fleet-org-filter');
        if (orgFilter) {
            orgFilter.addEventListener('change', (e) => {
                state.orgFilter = e.target.value;
                applyFiltersAndRender();
            });
        }

        const modelFilter = document.getElementById('fleet-model-filter');
        if (modelFilter) {
            modelFilter.addEventListener('change', (e) => {
                state.modelFilter = e.target.value;
                applyFiltersAndRender();
            });
        }

        const sortSelect = document.getElementById('fleet-sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                state.sortBy = e.target.value;
                applyFiltersAndRender();
            });
        }

        const btnClear = document.getElementById('btn-clear-filters');
        if (btnClear) {
            btnClear.addEventListener('click', () => {
                state.searchQuery = '';
                state.statusFilter = 'ALL';
                state.orgFilter = 'ALL';
                state.modelFilter = 'ALL';
                state.sortBy = 'ID_ASC';

                if (searchInput) searchInput.value = '';
                if (statusFilter) statusFilter.value = 'ALL';
                if (orgFilter) orgFilter.value = 'ALL';
                if (modelFilter) modelFilter.value = 'ALL';
                if (sortSelect) sortSelect.value = 'ID_ASC';

                applyFiltersAndRender();
            });
        }
    }

    function setStatusFilter(status) {
        state.statusFilter = status;
        const sel = document.getElementById('fleet-status-filter');
        if (sel) sel.value = status;
        applyFiltersAndRender();
    }

    function applyFiltersAndRender() {
        const grid = document.getElementById('fleet-cards-grid');
        const countSpan = document.getElementById('fleet-match-count');
        if (!grid) return;

        let filtered = cachedMachines.slice();

        // 1. Text Search Filter (ID, customer, location)
        if (state.searchQuery) {
            filtered = filtered.filter(m =>
                m.id.toLowerCase().includes(state.searchQuery) ||
                (m.model && m.model.toLowerCase().includes(state.searchQuery)) ||
                (m.organizationName && m.organizationName.toLowerCase().includes(state.searchQuery)) ||
                (m.location && m.location.toLowerCase().includes(state.searchQuery))
            );
        }

        // 2. Status Filter
        if (state.statusFilter !== 'ALL') {
            filtered = filtered.filter(m => {
                const liveState = (m.live && m.live.isOffline ? 'OFFLINE' : m.state) || 'OFFLINE';
                return liveState.toUpperCase() === state.statusFilter;
            });
        }

        // 3. Organization Filter
        if (state.orgFilter !== 'ALL') {
            filtered = filtered.filter(m => m.organizationId === state.orgFilter);
        }

        // 4. Model Filter
        if (state.modelFilter !== 'ALL') {
            filtered = filtered.filter(m => m.model === state.modelFilter);
        }

        // 5. Sorting
        filtered.sort((a, b) => {
            if (state.sortBy === 'ID_ASC') return a.id.localeCompare(b.id);
            if (state.sortBy === 'ID_DESC') return b.id.localeCompare(a.id);
            if (state.sortBy === 'STATUS') return (a.state || '').localeCompare(b.state || '');
            return 0;
        });

        // Update count
        if (countSpan) {
            countSpan.textContent = `Showing ${filtered.length} of ${cachedMachines.length} machines`;
        }

        // Render Cards
        if (filtered.length === 0) {
            grid.innerHTML = `
                <div class="empty-filter-state">
                    <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                    <h4>No matching machines found</h4>
                    <p>Try adjusting your search query or reset the applied filters.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = filtered.map(m => MachineCard.render(m)).join('');
    }

    /**
     * Update individual card in-place when WebSocket fleet telemetry arrives
     */
    function updateCardTelemetry(update) {
        const m = cachedMachines.find(x => x.id === update.machineId);
        if (!m) return;

        m.state = update.state || m.state;
        if (!m.live) m.live = {};
        if (update.rpm !== undefined) m.live.rpm = update.rpm;
        if (update.voltage !== undefined) m.live.voltage = update.voltage;
        if (update.power !== undefined) m.live.power = update.power;
        m.live.lastUpdate = update.lastSeen || new Date().toISOString();
        m.live.isStale = false;

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
        applyFiltersAndRender,
        updateCardTelemetry,
        getState: () => state
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FleetOverview;
}
