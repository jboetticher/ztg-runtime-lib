import { expect } from 'chai';
import { createGas, deployTestContract, getAPI, maxWeight2, setSudoKey, startNode, sudo } from '../utils.js';
import { ChildProcessWithoutNullStreams } from 'child_process';
import { ApiPromise, Keyring } from '@polkadot/api';
import { ContractPromise } from '@polkadot/api-contract';
import { cryptoWaitReady } from '@polkadot/util-crypto';

describe.skip('court-styx Runtime Calls', function () {
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

  it('Should join court', async function() {
    let foundCrossEvent = false;
    const SUDO = sudo();

    // Gives contract DEV to burn during cross
    const transfer = api.tx.balances.transfer(contract.address, 500000000000000n);
    await transfer.signAndSend(new Keyring({ type: 'sr25519' }).addFromUri('//Alice')); // todo wait for next block

    // TODO: query min from constants

    // Initiates cross
    const { gasRequired } = await contract.query.joinPool(SUDO.address, maxWeight2(api), 500000000000000n);
    await new Promise(async (resolve, _) => {
      await contract.tx
        .cross(createGas(api, gasRequired), 500000000000000n)
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
});
