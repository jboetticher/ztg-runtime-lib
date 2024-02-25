import { expect } from 'chai';
import { createGas, deployTestContract, getAPI, maxWeight2, sudo } from '../utils.js';
import { ApiPromise } from '@polkadot/api';
import { ContractPromise } from '@polkadot/api-contract';
import { cryptoWaitReady } from '@polkadot/util-crypto';

describe('Styx Runtime Calls', function () {
  let api: ApiPromise;
  let contract: ContractPromise;

  before(async function () {
    await cryptoWaitReady();
    // TODO: create instance of node
    ({ api } = await getAPI());
    contract = await deployTestContract();
  });

  after(async function () {
    await api.disconnect();
    // TODO: destroy node
  });

  it('should have a correct initial state', async function () {
    // Query for initial value
    let { result, output } = await contract.query.getOutcome(sudo().address, maxWeight2(api));
    expect(output?.toJSON()).to.not.be.null;
  });

  it('should change state correctly', async function () {
    // Query for initial value
    let { result, output } = await contract.query.getOutcome(sudo().address, maxWeight2(api));
    expect(output?.toJSON()).to.not.be.null;

    // Set value
    const { gasRequired } = await contract.query.setOutcomeToScalarFive(sudo().address, maxWeight2(api));
    await new Promise(async (resolve, _) => {
      await contract.tx
        .setOutcomeToScalarFive(createGas(api, gasRequired))
        .signAndSend(sudo(), async (res) => {
          if (res.status.isInBlock) {
            console.log('set_outcome_to_scalar_five in a block')
          } else if (res.status.isFinalized) {
            console.log('set_outcome_to_scalar_five finalized')
            resolve(null);
          }
        });
    });

    // Query value again
    ({ result, output } = await contract.query.getOutcome(sudo().address, maxWeight2(api)));
    expect(output?.toJSON()).to.not.be.null;
  });
});
