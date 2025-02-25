// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

interface EthPriceOracleInterface {
    function getLatestEthPrice() external returns (uint256);
}