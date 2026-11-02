/**
 * Authentication and Authorization Middleware
 * Enforces role-based permissions and strict cross-organization isolation.
 */

const authService = require('./authService');
const db = require('../database/db');

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.query && req.query.token) {
        token = req.query.token;
    }

    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required. Missing Bearer token.'
        });
    }

    const user = authService.verifyToken(token);
    if (!user) {
        return res.status(401).json({
            success: false,
            error: 'Invalid or expired authentication session. Please sign in again.'
        });
    }

    req.user = user;
    next();
}

function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized.' });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: `Access denied. Role '${req.user.role}' is not authorized for this resource.`
            });
        }
        next();
    };
}

/**
 * Authorizes access to a specific machine:
 * - CEO: Can access all machines.
 * - CUSTOMER: Can only access machines assigned to their organization.
 * - OPERATOR: Can only access machines assigned directly to their user ID.
 */
function authorizeMachineAccess(req, res, next) {
    const machineId = req.params.machineId || req.query.machineId || req.body.machineId;

    if (!machineId) {
        return res.status(400).json({ success: false, error: 'Machine ID is required.' });
    }

    const machine = db.get('SELECT * FROM machines WHERE id = ?', [machineId]);
    if (!machine) {
        return res.status(404).json({ success: false, error: `Machine ${machineId} not found.` });
    }

    req.machine = machine;

    // CEO: Unlimited access
    if (req.user.role === 'CEO') {
        return next();
    }

    // CUSTOMER: Must belong to customer's organization
    if (req.user.role === 'CUSTOMER') {
        if (machine.organization_id !== req.user.organizationId) {
            return res.status(403).json({
                success: false,
                error: `Access Denied: Machine ${machineId} does not belong to your organization.`
            });
        }
        return next();
    }

    // OPERATOR: Must be explicitly assigned in user_machine_assignments
    if (req.user.role === 'OPERATOR') {
        const assignment = db.get(
            'SELECT 1 FROM user_machine_assignments WHERE user_id = ? AND machine_id = ?',
            [req.user.id, machineId]
        );
        if (!assignment) {
            return res.status(403).json({
                success: false,
                error: `Access Denied: Operator is not assigned to operate machine ${machineId}.`
            });
        }
        return next();
    }

    return res.status(403).json({ success: false, error: 'Unauthorized access.' });
}

module.exports = {
    authenticateToken,
    requireRole,
    authorizeMachineAccess
};
