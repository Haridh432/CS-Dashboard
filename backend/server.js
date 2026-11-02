/**
 * CircularSeed Multi-Machine Monitoring Platform
 * Express & WebSocket Server
 */

require('dotenv').config();
const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { seedDatabase } = require('./database/seed');
const { setupWebSocketServer } = require('./websocket/wsServer');
const telemetryEngine = require('./telemetry/telemetryEngine');

const authRouter = require('./auth/authRouter');
const machineRouter = require('./machines/machineRouter');
const telemetryRouter = require('./telemetry/telemetryRouter');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

// Security and utility middleware
app.use(helmet({
    contentSecurityPolicy: false // Allow inline scripts/styles for prototype UI
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/machines', machineRouter);
app.use('/api/telemetry', telemetryRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ONLINE',
        service: 'CircularSeed FLEXISHRED-DC Platform',
        timestamp: new Date().toISOString()
    });
});

// Serve frontend static files from project root
app.use(express.static(path.join(__dirname, '..')));

// Specific dashboard friendly route mappings to index.html
const dashboardRoutes = [
    '/ceo/dashboard',
    '/customer/dashboard',
    '/operator/dashboard',
    '/machines/:machineId',
    '/login'
];

dashboardRoutes.forEach(r => {
    app.get(r, (req, res) => {
        res.sendFile(path.join(__dirname, '..', 'index.html'));
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('[Server Error]', err);
    res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
});

// Initialize database seed & start services
try {
    seedDatabase();
} catch (e) {
    console.error('[Server] Database seed error:', e.message);
}

// Setup WebSocket server
setupWebSocketServer(server);

// Start telemetry engine
telemetryEngine.start();

// Start listening
server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` CircularSeed FLEXISHRED-DC Monitoring Platform`);
    console.log(` HTTP & WebSocket Server running at: http://localhost:${PORT}`);
    console.log(` CEO Dashboard:      http://localhost:${PORT}/ceo/dashboard`);
    console.log(` Customer View:      http://localhost:${PORT}/customer/dashboard`);
    console.log(` Operator View:      http://localhost:${PORT}/operator/dashboard`);
    console.log(` WebSocket Gateway:  ws://localhost:${PORT}/ws`);
    console.log(`=======================================================`);
});

module.exports = { app, server };
