import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { CodePromise } from '@polkadot/api-contract';
import { WeightV2 } from '@polkadot/types/interfaces/runtime/types';
import { spawn } from 'child_process';
import fs from "fs";

// Ensure WASM crypto is initialized
cryptoWaitReady().then(() => {
  /*
  
  In the local environment used to test this, "//Charlie" has been given the SUDO.
  Use the "customSpec.json" to use this spec
  
  Firefox Account -> 5GpXuV3kd62JEVSKKXzy3FfA2Xp3wBiJCUiyJnrBHvWX9DzA
  Charlie -> 5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y
  
  */

  // Initialize the keyring and add the sudo account
  const KEYRING = new Keyring({ type: 'sr25519' });
  const SUDO = KEYRING.addFromUri('//Charlie');
  const PATH_TO_NODE = '/Users/jb/Desktop/polkadot/zeitgeist/target/release/zeitgeist'; // TODO: turn into environment variable
  const PATH_TO_CUSTOM_SPEC = '/Users/jb/Desktop/polkadot/zeitgeist/customSpecRaw.json';
  const ZEITGEIST_WS_ENDPOINT = 'ws://127.0.0.1:9944';

  async function setSudoKey() {
    // Connect to the local Zeitgeist node
    const provider = new WsProvider(ZEITGEIST_WS_ENDPOINT);
    const api = await ApiPromise.create({ provider });

    // Address of the new sudo account
    const newSudoAccount = '5GpXuV3kd62JEVSKKXzy3FfA2Xp3wBiJCUiyJnrBHvWX9DzA';

    // Create and sign the transaction
    const tx = api.tx.sudo.sudo(
      api.tx.sudo.setKey(newSudoAccount)
    );

    // Send the transaction
    const hash = await tx.signAndSend(SUDO);

    console.log(`Transaction sent with hash: ${hash.toHex()}`);
  }



  const EXAMPLE_CONTRACT_WASM = '../target/ink/ztg_runtime_example/ztg_runtime_example.wasm';
  const EXAMPLE_CONTRACT_META = '../target/ink/ztg_runtime_example/ztg_runtime_example.json';

  const startFreshNode = () => {
    const nodeProcess = spawn(
      PATH_TO_NODE,
      ['--tmp', `--chain=${PATH_TO_CUSTOM_SPEC}`, '--alice', '--validator'],
      {
        stdio: 'inherit', // To show node output in the console
      });

    console.log(`Node started with PID: ${nodeProcess.pid}`);
    return nodeProcess;
  };

  async function deployTestContract() {
    // Connect to the local Zeitgeist node
    const provider = new WsProvider(ZEITGEIST_WS_ENDPOINT);
    const api = await ApiPromise.create({ provider });

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
    await code.tx.new(
      { storageDepositLimit: null, gasLimit: w2 },
      0 /* Constructor index [there is only 1, so 0]*/,
      /* Constructor arguments [there should be none] */
    )
      .signAndSend(SUDO, (result) => {
        console.log(`Deployment status is ${result.status}`);

        if (result.status.isInBlock) {
          console.log(`Transaction included at blockHash ${result.status.asInBlock}`);
        } else if (result.status.isFinalized) {
          console.log(`Transaction finalized at blockHash ${result.status.asFinalized}`);
          process.exit(0);
        }
      });
  }

  deployTestContract();
});





// setSudoKey().catch(console.error);
