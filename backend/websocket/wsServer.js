/**
 * WebSocket Server
 * Real-time bidirectional telemetry streaming and command execution
 * with server-side JWT authentication and strict tenant authorization.
 */

const { WebSocketServer } = require('ws');
const url = require('url');
const authService = require('../auth/authService');
const machineService = require('../machines/machineService');
const telemetryEngine = require('../telemetry/telemetryEngine');
const db = require('../database/db');

function setupWebSocketServer(httpServer) {
    const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

    console.log('[WebSocketServer] Initialized on path /ws');

    // Subscribe to machine telemetry broadcasts
    machineService.subscribe((machineId, packet) => {
        broadcastTelemetry(machineId, packet);
    });

    function canUserAccessMachine(user, machineId) {
        if (!user) return false;
        if (user.role === 'CEO') return true;

        const machine = db.get('SELECT organization_id FROM machines WHERE id = ?', [machineId]);
        if (!machine) return false;

        if (user.role === 'CUSTOMER') {
            return machine.organization_id === user.organizationId;
        }

        if (user.role === 'OPERATOR') {
            const assignment = db.get(
                'SELECT 1 FROM user_machine_assignments WHERE user_id = ? AND machine_id = ?',
                [user.id, machineId]
            );
            return Boolean(assignment);
        }

        return false;
    }

    function broadcastTelemetry(machineId, packet) {
        for (const client of wss.clients) {
            if (client.readyState !== 1) continue; // 1 = OPEN

            // Check if client is authenticated and subscribed
            const user = client.user;
            if (!user) continue;

            // Authorization check
            if (!canUserAccessMachine(user, machineId)) continue;

            const isSubscribedToMachine = client.subscriptions && client.subscriptions.has(machineId);
            const isSubscribedToFleet = client.subscriptions && client.subscriptions.has('fleet');

            if (isSubscribedToMachine) {
                // Send full detailed telemetry packet
                client.send(JSON.stringify(packet));
            } else if (isSubscribedToFleet && (user.role === 'CEO' || user.role === 'CUSTOMER')) {
                // Send minimal card update to avoid telemetry congestion
                const minimal = {
                    type: 'fleet_update',
                    machineId: machineId,
                    state: packet.machine ? packet.machine.state : 'UNKNOWN',
                    rpm: (packet.motors && packet.motors[0]) ? packet.motors[0].rpm : null,
                    voltage: packet.dcPower ? packet.dcPower.voltage : null,
                    power: packet.dcPower ? packet.dcPower.power : null,
                    lastSeen: packet.timestamp,
                    fault: (packet.safety && (packet.safety.estopActive || !packet.safety.guardClosed || packet.safety.jamDetected))
                };
                client.send(JSON.stringify(minimal));
            }
        }
    }

    wss.on('connection', (ws, req) => {
        ws.isAlive = true;
        ws.subscriptions = new Set();
        ws.user = null;

        // Try extracting token from URL query string
        try {
            const parsedUrl = url.parse(req.url, true);
            const token = parsedUrl.query.token;
            if (token) {
                const user = authService.verifyToken(token);
                if (user) {
                    ws.user = user;
                }
            }
        } catch (e) {
            console.error('[WebSocket] URL token parse error:', e.message);
        }

        ws.on('pong', () => {
            ws.isAlive = true;
        });

        ws.on('message', (messageRaw) => {
            try {
                const msg = JSON.parse(messageRaw);

                // Authentication message
                if (msg.type === 'auth') {
                    const user = authService.verifyToken(msg.token);
                    if (user) {
                        ws.user = user;
                        ws.send(JSON.stringify({
                            type: 'auth_success',
                            user: { id: user.id, email: user.email, role: user.role, name: user.name }
                        }));
                    } else {
                        ws.send(JSON.stringify({ type: 'auth_error', message: 'Invalid or expired token.' }));
                    }
                    return;
                }

                // Heartbeat ping
                if (msg.type === 'ping') {
                    ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
                    return;
                }

                // Subscriptions require authentication
                if (!ws.user) {
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Authentication required before subscribing or sending commands.'
                    }));
                    return;
                }

                if (msg.type === 'subscribe') {
                    if (msg.target === 'fleet') {
                        ws.subscriptions.add('fleet');
                        ws.send(JSON.stringify({ type: 'subscribed', target: 'fleet' }));
                    } else if (msg.machineId) {
                        if (canUserAccessMachine(ws.user, msg.machineId)) {
                            ws.subscriptions.add(msg.machineId);
                            ws.send(JSON.stringify({ type: 'subscribed', machineId: msg.machineId }));

                            // Immediately send latest cached telemetry if available
                            const latest = machineService.getLatestTelemetry(msg.machineId);
                            if (latest) {
                                ws.send(JSON.stringify(latest));
                            }
                        } else {
                            ws.send(JSON.stringify({
                                type: 'error',
                                message: `Access Denied: You do not have permission to subscribe to ${msg.machineId}.`
                            }));
                        }
                    }
                    return;
                }

                if (msg.type === 'unsubscribe') {
                    if (msg.machineId) {
                        ws.subscriptions.delete(msg.machineId);
                        ws.send(JSON.stringify({ type: 'unsubscribed', machineId: msg.machineId }));
                    } else if (msg.target === 'fleet') {
                        ws.subscriptions.delete('fleet');
                    }
                    return;
                }

                // Machine control command over WebSocket
                if (msg.type === 'command') {
                    const { machineId, action, command_id, params } = msg;

                    if (!machineId || !action) {
                        ws.send(JSON.stringify({
                            type: 'command_ack',
                            command_id: command_id || null,
                            status: 'REJECTED',
                            message: 'Missing machineId or action in command payload.'
                        }));
                        return;
                    }

                    if (!canUserAccessMachine(ws.user, machineId)) {
                        ws.send(JSON.stringify({
                            type: 'command_ack',
                            command_id: command_id || null,
                            status: 'REJECTED',
                            message: `Access Denied: Machine ${machineId} is not in your authorized scope.`
                        }));
                        return;
                    }

                    if (ws.user.role === 'CUSTOMER') {
                        ws.send(JSON.stringify({
                            type: 'command_ack',
                            command_id: command_id || null,
                            status: 'REJECTED',
                            message: 'Operational control is restricted. Customers have read-only monitoring access.'
                        }));
                        return;
                    }

                    const result = telemetryEngine.handleCommand(machineId, ws.user, action, params);

                    ws.send(JSON.stringify({
                        type: 'command_ack',
                        command_id: command_id || `CMD-${Date.now()}`,
                        status: result.accepted ? 'ACCEPTED' : 'REJECTED',
                        message: result.accepted ? result.message : result.error,
                        timestamp: new Date().toISOString()
                    }));
                }
            } catch (err) {
                ws.send(JSON.stringify({ type: 'error', message: `Malformed JSON: ${err.message}` }));
            }
        });

        ws.on('close', () => {
            ws.subscriptions.clear();
        });
    });

    // Heartbeat interval to clean up dead connections
    const pingInterval = setInterval(() => {
        for (const ws of wss.clients) {
            if (!ws.isAlive) {
                ws.terminate();
                continue;
            }
            ws.isAlive = false;
            ws.ping();
        }
    }, 30000);

    wss.on('close', () => {
        clearInterval(pingInterval);
    });

    return wss;
}

module.exports = { setupWebSocketServer };
