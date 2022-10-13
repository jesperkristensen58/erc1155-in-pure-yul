<p align="center">
  <img src="erc1155.jpeg" width="350" title="ERC1155 is a great token standard to hold both fungible and non-fungible tokens!">
</p>

# The ERC1155 - Delivered as a Yul Present!

This is a pure Yul implementation of the ERC1155 Token contract.
Some mock contracts (under `contracts/mocks`) accompy the main Yul contract for testing purposes.

# How to Compile & Test

Run

```shell
./test.sh
```

## How to Test in Detail

`Test.sh` under hood calls:

```shell
node scripts/compile.js # compiles the Yul contract as well as the mock contracts
npx hardhat test tests/ERC1155Yul.js --no-compile
```

Notice the `--no-compile` flag; this is to ensure that hardhat does not start compiling the Yul contract (it won't know how by default at least). So we compile separately with the `compile.js` script. We then do the same for the Solidity contracts as well using `solc(...)`.

# Author
Jesper Kristensen

## Follow me on Twitter!

[![Twitter URL](https://img.shields.io/twitter/url/https/twitter.com/cryptojesperk.svg?style=social&label=Follow%20%40cryptojesperk)](https://twitter.com/cryptojesperk)

## License
This project uses the following license: [MIT](https://github.com/bisguzar/twitter-scraper/blob/master/LICENSE).
