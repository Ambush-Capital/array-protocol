import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ArrayProtocol } from "../target/types/array_protocol";
import { expect } from "chai";
import { findUserStatePDA } from "./utils/pda-gen";

describe("array-protocol: User Account Creation", () => {
    const provider = anchor.AnchorProvider.local();
    anchor.setProvider(provider);

    const program = anchor.workspace.ArrayProtocol as Program<ArrayProtocol>;

    let userStatePda: anchor.web3.PublicKey;

    it("should create a new user account", async () => {
        const userKey = provider.wallet.publicKey;
        [userStatePda] = findUserStatePDA(userKey, program.programId);

        await program.methods
            .initUser()
            .accounts({
                signer: userKey,
            })
            .rpc();

        const userStateData = await program.account.user.fetch(userStatePda);

        expect(userStateData.authority.toString()).to.equal(userKey.toString(), "User authority should match");
    });

    it("should initialize user positions correctly", async () => {
        const userStateData = await program.account.user.fetch(userStatePda);
        expect(userStateData.positions).to.have.lengthOf(8, "Should have 8 position slots");
        expect(userStateData.positions.every(pos => pos.depositedAmount.eq(new anchor.BN(0))), "All positions should start at 0");
    });
}); 