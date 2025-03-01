import { Connection, PublicKey } from '@solana/web3.js';
import { UI } from './ui-utils';

export const CONSTANTS = {
    LOCAL_VALIDATOR_URL: 'http://localhost:8899',
    DRIFT_PROGRAM_ID: 'DftNc7gwihkEEwQRpu4bV89N18xpNEuBVg7YkhTZZhVo',
    USDC_MINT: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
};

export const isLocalValidatorRunning = async (url: string): Promise<boolean> => {
    try {
        const connection = new Connection(url);
        await connection.getVersion();
        return true;
    } catch (error) {
        return false;
    }
};

export const getConnection = async (): Promise<{ connection: Connection, isLocal: boolean, rpcUrl: string }> => {
    // First try to use local validator
    let rpcUrl = CONSTANTS.LOCAL_VALIDATOR_URL;
    let isLocal = await isLocalValidatorRunning(rpcUrl);

    if (isLocal) {
        console.log(`${UI.checkmark} Using local validator at ${rpcUrl}`);
    } else {
        // Fall back to environment variable if local validator is not running
        rpcUrl = process.env.RPC_URL || '';
        if (!rpcUrl) {
            throw new Error(`${UI.xmark} Local validator not running and RPC_URL not found in environment. Please start local validator or set RPC_URL in .env file.`);
        }
        console.log(`${UI.loading} Local validator not running. Using remote RPC: ${rpcUrl}`);
        isLocal = false;
    }

    return {
        connection: new Connection(rpcUrl, 'confirmed'),
        isLocal,
        rpcUrl
    };
};

export const checkDriftProgramDeployment = async (connection: Connection): Promise<boolean> => {
    try {
        console.log(`${UI.loading} Checking if Drift program is deployed...`);
        const programInfo = await connection.getAccountInfo(new PublicKey(CONSTANTS.DRIFT_PROGRAM_ID));

        if (!programInfo) {
            console.error(`${UI.xmark} The Drift program (${CONSTANTS.DRIFT_PROGRAM_ID}) is not deployed on this network.`);
            return false;
        }

        console.log(`${UI.checkmark} Drift program is deployed with ${programInfo.data.length} bytes of data`);
        return true;
    } catch (error) {
        console.error(`${UI.xmark} Error checking Drift program deployment:`, error);
        return false;
    }
};

/**
 * Pauses execution and tracks slot progress
 * @param connection - Solana connection
 * @param pauseMs - Time to pause in milliseconds
 * @param message - Optional message to display
 */
export const pauseAndTrackSlots = async (
    connection: Connection,
    pauseMs: number = 1000,
    message?: string
): Promise<void> => {
    if (message) {
        console.log(`\n${UI.loading} ${message}`);
    } else {
        console.log(`\n${UI.loading} Pausing to allow transaction confirmation...`);
    }

    try {
        // Get current slot
        const startSlot = await connection.getSlot();
        console.log(`${UI.loading} Current slot: ${startSlot}`);

        // Pause execution
        await new Promise(resolve => setTimeout(resolve, pauseMs));

        // Get new slot
        const endSlot = await connection.getSlot();
        console.log(`${UI.loading} New slot: ${endSlot}`);
        console.log(`${UI.checkmark} Slots advanced: ${endSlot - startSlot}`);
    } catch (error) {
        console.warn(`${UI.xmark} Error tracking slots:`, error);
    }
}; 