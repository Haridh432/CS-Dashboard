/**
 * StatusBadge Component
 * Semantic status labels and icons alongside colours per Section 3.
 * Do not use colour alone to convey safety status.
 */

const StatusBadge = (() => {
    const ICONS = {
        RUNNING: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
        READY: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        STOPPED: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>',
        FAULT: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
        OFFLINE: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.58 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/></svg>',
        LIVE: '<svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg>',
        DEMO: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
        STALE: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
    };

    function render(state, options = {}) {
        const s = (state || 'OFFLINE').toUpperCase();
        const icon = ICONS[s] || '';
        let className = 'badge-state ';

        switch (s) {
            case 'RUNNING':
                className += 'badge-running'; // Green #2E7D32
                break;
            case 'READY':
                className += 'badge-ready'; // Subtle green/neutral
                break;
            case 'STOPPED':
                className += 'badge-stopped'; // Slate / Graphite #263238
                break;
            case 'FAULT':
                className += 'badge-fault'; // Red #C62828
                break;
            case 'OFFLINE':
                className += 'badge-offline'; // Muted grey
                break;
            case 'STALE':
                className += 'badge-stale'; // Amber #F59E0B
                break;
            case 'LIVE':
                className += 'badge-live';
                break;
            case 'DEMO':
                className += 'badge-demo';
                break;
            default:
                className += 'badge-offline';
        }

        if (options.small) className += ' badge-sm';
        const label = options.label || s;

        return `<span class="${className}" title="Status: ${label}">
            <span class="badge-icon">${icon}</span>
            <span class="badge-text">${label}</span>
        </span>`;
    }

    return { render, ICONS };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = StatusBadge;
}
