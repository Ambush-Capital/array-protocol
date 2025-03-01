export const UI = {
    checkmark: '✅',
    xmark: '❌',
    loading: '🔄'
};

export const printInstructionDetails = (ix: any) => {
    console.log(`${UI.loading} Instruction Details:`);
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

export const decodeMarketName = (nameArray: number[]): string => {
    if (!nameArray || !Array.isArray(nameArray) || nameArray.length === 0) {
        return 'Unknown';
    }

    return nameArray
        .filter(code => code !== 0)
        .map(code => String.fromCharCode(code))
        .join('');
}; 