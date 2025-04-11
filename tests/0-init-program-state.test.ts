import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ArrayProtocol } from "../target/types/array_protocol";
import { expect } from "chai";
import { findProgramSignerPDA, findProgramStatePDA } from "./utils/pda-gen";

describe("array-protocol: Program State Initialization", () => {
    const provider = anchor.AnchorProvider.local();
    anchor.setProvider(provider);

    const program = anchor.workspace.ArrayProtocol as Program<ArrayProtocol>;

    let programStatePda: anchor.web3.PublicKey;

    before(async () => {
        [programStatePda] = findProgramStatePDA(program.programId);
    });

    // For testing purposes, we'll use the local provider wallet as the admin
    // In production, this would be the actual admin wallet
    it("should initialize program state", async () => {
        // Note: We're using the provider wallet as admin for testing
        // For production: You would need to use the actual admin wallet defined in ids.rs
        await program.methods
            .initProgramState()
            .accounts({
                admin: provider.wallet.publicKey,
                tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            })
            .rpc();

        const stateData = await program.account.programState.fetch(programStatePda);
        expect(stateData.admin.toString()).to.equal(provider.wallet.publicKey.toString());
        expect(stateData.tokenVaultCount).to.equal(0);

        // Verify PDA was set correctly
        const [expectedSignerPda] = findProgramSignerPDA(program.programId);
        expect(stateData.signerPda.toString()).to.equal(expectedSignerPda.toString());
    });

    it("should support fetching program state", async () => {
        const stateData = await program.account.programState.fetch(programStatePda);
        console.log("Program state initialized with admin:", stateData.admin.toString());
        console.log("Current token vault count:", stateData.tokenVaultCount);
    });
}); 