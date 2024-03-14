import { expect } from 'chai';
import { createGas, deployTestContract, getAPI, maxWeight2, setSudoKey, startNode, sudo, waitBlocks } from '../utils.js';
import { ChildProcess } from 'child_process';
import { ApiPromise, Keyring, WsProvider } from '@polkadot/api';
import { ContractPromise } from '@polkadot/api-contract';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { CreateMarketParams, ZTG, create, createStorage, localhostRpc } from "@zeitgeistpm/sdk";
import { Memory } from "@zeitgeistpm/web3.storage";

describe.only('zrml-prediction-markets Runtime Calls', function () {
  let api: ApiPromise;
  let zeitgeistSDK;
  let contract: ContractPromise;
  let process: ChildProcess;
  let marketID: string;

  this.beforeAll(async function () {
    // process = startNode();
    await cryptoWaitReady();
    ({ api } = await getAPI());
    // contract = await deployTestContract(api);
    const SUDO = sudo();

    // Initialize Zeitgeist SDK for local
    zeitgeistSDK = await create({
      provider: ['ws://127.0.0.1:9944'],
      storage: createStorage(Memory.storage())
    });

    // Creates a market
    const params: CreateMarketParams<typeof zeitgeistSDK> = {
      baseAsset: { Ztg: null },
      signer: SUDO,
      disputeMechanism: "Authorized",
      marketType: { Categorical: 2 },
      oracle: SUDO.address,
      period: { Timestamp: [Date.now(), Date.now() + 60 * 60 * 24 * 1000 * 2] },
      deadlines: {
        disputeDuration: 5000,
        gracePeriod: 200,
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
      // Something wrong with the pool I think
      // pool: {
      //   amount: ZTG.mul(300).toString(),
      //   swapFee: "10000000",
      //   spotPrices: ["50000000000"],
      // },
      scoringRule: "Lmsr",
      creationType: "Permissionless"
    };
    const response = await zeitgeistSDK.model.markets.create(params);
    const marketCreatedEvent = response.raw.events.find(x => x.event.toHuman()['method'] === 'MarketCreated');
    marketID = (marketCreatedEvent?.event?.toHuman()['data'] as any[])[0]
  });

  this.afterAll(async function () {
    await api.disconnect();
    // process.kill('SIGTERM');
  });

  it.skip('Should log prediction market storage data', async function () {
    const metadata = await api.rpc.state.getMetadata();
    const predictionMarketsPallet = metadata.asLatest.pallets.find(x => x.name.toHuman() === 'PredictionMarkets');
    if (predictionMarketsPallet && predictionMarketsPallet.storage) {
      console.log(`Storage for PredictionMarkets:`, predictionMarketsPallet.storage.unwrap().toHuman());
    }
  });
});
