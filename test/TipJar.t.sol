// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {TipJar} from "contracts/TipJar.sol";

contract TipJarTest is Test {
    TipJar internal tipJar;
    address internal owner = address(0xA11CE);
    address internal tipper = address(0xBEEF);
    address internal receiver = address(0xCAFE);

    function setUp() public {
        tipJar = new TipJar(owner);
        vm.deal(tipper, 10 ether);
        vm.deal(owner, 1 ether);
    }

    function test_constructor_setsOwner() public {
        assertEq(tipJar.owner(), owner);
        assertEq(tipJar.totalTips(), 0);
    }

    function test_tip_reverts_on_zero_value() public {
        vm.prank(tipper);
        vm.expectRevert(abi.encodeWithSignature("TipValueZero()"));
        tipJar.tip{value: 0}("gm");
    }

    function test_tip_updates_totals_and_emits() public {
        uint256 amount = 0.5 ether;

        vm.prank(tipper);
        vm.expectEmit(true, false, false, true);
        emit TipJar.Tipped(tipper, amount, "thanks", block.timestamp);
        tipJar.tip{value: amount}("thanks");

        assertEq(tipJar.totalTips(), amount);
        assertEq(tipJar.tipsByUser(tipper), amount);
        assertEq(address(tipJar).balance, amount);
    }

    function test_tip_reverts_when_note_too_long() public {
        string memory longNote = new string(141);

        vm.prank(tipper);
        vm.expectRevert(abi.encodeWithSignature("NoteTooLong()"));
        tipJar.tip{value: 0.1 ether}(longNote);
    }

    function test_withdraw_only_owner() public {
        vm.prank(tipper);
        tipJar.tip{value: 1 ether}("cheers");

        vm.prank(tipper);
        vm.expectRevert(abi.encodeWithSignature("NotOwner()"));
        tipJar.withdraw(payable(tipper), 0.5 ether);
    }

    function test_withdraw_transfers_funds() public {
        vm.prank(tipper);
        tipJar.tip{value: 2 ether}("cheers");

        vm.prank(owner);
        tipJar.withdraw(payable(receiver), 1.5 ether);

        assertEq(address(receiver).balance, 1.5 ether);
        assertEq(address(tipJar).balance, 0.5 ether);
    }

    function test_withdraw_reverts_when_insufficient_balance() public {
        vm.prank(tipper);
        tipJar.tip{value: 1 ether}("hi");

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("InsufficientBalance()"));
        tipJar.withdraw(payable(receiver), 2 ether);
    }

    function test_withdraw_reverts_for_zero_address() public {
        vm.prank(tipper);
        tipJar.tip{value: 1 ether}("hi");

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("InvalidRecipient()"));
        tipJar.withdraw(payable(address(0)), 0.5 ether);
    }

    function testFuzz_tip_accepts_notes_within_limit(uint8 length, uint96 amount) public {
        uint256 boundedLength = bound(uint256(length), 0, tipJar.MAX_NOTE_LENGTH());
        uint256 sendValue = bound(uint256(amount), 1 wei, 25 ether);

        bytes memory buffer = new bytes(boundedLength);
        for (uint256 i = 0; i < boundedLength; i++) {
            buffer[i] = bytes1(uint8(65 + (i % 26)));
        }
        string memory note = string(buffer);

        vm.deal(tipper, sendValue);
        vm.prank(tipper);
        tipJar.tip{value: sendValue}(note);

        assertEq(tipJar.totalTips(), sendValue);
        assertEq(tipJar.tipsByUser(tipper), sendValue);
    }

    function testFuzz_tip_reverts_when_note_exceeds_limit(uint16 extraLength, uint96 amount) public {
        uint256 sendValue = bound(uint256(amount), 1 wei, 25 ether);
        uint256 targetLength = tipJar.MAX_NOTE_LENGTH() + 1 + (uint256(extraLength) % 32);
        bytes memory buffer = new bytes(targetLength);
        for (uint256 i = 0; i < targetLength; i++) {
            buffer[i] = 0x61;
        }
        string memory note = string(buffer);

        vm.deal(tipper, sendValue);
        vm.prank(tipper);
        vm.expectRevert(abi.encodeWithSignature("NoteTooLong()"));
        tipJar.tip{value: sendValue}(note);
    }

    function testFuzz_repeated_tipper_accumulates_totals(uint96 firstAmount, uint96 secondAmount) public {
        uint256 a = bound(uint256(firstAmount), 1 wei, 25 ether);
        uint256 b = bound(uint256(secondAmount), 1 wei, 25 ether);

        vm.deal(tipper, a + b);

        vm.prank(tipper);
        tipJar.tip{value: a}("first");

        vm.prank(tipper);
        tipJar.tip{value: b}("second");

        assertEq(tipJar.totalTips(), a + b);
        assertEq(tipJar.tipsByUser(tipper), a + b);
    }

    function testFuzz_withdraw_respects_available_balance(uint96 depositAmount, uint96 withdrawAmount) public {
        uint256 deposit = bound(uint256(depositAmount), 1 wei, 50 ether);
        uint256 withdraw = bound(uint256(withdrawAmount), 0, deposit);

        vm.deal(tipper, deposit);
        vm.prank(tipper);
        tipJar.tip{value: deposit}("gm");

        uint256 ownerStart = owner.balance;
        vm.prank(owner);
        tipJar.withdraw(payable(owner), withdraw);

        assertEq(address(tipJar).balance, deposit - withdraw);
        assertEq(owner.balance, ownerStart + withdraw);
    }

    function testFuzz_withdraw_reverts_when_overdrawn(uint96 depositAmount, uint96 withdrawAmount) public {
        uint256 deposit = bound(uint256(depositAmount), 1 wei, 50 ether);
        uint256 withdraw = bound(uint256(withdrawAmount), deposit + 1, deposit + 50 ether);

        vm.deal(tipper, deposit);
        vm.prank(tipper);
        tipJar.tip{value: deposit}("gm");

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("InsufficientBalance()"));
        tipJar.withdraw(payable(owner), withdraw);
    }

    function testFuzz_receive_updates_totals(address sender, uint96 amount) public {
        vm.assume(sender != address(0));
        vm.assume(sender != owner);

        uint256 value = bound(uint256(amount), 1 wei, 25 ether);

        vm.deal(sender, value);

        vm.expectEmit(true, false, false, true);
        emit TipJar.Tipped(sender, value, "", block.timestamp);

        vm.prank(sender);
        (bool success, ) = address(tipJar).call{value: value}("");
        assertTrue(success);

        assertEq(tipJar.totalTips(), value);
        assertEq(tipJar.tipsByUser(sender), value);
        assertEq(address(tipJar).balance, value);
    }
}
