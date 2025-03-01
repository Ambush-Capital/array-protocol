"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Operation = void 0;
const web3_js_1 = require("@solana/web3.js");
const ui_utils_1 = require("../utils/ui-utils");
/**
 * Base class for all operations
 */
class Operation {
    /**
     * Creates a new operation
     * @param driftClient - The Drift client instance
     * @param connection - Solana connection
     * @param wallet - Wallet adapter
     */
    constructor(driftClient, connection, wallet) {
        this.driftClient = driftClient;
        this.connection = connection;
        this.wallet = wallet;
    }
    /**
     * Build and send a transaction with the given instructions
     * @param instructions - Transaction instructions
     * @param operationName - Name of the operation for logging
     */
    async buildAndSendTransaction(instructions, operationName) {
        try {
            // Create transaction
            let tx = new web3_js_1.Transaction({
                recentBlockhash: (await this.connection.getLatestBlockhash()).blockhash,
                feePayer: this.wallet.publicKey
            });
            // Add instructions
            tx.add(...instructions);
            // Sign transaction
            tx = await this.wallet.signTransaction(tx);
            // Send transaction
            const signature = await this.connection.sendRawTransaction(tx.serialize());
            console.log(`${ui_utils_1.UI.checkmark} ${operationName} transaction sent: ${signature}`);
            // Wait for confirmation
            await this.confirmTransaction(signature);
            return signature;
        }
        catch (error) {
            this.handleTransactionError(error, operationName);
            return null;
        }
    }
    /**
     * Confirm a transaction
     * @param signature - Transaction signature
     */
    async confirmTransaction(signature) {
        console.log(`${ui_utils_1.UI.loading} Waiting for transaction confirmation...`);
        try {
            const confirmationStrategy = {
                signature,
                blockhash: (await this.connection.getLatestBlockhash()).blockhash,
                lastValidBlockHeight: (await this.connection.getLatestBlockhash()).lastValidBlockHeight,
            };
            const confirmation = await this.connection.confirmTransaction(confirmationStrategy, 'confirmed');
            if (confirmation.value.err) {
                console.error(`${ui_utils_1.UI.xmark} Transaction confirmed but failed: ${JSON.stringify(confirmation.value.err)}`);
            }
            else {
                console.log(`${ui_utils_1.UI.checkmark} Transaction confirmed successfully`);
            }
        }
        catch (error) {
            console.warn(`${ui_utils_1.UI.xmark} Error confirming transaction: ${error.message}`);
            console.log(`${ui_utils_1.UI.loading} Transaction may still succeed. Check explorer: https://explorer.solana.com/tx/${signature}`);
        }
    }
    /**
     * Handle transaction errors
     * @param error - Error object
     * @param operationName - Name of the operation
     */
    handleTransactionError(error, operationName) {
        console.error(`${ui_utils_1.UI.xmark} ${operationName} transaction failed:`);
        console.error(error);
        // Check if this is a SendTransactionError with logs
        if (error.logs) {
            console.error(`${ui_utils_1.UI.xmark} Transaction logs:`);
            error.logs.forEach((log) => console.error(`  ${log}`));
        }
    }
}
exports.Operation = Operation;
