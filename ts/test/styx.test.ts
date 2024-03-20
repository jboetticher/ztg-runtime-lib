import { expect } from 'chai';
import { createGas, deployTestContract, getAPI, maxWeight2, setSudoKey, startNode, sudo, waitBlocks } from '../utils.js';
import { ChildProcess } from 'child_process';
import { ApiPromise, Keyring } from '@polkadot/api';
import { ContractPromise } from '@polkadot/api-contract';
import { cryptoWaitReady } from '@polkadot/util-crypto';

describe('zrml-styx Runtime Calls', function () {
  let api: ApiPromise;
  let contract: ContractPromise;
  let process: ChildProcess;

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

  it('Should cross', async function() {
    let foundCrossEvent = false;
    const SUDO = sudo();

    // Gives contract DEV to burn during cross
    const burnAmount = await api.query.styx.burnAmount();
    const transfer = api.tx.balances.transfer(contract.address, burnAmount);
    await transfer.signAndSend(new Keyring({ type: 'sr25519' }).addFromUri('//Alice'));
    await waitBlocks(api, 2);

    // Initiates cross
    const { gasRequired } = await contract.query.cross(SUDO.address, maxWeight2(api));
    await new Promise(async (resolve, _) => {
      await contract.tx
        .cross(createGas(api, gasRequired))
        .signAndSend(sudo(), async (res) => {
          if (res.status.isInBlock) {
            res.events.forEach(({ event: { data, method, section } }) => {
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

  // NOTE: setBurnAmount can only be called with the sudo.sudo() extrinsic
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
});
