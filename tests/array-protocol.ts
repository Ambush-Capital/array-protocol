import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ArrayProtocol } from "../target/types/array_protocol";

describe("array-protocol", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.ArrayProtocol as Program<ArrayProtocol>;

  it("Empty test!", async () => {
    // Add your test here.    
    console.log("This is an empty test.");
  });
});
