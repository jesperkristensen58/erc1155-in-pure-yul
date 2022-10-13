/**
 * @title Receiver Helper Contract to be deployed and used in testing to receive ERC1155s from the ERC1155 Yul contract
 *
 * @author Jesper Kristensen
 * @date October, 2022
 */
// SPDX-License-Identifier: MIT
pragma solidity =0.7.3;

/// @title can receive erc1155 tokens
/// @notice implement a contract with an ERC1155 receiver
contract Receiver {
    function onERC1155Received(address operator, address from, uint256 id, uint256 amount) external view returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address operator, address from, address to, uint256[] memory ids, uint256[] memory amounts) external view returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }
}