const fetch = require('node-fetch');

// Helius RPC Configuration
const HELIUS_RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=ae211108-bdbf-40af-90e2-c5418e3f62d3';

/**
 * Fetch all token holders for a given mint address using Helius DAS API
 * Handles pagination for tokens with >1000 holders
 */
async function getTokenHolders(mintAddress) {
    const allHolders = [];
    let cursor = null;
    let hasMore = true;

    console.log(`[Helius] Fetching token holders for mint: ${mintAddress}`);

    while (hasMore) {
        try {
            const params = {
                mint: mintAddress,
                limit: 1000
            };

            if (cursor) {
                params.cursor = cursor;
            }

            const response = await fetch(HELIUS_RPC_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: '1',
                    method: 'getTokenAccounts',
                    params: params
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.error) {
                throw new Error(`RPC error: ${data.error.message}`);
            }

            const result = data.result;

            if (result && result.token_accounts) {
                // Filter out zero balance accounts and process
                const validAccounts = result.token_accounts.filter(acc => acc.amount > 0);
                allHolders.push(...validAccounts);

                console.log(`[Helius] Fetched ${validAccounts.length} holders (total: ${allHolders.length})`);

                // Check if there's more data to fetch
                if (result.cursor && result.token_accounts.length === 1000) {
                    cursor = result.cursor;
                } else {
                    hasMore = false;
                }
            } else {
                hasMore = false;
            }

        } catch (error) {
            console.error('[Helius] Error fetching token holders:', error.message);
            hasMore = false;
        }
    }

    // Sort by amount (descending) and return
    allHolders.sort((a, b) => b.amount - a.amount);

    console.log(`[Helius] Total holders found: ${allHolders.length}`);
    return allHolders;
}

/**
 * Process holders into wheel segment data
 * Each segment size is proportional to the holder's token amount
 * Note: Excludes DEX and liquidity pool addresses from the wheel
 */

// Known liquidity pool and DEX addresses to exclude
const EXCLUDED_ADDRESSES = [
    '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1', // Raydium Authority V4
    '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', // Raydium AMM Program
    'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK', // Raydium CPMM
    '39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg', // Raydium CLMM
    'So11111111111111111111111111111111111111112',   // Wrapped SOL
];

function processHoldersForWheel(holders) {
    if (!holders || holders.length === 0) {
        return { segments: [], totalSupply: 0 };
    }

    // Exclude the top holder (DEX) and any known LP/DEX addresses
    // Holders are already sorted by amount descending, so first one is typically the DEX
    const eligibleHolders = holders.slice(1).filter(holder =>
        !EXCLUDED_ADDRESSES.includes(holder.owner)
    );

    if (eligibleHolders.length === 0) {
        return { segments: [], totalSupply: 0 };
    }

    // Calculate total supply held by eligible holders (excluding DEX/LP)
    const totalSupply = eligibleHolders.reduce((sum, h) => sum + h.amount, 0);

    // Create segments with percentages
    const segments = eligibleHolders.map((holder, index) => {
        const percentage = (holder.amount / totalSupply) * 100;
        return {
            id: index,
            address: holder.owner,
            amount: holder.amount,
            percentage: percentage,
            displayAddress: truncateAddress(holder.owner),
            color: generateColor(index, eligibleHolders.length)
        };
    });

    return { segments, totalSupply };
}

/**
 * Truncate address for display (first 4 and last 4 chars)
 */
function truncateAddress(address) {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

/**
 * Generate a vibrant color for each segment
 */
function generateColor(index, total) {
    // Use HSL for even distribution of colors
    const hue = (index * 360 / Math.max(total, 1)) % 360;
    // Alternate between different saturations and lightnesses for variety
    const saturation = 70 + (index % 3) * 10;
    const lightness = 45 + (index % 2) * 15;
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Find tokens created by a specific wallet address
 * Uses Helius DAS API getAssetsByCreator
 */
async function getCreatedTokens(creatorAddress) {
    console.log(`[Helius] Looking up tokens created by: ${creatorAddress}`);

    try {
        const response = await fetch(HELIUS_RPC_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: '1',
                method: 'getAssetsByCreator',
                params: {
                    creatorAddress: creatorAddress,
                    onlyVerified: false,
                    page: 1,
                    limit: 100
                }
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(`RPC error: ${data.error.message}`);
        }

        const assets = data.result?.items || [];

        // Filter for fungible tokens (not NFTs)
        const tokens = assets.filter(asset =>
            asset.interface === 'FungibleToken' ||
            asset.interface === 'FungibleAsset' ||
            (asset.content?.metadata?.token_standard === 'Fungible')
        );

        console.log(`[Helius] Found ${tokens.length} tokens created by wallet`);

        // Return the most recent token (likely the one they want)
        if (tokens.length > 0) {
            // Sort by creation time if available, or just take first
            const token = tokens[0];
            return {
                success: true,
                mint: token.id,
                name: token.content?.metadata?.name || 'Unknown Token',
                symbol: token.content?.metadata?.symbol || 'TOKEN'
            };
        }

        // If no fungible tokens found, check if any assets exist
        if (assets.length > 0) {
            console.log(`[Helius] Found ${assets.length} assets but no fungible tokens`);
        }

        return { success: false, error: 'No tokens found for this creator wallet' };

    } catch (error) {
        console.error('[Helius] Error fetching created tokens:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    getTokenHolders,
    processHoldersForWheel,
    truncateAddress,
    getCreatedTokens
};
