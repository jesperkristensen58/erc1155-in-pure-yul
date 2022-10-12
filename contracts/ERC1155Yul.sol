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
        // function balanceSlot() -> p { p := 1 } // not used in constructor
        function uriLengthSlot() -> p { p := 2 }

        /* =============================================
         * STORE IN STORAGE TRIE
         * =============================================
         */
        // @dev (1) owner
        sstore(ownerSlot(), caller())
        // @dev (2) balance is in slot(1)
        // @dev (3) store URI in the last slot onwards (won't collide, since everything before is fixed)
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
            /* =============================================
             * STORAGE LAYOUT
             * =============================================
             */
            // Owner (deployer)
            function ownerSlot() -> p { p := 0 }
            function balanceSlot() -> p { p := 1 }
            // URI (store length of string in this slot)
            function uriLengthSlot() -> p { p := 2 }

            /**
             * =============================================
             * FREE MEMORY POINTER
             * =============================================
             */
            setMemPtr(0x20) // start memory pointer

            /**
             * =============================================
             * ENSURE ETH IS NOT SENT TO THIS ACCOUNT
             * =============================================
             */
             require(iszero(callvalue()))

            /**
             * =============================================
             * FUNCTIONS
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
            case 0x0e89341c /* uri(uint256 id) */ {
                // note: the id is not used here, see this function's docstring
                let offset, len := _getURI()

                returnDynamicArray(offset, len) // a string is a dynamic array
            }
            case 0x156e29f6 /* mint(address to,uint256 id,uint256 amount) */ {
                let to := decodeAsAddress(0)
                let id := decodeAsUint(1)
                let amount := decodeAsUint(2)

                _mint(to, id, amount)

                returnNothing()
            }
            case 0x00fdd58e /* balanceOf(address account, uint256 id) */ {
                let account := decodeAsAddress(0)
                let id := decodeAsUint(1)

                returnUint(_getBalanceOf(account, id))
            }
            case 0x4e1273f4 /* balanceOfBatch(address[] memory accounts, uint256[] memory ids) */ {
                let posAccounts := decodeAsUint(0) // location in the calldata where this array begins
                let posIds := decodeAsUint(1)

                let offset, len := _createBalanceOfBatch(posAccounts, posIds) // stores in memory

                returnDynamicArray(offset, len)
            }
            /* @notice don't allow fallback or receive */
            default {
                revert(0, 0)
            }

            /// @dev returns a dynamic array
            function returnDynamicArray(offset, length) {
                return(offset, mul(0x20, add(length, 2)))
            }

            /// @dev returns a uint
            function returnUint(v) {
                mstore(getMemPtr(), v)
                return(getMemPtr(), add(getMemPtr(), 0x20))
            }

            /// @dev returns empty returndata
            function returnNothing() {
                return(0, 0)
            }

            /**
             * =============================================
             * CORE FUNCTIONS
             * =============================================
             */
            function _createBalanceOfBatch(posAccounts, posIds) -> offset, lenAccounts {
                lenAccounts := decodeAsUint(div(posAccounts, 0x20))
                let lenIds := decodeAsUint(div(posIds, 0x20))
                require(eq(lenAccounts, lenIds))

                offset := getMemPtr()
                mstore(offset, 0x20) // 0x20 is where the length of the array is *relative to the return data*, not relative to our own internal memory
                mstore(add(offset, 0x20), lenAccounts)  // first store the length of the array
                
                setMemPtr(add(offset, 0x40)) // update before loop

                // then add the balance of each (account, id) requested up to `lenAccounts`
                for { let i := 0 } lt(i, lenAccounts) { i:= add(i, 1) } {
                    let ithAccount := decodeAsAddress(_getArrayElementSlot(posAccounts, i))
                    let ithId := decodeAsUint(_getArrayElementSlot(posIds, i))
                    let ithMemLocation := getMemPtr()

                    mstore(ithMemLocation, _getBalanceOf(ithAccount, ithId))
                    incrPtr() // ptr++
                }
            }

            /// @notice return the chunk index into the calldata where this dynamic array `posArr`'s ith element is stored.
            /// @notice example: this function returns 4. This means that decodeAsUint(4) returns the integer stored as the 5th word of the calldata (indices start at 0)
            /// @dev the returned integer `calldataSlotOffset` from this function can be used with decodeAs<X>(calldataSlotOffset) functions
            function _getArrayElementSlot(posArr, i) -> calldataSlotOffset {
                // We're asking: how many 32-byte chunks into the calldata does this array's ith element lie
                let startingOffset := div(add(posArr, 0x20), 0x20)
                calldataSlotOffset := add(startingOffset, i)
            }

            /// @dev get the balance of an `account`'s token `id`
            function _getBalanceOf(account, id) -> bal {
                bal := sload(_getBalanceSlot(account, id))
            }

            /// @dev mint a new token `id` with the given `amount`
            function _mint(to, id, amount) {
                let slot := _getBalanceSlot(to, id)
                // retrieve existing amount
                let existing := _getBalanceOf(to, id)
                let _new := add(amount, existing)

                sstore(slot, _new) // slot(valueSlot) = amount
            }

            function _getBalanceSlot(_address, _id) -> slot {
                // key = <balanceSlot><to><id>
                // valueSlot = keccak256(key)
                mstore(getMemPtr(), balanceSlot())
                mstore(add(getMemPtr(), 0x20), _address)
                mstore(add(getMemPtr(), 0x40), _id)
                slot := keccak256(getMemPtr(), 0x60)
            }

            function _getURI() -> offset, uriLength {
                offset := 0x00
                uriLength := sload(uriLengthSlot())

                mstore(offset, 0x20) // <store beginning of the string - pos 0x20 relative in the returndata>

                // then its length
                mstore(add(offset, 0x20), uriLength) // <pointer to beginning><length>
                
                // load the URI data from storage into memory
                for { let i := 1 } lt(i, add(2, div(uriLength, 0x20))) { i := add(i, 1) }
                {
                    let slot_i := add(uriLengthSlot(), i)

                    // <pointer to beginning><length><first chunk of data><second chunk of data>...
                    //                                        ^ we are here in the first iteration
                    // load it from our storage trie:
                    let chunk_i := sload(slot_i)

                    mstore(add(offset, add(0x20, mul(i, 0x20))), chunk_i) // let's put it into memory
                }
            }

            /**
             * =============================================
             * HELPERS
             * =============================================
             */
             /// MEMORY POINTER
            function memPtrPos() -> p { p := 0x00 } // where is the memory pointer itself stored in memory
            function getMemPtr() -> p { p := mload(memPtrPos()) }
            function setMemPtr(v) { mstore(memPtrPos(), v) }
            function incrPtr() { mstore(memPtrPos(), add(getMemPtr(), 0x20)) } // ptr++

            /// CALLDATA
            function getSelector() -> selector {
                // cut out everything but the first 4 bytes via integer division
                selector := div(calldataload(0), 0x100000000000000000000000000000000000000000000000000000000)
            }
            /// @dev decode this 32-bytes starting at `offset` in the calldata as an address
            function decodeAsAddress(offset) -> v {
                v := decodeAsUint(offset) // first decode as uint
                // then make sure the format is as expected (20 bytes in length):
                if iszero(iszero(and(v, not(0xffffffffffffffffffffffffffffffffffffffff)))) {
                    revert(0, 0)
                }
            }
            /// @dev decode this 32-bytes starting at `offset` in the calldata as a uint256
            function decodeAsUint(offset) -> v {
                let pos := add(4, mul(offset, 0x20)) // adding 4 accounts for function selector
                if lt(calldatasize(), add(pos, 0x20)) {
                    revert(0, 0)
                }
                v := calldataload(pos)
            }
            /// @dev helper function to require a condition
            function require(condition) {
                if iszero(condition) {
                    revert(0, 0)
                }
            }
        }
    }
}