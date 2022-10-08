const path = require('path');
const fs = require('fs');
const solc = require('solc');

const erc1155Path = path.resolve(__dirname, '../', 'contracts', 'ERC1155Yul.sol');
const source = fs.readFileSync(erc1155Path, 'utf-8');

async function compileERC1155YulContract() {

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

    console.log("--------------------------------");

    let thepath = path.resolve(__dirname, '../', 'build', 'ERC1155Yul.bytecode.json')
    try {
        
        fs.unlinkSync(thepath);
    } catch (err) {
        // console.error(err);
    }
    console.log("File removed (if exists): ", thepath);

    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    const bytecode = output.contracts['ERC1155Yul.sol'].ERC1155Yul.evm.bytecode;

    fs.writeFile(thepath, JSON.stringify(bytecode), (err) => {
        if (err) throw err;
        else{
           console.log("ERC1155 Yul code successfully compiled!");
           console.log("--------------------------------");
           console.log("Bytecode at: ", thepath);
           console.log("--------------------------------");
           console.log("🛠 ✨ Building done ✨");
           console.log("");
        }
     })

     return bytecode;
}

compileERC1155YulContract();