/**
 * Telemetry Ingestion Router
 * Receives verified hardware telemetry packets from ESP32 gateways.
 */

const express = require('express');
const router = express.Router();
const telemetryEngine = require('./telemetryEngine');
const machineService = require('../machines/machineService');
const db = require('../database/db');

/**
 * POST /api/telemetry/ingest
 * Ingests live telemetry from an ESP32 hardware gateway.
 */
router.post('/ingest', (req, res) => {
    try {
        const { machineId, gatewayId, packet } = req.body;

        if (!machineId || !packet) {
            return res.status(400).json({ success: false, error: 'machineId and packet are required.' });
        }

        // Verify machine existence and gateway matching
        const machine = db.get('SELECT * FROM machines WHERE id = ?', [machineId]);
        if (!machine) {
            return res.status(404).json({ success: false, error: `Machine ${machineId} is not registered.` });
        }

        if (gatewayId && machine.gateway_id && machine.gateway_id !== gatewayId) {
            return res.status(403).json({ success: false, error: 'Gateway ID does not match registered machine.' });
        }

        // Update live state in telemetry engine
        telemetryEngine.injectFault(machineId, 'INGEST_REAL_HARDWARE', packet);

        res.json({ success: true, machineId, status: 'RECEIVED' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
