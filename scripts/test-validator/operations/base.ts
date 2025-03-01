import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { DriftClient } from '@drift-labs/sdk';
import { UI } from '../utils/ui-utils';

/**
 * Base class for all operations
 */
export abstract class Operation {
    /**
     * Creates a new operation
     * @param driftClient - The Drift client instance
     * @param connection - Solana connection
     * @param wallet - Wallet adapter
     */
    constructor(
        protected driftClient: DriftClient,
        protected connection: Connection,
        protected wallet: any
    ) { }

    /**
     * Execute the operation
     */
    abstract execute(): Promise<void>;

    /**
     * Get the instructions for this operation
     */
    protected abstract getInstructions(): Promise<TransactionInstruction[]>;

    /**
     * Validate operation parameters
     * @returns true if valid, throws error if invalid
     */
    protected abstract validate(): Promise<boolean>;

    /**
     * Build and send a transaction with the given instructions
     * @param instructions - Transaction instructions
     * @param operationName - Name of the operation for logging
     */
    protected async buildAndSendTransaction(
        instructions: TransactionInstruction[],
        operationName: string
    ): Promise<string | null> {
        try {
            // Create transaction
            let tx = new Transaction({
                recentBlockhash: (await this.connection.getLatestBlockhash()).blockhash,
                feePayer: this.wallet.publicKey
            });

            // Add instructions
            tx.add(...instructions);

            // Sign transaction
            tx = await this.wallet.signTransaction(tx);

            // Send transaction
            const signature = await this.connection.sendRawTransaction(tx.serialize());
            console.log(`${UI.checkmark} ${operationName} transaction sent: ${signature}`);

            // Wait for confirmation
            await this.confirmTransaction(signature);

            return signature;
        } catch (error) {
            this.handleTransactionError(error, operationName);
            return null;
        }
    }

    /**
     * Confirm a transaction
     * @param signature - Transaction signature
     */
    protected async confirmTransaction(signature: string): Promise<void> {
        console.log(`${UI.loading} Waiting for transaction confirmation...`);

        try {
            const confirmationStrategy = {
                signature,
                blockhash: (await this.connection.getLatestBlockhash()).blockhash,
                lastValidBlockHeight: (await this.connection.getLatestBlockhash()).lastValidBlockHeight,
            };

            const confirmation = await this.connection.confirmTransaction(confirmationStrategy, 'confirmed');

            if (confirmation.value.err) {
                console.error(`${UI.xmark} Transaction confirmed but failed: ${JSON.stringify(confirmation.value.err)}`);
            } else {
                console.log(`${UI.checkmark} Transaction confirmed successfully`);
            }
        } catch (error) {
            console.warn(`${UI.xmark} Error confirming transaction: ${error.message}`);
            console.log(`${UI.loading} Transaction may still succeed. Check explorer: https://explorer.solana.com/tx/${signature}`);
        }
    }

    /**
     * Handle transaction errors
     * @param error - Error object
     * @param operationName - Name of the operation
     */
    protected handleTransactionError(error: any, operationName: string): void {
        console.error(`${UI.xmark} ${operationName} transaction failed:`);
        console.error(error);

        // Check if this is a SendTransactionError with logs
        if (error.logs) {
            console.error(`${UI.xmark} Transaction logs:`);
            error.logs.forEach((log: string) => console.error(`  ${log}`));
        }
    }
} 