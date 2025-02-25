const axios = require('axios');
const { ethers } = require('ethers');
const { loadAccount, provider } = require('./utils/common.js');
const SLEEP_INTERVAL = process.env.SLEEP_INTERVAL || 2000;
const CHUNK_SIZE = process.env.CHUNK_SIZE || 3;
const MAX_RETRIES = process.env.MAX_RETRIES || 5;

/// This is the ABI of EthPriceOracle which describes the interface between two computer programs.
/// An ABI just describes ow functions can be called and how data is stored in a machine-readable format.
const OracleJSON = require('./oracle/build/contracts/EthPriceOracle.json')
var pendingRequests = []


// To interact with the deployed contract from JavaScript we need to instantiate it using the web3.eth.Contract
async function getOracleContract (signer) {
    const network = await provider.getNetwork();
    const networkId = network.chainId; // Holesky is 17000
    const contractAddress = OracleJSON.networks[networkId].address;

    console.log('inside getOracleContract: ', contractAddress);
    console.log('inside getOracleContract: ', signer);

    return new ethers.Contract(contractAddress, OracleJSON.abi, signer);
}

async function retrieveLatestEthPrice() {
    const resp = await axios({
        url: 'https://api.binance.com/api/v3/ticker/price',
        params: {
            symbol: 'ETHUSDT'
        },
        method: 'get'
    })
    return resp.data.price;
}


// This function is for listening the events that gets triggered from our smart contract so that our JavaScript client knows 
// what's happening, basically our JS app needs to be notified for new requests
async function filterEvents (oracleContract) {

    oracleContract.on('GetLatestEthPriceEvent', async (callerAddress, id) => {
        console.log('New price request from:', callerAddress, 'ID:', id.toString());
        await addRequestToQueue({ returnValues: { callerAddress, id } });
    });

    // We can listen for more events here down below  
    oracleContract.on('SetLatestEthPriceEvent', (ethPrice, callerAddress, id) => {
        console.log('Price set: ', ethPrice.toString(), 'for', callerAddress, 'ID:', id.toString());
    });
}


async function addRequestToQueue (event) {
    const { callerAddress, id } = event.returnValues;
    pendingRequests.push({ callerAddress, id });
}


// we need to process these requests, but since JavaScript is single-threaded which means that all other operations
// would be blocked until the processing is finished. A technique to solve this is to break array into smaller chunks
// and process these chunks individually, after each chunk, the app will sleep for some milliseconds
async function processQueue(oracleContract, ownerAddress) {
    let processedRequests = 0;
    while(pendingRequests.length > 0 && processedRequests < CHUNK_SIZE) {
        const req = pendingRequests.shift();
        await processRequest(oracleContract, ownerAddress, req.id, req.callerAddress);
        processedRequests++;
    }
}


// Here we make the request, but we also take care of some scenarios that might happen during our API call such as
// - If there's network glitch the request will fail, if I let that fail the caller contract will have to reinitiate the whole process
// - from the beginning, even if in a matter of seconds the network connectivity is restored. And this is not robust enough.
// So on error we will retry the request, and if the retry limit has reached we break the retry loop
async function processRequest(oracleContract, ownerAddress, id, callerAddress) {
    let retries = 0;
    while(retries < MAX_RETRIES) {
        // Since an HTTP request throws error, we need to have to wrap the code that makes the call inside of a try/catch block
        try {
            const ethPrice = await retrieveLatestEthPrice()
            await setLatestEthPrice(oracleContract, callerAddress, ownerAddress, ethPrice, id)
            return;
        } catch (error) {
            console.error('Retry', retries + 1, 'failed:', error.message);
            if(retries === MAX_RETRIES - 1) {
                await setLatestEthPrice(oracleContract, callerAddress, ownerAddress, '0', id)
                return;
            }
            retries++;
        }
    }
}


/// Before we pass the ETH price we need to do some data massaging.
/// The Ethereum Virtual Machine doesn't support floating point numbers, meaning that divisions truncate the decimals.
/// The workaround is to simply multiply the numbers in the front-end by 10**n.
/// Binance API returns eight decimal numbers and we'll also multiply this by 10**10, why 10**10? one ether is 10**18 wei
/// This way we'll be sure that no money will be lost.
async function setLatestEthPrice(oracleContract, callerAddress, ownerAddress, ethPrice, id) {
    // call the function that fetches ETH price and then do the data massaging below
    ethPrice = ethPrice.replace('.', '')
    const multiplier = new BN(10**10, 10)
    const ethPriceInt = (new BN(parseInt(ethPrice), 10)).mul(multiplier)
    const idInt = new BN(parseInt(id));
    try{
        const tx = await oracleContract.setLatestEthPrice(ethPriceInt, callerAddress, id, {
            from: ownerAddress,
        });
        await tx.wait();
        console.log('Set ETH price: ', ethPriceInt.toString());
    } catch (error) {
        console.log('Error encountered whiile calling setLatestEthPrice.');
    }
}

// When we start the oracle, or every time the oracle starts it has to:
// 1. connect to ExtDec TestNet by calling common.loadAccount function
// 2. instantiate the oracle contract
// 3. start listening to events.
// And here I created a init() function that does this and returns oracleContract, ownerAddress, client
async function init() {
    const { ownerAddress, signer } = await loadAccount();
    const oracleContract = await getOracleContract(signer);
    await filterEvents(oracleContract);
    return { oracleContract, ownerAddress };
}



// This is the code that ties everything together
(async () => {
    try {
        const { oracleContract, ownerAddress } = await init();
    
        // process.ON('SIGINT') is provided so that user can gracefully shut down the oracle
        process.on('SIGINT', () => {
            console.log('Shutting down gracefully...');
            process.exit(0);
        });
    
    
        // Due to JavaScript's single-threaded nature, 
        // we're processing the queue in batches and our thread will just sleep for SLEEP_INTERVAL milliseconds between each iteration
        setInterval(async () => {
            await processQueue(oracleContract, ownerAddress);
        }, SLEEP_INTERVAL);
    } catch(error) {
        console.error('Oracle initialization error:', error)
    }
})();