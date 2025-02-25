// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

/// Here we need to interact with our caller smart contract so that we can pass the ethPrice once computed and call callback function
import "./CallerContractInterface.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


/** The Oracle contract acts as a bridge, enabling the caller contracts to access ETH price feed. To achieve this
 *  it just implements two functions: getLatestEthPrice and setLatestEthPrice.
 */
contract EthPriceOracle is Ownable{

    uint private randNonce = 0;
    uint private modulus = 1000; // used in when generating random number for request id, and extracting last 3 digits

    mapping(uint256 => bool) pendingRequests;

    /// @param calledAddress the address of the smart contract that's calling this oracle
    /// @param id the request id
    event GetLatestEthPriceEvent(address calledAddress, uint id);

    event SetLatestEthPriceEvent(uint256 ethPrice, address callerAddress);

    /// To allow callers track their requests, getLatestEthPrice should first compute the request id, and for security reasons
    // this number should be hard to guess
    function getLatestEthPrice() public returns (uint256) {
        randNonce++;
        uint id = uint(keccak256(abi.encodePacked(block.timestamp, msg.sender, randNonce))) % modulus;
        pendingRequests[id] = true;
        emit GetLatestEthPriceEvent(msg.sender, id);
        return id;
    }

    /// The JavaScript component of the oracle retrieves the ETH price from Binance public API and then calls the setLatestEthPrice 
    /// passing it the following arguments:
    /// @param _ethPrice The ethPrice that we get from the Binance API
    /// @param _callerAddress The address of the contract that initiated the request
    /// @param _id The id of the request
    function setLatestEthPrice(uint256 _ethPrice, address _callerAddress, uint256 _id) public onlyOwner {
        require(pendingRequests[_id], "This request is not in my pending list.");
        delete pendingRequests[_id];
        CallerContractInterface callerContractInstance;
        callerContractInstance = CallerContractInterface(_callerAddress);
        callerContractInstance.callback(_ethPrice, _id);
        emit SetLatestEthPriceEvent(_ethPrice, _callerAddress);
    }
}