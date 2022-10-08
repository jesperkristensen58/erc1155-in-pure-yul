# Compile contract to create the bytecode, then run the test
# @note that the ABI was manually created under `./build/` just to be sure: you don't get the ABI from here (the solc compiler cannot get the ABI from a Yul contract yet)
# @author Jesper Kristensen

# --- action
echo "🚦 start"

node scripts/compile.js # get bytecode (this writes the Yul contract's bytecode to `./build/`)
npx hardhat test tests/ERC1155Yul.js  --no-compile # test

echo "🏁 compile and test finished"