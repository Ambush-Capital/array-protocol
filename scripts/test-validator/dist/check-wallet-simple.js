"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const web3_js_1 = require("@solana/web3.js");
const env_utils_1 = require("./utils/env-utils");
const connection_utils_1 = require("./utils/connection-utils");
const ui_utils_1 = require("./utils/ui-utils");
const wallet_utils_1 = require("./utils/wallet-utils");
async function main() {
    console.log(`\n💰 Wallet Balance Check Script 💰\n`);
    // Load environment variables
    (0, env_utils_1.loadEnvironmentVariables)();
    // Get wallet address from environment variables
    const walletAddress = process.env.WALLET_ADDRESS;
    if (!walletAddress) {
        console.error(`${ui_utils_1.UI.xmark} WALLET_ADDRESS not found in environment. Please set it in .env file.`);
        process.exit(1);
    }
    // Parse wallet address
    const walletPublicKey = new web3_js_1.PublicKey(walletAddress);
    console.log(`${ui_utils_1.UI.checkmark} Wallet address: ${walletPublicKey.toString()}`);
    // Get connection using our utility
    const { connection } = await (0, connection_utils_1.getConnection)();
    // Get wallet information
    await displayWalletInfo(walletPublicKey, connection);
    // Check SOL balance
    await displaySolBalance(walletPublicKey, connection);
    // Check token balances
    await displayTokenBalances(walletPublicKey, connection);
    console.log(`\n${ui_utils_1.UI.checkmark} Wallet check completed`);
}
/**
 * Display wallet information
 */
async function displayWalletInfo(walletPublicKey, connection) {
    console.log(`\n📋 Wallet Information:`);
    const walletInfo = await (0, wallet_utils_1.getWalletInfo)(connection, walletPublicKey);
    console.log(`${ui_utils_1.UI.checkmark} Account type: ${walletInfo.isSystemOwned ? 'System Account' : 'Program Owned Account'}`);
    if (!walletInfo.isSystemOwned) {
        console.log(`${ui_utils_1.UI.checkmark} Owner: ${walletInfo.owner.toString()}`);
    }
    console.log(`${ui_utils_1.UI.checkmark} Executable: ${walletInfo.executable ? 'Yes' : 'No'}`);
}
/**
 * Display SOL balance
 */
async function displaySolBalance(walletPublicKey, connection) {
    console.log(`\n🪙 SOL Balance:`);
    const solBalance = await (0, wallet_utils_1.getWalletSolBalance)(connection, walletPublicKey);
    console.log(`${ui_utils_1.UI.checkmark} SOL Balance: ${solBalance.toFixed(6)} SOL`);
    // Add rent exempt info
    const rentExemptBalance = await connection.getMinimumBalanceForRentExemption(0);
    const isRentExempt = solBalance * 1e9 >= rentExemptBalance;
    console.log(`${isRentExempt ? ui_utils_1.UI.checkmark : ui_utils_1.UI.xmark} Rent exempt: ${isRentExempt ? 'Yes' : 'No'}`);
    console.log(`${ui_utils_1.UI.loading} Minimum for rent exemption: ${(rentExemptBalance / 1e9).toFixed(6)} SOL`);
}
/**
 * Display token balances
 */
async function displayTokenBalances(walletPublicKey, connection) {
    console.log(`\n💵 Token Balances:`);
    const tokenBalances = await (0, wallet_utils_1.getWalletTokenBalances)(connection, walletPublicKey);
    if (tokenBalances.length === 0) {
        console.log(`${ui_utils_1.UI.xmark} No token balances found for this wallet`);
        return;
    }
    // Get USDC token info
    const usdcInfo = await (0, wallet_utils_1.getUsdcTokenInfo)(connection);
    // Display each token balance
    for (const balance of tokenBalances) {
        const isUsdc = balance.mint.toString() === connection_utils_1.CONSTANTS.USDC_MINT;
        if (isUsdc) {
            console.log(`\n${ui_utils_1.UI.checkmark} USDC Token:`);
            console.log(`   - Symbol: ${usdcInfo.symbol}`);
            console.log(`   - Name: ${usdcInfo.name}`);
            console.log(`   - Decimals: ${usdcInfo.decimals}`);
            console.log(`   - Token Account: ${balance.address.toString()}`);
            console.log(`   - Balance: ${balance.amount} USDC`);
            // Add additional USDC info
            console.log(`   - Mint: ${connection_utils_1.CONSTANTS.USDC_MINT} (Circle's USD Coin on Solana)`);
            console.log(`   - Token Program: TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA (SPL Token)`);
        }
        else {
            console.log(`\n${ui_utils_1.UI.checkmark} Token: ${balance.mint.toString()}`);
            console.log(`   - Token Account: ${balance.address.toString()}`);
            console.log(`   - Balance: ${balance.amount}`);
            console.log(`   - Decimals: ${balance.decimals}`);
        }
    }
}
// Run the main function
main().catch(err => {
    console.error(`${ui_utils_1.UI.xmark} Error:`, err);
    process.exit(1);
});
