import { expect } from 'chai';
import { createGas, deployTestContract, getAPI, maxWeight2, startNode, sudo } from '../utils.js';
import { ChildProcessWithoutNullStreams } from 'child_process';
import { ApiPromise } from '@polkadot/api';
import { ContractPromise } from '@polkadot/api-contract';
import { cryptoWaitReady } from '@polkadot/util-crypto';

describe('Styx Runtime Calls', function () {
  let api: ApiPromise;
  let contract: ContractPromise;
  let process: ChildProcessWithoutNullStreams;

  this.beforeAll(async function () {
    process = startNode();
    await cryptoWaitReady();
    ({ api } = await getAPI());
    contract = await deployTestContract(api);
  });

  this.afterAll(async function () {
    await api.disconnect();
    process.kill('SIGTERM');
  });

  

  // A sample test to show how to interact with the smart contract
  it('should change state correctly', async function () {
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
