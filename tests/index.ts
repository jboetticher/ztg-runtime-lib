import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { CodePromise, ContractPromise } from '@polkadot/api-contract';
import { WeightV2 } from '@polkadot/types/interfaces/runtime/types';
import { BN, BN_ONE } from '@polkadot/util';
import { spawn } from 'child_process';
import fs from "fs";

// Ensure WASM crypto is initialized
cryptoWaitReady().then(async () => {
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
  const PATH_TO_CUSTOM_SPEC = '/Users/jb/Desktop/polkadot/zeitgeist/customSpecRaw.json'; // TODO: turn into environment variable
  const ZEITGEIST_WS_ENDPOINT = 'ws://127.0.0.1:9944';

  // Some constants
  const MAX_CALL_WEIGHT = new BN(5_000_000_000_000).isub(BN_ONE);
  const PROOFSIZE = new BN(1_000_000);


  async function setSudoKey(newSudoAccount: string) {
    // Connect to the local Zeitgeist node
    const provider = new WsProvider(ZEITGEIST_WS_ENDPOINT);
    const api = await ApiPromise.create({ provider });

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

  /**
   * Deploys the ztg_runtime_example smart contract.
   * @returns A contract instance
   */
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

    // const address: string = await new Promise((resolve, reject) => {
    //   code.tx.new(
    //     { storageDepositLimit: null, gasLimit: w2 },
    //     0 /* Constructor index [there is only 1, so 0]*/,
    //     /* Constructor arguments [there should be none] */
    //   )
    //     .signAndSend(SUDO, (result) => {
    //       if (result.status.isFinalized) {
    //         // Loop through events to find the contract address
    //         result.events.forEach(({ event: { data, method, section } }) => {
    //           if (section === 'contracts' && method === 'Instantiated') {
    //             const [creator, contractAddress] = data;
    //             // console.log(`Transaction finalized at blockHash ${result.status.asFinalized}`);
    //             console.log(`Contract successfully deployed at address: ${contractAddress}`);
    //             resolve(contractAddress.toString());
    //           }
    //         });
    //       }

    //       if (result.isError) {
    //         reject("Error occured on deployment");
    //       }

    //       if (result.status.isInBlock) {
    //         console.log(`Transaction included at blockHash ${result.status.asInBlock}`);
    //       }
    //     });
    // });

    return new ContractPromise(api, metadata, 'dE21rXZeqGrotMWzgnS1TSn8vUKJ6qggPQ9SdqgJEBq6RNSVu');
  }

  const contract = await deployTestContract();
  console.log('contract addr:', contract.address.toHuman())
  const provider = new WsProvider(ZEITGEIST_WS_ENDPOINT);
  const api = await ApiPromise.create({ provider });
  const { gasConsumed, result, output } = await contract.query.getOutcome(
    SUDO.address,
    {
      gasLimit: api?.registry.createType('WeightV2', {
        refTime: MAX_CALL_WEIGHT,
        proofSize: PROOFSIZE,
      }) as WeightV2,
      storageDepositLimit: null
    }
  );
  console.log('Result:', result.toHuman());
  console.log('Output:', output?.toHuman())

  process.exit(0);
});





// setSudoKey().catch(console.error);
