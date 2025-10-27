// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {TipJar} from "contracts/TipJar.sol";

contract DeployTipJar is Script {
    function run() external returns (TipJar deployed) {
        address owner = vm.envAddress("OWNER_ADDRESS");

        vm.startBroadcast();
        deployed = new TipJar(owner);
        vm.stopBroadcast();
    }
}
