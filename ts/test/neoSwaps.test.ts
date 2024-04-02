import { expect } from 'chai';
import { createGas, deployTestContract, getAPI, maxWeight2, setSudoKey, startNode, sudo, waitBlocks } from '../utils.js';
import { ChildProcess } from 'child_process';
import { ApiPromise, Keyring } from '@polkadot/api';
import { ContractPromise } from '@polkadot/api-contract';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { CreateMarketParams, IOMarketOutcomeAssetId, MetadataStorage, RpcContext, Sdk, ZTG, create, createStorage } from "@zeitgeistpm/sdk";
import { KeyringPair } from '@polkadot/keyring/types.js';
import { Memory } from "@zeitgeistpm/web3.storage";
import { Decimal } from 'decimal.js'

describe('zrml-neo-swaps Runtime Calls', function () {
  let api: ApiPromise;
  let zeitgeistSDK: Sdk<RpcContext<MetadataStorage>, MetadataStorage>;
  let contract: ContractPromise;
  let process: ChildProcess;

  this.beforeAll(async function () {
    // process = startNode();
    await cryptoWaitReady();
    ({ api } = await getAPI());
    contract = await deployTestContract(api);

    // Initialize Zeitgeist SDK for local
    zeitgeistSDK = await create({
      provider: ['ws://127.0.0.1:9944'],
      storage: createStorage(Memory.storage())
    });

    // Send cash to contract
    const transfer = api.tx.balances.transfer(contract.address, 5_000_000_000_000_000n);
    await transfer.signAndSend(new Keyring({ type: 'sr25519' }).addFromUri('//Alice'));
    await waitBlocks(api, 2);
  });

  this.afterAll(async function () {
    await api.disconnect();
    // process.kill('SIGTERM');
  });

  async function createCategoricalMarketWithPool(signer: KeyringPair, api: ApiPromise) {
    const params: CreateMarketParams<typeof zeitgeistSDK> = {
      baseAsset: { Ztg: null },
      signer,
      disputeMechanism: "Court",
      marketType: { Categorical: 2 },
      oracle: signer.address.toString(),
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
      pool: {
        amount: ZTG.mul(300).toString(),
        swapFee: "10000000",
        spotPrices: [
          new Decimal(0.5).mul(ZTG).toString(),
          new Decimal(0.5).mul(ZTG).toString()
        ]
      }
    };
    const response = await zeitgeistSDK.model.markets.create(params);
    const marketCreatedEvent = response.raw.events.find(x => x.event.toHuman()['method'] === 'MarketCreated');
    const marketID = (marketCreatedEvent?.event?.toHuman()['data'] as any[])[0];
    await waitBlocks(api, 1);
    return parseInt(marketID.toString());
  }

  // TODO
  it.skip('Should join a pool', async function () {
    // Create Market
    const SUDO = sudo();
    const marketId = await createCategoricalMarketWithPool(SUDO, api);

    // Smart contract purchases market set
    {
      const { gasRequired } = await contract.query.buyCompleteSet(
        SUDO.address, maxWeight2(api), marketId, ZTG.mul(10).toString()
      );
      await new Promise(async (resolve, _) => {
        await contract.tx
          .buyCompleteSet(createGas(api, gasRequired), marketId, ZTG.mul(10).toString())
          .signAndSend(sudo(), async (res) => {
            if (res.status.isInBlock) resolve(null);
          });
      });
      await waitBlocks(api, 2);
    }

    // Contract joins market
    let foundEvent = false;
    const parameters = [marketId, 1, [ZTG.mul(10).toString(), ZTG.mul(0.1).toString()]];
    console.log('PARAMETERS:', parameters);
    const { gasRequired } = await contract.query.neoswapJoin(SUDO.address, maxWeight2(api), ...parameters);
    await new Promise(async (resolve, _) => {
      await contract.tx
        .neoswapJoin(createGas(api, gasRequired), ...parameters)
        .signAndSend(sudo(), async (res) => {
          if (res.status.isInBlock) {
            res.events.forEach(({ event: { data, method, section } }) => {
              if (section === 'neoSwaps' && method === 'JoinExecuted') {
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

// From: https://github.com/zeitgeistpm/ui/blob/staging/lib/math.ts
const calcOutGivenIn = (
  tokenBalanceIn: Decimal | string | number, // amount of 'in' asset in the pool
  tokenWeightIn: Decimal | string | number, // weight of 'in' asset on the pool
  tokenBalanceOut: Decimal | string | number, // amount of 'out' asset in the pool
  tokenWeightOut: Decimal | string | number, // weight of 'out' asset on the pool
  tokenAmountIn: Decimal | string | number, // amount in for the swap
  swapFee: Decimal | string | number, // 0.01 is 1%
  creatorFee: Decimal | string | number, // 0.01 is 1%
) => {
  const totalFee = new Decimal(swapFee).plus(creatorFee);
  const weightRatio = new Decimal(tokenWeightIn).div(
    new Decimal(tokenWeightOut),
  );
  const adjustedIn = new Decimal(tokenAmountIn).times(
    new Decimal(1).minus(new Decimal(totalFee)),
  );
  const y = new Decimal(tokenBalanceIn).div(
    new Decimal(tokenBalanceIn).plus(adjustedIn),
  );
  const foo = y.pow(weightRatio);
  const bar = new Decimal(1).minus(foo);
  const tokenAmountOut = new Decimal(tokenBalanceOut).times(bar);
  return tokenAmountOut;
};

const calcInGivenOut = (
  tokenBalanceIn: Decimal | string | number,
  tokenWeightIn: Decimal | string | number,
  tokenBalanceOut: Decimal | string | number,
  tokenWeightOut: Decimal | string | number,
  tokenAmountOut: Decimal | string | number,
  swapFee: Decimal | string | number, // 0.01 is 1%
  creatorFee: Decimal | string | number, // 0.01 is 1%
) => {
  const totalFee = new Decimal(swapFee).plus(creatorFee);
  const weightRatio = new Decimal(tokenWeightOut).div(
    new Decimal(tokenWeightIn),
  );
  const diff = new Decimal(tokenBalanceOut).minus(tokenAmountOut);
  const y = new Decimal(tokenBalanceOut).div(diff);
  const foo = y.pow(weightRatio).minus(new Decimal(1));
  const tokenAmountIn = new Decimal(tokenBalanceIn)
    .times(foo)
    .div(new Decimal(1).minus(new Decimal(totalFee)));
  return tokenAmountIn;
};