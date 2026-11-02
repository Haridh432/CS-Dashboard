/**
 * CircularSeed Database Driver (SQLite via node:sqlite DatabaseSync)
 * Provides synchronous query interface for high performance and durability.
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '../../data');
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_FILE = process.env.DB_PATH || path.join(DB_DIR, 'circularseed.db');
const db = new DatabaseSync(DB_FILE);

// Enable WAL mode & foreign keys for concurrency and integrity
try {
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');
} catch (e) {
    console.warn('[DB] Pragma setting warning:', e.message);
}

// Initialize tables from schema.sql
const schemaPath = path.join(__dirname, 'schema.sql');
if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);
}

module.exports = {
    db,
    query(sql, params = []) {
        try {
            const stmt = db.prepare(sql);
            return stmt.all(...params);
        } catch (err) {
            console.error('[DB Query Error]', err.message, 'SQL:', sql);
            throw err;
        }
    },
    get(sql, params = []) {
        try {
            const stmt = db.prepare(sql);
            return stmt.get(...params);
        } catch (err) {
            console.error('[DB Get Error]', err.message, 'SQL:', sql);
            throw err;
        }
    },
    run(sql, params = []) {
        try {
            const stmt = db.prepare(sql);
            return stmt.run(...params);
        } catch (err) {
            console.error('[DB Run Error]', err.message, 'SQL:', sql);
            throw err;
        }
    },
    exec(sql) {
        return db.exec(sql);
    }
};
