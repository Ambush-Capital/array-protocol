"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const env_utils_1 = require("./utils/env-utils");
const connection_utils_1 = require("./utils/connection-utils");
const wallet_utils_1 = require("./utils/wallet-utils");
const drift_utils_1 = require("./utils/drift-utils");
const ui_utils_1 = require("./utils/ui-utils");
const deposit_1 = require("./operations/deposit");
const withdraw_1 = require("./operations/withdraw");
const initialize_user_1 = require("./operations/initialize-user");
// Constants
const DEPOSIT_AMOUNT = 1; // 1 USDC
const WITHDRAW_AMOUNT = 1; // 1 USDC
const SUB_ACCOUNT_ID = 0; // Default sub-account ID
async function main() {
    console.log(`\n💸 Drift USDC Deposit/Withdraw Script 💸\n`);
    // Load environment variables
    (0, env_utils_1.loadEnvironmentVariables)();
    // Get connection
    const { connection, isLocal } = await (0, connection_utils_1.getConnection)();
    // Check if Drift program is deployed
    const isDriftDeployed = await (0, connection_utils_1.checkDriftProgramDeployment)(connection);
    if (!isDriftDeployed) {
        console.error(`${ui_utils_1.UI.xmark} Drift program is not deployed. Exiting.`);
        process.exit(1);
    }
    // Load wallet keypair
    const keypair = await (0, wallet_utils_1.loadWalletKeypair)();
    if (!keypair) {
        console.error(`${ui_utils_1.UI.xmark} Failed to load wallet keypair. Exiting.`);
        process.exit(1);
    }
    console.log(`${ui_utils_1.UI.checkmark} Using wallet: ${keypair.publicKey.toString()}`);
    // Create wallet adapter
    const wallet = (0, wallet_utils_1.createWalletAdapter)(keypair);
    // Find USDC token account
    const tokenAccount = await (0, wallet_utils_1.findUsdcTokenAccount)(connection, keypair.publicKey);
    if (!tokenAccount) {
        console.error(`${ui_utils_1.UI.xmark} No USDC token account found. Exiting.`);
        process.exit(1);
    }
    // Initialize Drift client
    let driftClient = await (0, drift_utils_1.createDriftClient)(connection, wallet);
    // Check if user account exists, if not create it
    let userInitialized = false;
    try {
        await (0, drift_utils_1.fetchAndDisplayUserAccount)(driftClient);
    }
    catch (error) {
        console.log(`${ui_utils_1.UI.loading} User account not found. Creating a new user account...`);
        // Use the InitializeUser operation
        const initOp = new initialize_user_1.InitializeUser(driftClient, SUB_ACCOUNT_ID, connection, wallet);
        await initOp.execute();
        // Pause and track slots after initialization
        await (0, connection_utils_1.pauseAndTrackSlots)(connection, 1000, "Waiting for user account initialization to confirm...");
        // Set flag to indicate we just initialized the user
        userInitialized = true;
    }
    // If we just initialized the user, recreate the Drift client to ensure it recognizes the new account
    if (userInitialized) {
        console.log(`${ui_utils_1.UI.loading} Refreshing Drift client after user initialization...`);
        // Safely unsubscribe from the current client
        await (0, drift_utils_1.safeUnsubscribe)(connection, driftClient);
        // Create a new client
        driftClient = await (0, drift_utils_1.createDriftClient)(connection, wallet);
        // Display the new user account
        await (0, drift_utils_1.fetchAndDisplayUserAccount)(driftClient);
    }
    // Display current USDC balance in Drift
    await (0, drift_utils_1.displayDriftUsdcBalance)(driftClient);
    // Perform deposit operation
    const depositOp = new deposit_1.Deposit(driftClient, DEPOSIT_AMOUNT, tokenAccount, connection, wallet);
    await depositOp.execute();
    // Pause and track slots after deposit
    await (0, connection_utils_1.pauseAndTrackSlots)(connection, 1000, "Waiting for deposit to confirm...");
    // Display updated USDC balance after deposit
    await (0, drift_utils_1.displayDriftUsdcBalance)(driftClient);
    // Perform withdraw operation
    const withdrawOp = new withdraw_1.Withdraw(driftClient, WITHDRAW_AMOUNT, tokenAccount, connection, wallet);
    await withdrawOp.execute();
    // Pause and track slots after withdrawal
    await (0, connection_utils_1.pauseAndTrackSlots)(connection, 1000, "Waiting for withdrawal to confirm...");
    // Display final USDC balance after withdrawal
    await (0, drift_utils_1.displayDriftUsdcBalance)(driftClient);
    // Unsubscribe from Drift client using our utility function
    await (0, drift_utils_1.safeUnsubscribe)(connection, driftClient);
    console.log(`\n${ui_utils_1.UI.checkmark} Deposit/Withdraw operations completed`);
}
// Run the main function
main().catch(err => {
    console.error(`${ui_utils_1.UI.xmark} Error:`, err);
    process.exit(1);
});
