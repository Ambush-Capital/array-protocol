"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decodeMarketName = exports.printInstructionDetails = exports.UI = void 0;
exports.UI = {
    checkmark: '✅',
    xmark: '❌',
    loading: '🔄'
};
const printInstructionDetails = (ix) => {
    console.log(`${exports.UI.loading} Instruction Details:`);
    console.log(`  - Program ID: ${ix.programId.toString()}`);
    console.log(`  - Keys (Accounts):`);
    ix.keys.forEach((keyObj, index) => {
        console.log(`    [${index}] ${keyObj.pubkey.toString()} (${keyObj.isSigner ? 'signer' : 'not-signer'}, ${keyObj.isWritable ? 'writable' : 'read-only'})`);
    });
    console.log(`  - Data Length: ${ix.data.length} bytes`);
    if (ix.data.length > 0) {
        const dataPreview = Buffer.from(ix.data).toString('hex').substring(0, 20);
        console.log(`  - Data Preview: 0x${dataPreview}...`);
    }
};
exports.printInstructionDetails = printInstructionDetails;
const decodeMarketName = (nameArray) => {
    if (!nameArray || !Array.isArray(nameArray) || nameArray.length === 0) {
        return 'Unknown';
    }
    return nameArray
        .filter(code => code !== 0)
        .map(code => String.fromCharCode(code))
        .join('');
};
exports.decodeMarketName = decodeMarketName;
