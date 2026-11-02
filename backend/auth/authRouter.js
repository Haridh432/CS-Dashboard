/**
 * Authentication Router
 * Public and authenticated endpoints for user authentication.
 */

const express = require('express');
const router = express.Router();
const authService = require('./authService');
const { authenticateToken } = require('./authMiddleware');

/**
 * POST /api/auth/login
 * Validates credentials and returns JWT token and user profile with permissions.
 */
router.post('/login', (req, res) => {
    const { email, password } = req.body;
    const result = authService.login(email, password);

    if (!result.success) {
        return res.status(401).json(result);
    }

    res.json(result);
});

/**
 * GET /api/auth/me
 * Returns current authenticated user profile.
 */
router.get('/me', authenticateToken, (req, res) => {
    res.json({ success: true, user: req.user });
});

/**
 * GET /api/auth/demo-credentials
 * Returns demo credentials for development test panel.
 */
router.get('/demo-credentials', (req, res) => {
    res.json({ success: true, credentials: authService.getDemoCredentials() });
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
    res.json({ success: true, message: 'Logged out successfully.' });
});

module.exports = router;
