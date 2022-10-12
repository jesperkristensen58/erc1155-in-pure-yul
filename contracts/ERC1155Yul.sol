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
        // p=1: balanceSlot()
        // p=2: operatorApprovalSlot()
        function uriLengthSlot() -> p { p := 3 }

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
            function operatorApprovalSlot() -> p { p := 2 }
            function uriLengthSlot() -> p { p := 3 }  // URI (store length of string in this slot)

            /**
             * =============================================
             * FREE MEMORY POINTER
             * =============================================
             */
            // ---------------
            // SCRATCH SLOT 1: 0x00->0x20
            // SCRATCH SLOT 2: 0x20->0x40
            // SCRATCH SLOT 3: 0x40->0x60
            // ---------------
            // MEMORY POINTER: 0x60->0x80 (stored in "memPtrPos()")
            // ---------------
            // SO FIRST AVAILABLE MEMORY SLOT: 0x80 (which is 0x20 added to its own location in memory); set that below:
            setMemPtr(add(memPtrPos(), 0x20)) // memory pointer points to 0x80 at the beginning

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
                let from, to := _getURI()

                returnMemoryData(from, to)
            }
            case 0x156e29f6 /* mint(address to,uint256 id,uint256 amount) */ {
                require(calledByOwner())

                let to := decodeAsAddress(0)
                let id := decodeAsUint(1)
                let amount := decodeAsUint(2)

                _mint(to, id, amount)

                returnNothing()
            }
            case 0xd81d0a15 /* mintBatch(address to,uint256[] ids,uint256[] amounts) */ {
                require(calledByOwner())
                
                let to := decodeAsAddress(0)
                let posIds := decodeAsUint(1)
                let posAmounts := decodeAsUint(2)

                _mintBatch(to, posIds, posAmounts) /// @dev calls _mint repeatedly

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

                let from, to := _createBalanceOfBatch(posAccounts, posIds) // stores in memory

                returnMemoryData(from, to)
            }
            case 0xf5298aca /* burn(address from, uint256 id, uint256 amount) */ {
                require(calledByOwner())

                let from := decodeAsAddress(0)
                let id := decodeAsUint(1)
                let amount := decodeAsUint(2)

                _burn(from, id, amount)

                returnNothing()
            }
            case 0x6b20c454 /* burnBatch(address from, uint256[] ids, uint256[] amounts) */ {
                require(calledByOwner())

                let from := decodeAsAddress(0)
                let posIds := decodeAsUint(1)
                let posAmounts := decodeAsUint(2)

                _burnBatch(from, posIds, posAmounts)

                returnNothing()
            }
            case 0xa22cb465 /* setApprovalForAll(address operator, bool approved) */ {
                let account := caller()
                let operator := decodeAsAddress(0)
                require(iszero(eq(account, operator))) // account != operator

                let approved := decodeAsUint(1)

                sstore(_getOperatorApprovalSlot(account, operator), approved)

                returnNothing()
            }
            case 0xe985e9c5 /* isApprovedForAll(address account, address operator) */ {
                let account := decodeAsAddress(0)
                let operator := decodeAsAddress(1)
                require(iszero(eq(account, operator)))

                let approved := _isApprovedForAll(account, operator)

                returnUint(approved) // bool behaves like uint
            }
            case 0x0febdd49 /* function safeTransferFrom(address from, address to, uint256 id, uint256 amount) */ {
                let from := decodeAsAddress(0)
                let to := decodeAsAddress(1)
                let id := decodeAsUint(2)
                let amount := decodeAsUint(3)

                // check that msg.sender is allowed to transfer `from`'s tokens
                // (which they are if msg.sender == from of course)
                require(or(eq(from, caller()), _isApprovedForAll(from, caller())))

                _safeTransferFrom(from, to, id, amount)

                returnNothing()                
            }
            /* @notice don't allow fallback or receive */
            default {
                revert(0, 0)
            }

            /// @dev returns a chunk of memory data
            /// @param from the starting address in memory of the data to return, e.g.: 0x00
            /// @param to the ending address in memory of the data to return, e.g., 0x20
            function returnMemoryData(from, to) {
                return(from, to)
            }

            /// @dev returns a uint
            function returnUint(v) {
                let ptr := getMemPtr()
                mstore(ptr, v)
                returnMemoryData(ptr, safeAdd(ptr, 0x20))
            }

            /// @dev returns empty returndata
            function returnNothing() {
                returnMemoryData(0, 0)
            }

            /**
             * =============================================
             * CORE FUNCTIONS
             * =============================================
             */
             /// @dev do the mint batching against the incoming Ids and amounts
            function _mintBatch(to, posIds, posAmounts) {
                let lenIds := decodeAsUint(div(posIds, 0x20))
                let lenAmounts := decodeAsUint(div(posAmounts, 0x20))
                require(eq(lenIds, lenAmounts))

                for { let i := 0 } lt(i, lenIds) { i:= add(i, 1) }
                {
                    let ithId := decodeAsUint(_getArrayElementSlot(posIds, i))
                    let ithAmount := decodeAsUint(_getArrayElementSlot(posAmounts, i))
                    _mint(to, ithId, ithAmount)
                }
            }

            /// @dev do the burn batching against the incoming Ids and amounts
            function _burnBatch(from, posIds, posAmounts) {
                let lenIds := decodeAsUint(div(posIds, 0x20))
                let lenAmounts := decodeAsUint(div(posAmounts, 0x20))
                require(eq(lenIds, lenAmounts))

                for { let i := 0 } lt(i, lenIds) { i:= add(i, 1) }
                {
                    let ithId := decodeAsUint(_getArrayElementSlot(posIds, i))
                    let ithAmount := decodeAsUint(_getArrayElementSlot(posAmounts, i))
                    _burn(from, ithId, ithAmount)
                }
            }

            /// @dev is the operator approved to access all of account's tokens?
            function _isApprovedForAll(account, operator) -> approved {
                approved := sload(_getOperatorApprovalSlot(account, operator))
            }

            function _safeTransferFrom(from, to, id, amount) {
                let fromSlot := _getBalanceSlot(from, id)
                let toSlot := _getBalanceSlot(to, id)
                
                // from = from - amount
                let fromOld := sload(fromSlot)
                let fromNew := safeSub(fromOld, amount)
                sstore(fromSlot, fromNew)

                // to = to + amount
                let toOld := sload(toSlot)
                let toNew := safeAdd(toOld, amount)
                sstore(toSlot, toNew)


                // TODO: EMIT EVENT!


            }

             /// @dev helper to construct and collect the balance of for multiple accounts and token Ids
             /// @dev since this is a dynamic array, the function returns the starting and ending locations in memory where the array is stored
            function _createBalanceOfBatch(posAccounts, posIds) -> startsAt, endsAt {
                let lenAccounts := decodeAsUint(div(posAccounts, 0x20))
                let lenIds := decodeAsUint(div(posIds, 0x20))
                require(eq(lenAccounts, lenIds))

                startsAt := getMemPtr()
                mstore(startsAt, 0x20) // 0x20 is where the length of the array is *relative to the return data*, not relative to our own internal memory
                mstore(safeAdd(startsAt, 0x20), lenAccounts)  // first store the length of the array
                
                setMemPtr(safeAdd(startsAt, 0x40)) // update before loop

                // then add the balance of each (account, id) requested up to `lenAccounts`
                for { let i := 0 } lt(i, lenAccounts) { i:= add(i, 1) }
                {
                    let ithAccount := decodeAsAddress(_getArrayElementSlot(posAccounts, i))
                    let ithId := decodeAsUint(_getArrayElementSlot(posIds, i))
                    let ithMemLocation := getMemPtr()

                    mstore(ithMemLocation, _getBalanceOf(ithAccount, ithId))
                    incrPtr() // ptr++
                }
                endsAt := getMemPtr()
            }

            /// @notice return the chunk index into the calldata where this dynamic array `posArr`'s ith element is stored.
            /// @notice example: this function returns 4. This means that decodeAsUint(4) returns the integer stored as the 5th word of the calldata (indices start at 0)
            /// @dev the returned integer `calldataSlotOffset` from this function can be used with decodeAs<X>(calldataSlotOffset) functions
            function _getArrayElementSlot(posArr, i) -> calldataSlotOffset {
                // We're asking: how many 32-byte chunks into the calldata does this array's ith element lie
                // the array itself starts at posArra (starts meaning: that is where the pointer to the length of the array is stored)
                let startingOffset := div(safeAdd(posArr, 0x20), 0x20)
                calldataSlotOffset := safeAdd(startingOffset, i)
            }

            /// @dev get the balance of an `account`'s token `id`
            function _getBalanceOf(account, id) -> bal {
                bal := sload(_getBalanceSlot(account, id))
            }

            /// @dev mints token `id` `to` account of given `amount`
            /// @dev has overflow check via `safeAdd`
            function _mint(to, id, amount) {
                let slot := _getBalanceSlot(to, id)
                let vOld := sload(slot) // minting is additive; retrieve existing amount
                let vNew := safeAdd(vOld, amount)

                sstore(slot, vNew) // slot(valueSlot) = amount



                // TODO: EMIT EVENT!

            }

            /// @dev burns `amount` of token `id` `from` account.
            /// @dev has overflow checking via `safeSub`
            function _burn(from, id, amount) {
                let slot := _getBalanceSlot(from, id)
                let vOld := sload(slot) // minting is additive; retrieve existing amount
                let vNew := safeSub(vOld, amount)

                sstore(slot, vNew) // slot(valueSlot) = amount
            }

            /// @dev retrieve the storage slot where the balances are stored
            function _getBalanceSlot(_address, id) -> slot {
                // key = <balanceSlot><to><id>
                // slot = keccak256(key)
                mstore(0x00, balanceSlot()) // use scratch space for hashing
                mstore(0x20, _address)
                mstore(0x40, id)
                slot := keccak256(0x00, 0x60)
            }

            /// @dev retrieve the storage slot where approval information is stored
            function _getOperatorApprovalSlot(account, operator) -> slot {
                // key = <operatorApprovalSlot><owner><operator>
                // slot = keccak256(key)
                mstore(0x00, operatorApprovalSlot())
                mstore(0x20, account)
                mstore(0x40, operator)
                slot := keccak256(0x00, 0x60)
            }

            /*
             * @dev returns the URI stored with this ERC1155 token.
             */
            function _getURI() -> startsAt, endsAt {
                startsAt := getMemPtr()
                let uriLength := sload(uriLengthSlot())

                mstore(startsAt, 0x20) // <store beginning of the string - pos 0x20 relative in the returndata>

                // then its length
                mstore(safeAdd(startsAt, 0x20), uriLength) // <pointer to beginning><length>
                setMemPtr(safeAdd(startsAt, 0x40))
                
                // load the URI data from storage into memory
                for { let i := 0 } lt(i, uriLength) { i := add(i, 1) }
                {
                    let slot_i := safeAdd(uriLengthSlot(), add(i, 1))

                    // <pointer to beginning><length><first chunk of data><second chunk of data>...
                    //                                        ^ we are here in the first iteration
                    // load it from our storage trie:
                    let chunk_i := sload(slot_i)
                    let memorySlot_i := getMemPtr()

                    mstore(memorySlot_i, chunk_i) // let's put it into memory
                    incrPtr() // ptr++
                }
                endsAt := getMemPtr()
            }

            /**
             * =============================================
             * HELPERS
             * =============================================
             */
             /// MEMORY POINTER
            function memPtrPos() -> p { p := 0x60 } // where is the memory pointer itself stored in memory
            function getMemPtr() -> p { p := mload(memPtrPos()) }
            function setMemPtr(v) { mstore(memPtrPos(), v) }
            function incrPtr() { mstore(memPtrPos(), safeAdd(getMemPtr(), 0x20)) } // ptr++

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
            /// @dev a+b with overflow checking
            function safeAdd(a, b) -> r {
                r := add(a, b)
                if or(lt(r, a), lt(r, b)) { revert(0, 0) }
            }
            /// @dev a-b with overflow checking
            function safeSub(a, b) -> r {
                r := sub(a, b)
                if gt(r, a) { revert(0, 0) }
            }
            /// @dev get the owner (the deployer)
            function owner() -> o {
                o := sload(ownerSlot())
            }
            /// @dev check that msg.sender == owner()
            function calledByOwner() -> cbo {
                cbo := eq(owner(), caller())
            }
        }
    }
}