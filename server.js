const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const { getTokenHolders, processHoldersForWheel } = require('./services/helius');
const { selectWinner, calculateWinningDegree, recordSpin, getSpinHistory, getTimeUntilNextSpin } = require('./services/wheelLogic');

// Configuration
const PORT = process.env.PORT || 3000;
const SPIN_INTERVAL_MS = 60000; // 1 minute
// Token mint address for The Wheel
const TOKEN_MINT_ADDRESS = process.env.TOKEN_MINT || '6MjfcbDGeCe4AapDP2uUnPBrMKKKejeXr8UCArBC92vg';

// State
let currentHolders = [];
let currentWheelData = { segments: [], totalSupply: 0 };
let lastSpinTime = Date.now();
let isSpinning = false;
let lastWinner = null;

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Create HTTP server and WebSocket server
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// WebSocket connection handler
wss.on('connection', (ws) => {
    console.log('[WS] Client connected');

    // Send current state to new client
    ws.send(JSON.stringify({
        type: 'init',
        data: {
            wheelData: currentWheelData,
            lastWinner: lastWinner,
            history: getSpinHistory(10),
            nextSpin: getTimeUntilNextSpin(lastSpinTime, SPIN_INTERVAL_MS),
            isSpinning: isSpinning
        }
    }));

    ws.on('close', () => {
        console.log('[WS] Client disconnected');
    });
});

// Broadcast to all connected clients
function broadcast(message) {
    const data = JSON.stringify(message);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}

// API Routes
app.get('/api/holders', async (req, res) => {
    try {
        res.json({
            success: true,
            holders: currentHolders.slice(0, 100), // Return top 100 for API
            total: currentHolders.length
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/wheel-data', (req, res) => {
    res.json({
        success: true,
        wheelData: currentWheelData,
        nextSpin: getTimeUntilNextSpin(lastSpinTime, SPIN_INTERVAL_MS),
        isSpinning: isSpinning
    });
});

app.get('/api/history', (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    res.json({
        success: true,
        history: getSpinHistory(limit)
    });
});

app.post('/api/spin', async (req, res) => {
    try {
        if (isSpinning) {
            return res.status(400).json({ success: false, error: 'Spin already in progress' });
        }

        const result = await performSpin();
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        tokenMint: TOKEN_MINT_ADDRESS,
        totalHolders: currentHolders.length,
        totalSupply: currentWheelData.totalSupply,
        lastSpinTime: new Date(lastSpinTime).toISOString(),
        nextSpin: getTimeUntilNextSpin(lastSpinTime, SPIN_INTERVAL_MS),
        isSpinning: isSpinning
    });
});

// Spin logic
async function performSpin() {
    if (currentWheelData.segments.length === 0) {
        throw new Error('No holders available for spin');
    }

    isSpinning = true;
    broadcast({ type: 'spinStart' });

    // Select winner using weighted random
    const winner = selectWinner(currentWheelData.segments);
    const winnerIndex = currentWheelData.segments.findIndex(s => s.address === winner.address);
    const winningDegree = calculateWinningDegree(currentWheelData.segments, winnerIndex);

    // Record the spin
    const record = recordSpin(winner);
    lastWinner = winner;
    lastSpinTime = Date.now();

    console.log(`[Spin] Winner: ${winner.displayAddress} (${winner.percentage.toFixed(2)}%)`);

    // Broadcast spin result (frontend will animate)
    broadcast({
        type: 'spinResult',
        data: {
            winner: winner,
            winnerIndex: winnerIndex,
            winningDegree: winningDegree,
            record: record
        }
    });

    // Wait for animation to complete before allowing next spin
    setTimeout(() => {
        isSpinning = false;
        broadcast({
            type: 'spinComplete',
            data: {
                winner: winner,
                history: getSpinHistory(10),
                nextSpin: getTimeUntilNextSpin(lastSpinTime, SPIN_INTERVAL_MS)
            }
        });
    }, 5000); // 5 second spin animation

    return {
        winner: winner,
        winnerIndex: winnerIndex,
        winningDegree: winningDegree,
        record: record
    };
}

// Fetch and update holder data
async function refreshHolders() {
    try {
        console.log('[Server] Refreshing holder data...');
        currentHolders = await getTokenHolders(TOKEN_MINT_ADDRESS);
        currentWheelData = processHoldersForWheel(currentHolders);

        broadcast({
            type: 'holdersUpdate',
            data: {
                wheelData: currentWheelData,
                totalHolders: currentHolders.length
            }
        });

        console.log(`[Server] Holder data refreshed: ${currentHolders.length} holders`);
    } catch (error) {
        console.error('[Server] Error refreshing holders:', error.message);
    }
}

// Auto-spin interval
function startAutoSpin() {
    console.log(`[Server] Starting auto-spin every ${SPIN_INTERVAL_MS / 1000} seconds`);

    setInterval(async () => {
        if (!isSpinning && currentWheelData.segments.length > 0) {
            console.log('[Server] Auto-spin triggered');
            try {
                await performSpin();
            } catch (error) {
                console.error('[Server] Auto-spin error:', error.message);
            }
        }
    }, SPIN_INTERVAL_MS);
}

// Countdown broadcast (every second)
function startCountdownBroadcast() {
    setInterval(() => {
        if (!isSpinning) {
            broadcast({
                type: 'countdown',
                data: getTimeUntilNextSpin(lastSpinTime, SPIN_INTERVAL_MS)
            });
        }
    }, 1000);
}

// Start server
server.listen(PORT, async () => {
    console.log(`
╔═══════════════════════════════════════════════╗
║           🎡 THE WHEEL SERVER 🎡              ║
╠═══════════════════════════════════════════════╣
║  Server running on: http://localhost:${PORT}     ║
║  Token Mint: ${TOKEN_MINT_ADDRESS.slice(0, 20)}...       
║  Spin Interval: ${SPIN_INTERVAL_MS / 1000} seconds              ║
╚═══════════════════════════════════════════════╝
    `);

    // Initial holder fetch
    await refreshHolders();

    // Refresh holders every 5 minutes
    setInterval(refreshHolders, 5 * 60 * 1000);

    // Start auto-spin
    startAutoSpin();

    // Start countdown broadcast
    startCountdownBroadcast();
});

module.exports = app;
