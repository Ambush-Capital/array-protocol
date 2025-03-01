"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pauseAndTrackSlots = exports.checkDriftProgramDeployment = exports.getConnection = exports.isLocalValidatorRunning = exports.CONSTANTS = void 0;
const web3_js_1 = require("@solana/web3.js");
const ui_utils_1 = require("./ui-utils");
exports.CONSTANTS = {
    LOCAL_VALIDATOR_URL: 'http://localhost:8899',
    DRIFT_PROGRAM_ID: 'DftNc7gwihkEEwQRpu4bV89N18xpNEuBVg7YkhTZZhVo',
    USDC_MINT: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
};
const isLocalValidatorRunning = async (url) => {
    try {
        const connection = new web3_js_1.Connection(url);
        await connection.getVersion();
        return true;
    }
    catch (error) {
        return false;
    }
};
exports.isLocalValidatorRunning = isLocalValidatorRunning;
const getConnection = async () => {
    // First try to use local validator
    let rpcUrl = exports.CONSTANTS.LOCAL_VALIDATOR_URL;
    let isLocal = await (0, exports.isLocalValidatorRunning)(rpcUrl);
    if (isLocal) {
        console.log(`${ui_utils_1.UI.checkmark} Using local validator at ${rpcUrl}`);
    }
    else {
        // Fall back to environment variable if local validator is not running
        rpcUrl = process.env.RPC_URL || '';
        if (!rpcUrl) {
            throw new Error(`${ui_utils_1.UI.xmark} Local validator not running and RPC_URL not found in environment. Please start local validator or set RPC_URL in .env file.`);
        }
        console.log(`${ui_utils_1.UI.loading} Local validator not running. Using remote RPC: ${rpcUrl}`);
        isLocal = false;
    }
    return {
        connection: new web3_js_1.Connection(rpcUrl, 'confirmed'),
        isLocal,
        rpcUrl
    };
};
exports.getConnection = getConnection;
const checkDriftProgramDeployment = async (connection) => {
    try {
        console.log(`${ui_utils_1.UI.loading} Checking if Drift program is deployed...`);
        const programInfo = await connection.getAccountInfo(new web3_js_1.PublicKey(exports.CONSTANTS.DRIFT_PROGRAM_ID));
        if (!programInfo) {
            console.error(`${ui_utils_1.UI.xmark} The Drift program (${exports.CONSTANTS.DRIFT_PROGRAM_ID}) is not deployed on this network.`);
            return false;
        }
        console.log(`${ui_utils_1.UI.checkmark} Drift program is deployed with ${programInfo.data.length} bytes of data`);
        return true;
    }
    catch (error) {
        console.error(`${ui_utils_1.UI.xmark} Error checking Drift program deployment:`, error);
        return false;
    }
};
exports.checkDriftProgramDeployment = checkDriftProgramDeployment;
/**
 * Pauses execution and tracks slot progress
 * @param connection - Solana connection
 * @param pauseMs - Time to pause in milliseconds
 * @param message - Optional message to display
 */
const pauseAndTrackSlots = async (connection, pauseMs = 1000, message) => {
    if (message) {
        console.log(`\n${ui_utils_1.UI.loading} ${message}`);
    }
    else {
        console.log(`\n${ui_utils_1.UI.loading} Pausing to allow transaction confirmation...`);
    }
    try {
        // Get current slot
        const startSlot = await connection.getSlot();
        console.log(`${ui_utils_1.UI.loading} Current slot: ${startSlot}`);
        // Pause execution
        await new Promise(resolve => setTimeout(resolve, pauseMs));
        // Get new slot
        const endSlot = await connection.getSlot();
        console.log(`${ui_utils_1.UI.loading} New slot: ${endSlot}`);
        console.log(`${ui_utils_1.UI.checkmark} Slots advanced: ${endSlot - startSlot}`);
    }
    catch (error) {
        console.warn(`${ui_utils_1.UI.xmark} Error tracking slots:`, error);
    }
};
exports.pauseAndTrackSlots = pauseAndTrackSlots;
