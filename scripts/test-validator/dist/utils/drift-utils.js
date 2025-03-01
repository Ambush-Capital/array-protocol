"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.forceCloseWebSockets = exports.safeUnsubscribe = exports.createDriftClient = exports.deriveDriftStatePDA = exports.deriveSpotMarketVaultPDA = exports.fetchAndDisplayUserAccount = exports.displayDriftUsdcBalance = void 0;
const web3_js_1 = require("@solana/web3.js");
const sdk_1 = require("@drift-labs/sdk");
const ui_utils_1 = require("./ui-utils");
const connection_utils_1 = require("./connection-utils");
const displayDriftUsdcBalance = async (driftClient) => {
    try {
        const userAccount = await driftClient.getUserAccount();
        const spotPosition = userAccount.spotPositions.find(position => position.marketIndex === 0 && position.scaledBalance.gt(new sdk_1.BN(0)));
        if (spotPosition) {
            const balance = new sdk_1.BN(spotPosition.scaledBalance.toString())
                .mul(new sdk_1.BN(10).pow(new sdk_1.BN(sdk_1.QUOTE_PRECISION_EXP)))
                .div(new sdk_1.BN(2).pow(new sdk_1.BN(64)));
            console.log(`${ui_utils_1.UI.checkmark} Current USDC balance in Drift: ${spotPosition.scaledBalance.toString()} USDC`);
            return balance;
        }
        else {
            console.log(`${ui_utils_1.UI.xmark} No USDC position found in Drift`);
            return null;
        }
    }
    catch (error) {
        console.error(`${ui_utils_1.UI.xmark} Error fetching Drift USDC balance:`, error);
        return null;
    }
};
exports.displayDriftUsdcBalance = displayDriftUsdcBalance;
const fetchAndDisplayUserAccount = async (driftClient) => {
    try {
        console.log(`${ui_utils_1.UI.loading} Fetching user account details...`);
        const userAccount = await driftClient.getUserAccount();
        console.log(`${ui_utils_1.UI.checkmark} User account details:`);
        console.log(`  - Sub Account ID: ${userAccount.subAccountId}`);
        console.log(`  - Authority: ${userAccount.authority.toString()}`);
        console.log(`  - Delegate: ${userAccount.delegate.toString()}`);
        console.log(`  - Spot positions count: ${userAccount.spotPositions.length}`);
        return userAccount;
    }
    catch (error) {
        console.error(`${ui_utils_1.UI.xmark} Error fetching user account.`);
        throw error;
    }
};
exports.fetchAndDisplayUserAccount = fetchAndDisplayUserAccount;
const deriveSpotMarketVaultPDA = async (programId, marketIndex) => {
    const marketIndexBuffer = Buffer.alloc(2);
    marketIndexBuffer.writeUInt16LE(marketIndex, 0);
    const seeds = [
        Buffer.from("spot_market_vault"),
        marketIndexBuffer
    ];
    return web3_js_1.PublicKey.findProgramAddressSync(seeds, programId);
};
exports.deriveSpotMarketVaultPDA = deriveSpotMarketVaultPDA;
const deriveDriftStatePDA = async (programId) => {
    const seeds = [Buffer.from("drift_state")];
    return web3_js_1.PublicKey.findProgramAddressSync(seeds, programId);
};
exports.deriveDriftStatePDA = deriveDriftStatePDA;
const createDriftClient = async (connection, wallet) => {
    console.log(`${ui_utils_1.UI.loading} Initializing Drift client...`);
    const driftPublicKey = new web3_js_1.PublicKey(connection_utils_1.CONSTANTS.DRIFT_PROGRAM_ID);
    const driftClient = new sdk_1.DriftClient({
        connection,
        wallet,
        programID: driftPublicKey,
        opts: {
            commitment: 'confirmed',
            skipPreflight: false,
        },
    });
    await driftClient.subscribe();
    console.log(`${ui_utils_1.UI.checkmark} Drift client initialized and subscribed`);
    return driftClient;
};
exports.createDriftClient = createDriftClient;
/**
 * Safely unsubscribes from the Drift client and cleans up resources
 * @param connection - Solana connection
 * @param driftClient - Drift client
 * @param timeoutMs - Timeout in milliseconds
 */
const safeUnsubscribe = async (connection, driftClient, timeoutMs = 500) => {
    console.log('🔄 Unsubscribing from Drift client...');
    let unsubscribed = false;
    try {
        // Create a promise that resolves when unsubscribe completes
        const unsubscribePromise = driftClient.unsubscribe();
        // Create a promise that rejects after timeout
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Unsubscribe timeout')), timeoutMs));
        // Race the promises
        await Promise.race([unsubscribePromise, timeoutPromise]);
        console.log(`${ui_utils_1.UI.checkmark} Successfully unsubscribed`);
        unsubscribed = true;
    }
    catch (error) {
        console.warn(`⚠️ Unsubscribe issue: ${error.message}`);
        // Attempt to force close WebSocket connections
        await (0, exports.forceCloseWebSockets)(connection);
    }
    return unsubscribed;
};
exports.safeUnsubscribe = safeUnsubscribe;
/**
 * Force closes any open WebSocket connections
 * @param connection - Solana connection
 */
const forceCloseWebSockets = async (connection) => {
    if (connection && connection._rpcWebSocket) {
        try {
            connection._rpcWebSocket.close();
            console.log(`${ui_utils_1.UI.checkmark} Forcibly closed WebSocket connection`);
        }
        catch (wsError) {
            console.warn(`⚠️ Failed to close WebSocket: ${wsError.message}`);
        }
    }
};
exports.forceCloseWebSockets = forceCloseWebSockets;
