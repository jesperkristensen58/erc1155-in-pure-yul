/**
 * @title ERC1155 Purely in Yul.
 *
 * @notice This implements the ERC1155 semi-fungible NFT purely in the Yul dialect.
 * @notice the Spec is here: https://eips.ethereum.org/EIPS/eip-1155
 * @author Jesper Kristensen
 * @date October, 2022
 */
object "ERC1155Yul" {

    /**
     * @notice Constructor
     * @param uri the URI to set for this ERC1155. This will be set once on construction.
     */
    code {
        // @dev store the contract owner in slot 0
        sstore(0, caller())

        // @dev store URI in slot 1 onwards
        sstore(1, 0x22) // store the hardcoded uri string length, and then below the string
        sstore(2, 0x68747470733a2f2f746f6b656e2d63646e2d646f6d61696e2f7b69647d2e6a73)
        sstore(3, 0x6f6e000000000000000000000000000000000000000000000000000000000000)

        // Deploy the contract
        datacopy(0, dataoffset("runtime"), datasize("runtime"))
        return(0, datasize("runtime"))
    }

    object "runtime" {

        code {
            // Initialize a free memory pointer at 0x00
            mstore(0x00, 0x20)

            /* =============================================
             * STORAGE SLOTS
             * =============================================
             */
            // Owner (deployer)
            function ownerSlot() -> p { p := 0 }
            // URI (store length of string in this slot)
            function uriLengthSlot() -> p { p := 1 }

            /**
             * =============================================
             * DISPATCH TO RELEVANT FUNCTION
             * =============================================
             */
            switch theFunctionWeWant()
            /* @notice uri(uint256)
             * @param the id (@note: NOT used).
             * @return the URI stored in this contract's storage.
             */
            case 0x0e89341c /* uri(uint256) */ {
                _getURI()
            }
            /* @notice no fallback or receive */
            default {
                revert(0, 0)
            }

            /**
             * =============================================
             * CORE FUNCTIONS
             * =============================================
             */
            function _getURI() {
                let uriLength := sload(uriLengthSlot())

                // a string needs an upfront 32 bytes of 0's
                mstore(0x00, 0x20) // <0's>

                // then its length
                mstore(0x20, uriLength) // <0's><length>
                
                // load the URI data from storage into memory
                for { let i := 1 } lt(i, add(2, div(uriLength, 0x20))) { i := add(i, 1) }
                {
                    let slot_i := add(uriLengthSlot(), i)

                    // <0's><length><first chunk of data><second chunk of data>...
                    //                        ^ we are here in the first iteration
                    // load it from our storage trie:
                    let chunk_i := sload(slot_i)

                    mstore(add(0x20, mul(i, 0x20)), chunk_i) // let's put it into memory
                }

                // return the data we stored in memory
                return(0x00, add(0x40, mul(uriLength, 0x20)))
            }

            /**
             * =============================================
             * HELPERS: DECODE CALLDATA
             * =============================================
             */
            function theFunctionWeWant() -> selector {
                // cut out everything but the first 4 bytes via integer division
                selector := div(calldataload(0), 0x100000000000000000000000000000000000000000000000000000000)
            }
        }
    }
}