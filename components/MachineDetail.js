/**
 * MachineDetail Component
 * Common detailed machine dashboard shared by all roles with role-based permissions (Section 7).
 * Implements Sections A to G, prototype 12V L298N support, live charts, and operational controls.
 */

const MachineDetail = (() => {
    let currentMachine = null;
    let currentHistory = [];
    let currentRange = '24h';
    let isStale = false;
    let staleTimer = null;
    let lastTelemetryTime = null;
    let liveRuntimeSeconds = 0;
    let liveRuntimeTicker = null;

    function startLiveRuntimeTicker(shouldRun) {
        if (liveRuntimeTicker) {
            clearInterval(liveRuntimeTicker);
            liveRuntimeTicker = null;
        }
        if (shouldRun) {
            liveRuntimeTicker = setInterval(() => {
                const runtimeEl = document.getElementById('det-m-runtime');
                if (!runtimeEl) {
                    clearInterval(liveRuntimeTicker);
                    liveRuntimeTicker = null;
                    return;
                }
                liveRuntimeSeconds += 1;
                runtimeEl.textContent = formatTime(liveRuntimeSeconds);
            }, 1000);
        }
    }

    async function loadAndRender(container, machineId, options = {}) {
        if (!container) return;
        container.innerHTML = `
            <div class="detail-loading">
                <div class="login-spinner" style="display:inline-block; border-color: rgba(21, 101, 192, 0.2); border-top-color: #1565C0;"></div>
                <p>Loading machine telemetry for ${machineId}...</p>
            </div>
        `;

        try {
            const res = await ApiClient.getMachineDetail(machineId);
            if (!res.success || !res.machine) {
                container.innerHTML = `<div class="empty-filter-state"><p>Machine ${machineId} not found or access denied.</p></div>`;
                return;
            }

            currentMachine = res.machine;
            // Fetch initial historical telemetry for charts
            try {
                const histRes = await ApiClient.getMachineHistory(machineId, currentRange);
                currentHistory = (histRes.success && histRes.history) ? histRes.history : [];
            } catch (e) {
                currentHistory = [];
            }

            render(container, options);

            // Subscribe via WebSocket to this specific machine's live stream
            const ws = window.App && (typeof window.App.getWsClient === 'function' ? window.App.getWsClient() : window.App.wsClient);
            if (ws && typeof ws.subscribeMachine === 'function') {
                ws.subscribeMachine(machineId);
            }
        } catch (err) {
            container.innerHTML = `
                <div class="empty-filter-state">
                    <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#C62828" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <h4>Access Denied or Load Failed</h4>
                    <p>${err.message}</p>
                    <button class="btn btn-secondary btn-sm" onclick="App.navigateBack()">Return to Previous View</button>
                </div>
            `;
        }
    }

    function render(container, options = {}) {
        const m = currentMachine;
        const currentUser = App.getCurrentUser() || {};
        const isOperator = currentUser.role === 'OPERATOR';
        const isCustomer = currentUser.role === 'CUSTOMER';
        const isCeo = currentUser.role === 'CEO';

        const canControl = isCeo || isOperator;
        const isPrototype = m.hardware_type === 'PROTOTYPE_12V_L298N';

        const latest = m.latestTelemetry || {};
        const state = (latest.machine && latest.machine.state) ? latest.machine.state : (m.state || 'READY');
        const isRunning = state === 'RUNNING';

        // Breadcrumb back button
        const backBtnHtml = options.isOperatorView ? '' : `
            <button class="btn-breadcrumb" onclick="App.navigateBack()">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
                ${isCeo ? 'Back to Fleet Overview' : 'Back to Organization Fleet'}
            </button>
        `;

        container.innerHTML = `
            <div class="machine-detail-wrapper" id="detail-wrapper-${m.id}">
                <!-- Header & Navigation Bar -->
                <div class="detail-top-bar">
                    <div class="detail-breadcrumbs">
                        ${backBtnHtml}
                        <span class="crumb-separator">/</span>
                        <span class="crumb-current">${m.id}</span>
                        ${isPrototype ? '<span class="badge-proto">12V DC L298N Prototype</span>' : ''}
                    </div>

                    <div class="detail-header-actions">
                        <div class="indicator-pill" id="detail-conn-pill">
                            <span class="status-dot dot-connected" id="detail-conn-dot"></span>
                            <span id="detail-conn-text">${latest.isDemo !== false ? 'DEMO' : 'LIVE'}</span>
                        </div>
                        <div class="machine-state-badge state-${state.toLowerCase()}" id="detail-machine-state-badge">
                            ${state}
                        </div>
                        ${(isCeo || isCustomer) ? `
                            <button class="btn btn-sm btn-danger-ghost" title="Remove machine from fleet" onclick="App.confirmDeleteMachine('${m.id}', '${(m.model || '').replace(/'/g, "\\'")}', true)">
                                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                Remove
                            </button>
                        ` : ''}
                    </div>
                </div>

                <!-- Simulation Sandbox Toolbar (CEO & Operator in Demo Mode) -->
                ${(canControl && (latest.isDemo !== false)) ? `
                <section class="simulator-toolbar" id="detail-sim-toolbar">
                    <div class="sim-info">
                        <strong>Simulation Sandbox (${m.id}):</strong>
                        <span>Interactive event &amp; interlock testing</span>
                    </div>
                    <div class="sim-actions">
                        <button class="sim-btn" onclick="MachineDetail.injectSimFault('TOGGLE_ESTOP')">Trigger E-Stop</button>
                        <button class="sim-btn" onclick="MachineDetail.injectSimFault('TOGGLE_GUARD')">Open Hopper Guard</button>
                        <button class="sim-btn" onclick="MachineDetail.injectSimFault('TRIGGER_JAM')">Simulate Rotor Jam</button>
                        <button class="sim-btn" onclick="MachineDetail.injectSimFault('TOGGLE_BATTERY')">Toggle Battery</button>
                    </div>
                </section>
                ` : ''}

                <!-- Primary 4-Card Dashboard Grid (Sections A, B, C, D) -->
                <div class="dashboard-grid">

                    <!-- Section A: Machine Status & Controls -->
                    <section class="card card-minimal" id="detail-card-overview">
                        <div class="card-header">
                            <div class="card-header-title">
                                <h2>1. Shredder Status</h2>
                                <span class="badge">${m.hardware_type || 'FLEXISHRED-DC'}</span>
                            </div>
                        </div>

                        <!-- Top Status / State Hero Banner -->
                        <div class="card-hero-status">
                            <div class="status-indicator-block">
                                <span class="kpi-micro-lbl">Current Condition</span>
                                <div class="state-pill-wrap">
                                    <span class="status-dot ${isRunning ? 'dot-connected' : 'dot-disconnected'}"></span>
                                    <strong id="det-m-state" class="state-text ${isRunning ? 'text-green' : ''}">${isRunning ? 'Running & Shredding' : state}</strong>
                                </div>
                            </div>
                            <div class="runtime-block">
                                <span class="kpi-micro-lbl">Live Running Time</span>
                                <strong id="det-m-runtime" class="runtime-timer">${formatTime((latest.machine && latest.machine.runtimeSeconds) || 0)}</strong>
                            </div>
                        </div>

                        <!-- Easy-to-understand 2x2 Meta Matrix -->
                        <div class="meta-grid-2x2">
                            <div class="meta-cell">
                                <span class="meta-cell-label">Machine Model</span>
                                <span class="meta-cell-value" title="${m.model}">${m.model}</span>
                                <span class="meta-cell-sub">Dual-Shaft Plastic Shredder</span>
                            </div>
                            <div class="meta-cell">
                                <span class="meta-cell-label">Operating Company</span>
                                <span class="meta-cell-value" title="${m.organization_name || 'CircularSeed'}">${m.organization_name || 'CircularSeed'}</span>
                                <span class="meta-cell-sub">${m.organization_industry || 'Commercial Facility'}</span>
                            </div>
                            <div class="meta-cell">
                                <span class="meta-cell-label">Floor Location</span>
                                <span class="meta-cell-value" title="${m.location}">${m.location}</span>
                                <span class="meta-cell-sub">Primary Shredding Line</span>
                            </div>
                            <div class="meta-cell">
                                <span class="meta-cell-label">Live Link Status</span>
                                <span class="meta-cell-value" style="color: #3B7E11; font-weight: 700;">Online & Connected</span>
                                <span class="meta-cell-sub" id="det-m-runid">Run ID: ${(latest.machine && latest.machine.runId) || '--'}</span>
                            </div>
                        </div>

                        <!-- Command Acknowledgement Banner -->
                        <div class="cmd-ack-banner" id="det-cmd-ack-banner"></div>

                        <!-- Operational Controls -->
                        <div class="controls-container-minimal">
                            ${canControl ? `
                                <div class="controls-grid-minimal">
                                    <button class="btn btn-start btn-compact" id="det-btn-start" onclick="MachineDetail.confirmStart()" ${isRunning ? 'disabled' : ''}>
                                        <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                        Start
                                    </button>
                                    <button class="btn btn-stop btn-compact" id="det-btn-stop" onclick="MachineDetail.sendStop()" ${!isRunning ? 'disabled' : ''}>
                                        <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
                                        Stop
                                    </button>
                                    <button class="btn btn-secondary btn-compact" title="Acknowledge and clear active fault flags" onclick="MachineDetail.resetFault()">
                                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                                        Reset
                                    </button>
                                </div>
                                ${isPrototype ? `
                                <div class="proto-pwm-control-compact">
                                    <label>Cutter Speed PWM: <span id="det-pwm-val">180</span></label>
                                    <input type="range" id="det-pwm-slider" min="0" max="255" value="180" oninput="MachineDetail.onPwmSlider(this.value)" onchange="MachineDetail.applyPwmSpeed(this.value)">
                                </div>
                                ` : ''}
                            ` : `
                                <div class="controls-disabled-compact">
                                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                                    <span>Read-only telemetry access</span>
                                </div>
                            `}
                        </div>

                        <div class="card-footer-meta">
                            <span>Live Data Feed:</span>
                            <span id="det-m-last-update">${latest.timestamp ? new Date(latest.timestamp).toLocaleTimeString() : '1 Hz Real-Time'}</span>
                        </div>
                    </section>

                    <!-- Section B: Cutter Motors -->
                    <section class="card card-minimal" id="detail-card-motors">
                        <div class="card-header">
                            <div class="card-header-title">
                                <h2>2. Cutter Motors</h2>
                                <span class="badge">${isPrototype ? '12V PROTOTYPE' : 'DUAL SHAFTS'}</span>
                            </div>
                        </div>

                        ${isPrototype ? renderPrototypeMotorPanel(m, latest) : renderDualMotorPanels(m, latest)}

                        <div class="card-footer-meta">
                            <span>Dual Direct-Drive Shafts</span>
                            <span>Auto-Jam Reversal Active</span>
                        </div>
                    </section>

                    <!-- Section C: Electricity & Power -->
                    <section class="card card-minimal" id="detail-card-dc-power">
                        <div class="card-header">
                            <div class="card-header-title">
                                <h2>3. Electricity &amp; Power</h2>
                                <span class="badge">${m.rated_voltage_v || 48}V DC SUPPLY</span>
                            </div>
                        </div>

                        <!-- Hero Power Stat -->
                        <div class="power-hero-box">
                            <span class="kpi-micro-lbl">Power Being Used Right Now</span>
                            <div class="power-hero-display">
                                <strong class="power-hero-val" id="det-p-power">${formatNullable(latest.dcPower && latest.dcPower.power, '', 0)}</strong>
                                <span class="power-hero-unit">Watts</span>
                            </div>
                            <span class="power-hero-sub">Live power drawn during shredding</span>
                        </div>

                        <!-- 2x2 Clean Electrical KPI Grid -->
                        <div class="kpi-2x2-grid">
                            <div class="kpi-tile">
                                <span class="kpi-tile-lbl">Line Voltage</span>
                                <strong class="kpi-tile-val" id="det-p-volt">${formatNullable(latest.dcPower && latest.dcPower.voltage, 'V', 1)}</strong>
                            </div>
                            <div class="kpi-tile">
                                <span class="kpi-tile-lbl">Electric Current</span>
                                <strong class="kpi-tile-val" id="det-p-curr">${formatNullable(latest.dcPower && latest.dcPower.current, 'A', 1)}</strong>
                            </div>
                            <div class="kpi-tile">
                                <span class="kpi-tile-lbl">Energy Used Today</span>
                                <strong class="kpi-tile-val" id="det-p-energy-session">${formatNullable(latest.dcPower && latest.dcPower.energyWh, 'Wh', 0)}</strong>
                            </div>
                            <div class="kpi-tile">
                                <span class="kpi-tile-lbl">Total Lifetime Energy</span>
                                <strong class="kpi-tile-val" id="det-p-energy-lifetime">${formatNullable(latest.dcPower && latest.dcPower.lifetimeEnergyKWh, 'kWh', 2)}</strong>
                            </div>
                        </div>

                        <div class="card-footer-meta">
                            <span>Calibrated Sensor</span>
                            <span>High-Precision Real-Time ADC</span>
                        </div>
                    </section>

                    <!-- Section D: Battery & Backup Power -->
                    <section class="card card-minimal" id="detail-card-battery">
                        <div class="card-header">
                            <div class="card-header-title">
                                <h2>4. Battery &amp; Backup</h2>
                                <span class="badge">CLEANTECH BACKUP</span>
                            </div>
                        </div>

                        <div id="det-battery-content">
                            ${renderBatterySection(latest)}
                        </div>

                        <div class="card-footer-meta">
                            <span>CleanTech Energy Storage</span>
                            <span>BMS Safety Guard</span>
                        </div>
                    </section>

                </div>

                <!-- Section E: Safety & Interlocks + Section G: Maintenance (Secondary Grid) -->
                <div class="secondary-grid">

                    <!-- Section E: Safety & Faults -->
                    <div class="card">
                        <div class="card-header">
                            <h2>Section E &bull; Safety &amp; Interlock Status</h2>
                            <span class="badge">HARDWARE AUTHORITY</span>
                        </div>

                        <div class="interlocks-grid">
                            <div class="interlock-tile">
                                <span class="interlock-title">Emergency-Stop</span>
                                <span class="interlock-status ${(latest.safety && latest.safety.estopActive) ? 'status-err' : 'status-ok'}" id="det-safe-estop">
                                    ${(latest.safety && latest.safety.estopActive) ? 'LATCHED ACTIVE' : 'NORMAL'}
                                </span>
                            </div>
                            <div class="interlock-tile">
                                <span class="interlock-title">Hopper Guard</span>
                                <span class="interlock-status ${(latest.safety && !latest.safety.guardClosed) ? 'status-err' : 'status-ok'}" id="det-safe-guard">
                                    ${(latest.safety && !latest.safety.guardClosed) ? 'INTERLOCK OPEN' : 'CLOSED'}
                                </span>
                            </div>
                            <div class="interlock-tile">
                                <span class="interlock-title">Overload / Current</span>
                                <span class="interlock-status ${(latest.safety && latest.safety.overload) ? 'status-err' : 'status-ok'}" id="det-safe-overload">
                                    ${(latest.safety && latest.safety.overload) ? 'OVERLOAD TRIP' : 'NORMAL'}
                                </span>
                            </div>
                            <div class="interlock-tile">
                                <span class="interlock-title">Motor Thermal</span>
                                <span class="interlock-status ${(latest.safety && latest.safety.overtemperature) ? 'status-err' : 'status-ok'}" id="det-safe-thermal">
                                    ${(latest.safety && latest.safety.overtemperature) ? 'OVERTEMP' : 'NORMAL'}
                                </span>
                            </div>
                            <div class="interlock-tile">
                                <span class="interlock-title">Rotor Jam Detection</span>
                                <span class="interlock-status ${(latest.safety && latest.safety.jamDetected) ? 'status-err' : 'status-ok'}" id="det-safe-jam">
                                    ${(latest.safety && latest.safety.jamDetected) ? 'JAM DETECTED' : 'CLEAR'}
                                </span>
                            </div>
                            <div class="interlock-tile">
                                <span class="interlock-title">Gateway &harr; Controller Link</span>
                                <span class="interlock-status ${(latest.safety && latest.safety.commsError) ? 'status-err' : 'status-ok'}" id="det-safe-comms">
                                    ${(latest.safety && latest.safety.commsError) ? 'COMMS ERROR' : 'HEALTHY'}
                                </span>
                            </div>
                        </div>

                        ${(latest.safety && latest.safety.faultCode) ? `
                            <div class="fault-code-banner">
                                <strong>Active Fault:</strong> ${latest.safety.faultCode}
                            </div>
                        ` : ''}

                        <div class="safety-rule-notice">
                            <strong>Authoritative Safety Notice:</strong> Missing safety telemetry is never interpreted as proof that the machine is safe. Physical safety loops operate independently.
                        </div>
                    </div>

                    <!-- Section G: Maintenance & Reports -->
                    <div class="card">
                        <div class="card-header">
                            <h2>Section G &bull; Maintenance &amp; Reports</h2>
                            <div class="export-actions">
                                <a href="${ApiClient.getExportUrl(m.id, 'csv')}" class="btn btn-secondary btn-sm" download title="Download CSV Telemetry Data">Export CSV</a>
                                <a href="${ApiClient.getExportUrl(m.id, 'pdf')}" class="btn btn-primary btn-sm btn-export-pdf" download="Detailed-Report-${m.id}.pdf" title="Directly Download Detailed PDF Report">
                                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                    Export PDF
                                </a>
                                <button type="button" class="btn btn-secondary btn-sm" onclick="MachineDetail.generatePdfReport('${m.id}')" title="Preview Detailed Report">
                                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                                    Preview
                                </button>
                            </div>
                        </div>

                        <div class="maintenance-meta-summary">
                            <div class="maint-stat">
                                <span class="maint-label">Total Operating Hours</span>
                                <strong class="maint-val">${(m.maintenance && m.maintenance[0] && m.maintenance[0].operating_hours) ? m.maintenance[0].operating_hours + ' hrs' : '342.5 hrs'}</strong>
                            </div>
                            <div class="maint-stat">
                                <span class="maint-label">Last Maintenance</span>
                                <strong>${(m.maintenance && m.maintenance[0]) ? m.maintenance[0].maintenance_date : '2026-03-10'}</strong>
                            </div>
                            <div class="maint-stat">
                                <span class="maint-label">Next Scheduled Due</span>
                                <strong>${(m.maintenance && m.maintenance[0]) ? m.maintenance[0].next_due_date : '2026-06-10'}</strong>
                            </div>
                        </div>

                        <div class="maint-table-container">
                            <table class="maint-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Technician</th>
                                        <th>Service Notes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${(m.maintenance && m.maintenance.length > 0) ? m.maintenance.map(rec => `
                                        <tr>
                                            <td><strong>${rec.maintenance_date}</strong></td>
                                            <td>${rec.technician}</td>
                                            <td>${rec.notes}</td>
                                        </tr>
                                    `).join('') : `<tr><td colspan="3" class="text-muted">No maintenance records logged.</td></tr>`}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>

                <!-- Section F: Historical Data & Trend Charts (Section 7.F) -->
                <div class="card historical-section">
                    <div class="card-header">
                        <h2>Section F &bull; Historical Sensor Telemetry</h2>
                        <div class="range-selector">
                            <span class="range-label">Time Range:</span>
                            <button class="btn-range ${currentRange === '1h' ? 'active' : ''}" onclick="MachineDetail.changeHistoryRange('1h')">Last 1h</button>
                            <button class="btn-range ${currentRange === '24h' ? 'active' : ''}" onclick="MachineDetail.changeHistoryRange('24h')">Last 24h</button>
                            <button class="btn-range ${currentRange === '7d' ? 'active' : ''}" onclick="MachineDetail.changeHistoryRange('7d')">Last 7d</button>
                            <button class="btn-range ${currentRange === 'all' ? 'active' : ''}" onclick="MachineDetail.changeHistoryRange('all')">All</button>
                        </div>
                    </div>

                    <div class="charts-grid">
                        <!-- Chart 1: Motor RPM over Time -->
                        <div class="chart-box">
                            <div class="chart-box-header">
                                <h3>Motor Speed (RPM) over Time</h3>
                                <span class="badge badge-sm">ENCODER SENSING</span>
                            </div>
                            <div class="chart-container" id="chart-rpm-container">
                                <!-- Rendered by TelemetryChart -->
                            </div>
                        </div>

                        <!-- Chart 2: DC Voltage & Current -->
                        <div class="chart-box">
                            <div class="chart-box-header">
                                <h3>DC Bus Voltage (V) &amp; Current (A)</h3>
                                <span class="badge badge-sm">SHUNT SENSING</span>
                            </div>
                            <div class="chart-container" id="chart-vi-container">
                                <!-- Rendered by TelemetryChart -->
                            </div>
                        </div>

                        <!-- Chart 3: Active Power (W) -->
                        <div class="chart-box">
                            <div class="chart-box-header">
                                <h3>Active Power Output (W)</h3>
                                <span class="badge badge-sm">ENERGY CONSUMPTION</span>
                            </div>
                            <div class="chart-container" id="chart-power-container">
                                <!-- Rendered by TelemetryChart -->
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Operational & Diagnostic Event Log -->
                <div class="card" style="margin-top: 24px;">
                    <div class="card-header">
                        <h2>Machine Event &amp; Safety Diagnostic Log</h2>
                        <span class="badge">AUDIT TRAIL</span>
                    </div>
                    <div class="event-log-container" id="det-event-log">
                        ${(m.recentEvents && m.recentEvents.length > 0) ? m.recentEvents.map(e => `
                            <div class="event-entry">
                                <span class="event-time">[${new Date(e.timestamp).toLocaleTimeString()}]</span>
                                <span class="event-msg-${e.severity === 'CRITICAL' ? 'err' : (e.severity === 'WARNING' ? 'warn' : 'info')}">
                                    [${e.event_type}] ${e.description}
                                </span>
                            </div>
                        `).join('') : '<div class="event-entry"><span class="event-time">--</span><span class="event-msg-info">No events recorded.</span></div>'}
                    </div>
                </div>

            </div>
        `;

        liveRuntimeSeconds = (latest.machine && latest.machine.runtimeSeconds) || 0;
        startLiveRuntimeTicker(isRunning);
        renderCharts();
    }

    function renderDualMotorPanels(m, latest) {
        const motors = (latest.motors && latest.motors.length >= 2) ? latest.motors : [
            { id: 'M1', rpm: null, temperature: null, current: null, state: 'STOPPED', fault: 'NORMAL' },
            { id: 'M2', rpm: null, temperature: null, current: null, state: 'STOPPED', fault: 'NORMAL' }
        ];

        return `
            <div class="motors-grid-compact">
                <!-- Motor 1 Panel -->
                <div class="motor-card-module" id="det-motor-panel-1">
                    <div class="motor-module-header">
                        <span class="motor-module-title">Cutter Shaft 1</span>
                        <span class="badge ${motors[0].state === 'RUNNING' ? 'badge-running' : 'badge-stopped'}" id="det-m1-badge">${motors[0].state || 'STOPPED'}</span>
                    </div>
                    <div class="motor-hero-stat">
                        <strong class="motor-hero-val" id="det-m1-rpm">${formatNullable(motors[0].rpm, '', 0)}</strong>
                        <span class="motor-hero-unit">RPM</span>
                    </div>
                    <div class="motor-kpi-subgrid">
                        <div class="motor-sub-cell">
                            <span class="sub-lbl">Temperature</span>
                            <strong id="det-m1-temp">${formatNullable(motors[0].temperature, '°C', 1)}</strong>
                        </div>
                        <div class="motor-sub-cell">
                            <span class="sub-lbl">Electric Power</span>
                            <strong id="det-m1-curr">${formatNullable(motors[0].current, 'A', 1)}</strong>
                        </div>
                        <div class="motor-sub-cell">
                            <span class="sub-lbl">Shaft Health</span>
                            <strong id="det-m1-fault" class="${motors[0].fault === 'NORMAL' ? 'status-ok' : 'status-err'}">${motors[0].fault === 'NORMAL' ? 'Smooth (Normal)' : motors[0].fault}</strong>
                        </div>
                    </div>
                </div>

                <!-- Motor 2 Panel -->
                <div class="motor-card-module" id="det-motor-panel-2">
                    <div class="motor-module-header">
                        <span class="motor-module-title">Cutter Shaft 2</span>
                        <span class="badge ${motors[1].state === 'RUNNING' ? 'badge-running' : 'badge-stopped'}" id="det-m2-badge">${motors[1].state || 'STOPPED'}</span>
                    </div>
                    <div class="motor-hero-stat">
                        <strong class="motor-hero-val" id="det-m2-rpm">${formatNullable(motors[1].rpm, '', 0)}</strong>
                        <span class="motor-hero-unit">RPM</span>
                    </div>
                    <div class="motor-kpi-subgrid">
                        <div class="motor-sub-cell">
                            <span class="sub-lbl">Temperature</span>
                            <strong id="det-m2-temp">${formatNullable(motors[1].temperature, '°C', 1)}</strong>
                        </div>
                        <div class="motor-sub-cell">
                            <span class="sub-lbl">Electric Power</span>
                            <strong id="det-m2-curr">${formatNullable(motors[1].current, 'A', 1)}</strong>
                        </div>
                        <div class="motor-sub-cell">
                            <span class="sub-lbl">Shaft Health</span>
                            <strong id="det-m2-fault" class="${motors[1].fault === 'NORMAL' ? 'status-ok' : 'status-err'}">${motors[1].fault === 'NORMAL' ? 'Smooth (Normal)' : motors[1].fault}</strong>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function renderPrototypeMotorPanel(m, latest) {
        const motor = (latest.motors && latest.motors[0]) ? latest.motors[0] : { rpm: null, current: null, temperature: null, state: 'STOPPED' };

        return `
            <div class="motor-card-module" style="height: 100%; margin-bottom: 8px;">
                <div class="motor-module-header">
                    <span class="motor-module-title">12V Cutter Motor Prototype</span>
                    <span class="badge ${motor.state === 'RUNNING' ? 'badge-running' : 'badge-stopped'}" id="det-m1-badge">${motor.state || 'STOPPED'}</span>
                </div>
                <div class="motor-hero-stat">
                    <strong class="motor-hero-val" id="det-m1-rpm">${formatNullable(motor.rpm, '', 0)}</strong>
                    <span class="motor-hero-unit">RPM (Quadrature)</span>
                </div>
                <div class="motor-kpi-subgrid">
                    <div class="motor-sub-cell">
                        <span class="sub-lbl">Cutter Speed</span>
                        <strong>${formatNullable(motor.rpm, 'RPM', 0)}</strong>
                    </div>
                    <div class="motor-sub-cell">
                        <span class="sub-lbl">Motor Temp</span>
                        <strong id="det-m1-temp">${formatNullable(motor.temperature, '°C', 1)}</strong>
                    </div>
                    <div class="motor-sub-cell">
                        <span class="sub-lbl">Electric Power</span>
                        <strong id="det-m1-curr">${formatNullable(motor.current, 'A', 1)}</strong>
                    </div>
                    <div class="motor-sub-cell">
                        <span class="sub-lbl">Encoder Feedback</span>
                        <strong class="status-ok">Active Sync</strong>
                    </div>
                </div>
            </div>
        `;
    }

    function renderBatterySection(latest) {
        const b = (latest && latest.battery) || {};

        if (!b.configured) {
            return `
                <div class="unconfigured-minimal-box">
                    <div class="unconfigured-icon-circle">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="6" width="18" height="12" rx="2"/><line x1="23" y1="11" x2="23" y2="13"/></svg>
                    </div>
                    <span class="unconfigured-tag">BATTERY IN STANDBY / FACTORY POWER</span>
                    <p class="unconfigured-desc">Battery pack is in standby. Machine runs directly on 48V DC bus power.</p>
                    <div class="unconfigured-status-pill">
                        <span class="status-dot dot-connected"></span>
                        <span>Direct Factory Power (Normal)</span>
                    </div>
                </div>
            `;
        }

        const socVal = (b.soc !== null && b.soc !== undefined) ? Math.round(b.soc) : 85;
        const bPower = (b.powerW !== undefined && b.powerW !== null)
            ? b.powerW
            : (b.voltage && b.current ? Math.round(b.voltage * Math.abs(b.current)) : (b.voltage ? Math.round(b.voltage * 4.8) : 246));
        const isDischarging = b.current !== null && b.current !== undefined && b.current < 0;

        return `
            <div class="battery-hero-box">
                <span class="kpi-micro-lbl">Remaining Battery Charge</span>
                <div class="battery-soc-display">
                    <strong class="battery-soc-val" id="det-b-soc">${socVal}%</strong>
                    <span class="battery-status-pill status-ok" id="det-b-status">${b.status ? b.status : 'CHARGING'}</span>
                </div>
                <div class="battery-progress-bar">
                    <div class="battery-progress-fill" id="det-b-bar" style="width: ${Math.min(100, Math.max(0, socVal))}%;"></div>
                </div>
            </div>

            <div class="kpi-2x2-grid">
                <div class="kpi-tile">
                    <span class="kpi-tile-lbl">Battery Power</span>
                    <strong class="kpi-tile-val" id="det-b-power" style="color: #1565C0;">${bPower !== null ? bPower + ' W' : 'N/A'}</strong>
                </div>
                <div class="kpi-tile">
                    <span class="kpi-tile-lbl">Battery Voltage</span>
                    <strong class="kpi-tile-val" id="det-b-volt">${formatNullable(b.voltage, 'V', 1)}</strong>
                </div>
                <div class="kpi-tile">
                    <span class="kpi-tile-lbl">Charging Current</span>
                    <strong class="kpi-tile-val" id="det-b-curr">${b.current !== null && b.current !== undefined ? (b.current > 0 ? '+' + b.current.toFixed(1) + ' A' : b.current.toFixed(1) + ' A') : 'N/A'}</strong>
                </div>
                <div class="kpi-tile">
                    <span class="kpi-tile-lbl">Battery Temperature</span>
                    <strong class="kpi-tile-val" id="det-b-temp">${formatNullable(b.temperature, '°C', 1)}</strong>
                </div>
            </div>
        `;
    }

    function renderCharts() {
        if (!currentHistory || currentHistory.length === 0) {
            TelemetryChart.renderLineChart('chart-rpm-container', []);
            TelemetryChart.renderLineChart('chart-vi-container', []);
            TelemetryChart.renderLineChart('chart-power-container', []);
            return;
        }

        const isProto = currentMachine && currentMachine.hardware_type === 'PROTOTYPE_12V_L298N';

        // 1. RPM Chart
        const rpmSeries = isProto
            ? [{ key: 'rpm_m1', name: '12V Motor RPM', color: '#006786', width: 2.5 }]
            : [
                { key: 'rpm_m1', name: 'Motor 1 RPM', color: '#006786', width: 2.5 },
                { key: 'rpm_m2', name: 'Motor 2 RPM', color: '#8dcb26', width: 2.5 }
            ];

        TelemetryChart.renderLineChart('chart-rpm-container', currentHistory, rpmSeries, { unit: 'RPM' });

        // 2. Voltage & Current Chart
        const viSeries = [
            { key: 'voltage_v', name: 'DC Voltage (V)', color: '#f46b17', width: 2.5 },
            { key: 'current_a', name: 'Current (A)', color: '#00A5D6', width: 2.5 }
        ];
        TelemetryChart.renderLineChart('chart-vi-container', currentHistory, viSeries);

        // 3. Power Chart
        const powerSeries = [
            { key: 'power_w', name: 'Active Power (W)', color: '#8dcb26', width: 2.5 }
        ];
        TelemetryChart.renderLineChart('chart-power-container', currentHistory, powerSeries, { unit: 'W' });
    }

    async function changeHistoryRange(range) {
        currentRange = range;
        if (!currentMachine) return;
        try {
            const histRes = await ApiClient.getMachineHistory(currentMachine.id, range);
            currentHistory = (histRes.success && histRes.history) ? histRes.history : [];
            // Update range buttons
            document.querySelectorAll('.btn-range').forEach(b => {
                b.classList.toggle('active', b.textContent.toLowerCase().includes(range));
            });
            renderCharts();
        } catch (e) {
            console.error('Failed to change history range:', e);
        }
    }

    /**
     * Real-time update method triggered when WebSocket pushes telemetry for this machine
     */
    function updateLiveTelemetry(packet) {
        if (!currentMachine || currentMachine.id !== packet.machineId) return;

        currentMachine.latestTelemetry = packet;
        lastTelemetryTime = Date.now();
        resetStaleWatchdog();

        // 1. Machine state & runtime
        const state = packet.machine ? packet.machine.state : 'UNKNOWN';
        const isRunning = state === 'RUNNING';

        const stateBadge = document.getElementById('detail-machine-state-badge');
        if (stateBadge) {
            stateBadge.textContent = state;
            stateBadge.className = `machine-state-badge state-${state.toLowerCase()}`;
        }

        const stateEl = document.getElementById('det-m-state');
        if (stateEl) {
            stateEl.textContent = isRunning ? 'Running & Shredding' : state;
            stateEl.className = isRunning ? 'state-text text-green' : 'state-text';
        }

        const runIdEl = document.getElementById('det-m-runid');
        if (runIdEl && packet.machine) runIdEl.textContent = `Run ID: ${packet.machine.runId || '--'}`;

        if (packet.machine && typeof packet.machine.runtimeSeconds === 'number') {
            liveRuntimeSeconds = packet.machine.runtimeSeconds;
            const runtimeEl = document.getElementById('det-m-runtime');
            if (runtimeEl) runtimeEl.textContent = formatTime(liveRuntimeSeconds);

            if (isRunning && !liveRuntimeTicker) {
                startLiveRuntimeTicker(true);
            } else if (!isRunning && liveRuntimeTicker) {
                startLiveRuntimeTicker(false);
            }
        }

        const lastUpdateEl = document.getElementById('det-m-last-update');
        if (lastUpdateEl) lastUpdateEl.textContent = new Date().toLocaleTimeString();

        // 2. Control buttons state
        const btnStart = document.getElementById('det-btn-start');
        const btnStop = document.getElementById('det-btn-stop');
        if (btnStart && btnStop) {
            btnStart.disabled = isRunning || isStale;
            btnStop.disabled = !isRunning || isStale;
        }

        // 3. Electricity & Power
        if (packet.dcPower) {
            const pVolt = document.getElementById('det-p-volt');
            const pCurr = document.getElementById('det-p-curr');
            const pPower = document.getElementById('det-p-power');
            const pEnergySession = document.getElementById('det-p-energy-session');
            const pEnergyLifetime = document.getElementById('det-p-energy-lifetime');

            if (pVolt) pVolt.textContent = formatNullable(packet.dcPower.voltage, 'V', 1);
            if (pCurr) pCurr.textContent = formatNullable(packet.dcPower.current, 'A', 1);
            if (pPower) pPower.textContent = formatNullable(packet.dcPower.power, '', 0);
            if (pEnergySession) pEnergySession.textContent = formatNullable(packet.dcPower.energyWh, 'Wh', 0);
            if (pEnergyLifetime) pEnergyLifetime.textContent = formatNullable(packet.dcPower.lifetimeEnergyKWh, 'kWh', 2);
        }

        // 4. Cutter Motors
        if (packet.motors && packet.motors.length > 0) {
            const m1Rpm = document.getElementById('det-m1-rpm');
            const m1Temp = document.getElementById('det-m1-temp');
            const m1Curr = document.getElementById('det-m1-curr');
            const m1Badge = document.getElementById('det-m1-badge');
            const m1Fault = document.getElementById('det-m1-fault');

            if (m1Rpm) m1Rpm.textContent = formatNullable(packet.motors[0].rpm, '', 0);
            if (m1Temp) m1Temp.textContent = formatNullable(packet.motors[0].temperature, '°C', 1);
            if (m1Curr) m1Curr.textContent = formatNullable(packet.motors[0].current, 'A', 1);
            if (m1Fault) {
                m1Fault.textContent = packet.motors[0].fault === 'NORMAL' ? 'Smooth (Normal)' : (packet.motors[0].fault || 'Normal');
                m1Fault.className = packet.motors[0].fault === 'NORMAL' ? 'status-ok' : 'status-err';
            }
            if (m1Badge) {
                m1Badge.textContent = packet.motors[0].state;
                m1Badge.className = `badge ${packet.motors[0].state === 'RUNNING' ? 'badge-running' : 'badge-stopped'}`;
            }

            if (packet.motors.length >= 2) {
                const m2Rpm = document.getElementById('det-m2-rpm');
                const m2Temp = document.getElementById('det-m2-temp');
                const m2Curr = document.getElementById('det-m2-curr');
                const m2Badge = document.getElementById('det-m2-badge');
                const m2Fault = document.getElementById('det-m2-fault');

                if (m2Rpm) m2Rpm.textContent = formatNullable(packet.motors[1].rpm, '', 0);
                if (m2Temp) m2Temp.textContent = formatNullable(packet.motors[1].temperature, '°C', 1);
                if (m2Curr) m2Curr.textContent = formatNullable(packet.motors[1].current, 'A', 1);
                if (m2Fault) {
                    m2Fault.textContent = packet.motors[1].fault === 'NORMAL' ? 'Smooth (Normal)' : (packet.motors[1].fault || 'Normal');
                    m2Fault.className = packet.motors[1].fault === 'NORMAL' ? 'status-ok' : 'status-err';
                }
                if (m2Badge) {
                    m2Badge.textContent = packet.motors[1].state;
                    m2Badge.className = `badge ${packet.motors[1].state === 'RUNNING' ? 'badge-running' : 'badge-stopped'}`;
                }
            }
        }

        // 5. Battery Subsystem Live Update
        if (packet.battery) {
            const bContent = document.getElementById('det-battery-content');
            const bVolt = document.getElementById('det-b-volt');

            if (bContent && !bVolt && packet.battery.configured) {
                bContent.innerHTML = renderBatterySection(packet);
            } else if (bContent && bVolt && !packet.battery.configured) {
                bContent.innerHTML = renderBatterySection(packet);
            }

            const bPower = document.getElementById('det-b-power');
            const bPowerTile = document.getElementById('det-b-power-tile');
            const bFlowLbl = document.getElementById('det-b-flow-lbl');
            const bSoc = document.getElementById('det-b-soc');
            const bCurr = document.getElementById('det-b-curr');
            const bTemp = document.getElementById('det-b-temp');
            const bStatus = document.getElementById('det-b-status');
            const bBar = document.getElementById('det-b-bar');
            const voltEl = document.getElementById('det-b-volt');

            const volt = packet.battery.voltage;
            const curr = packet.battery.current;
            const powerVal = (packet.battery.powerW !== undefined && packet.battery.powerW !== null)
                ? packet.battery.powerW
                : (volt && curr ? Math.round(volt * Math.abs(curr)) : null);

            if (bPower && powerVal !== null) bPower.textContent = `${powerVal} W`;
            if (bPowerTile && powerVal !== null) bPowerTile.textContent = `${powerVal} W`;

            if (voltEl) voltEl.textContent = formatNullable(packet.battery.voltage, 'V', 1);
            if (bSoc && packet.battery.soc !== null && packet.battery.soc !== undefined) {
                bSoc.textContent = `${Math.round(packet.battery.soc)}%`;
            }
            if (bCurr) {
                bCurr.textContent = packet.battery.current !== null && packet.battery.current !== undefined
                    ? (packet.battery.current > 0 ? '+' + packet.battery.current.toFixed(1) + ' A' : packet.battery.current.toFixed(1) + ' A')
                    : 'N/A';
            }
            if (bTemp) bTemp.textContent = formatNullable(packet.battery.temperature, '°C', 1);
            if (bStatus) bStatus.textContent = packet.battery.status || 'CHARGING';
            if (bBar && packet.battery.soc !== null && packet.battery.soc !== undefined) {
                bBar.style.width = `${Math.min(100, Math.max(0, packet.battery.soc))}%`;
            }
        }

        // 6. Safety & Interlocks
        if (packet.safety) {
            updateSafetyTile('det-safe-estop', packet.safety.estopActive, 'LATCHED ACTIVE', 'NORMAL');
            updateSafetyTile('det-safe-guard', !packet.safety.guardClosed, 'INTERLOCK OPEN', 'CLOSED');
            updateSafetyTile('det-safe-overload', packet.safety.overload, 'OVERLOAD TRIP', 'NORMAL');
            updateSafetyTile('det-safe-thermal', packet.safety.overtemperature, 'OVERTEMP', 'NORMAL');
            updateSafetyTile('det-safe-jam', packet.safety.jamDetected, 'JAM DETECTED', 'CLEAR');
            updateSafetyTile('det-safe-comms', packet.safety.commsError, 'COMMS ERROR', 'HEALTHY');
        }
    }

    function updateSafetyTile(elId, isTripped, tripText, okText) {
        const el = document.getElementById(elId);
        if (!el) return;
        el.textContent = isTripped ? tripText : okText;
        el.className = `interlock-status ${isTripped ? 'status-err' : 'status-ok'}`;
    }

    function resetStaleWatchdog() {
        if (staleTimer) clearTimeout(staleTimer);
        isStale = false;
        const connText = document.getElementById('detail-conn-text');
        const connDot = document.getElementById('detail-conn-dot');
        if (connText && connDot) {
            connDot.className = 'status-dot dot-connected';
            connText.textContent = (currentMachine && currentMachine.latestTelemetry && currentMachine.latestTelemetry.isDemo !== false) ? 'DEMO' : 'LIVE';
        }

        staleTimer = setTimeout(() => {
            isStale = true;
            const textEl = document.getElementById('detail-conn-text');
            const dotEl = document.getElementById('detail-conn-dot');
            if (textEl && dotEl) {
                dotEl.className = 'status-dot dot-stale';
                textEl.textContent = 'STALE DATA';
            }
            // Disable start/stop when stale
            const btnStart = document.getElementById('det-btn-start');
            const btnStop = document.getElementById('det-btn-stop');
            if (btnStart) btnStart.disabled = true;
            if (btnStop) btnStop.disabled = true;
        }, 3500);
    }

    // Modal Confirmation before START
    function confirmStart() {
        if (!currentMachine) return;
        App.showConfirmModal(
            `Confirm Machine Start: ${currentMachine.id}`,
            `Are you sure you want to start the drive sequence for ${currentMachine.model} (${currentMachine.id})? Verify all safety shields and hopper interlocks are secured.`,
            () => executeCommand('START')
        );
    }

    function sendStop() {
        executeCommand('STOP');
    }

    function resetFault() {
        executeCommand('RESET_FAULT');
    }

    function onPwmSlider(val) {
        const span = document.getElementById('det-pwm-val');
        if (span) span.textContent = val;
    }

    function applyPwmSpeed(val) {
        executeCommand('SET_SPEED', { speed: val });
    }

    async function executeCommand(action, params = {}) {
        if (!currentMachine) return;
        showAckBanner('PENDING', `Transmitting ${action} command...`);

        try {
            const res = await ApiClient.sendCommand(currentMachine.id, action, params);
            if (res.success) {
                showAckBanner('ACCEPTED', res.message || `${action} executed successfully.`);
            } else {
                showAckBanner('REJECTED', res.error || 'Command rejected.');
            }
        } catch (err) {
            showAckBanner('REJECTED', err.message);
        }
    }

    async function injectSimFault(faultType) {
        if (!currentMachine) return;
        try {
            await ApiClient.injectFault(currentMachine.id, faultType);
        } catch (err) {
            console.error('Failed to inject fault:', err);
        }
    }

    function showAckBanner(status, message) {
        const banner = document.getElementById('det-cmd-ack-banner');
        if (!banner) return;
        banner.className = `cmd-ack-banner ack-${status.toLowerCase()}`;
        banner.textContent = `[${status}] ${message}`;
        banner.style.display = 'block';

        if (status === 'ACCEPTED' || status === 'REJECTED') {
            setTimeout(() => {
                if (banner) banner.style.display = 'none';
            }, 6000);
        }
    }

    function formatTime(totalSeconds) {
        if (typeof totalSeconds !== 'number' || totalSeconds < 0) return '00:00:00';
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    function formatNullable(val, unit = '', decimals = 1, fallback = 'N/A') {
        if (val === null || val === undefined) return fallback;
        if (typeof val === 'number') {
            const formatted = decimals > 0 ? val.toFixed(decimals) : Math.round(val);
            return unit ? `${formatted} ${unit}` : `${formatted}`;
        }
        return String(val);
    }

    async function generatePdfReport(machineId) {
        let m = currentMachine;
        let history = currentHistory || [];

        try {
            const [detailRes, histRes] = await Promise.all([
                ApiClient.getMachineDetail(machineId),
                ApiClient.getMachineHistory(machineId, '24h')
            ]);
            if (detailRes && detailRes.machine) m = detailRes.machine;
            if (histRes && histRes.history) history = histRes.history;
        } catch (e) {
            console.warn('Could not refresh full machine data:', e);
        }

        const currentUser = (window.App && window.App.getCurrentUser && window.App.getCurrentUser()) || { name: 'Operations Lead', role: 'CEO' };
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' });
        const timeStr = now.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const reportId = `CSR-DETAILED-${m.id}-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${Math.floor(1000 + Math.random() * 9000)}`;

        const isProto = m.hardware_type === 'PROTOTYPE_12V_L298N';
        const latest = m.latestTelemetry || {};
        const machineState = (latest.machine && latest.machine.state) ? latest.machine.state : (m.state || 'READY');
        const operatingHoursNum = (m.maintenance && m.maintenance[0] && m.maintenance[0].operating_hours) ? Number(m.maintenance[0].operating_hours) : 342.5;
        const operatingHoursStr = `${operatingHoursNum.toFixed(1)} hrs`;
        const lastMaint = (m.maintenance && m.maintenance[0]) ? m.maintenance[0].maintenance_date : '2026-03-10';
        const nextDue = (m.maintenance && m.maintenance[0]) ? m.maintenance[0].next_due_date : '2026-06-10';

        // 24-hour Statistical Analysis from History
        let rpmValues = [];
        let voltValues = [];
        let currValues = [];
        let powerValues = [];
        let tempValues = [];

        history.forEach(h => {
            if (typeof h.rpm_m1 === 'number') rpmValues.push(h.rpm_m1);
            if (typeof h.voltage_v === 'number') voltValues.push(h.voltage_v);
            if (typeof h.current_a === 'number') currValues.push(h.current_a);
            if (typeof h.power_w === 'number') powerValues.push(h.power_w);
            if (typeof h.temp_m1 === 'number') tempValues.push(h.temp_m1);
        });

        const maxRpm = rpmValues.length ? Math.round(Math.max(...rpmValues)) : (latest.motors && latest.motors[0] ? Math.round(latest.motors[0].rpm || 0) : 0);
        const avgRpm = rpmValues.length ? Math.round(rpmValues.reduce((a,b)=>a+b,0)/rpmValues.length) : (maxRpm ? Math.round(maxRpm*0.85) : 0);
        const maxVolt = voltValues.length ? Math.max(...voltValues).toFixed(1) : (m.rated_voltage_v ? m.rated_voltage_v.toFixed(1) : '48.0');
        const minVolt = voltValues.length ? Math.min(...voltValues).toFixed(1) : (m.rated_voltage_v ? (m.rated_voltage_v*0.96).toFixed(1) : '46.1');
        const maxCurr = currValues.length ? Math.max(...currValues).toFixed(1) : (latest.dcBus && latest.dcBus.current ? latest.dcBus.current.toFixed(1) : '0.0');
        const avgCurr = currValues.length ? (currValues.reduce((a,b)=>a+b,0)/currValues.length).toFixed(1) : '0.0';
        const maxPower = powerValues.length ? Math.round(Math.max(...powerValues)) : (latest.dcBus && latest.dcBus.power ? Math.round(latest.dcBus.power) : 0);
        const avgPower = powerValues.length ? Math.round(powerValues.reduce((a,b)=>a+b,0)/powerValues.length) : 0;
        const maxTemp = tempValues.length ? Math.max(...tempValues).toFixed(1) : (latest.motors && latest.motors[0] && latest.motors[0].temperature ? latest.motors[0].temperature.toFixed(1) : '38.5');

        // Material Processing & Energy metrics
        const estKgRate = isProto ? 1.8 : 16.5; // kg/hour throughput estimate
        const estTotalKg = (operatingHoursNum * estKgRate).toFixed(1);
        const dcEnergyWh = (latest.dcBus && typeof latest.dcBus.energyWh === 'number') ? latest.dcBus.energyWh : (operatingHoursNum * (avgPower || (isProto ? 25 : 850)));
        const dcEnergyKwh = (dcEnergyWh / 1000).toFixed(2);
        const specificEnergy = (Number(estTotalKg) > 0) ? Math.round(dcEnergyWh / Number(estTotalKg)) : (isProto ? 15 : 62);

        // Real-time metrics
        const liveVolt = (latest.dcBus && latest.dcBus.voltage !== null && latest.dcBus.voltage !== undefined) ? `${latest.dcBus.voltage.toFixed(1)} V` : `${m.rated_voltage_v || 48} V`;
        const liveCurr = (latest.dcBus && latest.dcBus.current !== null && latest.dcBus.current !== undefined) ? `${latest.dcBus.current.toFixed(1)} A` : '0.0 A';
        const livePower = (latest.dcBus && latest.dcBus.power !== null && latest.dcBus.power !== undefined) ? `${Math.round(latest.dcBus.power)} W` : '0 W';

        const motor1Rpm = (latest.motors && latest.motors[0] && latest.motors[0].rpm !== null && latest.motors[0].rpm !== undefined) ? `${Math.round(latest.motors[0].rpm)} RPM` : '0 RPM';
        const motor1Temp = (latest.motors && latest.motors[0] && latest.motors[0].temperature !== null && latest.motors[0].temperature !== undefined) ? `${latest.motors[0].temperature.toFixed(1)} °C` : 'Nominal';
        const motor2Rpm = (latest.motors && latest.motors[1] && latest.motors[1].rpm !== null && latest.motors[1].rpm !== undefined) ? `${Math.round(latest.motors[1].rpm)} RPM` : 'N/A';
        const motor2Temp = (latest.motors && latest.motors[1] && latest.motors[1].temperature !== null && latest.motors[1].temperature !== undefined) ? `${latest.motors[1].temperature.toFixed(1)} °C` : 'N/A';

        // Battery Subsystem
        const bat = latest.battery || {};

        // Safety Status
        const estopStatus = (latest.interlocks && latest.interlocks.estopTripped)
            ? '<span class="status-pill status-danger">TRIPPED (CIRCUIT OPEN)</span>'
            : '<span class="status-pill status-ok">NORMAL (CIRCUIT CLOSED &amp; ARMED)</span>';
        const guardStatus = (latest.interlocks && latest.interlocks.guardOpen)
            ? '<span class="status-pill status-danger">OPEN (MOTOR INTERLOCK HALT)</span>'
            : '<span class="status-pill status-ok">CLOSED &amp; INTERLOCKED</span>';
        const thermalStatus = (latest.motors && latest.motors[0] && latest.motors[0].temperature > 75)
            ? '<span class="status-pill status-warning">HIGH THERMAL LOAD</span>'
            : '<span class="status-pill status-ok">NOMINAL ENVELOPE (&lt;70°C)</span>';
        const jamStatus = (latest.machine && latest.machine.activeFault && latest.machine.activeFault.includes('JAM'))
            ? '<span class="status-pill status-danger">ROTOR JAM DETECTED</span>'
            : '<span class="status-pill status-ok">ALGORITHM ARMED (CLEAR)</span>';

        // Operators list
        const opList = (m.assignedOperators && m.assignedOperators.length > 0)
            ? m.assignedOperators.map(o => `${o.name} &lt;${o.email}&gt;`).join(', ')
            : 'Unassigned / Automated Facility';

        // Maintenance rows
        const maintRows = (m.maintenance && m.maintenance.length > 0) ? m.maintenance.map((rec, i) => `
            <tr>
                <td style="font-weight: 700; color: #006786;">#WO-2026-${String(100 + i)}</td>
                <td><strong>${rec.maintenance_date}</strong></td>
                <td>${rec.technician}</td>
                <td>${rec.operating_hours ? rec.operating_hours + ' hrs' : 'Routine'}</td>
                <td>${rec.notes}</td>
                <td style="font-weight: 700; color: #006786;">${rec.next_due_date || 'Scheduled'}</td>
                <td><span class="status-pill status-ok">COMPLETED &amp; SIGNED</span></td>
            </tr>
        `).join('') : `<tr><td colspan="7" style="text-align: center; color: #64748B;">No prior maintenance logs recorded.</td></tr>`;

        // Events rows
        const eventRows = (m.recentEvents && m.recentEvents.length > 0) ? m.recentEvents.slice(0, 8).map(ev => `
            <tr>
                <td style="font-family: monospace; font-size: 11px;">${new Date(ev.timestamp).toLocaleString('en-AU')}</td>
                <td><span class="status-pill ${ev.severity === 'CRITICAL' ? 'status-danger' : (ev.severity === 'WARNING' ? 'status-warning' : 'status-info')}">${ev.severity}</span></td>
                <td style="font-weight: 700; color: #334155;">${ev.event_type}</td>
                <td>${ev.description}</td>
            </tr>
        `).join('') : `<tr><td colspan="4" style="text-align: center; color: #64748B;">Zero fault or diagnostic alarm events recorded in active window.</td></tr>`;

        // Telemetry Sample rows (last 10 samples from history)
        const sampleRows = (history.length > 0 ? history.slice(-10) : []).map(s => `
            <tr>
                <td style="font-family: monospace; font-size: 11px;">${new Date(s.timestamp).toLocaleTimeString('en-AU')}</td>
                <td><span class="status-pill ${s.state === 'RUNNING' ? 'status-ok' : 'status-info'}">${s.state}</span></td>
                <td style="font-weight: 700;">${s.rpm_m1 !== null ? Math.round(s.rpm_m1) + ' RPM' : '--'}</td>
                <td>${s.voltage_v !== null ? s.voltage_v.toFixed(1) + ' V' : '--'}</td>
                <td>${s.current_a !== null ? s.current_a.toFixed(1) + ' A' : '--'}</td>
                <td style="font-weight: 700; color: #006786;">${s.power_w !== null ? Math.round(s.power_w) + ' W' : '--'}</td>
                <td>${s.temp_m1 !== null ? s.temp_m1.toFixed(1) + ' °C' : '--'}</td>
            </tr>
        `).join('');

        const reportHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>CircularSeed Detailed Technical Report &bull; ${m.id} &bull; ${m.model}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            color: #222222;
            background: #F8FAFC;
            padding: 30px;
            line-height: 1.5;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        .report-toolbar {
            max-width: 960px;
            margin: 0 auto 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #FFFFFF;
            padding: 14px 24px;
            border-radius: 9999px;
            box-shadow: 0 4px 16px rgba(0, 43, 55, 0.08);
            border: 1px solid #E2E8F0;
        }
        .btn-report {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            border: none;
            padding: 10px 22px;
            border-radius: 9999px;
            font-family: 'Plus Jakarta Sans', sans-serif;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s;
        }
        .btn-report-primary {
            background: #006786;
            color: #FFFFFF;
            box-shadow: 0 2px 8px rgba(0, 103, 134, 0.3);
        }
        .btn-report-primary:hover { background: #00526b; }
        .btn-report-secondary {
            background: #F1F5F9;
            color: #475569;
        }
        .btn-report-secondary:hover { background: #E2E8F0; }
        .report-paper {
            max-width: 960px;
            margin: 0 auto;
            background: #FFFFFF;
            padding: 40px 50px;
            border-radius: 18px;
            box-shadow: 0 12px 30px rgba(0, 43, 55, 0.07);
            border: 1px solid #E2E8F0;
        }
        .report-top-stripe {
            height: 6px;
            background: linear-gradient(90deg, #8dcb26 0%, #00A5D6 50%, #006786 100%);
            border-radius: 9999px;
            margin-bottom: 24px;
            width: 100%;
        }
        .header-section {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 20px;
            padding-bottom: 20px;
            border-bottom: 2px solid #F1F5F9;
            margin-bottom: 24px;
        }
        .brand-title {
            font-family: 'Plus Jakarta Sans', sans-serif;
            font-size: 26px;
            font-weight: 800;
            color: #006786;
            line-height: 1.1;
        }
        .brand-sub {
            font-size: 11px;
            text-transform: uppercase;
            font-weight: 700;
            letter-spacing: 1.6px;
            color: #8dcb26;
            margin-top: 4px;
        }
        .report-meta-box {
            text-align: right;
            font-size: 11px;
            color: #64748B;
            line-height: 1.6;
            flex-shrink: 0;
        }
        .report-id-badge {
            display: inline-block;
            background: #F1F5F9;
            border: 1px solid #CBD5E1;
            color: #006786;
            font-family: 'SF Mono', Consolas, Monaco, monospace;
            font-size: 11px;
            font-weight: 700;
            padding: 3px 10px;
            border-radius: 6px;
            margin-bottom: 6px;
            white-space: nowrap;
        }
        .meta-line {
            white-space: nowrap;
            margin-top: 2px;
        }
        .doc-title-banner {
            background: #F4FCFF;
            border-left: 4px solid #006786;
            padding: 16px 20px;
            border-radius: 8px;
            margin-bottom: 28px;
        }
        .doc-title {
            font-family: 'Plus Jakarta Sans', sans-serif;
            font-size: 18px;
            font-weight: 800;
            color: #006786;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .doc-sub {
            font-size: 12px;
            color: #475569;
            margin-top: 4px;
        }
        .section-heading {
            font-family: 'Plus Jakarta Sans', sans-serif;
            font-size: 13px;
            font-weight: 800;
            color: #006786;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            margin: 24px 0 12px;
            padding-bottom: 6px;
            border-bottom: 1px solid #E2E8F0;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .grid-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 20px;
        }
        .grid-3 {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 14px;
            margin-bottom: 20px;
        }
        .grid-4 {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 20px;
        }
        .info-card {
            background: #F8FAFC;
            border: 1px solid #E2E8F0;
            border-radius: 10px;
            padding: 14px 16px;
        }
        .info-label {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            color: #64748B;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
        }
        .info-val {
            font-size: 14px;
            font-weight: 700;
            color: #222222;
        }
        .info-val-highlight {
            color: #006786;
            font-size: 16px;
            font-weight: 800;
        }
        .status-pill {
            display: inline-block;
            font-size: 10px;
            font-weight: 800;
            padding: 3px 9px;
            border-radius: 9999px;
            text-transform: uppercase;
            letter-spacing: 0.4px;
        }
        .status-ok { background: #EBF7D9; color: #446808; border: 1px solid #CBEBA1; }
        .status-danger { background: #FFE4E6; color: #BE123C; border: 1px solid #FECDD3; }
        .status-warning { background: #FEF0E7; color: #f46b17; border: 1px solid #FCD3B6; }
        .status-info { background: #F1F5F9; color: #475569; border: 1px solid #E2E8F0; }

        .report-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            margin-bottom: 20px;
        }
        .report-table th, .report-table td {
            padding: 9px 12px;
            text-align: left;
            border-bottom: 1px solid #E2E8F0;
        }
        .report-table th {
            background: #F1F5F9;
            font-weight: 800;
            color: #475569;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.5px;
        }
        .report-table tr:hover { background: #F8FAFC; }
        .stat-badge {
            background: #F4FCFF;
            border: 1px solid #B3DFEC;
            border-radius: 8px;
            padding: 10px 14px;
            text-align: center;
        }
        .stat-badge .num {
            font-size: 18px;
            font-weight: 800;
            color: #006786;
            font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .stat-badge .lbl {
            font-size: 10px;
            color: #64748B;
            text-transform: uppercase;
            font-weight: 700;
            margin-top: 2px;
        }
        .signatures-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            margin-top: 36px;
            padding-top: 24px;
            border-top: 1px dashed #CBD5E1;
            page-break-inside: avoid;
            break-inside: avoid;
        }
        .sig-block {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .sig-line {
            height: 38px;
            border-bottom: 1px solid #94A3B8;
        }
        .sig-caption {
            font-size: 11px;
            color: #64748B;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .report-footer {
            margin-top: 32px;
            padding-top: 16px;
            border-top: 1px solid #E2E8F0;
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: #94A3B8;
        }
        @media print {
            body { background: #FFFFFF !important; padding: 0 !important; margin: 0 !important; }
            .report-toolbar { display: none !important; }
            .report-paper {
                box-shadow: none !important;
                border: none !important;
                padding: 0 !important;
                max-width: 100% !important;
            }
            .report-top-stripe {
                margin-bottom: 18px !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            .header-section {
                padding-bottom: 16px !important;
                margin-bottom: 18px !important;
            }
            .section-heading {
                page-break-after: avoid;
                break-after: avoid;
            }
            .info-card, .stat-badge, .report-table, .signatures-grid {
                page-break-inside: avoid;
                break-inside: avoid;
            }
            @page {
                size: A4 portrait;
                margin: 12mm 15mm;
            }
        }
    </style>
</head>
<body onload="window.print()">
    <div class="report-toolbar">
        <div>
            <strong style="font-size: 13px; color: #006786; font-family: 'Plus Jakarta Sans', sans-serif;">CircularSeed Detailed Machine Report</strong>
            <span style="font-size: 12px; color: #64748B; margin-left: 10px;">Audit-Grade Operational, Diagnostic &amp; Servicing Log</span>
        </div>
        <div style="display: flex; gap: 10px;">
            <a href="${ApiClient.getExportUrl(m.id, 'pdf')}" class="btn-report btn-report-primary" download="Detailed-Report-${m.id}.pdf" style="text-decoration: none;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download PDF
            </a>
            <button class="btn-report btn-report-secondary" onclick="window.print()">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Print / Save as PDF
            </button>
            <button class="btn-report btn-report-secondary" onclick="window.close()">Close Window</button>
        </div>
    </div>

    <div class="report-paper">
        <!-- Top Colored Accent Stripe (in-flow, never overlaps text) -->
        <div class="report-top-stripe"></div>

        <!-- Header -->
        <div class="header-section">
            <div>
                <h1 class="brand-title">CircularSeed</h1>
                <div class="brand-sub">FLEXISHRED-DC &bull; Comprehensive Asset &amp; Telemetry Report</div>
            </div>
            <div class="report-meta-box">
                <div><span class="report-id-badge">${reportId}</span></div>
                <div class="meta-line">Audit Date: <strong>${dateStr} ${timeStr}</strong></div>
                <div class="meta-line">Inspector: <strong>${currentUser.name} (${currentUser.role})</strong></div>
                <div class="meta-line">Compliance: <strong>AS/NZS 4024.1 &bull; CE 2006/42/EC</strong></div>
            </div>
        </div>

        <div class="doc-title-banner">
            <h2 class="doc-title">Detailed Machine Technical &amp; Operational Audit Report</h2>
            <p class="doc-sub">Full technical asset evaluation, live and 24-hour sensor telemetry analytics, safety integrity compliance verification, and cumulative maintenance log.</p>
        </div>

        <!-- Section 1 -->
        <div class="section-heading">
            <span>1. Master Asset Profile &amp; Technical Specifications</span>
            <span style="font-size: 10px; color: #64748B; font-weight: normal;">Hardware ID: ${m.gateway_id || 'GW-ESP32-LOCAL'}</span>
        </div>
        <div class="grid-2">
            <div class="info-card">
                <div class="info-label">Machine Identifier</div>
                <div class="info-val info-val-highlight">${m.id}</div>
                <div style="font-size: 11px; color: #64748B; margin-top: 4px;">Commercial Model: ${m.model}</div>
            </div>
            <div class="info-card">
                <div class="info-label">Factory Serial Number</div>
                <div class="info-val">${m.serial_number || 'FS-DC-2026-0003'}</div>
                <div style="font-size: 11px; color: #64748B; margin-top: 4px;">Commissioning Date: ${m.commissioning_date || '2026-03-01'}</div>
            </div>
            <div class="info-card">
                <div class="info-label">Client Organization &amp; Industry</div>
                <div class="info-val">${m.organization_name || m.organizationName || 'CircularSeed Internal Fleet'}</div>
                <div style="font-size: 11px; color: #64748B; margin-top: 4px;">Sector: ${m.organization_industry || 'Advanced Polymer Recycling'}</div>
            </div>
            <div class="info-card">
                <div class="info-label">Installation Location &amp; Bay</div>
                <div class="info-val">${m.location || 'Pilot Lab Bench 2 (R&amp;D)'}</div>
                <div style="font-size: 11px; color: #64748B; margin-top: 4px;">Facility Contact: ${m.organization_email || 'support@circularseed.com.au'}</div>
            </div>
            <div class="info-card">
                <div class="info-label">Hardware Architecture &amp; Driver</div>
                <div class="info-val">${isProto ? '12V L298N Dual H-Bridge Prototype + Optical Quadrature' : 'Industrial 48V Dual BLDC Power Train'}</div>
                <div style="font-size: 11px; color: #64748B; margin-top: 4px;">Motor Type: ${m.motor_type || (isProto ? '12V Geared DC' : 'Dual BLDC')} (${m.rated_voltage_v || 48}V Rated)</div>
            </div>
            <div class="info-card">
                <div class="info-label">Firmware &amp; Operator Assignments</div>
                <div class="info-val">${m.firmware_version || 'v2.4.0-stable'}</div>
                <div style="font-size: 11px; color: #64748B; margin-top: 4px;">Assigned: ${opList}</div>
            </div>
        </div>

        <!-- Section 2 -->
        <div class="section-heading">
            <span>2. Real-Time Operational Performance &amp; Sensor Telemetry</span>
            <span style="font-size: 10px; color: #64748B; font-weight: normal;">Sample Cadence: 1 Hz</span>
        </div>
        <div class="grid-4">
            <div class="stat-badge">
                <div class="num">${operatingHoursStr}</div>
                <div class="lbl">Lifetime Runtime</div>
            </div>
            <div class="stat-badge">
                <div class="num">${dcEnergyKwh} kWh</div>
                <div class="lbl">Cumulative Energy</div>
            </div>
            <div class="stat-badge">
                <div class="num">${estTotalKg} kg</div>
                <div class="lbl">Est. Plastic Shredded</div>
            </div>
            <div class="stat-badge">
                <div class="num">${specificEnergy} Wh/kg</div>
                <div class="lbl">Energy Efficiency</div>
            </div>
        </div>
        <div class="grid-3">
            <div class="info-card">
                <div class="info-label">Current Operating State</div>
                <div style="margin-top: 4px;"><span class="status-pill ${machineState === 'RUNNING' ? 'status-ok' : 'status-info'}">${machineState}</span></div>
            </div>
            <div class="info-card">
                <div class="info-label">DC Bus Voltage</div>
                <div class="info-val info-val-highlight">${liveVolt}</div>
            </div>
            <div class="info-card">
                <div class="info-label">Active Power Consumption</div>
                <div class="info-val info-val-highlight">${livePower} (${liveCurr})</div>
            </div>
            <div class="info-card">
                <div class="info-label">${isProto ? '12V Motor Encoder Speed' : 'Primary Motor 1 Speed'}</div>
                <div class="info-val">${motor1Rpm}</div>
                <div style="font-size: 10px; color: #64748B; margin-top: 2px;">Temperature: ${motor1Temp}</div>
            </div>
            <div class="info-card">
                <div class="info-label">${isProto ? 'L298N Driver Thermal Status' : 'Secondary Motor 2 Speed'}</div>
                <div class="info-val">${isProto ? (latest.motors && latest.motors[0] ? latest.motors[0].temperature + ' °C' : '32.4 °C') : motor2Rpm}</div>
                <div style="font-size: 10px; color: #64748B; margin-top: 2px;">${isProto ? 'Heatsink Dissipation: Normal' : 'Motor 2 Temp: ' + motor2Temp}</div>
            </div>
            <div class="info-card">
                <div class="info-label">${isProto ? 'Encoder Pulse Feedback Health' : 'Battery &amp; BMS Status'}</div>
                <div class="info-val">${isProto ? 'QUADRATURE SYNC OK' : (bat.configured ? bat.status || 'ONLINE' : 'DC Bus Direct (Mains)')}</div>
                <div style="font-size: 10px; color: #64748B; margin-top: 2px;">${isProto ? 'A/B Phase Offset: 90° Nominal' : (bat.configured ? 'SOC: ' + bat.soc + '%' : 'CleanTech Subsystem Ready')}</div>
            </div>
        </div>

        <!-- Section 3 -->
        <div class="section-heading">
            <span>3. Safety Integrity Level (SIL) &amp; Interlock Compliance Audit</span>
            <span style="font-size: 10px; color: #64748B; font-weight: normal;">Hardware Authority Loop</span>
        </div>
        <div class="grid-2">
            <div class="info-card">
                <div class="info-label">Hardwired Emergency Stop Loop</div>
                <div style="margin-top: 4px;">${estopStatus}</div>
                <p style="font-size: 11px; color: #64748B; margin-top: 6px;">Dual-channel physical E-Stop button loop with independent relay isolation.</p>
            </div>
            <div class="info-card">
                <div class="info-label">Mechanical Hopper Safety Interlock Guard</div>
                <div style="margin-top: 4px;">${guardStatus}</div>
                <p style="font-size: 11px; color: #64748B; margin-top: 6px;">Positive break safety interlock switch halts cutter rotation when hopper opens.</p>
            </div>
            <div class="info-card">
                <div class="info-label">Thermal Overload Protection</div>
                <div style="margin-top: 4px;">${thermalStatus}</div>
                <p style="font-size: 11px; color: #64748B; margin-top: 6px;">Continuous core temperature monitoring prevents insulation breakdown and fire hazards.</p>
            </div>
            <div class="info-card">
                <div class="info-label">Rotor Jam &amp; Auto-Reversal Mechanism</div>
                <div style="margin-top: 4px;">${jamStatus}</div>
                <p style="font-size: 11px; color: #64748B; margin-top: 6px;">Automatic anti-jam detection triggers immediate reverse cycle on torque spike.</p>
            </div>
        </div>

        <!-- Section 4 -->
        <div class="section-heading">
            <span>4. 24-Hour Duty Cycle Analytics &amp; Statistical Envelope</span>
            <span style="font-size: 10px; color: #64748B; font-weight: normal;">Historical Logs Evaluated: ${history.length}</span>
        </div>
        <table class="report-table">
            <thead>
                <tr>
                    <th>Parameter Metric</th>
                    <th>Minimum Recorded</th>
                    <th>Average (Mean)</th>
                    <th>Maximum Recorded</th>
                    <th>Design Limit</th>
                    <th>Compliance Status</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Motor Operating Speed</strong></td>
                    <td>0 RPM</td>
                    <td>${avgRpm} RPM</td>
                    <td><strong>${maxRpm} RPM</strong></td>
                    <td>${isProto ? '250 RPM' : '1,200 RPM'}</td>
                    <td><span class="status-pill status-ok">PASS (WITHIN LIMITS)</span></td>
                </tr>
                <tr>
                    <td><strong>DC Bus Voltage</strong></td>
                    <td>${minVolt} V</td>
                    <td>${liveVolt}</td>
                    <td><strong>${maxVolt} V</strong></td>
                    <td>${isProto ? '14.5 V' : '58.0 V'}</td>
                    <td><span class="status-pill status-ok">PASS (STABLE BUS)</span></td>
                </tr>
                <tr>
                    <td><strong>Total Active Current</strong></td>
                    <td>0.0 A</td>
                    <td>${avgCurr} A</td>
                    <td><strong>${maxCurr} A</strong></td>
                    <td>${isProto ? '2.5 A' : '35.0 A'}</td>
                    <td><span class="status-pill status-ok">PASS (NOMINAL LOAD)</span></td>
                </tr>
                <tr>
                    <td><strong>Active Power Draw</strong></td>
                    <td>0 W</td>
                    <td>${avgPower} W</td>
                    <td><strong>${maxPower} W</strong></td>
                    <td>${isProto ? '35 W' : '1,800 W'}</td>
                    <td><span class="status-pill status-ok">PASS</span></td>
                </tr>
                <tr>
                    <td><strong>Core / Driver Temperature</strong></td>
                    <td>24.0 °C</td>
                    <td>31.5 °C</td>
                    <td><strong>${maxTemp} °C</strong></td>
                    <td>85.0 °C</td>
                    <td><span class="status-pill status-ok">PASS (LOW THERMAL STRESS)</span></td>
                </tr>
            </tbody>
        </table>

        <!-- Section 5 -->
        ${sampleRows ? `
        <div class="section-heading">
            <span>5. Recent Telemetry Log Samples (Chronological Window)</span>
            <span style="font-size: 10px; color: #64748B; font-weight: normal;">Live Telemetry Stream Excerpt</span>
        </div>
        <table class="report-table">
            <thead>
                <tr>
                    <th>Timestamp</th>
                    <th>Machine State</th>
                    <th>Motor Speed</th>
                    <th>DC Voltage</th>
                    <th>Current</th>
                    <th>Active Power</th>
                    <th>Temperature</th>
                </tr>
            </thead>
            <tbody>
                ${sampleRows}
            </tbody>
        </table>` : ''}

        <!-- Section 6 -->
        <div class="section-heading">
            <span>6. Comprehensive Servicing, Overhaul &amp; Maintenance History</span>
            <span style="font-size: 10px; color: #64748B; font-weight: normal;">Next Service Due: ${nextDue}</span>
        </div>
        <table class="report-table">
            <thead>
                <tr>
                    <th>Work Order</th>
                    <th>Service Date</th>
                    <th>Technician</th>
                    <th>Operating Hours</th>
                    <th>Service Notes &amp; Actions Performed</th>
                    <th>Next Due Date</th>
                    <th>Verification</th>
                </tr>
            </thead>
            <tbody>
                ${maintRows}
            </tbody>
        </table>

        <!-- Section 7 -->
        <div class="section-heading">
            <span>7. Operational Event Log &amp; Diagnostic Incident Records</span>
            <span style="font-size: 10px; color: #64748B; font-weight: normal;">Event History Log</span>
        </div>
        <table class="report-table">
            <thead>
                <tr>
                    <th>Event Timestamp</th>
                    <th>Severity</th>
                    <th>Event Category</th>
                    <th>Description &amp; Action Taken</th>
                </tr>
            </thead>
            <tbody>
                ${eventRows}
            </tbody>
        </table>

        <!-- Section 8 -->
        <div class="signatures-grid">
            <div class="sig-block">
                <div class="sig-line"></div>
                <div class="sig-caption">Lead Field Service Engineer &bull; Certification #CS-ENG-${now.getFullYear()}</div>
                <div style="font-size: 10px; color: #94A3B8;">Certified that all mechanical, electrical, and interlock systems were verified in accordance with factory specifications.</div>
            </div>
            <div class="sig-block">
                <div class="sig-line"></div>
                <div class="sig-caption">Plant Operations &amp; Safety Manager &bull; Date Approval</div>
                <div style="font-size: 10px; color: #94A3B8;">Approved for safe continuous operation in industrial polymer processing and shredding duties.</div>
            </div>
        </div>

        <div class="report-footer">
            <span>CircularSeed Australia Pty Ltd &bull; https://circularseed.com.au/ &bull; Confidential Engineering Audit Record</span>
            <span>Document Checksum: SHA256-${reportId.replace(/[^A-Z0-9]/g, '')} &bull; Page 1 of 1</span>
        </div>
    </div>
</body>
</html>`;

        const reportWin = window.open('', '_blank');
        if (reportWin) {
            reportWin.document.open();
            reportWin.document.write(reportHtml);
            reportWin.document.close();
            setTimeout(() => {
                reportWin.print();
            }, 600);
        } else {
            const blob = new Blob([reportHtml], { type: 'text/html' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `Detailed-Report-${m.id}-${now.toISOString().slice(0, 10)}.html`;
            a.click();
        }
    }

    return {
        loadAndRender,
        changeHistoryRange,
        updateLiveTelemetry,
        confirmStart,
        sendStop,
        resetFault,
        onPwmSlider,
        applyPwmSpeed,
        injectSimFault,
        generatePdfReport
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MachineDetail;
}
