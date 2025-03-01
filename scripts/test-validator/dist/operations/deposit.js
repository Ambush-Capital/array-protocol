"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Deposit = void 0;
const web3_js_1 = require("@solana/web3.js");
const sdk_1 = require("@drift-labs/sdk");
const ui_utils_1 = require("../utils/ui-utils");
const drift_utils_1 = require("../utils/drift-utils");
const connection_utils_1 = require("../utils/connection-utils");
const base_1 = require("./base");
class Deposit extends base_1.Operation {
    /**
     * Creates a new deposit operation
     * @param driftClient - The Drift client instance
     * @param amount - Amount to deposit in USDC
     * @param tokenAccount - USDC token account
     * @param connection - Solana connection
     * @param wallet - Wallet adapter
     */
    constructor(driftClient, amount, tokenAccount, connection, wallet) {
        super(driftClient, connection, wallet);
        this.amount = amount;
        this.tokenAccount = tokenAccount;
    }
    /**
     * Execute the deposit operation
     */
    async execute() {
        console.log(`\n${ui_utils_1.UI.loading} Preparing to deposit ${this.amount} USDC...`);
        try {
            // Validate parameters
            await this.validate();
            // Get instructions
            const instructions = await this.getInstructions();
            // Display expected PDAs
            await this.displayExpectedPDAs();
            // Build and send transaction
            await this.buildAndSendTransaction(instructions, "Deposit");
            console.log(`${ui_utils_1.UI.checkmark} Successfully deposited ${this.amount} USDC into Drift!`);
        }
        catch (error) {
            console.error(`${ui_utils_1.UI.xmark} Error preparing deposit transaction:`);
            console.error(error);
            // Continue with the script instead of exiting
        }
    }
    /**
     * Get deposit instructions
     */
    async getInstructions() {
        // Convert amount to the correct precision (USDC has 6 decimals)
        const amountBN = new sdk_1.BN(this.amount * 10 ** 6);
        // Get deposit instructions
        return await this.driftClient.getDepositTxnIx(amountBN, // amount
        0, // marketIndex (0 for USDC)
        this.tokenAccount // USDC token account
        );
    }
    /**
     * Validate deposit parameters
     */
    async validate() {
        // Check amount is positive
        if (this.amount <= 0) {
            throw new Error(`Invalid deposit amount: ${this.amount}. Amount must be positive.`);
        }
        // Check token account exists
        try {
            const accountInfo = await this.connection.getAccountInfo(this.tokenAccount);
            if (!accountInfo) {
                throw new Error(`Token account ${this.tokenAccount.toString()} does not exist.`);
            }
        }
        catch (error) {
            throw new Error(`Error validating token account: ${error.message}`);
        }
        return true;
    }
    /**
     * Display expected PDAs for the deposit
     */
    async displayExpectedPDAs() {
        // Calculate and print the expected PDA for spot market vault
        const [spotMarketVaultPDA, spotMarketVaultBump] = await (0, drift_utils_1.deriveSpotMarketVaultPDA)(new web3_js_1.PublicKey(connection_utils_1.CONSTANTS.DRIFT_PROGRAM_ID), 0 // Market index for USDC
        );
        const [driftStatePDA, driftStateBump] = await (0, drift_utils_1.deriveDriftStatePDA)(new web3_js_1.PublicKey(connection_utils_1.CONSTANTS.DRIFT_PROGRAM_ID));
        console.log(`\n${ui_utils_1.UI.loading} Expected Spot Market Vault PDA for 6gMq3mRCKf8aP3ttTyYhuijVZ2LGi14oDsBbkgubfLB3:`);
        console.log(`  - Address: ${spotMarketVaultPDA.toString()}`);
        console.log(`  - Bump: ${spotMarketVaultBump}`);
    }
}
exports.Deposit = Deposit;
