/**
 * THE WHEEL - Enhanced Main Application Script
 * Handles WebSocket connection, UI updates, sounds, and interactions
 */

// Configuration
const API_BASE = window.location.origin;
// Use wss:// for HTTPS, ws:// for HTTP
const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${WS_PROTOCOL}//${window.location.host}`;

// State
let wheel = null;
let socket = null;
let reconnectAttempts = 0;
let spinsToday = 0;
let totalFeesSent = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

// Audio elements
const sounds = {
    spin: null,
    win: null,
    tick: null
};

// DOM Elements
const elements = {
    holderCount: document.getElementById('holderCount'),
    totalFeesSent: document.getElementById('totalFeesSent'),
    countdownSeconds: document.getElementById('countdownSeconds'),
    countdownCircle: document.getElementById('countdownCircle'),
    historyList: document.getElementById('historyList'),
    holdersList: document.getElementById('holdersList'),
    winnerAnnouncement: document.getElementById('winnerAnnouncement'),
    winnerAddress: document.getElementById('winnerAddress'),
    winnerAmount: document.getElementById('winnerAmount'),
    tokenAddress: document.getElementById('tokenAddress'),
    headerTokenAddress: document.getElementById('headerTokenAddress'),
    headerCaItem: document.getElementById('headerCaItem'),
    copyBtn: document.getElementById('copyBtn'),
    closeWinner: document.getElementById('closeWinner'),
    wheelContainer: document.getElementById('wheelContainer'),
    spinsToday: document.getElementById('spinsToday')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initSounds();
    initWheel();
    connectWebSocket();
    setupEventListeners();
    fetchStatus();
    addCountdownSVGGradient();
});

// Add gradient for countdown circle
function addCountdownSVGGradient() {
    const svg = document.querySelector('.countdown-ring svg');
    if (!svg) return;

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
        <linearGradient id="countdownGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#ffd700"/>
            <stop offset="50%" style="stop-color:#00ffff"/>
            <stop offset="100%" style="stop-color:#bf00ff"/>
        </linearGradient>
    `;
    svg.insertBefore(defs, svg.firstChild);

    const progressCircle = document.getElementById('countdownCircle');
    if (progressCircle) {
        progressCircle.style.stroke = 'url(#countdownGradient)';
    }
}

// Initialize sounds
function initSounds() {
    sounds.spin = document.getElementById('spinSound');
    sounds.win = document.getElementById('winSound');
    sounds.tick = document.getElementById('tickSound');

    // Preload sounds
    Object.values(sounds).forEach(sound => {
        if (sound) {
            sound.volume = 0.3;
            sound.load();
        }
    });
}

// Play sound with error handling
function playSound(name) {
    const sound = sounds[name];
    if (sound) {
        sound.currentTime = 0;
        sound.play().catch(() => { }); // Ignore autoplay errors
    }
}

// Initialize the wheel component
function initWheel() {
    wheel = new SpinningWheel('wheelCanvas');

    // Handle window resize
    window.addEventListener('resize', debounce(() => {
        wheel.resize();
    }, 250));
}

// WebSocket connection
function connectWebSocket() {
    socket = new WebSocket(WS_URL);

    socket.onopen = () => {
        console.log('[WS] Connected');
        reconnectAttempts = 0;
        updateConnectionStatus(true);
    };

    socket.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            handleMessage(message);
        } catch (error) {
            console.error('[WS] Error parsing message:', error);
        }
    };

    socket.onclose = () => {
        console.log('[WS] Disconnected');
        updateConnectionStatus(false);
        attemptReconnect();
    };

    socket.onerror = (error) => {
        console.error('[WS] Error:', error);
    };
}

function updateConnectionStatus(connected) {
    const liveText = document.querySelector('.live-text');
    if (liveText) {
        liveText.textContent = connected ? 'LIVE' : 'OFFLINE';
        liveText.style.color = connected ? 'var(--neon-green)' : 'var(--neon-red)';
    }
}

function attemptReconnect() {
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
        setTimeout(connectWebSocket, delay);
    }
}

// Handle incoming WebSocket messages
function handleMessage(message) {
    switch (message.type) {
        case 'init':
            handleInit(message.data);
            break;
        case 'holdersUpdate':
            handleHoldersUpdate(message.data);
            break;
        case 'spinStart':
            handleSpinStart();
            break;
        case 'spinResult':
            handleSpinResult(message.data);
            break;
        case 'spinComplete':
            handleSpinComplete(message.data);
            break;
        case 'countdown':
            handleCountdown(message.data);
            break;
        default:
            console.log('[WS] Unknown message type:', message.type);
    }
}

function handleInit(data) {
    console.log('[App] Initializing with data:', data);

    if (data.wheelData) {
        updateWheelData(data.wheelData);
    }

    // Always update history (even if empty array)
    updateHistory(data.history || []);

    // Update spins today
    spinsToday = data.spinsToday || (data.history ? data.history.length : 0);
    updateSpinsToday();

    // Always use server-provided total fees (includes baseline)
    totalFeesSent = data.totalFeesSent || 0;
    updateTotalFeesSent();

    if (data.nextSpin) {
        updateCountdown(data.nextSpin);
    }

    if (data.totalHolders !== undefined) {
        elements.holderCount.textContent = formatNumber(data.totalHolders);
    }
}

function handleHoldersUpdate(data) {
    console.log('[App] Holders updated');
    updateWheelData(data.wheelData);
    elements.holderCount.textContent = formatNumber(data.totalHolders);
}

function handleSpinStart() {
    console.log('[App] Spin starting');
    elements.wheelContainer.classList.add('spinning');
}

function handleSpinResult(data) {
    console.log('[App] Spin result:', data);

    // Play spin sound
    playSound('spin');

    // Spin the wheel with animation
    wheel.spin(data.winningDegree, 5000, () => {
        // Play win sound
        playSound('win');

        // Trigger confetti
        if (window.triggerConfetti) {
            window.triggerConfetti();
        }

        // Show winner announcement after wheel stops
        showWinnerAnnouncement(data.winner);

        // Increment spins
        spinsToday++;
        updateSpinsToday();
    });
}

function handleSpinComplete(data) {
    console.log('[App] Spin complete');

    elements.wheelContainer.classList.remove('spinning');

    if (data.history) {
        updateHistory(data.history);
    }

    if (data.nextSpin) {
        updateCountdown(data.nextSpin);
    }

    // Update winner modal with distribution info if available
    if (data.distribution && data.distribution.distributed > 0) {
        updateWinnerWithDistribution(data.distribution);
    }

    // Update total fees sent from server data
    if (data.totalFeesSent !== undefined) {
        totalFeesSent = data.totalFeesSent;
        updateTotalFeesSent();
    }

    // Update spins today from server data
    if (data.spinsToday !== undefined) {
        spinsToday = data.spinsToday;
        updateSpinsToday();
    }
}

function updateTotalFeesSent() {
    if (elements.totalFeesSent) {
        elements.totalFeesSent.textContent = `${totalFeesSent.toFixed(4)} SOL`;
    }
}

function handleCountdown(data) {
    updateCountdown(data);

    // Play tick sound in last 5 seconds
    if (data.remainingSeconds <= 5 && data.remainingSeconds > 0) {
        playSound('tick');
    }
}

// UI Update functions
function updateWheelData(wheelData) {
    if (!wheelData) return;

    // Update wheel segments
    if (wheelData.segments) {
        wheel.updateSegments(wheelData.segments);
        updateHoldersList(wheelData.segments);
    }

    // Update stats
    if (wheelData.totalSupply) {
        elements.totalSupply.textContent = formatTokenAmount(wheelData.totalSupply);
    }

    elements.holderCount.textContent = formatNumber(wheelData.segments?.length || 0);
}

function updateHistory(history) {
    if (!history || history.length === 0) {
        elements.historyList.innerHTML = `
            <div class="history-empty">
                <div class="empty-icon">⏳</div>
                <span>Waiting for first spin...</span>
            </div>
        `;
        return;
    }

    elements.historyList.innerHTML = history.map((item, index) => {
        const hasTx = item.solscanUrl && item.distribution > 0;
        const prizeDisplay = item.distribution > 0
            ? `<span class="history-prize">🎉 ${item.distribution.toFixed(4)} SOL</span>`
            : '';
        const txLink = hasTx
            ? `<a href="${item.solscanUrl}" target="_blank" class="history-tx-link" title="View on Solscan">📜 TX</a>`
            : '';

        return `
        <div class="history-item ${index === 0 ? 'latest' : ''}${hasTx ? ' has-tx' : ''}">
            <div class="history-rank">#${item.id}</div>
            <div class="history-address">${item.winner.displayAddress}</div>
            <div class="history-details">
                <span class="history-amount">${item.winner.percentage.toFixed(2)}%</span>
                ${prizeDisplay}
                ${txLink}
                <span class="history-time">${item.timestampReadable}</span>
            </div>
        </div>
    `}).join('');
}

function updateHoldersList(segments) {
    if (!segments || segments.length === 0) {
        elements.holdersList.innerHTML = `
            <div class="holders-empty">
                <div class="empty-icon">🔍</div>
                <span>No holders found</span>
            </div>
        `;
        return;
    }

    // Show top 15 holders
    const topHolders = segments.slice(0, 15);

    elements.holdersList.innerHTML = topHolders.map((holder, index) => {
        const rankClass = index < 3 ? `top-3 rank-${index + 1}` : '';
        const barWidth = Math.min(holder.percentage * 4, 100); // Scale for visibility

        return `
            <div class="holder-item">
                <div class="holder-rank ${rankClass}">${index + 1}</div>
                <div class="holder-info">
                    <div class="holder-address">${holder.displayAddress}</div>
                    <div class="holder-percentage">${holder.percentage.toFixed(2)}% of supply</div>
                    <div class="holder-bar">
                        <div class="holder-bar-fill" style="width: ${barWidth}%"></div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function updateCountdown(data) {
    const seconds = data.remainingSeconds || 0;
    elements.countdownSeconds.textContent = seconds;

    // Update circular progress (283 is the circumference of the circle)
    // Using 120 seconds for 2 minute interval
    const progress = (seconds / 120) * 283;
    if (elements.countdownCircle) {
        elements.countdownCircle.style.strokeDashoffset = 283 - progress;
    }

    // Pulse effect when close to spin
    if (seconds <= 10) {
        elements.countdownSeconds.classList.add('pulse');
    } else {
        elements.countdownSeconds.classList.remove('pulse');
    }
}

function updateSpinsToday() {
    if (elements.spinsToday) {
        elements.spinsToday.textContent = spinsToday;
    }
}

// Timer for auto-closing winner announcement
let winnerAutoCloseTimer = null;
let currentWinnerAddress = null;

function showWinnerAnnouncement(winner) {
    currentWinnerAddress = winner.address;
    elements.winnerAddress.textContent = winner.displayAddress;
    elements.winnerAmount.textContent = `${winner.percentage.toFixed(2)}% of supply`;

    // Reset prize display
    const prizeElement = document.getElementById('winnerPrize');
    if (prizeElement) {
        prizeElement.textContent = 'Claiming...';
        prizeElement.onclick = null;
    }

    elements.winnerAnnouncement.classList.add('show');

    // Clear any existing timer
    if (winnerAutoCloseTimer) {
        clearTimeout(winnerAutoCloseTimer);
    }

    // Auto-close after 30 seconds
    winnerAutoCloseTimer = setTimeout(() => {
        elements.winnerAnnouncement.classList.remove('show');
        winnerAutoCloseTimer = null;
    }, 30000);
}

function updateWinnerWithDistribution(distribution) {
    const prizeElement = document.getElementById('winnerPrize');
    if (!prizeElement) return;

    if (distribution.distributed > 0) {
        const solAmount = distribution.distributed.toFixed(4);
        prizeElement.innerHTML = `<span style="color: var(--neon-green); text-shadow: var(--glow-green);">${solAmount} SOL 🎉</span>`;

        // Make clickable if we have a tx link
        if (distribution.transferTxUrl) {
            prizeElement.style.cursor = 'pointer';
            prizeElement.onclick = () => window.open(distribution.transferTxUrl, '_blank');
            prizeElement.title = 'Click to view transaction';
        }

        showToast(`🎉 ${solAmount} SOL sent to winner!`);
    } else {
        prizeElement.textContent = 'No fees available';
    }
}

function closeWinnerAnnouncement() {
    elements.winnerAnnouncement.classList.remove('show');
    if (winnerAutoCloseTimer) {
        clearTimeout(winnerAutoCloseTimer);
        winnerAutoCloseTimer = null;
    }
}

// API functions
async function fetchStatus() {
    try {
        const response = await fetch(`${API_BASE}/api/status`);
        const data = await response.json();

        if (data.success) {
            // Update token address display
            if (data.tokenMint && data.tokenMint !== 'YOUR_TOKEN_MINT_ADDRESS_HERE') {
                elements.tokenAddress.textContent = truncateAddress(data.tokenMint);
                elements.tokenAddress.dataset.fullAddress = data.tokenMint;

                if (elements.headerTokenAddress) {
                    elements.headerTokenAddress.textContent = truncateAddress(data.tokenMint);
                    elements.headerTokenAddress.dataset.fullAddress = data.tokenMint;
                }
            } else {
                elements.tokenAddress.textContent = 'Configure token address';
            }

            elements.holderCount.textContent = formatNumber(data.totalHolders);
        }
    } catch (error) {
        console.error('[App] Error fetching status:', error);
    }
}

// Event listeners
function setupEventListeners() {
    // Copy function
    const copyCa = () => {
        const address = elements.tokenAddress.dataset.fullAddress || elements.tokenAddress.textContent;
        if (address && address !== 'Configure token address' && address !== 'Loading...') {
            navigator.clipboard.writeText(address).then(() => {
                showToast('✓ Address copied!');
            }).catch(err => {
                console.error('Failed to copy:', err);
            });
        }
    };

    // Copy button
    elements.copyBtn.addEventListener('click', copyCa);

    // Header CA item
    if (elements.headerCaItem) {
        elements.headerCaItem.addEventListener('click', copyCa);
    }

    // Close winner announcement
    elements.closeWinner.addEventListener('click', () => {
        closeWinnerAnnouncement();
    });

    // Click outside winner announcement to close
    elements.winnerAnnouncement.addEventListener('click', (e) => {
        if (e.target === elements.winnerAnnouncement) {
            closeWinnerAnnouncement();
        }
    });
}

// Utility functions
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

function formatTokenAmount(amount) {
    // Assuming 6 decimal places for SPL tokens
    const normalized = amount / 1000000;
    if (normalized >= 1000000000) {
        return (normalized / 1000000000).toFixed(2) + 'B';
    } else if (normalized >= 1000000) {
        return (normalized / 1000000).toFixed(2) + 'M';
    } else if (normalized >= 1000) {
        return (normalized / 1000).toFixed(2) + 'K';
    }
    return normalized.toFixed(2);
}

function truncateAddress(address) {
    if (!address || address.length < 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function showToast(message) {
    // Remove existing toasts
    document.querySelectorAll('.toast').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.cssText = `
        position: fixed;
        bottom: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, rgba(255, 215, 0, 0.95), rgba(255, 170, 0, 0.95));
        color: #050510;
        padding: 14px 28px;
        border-radius: 50px;
        font-family: 'Orbitron', sans-serif;
        font-weight: 700;
        font-size: 0.9rem;
        letter-spacing: 1px;
        z-index: 9999;
        animation: fadeInUp 0.3s ease;
        box-shadow: 0 10px 40px rgba(255, 215, 0, 0.4);
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// Add toast and pulse animations
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeInUp {
        from { opacity: 0; transform: translateX(-50%) translateY(20px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
    .countdown-value.pulse {
        animation: countdown-pulse 0.5s ease-in-out infinite;
    }
    @keyframes countdown-pulse {
        0%, 100% { transform: scale(1); color: var(--gold); }
        50% { transform: scale(1.1); color: var(--neon-cyan); }
    }
`;
document.head.appendChild(style);
