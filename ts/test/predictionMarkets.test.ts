import { expect } from 'chai';
import { createGas, deployTestContract, getAPI, maxWeight2, setSudoKey, startNode, sudo, waitBlocks } from '../utils.js';
import { ChildProcess } from 'child_process';
import { ApiPromise, Keyring, WsProvider } from '@polkadot/api';
import { ContractPromise } from '@polkadot/api-contract';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { CreateMarketParams, MetadataStorage, RpcContext, Sdk, ZTG, create, createStorage } from "@zeitgeistpm/sdk";
import { Memory } from "@zeitgeistpm/web3.storage";
import { KeyringPair } from '@polkadot/keyring/types.js';
import { Decimal } from 'decimal.js'
import { CourtInfo } from './court.test.js';

describe('zrml-prediction-markets Runtime Calls', function () {
  let api: ApiPromise;
  let zeitgeistSDK: Sdk<RpcContext<MetadataStorage>, MetadataStorage>;
  let contract: ContractPromise;
  let process: ChildProcess;

  this.beforeAll(async function () {
    process = startNode();
    await cryptoWaitReady();
    ({ api } = await getAPI());
    contract = await deployTestContract(api);

    // Initialize Zeitgeist SDK for local
    zeitgeistSDK = await create({
      provider: ['ws://127.0.0.1:9944'],
      storage: createStorage(Memory.storage())
    });
  });

  this.afterAll(async function () {
    await api.disconnect();
    process.kill('SIGTERM');
  });

  async function createCategoricalMarket(signer: KeyringPair, api: ApiPromise, oracle: string, disputeMechanism: "Authorized" | "Court" = "Authorized") {
    const params: CreateMarketParams<typeof zeitgeistSDK> = {
      baseAsset: { Ztg: null },
      signer,
      disputeMechanism,
      marketType: { Categorical: 2 },
      oracle,
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
    return marketID;
  }

  // @note: admin_move_market_to_closed can only be called as SUDO
  it.skip('Should move a market to closed as admin', async function () { });

  // @note: admin_move_market_to_resolved can only be called as SUDO
  it.skip('Should move a market to resolved as admin', async function () { });

  // @note: approve_market can only be called as SUDO
  it.skip('Should approve a market', async function () { });

  // @note: request_edit can only be called as SUDO
  it.skip('Should request an edit', async function () { });

  it('Should buy a complete set', async function () {
    const SUDO = sudo();
    const marketID = await createCategoricalMarket(SUDO, api, SUDO.address.toString());

    // Send cash to contract
    const transfer = api.tx.balances.transfer(contract.address, 5_000_000_000_000n);
    await transfer.signAndSend(new Keyring({ type: 'sr25519' }).addFromUri('//Alice'));
    await waitBlocks(api, 2);

    // Smart contract purchases set
    let foundEvent = false;
    const { gasRequired } = await contract.query.buyCompleteSet(
      SUDO.address, maxWeight2(api), marketID, "10000000000"
    );
    await new Promise(async (resolve, _) => {
      await contract.tx
        .buyCompleteSet(createGas(api, gasRequired), marketID, "10000000000")
        .signAndSend(sudo(), async (res) => {
          if (res.status.isInBlock) {
            res.events.forEach(({ event: { data, method, section } }) => {
              if (section === 'predictionMarkets' && method === 'BoughtCompleteSet') {
                foundEvent = true;
              }
            });
            resolve(null);
          }
        });
    });

    expect(foundEvent).to.be.true;
  });

  // create market -> sudo admin market close -> report -> dispute
  it('Should be able to dispute a reported market', async function () {
    // Creates a market where the oracle is the contract
    const SUDO = sudo();
    const marketID = await createCategoricalMarket(SUDO, api, SUDO.address.toString());

    // Sudo closes the market
    const adminMoveMarketToClosedCall = api.tx.predictionMarkets.adminMoveMarketToClosed(marketID);
    const sudoTx = api.tx.sudo.sudo(adminMoveMarketToClosedCall);
    await sudoTx.signAndSend(SUDO);
    await waitBlocks(api, 2);

    // Sudo reports the market
    const reportTx = api.tx.predictionMarkets.report(marketID, { Categorical: 1 });
    await reportTx.signAndSend(SUDO);

    // Gives contract DEV to reserve during dispute
    const transfer = api.tx.balances.transfer(contract.address, 5_000_000_000_000n);
    await transfer.signAndSend(new Keyring({ type: 'sr25519' }).addFromUri('//Alice'));
    await waitBlocks(api, 2);

    // Smart contract disputes the market
    let foundEvent = false;
    const { gasRequired } = await contract.query.dispute(SUDO.address, maxWeight2(api), marketID);
    await new Promise(async (resolve, _) => {
      await contract.tx
        .dispute(createGas(api, gasRequired), marketID)
        .signAndSend(sudo(), async (res) => {
          if (res.status.isInBlock) {
            res.events.forEach(({ event: { data, method, section } }) => {
              if (section === 'predictionMarkets' && method === 'MarketDisputed') {
                foundEvent = true;
              }
            });
            resolve(null);
          }
        });
    });

    expect(foundEvent).to.be.true;
  });

  async function contractCreateMarket(advised = false) {
    const SUDO = sudo();

    // Gives contract DEV to bond during market creation
    const transfer = api.tx.balances.transfer(contract.address, 5_000_000_000_000n);
    await transfer.signAndSend(new Keyring({ type: 'sr25519' }).addFromUri('//Alice'));
    await waitBlocks(api, 2);

    // Create market
    let foundEvent = false, marketId = '';
    const creationParams = [
      { Ztg: {} },
      0,
      SUDO.address,
      { Timestamp: [Date.now(), Date.now() + 100_000_000] },
      {
        disputeDuration: 5000,
        gracePeriod: 0,
        oracleDuration: 500,
      },
      (() => {
        const arr = new Uint8Array(50).fill(0);
        arr[0] = 0x15;
        arr[1] = 0x30;
        return { Sha3_384: arr.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '0x') };
      })(),
      advised ? { Advised: {} } : { Permissionless: {} },
      { Categorical: 2 },
      { Court: {} },
      // { Lmsr: {} }
      'Lmsr'
    ];

    const { gasRequired } = await contract.query.createMarket(SUDO.address, maxWeight2(api), ...creationParams);
    await new Promise(async (resolve, _) => {
      await contract.tx
        .createMarket(createGas(api, gasRequired), ...creationParams)
        .signAndSend(sudo(), async (res) => {
          if (res.status.isInBlock) {
            res.events.forEach(({ event: { data, method, section } }) => {
              if (section === 'predictionMarkets' && method === 'MarketCreated') {
                foundEvent = true;

                // TODO: assert that the data is the same
                marketId = (data.toJSON() as any)[0];
              }
            });
            resolve(null);
          }
        });
    });

    expect(foundEvent).to.be.true;

    return marketId;
  }

  it('Should be able to create a market', async function () {
    await contractCreateMarket();
  });

  // create market -> sudo request edit -> edit market
  it('Should be able to edit a market', async function () {
    // Create Advised market
    const marketID = await contractCreateMarket(true);

    // Sudo request edit
    const SUDO = sudo();
    const adminMoveMarketToClosedCall = api.tx.predictionMarkets.requestEdit(marketID, '0x0123456789');
    const sudoTx = api.tx.sudo.sudo(adminMoveMarketToClosedCall);
    await sudoTx.signAndSend(SUDO);
    await waitBlocks(api, 2);

    // Edit market
    let foundEvent = false;
    const editParams = [
      { Ztg: {} },
      marketID,
      SUDO.address,
      { Timestamp: [Date.now(), Date.now() + 100_000_000] },
      {
        disputeDuration: 5000,
        gracePeriod: 0,
        oracleDuration: 500,
      },
      (() => {
        const arr = new Uint8Array(50).fill(0);
        arr[0] = 0x15;
        arr[1] = 0x30;
        return { Sha3_384: arr.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '0x') };
      })(),
      { Categorical: 5 },
      { Court: {} },
      'Lmsr'
    ];

    const { gasRequired } = await contract.query.editMarket(SUDO.address, maxWeight2(api), ...editParams);
    await new Promise(async (resolve, _) => {
      await contract.tx
        .editMarket(createGas(api, gasRequired), ...editParams)
        .signAndSend(sudo(), async (res) => {
          if (res.status.isInBlock) {
            res.events.forEach(({ event: { data, method, section } }) => {
              if (section === 'predictionMarkets' && method === 'MarketEdited') {
                foundEvent = true;
              }
            });
            resolve(null);
          }
        });
    });

    expect(foundEvent).to.be.true;
  });

  // create market -> contract buy shares -> sudo admin market close -> report -> sudo admin market resolved -> redeem
  it('Should be able to redeem shares', async function () {
    // Creates a market where the oracle is the contract
    const SUDO = sudo();
    const marketID = await createCategoricalMarket(SUDO, api, SUDO.address.toString());

    // Send cash to contract
    const transfer = api.tx.balances.transfer(contract.address, 5_000_000_000_000n);
    await transfer.signAndSend(new Keyring({ type: 'sr25519' }).addFromUri('//Alice'));
    await waitBlocks(api, 2);

    // Smart contract purchases set
    {
      const { gasRequired } = await contract.query.buyCompleteSet(
        SUDO.address, maxWeight2(api), marketID, "10000000000"
      );
      await new Promise(async (resolve, _) => {
        await contract.tx
          .buyCompleteSet(createGas(api, gasRequired), marketID, "10000000000")
          .signAndSend(sudo(), async (res) => {
            if (res.status.isInBlock) resolve(null);
          });
      });
    }

    // Sudo closes the market
    const adminMoveMarketToClosedCall = api.tx.predictionMarkets.adminMoveMarketToClosed(marketID);
    const sudoTx = api.tx.sudo.sudo(adminMoveMarketToClosedCall);
    await sudoTx.signAndSend(SUDO);
    await waitBlocks(api, 2);

    // Sudo reports market
    const reportCall = api.tx.predictionMarkets.report(marketID, { Categorical: 1 });
    await reportCall.signAndSend(SUDO);
    await waitBlocks(api, 2);

    // Sudo resolves the market
    const adminMoveMarketToResolvedCall = api.tx.predictionMarkets.adminMoveMarketToResolved(marketID);
    const resolvedTx = api.tx.sudo.sudo(adminMoveMarketToResolvedCall);
    await resolvedTx.signAndSend(SUDO);
    await waitBlocks(api, 2);

    // Contract redeems
    let foundEvent = false;
    const { gasRequired } = await contract.query.redeemShares(SUDO.address, maxWeight2(api), marketID);
    await new Promise(async (resolve, _) => {
      await contract.tx
        .redeemShares(createGas(api, gasRequired), marketID)
        .signAndSend(sudo(), async (res) => {
          if (res.status.isInBlock) {
            res.events.forEach(({ event: { data, method, section } }) => {
              if (section === 'predictionMarkets' && method === 'TokensRedeemed') {
                foundEvent = true;
              }
            });
            resolve(null);
          }
        });
    });

    expect(foundEvent).to.be.true;
  });

  // @note: reject_market can only be called as SUDO
  it.skip('Should be able to reject a market', async function () { });

  // create market -> sudo admin market close -> report
  it('Should be able to report a market result', async function () {
    // Creates a market where the oracle is the contract
    const SUDO = sudo();
    const marketID = await createCategoricalMarket(SUDO, api, contract.address.toString());

    // Sudo closes the market
    const adminMoveMarketToClosedCall = api.tx.predictionMarkets.adminMoveMarketToClosed(marketID);
    const sudoTx = api.tx.sudo.sudo(adminMoveMarketToClosedCall);
    await sudoTx.signAndSend(SUDO);
    await waitBlocks(api, 2);

    // Smart contract disputes the market
    let foundEvent = false;
    const { gasRequired } = await contract.query.report(SUDO.address, maxWeight2(api), marketID, { Categorical: 1 });
    await new Promise(async (resolve, _) => {
      await contract.tx
        .report(createGas(api, gasRequired), marketID, { Categorical: 1 })
        .signAndSend(sudo(), async (res) => {
          if (res.status.isInBlock) {
            res.events.forEach(({ event: { data, method, section } }) => {
              if (section === 'predictionMarkets' && method === 'MarketReported') {
                foundEvent = true;
              }
            });
            resolve(null);
          }
        });
    });

    expect(foundEvent).to.be.true;
  });

  // create market -> sudo admin market close -> sudo report -> sudo dispute -> global dispute
  it('Should be able to start a global dispute', async function () {
    // Creates a market with Court dispute
    const SUDO = sudo();
    const marketID = await createCategoricalMarket(SUDO, api, SUDO.address.toString(), "Court");

    // Sudo joins court with a lot of cash
    const joinCourtTx = api.tx.court.joinCourt("100000000000000000000")
    await joinCourtTx.signAndSend(SUDO);
    await waitBlocks(api, 2);

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

    // Get court ID
    const courtID = (await api.query.court.marketIdToCourtId(marketID)).unwrap().toString();

    // Set the appeals of the court to 4, which is the max
    // https://github.com/zeitgeistpm/zeitgeist/blob/597257601e099912157529d5a6055cc71e6f9b86/runtime/zeitgeist/src/parameters.rs#L164
    const appealItem = {
      backer: SUDO.address.toString(),
      bond: 100000,
      appealedVoteItem: { Outcome: { Categorical: 0 } }
    };
    const courtInfoJSON: CourtInfo = (await api.query.court.courts(courtID)).toJSON() as CourtInfo;
    const courtInfoKey = api.query.court.courts.key(courtID);
    courtInfoJSON.appeals = [appealItem, appealItem, appealItem, appealItem];
    const encodedData = api.createType('ZrmlCourtCourtInfo', courtInfoJSON);
    const keyValue = api.createType('(StorageKey, StorageData)', [courtInfoKey, encodedData.toHex()]);
    const sudoCourtTx = api.tx.sudo.sudo(api.tx.system.setStorage([keyValue]));
    await new Promise(async (resolve) => {
      await sudoCourtTx.signAndSend(SUDO, ({ status }) => {
        if (status.isInBlock || status.isFinalized) resolve(null);
      });
    });
    await waitBlocks(api, 2);

    // Smart contract starts global dispute
    let foundEvent = false;
    const { gasRequired } = await contract.query.startGlobalDispute(SUDO.address, maxWeight2(api), marketID);
    await new Promise(async (resolve, _) => {
      await contract.tx
        .startGlobalDispute(createGas(api, gasRequired), marketID)
        .signAndSend(sudo(), async (res) => {
          if (res.status.isInBlock) {
            res.events.forEach(({ event: { data, method, section } }) => {
              if (section === 'predictionMarkets' && method === 'GlobalDisputeStarted') {
                foundEvent = true;
              }
            });
            resolve(null);
          }
        });
    });

    expect(foundEvent).to.be.true;
  });

  it('Should sell a complete set', async function () {
    const SUDO = sudo();
    const marketID = await createCategoricalMarket(SUDO, api, SUDO.address.toString());

    // Send cash to contract
    const transfer = api.tx.balances.transfer(contract.address, 5_000_000_000_000n);
    await transfer.signAndSend(new Keyring({ type: 'sr25519' }).addFromUri('//Alice'));
    await waitBlocks(api, 2);

    // Smart contract purchases set
    {
      let foundEvent = false;
      const { gasRequired } = await contract.query.buyCompleteSet(
        SUDO.address, maxWeight2(api), marketID, "10000000000"
      );
      await new Promise(async (resolve, _) => {
        await contract.tx
          .buyCompleteSet(createGas(api, gasRequired), marketID, "10000000000")
          .signAndSend(sudo(), async (res) => {
            if (res.status.isInBlock) {
              res.events.forEach(({ event: { data, method, section } }) => {
                if (section === 'predictionMarkets' && method === 'BoughtCompleteSet') {
                  foundEvent = true;
                }
              });
              resolve(null);
            }
          });
      });

      expect(foundEvent).to.be.true;
    }

    // Smart contract sells set
    {
      let foundEvent = false;
      const { gasRequired } = await contract.query.sellCompleteSet(
        SUDO.address, maxWeight2(api), marketID, "10000000000"
      );
      await new Promise(async (resolve, _) => {
        await contract.tx
          .sellCompleteSet(createGas(api, gasRequired), marketID, "10000000000")
          .signAndSend(sudo(), async (res) => {
            if (res.status.isInBlock) {
              res.events.forEach(({ event: { data, method, section } }) => {
                if (section === 'predictionMarkets' && method === 'SoldCompleteSet') {
                  foundEvent = true;
                }
              });
              resolve(null);
            }
          });
      });

      expect(foundEvent).to.be.true;
    }
  });

  it('Should be able to create a market and deploy a pool', async function () {
    const SUDO = sudo();

    // Gives contract DEV to bond during market creation
    const transfer = api.tx.balances.transfer(contract.address, ZTG.mul(500).toString());
    await transfer.signAndSend(new Keyring({ type: 'sr25519' }).addFromUri('//Alice'));
    await waitBlocks(api, 2);

    // Create market
    let foundEvent = false, marketId = '';
    const creationParams = [
      { Ztg: {} },
      0,
      SUDO.address,
      { Timestamp: [Date.now(), Date.now() + 100_000_000] },
      {
        disputeDuration: 5000,
        gracePeriod: 0,
        oracleDuration: 500,
      },
      (() => {
        const arr = new Uint8Array(50).fill(0);
        arr[0] = 0x15;
        arr[1] = 0x30;
        return { Sha3_384: arr.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '0x') };
      })(),
      { Categorical: 2 },
      { Court: {} },
      ZTG.mul(300).toString(),
      [
        new Decimal(0.5).mul(ZTG).toString(), // yes will have 50% prediction,
        new Decimal(0.5).mul(ZTG).toString(), // no will have 50% prediction,
      ],
      "100000000"
    ];

    const { gasRequired } = await contract.query.createMarketAndDeployPool(
      SUDO.address, maxWeight2(api), ...creationParams
    );
    await new Promise(async (resolve, _) => {
      await contract.tx
        .createMarketAndDeployPool(createGas(api, gasRequired), ...creationParams)
        .signAndSend(sudo(), async (res) => {
          if (res.status.isInBlock) {
            res.events.forEach(({ event: { data, method, section } }) => {
              if (section === 'neoSwaps' && method === 'PoolDeployed') {
                foundEvent = true;
              }
            });
            resolve(null);
          }
        });
    });

    expect(foundEvent).to.be.true;
  });

  it('Should be able to schedule an early close', async function () {
    const marketId = await contractCreateMarket();
    await waitBlocks(api, 2);

    const SUDO = sudo();

    // Send cash to contract for reserving
    const transfer = api.tx.balances.transfer(contract.address, 5_000_000_000_000n);
    await transfer.signAndSend(new Keyring({ type: 'sr25519' }).addFromUri('//Alice'));
    await waitBlocks(api, 2);

    // Let contract schedule an early
    let foundEvent = false;
    const { gasRequired } = await contract.query.scheduleEarlyClose(SUDO.address, maxWeight2(api), marketId);
    await new Promise(async (resolve, _) => {
      await contract.tx
        .scheduleEarlyClose(createGas(api, gasRequired), marketId)
        .signAndSend(sudo(), async (res) => {
          if (res.status.isInBlock) {
            res.events.forEach(({ event: { data, method, section } }) => {
              if (section === 'predictionMarkets' && method === 'MarketEarlyCloseScheduled') {
                foundEvent = true;
              }
            });
            resolve(null);
          }
        });
    });

    expect(foundEvent).to.be.true;
  });

  it('Should be able to dispute an early close', async function () {
    const SUDO = sudo();
    const marketId = await createCategoricalMarket(SUDO, api, SUDO.address.toString());

    // Schedule an early close
    const scheduleEarlyCloseTx = api.tx.predictionMarkets.scheduleEarlyClose(marketId);
    await scheduleEarlyCloseTx.signAndSend(SUDO);
    await waitBlocks(api, 2);

    // Send cash to contract for reserving
    const transfer = api.tx.balances.transfer(contract.address, 5_000_000_000_000n);
    await transfer.signAndSend(new Keyring({ type: 'sr25519' }).addFromUri('//Alice'));
    await waitBlocks(api, 2);

    // Contract disputes close
    let foundEvent = false;
    const { gasRequired } = await contract.query.disputeEarlyClose(SUDO.address, maxWeight2(api), marketId);
    await new Promise(async (resolve, _) => {
      await contract.tx
        .disputeEarlyClose(createGas(api, gasRequired), marketId)
        .signAndSend(sudo(), async (res) => {
          if (res.status.isInBlock) {
            res.events.forEach(({ event: { data, method, section } }) => {
              if (section === 'predictionMarkets' && method === 'MarketEarlyCloseDisputed') {
                foundEvent = true;
              }
            });
            resolve(null);
          }
        });
    });

    expect(foundEvent).to.be.true;
  });

  // @note: reject_early_close can only be called as SUDO or as an Advisory Committee
  it.skip('Should be able to reject an early close', async function () { });

  // @note: close_trusted_market can only be called as SUDO or as an Advisory Committee
  it.skip('Should be able to close a trusted market', async function () { });

  it('Should be able to manually close a market', async function () {
    // Create market
    const SUDO = sudo();
    const marketID = await createCategoricalMarket(SUDO, api, SUDO.address.toString());

    // Set current timestamp to what will be the past by the end of this test
    const timestamp = parseInt((await api.query.timestamp.now()).toString());

    // Use SUDO to edit storage to set market's period to what will be the past
    {
      // Get market data & its storage key
      const marketData = await api.query.marketCommons.markets(marketID);
      const marketDataJSON: MarketData = marketData.toJSON() as unknown as MarketData;
      const marketStorageKey = api.query.marketCommons.markets.key(marketID);

      // Edit data
      if (marketDataJSON.period.timestamp) {
        marketDataJSON.period.timestamp = [timestamp, timestamp];
      }

      // Insert data via SUDO
      const encodedData = api.createType('ZeitgeistPrimitivesMarket', marketDataJSON);
      const keyValue = api.createType('(StorageKey, StorageData)', [marketStorageKey, encodedData.toHex()]);
      const sudoTx = api.tx.sudo.sudo(
        api.tx.system.setStorage([keyValue])
      );
      await new Promise(async resolve => {
        await sudoTx.signAndSend(SUDO, ({ status }) => {
          if (status.isInBlock || status.isFinalized) {
            console.log(`Transaction included in block with status: ${status.type}`);
            resolve(null);
          }
        });
      });
      await waitBlocks(api, 2);
    }

    // Use SUDO to edit storage to add marketID in time frame map
    {
      // Use SUDO to insert into predictionMarkets.marketIdsPerCloseTimeFrame
      // NOTE: assumes that the MILLISECS_PER_BLOCK in calculate_time_frame_of_moment is 12000
      // https://github.com/zeitgeistpm/zeitgeist/blob/4d3519c31b52e89dcbff2f992fdc478cc7a3f054/zrml/prediction-markets/src/lib.rs#L2366-L2368
      const blockForFakeScheduledClose = (timestamp / 12000).toFixed(0);
      console.log("Block for scheduled close:", blockForFakeScheduledClose);

      // Get marketIdsPerCloseTimeFrame storage key
      const timeFramesStorageKey = api.query.predictionMarkets.marketIdsPerCloseTimeFrame.key(blockForFakeScheduledClose);
      const timeFrameWithMarketId = [marketID];

      const encodedData = api.createType('Vec<u128>', timeFrameWithMarketId);
      const keyValue = api.createType('(StorageKey, StorageData)', [timeFramesStorageKey, encodedData.toHex()]);
      const sudoTx = api.tx.sudo.sudo(
        api.tx.system.setStorage([keyValue])
      );
      await new Promise(async resolve => {
        await sudoTx.signAndSend(SUDO, ({ status }) => {
          if (status.isInBlock || status.isFinalized) {
            console.log(`Transaction included in block with status: ${status.type}`);
            resolve(null);
          }
        });
      });
      await waitBlocks(api, 2);
    }

    // Manually close market, it should be the past after waiting ~2 blocks
    let foundEvent = false;
    const { gasRequired } = await contract.query.manuallyCloseMarket(SUDO.address, maxWeight2(api), marketID);
    await new Promise(async (resolve, _) => {
      await contract.tx
        .manuallyCloseMarket(createGas(api, gasRequired), marketID)
        .signAndSend(sudo(), async (res) => {
          if (res.status.isInBlock) {
            res.events.forEach(({ event: { data, method, section } }) => {
              if (section === 'predictionMarkets' && method === 'MarketClosed') {
                foundEvent = true;
              }
            });
            resolve(null);
          }
        });
    });

    expect(foundEvent).to.be.true;
  });
});

interface MarketData {
  period: {
    timestamp?: [number, number];
    // Other fields...
  };
  // Other fields...
}
