import { PublicKey } from '@solana/web3.js';
import { BN } from '@drift-labs/sdk';
import { loadEnvironmentVariables } from './utils/env-utils';
import { getConnection, checkDriftProgramDeployment, pauseAndTrackSlots } from './utils/connection-utils';
import { loadWalletKeypair, createWalletAdapter, findUsdcTokenAccount } from './utils/wallet-utils';
import {
    createDriftClient,
    displayDriftUsdcBalance,
    fetchAndDisplayUserAccount,
    safeUnsubscribe
} from './utils/drift-utils';
import { UI } from './utils/ui-utils';
import { Deposit } from './operations/deposit';
import { Withdraw } from './operations/withdraw';
import { InitializeUser } from './operations/initialize-user';

// Constants
const DEPOSIT_AMOUNT = 1; // 1 USDC
const WITHDRAW_AMOUNT = 1; // 1 USDC
const SUB_ACCOUNT_ID = 0; // Default sub-account ID

async function main(): Promise<void> {
    console.log(`\n💸 Drift USDC Deposit/Withdraw Script 💸\n`);

    // Load environment variables
    loadEnvironmentVariables();

    // Get connection
    const { connection, isLocal } = await getConnection();

    // Check if Drift program is deployed
    const isDriftDeployed = await checkDriftProgramDeployment(connection);
    if (!isDriftDeployed) {
        console.error(`${UI.xmark} Drift program is not deployed. Exiting.`);
        process.exit(1);
    }

    // Load wallet keypair
    const keypair = await loadWalletKeypair();
    if (!keypair) {
        console.error(`${UI.xmark} Failed to load wallet keypair. Exiting.`);
        process.exit(1);
    }

    console.log(`${UI.checkmark} Using wallet: ${keypair.publicKey.toString()}`);

    // Create wallet adapter
    const wallet = createWalletAdapter(keypair);

    // Find USDC token account
    const tokenAccount = await findUsdcTokenAccount(connection, keypair.publicKey);
    if (!tokenAccount) {
        console.error(`${UI.xmark} No USDC token account found. Exiting.`);
        process.exit(1);
    }

    // Initialize Drift client
    let driftClient = await createDriftClient(connection, wallet);

    // Check if user account exists, if not create it
    let userInitialized = false;
    try {
        await fetchAndDisplayUserAccount(driftClient);
    } catch (error) {
        console.log(`${UI.loading} User account not found. Creating a new user account...`);

        // Use the InitializeUser operation
        const initOp = new InitializeUser(
            driftClient,
            SUB_ACCOUNT_ID,
            connection,
            wallet
        );

        await initOp.execute();

        // Pause and track slots after initialization
        await pauseAndTrackSlots(connection, 1000, "Waiting for user account initialization to confirm...");

        // Set flag to indicate we just initialized the user
        userInitialized = true;
    }

    // If we just initialized the user, recreate the Drift client to ensure it recognizes the new account
    if (userInitialized) {
        console.log(`${UI.loading} Refreshing Drift client after user initialization...`);

        // Safely unsubscribe from the current client
        await safeUnsubscribe(connection, driftClient);

        // Create a new client
        driftClient = await createDriftClient(connection, wallet);

        // Display the new user account
        await fetchAndDisplayUserAccount(driftClient);
    }

    // Display current USDC balance in Drift
    await displayDriftUsdcBalance(driftClient);

    // Perform deposit operation
    const depositOp = new Deposit(
        driftClient,
        DEPOSIT_AMOUNT,
        tokenAccount,
        connection,
        wallet
    );
    await depositOp.execute();

    // Pause and track slots after deposit
    await pauseAndTrackSlots(connection, 1000, "Waiting for deposit to confirm...");

    // Display updated USDC balance after deposit
    await displayDriftUsdcBalance(driftClient);

    // Perform withdraw operation
    const withdrawOp = new Withdraw(
        driftClient,
        WITHDRAW_AMOUNT,
        tokenAccount,
        connection,
        wallet
    );
    await withdrawOp.execute();

    // Pause and track slots after withdrawal
    await pauseAndTrackSlots(connection, 1000, "Waiting for withdrawal to confirm...");

    // Display final USDC balance after withdrawal
    await displayDriftUsdcBalance(driftClient);

    // Unsubscribe from Drift client using our utility function
    await safeUnsubscribe(connection, driftClient);

    console.log(`\n${UI.checkmark} Deposit/Withdraw operations completed`);
}

// Run the main function
main().catch(err => {
    console.error(`${UI.xmark} Error:`, err);
    process.exit(1);
}); 