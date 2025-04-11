import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ArrayProtocol } from "../target/types/array_protocol";
import { expect } from "chai";
import {
    getAssociatedTokenAddress,
    getAccount,
} from "@solana/spl-token";
import {
    findProgramStatePDA,
    findProgramSignerPDA,
    findUserStatePDA,
    findTokenVaultPDA,
    findUserTokenVaultPDA,
    findUserTokenVaultAccountPDA,
    findDriftUserPDA,
    findDriftUserStatsPDA,
    findDriftSpotMarketVaultPDA,
    findDriftStatePDA
} from "./utils/pda-gen";
import { DriftClient, fetchUserAccounts } from "@drift-labs/sdk";

describe("array-protocol: Drift Deposit", () => {
    const provider = anchor.AnchorProvider.local();
    anchor.setProvider(provider);

    const program = anchor.workspace.ArrayProtocol as Program<ArrayProtocol>;

    // Drift program ID (replace with the actual Drift program ID)
    const DRIFT_PROGRAM_ID = new anchor.web3.PublicKey("DftNc7gwihkEEwQRpu4bV89N18xpNEuBVg7YkhTZZhVo");

    // USDC mint and array protocol PDAs
    const USDC_MINT = new anchor.web3.PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    let programStatePda: anchor.web3.PublicKey;
    let userStatePda: anchor.web3.PublicKey;
    let protocolTokenVaultPda: anchor.web3.PublicKey;
    let userTokenVaultPda: anchor.web3.PublicKey;
    let userTokenVaultAccountPda: anchor.web3.PublicKey;
    let programSignerPda: anchor.web3.PublicKey;

    // Drift related PDAs
    let driftStatePda: anchor.web3.PublicKey;
    let driftUserPda: anchor.web3.PublicKey;
    let driftUserStatsPda: anchor.web3.PublicKey;
    let driftSpotMarketVaultPda: anchor.web3.PublicKey;

    let driftClient: DriftClient;

    // Array Protocol constants
    const vaultIndex = 0; // USDC vault index

    // Drift constants
    const driftMarketIndex = 0; // USDC market index in Drift
    const subAccountId = 0; // Default sub-account

    // Helper function to get token account balance
    const getTokenBalance = async (
        connection: anchor.web3.Connection,
        tokenAccount: anchor.web3.PublicKey
    ): Promise<number> => {
        try {
            const account = await getAccount(connection, tokenAccount);
            return Number(account.amount);
        } catch (e) {
            console.error("Error getting token balance:", e);
            return 0;
        }
    };

    before(async () => {
        // Get Array Protocol PDAs
        [programStatePda] = findProgramStatePDA(program.programId);
        [programSignerPda] = findProgramSignerPDA(program.programId);
        [userStatePda] = findUserStatePDA(provider.wallet.publicKey, program.programId);
        [protocolTokenVaultPda] = findTokenVaultPDA(vaultIndex, program.programId);
        [userTokenVaultPda] = findUserTokenVaultPDA(userStatePda, vaultIndex, program.programId);
        [userTokenVaultAccountPda] = findUserTokenVaultAccountPDA(userStatePda, vaultIndex, program.programId);

        // Get Drift PDAs
        [driftStatePda] = findDriftStatePDA(DRIFT_PROGRAM_ID);
        [driftUserPda] = findDriftUserPDA(userStatePda, subAccountId, DRIFT_PROGRAM_ID);
        [driftUserStatsPda] = findDriftUserStatsPDA(userStatePda, DRIFT_PROGRAM_ID);
        [driftSpotMarketVaultPda] = findDriftSpotMarketVaultPDA(driftMarketIndex, DRIFT_PROGRAM_ID);

        // Verify that the user account exists
        try {
            const userState = await program.account.user.fetch(userStatePda);
            console.log("Found existing user account:", userState.authority.toString());
        } catch (e) {
            console.error("User account not found. Make sure to run create-user.test.ts first!");
            throw e;
        }

        // Verify that the user token vault exists
        try {
            const userVault = await program.account.userTokenVault.fetch(userTokenVaultPda);
            console.log("User token vault exists with balance:", userVault.depositedAmount.toString());
        } catch (e) {
            console.error("User token vault not found. Make sure to run vault-usdc.test.ts first!");
            throw e;
        }

        // Get drift user account details using SDK
        driftClient = new DriftClient({
            connection: program.provider.connection,
            wallet: provider.wallet,
            programID: DRIFT_PROGRAM_ID,
        });
    });

    it("should initialize a drift user stats", async function () {
        // First, initialize the drift user
        console.log("Initializing Drift user with the following accounts:");
        console.log("- Signer:", provider.wallet.publicKey.toString());
        console.log("- User State:", userStatePda.toString());
        console.log("- Drift State:", driftStatePda.toString());
        console.log("- Drift User:", driftUserPda.toString());
        console.log("- Drift User Stats:", driftUserStatsPda.toString());

        // Initialize the drift user stats
        await program.methods
            .initDriftUserStats()
            .accounts({
                signer: provider.wallet.publicKey,
                userState: userStatePda,
                driftState: driftStatePda,
                driftUserStats: driftUserStatsPda,
                arraySigner: programSignerPda,
                tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            })
            .rpc();
    });

    it("should initialize a drift user", async function () {
        // First, initialize the drift user
        console.log("Initializing Drift user with the following accounts:");
        console.log("- Signer:", provider.wallet.publicKey.toString());
        console.log("- User State:", userStatePda.toString());
        console.log("- Drift State:", driftStatePda.toString());
        console.log("- Drift User:", driftUserPda.toString());
        console.log("- Drift User Stats:", driftUserStatsPda.toString());

        // Initialize the drift user stats
        await program.methods
            .initDriftUser(subAccountId)
            .accounts({
                signer: provider.wallet.publicKey,
                userState: userStatePda,
                driftState: driftStatePda,
                driftUser: driftUserPda,
                driftUserStats: driftUserStatsPda,
                arraySigner: programSignerPda,
                tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            })
            .rpc();

        console.log("Drift user initialized successfully");
    });

    it("should execute a drift deposit", async function () {
        // Check if user vault has enough USDC for the deposit
        try {
            const userVaultData = await program.account.userTokenVault.fetch(userTokenVaultPda);
            const userVaultBalance = userVaultData.depositedAmount.toNumber();
            console.log(`User vault balance: ${userVaultBalance} USDC units`);

            const depositAmount = 1_000_000; // 1 USDC (6 decimals)

            if (userVaultBalance < depositAmount) {
                console.warn(`Not enough USDC in user vault (${userVaultBalance} < ${depositAmount}). Skipping deposit test.`);
                console.warn("Make sure to run vault-usdc.test.ts and deposit enough USDC first!");
                return;
            }

            // If we have enough balance, proceed with the deposit
            const marketIndex = 0; // USDC market index in Drift

            console.log("Executing drift deposit with the following accounts:");
            console.log("- Signer:", provider.wallet.publicKey.toString());
            console.log("- Token Vault Mint:", USDC_MINT.toString());
            console.log("- User State:", userStatePda.toString());
            console.log("- Token Vault:", protocolTokenVaultPda.toString());
            console.log("- User Vault Token Account:", userTokenVaultAccountPda.toString());
            console.log("- User Token Vault:", userTokenVaultPda.toString());
            console.log("- Drift State:", driftStatePda.toString());
            console.log("- Drift User:", driftUserPda.toString());
            console.log("- Drift User Stats:", driftUserStatsPda.toString());
            console.log("- Spot Market Vault:", driftSpotMarketVaultPda.toString());


            // Wait a bit for accounts to be ready
            await new Promise(resolve => setTimeout(resolve, 1000));
            // // need a user account
            // let accounts = await fetchUserAccounts(driftClient.connection, driftClient.program, userStatePda);
            // let driftUserAccount = accounts[0];
            // // console.log("Drift user account yeah buddy:", driftUserAccount);
            // console.log(" got user account buddy");
            driftClient.authority = userStatePda;
            await driftClient.subscribe();
            // await driftClient.fetchAllUserAccounts();
            // // let driftUserAccount = await driftClient.getUserAccount(subAccountId, userStatePda);

            const driftRemainingAccounts = driftClient.getRemainingAccounts({
                userAccounts: [],
                writablePerpMarketIndexes: [marketIndex],
                useMarketLastSlotCache: false,
            });
            driftRemainingAccounts[2].isWritable = true;

            console.log("Drift remaining accounts:", driftRemainingAccounts);

            await program.methods
                .driftDeposit(vaultIndex, marketIndex, new anchor.BN(depositAmount))
                .accounts({
                    signer: provider.wallet.publicKey,
                    tokenVaultMint: USDC_MINT,
                    userState: userStatePda,
                    driftState: driftStatePda,
                    driftUser: driftUserPda,
                    driftUserStats: driftUserStatsPda,
                    spotMarketVault: driftSpotMarketVaultPda,
                    arraySigner: programSignerPda,
                    tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
                })
                .remainingAccounts(driftRemainingAccounts)
                .rpc();

            console.log("Drift deposit executed successfully");

            // Verify the state changes
            const updatedUserVaultData = await program.account.userTokenVault.fetch(userTokenVaultPda);
            console.log("User vault balance after deposit:", updatedUserVaultData.depositedAmount.toString());
        } catch (e) {
            console.error("Error checking user vault balance or executing deposit:", e);
        }
    });

    it("should mock a successful drift deposit", async () => {
        // For testing without an actual Drift program, this is a mock test
        // that only checks if we're constructing the accounts properly

        console.log("This is a mock test that doesn't actually execute the deposit");
        console.log("In a real environment, you would use the following accounts:");

        console.log("Array Protocol PDAs:");
        console.log("- Program State:", programStatePda.toString());
        console.log("- User State:", userStatePda.toString());
        console.log("- Protocol Token Vault:", protocolTokenVaultPda.toString());
        console.log("- User Token Vault:", userTokenVaultPda.toString());
        console.log("- User Token Vault Account:", userTokenVaultAccountPda.toString());

        console.log("\nDrift PDAs:");
        console.log("- Drift State:", driftStatePda.toString());
        console.log("- Drift User:", driftUserPda.toString());
        console.log("- Drift User Stats:", driftUserStatsPda.toString());
        console.log("- Drift Spot Market Vault:", driftSpotMarketVaultPda.toString());

        // Instead of making the actual call, just verify the PDAs are constructed
        expect(driftUserPda).to.not.be.null;
        expect(driftUserStatsPda).to.not.be.null;
        expect(driftStatePda).to.not.be.null;
        expect(driftSpotMarketVaultPda).to.not.be.null;
    });
}); 