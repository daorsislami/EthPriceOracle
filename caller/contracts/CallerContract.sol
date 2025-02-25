// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import "./EthPriceOracleInterface.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


// This is my SmartContract it is used to call the oracle smart contract 
contract CallerContract is Ownable {
    
    uint256 private ethPrice;

    EthPriceOracleInterface private oracleInstance;

    // For this contract to interact with oracle we need to provide the following info:
    // 1. the address of the oracle
    // 2. the signature of the function you want to call
    address private oracleAddress; 

    // Due to the nature of asynchronous requests, there's no way of getLatestEthPrice returns this bit of information
    // so what it returns is an id of the request. Then oracle goes ahead and fetches the ETH price from Binance API and executes a callback
    // exposed by the caller conctract(this contract) and this callback function updates ETH price
    mapping (uint256 => bool) myRequests;

    event newOracleAddressEvent(address oracleAddress);
    event ReceivedNewRequestIdEvent(uint256 id);
    event PriceUpdatedEvent(uint256 ethPrice, uint256 id);

    // We're providing a setter for the oracleInstance becuase if anything happens to the oracle 
    // we just set another address of the oracle instead of redeploying everything
    function setOracleInstanceAddress(address _oracleInstanceAddress) public onlyOwner {
        oracleAddress = _oracleInstanceAddress;
        oracleInstance = EthPriceOracleInterface(oracleAddress);

        // fire an event so that the front-end gets notified every time the oracle address is changed
        emit newOracleAddressEvent(oracleAddress);
    }


    function updateEthPrice() public {
       uint256 id = oracleInstance.getLatestEthPrice();
       myRequests[id] = true;    
       emit ReceivedNewRequestIdEvent(id);
    }


    // So, calling the Binance API is an asynchronous operation, the caller smart contract(this)
    // must provide a callback function which the oracle should call once we fetch the ETH price
    function callback(uint256 _ethPrice, uint256 _id) public onlyOracle {
        require(myRequests[_id], "This request is not in my pending list.");
        ethPrice = _ethPrice;
        delete myRequests[_id];
        emit PriceUpdatedEvent(_ethPrice, _id);
    } 


    modifier onlyOracle() {
        require(msg.sender == oracleAddress, "You are not authorized to call this function.");
        _;
    }
}