import { PublicKey } from '@solana/web3.js';
import { loadEnvironmentVariables } from './utils/env-utils';
import { getConnection, CONSTANTS } from './utils/connection-utils';
import { UI } from './utils/ui-utils';
import {
    getWalletSolBalance,
    getWalletTokenBalances,
    getWalletInfo,
    getUsdcTokenInfo
} from './utils/wallet-utils';

async function main(): Promise<void> {
    console.log(`\n💰 Wallet Balance Check Script 💰\n`);

    // Load environment variables
    loadEnvironmentVariables();

    // Get wallet address from environment variables
    const walletAddress = process.env.WALLET_ADDRESS;
    if (!walletAddress) {
        console.error(`${UI.xmark} WALLET_ADDRESS not found in environment. Please set it in .env file.`);
        process.exit(1);
    }

    // Parse wallet address
    const walletPublicKey = new PublicKey(walletAddress);
    console.log(`${UI.checkmark} Wallet address: ${walletPublicKey.toString()}`);

    // Get connection using our utility
    const { connection } = await getConnection();

    // Get wallet information
    await displayWalletInfo(walletPublicKey, connection);

    // Check SOL balance
    await displaySolBalance(walletPublicKey, connection);

    // Check token balances
    await displayTokenBalances(walletPublicKey, connection);

    console.log(`\n${UI.checkmark} Wallet check completed`);
}

/**
 * Display wallet information
 */
async function displayWalletInfo(walletPublicKey: PublicKey, connection: any): Promise<void> {
    console.log(`\n📋 Wallet Information:`);

    const walletInfo = await getWalletInfo(connection, walletPublicKey);

    console.log(`${UI.checkmark} Account type: ${walletInfo.isSystemOwned ? 'System Account' : 'Program Owned Account'}`);
    if (!walletInfo.isSystemOwned) {
        console.log(`${UI.checkmark} Owner: ${walletInfo.owner.toString()}`);
    }
    console.log(`${UI.checkmark} Executable: ${walletInfo.executable ? 'Yes' : 'No'}`);
}

/**
 * Display SOL balance
 */
async function displaySolBalance(walletPublicKey: PublicKey, connection: any): Promise<void> {
    console.log(`\n🪙 SOL Balance:`);

    const solBalance = await getWalletSolBalance(connection, walletPublicKey);
    console.log(`${UI.checkmark} SOL Balance: ${solBalance.toFixed(6)} SOL`);

    // Add rent exempt info
    const rentExemptBalance = await connection.getMinimumBalanceForRentExemption(0);
    const isRentExempt = solBalance * 1e9 >= rentExemptBalance;

    console.log(`${isRentExempt ? UI.checkmark : UI.xmark} Rent exempt: ${isRentExempt ? 'Yes' : 'No'}`);
    console.log(`${UI.loading} Minimum for rent exemption: ${(rentExemptBalance / 1e9).toFixed(6)} SOL`);
}

/**
 * Display token balances
 */
async function displayTokenBalances(walletPublicKey: PublicKey, connection: any): Promise<void> {
    console.log(`\n💵 Token Balances:`);

    const tokenBalances = await getWalletTokenBalances(connection, walletPublicKey);

    if (tokenBalances.length === 0) {
        console.log(`${UI.xmark} No token balances found for this wallet`);
        return;
    }

    // Get USDC token info
    const usdcInfo = await getUsdcTokenInfo(connection);

    // Display each token balance
    for (const balance of tokenBalances) {
        const isUsdc = balance.mint.toString() === CONSTANTS.USDC_MINT;

        if (isUsdc) {
            console.log(`\n${UI.checkmark} USDC Token:`);
            console.log(`   - Symbol: ${usdcInfo.symbol}`);
            console.log(`   - Name: ${usdcInfo.name}`);
            console.log(`   - Decimals: ${usdcInfo.decimals}`);
            console.log(`   - Token Account: ${balance.address.toString()}`);
            console.log(`   - Balance: ${balance.amount} USDC`);

            // Add additional USDC info
            console.log(`   - Mint: ${CONSTANTS.USDC_MINT} (Circle's USD Coin on Solana)`);
            console.log(`   - Token Program: TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA (SPL Token)`);
        } else {
            console.log(`\n${UI.checkmark} Token: ${balance.mint.toString()}`);
            console.log(`   - Token Account: ${balance.address.toString()}`);
            console.log(`   - Balance: ${balance.amount}`);
            console.log(`   - Decimals: ${balance.decimals}`);
        }
    }
}

// Run the main function
main().catch(err => {
    console.error(`${UI.xmark} Error:`, err);
    process.exit(1);
}); 