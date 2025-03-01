import { PublicKey } from '@solana/web3.js';
import { DriftClient, BN } from '@drift-labs/sdk';
import { UI } from '../utils/ui-utils';
import { deriveSpotMarketVaultPDA, deriveDriftStatePDA } from '../utils/drift-utils';
import { CONSTANTS } from '../utils/connection-utils';
import { Operation } from './base';

export class Deposit extends Operation {
    /**
     * Creates a new deposit operation
     * @param driftClient - The Drift client instance
     * @param amount - Amount to deposit in USDC
     * @param tokenAccount - USDC token account
     * @param connection - Solana connection
     * @param wallet - Wallet adapter
     */
    constructor(
        driftClient: DriftClient,
        private amount: number,
        private tokenAccount: PublicKey,
        connection: any,
        wallet: any
    ) {
        super(driftClient, connection, wallet);
    }

    /**
     * Execute the deposit operation
     */
    async execute(): Promise<void> {
        console.log(`\n${UI.loading} Preparing to deposit ${this.amount} USDC...`);

        try {
            // Validate parameters
            await this.validate();

            // Get instructions
            const instructions = await this.getInstructions();

            // Display expected PDAs
            await this.displayExpectedPDAs();

            // Build and send transaction
            await this.buildAndSendTransaction(instructions, "Deposit");

            console.log(`${UI.checkmark} Successfully deposited ${this.amount} USDC into Drift!`);
        } catch (error) {
            console.error(`${UI.xmark} Error preparing deposit transaction:`);
            console.error(error);
            // Continue with the script instead of exiting
        }
    }

    /**
     * Get deposit instructions
     */
    protected async getInstructions(): Promise<any[]> {
        // Convert amount to the correct precision (USDC has 6 decimals)
        const amountBN = new BN(this.amount * 10 ** 6);

        // Get deposit instructions
        return await this.driftClient.getDepositTxnIx(
            amountBN,                // amount
            0,                       // marketIndex (0 for USDC)
            this.tokenAccount        // USDC token account
        );
    }

    /**
     * Validate deposit parameters
     */
    protected async validate(): Promise<boolean> {
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
        } catch (error) {
            throw new Error(`Error validating token account: ${error.message}`);
        }

        return true;
    }

    /**
     * Display expected PDAs for the deposit
     */
    private async displayExpectedPDAs(): Promise<void> {
        // Calculate and print the expected PDA for spot market vault
        const [spotMarketVaultPDA, spotMarketVaultBump] = await deriveSpotMarketVaultPDA(
            new PublicKey(CONSTANTS.DRIFT_PROGRAM_ID),
            0 // Market index for USDC
        );

        const [driftStatePDA, driftStateBump] = await deriveDriftStatePDA(
            new PublicKey(CONSTANTS.DRIFT_PROGRAM_ID)
        );

        console.log(`\n${UI.loading} Expected Spot Market Vault PDA for 6gMq3mRCKf8aP3ttTyYhuijVZ2LGi14oDsBbkgubfLB3:`);
        console.log(`  - Address: ${spotMarketVaultPDA.toString()}`);
        console.log(`  - Bump: ${spotMarketVaultBump}`);
    }
} 