"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUsdcTokenInfo = exports.getWalletInfo = exports.getWalletSolBalance = exports.getWalletTokenBalances = exports.findUsdcTokenAccount = exports.createDummyWallet = exports.createWalletAdapter = exports.loadWalletKeypair = void 0;
const web3_js_1 = require("@solana/web3.js");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const ui_utils_1 = require("./ui-utils");
const connection_utils_1 = require("./connection-utils");
const loadWalletKeypair = async () => {
    // Try to load from KEYPAIR_PATH environment variable first
    const keypairPath = process.env.KEYPAIR_PATH;
    if (keypairPath && fs.existsSync(keypairPath)) {
        try {
            console.log(`${ui_utils_1.UI.loading} Loading keypair from path: ${keypairPath}`);
            const keyData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
            return web3_js_1.Keypair.fromSecretKey(new Uint8Array(keyData));
        }
        catch (e) {
            console.error(`${ui_utils_1.UI.xmark} Error loading keypair from path:`, e);
        }
    }
    // Try to load from PRIVATE_KEY environment variable
    const privateKeyStr = process.env.PRIVATE_KEY;
    if (privateKeyStr) {
        try {
            console.log(`${ui_utils_1.UI.loading} Loading keypair from PRIVATE_KEY environment variable`);
            const privateKey = new Uint8Array(JSON.parse(privateKeyStr));
            return web3_js_1.Keypair.fromSecretKey(privateKey);
        }
        catch (e) {
            console.error(`${ui_utils_1.UI.xmark} Error parsing private key from environment variable:`, e);
        }
    }
    // Try to load from WALLET_ADDRESS environment variable (for check-wallet-simple.ts)
    const walletAddress = process.env.WALLET_ADDRESS;
    if (walletAddress) {
        try {
            console.log(`${ui_utils_1.UI.loading} Found wallet address from WALLET_ADDRESS environment variable`);
            // Note: This doesn't return a keypair, but we'll handle this case separately in the scripts
            // that only need to check balances
            return null;
        }
        catch (e) {
            console.error(`${ui_utils_1.UI.xmark} Error parsing wallet address from environment variable:`, e);
        }
    }
    // Try to load from Solana CLI config
    try {
        const configFile = path.resolve(os.homedir(), '.config/solana/id.json');
        if (fs.existsSync(configFile)) {
            console.log(`${ui_utils_1.UI.loading} Loading keypair from Solana CLI config: ${configFile}`);
            const keyData = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
            return web3_js_1.Keypair.fromSecretKey(new Uint8Array(keyData));
        }
    }
    catch (e) {
        console.error(`${ui_utils_1.UI.xmark} Error loading keypair from Solana config:`, e);
    }
    // If we can't load a keypair, generate a new one (for testing only)
    console.warn(`${ui_utils_1.UI.xmark} No wallet keypair found. Generating a new one for testing purposes only.`);
    return web3_js_1.Keypair.generate();
};
exports.loadWalletKeypair = loadWalletKeypair;
const createWalletAdapter = (keypair) => {
    return {
        publicKey: keypair.publicKey,
        signTransaction: async (tx) => {
            tx.partialSign(keypair);
            return tx;
        },
        signAllTransactions: async (txs) => {
            return Promise.all(txs.map(async (tx) => {
                if (tx.sign) {
                    return tx.sign([keypair]);
                }
                else {
                    tx.partialSign(keypair);
                    return tx;
                }
            }));
        },
        signMessage: async (msg) => new Uint8Array(), // Implement if needed
    };
};
exports.createWalletAdapter = createWalletAdapter;
/**
 * Creates a dummy wallet for read-only operations
 */
const createDummyWallet = () => {
    return {
        publicKey: new web3_js_1.PublicKey('11111111111111111111111111111111'),
        signTransaction: async (tx) => tx,
        signAllTransactions: async (txs) => txs,
        signMessage: async (msg) => new Uint8Array(),
    };
};
exports.createDummyWallet = createDummyWallet;
const findUsdcTokenAccount = async (connection, walletPublicKey) => {
    console.log(`${ui_utils_1.UI.loading} Finding USDC token account...`);
    try {
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(walletPublicKey, { mint: new web3_js_1.PublicKey(connection_utils_1.CONSTANTS.USDC_MINT) });
        if (tokenAccounts.value.length > 0) {
            const tokenAccount = tokenAccounts.value[0];
            const tokenAccountAddress = tokenAccount.pubkey;
            const tokenBalance = tokenAccount.account.data.parsed.info.tokenAmount.uiAmount;
            console.log(`${ui_utils_1.UI.checkmark} Found USDC token account: ${tokenAccountAddress.toString()}`);
            console.log(`${ui_utils_1.UI.checkmark} USDC Balance: ${tokenBalance} USDC`);
            return tokenAccountAddress;
        }
        else {
            console.log(`${ui_utils_1.UI.xmark} No USDC token accounts found for this wallet`);
            return null;
        }
    }
    catch (error) {
        console.error(`${ui_utils_1.UI.xmark} Error finding USDC token account:`, error);
        return null;
    }
};
exports.findUsdcTokenAccount = findUsdcTokenAccount;
// Add this function to get wallet token balances
const getWalletTokenBalances = async (connection, walletPublicKey) => {
    console.log(`${ui_utils_1.UI.loading} Fetching token accounts...`);
    try {
        // Get all token accounts for the wallet
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(walletPublicKey, { programId: new web3_js_1.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') });
        console.log(`${ui_utils_1.UI.checkmark} Found ${tokenAccounts.value.length} token accounts`);
        // Map to our TokenBalance interface
        const balances = tokenAccounts.value.map(account => {
            const parsedInfo = account.account.data.parsed.info;
            const mintAddress = new web3_js_1.PublicKey(parsedInfo.mint);
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
    }
    catch (error) {
        console.error(`${ui_utils_1.UI.xmark} Error fetching token accounts:`, error);
        return [];
    }
};
exports.getWalletTokenBalances = getWalletTokenBalances;
// Add this function to get wallet SOL balance
const getWalletSolBalance = async (connection, walletPublicKey) => {
    try {
        const balance = await connection.getBalance(walletPublicKey);
        return balance / 1e9; // Convert lamports to SOL
    }
    catch (error) {
        console.error(`${ui_utils_1.UI.xmark} Error fetching SOL balance:`, error);
        return 0;
    }
};
exports.getWalletSolBalance = getWalletSolBalance;
// Add this function to get wallet information
const getWalletInfo = async (connection, walletPublicKey) => {
    try {
        const accountInfo = await connection.getAccountInfo(walletPublicKey);
        if (!accountInfo) {
            return {
                isSystemOwned: true, // Assume it's a new system account
                owner: new web3_js_1.PublicKey('11111111111111111111111111111111'), // System program
                executable: false,
                rentEpoch: 0,
                lamports: 0
            };
        }
        return {
            isSystemOwned: accountInfo.owner.equals(new web3_js_1.PublicKey('11111111111111111111111111111111')),
            owner: accountInfo.owner,
            executable: accountInfo.executable,
            rentEpoch: accountInfo.rentEpoch,
            lamports: accountInfo.lamports
        };
    }
    catch (error) {
        console.error(`${ui_utils_1.UI.xmark} Error fetching wallet info:`, error);
        return {
            isSystemOwned: false,
            owner: new web3_js_1.PublicKey('11111111111111111111111111111111'),
            executable: false,
            rentEpoch: 0,
            lamports: 0
        };
    }
};
exports.getWalletInfo = getWalletInfo;
// Add this function to get USDC token info
const getUsdcTokenInfo = async (connection) => {
    // For now, return hardcoded values since we know USDC details
    // In a more complete implementation, we would fetch this from a token registry
    return {
        symbol: 'USDC',
        name: 'USD Coin',
        logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
        decimals: 6
    };
};
exports.getUsdcTokenInfo = getUsdcTokenInfo;
