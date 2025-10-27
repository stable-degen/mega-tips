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
}
