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
        /* =============================================
         * PREP
         * =============================================
         */
        function ownerSlot() -> p { p := 0 }
        // function balanceSlot() -> p { p := 1 }
        function uriLengthSlot() -> p { p := 2 }

        /* =============================================
         * STORE IN STORAGE TRIE
         * =============================================
         */
        // @dev owner
        sstore(ownerSlot(), caller())
        // @dev balance is in slot(1)
        // @dev store URI in the last slot onwards (won't collide, since everything before is fixed)
        sstore(uriLengthSlot(), 0x22) // store the hardcoded uri string length, and then below the string
        sstore(add(uriLengthSlot(), 1), 0x68747470733a2f2f746f6b656e2d63646e2d646f6d61696e2f7b69647d2e6a73)
        sstore(add(uriLengthSlot(), 2), 0x6f6e000000000000000000000000000000000000000000000000000000000000)

        /* =============================================
         * DEPLOY THE CONTRACT
         * =============================================
         */
        datacopy(0, dataoffset("deployed"), datasize("deployed"))
        return(0, datasize("deployed"))
    }

    object "deployed" {

        code {
            // Initialize a free memory pointer at 0x00
            mstore(0x00, 0x20)

            /* =============================================
             * STORAGE SLOTS
             * =============================================
             */
            // Owner (deployer)
            function ownerSlot() -> p { p := 0 }
            function balanceSlot() -> p { p := 1 }
            // URI (store length of string in this slot)
            function uriLengthSlot() -> p { p := 2 }

            /**
             * =============================================
             * DISPATCH TO RELEVANT FUNCTION
             * =============================================
             */
            switch getSelector()
            /**
            * @dev See {IERC1155MetadataURI-uri}.
            *
            * This implementation returns the same URI for *all* token types. It relies
            * on the token type ID substitution mechanism
            * https://eips.ethereum.org/EIPS/eip-1155#metadata[defined in the EIP].
            *
            * Clients calling this function must replace the `\{id\}` substring with the
            * actual token type ID.
            */
            case 0x0e89341c /* uri(uint256) */ {
                _getURI()
            }
            case 0x156e29f6 /* mint(address to,uint256 id,uint256 amount) */ {
                let to := decodeAsAddress(0)
                let id := decodeAsUint(1)
                let amount := decodeAsUint(2)

                _mint(to, id, amount)

                return(0, 0)
            }
            case 0x00fdd58e /* balanceOf(address account, uint256 id) */ {
                let account := decodeAsAddress(0)
                let id := decodeAsUint(1)

                mstore(0x0, _balanceOf(account, id))
                return(0, 0x20)
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
            function _balanceOf(account, id) -> bal {
                let slot := _getBalanceSlot(account, id)
                bal := sload(slot)
            }

            function _mint(to, id, amount) {
                let slot := _getBalanceSlot(to, id)
                // retrieve existing amount
                let existing := _balanceOf(to, id)
                let _new := add(amount, existing)

                sstore(slot, _new) // slot(valueSlot) = amount
            }

            function _getBalanceSlot(_address, _id) -> slot {
                // key = <balanceSlot><to><id>
                // valueSlot = keccak256(key)
                mstore(0x0, balanceSlot())
                mstore(0x20, _address)
                mstore(0x40, _id)
                slot := keccak256(0, 0x60)
            }

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
            function getSelector() -> selector {
                // cut out everything but the first 4 bytes via integer division
                selector := div(calldataload(0), 0x100000000000000000000000000000000000000000000000000000000)
            }
            /// @dev decode this 32-bytes starting at offset in the calldata as an address
            function decodeAsAddress(offset) -> v {
                v := decodeAsUint(offset) // first decode as uint
                // then make sure the format is as expected (20 bytes in length):
                if iszero(iszero(and(v, not(0xffffffffffffffffffffffffffffffffffffffff)))) {
                    revert(0, 0)
                }
            }
            /// @dev decode this 32-bytes starting at offset in the calldata as a uint256
            function decodeAsUint(offset) -> v {
                let pos := add(4, mul(offset, 0x20)) // add 4 accounts for function selector
                if lt(calldatasize(), add(pos, 0x20)) {
                    revert(0, 0)
                }
                v := calldataload(pos)
            }
        }
    }
}