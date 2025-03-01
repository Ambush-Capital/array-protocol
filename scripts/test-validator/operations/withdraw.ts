import { PublicKey } from '@solana/web3.js';
import { DriftClient, BN } from '@drift-labs/sdk';
import { UI } from '../utils/ui-utils';
import { Operation } from './base';

export class Withdraw extends Operation {
    /**
     * Creates a new withdraw operation
     * @param driftClient - The Drift client instance
     * @param amount - Amount to withdraw in USDC
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
     * Execute the withdraw operation
     */
    async execute(): Promise<void> {
        console.log(`\n${UI.loading} Preparing to withdraw ${this.amount} USDC...`);

        try {
            // Validate parameters
            await this.validate();

            // Get instructions
            const instructions = await this.getInstructions();

            // Build and send transaction
            await this.buildAndSendTransaction(instructions, "Withdraw");

            console.log(`${UI.checkmark} Successfully withdrew ${this.amount} USDC from Drift!`);
        } catch (error) {
            console.error(`${UI.xmark} Error preparing withdrawal transaction:`);
            console.error(error);
            // Continue with the script instead of exiting
        }
    }

    /**
     * Get withdraw instructions
     */
    protected async getInstructions(): Promise<any[]> {
        // Convert amount to the correct precision (USDC has 6 decimals)
        const amountBN = new BN(this.amount * 10 ** 6);

        // Get withdraw instructions
        return await this.driftClient.getWithdrawalIxs(
            amountBN,                // amount
            0,                       // marketIndex (0 for USDC)
            this.tokenAccount        // USDC token account
        );
    }

    /**
     * Validate withdraw parameters
     */
    protected async validate(): Promise<boolean> {
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
        } catch (error) {
            throw new Error(`Error validating token account: ${error.message}`);
        }

        // Check user has sufficient balance in Drift
        try {
            const userAccount = await this.driftClient.getUserAccount();
            if (!userAccount) {
                throw new Error("User account not found in Drift.");
            }

            const spotPosition = userAccount.spotPositions.find(
                position => position.marketIndex === 0 && position.scaledBalance.gt(new BN(0))
            );

            if (!spotPosition) {
                throw new Error("No USDC position found in Drift account.");
            }

            const balanceBN = spotPosition.scaledBalance;
            const balance = balanceBN.toNumber() / 10 ** 6;

            if (balance < this.amount) {
                throw new Error(`Insufficient balance: ${balance} USDC. Requested withdrawal: ${this.amount} USDC.`);
            }
        } catch (error) {
            if (error.message.includes("Insufficient balance") ||
                error.message.includes("User account not found") ||
                error.message.includes("No USDC position found")) {
                throw error;
            }
            console.warn(`${UI.xmark} Warning: Could not verify Drift balance: ${error.message}`);
            // Continue anyway as this might be a temporary issue
        }

        return true;
    }
} 