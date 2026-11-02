/**
 * CircularSeed Database Schema (SQLite)
 * Multi-machine platform with Organizations, Users, Machines, Assignments, Telemetry, and Events.
 */

-- Organizations
CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    industry TEXT,
    code TEXT UNIQUE NOT NULL,
    contact_email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Users with Role-Based Access Control (CEO, CUSTOMER, OPERATOR)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('CEO', 'CUSTOMER', 'OPERATOR')),
    name TEXT NOT NULL,
    organization_id TEXT,
    avatar TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);

-- Registered Machines
CREATE TABLE IF NOT EXISTS machines (
    id TEXT PRIMARY KEY,                       -- e.g. CS-FS-0001
    model TEXT NOT NULL,                      -- e.g. FLEXISHRED-DC Pro, FLEXISHRED-DC Micro (12V L298N)
    serial_number TEXT UNIQUE,
    organization_id TEXT NOT NULL,
    location TEXT NOT NULL,                   -- e.g. Unit 4 - Processing Bay A
    gateway_id TEXT UNIQUE,                   -- e.g. GW-ESP32-0001
    commissioning_date TEXT,
    sensor_capabilities TEXT,                 -- JSON array of capabilities: ['dual_motor', 'battery', 'solar', 'temperature', 'l298n_dc_encoder']
    hardware_type TEXT DEFAULT 'PROD_48V',    -- 'PROD_48V', 'PROTOTYPE_12V_L298N'
    state TEXT DEFAULT 'READY' CHECK(state IN ('RUNNING', 'READY', 'STOPPED', 'FAULT', 'OFFLINE')),
    motor_type TEXT DEFAULT 'Dual BLDC',
    rated_voltage_v REAL DEFAULT 48.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT
);

-- Machine Operator Assignments
CREATE TABLE IF NOT EXISTS user_machine_assignments (
    user_id TEXT NOT NULL,
    machine_id TEXT NOT NULL,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, machine_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE
);

-- Historical Telemetry Logs (sample recorded over time for historical charts)
CREATE TABLE IF NOT EXISTS telemetry_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id TEXT NOT NULL,
    timestamp DATETIME NOT NULL,
    state TEXT NOT NULL,
    voltage_v REAL,
    current_a REAL,
    power_w REAL,
    energy_wh REAL,
    rpm_m1 REAL,
    rpm_m2 REAL,
    temp_m1 REAL,
    temp_m2 REAL,
    estop_active INTEGER DEFAULT 0,
    guard_closed INTEGER DEFAULT 1,
    fault_code TEXT,
    is_demo INTEGER DEFAULT 1,
    FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE
);

-- Machine Safety & Operational Events
CREATE TABLE IF NOT EXISTS machine_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    event_type TEXT NOT NULL,                -- 'STATE_CHANGE', 'FAULT', 'INTERLOCK', 'COMMAND', 'MAINTENANCE'
    severity TEXT NOT NULL,                  -- 'INFO', 'WARNING', 'CRITICAL'
    description TEXT NOT NULL,
    user_id TEXT,
    FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Maintenance Records
CREATE TABLE IF NOT EXISTS maintenance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id TEXT NOT NULL,
    maintenance_date TEXT NOT NULL,
    next_due_date TEXT,
    technician TEXT NOT NULL,
    notes TEXT NOT NULL,
    operating_hours REAL DEFAULT 0.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_telemetry_machine_time ON telemetry_history(machine_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_machine_time ON machine_events(machine_id, timestamp);
