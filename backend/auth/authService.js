/**
 * Authentication Service
 * Handles user verification, password hashing, JWT creation and role permissions.
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../database/db');

const JWT_SECRET = process.env.JWT_SECRET || 'circularseed-jwt-secret-key-2026-flexishred';
const JWT_EXPIRES_IN = '24h';

const ROLE_PERMISSIONS = {
    CEO: {
        role: 'CEO',
        canViewAllMachines: true,
        canViewCustomerMachines: true,
        canViewAssignedMachinesOnly: false,
        canControlMachine: true,
        canViewFleetAnalytics: true,
        canViewReports: true,
        canExportData: true,
        canManageUsers: true,
        canManageMachines: true,
        canViewTechnicalSensors: true,
        canViewSafetyDetails: true,
        canViewSimulator: true
    },
    CUSTOMER: {
        role: 'CUSTOMER',
        canViewAllMachines: false,
        canViewCustomerMachines: true,
        canViewAssignedMachinesOnly: false,
        canControlMachine: false,          // Customers cannot control machines
        canViewFleetAnalytics: false,
        canViewReports: true,
        canExportData: true,
        canManageUsers: false,
        canManageMachines: false,
        canViewTechnicalSensors: true,     // RPM, power, runtime
        canViewSafetyDetails: false,       // High-level safe/unsafe only
        canViewSimulator: false
    },
    OPERATOR: {
        role: 'OPERATOR',
        canViewAllMachines: false,
        canViewCustomerMachines: false,
        canViewAssignedMachinesOnly: true,
        canControlMachine: true,           // Operator operational controls
        canViewFleetAnalytics: false,
        canViewReports: false,
        canExportData: false,
        canManageUsers: false,
        canManageMachines: false,
        canViewTechnicalSensors: true,
        canViewSafetyDetails: true,
        canViewSimulator: true
    }
};

function sanitizeUser(user) {
    if (!user) return null;
    const permissions = ROLE_PERMISSIONS[user.role] || {};
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organization_id,
        organizationName: user.organization_name || null,
        avatar: user.avatar || user.role.substring(0, 2),
        permissions
    };
}

function login(email, password) {
    if (!email || !password) {
        return { success: false, error: 'Email and password are required.' };
    }

    const user = db.get(
        `SELECT u.*, o.name as organization_name 
         FROM users u 
         LEFT JOIN organizations o ON u.organization_id = o.id 
         WHERE LOWER(u.email) = LOWER(?)`,
        [email.trim()]
    );

    if (!user) {
        return { success: false, error: 'Invalid email or password.' };
    }

    const isValid = bcrypt.compareSync(password, user.password_hash);
    if (!isValid) {
        return { success: false, error: 'Invalid email or password.' };
    }

    const tokenPayload = {
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organization_id,
        name: user.name
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const profile = sanitizeUser(user);

    return {
        success: true,
        token,
        user: profile
    };
}

function verifyToken(token) {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = db.get(
            `SELECT u.*, o.name as organization_name 
             FROM users u 
             LEFT JOIN organizations o ON u.organization_id = o.id 
             WHERE u.id = ?`,
            [decoded.id]
        );
        return sanitizeUser(user);
    } catch (err) {
        return null;
    }
}

function getDemoCredentials() {
    return [
        {
            role: 'CEO',
            title: 'CEO / Administrator',
            email: 'ceo@circularseed.com',
            password: 'CircularCEO#2025',
            desc: 'Complete fleet overview, all manufactured machines, health analytics'
        },
        {
            role: 'CUSTOMER',
            title: 'Customer (Acme Plastics)',
            email: 'customer@acme-plastics.com',
            password: 'Customer#Acme2025',
            desc: 'View only machines assigned to Acme Plastics Corp (CS-FS-0001, 0002, 0003)'
        },
        {
            role: 'CUSTOMER',
            title: 'Customer (GreenCycle)',
            email: 'customer@green-cycle.com',
            password: 'Customer#Green2025',
            desc: 'View only machines assigned to GreenCycle (CS-FS-0004, 0005)'
        },
        {
            role: 'OPERATOR',
            title: 'Operator (Single Unit)',
            email: 'operator@circularseed.com',
            password: 'Operator#Flexishred1',
            desc: 'Assigned solely to CS-FS-0001; opens directly to live operating view'
        },
        {
            role: 'OPERATOR',
            title: 'Operator (Multi-Unit)',
            email: 'operator2@circularseed.com',
            password: 'Operator#Flexishred2',
            desc: 'Assigned to CS-FS-0002 & CS-FS-0003 (12V L298N Prototype); selector view'
        }
    ];
}

module.exports = {
    login,
    verifyToken,
    sanitizeUser,
    getDemoCredentials,
    ROLE_PERMISSIONS,
    JWT_SECRET
};
