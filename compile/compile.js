const path = require('path');
const fs = require('fs');

// =================================================================================================

const { compileERC1155YulContract } = require("./helper_compile_erc1155Yul");
const { compileNoReceiver } = require("./helper_compile_noreceiver");
const { compileReceiver } = require("./helper_compile_receiver");

const erc1155Path = path.resolve(__dirname, '../', 'contracts', 'ERC1155Yul.sol');
const source = fs.readFileSync(erc1155Path, 'utf-8');

var input = {
    language: 'Yul',
    sources: {
        'ERC1155Yul.sol' : {
            content: source
        }
    },
    settings: {
        outputSelection: {
            '*': {
                '*': [ "evm.bytecode" ]
            }
        }
    }
};

compileERC1155YulContract(input);

// =================================================================================================

const noreceiverPath = path.resolve(__dirname, '../', 'contracts', 'mocks', 'NoReceiver.sol');
const sourceNoReceiver = fs.readFileSync(noreceiverPath, 'utf-8');

var inputNoReceiver = {
    language: 'Solidity',
    sources: {
        'NoReceiver.sol' : {
            content: sourceNoReceiver
        }
    },
    settings: {
        outputSelection: {
            '*': {
                '*': [ "*" ]
            }
        }
    }
};

compileNoReceiver(inputNoReceiver);

// =================================================================================================

const receiverPath = path.resolve(__dirname, '../', 'contracts', 'mocks', 'Receiver.sol');
const sourceReceiver = fs.readFileSync(receiverPath, 'utf-8');

var inputReceiver = {
    language: 'Solidity',
    sources: {
        'Receiver.sol' : {
            content: sourceReceiver
        }
    },
    settings: {
        outputSelection: {
            '*': {
                '*': [ "*" ]
            }
        }
    }
};

compileReceiver(inputReceiver);