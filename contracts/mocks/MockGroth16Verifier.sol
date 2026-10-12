// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract MockGroth16Verifier {
    bool public result = true;

    function setResult(bool nextResult) external {
        result = nextResult;
    }

    function verifyProof(
        uint256[2] calldata,
        uint256[2][2] calldata,
        uint256[2] calldata,
        uint256[2] calldata
    ) external view returns (bool) {
        return result;
    }
}