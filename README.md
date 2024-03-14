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
/Users/jb/Desktop/polkadot/zeitgeist/target/release/zeitgeist --tmp --alice --validator --chain=/Users/jb/Desktop/polkadot/ztg-runtime-lib/ts/spec/customSpecRaw.json
```

```
sudo docker run \
   -p 4001:4001 \
   -p 127.0.0.1:8080:8080 \
   -p 127.0.0.1:8081:8081 \
   -p 127.0.0.1:5001:5001 \
   ipfs/go-ipfs
```

## Polkadot JS Contracts

How to query with WeightsV2:
https://substrate.stackexchange.com/a/7275/4422

## Polkadot JS Contracts
https://github.com/paritytech/substrate/blob/033d4e86cc7eff0066cd376b9375f815761d653c/frame/contracts/src/lib.rs#L963