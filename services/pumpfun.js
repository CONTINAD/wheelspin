/**
 * PumpFun Fee Claiming & Distribution Service
 * Uses PumpPortal Local Transaction API
 */

const { Connection, Keypair, PublicKey, VersionedTransaction, LAMPORTS_PER_SOL, SystemProgram, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');
const fetch = require('node-fetch');

// Handle bs58 package version differences
let bs58Decode;
try {
    const bs58 = require('bs58');
    // Check if it's the new version (default export is the object with decode)
    if (typeof bs58.decode === 'function') {
        bs58Decode = bs58.decode;
    } else if (typeof bs58.default?.decode === 'function') {
        bs58Decode = bs58.default.decode;
    } else if (typeof bs58 === 'function') {
        // Very old version
        bs58Decode = bs58;
    } else {
        // Fallback - try to decode manually or throw
        throw new Error('Unsupported bs58 version');
    }
} catch (e) {
    console.error('[PumpFun] bs58 import error:', e.message);
    // Provide fallback using Buffer
    bs58Decode = (str) => {
        const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
        const ALPHABET_MAP = {};
        for (let i = 0; i < ALPHABET.length; i++) {
            ALPHABET_MAP[ALPHABET.charAt(i)] = i;
        }

        if (str.length === 0) return new Uint8Array(0);

        const bytes = [0];
        for (let i = 0; i < str.length; i++) {
            const c = str[i];
            if (!(c in ALPHABET_MAP)) throw new Error('Invalid base58 character');

            let carry = ALPHABET_MAP[c];
            for (let j = 0; j < bytes.length; j++) {
                carry += bytes[j] * 58;
                bytes[j] = carry & 0xff;
                carry >>= 8;
            }
            while (carry > 0) {
                bytes.push(carry & 0xff);
                carry >>= 8;
            }
        }

        for (let i = 0; i < str.length && str[i] === '1'; i++) {
            bytes.push(0);
        }

        return new Uint8Array(bytes.reverse());
    };
}


// Configuration from environment
let connection = null;
let creatorKeypair = null;
let isConfigured = false;

/**
 * Initialize the PumpFun service with credentials
 */
function initialize(privateKey, rpcEndpoint) {
    try {
        // Decode private key from base58
        const secretKey = bs58Decode(privateKey);
        creatorKeypair = Keypair.fromSecretKey(secretKey);

        // Setup Solana connection
        connection = new Connection(rpcEndpoint, 'confirmed');

        isConfigured = true;
        console.log(`[PumpFun] Initialized with creator wallet: ${creatorKeypair.publicKey.toBase58()}`);

        return {
            success: true,
            publicKey: creatorKeypair.publicKey.toBase58()
        };
    } catch (error) {
        console.error('[PumpFun] Failed to initialize:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Get the current SOL balance of the creator wallet
 */
async function getCreatorBalance() {
    if (!isConfigured) {
        return { success: false, error: 'Service not configured' };
    }

    try {
        const balance = await connection.getBalance(creatorKeypair.publicKey);
        const solBalance = balance / LAMPORTS_PER_SOL;

        console.log(`[PumpFun] Creator wallet balance: ${solBalance} SOL`);

        return {
            success: true,
            balance: solBalance,
            lamports: balance
        };
    } catch (error) {
        console.error('[PumpFun] Failed to get balance:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Claim creator fees from PumpFun using PumpPortal API
 */
async function claimCreatorFees() {
    if (!isConfigured) {
        return { success: false, error: 'Service not configured' };
    }

    try {
        console.log('[PumpFun] Claiming creator fees...');

        // Request transaction from PumpPortal
        const response = await fetch('https://pumpportal.fun/api/trade-local', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                publicKey: creatorKeypair.publicKey.toBase58(),
                action: 'collectCreatorFee',
                priorityFee: 0.0001, // 0.0001 SOL priority fee
                pool: 'pump'
            })
        });

        if (response.status !== 200) {
            const errorText = await response.text();
            console.log('[PumpFun] No fees to claim or error:', errorText);
            return {
                success: false,
                error: errorText || 'No fees available to claim'
            };
        }

        // Deserialize and sign the transaction
        const data = await response.arrayBuffer();
        const tx = VersionedTransaction.deserialize(new Uint8Array(data));
        tx.sign([creatorKeypair]);

        // Send the transaction
        const signature = await connection.sendTransaction(tx, {
            skipPreflight: false,
            preflightCommitment: 'confirmed'
        });

        console.log(`[PumpFun] Fee claim transaction sent: ${signature}`);

        // Wait for confirmation
        const confirmation = await connection.confirmTransaction(signature, 'confirmed');

        if (confirmation.value.err) {
            return {
                success: false,
                error: 'Transaction failed',
                signature
            };
        }

        console.log(`[PumpFun] Fees claimed successfully! TX: ${signature}`);

        return {
            success: true,
            signature,
            txUrl: `https://solscan.io/tx/${signature}`
        };
    } catch (error) {
        console.error('[PumpFun] Failed to claim fees:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Transfer SOL to the winner
 */
async function transferToWinner(winnerAddress, amountSol) {
    if (!isConfigured) {
        return { success: false, error: 'Service not configured' };
    }

    try {
        console.log(`[PumpFun] Transferring ${amountSol} SOL to winner: ${winnerAddress}`);

        // Validate winner address
        let winnerPubkey;
        try {
            winnerPubkey = new PublicKey(winnerAddress);
        } catch {
            return { success: false, error: 'Invalid winner address' };
        }

        // Calculate lamports (leave some for future tx fees)
        const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

        if (lamports <= 0) {
            return { success: false, error: 'Amount too small' };
        }

        // Create transfer instruction
        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: creatorKeypair.publicKey,
                toPubkey: winnerPubkey,
                lamports: lamports
            })
        );

        // Send and confirm
        const signature = await sendAndConfirmTransaction(
            connection,
            transaction,
            [creatorKeypair],
            { commitment: 'confirmed' }
        );

        console.log(`[PumpFun] Transfer successful! TX: ${signature}`);

        return {
            success: true,
            signature,
            amount: amountSol,
            txUrl: `https://solscan.io/tx/${signature}`
        };
    } catch (error) {
        console.error('[PumpFun] Failed to transfer:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Claim fees and distribute to winner in one operation
 */
async function claimAndDistribute(winnerAddress, keepPercentage = 10) {
    if (!isConfigured) {
        return { success: false, error: 'Service not configured' };
    }

    try {
        // Get balance before claim
        const balanceBefore = await getCreatorBalance();
        if (!balanceBefore.success) {
            return balanceBefore;
        }

        // Claim fees
        const claimResult = await claimCreatorFees();

        // Wait a moment for balance to update
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Get balance after claim
        const balanceAfter = await getCreatorBalance();
        if (!balanceAfter.success) {
            return balanceAfter;
        }

        // Calculate claimed amount
        const claimedAmount = balanceAfter.balance - balanceBefore.balance;

        if (claimedAmount <= 0.001) {
            console.log('[PumpFun] No significant fees claimed');
            return {
                success: true,
                claimed: 0,
                distributed: 0,
                message: 'No fees to distribute'
            };
        }

        // Calculate amount to send (keep some percentage)
        const keepAmount = claimedAmount * (keepPercentage / 100);
        const distributeAmount = claimedAmount - keepAmount - 0.001; // Reserve for tx fee

        if (distributeAmount <= 0) {
            return {
                success: true,
                claimed: claimedAmount,
                distributed: 0,
                message: 'Claimed amount too small to distribute'
            };
        }

        // Transfer to winner
        const transferResult = await transferToWinner(winnerAddress, distributeAmount);

        return {
            success: true,
            claimed: claimedAmount,
            distributed: distributeAmount,
            claimTx: claimResult.signature,
            transferTx: transferResult.signature,
            transferTxUrl: transferResult.txUrl
        };
    } catch (error) {
        console.error('[PumpFun] Claim and distribute failed:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Check if service is properly configured
 */
function isReady() {
    return isConfigured;
}

/**
 * Get creator public key
 */
function getCreatorPublicKey() {
    if (!isConfigured) return null;
    return creatorKeypair.publicKey.toBase58();
}

module.exports = {
    initialize,
    getCreatorBalance,
    claimCreatorFees,
    transferToWinner,
    claimAndDistribute,
    isReady,
    getCreatorPublicKey
};
