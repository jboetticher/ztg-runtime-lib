import { expect } from 'chai';
import { createGas, deployTestContract, getAPI, maxWeight2, setSudoKey, startNode, sudo, waitBlocks } from '../utils.js';
import { ChildProcess } from 'child_process';
import { ApiPromise, Keyring, WsProvider } from '@polkadot/api';
import { ContractPromise } from '@polkadot/api-contract';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { CreateMarketParams, MetadataStorage, RpcContext, Sdk, ZTG, create, createStorage } from "@zeitgeistpm/sdk";
import { Memory } from "@zeitgeistpm/web3.storage";
import { KeyringPair } from '@polkadot/keyring/types.js';

describe('zrml-orderbook Runtime Calls', function () {
  let api: ApiPromise;
  let zeitgeistSDK: Sdk<RpcContext<MetadataStorage>, MetadataStorage>;
  let contract: ContractPromise;
  let process: ChildProcess;
  let orderbookMarketId: number;

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

    // Creates an orderbook market
    const SUDO = sudo();
    orderbookMarketId = await createOrderbookMarket(SUDO, api, SUDO.address.toString());

    // Send a lot of cash to contract
    const transfer = api.tx.balances.transfer(contract.address, 5_000_000_000_000_000_000n);
    await transfer.signAndSend(new Keyring({ type: 'sr25519' }).addFromUri('//Alice'));
    await waitBlocks(api, 2);
  });

  this.afterAll(async function () {
    await api.disconnect();
    process.kill('SIGTERM');
  });

  async function createOrderbookMarket(signer: KeyringPair, api: ApiPromise, oracle: string, disputeMechanism: "Authorized" | "Court" = "Authorized") {
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
      scoringRule: "Orderbook",
      creationType: "Permissionless"
    };
    const response = await zeitgeistSDK.model.markets.create(params);
    const marketCreatedEvent = response.raw.events.find(x => x.event.toHuman()['method'] === 'MarketCreated');
    const marketID = (marketCreatedEvent?.event?.toHuman()['data'] as any[])[0];
    await waitBlocks(api, 1);
    return marketID;
  }

  it('Should be able to place an order', async function () {
    const SUDO = sudo();

    const parameters = [
      orderbookMarketId,
      { Ztg: {} },
      "10000000000000000",
      { CategoricalOutcome: [orderbookMarketId, 1] },
      "50000000"
    ];

    // Places order
    let foundEvent = false;
    const { gasRequired } = await contract.query.placeOrder(SUDO.address, maxWeight2(api), ...parameters);
    await new Promise(async (resolve, _) => {
      await contract.tx
        .placeOrder(createGas(api, gasRequired), ...parameters)
        .signAndSend(sudo(), async (res) => {
          if (res.status.isInBlock) {
            res.events.forEach(({ event: { data, method, section } }) => {
              if (section === 'orderbook' && method === 'OrderPlaced') {
                foundEvent = true;
              }
            });
            resolve(null);
          }
        });
    });

    expect(foundEvent).to.be.true;
  });

  it('Should be able to fill a partial order', async function () {
    const SUDO = sudo();

    // SUDO places an order
    const orderAmount = "10000000000";
    const placeOrderCall = api.tx.orderbook.placeOrder(
      orderbookMarketId,
      { Ztg: {} },
      "10000000000000000",
      { CategoricalOutcome: [orderbookMarketId, 1] },
      orderAmount
    );
    await placeOrderCall.signAndSend(SUDO);
    await waitBlocks(api, 2);

    // Smart contract purchases set
    {
      const { gasRequired } = await contract.query.buyCompleteSet(
        SUDO.address, maxWeight2(api), orderbookMarketId, orderAmount
      );
      await new Promise(async (resolve, _) => {
        await contract.tx
          .buyCompleteSet(createGas(api, gasRequired), orderbookMarketId, orderAmount)
          .signAndSend(sudo(), async (res) => {
            if (res.status.isInBlock) resolve(null);
          });
      });
    }

    // Get the order ID of the last order made (getting it from event would work as well)
    const orderId = (await api.query.orderbook.nextOrderId()).toBn() - 1;

    // Fills order
    const partialFill = "5000000000";
    let foundEvent = false, logData = null;
    const { gasRequired } = await contract.query.fillOrder(SUDO.address, maxWeight2(api), orderId, partialFill);
    await new Promise(async (resolve, _) => {
      await contract.tx
        .fillOrder(createGas(api, gasRequired), orderId, partialFill)
        .signAndSend(sudo(), async (res) => {
          if (res.status.isInBlock) {
            res.events.forEach(({ event: { data, method, section } }) => {
              if (section === 'orderbook' && method === 'OrderFilled') {
                foundEvent = true;
                logData = data.toHuman();
              }
            });
            resolve(null);
          }
        });
    });

    expect(foundEvent).to.be.true;
    expect(((logData as any)['filledTakerAmount'] as string).replace(/,/g, '')).to.equal(partialFill);
  });

  it('Should be able to fill an order', async function () {
    const SUDO = sudo();

    // SUDO places an order
    const orderAmount = "10000000000";
    const placeOrderCall = api.tx.orderbook.placeOrder(
      orderbookMarketId,
      { Ztg: {} },
      "10000000000000000",
      { CategoricalOutcome: [orderbookMarketId, 1] },
      orderAmount
    );
    await placeOrderCall.signAndSend(SUDO);
    await waitBlocks(api, 2);

    // Smart contract purchases set
    {
      const { gasRequired } = await contract.query.buyCompleteSet(
        SUDO.address, maxWeight2(api), orderbookMarketId, orderAmount
      );
      await new Promise(async (resolve, _) => {
        await contract.tx
          .buyCompleteSet(createGas(api, gasRequired), orderbookMarketId, orderAmount)
          .signAndSend(sudo(), async (res) => {
            if (res.status.isInBlock) resolve(null);
          });
      });
    }

    // Get the order ID of the last order made (getting it from event would work as well)
    const orderId = (await api.query.orderbook.nextOrderId()).toBn() - 1;

    // Fills order
    let foundEvent = false;
    const { gasRequired } = await contract.query.fillOrder(SUDO.address, maxWeight2(api), orderId, null);
    await new Promise(async (resolve, _) => {
      await contract.tx
        .fillOrder(createGas(api, gasRequired), orderId, null)
        .signAndSend(sudo(), async (res) => {
          if (res.status.isInBlock) {
            res.events.forEach(({ event: { data, method, section } }) => {
              if (section === 'orderbook' && method === 'OrderFilled') {
                foundEvent = true;
              }
            });
            resolve(null);
          }
        });
    });

    expect(foundEvent).to.be.true;
  });

  it('Should be able to remove an order', async function () {
    const SUDO = sudo();

    // First have the contract place an order
    {
      const parameters = [
        orderbookMarketId,
        { Ztg: {} },
        "10000000000000000",
        { CategoricalOutcome: [orderbookMarketId, 1] },
        "50000000"
      ];

      // Contract redeems
      const { gasRequired } = await contract.query.placeOrder(SUDO.address, maxWeight2(api), ...parameters);
      await new Promise(async (resolve, _) => {
        await contract.tx
          .placeOrder(createGas(api, gasRequired), ...parameters)
          .signAndSend(sudo(), async (res) => {
            if (res.status.isInBlock) resolve(null);
          });
      });
    }

    // Get the order ID of the last order made (getting it from event would work as well)
    const orderId = (await api.query.orderbook.nextOrderId()).toBn() - 1;

    // Have the contract remove the order
    {
      let foundEvent = false;
      const { gasRequired } = await contract.query.removeOrder(SUDO.address, maxWeight2(api), orderId);
      await new Promise(async (resolve, _) => {
        await contract.tx
          .removeOrder(createGas(api, gasRequired), orderId)
          .signAndSend(sudo(), async (res) => {
            if (res.status.isInBlock) {
              res.events.forEach(({ event: { data, method, section } }) => {
                if (section === 'orderbook' && method === 'OrderRemoved') {
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
});

