// test-drift-local.ts
import { Connection, PublicKey } from '@solana/web3.js';
import { DriftClient } from '@drift-labs/sdk';
import * as anchor from '@project-serum/anchor';
import { UI, decodeMarketName } from './utils/ui-utils';
import { CONSTANTS, getConnection } from './utils/connection-utils';
import { createDriftClient, safeUnsubscribe } from './utils/drift-utils';
import { createDummyWallet } from './utils/wallet-utils';

async function main(): Promise<void> {
  console.log('🔄 Connecting to Solana mainnet...');

  // Get connection using our utility
  const { connection, isLocal } = await getConnection();

  // Create a dummy wallet for read-only operations
  const dummyWallet = createDummyWallet();

  // Initialize Drift client using our utility
  const driftClient = await createDriftClient(connection, dummyWallet);

  // Analyze spot markets
  await analyzeSpotMarkets(driftClient);

  // Clean up resources using our utility function
  await safeUnsubscribe(connection, driftClient);

  console.log(`\n${UI.checkmark} Test completed successfully`);
  process.exit(0);
}

/**
 * Analyzes spot markets from the Drift protocol
 * @param driftClient - The initialized Drift client
 */
async function analyzeSpotMarkets(driftClient: DriftClient): Promise<void> {
  // Get spot markets
  const spotMarkets = await driftClient.getSpotMarketAccounts();
  console.log(`${UI.checkmark} Found ${spotMarkets.length} spot markets`);

  // Find and display USDC spot market
  const usdcSpotMarket = spotMarkets.find((market: any) => {
    return market.mint.toString() === CONSTANTS.USDC_MINT;
  });

  if (usdcSpotMarket) {
    console.log(`${UI.checkmark} USDC Spot Market found:`);
    displayMarket(usdcSpotMarket);
  } else {
    console.log(`${UI.xmark} USDC Spot Market not found`);
  }

  // Display a sample of other markets
  displayOtherMarkets(spotMarkets);
}

/**
 * Displays details for a single market
 * @param market - The market to display
 */
function displayMarket(market: any): void {
  const marketIndex = market.marketIndex.toString();
  const marketName = decodeMarketName(market.name);

  console.log(`${UI.checkmark} Market ${marketIndex}: ${marketName}`);
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
function displayOtherMarkets(spotMarkets: any[]): void {
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
  console.error(`${UI.xmark} Error:`, err);
  process.exit(1);
});