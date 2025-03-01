"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Withdraw = void 0;
const sdk_1 = require("@drift-labs/sdk");
const ui_utils_1 = require("../utils/ui-utils");
const base_1 = require("./base");
class Withdraw extends base_1.Operation {
    /**
     * Creates a new withdraw operation
     * @param driftClient - The Drift client instance
     * @param amount - Amount to withdraw in USDC
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
     * Execute the withdraw operation
     */
    async execute() {
        console.log(`\n${ui_utils_1.UI.loading} Preparing to withdraw ${this.amount} USDC...`);
        try {
            // Validate parameters
            await this.validate();
            // Get instructions
            const instructions = await this.getInstructions();
            // Build and send transaction
            await this.buildAndSendTransaction(instructions, "Withdraw");
            console.log(`${ui_utils_1.UI.checkmark} Successfully withdrew ${this.amount} USDC from Drift!`);
        }
        catch (error) {
            console.error(`${ui_utils_1.UI.xmark} Error preparing withdrawal transaction:`);
            console.error(error);
            // Continue with the script instead of exiting
        }
    }
    /**
     * Get withdraw instructions
     */
    async getInstructions() {
        // Convert amount to the correct precision (USDC has 6 decimals)
        const amountBN = new sdk_1.BN(this.amount * 10 ** 6);
        // Get withdraw instructions
        return await this.driftClient.getWithdrawalIxs(amountBN, // amount
        0, // marketIndex (0 for USDC)
        this.tokenAccount // USDC token account
        );
    }
    /**
     * Validate withdraw parameters
     */
    async validate() {
        // Check amount is positive
        if (this.amount <= 0) {
            throw new Error(`Invalid withdrawal amount: ${this.amount}. Amount must be positive.`);
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
        // Check user has sufficient balance in Drift
        try {
            const userAccount = await this.driftClient.getUserAccount();
            if (!userAccount) {
                throw new Error("User account not found in Drift.");
            }
            const spotPosition = userAccount.spotPositions.find(position => position.marketIndex === 0 && position.scaledBalance.gt(new sdk_1.BN(0)));
            if (!spotPosition) {
                throw new Error("No USDC position found in Drift account.");
            }
            const balanceBN = spotPosition.scaledBalance;
            const balance = balanceBN.toNumber() / 10 ** 6;
            if (balance < this.amount) {
                throw new Error(`Insufficient balance: ${balance} USDC. Requested withdrawal: ${this.amount} USDC.`);
            }
        }
        catch (error) {
            if (error.message.includes("Insufficient balance") ||
                error.message.includes("User account not found") ||
                error.message.includes("No USDC position found")) {
                throw error;
            }
            console.warn(`${ui_utils_1.UI.xmark} Warning: Could not verify Drift balance: ${error.message}`);
            // Continue anyway as this might be a temporary issue
        }
        return true;
    }
}
exports.Withdraw = Withdraw;
