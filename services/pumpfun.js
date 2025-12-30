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
 * Transfer SOL through hop wallets to break bubble map connections
 * Flow: Dev → Hop1 → Hop2 → Winner
 */
async function transferWithHops(winnerAddress, amountSol) {
    if (!isConfigured) {
        return { success: false, error: 'Service not configured' };
    }

    try {
        console.log(`[PumpFun] Starting hop transfer of ${amountSol} SOL to winner: ${winnerAddress}`);

        // Validate winner address
        let winnerPubkey;
        try {
            winnerPubkey = new PublicKey(winnerAddress);
        } catch {
            return { success: false, error: 'Invalid winner address' };
        }

        // Generate two fresh hop wallets
        const hop1 = Keypair.generate();
        const hop2 = Keypair.generate();

        console.log(`[PumpFun] Hop1: ${hop1.publicKey.toBase58()}`);
        console.log(`[PumpFun] Hop2: ${hop2.publicKey.toBase58()}`);

        // Calculate amounts (account for tx fees at each hop)
        const TX_FEE = 0.000005; // ~5000 lamports per tx
        const totalFees = TX_FEE * 3; // 3 transfers

        if (amountSol <= totalFees + 0.001) {
            return { success: false, error: 'Amount too small for hop transfer' };
        }

        const hop1Amount = amountSol - TX_FEE;
        const hop2Amount = hop1Amount - TX_FEE;
        const winnerAmount = hop2Amount - TX_FEE;

        const signatures = [];

        // Transfer 1: Dev → Hop1
        console.log(`[PumpFun] Transfer 1: Dev → Hop1 (${hop1Amount.toFixed(6)} SOL)`);
        const tx1 = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: creatorKeypair.publicKey,
                toPubkey: hop1.publicKey,
                lamports: Math.floor(hop1Amount * LAMPORTS_PER_SOL)
            })
        );
        const sig1 = await sendAndConfirmTransaction(connection, tx1, [creatorKeypair], { commitment: 'confirmed' });
        signatures.push(sig1);
        console.log(`[PumpFun] Transfer 1 complete: ${sig1}`);

        // Small delay between hops
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Transfer 2: Hop1 → Hop2
        console.log(`[PumpFun] Transfer 2: Hop1 → Hop2 (${hop2Amount.toFixed(6)} SOL)`);
        const tx2 = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: hop1.publicKey,
                toPubkey: hop2.publicKey,
                lamports: Math.floor(hop2Amount * LAMPORTS_PER_SOL)
            })
        );
        const sig2 = await sendAndConfirmTransaction(connection, tx2, [hop1], { commitment: 'confirmed' });
        signatures.push(sig2);
        console.log(`[PumpFun] Transfer 2 complete: ${sig2}`);

        // Small delay between hops
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Transfer 3: Hop2 → Winner
        console.log(`[PumpFun] Transfer 3: Hop2 → Winner (${winnerAmount.toFixed(6)} SOL)`);
        const tx3 = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: hop2.publicKey,
                toPubkey: winnerPubkey,
                lamports: Math.floor(winnerAmount * LAMPORTS_PER_SOL)
            })
        );
        const sig3 = await sendAndConfirmTransaction(connection, tx3, [hop2], { commitment: 'confirmed' });
        signatures.push(sig3);
        console.log(`[PumpFun] Transfer 3 complete: ${sig3}`);

        console.log(`[PumpFun] Hop transfer complete! Final amount: ${winnerAmount.toFixed(6)} SOL`);

        return {
            success: true,
            signature: sig3, // Return final signature as main signature
            signatures: signatures,
            amount: winnerAmount,
            txUrl: `https://solscan.io/tx/${sig3}`,
            hops: [
                { from: 'dev', to: hop1.publicKey.toBase58(), sig: sig1 },
                { from: hop1.publicKey.toBase58(), to: hop2.publicKey.toBase58(), sig: sig2 },
                { from: hop2.publicKey.toBase58(), to: winnerAddress, sig: sig3 }
            ]
        };
    } catch (error) {
        console.error('[PumpFun] Hop transfer failed:', error.message);
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
        const distributeAmount = claimedAmount - keepAmount - 0.003; // Reserve for 3 hop tx fees

        if (distributeAmount <= 0.002) {
            return {
                success: true,
                claimed: claimedAmount,
                distributed: 0,
                message: 'Claimed amount too small to distribute via hops'
            };
        }

        // Transfer to winner via hop wallets (breaks bubble map connections)
        const transferResult = await transferWithHops(winnerAddress, distributeAmount);

        if (!transferResult.success) {
            return {
                success: false,
                claimed: claimedAmount,
                distributed: 0,
                error: transferResult.error
            };
        }

        return {
            success: true,
            claimed: claimedAmount,
            distributed: transferResult.amount, // Use actual amount received by winner
            claimTx: claimResult.signature,
            transferSignature: transferResult.signature,
            transferTxUrl: transferResult.txUrl,
            hops: transferResult.hops
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
    transferWithHops,
    claimAndDistribute,
    isReady,
    getCreatorPublicKey
};
