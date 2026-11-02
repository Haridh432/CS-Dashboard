/**
 * MachineCard Component
 * Minimal responsive card for fleet and customer grid views.
 */

const MachineCard = (() => {
    function formatTimeAgo(isoString) {
        if (!isoString) return 'No data';
        const diffMs = Date.now() - new Date(isoString).getTime();
        const diffSec = Math.floor(diffMs / 1000);
        if (diffSec < 5) return 'Just now';
        if (diffSec < 60) return `${diffSec}s ago`;
        const diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60) return `${diffMin}m ago`;
        const diffHr = Math.floor(diffMin / 60);
        return `${diffHr}h ago`;
    }

    function render(m) {
        const live = m.live || {};
        const state = (live.isOffline ? 'OFFLINE' : (m.state || 'READY')).toUpperCase();
        const statusBadgeHtml = StatusBadge.render(state, { small: true });

        // Metric values (explicit fallback, no fabricated zeroes)
        const rpmVal = (live.rpm !== null && live.rpm !== undefined) ? `${Math.round(live.rpm)}` : 'N/A';
        const voltVal = (live.voltage !== null && live.voltage !== undefined) ? `${live.voltage.toFixed(1)} V` : 'N/A';
        const powerVal = (live.power !== null && live.power !== undefined) ? `${Math.round(live.power)} W` : 'N/A';

        const lastSeenText = formatTimeAgo(live.lastUpdate);

        let activeAlertHtml = '';
        if (live.activeFault) {
            activeAlertHtml = `
                <div class="card-fault-indicator" title="${live.activeFault}">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <span>${live.activeFault}</span>
                </div>
            `;
        } else if (live.isStale && state !== 'OFFLINE') {
            activeAlertHtml = `
                <div class="card-stale-indicator" title="Telemetry delayed > 3 seconds">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <span>STALE DATA</span>
                </div>
            `;
        }

        // Tag indicating hardware prototype vs standard
        const isPrototype = m.hardwareType === 'PROTOTYPE_12V_L298N';
        const protoTag = isPrototype ? `<span class="badge-proto" title="Small 12V DC encoder motor prototype with L298N driver">12V L298N</span>` : '';

        const currentUser = (typeof App !== 'undefined' && App.getCurrentUser) ? App.getCurrentUser() : null;
        const canManage = currentUser && (currentUser.role === 'CEO' || currentUser.role === 'CUSTOMER');

        const deleteBtnHtml = canManage ? `
            <button class="card-delete-btn" title="Remove Machine ${m.id}" onclick="event.stopPropagation(); App.confirmDeleteMachine('${m.id}', '${(m.model || '').replace(/'/g, "\\'")}')">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
            </button>
        ` : '';

        return `
            <div class="machine-card" id="card-${m.id}" data-machine-id="${m.id}" onclick="App.navigateToMachine('${m.id}')">
                <div class="machine-card-header">
                    <div class="machine-card-id-wrap">
                        <span class="machine-card-id">${m.id}</span>
                        ${protoTag}
                    </div>
                    <div class="machine-card-status">
                        ${statusBadgeHtml}
                        ${deleteBtnHtml}
                    </div>
                </div>

                <div class="machine-card-title">${m.model}</div>

                <div class="machine-card-meta">
                    <div class="meta-row">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        <span class="meta-org" title="${m.organizationName || ''}">${m.organizationName || 'Internal Fleet'}</span>
                    </div>
                    <div class="meta-row">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        <span class="meta-loc" title="${m.location || ''}">${m.location || 'Location Unassigned'}</span>
                    </div>
                </div>

                ${activeAlertHtml}

                <div class="machine-card-metrics">
                    <div class="metric-cell">
                        <span class="metric-label">Motor RPM</span>
                        <span class="metric-value ${rpmVal !== 'N/A' && parseInt(rpmVal) > 0 ? 'metric-active' : ''}">${rpmVal}</span>
                    </div>
                    <div class="metric-cell">
                        <span class="metric-label">DC Bus</span>
                        <span class="metric-value">${voltVal}</span>
                    </div>
                    <div class="metric-cell">
                        <span class="metric-label">Power</span>
                        <span class="metric-value ${powerVal !== 'N/A' && parseInt(powerVal) > 0 ? 'metric-active' : ''}">${powerVal}</span>
                    </div>
                </div>

                <div class="machine-card-footer">
                    <div class="footer-time">
                        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        <span>${lastSeenText}</span>
                    </div>
                    <span class="card-view-link">Open Dashboard &rarr;</span>
                </div>
            </div>
        `;
    }

    return { render, formatTimeAgo };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MachineCard;
}
