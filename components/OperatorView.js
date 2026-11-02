/**
 * OperatorView Component
 * Implements Section 6: Current Operating Machine view, machine selector when multiple assigned,
 * hero operational telemetry, and safe operator machine controls.
 */

const OperatorView = (() => {
    let assignedMachines = [];
    let selectedMachineId = null;

    function render(container, data) {
        if (!container) return;
        assignedMachines = data.machines || [];

        if (assignedMachines.length === 0) {
            container.innerHTML = `
                <div class="empty-filter-state">
                    <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <h3>No Machines Assigned</h3>
                    <p>Your operator account currently has no machines assigned. Please contact your system administrator.</p>
                </div>
            `;
            return;
        }

        // Section 6: If an operator is assigned to 1 machine, open its detailed dashboard directly!
        if (assignedMachines.length === 1 && !selectedMachineId) {
            selectedMachineId = assignedMachines[0].id;
            App.navigateToMachine(selectedMachineId);
            return;
        }

        // If not set yet, pick the first machine
        if (!selectedMachineId || !assignedMachines.find(m => m.id === selectedMachineId)) {
            selectedMachineId = assignedMachines[0].id;
        }

        // Multi-machine selector bar
        const selectorHtml = `
            <div class="operator-selector-bar">
                <span class="selector-label">Select Operating Machine:</span>
                <div class="operator-machine-chips">
                    ${assignedMachines.map(m => `
                        <button class="op-chip ${m.id === selectedMachineId ? 'active' : ''}" onclick="OperatorView.selectMachine('${m.id}')">
                            <span class="chip-id">${m.id}</span>
                            <span class="chip-model">${m.model}</span>
                            ${StatusBadge.render(m.state, { small: true })}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;

        container.innerHTML = `
            <div class="operator-view-container">
                ${selectorHtml}
                <div id="operator-active-machine-mount">
                    <!-- MachineDetail mounted here -->
                </div>
            </div>
        `;

        // Render the active machine detail into the mount point
        const mount = document.getElementById('operator-active-machine-mount');
        if (mount) {
            MachineDetail.loadAndRender(mount, selectedMachineId, { isOperatorView: true });
        }
    }

    function selectMachine(machineId) {
        selectedMachineId = machineId;
        const mount = document.getElementById('operator-active-machine-mount');
        if (mount) {
            // Update chip active classes
            document.querySelectorAll('.op-chip').forEach(c => {
                const isCur = c.querySelector('.chip-id') && c.querySelector('.chip-id').textContent.trim() === machineId;
                c.classList.toggle('active', isCur);
            });
            MachineDetail.loadAndRender(mount, machineId, { isOperatorView: true });
        }
    }

    return {
        render,
        selectMachine,
        getSelectedMachineId: () => selectedMachineId
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = OperatorView;
}
