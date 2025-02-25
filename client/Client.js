const { ethers } = require('ethers');
const axios = require('axios');
const { loadAccount, provider } = require('./utils/common.js');
const SLEEP_INTERVAL = process.env.SLEEP_INTERVAL || 2000;
const CallerJSON = require('./caller/build/contracts/CallerContract.json');
const OracleJSON = require('./oracle/build/contracts/EthPriceOracle.json');

async function getCallerContract(signer) {
  const contractAddress = '0xe4414D8763Af863be9f92DCe23FD88290FFA9A67';
  return new ethers.Contract(contractAddress, CallerJSON.abi, signer);
}

async function init() {
  const { ownerAddress, signer } = await loadAccount();
  const callerContract = await getCallerContract(signer);

  console.log('CallerContract code exists:', (await provider.getCode('0xe4414D8763Af863be9f92DCe23FD88290FFA9A67')) !== '0x');
  console.log('EthPriceOracle code exists:', (await provider.getCode('0xE3EA3B61Ea8B6709Fc2222298b350A378a6EC9F5')) !== '0x');

  return { callerContract, ownerAddress };
}

(async () => {
  try {
    const { callerContract, ownerAddress } = await init();
    const oracleAddress = '0xE3EA3B61Ea8B6709Fc2222298b350A378a6EC9F5';

    // Check owner
    const contractOwner = await callerContract.owner();
    console.log('Contract owner:', contractOwner);
    console.log('Your address:', ownerAddress);

    // Set oracle address
    try {
      const tx = await callerContract.setOracleInstanceAddress(oracleAddress, { from: ownerAddress });
      await tx.wait();
      console.log('Set oracle address:', oracleAddress);
    } catch (err) {
      console.error('Failed to set oracle address:', err);
    }
    // console.log('Stored oracle address:', await callerContract.oracleAddress());

    // Test oracle directly
    const oracleContract = new ethers.Contract(oracleAddress, OracleJSON.abi, provider);
    try {
      const id = await oracleContract.callStatic.getLatestEthPrice();
      console.log('Direct call to getLatestEthPrice succeeded, ID:', id.toString());
    } catch (err) {
      console.error('Direct call to getLatestEthPrice failed:', err);
    }

    // Simulate updateEthPrice
    try {
      await callerContract.callStatic.updateEthPrice({ from: ownerAddress });
      console.log('updateEthPrice simulation succeeded');
    } catch (err) {
      console.error('updateEthPrice simulation failed:', err);
    }

    // Check balance
    console.log('Balance:', ethers.utils.formatEther(await provider.getBalance(ownerAddress)), 'ETH');

    process.on('SIGINT', () => {
      console.log('Shutting down...');
      process.exit(0);
    });

    setInterval(async () => {
      try {
        const tx = await callerContract.updateEthPrice({ from: ownerAddress, gasLimit: 200000 });
        await tx.wait();
        console.log('Requested ETH price update');
      } catch (err) {
        console.error('Error updating ETH price:', err);
      }
    }, SLEEP_INTERVAL);
  } catch (err) {
    console.error('Initialization error:', err);
  }
})();