import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { cryptoWaitReady, randomAsHex } from '@polkadot/util-crypto';
import { CodePromise, ContractPromise } from '@polkadot/api-contract';
import { WeightV2, Weight } from '@polkadot/types/interfaces/runtime/types';
import { BN, BN_ONE } from '@polkadot/util';
import { spawn } from 'child_process';
import * as fs from "fs";


// Initialize the keyring and add the sudo account
const PATH_TO_NODE = '/Users/jb/Desktop/polkadot/zeitgeist/target/release/zeitgeist'; // TODO: turn into environment variable
const PATH_TO_CUSTOM_SPEC = '/Users/jb/Desktop/polkadot/zeitgeist/customSpecRaw.json'; // TODO: turn into environment variable
const ZEITGEIST_WS_ENDPOINT = 'ws://127.0.0.1:9944';

// Contract paths
export const EXAMPLE_CONTRACT_WASM = '../target/ink/ztg_runtime_example/ztg_runtime_example.wasm';
export const EXAMPLE_CONTRACT_META = '../target/ink/ztg_runtime_example/ztg_runtime_example.json';

// Constants
const MAX_CALL_WEIGHT = new BN(5_000_000_000_000).isub(BN_ONE);
const PROOFSIZE = new BN(1_000_000);

/** Spawns a fresh (--tmp) Zeitgeist node */
export const startNode = () => {
  const nodeProcess = spawn(
    PATH_TO_NODE,
    ['--tmp', `--chain=${PATH_TO_CUSTOM_SPEC}`, '--alice', '--validator'],
    {
      // stdio: 'inherit', // To show node output in the console
    });

  console.log(`Node started with PID: ${nodeProcess.pid}`);
  return nodeProcess;
};

/**
 * Returns the default sudo account (//Charlie) for the customSpec that came with the customSpec.json.  
 * Charlie is 5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y
 * 
 * @returns KeyringPair for Charlie (SUDO account)
 */
export function sudo() {
  const KEYRING = new Keyring({ type: 'sr25519' });
  return KEYRING.addFromUri('//Charlie');
}

/**
 * Creates an API & provider for the local node.
 */
export async function getAPI() {
  const provider = new WsProvider(ZEITGEIST_WS_ENDPOINT);
  const api = await ApiPromise.create({ provider });
  return { provider, api };
}

/**
 * Deploys the ztg_runtime_example smart contract.
 * @returns A contract instance
 */
export async function deployTestContract(api: ApiPromise) {
  // Load contract WASM and metadata
  const wasm = fs.readFileSync(EXAMPLE_CONTRACT_WASM);
  const metadata = fs.readFileSync(EXAMPLE_CONTRACT_META, { encoding: 'utf-8' });

  // Create a new instance of the contract
  const code = new CodePromise(api, metadata, wasm);

  // Deploy the contract with 100 DEV
  const w2: WeightV2 = api.createType('WeightV2', {
    refTime: api.createType('Compact<u64>', 100000n * 1000000n),
    proofSize: api.createType('Compact<u64>', 50000n)
  });

  const address: string = await new Promise((resolve, reject) => {
    code.tx.new(
      { storageDepositLimit: null, gasLimit: w2 },
      0 /* Constructor index [there is only 1, so 0]*/,
      /* Constructor arguments [there should be none] */
    )
      .signAndSend(sudo(), (result) => {
        if (result.isError) reject("Error occured on deployment");
        else if (result.status.isInBlock) {
          // Loop through events to find the contract address
          result.events.forEach(({ event: { data, method, section } }) => {
            if (section === 'contracts' && method === 'Instantiated') {
              const [creator, contractAddress] = data;
              // console.log(`Transaction finalized at blockHash ${result.status.asFinalized}`);
              console.log(`Contract successfully deployed at address: ${contractAddress}`);
              resolve(contractAddress.toString());
            }
          });
        }
      });
  });

  return new ContractPromise(api, metadata, address);
}

/**
 * Sets an account to SUDO, assuming current sudo is still Charlie.
 * @param newSudoAccount The AccountId to set as SUDO.
 */
export async function setSudoKey(newSudoAccount: string) {
  // Connect to the local Zeitgeist node
  const provider = new WsProvider(ZEITGEIST_WS_ENDPOINT);
  const api = await ApiPromise.create({ provider });

  // Create and sign the transaction
  const tx = api.tx.sudo.sudo(
    api.tx.sudo.setKey(newSudoAccount)
  );

  // Send the transaction
  const hash = await tx.signAndSend(sudo());

  console.log(`Set SUDO tx sent with hash: ${hash.toHex()}`);
}

/**
 * Creates a WeightV2 object with high refTime & proofsize
 * @param api The Polkadot API
 */
export function maxWeight2(api: ApiPromise) {
  // Creates the max gas limit
  const maxGasLimit = api.registry.createType('WeightV2', {
    refTime: MAX_CALL_WEIGHT,
    proofSize: PROOFSIZE,
  }) as WeightV2;

  return { gasLimit: maxGasLimit, storageDepositLimit: null };
}

/**
 * Creates a WeightV2 object with specified weight
 * @param api The Polkadot API
 * @param gasRequired Weight as returned by a tx query
 */
export function createGas(api: ApiPromise, gasRequired: Weight) {
  return {
    gasLimit: api.registry.createType('WeightV2', gasRequired) as WeightV2,
    storageDepositLimit: null
  }
}
/**
 * Waits a specified number of blocks before resolving
 * @param api The Polkadot API
 * @param blocks Number of blocks to wait
 */
export async function waitBlocks(api: ApiPromise, blocks: number): Promise<void> {
  let blocksSeen: number = 0;

  return await new Promise<void>(async (resolve, reject) => {
    // Subscribe to new block headers
    const unsubscribe = await api.rpc.chain.subscribeNewHeads((header) => {
      blocksSeen += 1;

      if (blocksSeen >= blocks) {
        // Unsubscribe from the block header subscription
        unsubscribe();
        resolve();
      }
    });
  });
}

/**Generates a random PolkadotJS address */
export function generateRandomAddress() {
    // Create a keyring instance. The keyring is used to generate and manage keys.
    // Specify the type of address you want to generate, e.g., 'sr25519' (Substrate) or 'ed25519'
    const keyring = new Keyring({ type: 'sr25519' });
  
    // Generate a random keypair
    const pair = keyring.addFromUri(randomAsHex(32));
  
    // Get the address from the keypair
    return pair.address;
}