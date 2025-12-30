/**
 * Database Service - PostgreSQL persistence for spin history
 * Uses DATABASE_URL environment variable (auto-set by Railway)
 */

const { Pool } = require('pg');

// Database configuration
const pool = process.env.DATABASE_URL ? new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
}) : null;

let isConnected = false;

/**
 * Initialize database tables
 */
async function initialize() {
    if (!pool) {
        console.log('[Database] No DATABASE_URL found, using file-based storage');
        return false;
    }

    try {
        // Create tables if they don't exist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS spin_history (
                id SERIAL PRIMARY KEY,
                winner_address VARCHAR(64) NOT NULL,
                winner_display VARCHAR(20),
                winner_amount BIGINT DEFAULT 0,
                winner_percentage DECIMAL(10, 6) DEFAULT 0,
                distribution DECIMAL(20, 10) DEFAULT 0,
                tx_signature VARCHAR(128),
                solscan_url TEXT,
                timestamp TIMESTAMPTZ DEFAULT NOW(),
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS stats (
                key VARCHAR(50) PRIMARY KEY,
                value DECIMAL(20, 10) NOT NULL,
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);

        // Initialize total_fees if not exists
        await pool.query(`
            INSERT INTO stats (key, value) 
            VALUES ('total_fees', 6.0) 
            ON CONFLICT (key) DO NOTHING
        `);

        isConnected = true;
        console.log('[Database] Connected and tables initialized');
        return true;
    } catch (error) {
        console.error('[Database] Failed to initialize:', error.message);
        isConnected = false;
        return false;
    }
}

/**
 * Check if database is available
 */
function isAvailable() {
    return isConnected;
}

/**
 * Save a spin record to database
 */
async function saveSpinRecord(record) {
    if (!isConnected) return false;

    try {
        await pool.query(`
            INSERT INTO spin_history 
            (winner_address, winner_display, winner_amount, winner_percentage, distribution, tx_signature, solscan_url, timestamp)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
            record.winner?.address || '',
            record.winner?.displayAddress || '',
            record.winner?.amount || 0,
            record.winner?.percentage || 0,
            record.distribution || 0,
            record.txSignature || null,
            record.solscanUrl || null,
            record.timestamp || new Date().toISOString()
        ]);
        return true;
    } catch (error) {
        console.error('[Database] Failed to save spin:', error.message);
        return false;
    }
}

/**
 * Update the latest spin with distribution info
 */
async function updateLatestSpinDistribution(distribution) {
    if (!isConnected || !distribution) return false;

    try {
        await pool.query(`
            UPDATE spin_history 
            SET distribution = $1, tx_signature = $2, solscan_url = $3
            WHERE id = (SELECT MAX(id) FROM spin_history)
        `, [
            distribution.distributed || 0,
            distribution.transferSignature || null,
            distribution.transferTxUrl || null
        ]);
        return true;
    } catch (error) {
        console.error('[Database] Failed to update spin:', error.message);
        return false;
    }
}

/**
 * Get spin history from database
 */
async function getSpinHistory(limit = 10) {
    if (!isConnected) return [];

    try {
        const result = await pool.query(`
            SELECT * FROM spin_history 
            ORDER BY id DESC 
            LIMIT $1
        `, [limit]);

        return result.rows.map(row => ({
            id: row.id,
            winner: {
                address: row.winner_address,
                displayAddress: row.winner_display,
                amount: parseInt(row.winner_amount) || 0,
                percentage: parseFloat(row.winner_percentage) || 0
            },
            timestamp: row.timestamp,
            timestampReadable: new Date(row.timestamp).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            }),
            distribution: parseFloat(row.distribution) || 0,
            txSignature: row.tx_signature,
            solscanUrl: row.solscan_url
        }));
    } catch (error) {
        console.error('[Database] Failed to get history:', error.message);
        return [];
    }
}

/**
 * Get total fees sent
 */
async function getTotalFees() {
    if (!isConnected) return 6.0; // Default baseline

    try {
        const result = await pool.query(`
            SELECT value FROM stats WHERE key = 'total_fees'
        `);
        return result.rows.length > 0 ? parseFloat(result.rows[0].value) : 6.0;
    } catch (error) {
        console.error('[Database] Failed to get total fees:', error.message);
        return 6.0;
    }
}

/**
 * Add to total fees
 */
async function addToTotalFees(amount) {
    if (!isConnected) return false;

    try {
        await pool.query(`
            UPDATE stats 
            SET value = value + $1, updated_at = NOW()
            WHERE key = 'total_fees'
        `, [amount]);
        return true;
    } catch (error) {
        console.error('[Database] Failed to update total fees:', error.message);
        return false;
    }
}

/**
 * Get spin count
 */
async function getSpinCount() {
    if (!isConnected) return 0;

    try {
        const result = await pool.query(`SELECT COUNT(*) as count FROM spin_history`);
        return parseInt(result.rows[0].count) || 0;
    } catch (error) {
        return 0;
    }
}

module.exports = {
    initialize,
    isAvailable,
    saveSpinRecord,
    updateLatestSpinDistribution,
    getSpinHistory,
    getTotalFees,
    addToTotalFees,
    getSpinCount
};
