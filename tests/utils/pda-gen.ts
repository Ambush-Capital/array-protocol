import * as anchor from "@coral-xyz/anchor";

/**
 * Utility functions to generate PDAs used throughout the Array Protocol
 */
export const findProgramStatePDA = (programId: anchor.web3.PublicKey): [anchor.web3.PublicKey, number] => {
    return anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("array_program_state")],
        programId
    );
};

export const findProgramSignerPDA = (programId: anchor.web3.PublicKey): [anchor.web3.PublicKey, number] => {
    return anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("array_signer")],
        programId
    );
};

export const findUserStatePDA = (
    userKey: anchor.web3.PublicKey,
    programId: anchor.web3.PublicKey
): [anchor.web3.PublicKey, number] => {
    return anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("user"), userKey.toBuffer()],
        programId
    );
};

export const findTokenVaultPDA = (
    vaultIndex: number,
    programId: anchor.web3.PublicKey
): [anchor.web3.PublicKey, number] => {
    const vaultIndexBytes = Buffer.alloc(2);
    vaultIndexBytes.writeUInt16LE(vaultIndex);

    return anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("token_vault"), vaultIndexBytes],
        programId
    );
};

export const findUserTokenVaultPDA = (
    userStatePda: anchor.web3.PublicKey,
    vaultIndex: number,
    programId: anchor.web3.PublicKey
): [anchor.web3.PublicKey, number] => {
    const vaultIndexBytes = Buffer.alloc(2);
    vaultIndexBytes.writeUInt16LE(vaultIndex);

    return anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("user_vault"), userStatePda.toBuffer(), vaultIndexBytes],
        programId
    );
};

export const findUserTokenVaultAccountPDA = (
    userStatePda: anchor.web3.PublicKey,
    vaultIndex: number,
    programId: anchor.web3.PublicKey
): [anchor.web3.PublicKey, number] => {
    const vaultIndexBytes = Buffer.alloc(2);
    vaultIndexBytes.writeUInt16LE(vaultIndex);

    return anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("user_vault_account"), userStatePda.toBuffer(), vaultIndexBytes],
        programId
    );
};


export const findDriftUserPDA = (
    userKey: anchor.web3.PublicKey,
    subAccountId: number,
    programId: anchor.web3.PublicKey,
): [anchor.web3.PublicKey, number] => {
    const subAccountIdBytes = Buffer.alloc(2);
    subAccountIdBytes.writeUInt16LE(subAccountId);

    return anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("user"), userKey.toBuffer(), subAccountIdBytes],
        programId
    );
};

export const findDriftUserStatsPDA = (
    userKey: anchor.web3.PublicKey,
    programId: anchor.web3.PublicKey
): [anchor.web3.PublicKey, number] => {
    return anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("user_stats"), userKey.toBuffer()],
        programId
    );
};

export const findDriftSpotMarketVaultPDA = (
    marketIndex: number,
    programId: anchor.web3.PublicKey
): [anchor.web3.PublicKey, number] => {
    const marketIndexBytes = Buffer.alloc(2);
    marketIndexBytes.writeUInt16LE(marketIndex);

    return anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("spot_market_vault"), marketIndexBytes],
        programId
    );
};

export const findDriftStatePDA = (
    programId: anchor.web3.PublicKey
): [anchor.web3.PublicKey, number] => {
    return anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("drift_state")],
        programId
    );
};

export const findDriftSignerPDA = (
    programId: anchor.web3.PublicKey
): [anchor.web3.PublicKey, number] => {
    return anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("drift_signer")],
        programId
    );
};









