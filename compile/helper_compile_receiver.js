const path = require('path');
const fs = require('fs');
const solc = require('solc');

/// @notice compile the Receiver Helper Contract (can receive ERC1155s)
async function compileReceiver(input) {

    console.log("--------------------------------");

    let theABIpath = path.resolve(__dirname, '../', 'build', 'Receiver.abi.json')
    let thepath = path.resolve(__dirname, '../', 'build', 'Receiver.bytecode.json')
    try {
        fs.unlinkSync(thepath);
    } catch (err) {
        // console.error(err);
    }
    console.log("File removed (if exists): ", thepath);

    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    const bytecode = output.contracts['Receiver.sol'].Receiver.evm.bytecode;
    const abi = output.contracts['Receiver.sol'].Receiver.abi;

    // write ABI
    fs.writeFile(theABIpath, JSON.stringify(abi), (err) => {
        if (err) throw err;
        else{
           console.log("Receiver Solidity code successfully compiled!");
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
  compileReceiver
}