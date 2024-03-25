import { expect } from 'chai';
import { createGas, deployTestContract, generateRandomAddress, getAPI, maxWeight2, setSudoKey, startNode, sudo, waitBlocks } from '../utils.js';
import { ChildProcess } from 'child_process';
import { ApiPromise, Keyring } from '@polkadot/api';
import { ContractPromise } from '@polkadot/api-contract';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { CreateMarketParams, MetadataStorage, RpcContext, Sdk, ZTG, create, createStorage } from "@zeitgeistpm/sdk";
import { Memory } from "@zeitgeistpm/web3.storage";
import { KeyringPair } from '@polkadot/keyring/types.js';
import { Decimal } from 'decimal.js'

describe('zrml-court Runtime Calls', function () {
  let api: ApiPromise;
  let contract: ContractPromise;
  let process: ChildProcess;
  let zeitgeistSDK: Sdk<RpcContext<MetadataStorage>, MetadataStorage>;

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

    // Gives the contract a lot of DEV
    const transfer = api.tx.balances.transfer(contract.address, "500000000000000000");
    await transfer.signAndSend(new Keyring({ type: 'sr25519' }).addFromUri('//Alice'));
    await waitBlocks(api, 2);

    // Initialize Zeitgeist SDK for local
    zeitgeistSDK = await create({
      provider: ['ws://127.0.0.1:9944'],
      storage: createStorage(Memory.storage())
    });

    // Make alice join the pool with a lot of cash
    const joinCourt = api.tx.court.joinCourt("500000000000000000");
    await transfer.signAndSend(new Keyring({ type: 'sr25519' }).addFromUri('//Alice'));
    await waitBlocks(api, 2);
  });

  this.afterAll(async function () {
    await api.disconnect();
    // process.kill('SIGTERM');
  });

  it('Should join court', async function () {
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

  // create -> close -> report -> dispute
  async function createCourt() {
    const SUDO = sudo();

    const params: CreateMarketParams<typeof zeitgeistSDK> = {
      baseAsset: { Ztg: null },
      signer: SUDO,
      disputeMechanism: "Court",
      marketType: { Categorical: 2 },
      oracle: SUDO.address,
      period: { Timestamp: [Date.now(), Date.now() + 60 * 60 * 24 * 1000 * 2] },
      deadlines: {
        disputeDuration: 5000,
        gracePeriod: 0, // NOTE: grace period is 0 so that dispute & report can happen rapidly
        oracleDuration: 500,
      },
      metadata: {
        __meta: "markets",
        question: "Will the example work?",
        description: "Testing the sdk.",
        slug: "standalone-market-example",
        categories: [
          { name: "yes", ticker: "Y" },
          { name: "no", ticker: "N" },
        ],
        tags: ["dev"],
      },
      scoringRule: "Lmsr",
      creationType: "Permissionless"
    };
    const response = await zeitgeistSDK.model.markets.create(params);
    const marketCreatedEvent = response.raw.events.find(x => x.event.toHuman()['method'] === 'MarketCreated');
    const marketID = (marketCreatedEvent?.event?.toHuman()['data'] as any[])[0];
    await waitBlocks(api, 1);

    // Sudo closes the market
    const adminMoveMarketToClosedCall = api.tx.predictionMarkets.adminMoveMarketToClosed(marketID);
    const sudoTx = api.tx.sudo.sudo(adminMoveMarketToClosedCall);
    await sudoTx.signAndSend(SUDO);
    await waitBlocks(api, 2);

    // Sudo reports the market
    const reportTx = api.tx.predictionMarkets.report(marketID, { Categorical: 1 });
    await reportTx.signAndSend(SUDO);
    await waitBlocks(api, 2);

    // Sudo disputes the market
    const disputeTx = api.tx.predictionMarkets.dispute(marketID);
    await disputeTx.signAndSend(SUDO);
    await waitBlocks(api, 2);

    // TODO: get over NotInVotingPeriod

    return marketID;
  }

  // TODO: how do we get a court ID?
  it('Should vote', async function () {
    await createCourt();
  });

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
  it.skip('Should exit court', async function () {
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
