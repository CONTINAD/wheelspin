/**
 * Wheel Logic Service
 * Handles weighted random selection and spin history
 */

// Store spin history
const spinHistory = [];
const MAX_HISTORY = 50;

// Recent winners cooldown (can't win for next N spins)
const recentWinners = [];
const WINNER_COOLDOWN_SPINS = 2;

/**
 * Perform weighted random selection based on token holdings
 * Holders with more tokens have proportionally higher chances
 * Recent winners are excluded from selection
 */
function selectWinner(segments) {
    if (!segments || segments.length === 0) {
        return null;
    }

    // Filter out recent winners from eligible segments
    let eligibleSegments = segments.filter(seg => !recentWinners.includes(seg.address));

    // If all segments are on cooldown (edge case with few holders), reset cooldown
    if (eligibleSegments.length === 0) {
        console.log('[Wheel] All holders on cooldown, resetting...');
        recentWinners.length = 0;
        eligibleSegments = segments;
    }

    // Calculate total weight (total tokens) of eligible segments
    const totalWeight = eligibleSegments.reduce((sum, seg) => sum + seg.amount, 0);

    // Generate random number between 0 and total weight
    const random = Math.random() * totalWeight;

    // Find the winner based on cumulative weight
    let cumulativeWeight = 0;
    let winner = null;
    for (const segment of eligibleSegments) {
        cumulativeWeight += segment.amount;
        if (random <= cumulativeWeight) {
            winner = segment;
            break;
        }
    }

    // Fallback to last eligible segment
    if (!winner) {
        winner = eligibleSegments[eligibleSegments.length - 1];
    }

    // Add winner to cooldown list
    if (winner) {
        recentWinners.push(winner.address);
        // Keep only last N winners in cooldown
        while (recentWinners.length > WINNER_COOLDOWN_SPINS) {
            recentWinners.shift();
        }
        console.log(`[Wheel] Winner: ${winner.displayAddress} - On cooldown for next ${WINNER_COOLDOWN_SPINS} spins`);
    }

    return winner;
}

/**
 * Calculate the wheel position (in degrees) for a given winner
 * Returns the degree where the wheel should stop
 */
function calculateWinningDegree(segments, winnerIndex) {
    if (!segments || segments.length === 0 || winnerIndex < 0) {
        return 0;
    }

    // Calculate the starting degree for each segment
    let currentDegree = 0;
    const segmentDegrees = segments.map(seg => {
        const startDegree = currentDegree;
        const segmentSize = (seg.percentage / 100) * 360;
        currentDegree += segmentSize;
        return {
            start: startDegree,
            end: currentDegree,
            center: startDegree + (segmentSize / 2)
        };
    });

    // Return the center of the winning segment
    // Add some randomness within the segment for natural feel
    const winnerDegrees = segmentDegrees[winnerIndex];
    const segmentSize = winnerDegrees.end - winnerDegrees.start;
    const randomOffset = (Math.random() - 0.5) * segmentSize * 0.6; // Stay within 60% of segment center

    return winnerDegrees.center + randomOffset;
}

/**
 * Record a spin result in history
 */
function recordSpin(winner, timestamp = new Date()) {
    const record = {
        id: spinHistory.length + 1,
        winner: {
            address: winner.address,
            displayAddress: winner.displayAddress,
            amount: winner.amount,
            percentage: winner.percentage
        },
        timestamp: timestamp.toISOString(),
        timestampReadable: formatTimestamp(timestamp),
        distribution: null, // Will be updated when fee distribution completes
        txSignature: null,
        solscanUrl: null
    };

    spinHistory.unshift(record);

    // Keep only the most recent spins
    if (spinHistory.length > MAX_HISTORY) {
        spinHistory.pop();
    }

    return record;
}

/**
 * Update the most recent spin with distribution info
 */
function updateLatestSpinDistribution(distribution) {
    if (spinHistory.length === 0 || !distribution) return false;

    const latestSpin = spinHistory[0];

    if (distribution.distributed > 0) {
        latestSpin.distribution = distribution.distributed;
        latestSpin.txSignature = distribution.transferSignature || null;
        latestSpin.solscanUrl = distribution.transferTxUrl || null;
    }

    return true;
}

/**
 * Get spin history
 */
function getSpinHistory(limit = 10) {
    return spinHistory.slice(0, limit);
}

/**
 * Format timestamp for display
 */
function formatTimestamp(date) {
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
}

/**
 * Calculate time until next spin
 */
function getTimeUntilNextSpin(lastSpinTime, intervalMs = 60000) {
    const now = Date.now();
    const nextSpinTime = lastSpinTime + intervalMs;
    const remaining = Math.max(0, nextSpinTime - now);

    return {
        remainingMs: remaining,
        remainingSeconds: Math.ceil(remaining / 1000),
        nextSpinTime: new Date(nextSpinTime).toISOString()
    };
}

module.exports = {
    selectWinner,
    calculateWinningDegree,
    recordSpin,
    getSpinHistory,
    getTimeUntilNextSpin,
    updateLatestSpinDistribution
};
