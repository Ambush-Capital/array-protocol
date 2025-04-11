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
    findUserTokenVaultAccountPDA
} from "./utils/pda-gen";

describe("array-protocol: USDC Vault", () => {
    const provider = anchor.AnchorProvider.local();
    anchor.setProvider(provider);

    const program = anchor.workspace.ArrayProtocol as Program<ArrayProtocol>;

    let programStatePda: anchor.web3.PublicKey;
    let userStatePda: anchor.web3.PublicKey;
    let protocolTokenVaultPda: anchor.web3.PublicKey;
    let userTokenVaultPda: anchor.web3.PublicKey;
    let userTokenVaultAccountPda: anchor.web3.PublicKey;
    let programSignerPda: anchor.web3.PublicKey;

    // Token accounts
    const USDC_MINT = new anchor.web3.PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"); // Mainnet USDC
    let userTokenAccount: anchor.web3.PublicKey;
    let initialUsdcBalance: number;
    const vaultIndex = 0; // Use index 0 for USDC as set in init-supported-token-vaults.test.ts

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
        // Find program state PDA
        [programStatePda] = findProgramStatePDA(program.programId);

        // Find program signer PDA
        [programSignerPda] = findProgramSignerPDA(program.programId);

        // Find user PDA
        const userKey = provider.wallet.publicKey;
        [userStatePda] = findUserStatePDA(userKey, program.programId);

        // Verify the user account exists
        try {
            const userState = await program.account.user.fetch(userStatePda);
            console.log("Found existing user account:", userState.authority.toString());
        } catch (e) {
            console.error("User account not found. Make sure to run create-user.test.ts first!");
            throw e;
        }

        // Get the associated token account for USDC
        userTokenAccount = await getAssociatedTokenAddress(
            USDC_MINT,
            provider.wallet.publicKey
        );

        // Check if the wallet has USDC
        try {
            initialUsdcBalance = await getTokenBalance(provider.connection, userTokenAccount);
            console.log(`Initial USDC balance: ${initialUsdcBalance}`);

            if (initialUsdcBalance === 0) {
                console.warn("WARNING: Wallet has no USDC. Tests will be skipped.");
            }
        } catch (e) {
            console.error("Error checking USDC balance. Make sure you have a USDC token account:", e);
            initialUsdcBalance = 0;
        }

        // Setup vault PDAs
        [protocolTokenVaultPda] = findTokenVaultPDA(vaultIndex, program.programId);

        // Find user token vault PDA
        [userTokenVaultPda] = findUserTokenVaultPDA(userStatePda, vaultIndex, program.programId);

        // Find user token vault account PDA
        [userTokenVaultAccountPda] = findUserTokenVaultAccountPDA(userStatePda, vaultIndex, program.programId);
    });

    describe("USDC Vault Setup", () => {
        it("should verify USDC token vault is initialized", async () => {
            try {
                const vaultData = await program.account.supportedTokenVault.fetch(protocolTokenVaultPda);
                expect(vaultData.mint.toString()).to.equal(USDC_MINT.toString(), "Vault mint should match USDC mint");
                console.log("USDC vault is initialized");
            } catch (e) {
                console.warn("USDC vault not initialized. Make sure to run init-supported-token-vaults.test.ts first!");
                throw e;
            }
        });

        it("should initialize user USDC vault", async () => {
            await program.methods
                .initUserTokenVault(vaultIndex)
                .accounts({
                    signer: provider.wallet.publicKey,
                    tokenVaultMint: USDC_MINT,
                    userState: userStatePda,
                    state: programStatePda,
                    arraySigner: programSignerPda,
                })
                .rpc();

            const userVaultData = await program.account.userTokenVault.fetch(userTokenVaultPda);
            expect(userVaultData.mint.toString()).to.equal(USDC_MINT.toString(), "User vault mint should match USDC mint");
            expect(userVaultData.depositedAmount.toString()).to.equal('0', "Initial user vault balance should be 0");
        });
    });

    describe("USDC Operations", () => {
        it("should check if wallet has USDC for testing", async () => {
            const currentBalance = await getTokenBalance(provider.connection, userTokenAccount);
            console.log(`Current USDC balance: ${currentBalance} USDC`);

            // Skip tests if no USDC available
            if (currentBalance === 0) {
                console.warn("Skipping deposit tests - no USDC available");
                return;
            }
        });

        describe("Deposit", () => {
            it("should deposit exactly 2 USDC to the vault", async () => {
                // Skip test if not enough USDC available
                if (initialUsdcBalance < 1) {
                    console.warn(`Skipping deposit test - not enough USDC available (${initialUsdcBalance})`);
                    return;
                }

                // Deposit exactly 1 USDC (USDC has 6 decimal places)
                const depositAmount = 2000000; // 2 USDC = 2,000,000 units

                console.log(`Attempting to deposit ${depositAmount} USDC units (2 USDC) from user token account ${userTokenAccount} to user vault account ${userTokenVaultAccountPda}`);
                console.log(`Protocol token vault (${protocolTokenVaultPda}) will track total deposits`);
                console.log(`User state (${userStatePda}) will be updated to reflect new position for vault index ${vaultIndex}`);
                // Get token account info to verify owner
                const tokenAccountInfo = await provider.connection.getAccountInfo(userTokenAccount);
                if (!tokenAccountInfo) {
                    throw new Error("Could not fetch token account info");
                }
                console.log("User token account owner:", tokenAccountInfo.owner.toString());


                await program.methods
                    .depositSpl(vaultIndex, new anchor.BN(depositAmount))
                    .accounts({
                        signer: provider.wallet.publicKey,
                        tokenVaultMint: USDC_MINT,
                        userTokenAccount: userTokenAccount,
                        userState: userStatePda,
                        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
                        arraySigner: programSignerPda,
                    })
                    .rpc();

                // Check protocol token vault balance
                const vaultData = await program.account.supportedTokenVault.fetch(protocolTokenVaultPda);
                expect(vaultData.balance.toString()).to.equal(depositAmount.toString(), "Protocol vault balance should be 2 USDC");

                // Check user token vault balance
                const userVaultData = await program.account.userTokenVault.fetch(userTokenVaultPda);
                expect(userVaultData.depositedAmount.toString()).to.equal(depositAmount.toString(), "User vault balance should be 2 USDC");

                const userVaultTokenAccountBalance = await getAccount(provider.connection, userTokenVaultAccountPda);
                expect(userVaultTokenAccountBalance.amount.toString()).to.equal('2000000', "User vault token account should have 2 USDC");

                console.log(`Successfully deposited 2 USDC (${depositAmount} units) to vault`);
            });

            it("should update user position correctly after depositing 2 USDC", async () => {
                // Skip test if not enough USDC available
                if (initialUsdcBalance < 1) {
                    console.warn(`Skipping user position test - not enough USDC available (${initialUsdcBalance})`);
                    return;
                }

                const depositAmount = 2000000; // 2 USDC
                const userTokenVaultData = await program.account.userTokenVault.fetch(userTokenVaultPda);

                // Find position with matching vault index
                expect(userTokenVaultData).to.not.be.undefined, "User should have a associated token vault for USDC vault";
                expect(userTokenVaultData!.depositedAmount.toNumber()).to.equal(depositAmount, "User position should reflect 2 USDC deposit");
            });
        });

        describe("Withdraw", () => {
            it("should withdraw 0.5 USDC correctly", async () => {
                // Skip test if not enough USDC available
                if (initialUsdcBalance < 1) {
                    console.warn(`Skipping withdrawal test - not enough USDC available (${initialUsdcBalance})`);
                    return;
                }

                const depositAmount = 2000000; // 1 USDC
                const withdrawAmount = 500000; // 0.5 USDC

                await program.methods
                    .withdrawSpl(vaultIndex, new anchor.BN(withdrawAmount))
                    .accounts({
                        signer: provider.wallet.publicKey,
                        tokenVaultMint: USDC_MINT,
                        userState: userStatePda,
                        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
                        arraySigner: programSignerPda,
                        userTokenAccount: userTokenAccount,
                        state: programStatePda,
                    })
                    .rpc();

                // Check protocol token vault balance
                const vaultData = await program.account.supportedTokenVault.fetch(protocolTokenVaultPda);
                expect(vaultData.balance.toString()).to.equal((depositAmount - withdrawAmount).toString(), "Protocol vault balance should be 1.5 USDC");

                // Check user token vault balance
                const userVaultData = await program.account.userTokenVault.fetch(userTokenVaultPda);
                expect(userVaultData.depositedAmount.toString()).to.equal((depositAmount - withdrawAmount).toString(), "User vault balance should be 1.5 USDC");

                console.log(`Successfully withdrew 0.5 USDC (${withdrawAmount} units) from vault`);
            });

            it("should update user position after withdrawal of 0.5 USDC", async () => {
                // Skip test if not enough USDC available
                if (initialUsdcBalance < 1) {
                    console.warn(`Skipping user position test - not enough USDC available (${initialUsdcBalance})`);
                    return;
                }

                const depositAmount = 2000000; // 1 USDC
                const withdrawAmount = 500000; // 0.5 USDC
                const userTokenVaultData = await program.account.userTokenVault.fetch(userTokenVaultPda);

                // Find position with matching vault index
                expect(userTokenVaultData).to.not.be.undefined, "User should have a position for USDC vault";
                expect(userTokenVaultData!.depositedAmount.toNumber()).to.equal(depositAmount - withdrawAmount, "User position should reflect 1.5 USDC remaining");
            });
        });
    });
});
