const fs = require('fs');
const ethers = require('ethers');
require('dotenv').config();

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const MNEMONIC = process.env.MNEMONIC;
const alchemyRpcUrl = process.env.ALCHEMY_API_KEY;

const provider = new ethers.JsonRpcProvider(alchemyRpcUrl);

async function loadAccount() {
  try {

    console.log('ALCHEMY_API_KEY', process.env.ALCHEMY_API_KEY);
    console.log('ALCHEMY_API_KEY', process.env.ALCHEMY_API_KEY);

    // Derive wallet from mnemonic (default path: m/44'/60'/0'/0/0)
    const wallet = ethers.Wallet.fromPhrase(MNEMONIC); // v6 syntax (or fromMnemonic for v5)
    const signer = wallet.connect(provider);
    const ownerAddress = await signer.getAddress();
    console.log('Derived owner address:', ownerAddress);
    console.log('Private key:', wallet.privateKey); // Log for verification (remove in production)

    const block = await provider.getBlock('latest');
    console.log('Connected to Holesky, latest block:', block.number);

    return { ownerAddress, provider, signer };
  } catch (err) {
    console.error('Error in loadAccount:', err);
    throw new Error('Failed to load account: ' + err.message);
  }
}

module.exports = { loadAccount, provider };