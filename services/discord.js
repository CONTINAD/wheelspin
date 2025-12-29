/**
 * Discord Webhook Logger
 * Sends all important events to Discord for monitoring
 */

const fetch = require('node-fetch');

const WEBHOOK_URL = 'https://discord.com/api/webhooks/1455347629352419380/g0X4dphZlxxIf38sJIjkOX_CksDJ-SpybCcqgfvyxvUAINskJQNIog07IRY8tgMtyIeX';

// Color codes for Discord embeds
const COLORS = {
    success: 0x00ff00,  // Green
    error: 0xff0000,    // Red
    warning: 0xffff00,  // Yellow
    info: 0x00ffff,     // Cyan
    spin: 0xffd700,     // Gold
    money: 0x00c853     // Money green
};

/**
 * Send a message to Discord webhook
 */
async function sendToDiscord(title, description, color = COLORS.info, fields = []) {
    try {
        const embed = {
            title: title,
            description: description,
            color: color,
            timestamp: new Date().toISOString(),
            fields: fields,
            footer: {
                text: '$WHEEL Server'
            }
        };

        await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed] })
        });
    } catch (error) {
        console.error('[Discord] Failed to send webhook:', error.message);
    }
}

// Logging functions
const logger = {
    // Server events
    serverStart: async (port, tokenMint) => {
        await sendToDiscord(
            '🚀 Server Started',
            `$WHEEL server is now running!`,
            COLORS.success,
            [
                { name: 'Port', value: `${port}`, inline: true },
                { name: 'Token', value: tokenMint ? `\`${tokenMint.slice(0, 20)}...\`` : 'Auto-detecting...', inline: true }
            ]
        );
    },

    tokenDetected: async (mint, name, symbol) => {
        await sendToDiscord(
            '🪙 Token Auto-Detected',
            `Found token created by wallet`,
            COLORS.success,
            [
                { name: 'Name', value: name || 'Unknown', inline: true },
                { name: 'Symbol', value: symbol || 'TOKEN', inline: true },
                { name: 'Mint', value: `\`${mint}\``, inline: false }
            ]
        );
    },

    tokenDetectFailed: async (error) => {
        await sendToDiscord(
            '❌ Token Detection Failed',
            `Could not auto-detect token from creator wallet`,
            COLORS.error,
            [{ name: 'Error', value: error, inline: false }]
        );
    },

    // Holder events
    holdersRefreshed: async (count, tokenMint) => {
        await sendToDiscord(
            '👥 Holders Refreshed',
            `Updated holder data from Helius`,
            COLORS.info,
            [
                { name: 'Total Holders', value: `${count}`, inline: true },
                { name: 'Token', value: `\`${tokenMint?.slice(0, 12)}...\``, inline: true }
            ]
        );
    },

    holdersError: async (error) => {
        await sendToDiscord(
            '❌ Holder Refresh Failed',
            `Error fetching holder data`,
            COLORS.error,
            [{ name: 'Error', value: error, inline: false }]
        );
    },

    // Spin events
    spinStarted: async () => {
        await sendToDiscord(
            '🎰 Spin Started',
            `Wheel is spinning...`,
            COLORS.spin
        );
    },

    spinWinner: async (winner) => {
        await sendToDiscord(
            '🏆 Winner Selected!',
            `The wheel has chosen a winner!`,
            COLORS.spin,
            [
                { name: 'Address', value: `\`${winner.address}\``, inline: false },
                { name: 'Display', value: winner.displayAddress, inline: true },
                { name: 'Holdings', value: `${winner.percentage.toFixed(2)}%`, inline: true }
            ]
        );
    },

    // Fee claiming events
    pumpfunEnabled: async (publicKey) => {
        await sendToDiscord(
            '✅ PumpFun Fee Claiming Enabled',
            `Fee claiming is now active!`,
            COLORS.success,
            [{ name: 'Creator Wallet', value: `\`${publicKey}\``, inline: false }]
        );
    },

    pumpfunDisabled: async () => {
        await sendToDiscord(
            '⚠️ PumpFun Fee Claiming Disabled',
            `No private key configured. Fee distribution will not work.`,
            COLORS.warning
        );
    },

    pumpfunInitError: async (error) => {
        await sendToDiscord(
            '❌ PumpFun Init Failed',
            `Could not initialize fee claiming`,
            COLORS.error,
            [{ name: 'Error', value: error, inline: false }]
        );
    },

    feeClaimAttempt: async (winnerAddress) => {
        await sendToDiscord(
            '💸 Claiming Fees...',
            `Attempting to claim and distribute creator fees`,
            COLORS.money,
            [{ name: 'Winner', value: `\`${winnerAddress}\``, inline: false }]
        );
    },

    feeClaimSuccess: async (amount, signature, winnerAddress) => {
        const solscanUrl = `https://solscan.io/tx/${signature}`;
        await sendToDiscord(
            '🎉 Fees Distributed!',
            `Successfully sent SOL to winner!`,
            COLORS.money,
            [
                { name: 'Amount', value: `${amount.toFixed(6)} SOL`, inline: true },
                { name: 'Winner', value: `\`${winnerAddress.slice(0, 12)}...\``, inline: true },
                { name: 'Transaction', value: `[View on Solscan](${solscanUrl})`, inline: false }
            ]
        );
    },

    feeClaimNoFees: async () => {
        await sendToDiscord(
            '📭 No Fees Available',
            `No creator fees to distribute this round`,
            COLORS.warning
        );
    },

    feeClaimError: async (error) => {
        await sendToDiscord(
            '❌ Fee Claim Failed',
            `Error during fee claiming/distribution`,
            COLORS.error,
            [{ name: 'Error', value: error, inline: false }]
        );
    },

    balanceUpdate: async (balance) => {
        await sendToDiscord(
            '💰 Balance Updated',
            `Creator wallet balance checked`,
            COLORS.info,
            [{ name: 'Balance', value: `${balance.toFixed(6)} SOL`, inline: true }]
        );
    },

    // Generic error
    error: async (title, error) => {
        await sendToDiscord(
            `❌ ${title}`,
            `An error occurred`,
            COLORS.error,
            [{ name: 'Error', value: String(error).slice(0, 1000), inline: false }]
        );
    },

    // Generic info
    info: async (title, message) => {
        await sendToDiscord(
            `ℹ️ ${title}`,
            message,
            COLORS.info
        );
    }
};

module.exports = logger;
