const EthPriceOracle = artifacts.require('EthPriceOracle');

// This is how we deploy the Oracle Contract
module.exports = function (deployer) {
    deployer.deploy(EthPriceOracle, process.env.PUBLIC_KEY);
}