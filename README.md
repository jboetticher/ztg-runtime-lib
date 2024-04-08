# Zeitgeist Runtime Library

The Zeitgeist Runtime Library allows ink! developers to make runtime calls to Zeitgeist's special pallets with ease.  

This library was built in ink! version 4.3.0. 

## Features

Runtime calls in ink! are made with enums that map a pallet's index and extrinsics. This library provides you with a `RuntimeCall` enum that encodes extrinsics from ten pallets:  

- AssetManager (Incomplete)
- Authorized
- Court
- Swaps (Legacy)
- PredictionMarkets
- Styx
- GlobalDisputes
- NeoSwaps
- Orderbook
- Parimutuel

Zeitgeist specific data structures are also available for developers to use when making these runtime calls.  

### Examples

You can make a runtime call in the following format:  

```rust
const result = self.env()
    .call_runtime(&RuntimeCall::AssetManager(AssetManagerCall::Transfer {
        dest: dest.into(),
        currency_id: ZeitgeistAsset::Ztg,
    amount
}));
```

For an example of every runtime call being made, reference the `ztg_runtime_example` ink! smart contract. This contract has one function for each runtime call. Note that not every runtime call can be successfully made as some extrinsics must be called via sudo, through a committee, or are otherwise disabled.  

## Tests
The testing environment for this package manually tests the calls within a live Zeitgeist development node. The tests themselves are written in TypeScript with the Mocha framework.    

### Setup

The testing folder is in `ts`. Install dependencies with Node (v18):  

```
cargo build
cd ts
npm install
```

To set up the testing environment, you must set environment variables & generate a chain spec.  

There are three environment variables that must be set within a new file `ts/.env`, each with require a complete path:  

```
PATH_TO_NODE=[COMPLETE_PATH_TO_ZEITGEIST_NODE]
PATH_TO_CUSTOM_SPEC=[COMPLETE_PATH_TO_ZEITGEIST_SPEC]
PATH_TO_CUSTOM_RAW_SPEC=[COMPLETE_PATH_TO_ZEITGEIST_RAW_SPEC]
```

Then, to generate a chain spec, run the following command:  

```
npm run spec
```

A custom chain spec is required as there are assumptions within the TypeScript tests that the chain spec satisfy.  

### Running

The TypeScript tests will automatically run and shut off instances of the Zeitgeist node, so long as the environment variables were correctly set. You can run the tests with the following:  

```
npm run test
```

### Skipped Tests

Some tests will be skipped. Some require either SUDO or a committee call to be completed, so in effect the runtime call will never be used by a smart contract. The `swaps` tests are skipped due to current versions of the Zeitgeist runtime locking them.  

## Contribution
There are still areas of contribution:  
- Implement storage layout for the `Range` type  
- Implement storage layout for `[u8; 50]`  
- Implement storage layout for `RangeInclusive`  
- Upgrade to ink! v5