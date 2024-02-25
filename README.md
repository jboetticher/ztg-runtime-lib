# Zeitgeist Runtime Library

- Look at `benchmarks.rs` to see how they set up (fill_pool etc)
- zeitgeistpm/app-docker will create a local environment

Your battery station password was `zeitgeist`

## Running e2e Tests
Specify a Zeitgeist node:  

```
export CONTRACTS_NODE=/Users/jb/Desktop/polkadot/zeitgeist/target/release/zeitgeist
```

Run node:

```
/Users/jb/Desktop/polkadot/zeitgeist/target/release/zeitgeist --tmp --alice --validator --chain=/Users/jb/Desktop/polkadot/zeitgeist/customSpecRaw.json
```

## Polkadot JS Contracts

How to query with WeightsV2:
https://substrate.stackexchange.com/a/7275/4422