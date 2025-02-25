const CallerContract = artifacts.require('CallerContract')

// This is how we deploy the Caller Contract
module.exports = function (deployer) {

    // the public key should come from env file
    const initialOwner = "0x3C92BB62972feAe7786C2a8202193c3D762153C0";
    deployer.deploy(CallerContract, initialOwner);
}