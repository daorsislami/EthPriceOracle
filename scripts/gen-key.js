// We need to deploy the contracts
// Before we deploy the smart contracts you must generate two private keys, 
// One for the caller contract and 
// the other one for the oracle


const { CryptoUtils } = require('loom-js');
const fs = require('fs');

if (process.argv.length <= 2) {
    console.log("Usage: " + __filename + " <filename>");
    process.exit(1);
}

try {
    const privateKey = CryptoUtils.generatePrivateKey();
    const privateKeyString = CryptoUtils.Uint8ArrayToB64(privateKey);
    const path = process.argv[2];

    fs.writeFileSync(path, privateKeyString);
    console.log(`Private key successfully written to ${path}`);
} catch (error) {
    console.error("Error generating or writing private key:", error.message);
    process.exit(1);
}