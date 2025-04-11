import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ArrayProtocol } from "../target/types/array_protocol";
import { expect } from "chai";
import {
    findProgramStatePDA,
    findProgramSignerPDA,
    findTokenVaultPDA
} from "./utils/pda-gen";

describe("array-protocol: Initialize Supported Token Vaults", () => {
    const provider = anchor.AnchorProvider.local();
    anchor.setProvider(provider);

    const program = anchor.workspace.ArrayProtocol as Program<ArrayProtocol>;

    let programStatePda: anchor.web3.PublicKey;

    // USDC on mainnet
    const USDC_MINT = new anchor.web3.PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    let usdcVaultPda: anchor.web3.PublicKey;
    let programSignerPda: anchor.web3.PublicKey;

    before(async () => {
        [programStatePda] = findProgramStatePDA(program.programId);
        [programSignerPda] = findProgramSignerPDA(program.programId);
    });

    it("should initialize USDC as a supported token vault", async () => {
        const vaultIndex = 0; // Use index 0 for USDC

        [usdcVaultPda] = findTokenVaultPDA(vaultIndex, program.programId);

        await program.methods
            .initSupportedTokenVault()
            .accounts({
                admin: provider.wallet.publicKey, // Using provider as admin for test
                state: programStatePda,
                tokenVaultMint: USDC_MINT,
                tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            })
            .rpc();

        const vaultData = await program.account.supportedTokenVault.fetch(usdcVaultPda);
        expect(vaultData.mint.toString()).to.equal(USDC_MINT.toString(), "Vault mint should be USDC");
        expect(vaultData.tokenVaultIndex).to.equal(vaultIndex);
        expect(vaultData.balance.toString()).to.equal("0");
    });

    it("should update program state token vault count", async () => {
        const stateData = await program.account.programState.fetch(programStatePda);
        expect(stateData.tokenVaultCount).to.be.greaterThan(0, "Token vault count should be updated");
    });
}); 