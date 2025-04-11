import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ArrayProtocol } from "../target/types/array_protocol";
import { expect } from "chai";
import {
  createMint,
  createAssociatedTokenAccount as _createAssociatedTokenAccount,
  mintTo,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  findProgramStatePDA,
  findProgramSignerPDA,
  findUserStatePDA,
  findTokenVaultPDA,
  findUserTokenVaultPDA,
  findUserTokenVaultAccountPDA
} from "./utils/pda-gen";

describe("array-protocol: Token Vault with Mock Token", () => {
  const provider = anchor.AnchorProvider.local();
  anchor.setProvider(provider);

  const program = anchor.workspace.ArrayProtocol as Program<ArrayProtocol>;

  let programStatePda: anchor.web3.PublicKey;
  let userStatePda: anchor.web3.PublicKey;
  let protocolTokenVaultPda: anchor.web3.PublicKey; // Protocol-level token vault
  let userTokenVaultPda: anchor.web3.PublicKey; // User's token vault metadata
  let userTokenVaultAccountPda: anchor.web3.PublicKey; // User's token vault SPL account
  let programSignerPda: anchor.web3.PublicKey;
  // Token accounts that will be initialized in the test
  let testMint: anchor.web3.PublicKey;
  let userTokenAccount: anchor.web3.PublicKey;
  const vaultIndex = 1; // Use index 1 for mock token

  // Helper functions for token operations
  const createTestMint = async (provider: anchor.AnchorProvider) => {
    return await createMint(
      provider.connection,
      (provider.wallet as anchor.Wallet).payer,
      provider.wallet.publicKey,
      null,
      9
    );
  };

  const createAssociatedTokenAccount = async (
    provider: anchor.AnchorProvider,
    mint: anchor.web3.PublicKey,
    owner: anchor.web3.PublicKey
  ) => {
    return await _createAssociatedTokenAccount(
      provider.connection,
      (provider.wallet as anchor.Wallet).payer,
      mint,
      owner
    );
  };

  const mintToAccount = async (
    provider: anchor.AnchorProvider,
    mint: anchor.web3.PublicKey,
    tokenAccount: anchor.web3.PublicKey,
    amount: number
  ) => {
    await mintTo(
      provider.connection,
      (provider.wallet as anchor.Wallet).payer,
      mint,
      tokenAccount,
      provider.wallet.publicKey,
      amount
    );
  };

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

    // Create test mint and user token account for this test
    testMint = await createTestMint(provider);
    console.log("Created test mint:", testMint.toString());

    userTokenAccount = await createAssociatedTokenAccount(
      provider,
      testMint,
      provider.wallet.publicKey
    );
    console.log("Created user token account:", userTokenAccount.toString());

    // Mint initial tokens to user
    const initialMint = 1_000;
    await mintToAccount(provider, testMint, userTokenAccount, initialMint);
    console.log(`Minted ${initialMint} tokens to user account`);

    // Find protocol token vault PDA
    [protocolTokenVaultPda] = findTokenVaultPDA(vaultIndex, program.programId);
  });

  describe("Initialize Mock Token as Supported Token Vault", () => {
    it("should initialize mock token as a supported vault", async () => {
      await program.methods
        .initSupportedTokenVault()
        .accounts({
          admin: provider.wallet.publicKey, // Using provider as admin for test
          state: programStatePda,
          tokenVaultMint: testMint,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        })
        .rpc();

      const vaultData = await program.account.supportedTokenVault.fetch(protocolTokenVaultPda);
      expect(vaultData.mint.toString()).to.equal(testMint.toString(), "Vault mint should match test mint");
      expect(vaultData.balance.toString()).to.equal('0', "Initial vault balance should be 0");
      expect(vaultData.tokenVaultIndex).to.equal(vaultIndex);
    });
  });

  describe("Initialize User Token Vault", () => {
    it("should create user token vault PDAs", async () => {
      // Find user token vault PDA
      [userTokenVaultPda] = findUserTokenVaultPDA(userStatePda, vaultIndex, program.programId);

      // Find user token vault account PDA
      [userTokenVaultAccountPda] = findUserTokenVaultAccountPDA(userStatePda, vaultIndex, program.programId);
    });

    it("should initialize user token vault with correct parameters", async () => {
      await program.methods
        .initUserTokenVault(vaultIndex)
        .accounts({
          signer: provider.wallet.publicKey,
          tokenVaultMint: testMint,
          userState: userStatePda,
          state: programStatePda,
          arraySigner: programSignerPda,
        })
        .rpc();

      const userVaultData = await program.account.userTokenVault.fetch(userTokenVaultPda);
      expect(userVaultData.mint.toString()).to.equal(testMint.toString(), "User vault mint should match test mint");
      expect(userVaultData.depositedAmount.toString()).to.equal('0', "Initial user vault balance should be 0");
      expect(userVaultData.tokenVaultIndex).to.equal(vaultIndex);
    });
  });

  describe("Token Operations", () => {
    describe("Deposit", () => {
      it("should accept deposit and update vault balances", async () => {
        const depositAmount = 300;

        await program.methods
          .depositSpl(vaultIndex, new anchor.BN(depositAmount))
          .accounts({
            signer: provider.wallet.publicKey,
            tokenVaultMint: testMint,
            userTokenAccount: userTokenAccount,
            userState: userStatePda,
            tokenProgram: TOKEN_PROGRAM_ID,
            arraySigner: programSignerPda,
          })
          .rpc();

        // Check protocol token vault balance
        const vaultData = await program.account.supportedTokenVault.fetch(protocolTokenVaultPda);
        expect(vaultData.balance.toString()).to.equal(depositAmount.toString(), "Protocol vault balance should match deposit amount");

        // Check user token vault balance 
        const userVaultData = await program.account.userTokenVault.fetch(userTokenVaultPda);
        expect(userVaultData.depositedAmount.toString()).to.equal(depositAmount.toString(), "User vault balance should match deposit amount");
      });

      it("should update user position correctly", async () => {
        const depositAmount = 300;
        const userTokenVaultData = await program.account.userTokenVault.fetch(userTokenVaultPda);

        // Find position with matching vault index
        expect(userTokenVaultData).to.not.be.undefined, "User should have a position for the vault";
        expect(userTokenVaultData!.depositedAmount.toNumber()).to.equal(depositAmount, "User position should reflect deposit");
      });
    });

    describe("Withdraw", () => {
      it("should process withdrawal correctly", async () => {
        const withdrawAmount = 100;
        const initialBalance = 300;

        await program.methods
          .withdrawSpl(vaultIndex, new anchor.BN(withdrawAmount))
          .accounts({
            signer: provider.wallet.publicKey,
            tokenVaultMint: testMint,
            userState: userStatePda,
            userTokenAccount: userTokenAccount,
            state: programStatePda,
            tokenProgram: TOKEN_PROGRAM_ID,
            arraySigner: programSignerPda,
          })
          .rpc();

        // Check protocol token vault balance
        const vaultData = await program.account.supportedTokenVault.fetch(protocolTokenVaultPda);
        expect(vaultData.balance.toString()).to.equal((initialBalance - withdrawAmount).toString(), "Protocol vault balance should be reduced");

        // Check user token vault balance
        const userVaultData = await program.account.userTokenVault.fetch(userTokenVaultPda);
        expect(userVaultData.depositedAmount.toString()).to.equal((initialBalance - withdrawAmount).toString(), "User vault balance should be reduced");
      });

      it("should update user position after withdrawal", async () => {
        const withdrawAmount = 100;
        const initialBalance = 300;
        const userStateData = await program.account.user.fetch(userStatePda);

        // Find position with matching vault index
        const userTokenVaultData = await program.account.userTokenVault.fetch(userTokenVaultPda);
        expect(userTokenVaultData).to.not.be.undefined, "User should have a position for the vault";
        expect(userTokenVaultData!.depositedAmount.toNumber()).to.equal(initialBalance - withdrawAmount, "User position should reflect withdrawal");
      });
    });
  });
});