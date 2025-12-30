require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const { getTokenHolders, processHoldersForWheel, getCreatedTokens, setCreatorExclusion } = require('./services/helius');
const { selectWinner, calculateWinningDegree, recordSpin, getSpinHistory, getTimeUntilNextSpin, updateLatestSpinDistribution, getTotalFeesSent, addToTotalFees } = require('./services/wheelLogic');
const pumpfun = require('./services/pumpfun');
const discord = require('./services/discord');

// Configuration
const PORT = process.env.PORT || 3000;
const SPIN_INTERVAL_MS = 120000; // 2 minutes
let TOKEN_MINT_ADDRESS = process.env.TOKEN_MINT || null; // Will auto-detect if not set
const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://mainnet.helius-rpc.com/?api-key=ae211108-bdbf-40af-90e2-c5418e3f62d3';


// State
let currentHolders = [];
let currentWheelData = { segments: [], totalSupply: 0 };
let lastSpinTime = Date.now();
let isSpinning = false;
let lastWinner = null;
let creatorBalance = 0;
let feeClaimEnabled = false;

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
            isSpinning: isSpinning,
            creatorBalance: creatorBalance,
            feeClaimEnabled: feeClaimEnabled,
            totalFeesSent: getTotalFeesSent(),
            spinsToday: getSpinHistory(100).length,
            totalHolders: currentHolders.length
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
            holders: currentHolders.slice(0, 100),
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
        isSpinning: isSpinning,
        creatorBalance: creatorBalance,
        feeClaimEnabled: feeClaimEnabled,
        creatorWallet: pumpfun.getCreatorPublicKey()
    });
});

// Fee claiming endpoints
app.get('/api/balance', async (req, res) => {
    if (!feeClaimEnabled) {
        return res.json({ success: false, error: 'Fee claiming not configured' });
    }

    const result = await pumpfun.getCreatorBalance();
    if (result.success) {
        creatorBalance = result.balance;
    }
    res.json(result);
});

app.post('/api/claim-fees', async (req, res) => {
    if (!feeClaimEnabled) {
        return res.json({ success: false, error: 'Fee claiming not configured' });
    }

    const result = await pumpfun.claimCreatorFees();
    if (result.success) {
        const balanceResult = await pumpfun.getCreatorBalance();
        if (balanceResult.success) {
            creatorBalance = balanceResult.balance;
        }
    }
    res.json(result);
});

// Spin logic with fee distribution
async function performSpin() {
    if (currentWheelData.segments.length === 0) {
        throw new Error('No holders available for spin');
    }

    isSpinning = true;
    broadcast({ type: 'spinStart' });
    discord.spinStarted();

    // Select winner using weighted random
    const winner = selectWinner(currentWheelData.segments);
    const winnerIndex = currentWheelData.segments.findIndex(s => s.address === winner.address);
    const winningDegree = calculateWinningDegree(currentWheelData.segments, winnerIndex);

    // Record the spin
    const record = recordSpin(winner);
    lastWinner = winner;
    lastSpinTime = Date.now();

    console.log(`[Spin] Winner: ${winner.displayAddress} (${winner.percentage.toFixed(2)}%)`);
    discord.spinWinner(winner);

    // Broadcast spin result
    broadcast({
        type: 'spinResult',
        data: {
            winner: winner,
            winnerIndex: winnerIndex,
            winningDegree: winningDegree,
            record: record
        }
    });

    // Handle fee distribution after animation
    setTimeout(async () => {
        let distributionResult = null;

        // Try to claim and distribute fees if enabled
        if (feeClaimEnabled && winner.address) {
            console.log(`[Spin] Attempting to claim and distribute fees to winner: ${winner.address}`);
            discord.feeClaimAttempt(winner.address);

            distributionResult = await pumpfun.claimAndDistribute(winner.address, 10);

            if (distributionResult.success && distributionResult.distributed > 0) {
                console.log(`[Spin] Distributed ${distributionResult.distributed} SOL to winner!`);
                // Update the history record with transaction info
                updateLatestSpinDistribution(distributionResult);
                // Track total fees sent (persistent)
                addToTotalFees(distributionResult.distributed);
                discord.feeClaimSuccess(distributionResult.distributed, distributionResult.transferSignature, winner.address);
            } else if (distributionResult.success) {
                console.log(`[Spin] No fees available to distribute`);
                discord.feeClaimNoFees();
            } else {
                console.log(`[Spin] Fee distribution failed: ${distributionResult.error}`);
                discord.feeClaimError(distributionResult.error);
            }

            // Update balance
            const balanceResult = await pumpfun.getCreatorBalance();
            if (balanceResult.success) {
                creatorBalance = balanceResult.balance;
                discord.balanceUpdate(creatorBalance);
            }
        }

        isSpinning = false;
        broadcast({
            type: 'spinComplete',
            data: {
                winner: winner,
                history: getSpinHistory(10),
                nextSpin: getTimeUntilNextSpin(lastSpinTime, SPIN_INTERVAL_MS),
                distribution: distributionResult,
                creatorBalance: creatorBalance,
                totalFeesSent: getTotalFeesSent(),
                spinsToday: getSpinHistory(100).length
            }
        });
    }, 5500); // After spin animation

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
        discord.holdersRefreshed(currentHolders.length, TOKEN_MINT_ADDRESS);
    } catch (error) {
        console.error('[Server] Error refreshing holders:', error.message);
        discord.holdersError(error.message);
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

// Countdown broadcast
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

// Initialize PumpFun service
function initializePumpFun() {
    const privateKey = process.env.CREATOR_PRIVATE_KEY;

    if (!privateKey || privateKey === 'your_base58_private_key_here') {
        console.log('[PumpFun] No private key configured - fee claiming disabled');
        console.log('[PumpFun] To enable, set CREATOR_PRIVATE_KEY in .env file');
        discord.pumpfunDisabled();
        return { success: false };
    }

    const result = pumpfun.initialize(privateKey, RPC_ENDPOINT);

    if (result.success) {
        feeClaimEnabled = true;
        console.log(`[PumpFun] Fee claiming enabled! Creator wallet: ${result.publicKey}`);
        discord.pumpfunEnabled(result.publicKey);
        // Exclude creator from winning
        setCreatorExclusion(result.publicKey);
        return { success: true, publicKey: result.publicKey };
    } else {
        console.error(`[PumpFun] Failed to initialize: ${result.error}`);
        discord.pumpfunInitError(result.error);
        return { success: false };
    }
}

// Auto-detect token created by wallet
async function autoDetectToken(creatorPublicKey) {
    console.log('[Server] Auto-detecting token from creator wallet...');

    const result = await getCreatedTokens(creatorPublicKey);

    if (result.success) {
        console.log(`[Server] Found token: ${result.name} (${result.symbol})`);
        console.log(`[Server] Token Mint: ${result.mint}`);
        discord.tokenDetected(result.mint, result.name, result.symbol);
        return result.mint;
    } else {
        console.log(`[Server] Could not auto-detect token: ${result.error}`);
        console.log('[Server] Please set TOKEN_MINT in environment variables');
        discord.tokenDetectFailed(result.error);
        return null;
    }
}

// Start server
server.listen(PORT, async () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║              🎡 $WHEEL SERVER 🎡                      ║
╠═══════════════════════════════════════════════════════╣
║  Server running on: http://localhost:${PORT}              ║
║  Spin Interval: ${SPIN_INTERVAL_MS / 1000} seconds                          ║
╚═══════════════════════════════════════════════════════╝
    `);

    // Initialize PumpFun fee claiming
    const pumpfunResult = initializePumpFun();

    // Auto-detect token if not manually set
    if (!TOKEN_MINT_ADDRESS && pumpfunResult.success && pumpfunResult.publicKey) {
        const detectedMint = await autoDetectToken(pumpfunResult.publicKey);
        if (detectedMint) {
            TOKEN_MINT_ADDRESS = detectedMint;
        } else {
            console.error('[Server] No token detected and no TOKEN_MINT set. Exiting...');
            discord.error('Server Shutdown', 'No token detected and no TOKEN_MINT set');
            process.exit(1);
        }
    } else if (!TOKEN_MINT_ADDRESS) {
        console.error('[Server] No TOKEN_MINT set and no CREATOR_PRIVATE_KEY for auto-detect. Exiting...');
        discord.error('Server Shutdown', 'No TOKEN_MINT set and no CREATOR_PRIVATE_KEY for auto-detect');
        process.exit(1);
    }

    console.log(`[Server] Using Token: ${TOKEN_MINT_ADDRESS}`);
    discord.serverStart(PORT, TOKEN_MINT_ADDRESS);

    // Log loaded persistent data
    console.log(`[Server] Total Fees Sent (loaded): ${getTotalFeesSent().toFixed(4)} SOL`);
    console.log(`[Server] Spin History (loaded): ${getSpinHistory(100).length} spins`);

    // Get initial balance if enabled
    if (feeClaimEnabled) {
        const balanceResult = await pumpfun.getCreatorBalance();
        if (balanceResult.success) {
            creatorBalance = balanceResult.balance;
            console.log(`[PumpFun] Current creator balance: ${creatorBalance} SOL`);
            discord.balanceUpdate(creatorBalance);
        }
    }

    // Initial holder fetch
    await refreshHolders();

    // Refresh holders every 30 seconds
    setInterval(refreshHolders, 30 * 1000);

    // Start auto-spin
    startAutoSpin();

    // Start countdown broadcast
    startCountdownBroadcast();
});

module.exports = app;
