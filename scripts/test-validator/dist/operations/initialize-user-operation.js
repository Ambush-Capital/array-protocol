"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InitializeUserOperation = void 0;
const web3_js_1 = require("@solana/web3.js");
const ui_utils_1 = require("../utils/ui-utils");
class InitializeUserOperation {
    constructor(driftClient, subAccountId, connection, wallet) {
        this.driftClient = driftClient;
        this.subAccountId = subAccountId;
        this.connection = connection;
        this.wallet = wallet;
    }
    async execute() {
        console.log(`\n${ui_utils_1.UI.loading} Initializing user account with sub-account ID: ${this.subAccountId}...`);
        try {
            // Initialize user account
            let ixs = await this.driftClient.getInitializeUserAccountIxs();
            let tx = new web3_js_1.Transaction({
                recentBlockhash: (await this.connection.getLatestBlockhash()).blockhash,
                feePayer: this.wallet.publicKey
            });
            tx.add(...ixs[0]);
            tx = await this.wallet.signTransaction(tx);
            // Improved error handling for transaction sending
            try {
                await this.connection.sendRawTransaction(tx.serialize());
                console.log(`${ui_utils_1.UI.checkmark} User account initialized with transaction`);
                // Wait for transaction to confirm
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
                throw sendError;
            }
        }
        catch (error) {
            console.error(`${ui_utils_1.UI.xmark} Error initializing user account:`);
            console.error(error);
            throw error;
        }
    }
}
exports.InitializeUserOperation = InitializeUserOperation;
