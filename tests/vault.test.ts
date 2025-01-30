import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ArrayProtocol } from "../target/types/array_protocol";
import { expect, assert } from "chai";
import { 
  createMint, 
  createAssociatedTokenAccount as _createAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token"; 

describe("array-protocol", () => {
  const provider = anchor.AnchorProvider.local();
  anchor.setProvider(provider);

  const program = anchor.workspace.ArrayProtocol as Program<ArrayProtocol>;

  let userStatePda: anchor.web3.PublicKey;
  let userStateBump: number;
  let vaultPda: anchor.web3.PublicKey;
  let vaultBump: number;

  // Token accounts
  let testMint: anchor.web3.PublicKey;
  let userTokenAccount: anchor.web3.PublicKey;
  let userVaultAccountPda: anchor.web3.PublicKey;
  let userVaultAccountBump: number;

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

  describe("User Account Creation", () => {
    it("should create a new user account", async () => {
      const userKey = provider.wallet.publicKey;
      [userStatePda, userStateBump] = await anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("user"), userKey.toBuffer()],
        program.programId
      );

      await program.methods
        .createUser()
        .accounts({
          authority: userKey,
        })
        .rpc();

      const userStateData = await program.account.user.fetch(userStatePda);
      
      expect(userStateData.authority.toString()).to.equal(userKey.toString(), "User authority should match");
    });

    it("should initialize user positions correctly", async () => {
      const userStateData = await program.account.user.fetch(userStatePda);
      expect(userStateData.positions).to.have.lengthOf(8, "Should have 8 position slots");
      expect(userStateData.positions.every(pos => pos.balance.eq(new anchor.BN(0))), "All positions should start at 0");
    });
  });

  describe("Vault Initialization", () => {
    it("should create vault with correct PDA", async () => {
      const vaultIndex = 0;
      const vaultIndexBytes = Buffer.alloc(2);
      vaultIndexBytes.writeUInt16LE(vaultIndex);
      const userKey = provider.wallet.publicKey;

      [vaultPda, vaultBump] = await anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), vaultIndexBytes],
        program.programId
      );

      testMint = await createTestMint(provider);
      userTokenAccount = await createAssociatedTokenAccount(
        provider,
        testMint,
        provider.wallet.publicKey
      );

      [userVaultAccountPda, userVaultAccountBump] = await anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("user_vault_account"), provider.wallet.publicKey.toBuffer(), vaultIndexBytes],
        program.programId
      );
    });

    it("should initialize vault with correct parameters", async () => {
      await program.methods
        .initUserTokenVault(0)
        .accounts({
          authority: provider.wallet.publicKey,
          tokenVaultMint: testMint,
          userState: userStatePda,
        //   systemProgram: anchor.web3.SystemProgram.programId,
        //   tokenProgram: TOKEN_PROGRAM_ID,
        //   rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      const vaultData = await program.account.tokenVault.fetch(vaultPda);
      
      expect(vaultData.mint.toString()).to.equal(testMint.toString(), "Vault mint should match test mint");
      expect(vaultData.balance.toString()).to.equal('0', "Initial vault balance should be 0");
      expect(vaultData.vault.toString()).to.equal(userVaultAccountPda.toString(), "Vault token account should match PDA");
    });
  });

  describe("Token Operations", () => {
    describe("Deposit", () => {
      it("should mint initial tokens to user", async () => {
        const initialMint = 1_000;
        await mintToAccount(provider, testMint, userTokenAccount, initialMint);
      });

      it("should accept deposit and update vault balance", async () => {
        const depositAmount = 300;
        
        await program.methods
          .depositSpl(0, new anchor.BN(depositAmount))
          .accounts({
            authority: provider.wallet.publicKey,
            userState: userStatePda,
            userTokenAccount: userTokenAccount,
            tokenVaultMint: testMint,
            // tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();

        const vaultData = await program.account.tokenVault.fetch(vaultPda);
        expect(vaultData.balance.toNumber()).to.equal(depositAmount, "Vault balance should match deposit amount");
      });

      it("should update user position correctly", async () => {
        const depositAmount = 300;
        const userStateData = await program.account.user.fetch(userStatePda);
        
        expect(userStateData.positions[0].balance.toNumber()).to.equal(depositAmount, "User position should reflect deposit");
        expect(userStateData.positions.slice(1).every(pos => pos.balance.eq(new anchor.BN(0))), "Other positions should remain empty");
      });
    });

    describe("Withdraw", () => {
      it("should process withdrawal correctly", async () => {
        const withdrawAmount = 100;
        const initialBalance = 300;
        
        await program.methods
          .withdrawSpl(0, new anchor.BN(withdrawAmount))
          .accounts({
            authority: provider.wallet.publicKey,
            userState: userStatePda,
            userTokenAccount: userTokenAccount,
            tokenVaultMint: testMint,
            // tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();

        const vaultData = await program.account.tokenVault.fetch(vaultPda);
        expect(vaultData.balance.toNumber()).to.equal(initialBalance - withdrawAmount, "Vault balance should be reduced by withdrawal amount");
      });

      it("should update user position after withdrawal", async () => {
        const withdrawAmount = 100;
        const initialBalance = 300;
        const userStateData = await program.account.user.fetch(userStatePda);

        expect(userStateData.positions[0].balance.toNumber()).to.equal(initialBalance - withdrawAmount, "User position should reflect withdrawal");
        expect(userStateData.positions.slice(1).every(pos => pos.balance.eq(new anchor.BN(0))), "Other positions should remain empty");
      });
    });
  });
});