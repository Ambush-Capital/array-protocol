"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ui_utils_1 = require("./utils/ui-utils");
const connection_utils_1 = require("./utils/connection-utils");
const drift_utils_1 = require("./utils/drift-utils");
const wallet_utils_1 = require("./utils/wallet-utils");
async function main() {
    console.log('🔄 Connecting to Solana mainnet...');
    // Get connection using our utility
    const { connection, isLocal } = await (0, connection_utils_1.getConnection)();
    // Create a dummy wallet for read-only operations
    const dummyWallet = (0, wallet_utils_1.createDummyWallet)();
    // Initialize Drift client using our utility
    const driftClient = await (0, drift_utils_1.createDriftClient)(connection, dummyWallet);
    // Analyze spot markets
    await analyzeSpotMarkets(driftClient);
    // Clean up resources using our utility function
    await (0, drift_utils_1.safeUnsubscribe)(connection, driftClient);
    console.log(`\n${ui_utils_1.UI.checkmark} Test completed successfully`);
    process.exit(0);
}
/**
 * Analyzes spot markets from the Drift protocol
 * @param driftClient - The initialized Drift client
 */
async function analyzeSpotMarkets(driftClient) {
    // Get spot markets
    const spotMarkets = await driftClient.getSpotMarketAccounts();
    console.log(`${ui_utils_1.UI.checkmark} Found ${spotMarkets.length} spot markets`);
    // Find and display USDC spot market
    const usdcSpotMarket = spotMarkets.find((market) => {
        return market.mint.toString() === connection_utils_1.CONSTANTS.USDC_MINT;
    });
    if (usdcSpotMarket) {
        console.log(`${ui_utils_1.UI.checkmark} USDC Spot Market found:`);
        displayMarket(usdcSpotMarket);
    }
    else {
        console.log(`${ui_utils_1.UI.xmark} USDC Spot Market not found`);
    }
    // Display a sample of other markets
    displayOtherMarkets(spotMarkets);
}
/**
 * Displays details for a single market
 * @param market - The market to display
 */
function displayMarket(market) {
    const marketIndex = market.marketIndex.toString();
    const marketName = (0, ui_utils_1.decodeMarketName)(market.name);
    console.log(`${ui_utils_1.UI.checkmark} Market ${marketIndex}: ${marketName}`);
    console.log(`   - Market Index: ${market.marketIndex}`);
    console.log(`   - Name: ${marketName}`);
    console.log(`   - Mint Address: ${market.mint.toString()}`);
    console.log(`   - Market Address: ${market.pubkey.toString()}`);
    console.log(`   - Vault Address: ${market.vault.toString()}`);
}
/**
 * Displays a sample of markets
 * @param spotMarkets - Array of spot markets
 */
function displayOtherMarkets(spotMarkets) {
    const marketsToPrint = 3; // Number of additional markets to print
    console.log(`\n📊 Sample of other markets:`);
    // Sort markets by market index
    spotMarkets.sort((a, b) => a.marketIndex - b.marketIndex);
    // Display a few markets
    for (let i = 0; i < Math.min(marketsToPrint + 1, spotMarkets.length); i++) {
        displayMarket(spotMarkets[i]);
    }
}
// Run the main function
main().catch(err => {
    console.error(`${ui_utils_1.UI.xmark} Error:`, err);
    process.exit(1);
});
