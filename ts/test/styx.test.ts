import { expect } from 'chai';
import { createGas, deployTestContract, getAPI, maxWeight2, setSudoKey, startNode, sudo } from '../utils.js';
import { ChildProcessWithoutNullStreams } from 'child_process';
import { ApiPromise, Keyring } from '@polkadot/api';
import { ContractPromise } from '@polkadot/api-contract';
import { cryptoWaitReady } from '@polkadot/util-crypto';

describe('zrml-styx Runtime Calls', function () {
  let api: ApiPromise;
  let contract: ContractPromise;
  let process: ChildProcessWithoutNullStreams;

  this.beforeAll(async function () {
    // process = startNode();
    await cryptoWaitReady();
    ({ api } = await getAPI());
    contract = await deployTestContract(api);
  });

  this.afterAll(async function () {
    await api.disconnect();
    // process.kill('SIGTERM');
  });

  it.only('Should cross', async function() {
    let foundCrossEvent = false;
    const SUDO = sudo();

    // Gives contract DEV to burn during cross
    const transfer = api.tx.balances.transfer(contract.address, 500000000000n);
    console.log('singing and sending')
    await transfer.signAndSend(new Keyring({ type: 'sr25519' }).addFromUri('//Alice')); // todo wait for next block

    console.log('signed and sent')

    // Initiates cross
    const { gasRequired } = await contract.query.cross(SUDO.address, maxWeight2(api));
    await new Promise(async (resolve, _) => {
      await contract.tx
        .cross(createGas(api, gasRequired))
        .signAndSend(sudo(), async (res) => {
          if (res.status.isInBlock) {
            res.events.forEach(({ event: { data, method, section } }) => {
              console.log('found event', method, section, data.toHuman());
              if (section === 'styx' && method === 'AccountCrossed') {
                foundCrossEvent = true;
              }
            });
            resolve(null);
          }
        });
    });

    expect(foundCrossEvent).to.be.true;
  });

  // setBurnAmount can only be called with the sudo.sudo() extrinsic, so this call runtime
  // will never be used unless the code changes
  it.skip('Should set global burn amount', async function() {
    let foundFeeChangeEvent = false;

    // Set contract as sudo so that it can set the global value
    await setSudoKey(contract.address.toString());

    const { gasRequired } = await contract.query.setBurnAmount(
      sudo().address, maxWeight2(api), 888888888888888n
    );
    await new Promise(async (resolve, _) => {
      await contract.tx
        .cross(createGas(api, gasRequired))
        .signAndSend(sudo(), async (res) => {
          if (res.status.isInBlock) {
            res.events.forEach(({ event: { data, method, section } }) => {
              if (section === 'styx' && method === 'CrossingFeeChanged') {
                foundFeeChangeEvent = true;
              }
            });
            resolve(null);
          }
        });
    });

    expect(foundFeeChangeEvent).to.be.true;
  });

  // A sample test to show how to interact with the smart contract
  it('should set outcome to scalar five correctly', async function () {
    // Query for initial value
    let { result, output } = await contract.query.getOutcome(sudo().address, maxWeight2(api));
    let outcome = output?.toJSON() as { ok: { categorical?: number, scalar?: number } };
    expect(outcome.ok.categorical).to.equal(0);

    // Set value
    const { gasRequired } = await contract.query.setOutcomeToScalarFive(sudo().address, maxWeight2(api));
    await new Promise(async (resolve, _) => {
      await contract.tx
        .setOutcomeToScalarFive(createGas(api, gasRequired))
        .signAndSend(sudo(), async (res) => {
          if (res.status.isInBlock) {
            console.log('set_outcome_to_scalar_five in a block')
            resolve(null);
          }
        });
    });

    // Query value again
    ({ result, output } = await contract.query.getOutcome(sudo().address, maxWeight2(api)));
    outcome = output?.toJSON() as { ok: { categorical?: number, scalar?: number } };
    expect(outcome.ok.scalar).to.equal(5);
  });
});
