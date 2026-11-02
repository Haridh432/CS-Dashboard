/**
 * Machine Router
 * REST API routes for machine listing, fleet statistics, details, history, commands, and exports.
 */

const express = require('express');
const router = express.Router();
const machineService = require('./machineService');
const telemetryEngine = require('../telemetry/telemetryEngine');
const { authenticateToken, authorizeMachineAccess, requireRole } = require('../auth/authMiddleware');
const reportGenerator = require('./reportGenerator');
const pdfGenerator = require('./pdfGenerator');

router.use(authenticateToken);

/**
 * GET /api/machines
 * Returns machines accessible to the authenticated user.
 */
router.get('/', (req, res) => {
    try {
        const machines = machineService.getMachinesForUser(req.user);
        res.json({ success: true, count: machines.length, machines });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/machines/organizations
 * Returns organizations list (CEO sees all; Customer sees their own organization).
 */
router.get('/organizations', requireRole('CEO', 'CUSTOMER'), (req, res) => {
    try {
        const allOrgs = machineService.getAllOrganizations();
        if (req.user.role === 'CEO') {
            return res.json({ success: true, organizations: allOrgs });
        } else {
            const org = allOrgs.filter(o => o.id === req.user.organizationId);
            return res.json({ success: true, organizations: org });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/machines
 * Registers a new machine. Allowed ONLY for CEO and Customer roles.
 */
router.post('/', requireRole('CEO', 'CUSTOMER'), (req, res) => {
    try {
        const machine = machineService.createMachine(req.body, req.user);
        telemetryEngine.registerMachine(machine);
        res.status(201).json({
            success: true,
            message: `Machine ${machine.id} successfully created.`,
            machine
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/machines/summary
 * Returns fleet-level summary (CEO) or organization summary (Customer).
 */
router.get('/summary', (req, res) => {
    try {
        if (req.user.role === 'CEO') {
            const summary = machineService.getCeoFleetSummary();
            return res.json({ success: true, role: 'CEO', summary });
        } else if (req.user.role === 'CUSTOMER') {
            const summary = machineService.getCustomerSummary(req.user.organizationId);
            return res.json({ success: true, role: 'CUSTOMER', summary });
        } else {
            // Operator summary: assigned count
            const machines = machineService.getMachinesForUser(req.user);
            return res.json({
                success: true,
                role: 'OPERATOR',
                summary: {
                    assignedCount: machines.length,
                    machines: machines.map(m => ({ id: m.id, model: m.model, state: m.state }))
                }
            });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/machines/:machineId
 * Returns complete detailed view for a single machine.
 */
router.get('/:machineId', authorizeMachineAccess, (req, res) => {
    try {
        const detail = machineService.getMachineDetail(req.params.machineId);
        if (!detail) {
            return res.status(404).json({ success: false, error: 'Machine not found.' });
        }
        res.json({ success: true, machine: detail });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/machines/:machineId/history
 * Returns historical sensor readings for charts.
 */
router.get('/:machineId/history', authorizeMachineAccess, (req, res) => {
    try {
        const range = req.query.range || '24h';
        const history = machineService.getMachineHistory(req.params.machineId, range);
        res.json({ success: true, range, count: history.length, history });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/machines/:machineId/events
 * Returns safety and operational events.
 */
router.get('/:machineId/events', authorizeMachineAccess, (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 20;
        const detail = machineService.getMachineDetail(req.params.machineId);
        res.json({ success: true, events: detail.recentEvents.slice(0, limit) });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/machines/:machineId/maintenance
 * Returns recorded maintenance and upcoming schedule.
 */
router.get('/:machineId/maintenance', authorizeMachineAccess, (req, res) => {
    try {
        const detail = machineService.getMachineDetail(req.params.machineId);
        res.json({ success: true, maintenance: detail.maintenance });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/machines/:machineId/command
 * Executes operational control command (START, STOP, RESET_FAULT, SET_SPEED).
 * Authorized ONLY for CEO and assigned OPERATOR. Customer rejected.
 */
router.post('/:machineId/command', authorizeMachineAccess, (req, res) => {
    try {
        if (req.user.role === 'CUSTOMER') {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: Customers have monitoring permissions only and cannot issue machine commands.'
            });
        }

        const { action, params } = req.body;
        if (!action) {
            return res.status(400).json({ success: false, error: 'Command action is required.' });
        }

        const result = telemetryEngine.handleCommand(req.params.machineId, req.user, action, params);
        if (!result.accepted) {
            return res.status(400).json({ success: false, error: result.error });
        }

        res.json({
            success: true,
            status: result.status,
            message: result.message,
            machineId: req.params.machineId
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/machines/:machineId/inject-fault
 * Interactive fault injection for sandbox testing (CEO and Operator only).
 */
router.post('/:machineId/inject-fault', authorizeMachineAccess, (req, res) => {
    try {
        if (req.user.role === 'CUSTOMER') {
            return res.status(403).json({ success: false, error: 'Customers cannot inject simulated faults.' });
        }
        const { faultType, value } = req.body;
        telemetryEngine.injectFault(req.params.machineId, faultType, value);
        res.json({ success: true, message: `Injected ${faultType}` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/machines/:machineId/export
 * Exports machine data as CSV or JSON.
 */
router.get('/:machineId/export', authorizeMachineAccess, (req, res) => {
    try {
        const format = req.query.format || 'json';
        const range = req.query.range || 'all';
        const history = machineService.getMachineHistory(req.params.machineId, range);
        const detail = machineService.getMachineDetail(req.params.machineId);

        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${req.params.machineId}-telemetry.csv"`);

            let csv = 'timestamp,state,voltage_v,current_a,power_w,energy_wh,rpm_m1,rpm_m2,temp_m1,temp_m2,estop,guard\n';
            for (const row of history) {
                csv += `"${row.timestamp}","${row.state}",${row.voltage_v || ''},${row.current_a || ''},${row.power_w || ''},${row.energy_wh || ''},${row.rpm_m1 || ''},${row.rpm_m2 || ''},${row.temp_m1 || ''},${row.temp_m2 || ''},${row.estop_active},${row.guard_closed}\n`;
            }
            return res.send(csv);
        }

        const now = new Date();
        const dateTag = now.toISOString().slice(0, 10);

        if (format === 'pdf') {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="Detailed-Report-${detail.id}-${dateTag}.pdf"`);
            const pdfDoc = pdfGenerator.buildDetailedPdf(detail, history, req.user);
            return pdfDoc.pipe(res);
        }

        if (format === 'html' || format === 'report') {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            const reportHtml = reportGenerator.generateDetailedReportHtml(detail, history, req.user);
            return res.send(reportHtml);
        }

        res.json({
            success: true,
            machineId: req.params.machineId,
            model: detail.model,
            exportedAt: new Date().toISOString(),
            recordsCount: history.length,
            history,
            maintenance: detail.maintenance
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * DELETE /api/machines/:machineId
 * Deletes a machine. Allowed ONLY for CEO and Customer within their organization.
 */
router.delete('/:machineId', requireRole('CEO', 'CUSTOMER'), authorizeMachineAccess, (req, res) => {
    try {
        const machine = machineService.deleteMachine(req.params.machineId, req.user);
        telemetryEngine.unregisterMachine(req.params.machineId);
        res.json({
            success: true,
            message: `Machine ${req.params.machineId} (${machine.model}) successfully removed.`,
            machineId: req.params.machineId
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

module.exports = router;
