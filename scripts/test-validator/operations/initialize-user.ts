import { Transaction } from '@solana/web3.js';
import { DriftClient } from '@drift-labs/sdk';
import { UI } from '../utils/ui-utils';
import { Operation } from './base';

export class InitializeUser extends Operation {
    /**
     * Creates a new initialize user operation
     * @param driftClient - The Drift client instance
     * @param subAccountId - Sub-account ID
     * @param connection - Solana connection
     * @param wallet - Wallet adapter
     */
    constructor(
        driftClient: DriftClient,
        private subAccountId: number,
        connection: any,
        wallet: any
    ) {
        super(driftClient, connection, wallet);
    }

    /**
     * Execute the initialize user operation
     */
    async execute(): Promise<void> {
        console.log(`\n${UI.loading} Initializing user account with sub-account ID: ${this.subAccountId}...`);

        try {
            // Validate parameters
            await this.validate();

            // Get instructions
            const ixs = await this.getInstructions();

            // Create and send transaction manually to match original implementation
            let tx = new Transaction({
                recentBlockhash: (await this.connection.getLatestBlockhash()).blockhash,
                feePayer: this.wallet.publicKey
            });
            tx.add(...ixs[0]);
            tx = await this.wallet.signTransaction(tx);

            // Send transaction
            try {
                const signature = await this.connection.sendRawTransaction(tx.serialize());
                console.log(`${UI.checkmark} User account initialized with transaction: ${signature}`);

                // Wait for transaction to confirm
                await this.confirmTransaction(signature);
            } catch (sendError: any) {
                this.handleTransactionError(sendError, "Initialize user");
                throw sendError;
            }
        } catch (error) {
            console.error(`${UI.xmark} Error initializing user account:`);
            console.error(error);
            throw error;
        }
    }

    /**
     * Get initialize user instructions
     */
    protected async getInstructions(): Promise<any[]> {
        return await this.driftClient.getInitializeUserAccountIxs();
    }

    /**
     * Validate initialize user parameters
     */
    protected async validate(): Promise<boolean> {
        // Check sub-account ID is valid
        if (this.subAccountId < 0 || this.subAccountId > 255) {
            throw new Error(`Invalid sub-account ID: ${this.subAccountId}. Must be between 0 and 255.`);
        }

        // Check if user account already exists
        try {
            const userAccount = await this.driftClient.getUserAccount();
            if (userAccount) {
                console.warn(`${UI.xmark} Warning: User account already exists.`);
                // We don't throw here as it might be intentional to reinitialize
            }
        } catch (error) {
            // Expected error if user account doesn't exist
            // Continue with initialization
        }

        return true;
    }
} 