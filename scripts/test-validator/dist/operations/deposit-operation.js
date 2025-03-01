"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DepositOperation = void 0;
const web3_js_1 = require("@solana/web3.js");
const sdk_1 = require("@drift-labs/sdk");
const ui_utils_1 = require("../utils/ui-utils");
const drift_utils_1 = require("../utils/drift-utils");
const connection_utils_1 = require("../utils/connection-utils");
class DepositOperation {
    constructor(driftClient, amount, tokenAccount, connection, wallet) {
        this.driftClient = driftClient;
        this.amount = amount;
        this.tokenAccount = tokenAccount;
        this.connection = connection;
        this.wallet = wallet;
    }
    async execute() {
        console.log(`\n${ui_utils_1.UI.loading} Preparing to deposit ${this.amount} USDC...`);
        try {
            // Convert amount to the correct precision (USDC has 6 decimals)
            const amountBN = new sdk_1.BN(this.amount * 10 ** 6);
            // Get deposit instructions
            let ix = await this.driftClient.getDepositTxnIx(amountBN, // amount
            0, // marketIndex (0 for USDC)
            this.tokenAccount // USDC token account
            );
            // Calculate and print the expected PDA for spot market vault
            const [spotMarketVaultPDA, spotMarketVaultBump] = await (0, drift_utils_1.deriveSpotMarketVaultPDA)(new web3_js_1.PublicKey(connection_utils_1.CONSTANTS.DRIFT_PROGRAM_ID), 0 // Market index for USDC
            );
            const [driftStatePDA, driftStateBump] = await (0, drift_utils_1.deriveDriftStatePDA)(new web3_js_1.PublicKey(connection_utils_1.CONSTANTS.DRIFT_PROGRAM_ID));
            console.log(`\n${ui_utils_1.UI.loading} Expected Spot Market Vault PDA for 6gMq3mRCKf8aP3ttTyYhuijVZ2LGi14oDsBbkgubfLB3:`);
            console.log(`  - Address: ${spotMarketVaultPDA.toString()}`);
            console.log(`  - Bump: ${spotMarketVaultBump}`);
            // Create and send transaction
            let tx = new web3_js_1.Transaction({
                recentBlockhash: (await this.connection.getLatestBlockhash()).blockhash,
                feePayer: this.wallet.publicKey
            });
            tx.add(...ix);
            tx = await this.wallet.signTransaction(tx);
            try {
                await this.connection.sendRawTransaction(tx.serialize());
                console.log(`${ui_utils_1.UI.checkmark} Successfully deposited ${this.amount} USDC into Drift!`);
                // Wait for a few slots to pass
                await new Promise(resolve => setTimeout(resolve, 2000));
                console.log(`${ui_utils_1.UI.loading} Waiting for transaction to confirm...`);
            }
            catch (sendError) {
                console.error(`${ui_utils_1.UI.xmark} Transaction failed:`);
                console.error(sendError);
                // Check if this is a SendTransactionError with logs
                if (sendError.logs) {
                    console.error(`${ui_utils_1.UI.xmark} Transaction logs:`);
                    sendError.logs.forEach((log) => console.error(`  ${log}`));
                }
            }
        }
        catch (error) {
            console.error(`${ui_utils_1.UI.xmark} Error preparing deposit transaction:`);
            console.error(error);
            // Continue with the script instead of exiting
        }
    }
}
exports.DepositOperation = DepositOperation;
