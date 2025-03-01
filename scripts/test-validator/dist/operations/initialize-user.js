"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InitializeUser = void 0;
const web3_js_1 = require("@solana/web3.js");
const ui_utils_1 = require("../utils/ui-utils");
const base_1 = require("./base");
class InitializeUser extends base_1.Operation {
    /**
     * Creates a new initialize user operation
     * @param driftClient - The Drift client instance
     * @param subAccountId - Sub-account ID
     * @param connection - Solana connection
     * @param wallet - Wallet adapter
     */
    constructor(driftClient, subAccountId, connection, wallet) {
        super(driftClient, connection, wallet);
        this.subAccountId = subAccountId;
    }
    /**
     * Execute the initialize user operation
     */
    async execute() {
        console.log(`\n${ui_utils_1.UI.loading} Initializing user account with sub-account ID: ${this.subAccountId}...`);
        try {
            // Validate parameters
            await this.validate();
            // Get instructions
            const ixs = await this.getInstructions();
            // Create and send transaction manually to match original implementation
            let tx = new web3_js_1.Transaction({
                recentBlockhash: (await this.connection.getLatestBlockhash()).blockhash,
                feePayer: this.wallet.publicKey
            });
            tx.add(...ixs[0]);
            tx = await this.wallet.signTransaction(tx);
            // Send transaction
            try {
                const signature = await this.connection.sendRawTransaction(tx.serialize());
                console.log(`${ui_utils_1.UI.checkmark} User account initialized with transaction: ${signature}`);
                // Wait for transaction to confirm
                await this.confirmTransaction(signature);
            }
            catch (sendError) {
                this.handleTransactionError(sendError, "Initialize user");
                throw sendError;
            }
        }
        catch (error) {
            console.error(`${ui_utils_1.UI.xmark} Error initializing user account:`);
            console.error(error);
            throw error;
        }
    }
    /**
     * Get initialize user instructions
     */
    async getInstructions() {
        return await this.driftClient.getInitializeUserAccountIxs();
    }
    /**
     * Validate initialize user parameters
     */
    async validate() {
        // Check sub-account ID is valid
        if (this.subAccountId < 0 || this.subAccountId > 255) {
            throw new Error(`Invalid sub-account ID: ${this.subAccountId}. Must be between 0 and 255.`);
        }
        // Check if user account already exists
        try {
            const userAccount = await this.driftClient.getUserAccount();
            if (userAccount) {
                console.warn(`${ui_utils_1.UI.xmark} Warning: User account already exists.`);
                // We don't throw here as it might be intentional to reinitialize
            }
        }
        catch (error) {
            // Expected error if user account doesn't exist
            // Continue with initialization
        }
        return true;
    }
}
exports.InitializeUser = InitializeUser;
