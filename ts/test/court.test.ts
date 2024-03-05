import { expect } from 'chai';
import { createGas, deployTestContract, generateRandomAddress, getAPI, maxWeight2, setSudoKey, startNode, sudo, waitBlocks } from '../utils.js';
import { ChildProcessWithoutNullStreams } from 'child_process';
import { ApiPromise, Keyring } from '@polkadot/api';
import { ContractPromise } from '@polkadot/api-contract';
import { cryptoWaitReady } from '@polkadot/util-crypto';

describe.only('court-styx Runtime Calls', function () {
  let api: ApiPromise;
  let contract: ContractPromise;
  let process: ChildProcessWithoutNullStreams;

  /* 
  NOTE:
  For effifiency, this entire file uses a single node & contract, instead of refreshing the node for 
  each test). This means that some of the tests require other tests to occur before it to run properly.

  This would have to happen anyways, since a contract would have to be able to join a court before
  testing its own removal.

  Most importantly, joining a court should occur first, and the steps to removing a contract from the
  court should occur last.
  */
  this.beforeAll(async function () {
    // process = startNode();
    await cryptoWaitReady();
    ({ api } = await getAPI());
    contract = await deployTestContract(api);

    // Gives contract a lot of DEV to burn during cross
    const transfer = api.tx.balances.transfer(contract.address, 5_000_000_000_000_000);
    await transfer.signAndSend(new Keyring({ type: 'sr25519' }).addFromUri('//Alice'));
    await waitBlocks(api, 2);
    console.log('before all finished')
  });

  this.afterAll(async function () {
    await api.disconnect();
    // process.kill('SIGTERM');
  });

  it('Should join court', async function () {
    console.log('starting join court')
    let foundEvent = false;
    const SUDO = sudo();
    const JUROR_STAKE = 5_000_000_000_000n;

    // Initiates pool join (contract should already be funded)
    const { gasRequired } = await contract.query.joinCourt(SUDO.address, maxWeight2(api), JUROR_STAKE);
    await new Promise(async (resolve, _) => {
      await contract.tx
        .joinCourt(createGas(api, gasRequired), JUROR_STAKE)
        .signAndSend(sudo(), async (res) => {
          if (res.status.isInBlock) {
            res.events.forEach(({ event: { data, method, section } }) => {
              if (section === 'court' && method === 'JurorJoined') {
                foundEvent = true;
              }
            });
            resolve(null);
          }
        });
    });

    expect(foundEvent).to.be.true;
  });

  it('Should delegate', async function () {
    let foundEvent = false;
    const SUDO = sudo();
    const DELEGATION_AMOUNT = 5_000_000_000_000n;

    // Have Eve join court
    const eveAccount = new Keyring({ type: 'sr25519' }).addFromUri('//Eve');
    const joinDelegator = api.tx.court.joinCourt(DELEGATION_AMOUNT);
    await joinDelegator.signAndSend(eveAccount);
    await waitBlocks(api, 2);

    // Have the contract delegate to Eve (contract should already be funded)
    const { gasRequired } = await contract.query.delegate(
      SUDO.address, maxWeight2(api), DELEGATION_AMOUNT, [eveAccount.address]
    );
    await new Promise(async (resolve, _) => {
      await contract.tx
        .delegate(createGas(api, gasRequired), DELEGATION_AMOUNT, [eveAccount.address])
        .signAndSend(sudo(), async (res) => {
          if (res.status.isInBlock) {
            res.events.forEach(({ event: { data, method, section } }) => {
              if (section === 'court' && method === 'DelegatorJoined') {
                foundEvent = true;
              }
            });
            resolve(null);
          }
        });
    });

    expect(foundEvent).to.be.true;
  });

  // TODO: how do we get a court ID?
  it.skip('Should vote', async function () { });

  // TODO: how do we get a court ID?
  it.skip('Should denounce a vote', async function () { });

  // TODO: how do we get a court ID?
  it.skip('Should reveal a vote', async function () { });

  // TODO: how do we get a court ID?
  it.skip('Should appeal', async function () { });

  // TODO: how do we get a court ID?
  it.skip('Should reassign court stakes', async function () { });

  it('Should prepare to exit court', async function () {
    let foundEvent = false;
    const SUDO = sudo();

    // Have the contract delegate to Eve (contract should already be funded)
    const { gasRequired } = await contract.query.prepareExitCourt(SUDO.address, maxWeight2(api));
    await new Promise(async (resolve, _) => {
      await contract.tx
        .prepareExitCourt(createGas(api, gasRequired))
        .signAndSend(sudo(), async (res) => {
          if (res.status.isInBlock) {
            res.events.forEach(({ event: { data, method, section } }) => {
              if (section === 'court' && method === 'ExitPrepared') foundEvent = true;
            });
            resolve(null);
          }
        });
    });

    expect(foundEvent).to.be.true;
  });

  // NOTE: impossible to test without fast-forwarding the node 21k+ blocks, and the period is hard
  // coded so there is no way to change this within config settings.
  // TODO: use the chain state to add a delegate that's already ready to be removed
  it('Should exit court', async function () {
    let foundEvent = false;
    const SUDO = sudo();

    // Have the contract delegate to Eve (contract should already be funded)
    const { gasRequired } = await contract.query.prepareExitCourt(SUDO.address, maxWeight2(api));
    await new Promise(async (resolve, _) => {
      await contract.tx
        .prepareExitCourt(createGas(api, gasRequired))
        .signAndSend(sudo(), async (res) => {
          if (res.status.isInBlock) {
            res.events.forEach(({ event: { data, method, section } }) => {
              console.log(method, section, data.toHuman());
              if (section === 'court' && method === 'ExitPrepared') foundEvent = true;
            });
            resolve(null);
          }
        });
    });

    expect(foundEvent).to.be.true;
  });

  /// NOTE: setInflation cannot be called without SUDO, so it will never be called by this library
  it.skip('Should set court inflation', async function () { });
});
