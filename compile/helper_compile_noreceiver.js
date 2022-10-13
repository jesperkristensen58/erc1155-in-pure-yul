const path = require('path');
const fs = require('fs');
const solc = require('solc');

/// @notice compile the NonReceiver contract (cannot receive ERC1155s)
async function compileNoReceiver(input) {

    console.log("--------------------------------");

    let theABIpath = path.resolve(__dirname, '../', 'build', 'NoReceiver.abi.json')
    let thepath = path.resolve(__dirname, '../', 'build', 'NoReceiver.bytecode.json')
    try {
        fs.unlinkSync(thepath);
    } catch (err) {
        // console.error(err);
    }
    console.log("File removed (if exists): ", thepath);

    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    const bytecode = output.contracts['NoReceiver.sol'].NoReceiver.evm.bytecode;
    const abi = output.contracts['NoReceiver.sol'].NoReceiver.abi;

    // write ABI
    fs.writeFile(theABIpath, JSON.stringify(abi), (err) => {
        if (err) throw err;
        else{
           console.log("NoReceiver Solidity code successfully compiled!");
           console.log("--------------------------------");
           console.log("ABI at: ", theABIpath);
           
        }
     })
     // write Bytecode
     fs.writeFile(thepath, JSON.stringify(bytecode), (err) => {
      if (err) throw err;
      else{
         console.log("Bytecode at: ", thepath);
         console.log("--------------------------------");
         console.log("🛠 ✨ Building done ✨");
         console.log("");
      }
   })

    return bytecode, abi;
}

module.exports = {
  compileNoReceiver
}