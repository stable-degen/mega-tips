// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title TipJar - Minimal tipping contract for MegaETH testnet deployments
/// @notice Accepts tips with optional note metadata and allows the owner to withdraw funds.
contract TipJar {
    /// @dev Emitted when someone sends a tip.
    event Tipped(address indexed from, uint256 amount, string note, uint256 timestamp);

    /// @dev Emitted when the owner withdraws funds from the contract.
    event Withdraw(address indexed to, uint256 amount);

    error OwnerZeroAddress();
    error TipValueZero();
    error NoteTooLong();
    error NotOwner();
    error InsufficientBalance();
    error InvalidRecipient();
    error WithdrawFailed();

    uint256 public constant MAX_NOTE_LENGTH = 140;

    address public immutable owner;
    uint256 public totalTips;
    mapping(address => uint256) public tipsByUser;

    constructor(address _owner) {
        if (_owner == address(0)) {
            revert OwnerZeroAddress();
        }
        owner = _owner;
    }

    /// @notice Send a tip along with an optional note.
    /// @param note Optional note to attach to the tip. Must be 140 bytes or shorter.
    function tip(string calldata note) external payable {
        if (msg.value == 0) {
            revert TipValueZero();
        }
        if (bytes(note).length > MAX_NOTE_LENGTH) {
            revert NoteTooLong();
        }

        totalTips += msg.value;
        tipsByUser[msg.sender] += msg.value;

        emit Tipped(msg.sender, msg.value, note, block.timestamp);
    }

    /// @notice Withdraw accumulated tips to a recipient.
    /// @param to Recipient address that will receive the withdrawn funds.
    /// @param amount Amount of native tokens to withdraw.
    function withdraw(address payable to, uint256 amount) external {
        if (msg.sender != owner) {
            revert NotOwner();
        }
        if (to == address(0)) {
            revert InvalidRecipient();
        }

        uint256 balance = address(this).balance;
        if (amount > balance) {
            revert InsufficientBalance();
        }

        (bool success, ) = to.call{value: amount}("");
        if (!success) {
            revert WithdrawFailed();
        }

        emit Withdraw(to, amount);
    }

    /// @notice Allow the contract to accept plain ETH transfers.
    receive() external payable {
        totalTips += msg.value;
        tipsByUser[msg.sender] += msg.value;
        emit Tipped(msg.sender, msg.value, "", block.timestamp);
    }
}
