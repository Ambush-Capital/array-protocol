"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const anchor_1 = require("@coral-xyz/anchor");
const web3_js_1 = require("@solana/web3.js");
const sdk_1 = require("@drift-labs/sdk");
// local configuration options
const CONFIG = {
    rpcUrl: "http://localhost:8899",
    driftProgramId: "DftNc7gwihkEEwQRpu4bV89N18xpNEuBVg7YkhTZZhVo",
    marketIndex: 0,
    environment: "localnet",
};
const address = "7MFxSBVG4MMEuSoeV8KmJtP3JpomeVoxcQ6PuehFHvzY";
// // mainnet configuration options
// const CONFIG = {
//     rpcUrl: process.env.RPC_URL || "https://mainnet.helius-rpc.com/?api-key=80edcf87-c27e-4dba-a1d8-1ec3a1426752",
//     environment: process.env.ENVIRONMENT || "mainnet-beta",
//     driftProgramId: "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH", // Drift program ID
//     marketIndex: 0, // Default to USDC (market index 0)
// };
// const address = "AmrekAq6s3n2frDi67WUaZnbPkBb1h4xaid1Y8QLMAYN";
async function main() {
    console.log(`Connecting to ${CONFIG.environment} at ${CONFIG.rpcUrl}`);
    // Connect to the specified network
    const connection = new web3_js_1.Connection(CONFIG.rpcUrl, "confirmed");
    // Create a dummy wallet (not important for read-only operations)
    const wallet = new anchor_1.Wallet(web3_js_1.Keypair.generate());
    const readOnlyWallet = {
        publicKey: new web3_js_1.PublicKey(address),
        signTransaction: () => { throw new Error("Wallet is read-only"); },
        signAllTransactions: () => { throw new Error("Wallet is read-only"); },
    };
    const provider = new anchor_1.AnchorProvider(connection, readOnlyWallet, anchor_1.AnchorProvider.defaultOptions());
    // Initialize Drift SDK
    const driftPublicKey = new web3_js_1.PublicKey(CONFIG.driftProgramId);
    await (0, sdk_1.initialize)({ env: CONFIG.environment });
    // Create Drift client
    const driftClient = new sdk_1.DriftClient({
        connection,
        wallet: provider.wallet,
        programID: driftPublicKey,
    });
    console.log("Subscribing to Drift client...");
    await driftClient.subscribe();
    // Get spot markets
    console.log("Fetching spot markets...");
    const spotMarkets = await driftClient.getSpotMarketAccounts();
    // Print available spot markets for reference
    console.log("\n=== Available Spot Markets ===");
    spotMarkets.forEach((market) => {
        console.log(`Market Index: ${market.marketIndex}, Name: ${market.name}`);
        console.log(`  Vault: ${market.vault.toString()}`);
    });
    // Get the market index from command line args or use default
    const marketIndex = process.argv[2] ? parseInt(process.argv[2]) : CONFIG.marketIndex;
    console.log(`\nUsing market index: ${marketIndex}`);
    // Get the selected market
    const selectedMarket = spotMarkets.find(m => m.marketIndex === marketIndex);
    if (!selectedMarket) {
        console.error(`Market with index ${marketIndex} not found!`);
        process.exit(1);
    }
    console.log(`Selected market: ${selectedMarket.name}`);
    // Test getRemainderAccountsForSpotOperation for deposit
    console.log("\n=== Testing getRemainderAccounts ===");
    try {
        const remainingAccounts = driftClient.getRemainingAccounts({
            userAccounts: [],
            writablePerpMarketIndexes: [marketIndex],
            useMarketLastSlotCache: true,
        });
        remainingAccounts[2].isWritable = true;
        console.log(`Found ${remainingAccounts.length} remaining accounts for deposit:`);
        remainingAccounts.forEach((account, i) => {
            console.log(`\nAccount #${i + 1}:`);
            console.log(`  Public Key: ${account.pubkey.toString()}`);
            console.log(`  Is Signer: ${account.isSigner}`);
            console.log(`  Is Writable: ${account.isWritable}`);
        });
    }
    catch (err) {
        console.error(`Error getting remaining accounts for deposit: ${err}`);
    }
    console.log("\nDone!");
}
main()
    .then(() => process.exit(0))
    .catch((err) => {
    console.error(`Error: ${err}`);
    process.exit(1);
});
