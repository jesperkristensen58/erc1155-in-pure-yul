# How to get the ABI?

The Application Binary Interface (ABI) you can retrieve by compiling the ERC1155 contract. For example in Remix.
I did this by pasting this minimal contract into Remix:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity =0.8.17;
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract TinyVillage is ERC1155 {
    constructor(string memory _uri) ERC1155(_uri) {}
}
```

Then compile it and then simply copy the ABI from the same compiler page (towards the bottom, next to the bytecode button).

# How to get the bytecode file?

You don't, at least not manually. This is what comes from calling `node scripts/compile.js` in the project root.

# Author

Jesper Kristensen

## Follow me on Twitter!

[![Twitter URL](https://img.shields.io/twitter/url/https/twitter.com/cryptojesperk.svg?style=social&label=Follow%20%40cryptojesperk)](https://twitter.com/cryptojesperk)

## License
This project uses the following license: [MIT](https://github.com/bisguzar/twitter-scraper/blob/master/LICENSE).
