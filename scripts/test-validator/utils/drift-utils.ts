import { Connection, PublicKey } from '@solana/web3.js';
import { DriftClient, BN, UserAccount, QUOTE_PRECISION_EXP } from '@drift-labs/sdk';
import { UI } from './ui-utils';
import { CONSTANTS } from './connection-utils';

export const displayDriftUsdcBalance = async (driftClient: DriftClient): Promise<BN | null> => {
    try {
        const userAccount = await driftClient.getUserAccount();

        const spotPosition = userAccount.spotPositions.find(
            position => position.marketIndex === 0 && position.scaledBalance.gt(new BN(0))
        );

        if (spotPosition) {
            const balance = new BN(spotPosition.scaledBalance.toString())
                .mul(new BN(10).pow(new BN(QUOTE_PRECISION_EXP)))
                .div(new BN(2).pow(new BN(64)));

            console.log(`${UI.checkmark} Current USDC balance in Drift: ${spotPosition.scaledBalance.toString()} USDC`);
            return balance;
        } else {
            console.log(`${UI.xmark} No USDC position found in Drift`);
            return null;
        }
    } catch (error) {
        console.error(`${UI.xmark} Error fetching Drift USDC balance:`, error);
        return null;
    }
};

export const fetchAndDisplayUserAccount = async (driftClient: DriftClient): Promise<UserAccount> => {
    try {
        console.log(`${UI.loading} Fetching user account details...`);
        const userAccount = await driftClient.getUserAccount();
        console.log(`${UI.checkmark} User account details:`);
        console.log(`  - Sub Account ID: ${userAccount.subAccountId}`);
        console.log(`  - Authority: ${userAccount.authority.toString()}`);
        console.log(`  - Delegate: ${userAccount.delegate.toString()}`);
        console.log(`  - Spot positions count: ${userAccount.spotPositions.length}`);
        return userAccount;
    } catch (error) {
        console.error(`${UI.xmark} Error fetching user account.`);
        throw error;
    }
};

export const deriveSpotMarketVaultPDA = async (
    programId: PublicKey,
    marketIndex: number
): Promise<[PublicKey, number]> => {
    const marketIndexBuffer = Buffer.alloc(2);
    marketIndexBuffer.writeUInt16LE(marketIndex, 0);

    const seeds = [
        Buffer.from("spot_market_vault"),
        marketIndexBuffer
    ];

    return PublicKey.findProgramAddressSync(seeds, programId);
};

export const deriveDriftStatePDA = async (programId: PublicKey): Promise<[PublicKey, number]> => {
    const seeds = [Buffer.from("drift_state")];
    return PublicKey.findProgramAddressSync(seeds, programId);
};

export const createDriftClient = async (
    connection: Connection,
    wallet: any
): Promise<DriftClient> => {
    console.log(`${UI.loading} Initializing Drift client...`);
    const driftPublicKey = new PublicKey(CONSTANTS.DRIFT_PROGRAM_ID);

    const driftClient = new DriftClient({
        connection,
        wallet,
        programID: driftPublicKey,
        opts: {
            commitment: 'confirmed',
            skipPreflight: false,
        },
    });

    await driftClient.subscribe();
    console.log(`${UI.checkmark} Drift client initialized and subscribed`);

    return driftClient;
};

/**
 * Safely unsubscribes from the Drift client and cleans up resources
 * @param connection - Solana connection
 * @param driftClient - Drift client
 * @param timeoutMs - Timeout in milliseconds
 */
export const safeUnsubscribe = async (
    connection: Connection,
    driftClient: DriftClient,
    timeoutMs: number = 500
): Promise<boolean> => {
    console.log('🔄 Unsubscribing from Drift client...');
    let unsubscribed = false;

    try {
        // Create a promise that resolves when unsubscribe completes
        const unsubscribePromise = driftClient.unsubscribe();

        // Create a promise that rejects after timeout
        const timeoutPromise = new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error('Unsubscribe timeout')), timeoutMs)
        );

        // Race the promises
        await Promise.race([unsubscribePromise, timeoutPromise]);
        console.log(`${UI.checkmark} Successfully unsubscribed`);
        unsubscribed = true;
    } catch (error) {
        console.warn(`⚠️ Unsubscribe issue: ${error.message}`);

        // Attempt to force close WebSocket connections
        await forceCloseWebSockets(connection);
    }

    return unsubscribed;
};

/**
 * Force closes any open WebSocket connections
 * @param connection - Solana connection
 */
export const forceCloseWebSockets = async (connection: Connection): Promise<void> => {
    if (connection && (connection as any)._rpcWebSocket) {
        try {
            (connection as any)._rpcWebSocket.close();
            console.log(`${UI.checkmark} Forcibly closed WebSocket connection`);
        } catch (wsError) {
            console.warn(`⚠️ Failed to close WebSocket: ${wsError.message}`);
        }
    }
}; 