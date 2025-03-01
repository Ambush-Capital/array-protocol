import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { UI } from './ui-utils';
import { CONSTANTS } from './connection-utils';

export const loadWalletKeypair = async (): Promise<Keypair> => {
    // Try to load from KEYPAIR_PATH environment variable first
    const keypairPath = process.env.KEYPAIR_PATH;
    if (keypairPath && fs.existsSync(keypairPath)) {
        try {
            console.log(`${UI.loading} Loading keypair from path: ${keypairPath}`);
            const keyData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
            return Keypair.fromSecretKey(new Uint8Array(keyData));
        } catch (e) {
            console.error(`${UI.xmark} Error loading keypair from path:`, e);
        }
    }

    // Try to load from PRIVATE_KEY environment variable
    const privateKeyStr = process.env.PRIVATE_KEY;
    if (privateKeyStr) {
        try {
            console.log(`${UI.loading} Loading keypair from PRIVATE_KEY environment variable`);
            const privateKey = new Uint8Array(JSON.parse(privateKeyStr));
            return Keypair.fromSecretKey(privateKey);
        } catch (e) {
            console.error(`${UI.xmark} Error parsing private key from environment variable:`, e);
        }
    }

    // Try to load from WALLET_ADDRESS environment variable (for check-wallet-simple.ts)
    const walletAddress = process.env.WALLET_ADDRESS;
    if (walletAddress) {
        try {
            console.log(`${UI.loading} Found wallet address from WALLET_ADDRESS environment variable`);
            // Note: This doesn't return a keypair, but we'll handle this case separately in the scripts
            // that only need to check balances
            return null;
        } catch (e) {
            console.error(`${UI.xmark} Error parsing wallet address from environment variable:`, e);
        }
    }

    // Try to load from Solana CLI config
    try {
        const configFile = path.resolve(os.homedir(), '.config/solana/id.json');
        if (fs.existsSync(configFile)) {
            console.log(`${UI.loading} Loading keypair from Solana CLI config: ${configFile}`);
            const keyData = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
            return Keypair.fromSecretKey(new Uint8Array(keyData));
        }
    } catch (e) {
        console.error(`${UI.xmark} Error loading keypair from Solana config:`, e);
    }

    // If we can't load a keypair, generate a new one (for testing only)
    console.warn(`${UI.xmark} No wallet keypair found. Generating a new one for testing purposes only.`);
    return Keypair.generate();
};

export const createWalletAdapter = (keypair: Keypair) => {
    return {
        publicKey: keypair.publicKey,
        signTransaction: async (tx: Transaction) => {
            tx.partialSign(keypair);
            return tx;
        },
        signAllTransactions: async (txs: any[]) => {
            return Promise.all(txs.map(async (tx) => {
                if (tx.sign) {
                    return tx.sign([keypair]);
                } else {
                    tx.partialSign(keypair);
                    return tx;
                }
            }));
        },
        signMessage: async (msg: Uint8Array) => new Uint8Array(), // Implement if needed
    };
};

/**
 * Creates a dummy wallet for read-only operations
 */
export const createDummyWallet = () => {
    return {
        publicKey: new PublicKey('11111111111111111111111111111111'),
        signTransaction: async (tx: any) => tx,
        signAllTransactions: async (txs: any[]) => txs,
        signMessage: async (msg: Uint8Array) => new Uint8Array(),
    };
};

export const findUsdcTokenAccount = async (
    connection: Connection,
    walletPublicKey: PublicKey
): Promise<PublicKey | null> => {
    console.log(`${UI.loading} Finding USDC token account...`);

    try {
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
            walletPublicKey,
            { mint: new PublicKey(CONSTANTS.USDC_MINT) }
        );

        if (tokenAccounts.value.length > 0) {
            const tokenAccount = tokenAccounts.value[0];
            const tokenAccountAddress = tokenAccount.pubkey;
            const tokenBalance = tokenAccount.account.data.parsed.info.tokenAmount.uiAmount;

            console.log(`${UI.checkmark} Found USDC token account: ${tokenAccountAddress.toString()}`);
            console.log(`${UI.checkmark} USDC Balance: ${tokenBalance} USDC`);

            return tokenAccountAddress;
        } else {
            console.log(`${UI.xmark} No USDC token accounts found for this wallet`);
            return null;
        }
    } catch (error) {
        console.error(`${UI.xmark} Error finding USDC token account:`, error);
        return null;
    }
};

// Add this new interface for token balances
export interface TokenBalance {
    mint: PublicKey;
    address: PublicKey;
    amount: number;
    decimals: number;
    symbol?: string;
    name?: string;
}

// Add this function to get wallet token balances
export const getWalletTokenBalances = async (
    connection: Connection,
    walletPublicKey: PublicKey
): Promise<TokenBalance[]> => {
    console.log(`${UI.loading} Fetching token accounts...`);

    try {
        // Get all token accounts for the wallet
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
            walletPublicKey,
            { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
        );

        console.log(`${UI.checkmark} Found ${tokenAccounts.value.length} token accounts`);

        // Map to our TokenBalance interface
        const balances: TokenBalance[] = tokenAccounts.value.map(account => {
            const parsedInfo = account.account.data.parsed.info;
            const mintAddress = new PublicKey(parsedInfo.mint);
            const tokenBalance = parsedInfo.tokenAmount;

            return {
                mint: mintAddress,
                address: account.pubkey,
                amount: tokenBalance.uiAmount,
                decimals: tokenBalance.decimals,
                // We'll fill in symbol and name later if available
            };
        });

        return balances;
    } catch (error) {
        console.error(`${UI.xmark} Error fetching token accounts:`, error);
        return [];
    }
};

// Add this function to get wallet SOL balance
export const getWalletSolBalance = async (
    connection: Connection,
    walletPublicKey: PublicKey
): Promise<number> => {
    try {
        const balance = await connection.getBalance(walletPublicKey);
        return balance / 1e9; // Convert lamports to SOL
    } catch (error) {
        console.error(`${UI.xmark} Error fetching SOL balance:`, error);
        return 0;
    }
};

// Add this function to get wallet information
export const getWalletInfo = async (
    connection: Connection,
    walletPublicKey: PublicKey
): Promise<{
    isSystemOwned: boolean;
    owner: PublicKey;
    executable: boolean;
    rentEpoch: number;
    lamports: number;
}> => {
    try {
        const accountInfo = await connection.getAccountInfo(walletPublicKey);

        if (!accountInfo) {
            return {
                isSystemOwned: true, // Assume it's a new system account
                owner: new PublicKey('11111111111111111111111111111111'), // System program
                executable: false,
                rentEpoch: 0,
                lamports: 0
            };
        }

        return {
            isSystemOwned: accountInfo.owner.equals(new PublicKey('11111111111111111111111111111111')),
            owner: accountInfo.owner,
            executable: accountInfo.executable,
            rentEpoch: accountInfo.rentEpoch,
            lamports: accountInfo.lamports
        };
    } catch (error) {
        console.error(`${UI.xmark} Error fetching wallet info:`, error);
        return {
            isSystemOwned: false,
            owner: new PublicKey('11111111111111111111111111111111'),
            executable: false,
            rentEpoch: 0,
            lamports: 0
        };
    }
};

// Add this function to get USDC token info
export const getUsdcTokenInfo = async (
    connection: Connection
): Promise<{
    symbol: string;
    name: string;
    logoURI?: string;
    decimals: number;
}> => {
    // For now, return hardcoded values since we know USDC details
    // In a more complete implementation, we would fetch this from a token registry
    return {
        symbol: 'USDC',
        name: 'USD Coin',
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
        decimals: 6
    };
}; 