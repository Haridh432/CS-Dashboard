/**
 * TelemetryChart Component
 * Pure SVG interactive time-series chart component for RPM, Voltage/Current, and Power.
 * Implements empty-state handling and time-range selection.
 */

const TelemetryChart = (() => {
    function formatTimeLabel(isoString) {
        if (!isoString) return '';
        const d = new Date(isoString);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    /**
     * Render an SVG line chart
     * data: array of objects { timestamp, value1, value2 }
     */
    function renderLineChart(containerId, data, seriesConfig, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="chart-empty-state">
                    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <p>No historical telemetry recorded for the selected time range.</p>
                </div>
            `;
            return;
        }

        const width = options.width || 700;
        const height = options.height || 220;
        const padding = { top: 20, right: 30, bottom: 35, left: 55 };

        const chartW = width - padding.left - padding.right;
        const chartH = height - padding.top - padding.bottom;

        // Calculate min & max values across active series
        let minY = Infinity;
        let maxY = -Infinity;

        seriesConfig.forEach(s => {
            data.forEach(d => {
                const val = d[s.key];
                if (typeof val === 'number') {
                    if (val < minY) minY = val;
                    if (val > maxY) maxY = val;
                }
            });
        });

        if (minY === Infinity) {
            minY = 0;
            maxY = 100;
        } else {
            // Add slight headroom
            const margin = (maxY - minY) * 0.1 || 5;
            minY = Math.max(0, Math.floor(minY - margin));
            maxY = Math.ceil(maxY + margin);
        }

        const n = data.length;
        const getX = (idx) => padding.left + (idx / Math.max(1, n - 1)) * chartW;
        const getY = (val) => padding.top + chartH - ((val - minY) / Math.max(1, (maxY - minY))) * chartH;

        // Horizontal Gridlines
        const gridSteps = 4;
        let gridLinesSvg = '';
        for (let i = 0; i <= gridSteps; i++) {
            const yVal = minY + (i / gridSteps) * (maxY - minY);
            const yPos = getY(yVal);
            gridLinesSvg += `
                <line x1="${padding.left}" y1="${yPos}" x2="${width - padding.right}" y2="${yPos}" stroke="#E2E8F0" stroke-dasharray="3,3" stroke-width="1"/>
                <text x="${padding.left - 8}" y="${yPos + 4}" text-anchor="end" fill="#94A3B8" font-size="10" font-family="Inter, sans-serif">${Math.round(yVal)}${options.unit ? ' ' + options.unit : ''}</text>
            `;
        }

        // Time axis labels (up to 6 labels)
        let timeLabelsSvg = '';
        const labelInterval = Math.max(1, Math.floor(n / 5));
        for (let i = 0; i < n; i += labelInterval) {
            const xPos = getX(i);
            const label = formatTimeLabel(data[i].timestamp);
            timeLabelsSvg += `
                <text x="${xPos}" y="${height - 10}" text-anchor="middle" fill="#94A3B8" font-size="10" font-family="Inter, sans-serif">${label}</text>
            `;
        }

        // Draw Series Paths
        let seriesSvg = '';
        let dotsSvg = '';

        seriesConfig.forEach(s => {
            const points = [];
            data.forEach((d, idx) => {
                const val = d[s.key];
                if (typeof val === 'number') {
                    const x = getX(idx);
                    const y = getY(val);
                    points.push(`${x},${y}`);
                    // Interactive dots on hover
                    dotsSvg += `
                        <circle cx="${x}" cy="${y}" r="3" fill="${s.color}" class="chart-dot" data-val="${val}" data-time="${data[idx].timestamp}" data-series="${s.name}"/>
                    `;
                }
            });

            if (points.length > 1) {
                const pathD = `M ` + points.join(' L ');
                seriesSvg += `
                    <path d="${pathD}" fill="none" stroke="${s.color}" stroke-width="${s.width || 2}" stroke-linecap="round" stroke-linejoin="round"/>
                `;
            }
        });

        // Legends
        let legendSvg = '';
        let legendX = padding.left;
        seriesConfig.forEach(s => {
            legendSvg += `
                <rect x="${legendX}" y="6" width="10" height="10" rx="2" fill="${s.color}"/>
                <text x="${legendX + 15}" y="15" fill="#475569" font-size="11" font-weight="600" font-family="Inter, sans-serif">${s.name}</text>
            `;
            legendX += s.name.length * 7 + 45;
        });

        const svgHtml = `
            <svg class="telemetry-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="width: 100%; height: 100%;">
                ${gridLinesSvg}
                ${timeLabelsSvg}
                ${seriesSvg}
                ${dotsSvg}
                ${legendSvg}
            </svg>
        `;

        container.innerHTML = svgHtml;
    }

    return { renderLineChart };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TelemetryChart;
}
