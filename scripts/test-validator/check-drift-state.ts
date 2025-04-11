import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { DriftClient, fetchUserAccounts, fetchUserAccountsUsingKeys, getUserStatsAccountPublicKey, initialize, StateAccount, UserAccount, UserStatsAccount } from "@drift-labs/sdk";
import { BN } from "bn.js";
import { connect } from "http2";

async function main() {



    // Connect to local validator
    const connection = new Connection("http://localhost:8899", "confirmed");

    // Create a dummy wallet (not important for read-only operations)
    const wallet = new Wallet(Keypair.generate());
    const provider = new AnchorProvider(connection, wallet, AnchorProvider.defaultOptions());

    // Initialize Drift SDK
    const driftPublicKey = new PublicKey("DftNc7gwihkEEwQRpu4bV89N18xpNEuBVg7YkhTZZhVo");
    await initialize({ env: "mainnet-beta" });


    // let idl = await Program.fetchIdl(driftPublicKey, provider);
    // let program = new Program(idl, driftPublicKey, provider);

    // Create client
    const driftClient = new DriftClient({
        connection,
        wallet: provider.wallet,
        programID: driftPublicKey,
    });
    await driftClient.subscribe();

    // Account addresses from the input
    const searchUser = new PublicKey("7MFxSBVG4MMEuSoeV8KmJtP3JpomeVoxcQ6PuehFHvzY");
    const userStateAddress = new PublicKey("7MFxSBVG4MMEuSoeV8KmJtP3JpomeVoxcQ6PuehFHvzY");
    const driftStateAddress = new PublicKey("4CEikLe8mQ5hwFBKqZz324K6L989Yjesiehe2u5oTaXz");
    const driftUserAddress = new PublicKey("8ro5CTt3R3T2sVQBz1gEwJJVCiVrNtmQ9q27xGHxDhFG");
    const driftUserStatsAddress = new PublicKey("8Md8rzvEsf96qq86caquR41k5BKwEA7dYNQUbgG9CX6R");
    const driftSpotMarketVaultAddress = new PublicKey("3xj5rdLoVW2rrPX9hUVjSLWMk7gvkgreXApW3kjPQPU7");

    // Fetch accounts
    console.log("Fetching Drift accounts...\n");

    try {
        // Fetch Drift State
        // const stateAccount = await driftClient.getStateAccount();
        // console.log("=== Drift State ===");
        // console.log(`Address: ${driftStateAddress.toString()}`);
        // console.log(`Admin: ${stateAccount.admin.toString()}`);
        // console.log(`Exchange Status: ${stateAccount.exchangeStatus}`);
        // console.log(`Number of Markets: ${stateAccount.numberOfMarkets}`);
        // console.log(`Number of Spot Markets: ${stateAccount.numberOfSpotMarkets}`);
        // console.log(`Oracle Guard Rails: ${JSON.stringify(stateAccount.oracleGuardRails, null, 2)}`);
        // console.log("\n");

        // Fetch Drift User
        try {
            let accounts = await fetchUserAccounts(connection, driftClient.program, searchUser);
            // const userAccount = await driftClient.getUserAccount(0, searchUser);
            for (let userAccount of accounts) {
                console.log("=== Drift User ===");
                console.log(`Address: ${driftUserAddress.toString()}`);
                console.log(`Authority: ${userAccount.authority.toString()}`);
                console.log(`Sub Account ID: ${userAccount.subAccountId}`);
                // Check positions
                console.log(`Positions Count: ${userAccount.perpPositions.length}`);
                console.log(`Spot Positions Count: ${userAccount.spotPositions.length}`);
                // Show spot positions if they exist
                if (userAccount.spotPositions.length > 0) {
                    console.log("Spot Positions:");
                    userAccount.spotPositions.forEach((pos, idx) => {
                        if (pos.marketIndex >= 0) {
                            console.log(`  Position ${idx}: Market Index: ${pos.marketIndex}, Tokens: ${pos.scaledBalance.toString()}`);
                        }
                    });
                }
                console.log("\n");
            }


        } catch (err) {
            console.error(`Error fetching user account: ${err}`);
        }

        // Fetch Drift User Stats
        try {
            const userStatsAccountData = await connection.getAccountInfo(driftUserStatsAddress);
            console.log("=== Drift User Stats ===");
            console.log(`Address: ${driftUserStatsAddress.toString()}`);

            if (userStatsAccountData) {
                // We're just confirming the account exists as parsing it requires more complex logic
                console.log(`Account Size: ${userStatsAccountData.data.length} bytes`);
                console.log(`Account Owner: ${userStatsAccountData.owner.toString()}`);
            } else {
                console.log("User Stats Account not found");
            }
            console.log("\n");
        } catch (err) {
            console.error(`Error fetching user stats account: ${err}`);
        }

        // Fetch Drift Spot Market Vault
        try {
            const spotMarketVaultData = await connection.getAccountInfo(driftSpotMarketVaultAddress);
            console.log("=== Drift Spot Market Vault ===");
            console.log(`Address: ${driftSpotMarketVaultAddress.toString()}`);

            if (spotMarketVaultData) {
                console.log(`Account Size: ${spotMarketVaultData.data.length} bytes`);
                console.log(`Account Owner: ${spotMarketVaultData.owner.toString()}`);

                // Try to get the spot market info
                const spotMarkets = await driftClient.getSpotMarketAccounts();
                const relevantMarket = spotMarkets.find(market =>
                    market.vault.equals(driftSpotMarketVaultAddress)
                );

                if (relevantMarket) {
                    console.log(`Market Index: ${relevantMarket.marketIndex}`);
                    console.log(`Token Mint: ${relevantMarket.mint.toString()}`);
                }
            } else {
                console.log("Spot Market Vault not found");
            }
            console.log("\n");
        } catch (err) {
            console.error(`Error fetching spot market vault: ${err}`);
        }

        // Find and print all state accounts owned by Drift program
        console.log("\n=== All Drift Program Accounts ===");
        await findAllDriftProgramAccounts(connection, driftPublicKey);

    } catch (err) {
        console.error(`Error: ${err}`);
    }
}

async function findAllDriftProgramAccounts(connection: Connection, driftProgramId: PublicKey) {
    try {
        // Get all accounts owned by the Drift program
        console.log(`Finding all accounts owned by: ${driftProgramId.toString()}`);
        const accounts = await connection.getProgramAccounts(driftProgramId, {
            commitment: "confirmed",
        });

        console.log(`Found ${accounts.length} accounts`);

        // Print account details
        for (let i = 0; i < accounts.length; i++) {
            const account = accounts[i];
            console.log(`\nAccount #${i + 1}:`);
            console.log(`Address: ${account.pubkey.toString()}`);
            console.log(`Data length: ${account.account.data.length} bytes`);

            // Try to determine account type based on structure or known addresses
            try {
                // Check if this might be the state account (small size, particular structure)
                if (account.pubkey.equals(new PublicKey("4CEikLe8mQ5hwFBKqZz324K6L989Yjesiehe2u5oTaXz"))) {
                    console.log(`Type: Drift State Account`);
                }
                // Check if this could be a user account based on data structure
                else if (account.account.data.length > 100 &&
                    account.account.data.slice(0, 8).toString() === Buffer.from([1, 0, 0, 0, 0, 0, 0, 0]).toString()) {
                    console.log(`Type: Likely a User Account`);
                }
                // Check if this could be a user stats account
                else if (account.account.data.length > 40 && account.account.data.length < 200) {
                    console.log(`Type: Possible User Stats Account`);
                }
                // Check if this could be a spot market vault
                else if (account.account.data.length < 40) {
                    console.log(`Type: Possible Spot Market Vault or Other Small Account`);
                }
                else {
                    console.log(`Type: Unknown Account Type`);
                }
            } catch (error) {
                console.log(`Type: Unable to determine (Error: ${error})`);
            }
        }
    } catch (error) {
        console.error(`Error finding program accounts: ${error}`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
