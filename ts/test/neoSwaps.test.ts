import { expect } from 'chai';
import { createGas, deployTestContract, getAPI, maxWeight2, setSudoKey, startNode, sudo, waitBlocks } from '../utils.js';
import { ChildProcess } from 'child_process';
import { ApiPromise, Keyring } from '@polkadot/api';
import { ContractPromise } from '@polkadot/api-contract';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { KeyringPair } from '@polkadot/keyring/types.js';
import { Memory } from "@zeitgeistpm/web3.storage";
import { Decimal } from 'decimal.js'
import {
  CreateMarketParams, IOMarketOutcomeAssetId, MetadataStorage, RpcContext,
  Sdk, ZTG, create, createStorage, IOCategoricalAssetId, MarketOutcomeAssetId,
  AssetId, parseAssetId
} from "@zeitgeistpm/sdk";

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

  it('Should buy from a pool', async function () {
    const SUDO = sudo();
    const marketId = await createCategoricalMarketWithPool(SUDO, api);

    // Contract buys from market
    let foundEvent = false;
    const parameters = [marketId, 2, { CategoricalOutcome: [marketId, 1] }, "10000000000", "100000000"];
    const { gasRequired } = await contract.query.neoswapBuy(SUDO.address, maxWeight2(api), ...parameters);
    await new Promise(async (resolve, _) => {
      await contract.tx
        .neoswapBuy(createGas(api, gasRequired), ...parameters)
        .signAndSend(sudo(), async (res) => {
          if (res.status.isInBlock) {
            res.events.forEach(({ event: { data, method, section } }) => {
              if (section === 'neoSwaps' && method === 'BuyExecuted') {
                foundEvent = true;
              }
            });
            resolve(null);
          }
        });
    });

    expect(foundEvent).to.be.true;
  });

  it('Should be able to sell to a pool', async function () {
    const SUDO = sudo();
    const marketId = await createCategoricalMarketWithPool(SUDO, api);

    // Contract first buys from market
    {
      const parameters = [marketId, 2, { CategoricalOutcome: [marketId, 1] }, "10000000000", "100000000"];
      const { gasRequired } = await contract.query.neoswapBuy(SUDO.address, maxWeight2(api), ...parameters);
      await new Promise(async (resolve, _) => {
        await contract.tx
          .neoswapBuy(createGas(api, gasRequired), ...parameters)
          .signAndSend(sudo(), async (res) => {
            if (res.status.isInBlock) resolve(null);
          });
      });
    }

    // Then sells it back
    let foundEvent = false;
    const parameters = [marketId, 2, { CategoricalOutcome: [marketId, 1] }, "1000000000", "10000000"];
    const { gasRequired } = await contract.query.neoswapSell(SUDO.address, maxWeight2(api), ...parameters);
    await new Promise(async (resolve, _) => {
      await contract.tx
        .neoswapSell(createGas(api, gasRequired), ...parameters)
        .signAndSend(sudo(), async (res) => {
          if (res.status.isInBlock) {
            res.events.forEach(({ event: { data, method, section } }) => {
              if (section === 'neoSwaps' && method === 'SellExecuted') {
                foundEvent = true;
              }
            });
            resolve(null);
          }
        });
    });

    expect(foundEvent).to.be.true;
  });

  it('Should join a pool', async function () {
    // Create Market
    const SUDO = sudo();
    const marketId = await createCategoricalMarketWithPool(SUDO, api);

    const setToBuy = "600000000000";
    const maxAmountsIn = "100000000000000";
    const sharesToBuy = "500000000000";

    // Smart contract purchases market set
    {
      const { gasRequired } = await contract.query.buyCompleteSet(
        SUDO.address, maxWeight2(api), marketId, setToBuy
      );
      await new Promise(async (resolve, _) => {
        await contract.tx
          .buyCompleteSet(createGas(api, gasRequired), marketId, setToBuy)
          .signAndSend(sudo(), async (res) => {
            if (res.status.isInBlock) resolve(null);
          });
      });
      await waitBlocks(api, 2);
    }

    // Contract joins market
    let foundEvent = false;
    const parameters = [marketId, sharesToBuy, [maxAmountsIn, maxAmountsIn]];
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

  it('Should exit a pool', async function () {
    const SUDO = sudo();
    const marketId = await createCategoricalMarketWithPool(SUDO, api);

    const setToBuy = "600000000000";
    const maxAmountsIn = "100000000000000";
    const sharesToBuy = "500000000000";
    const minAmountsOut = "10000000000";

    // Smart contract purchases market set
    {
      const { gasRequired } = await contract.query.buyCompleteSet(
        SUDO.address, maxWeight2(api), marketId, setToBuy
      );
      await new Promise(async (resolve, _) => {
        await contract.tx
          .buyCompleteSet(createGas(api, gasRequired), marketId, setToBuy)
          .signAndSend(sudo(), async (res) => {
            if (res.status.isInBlock) resolve(null);
          });
      });
      await waitBlocks(api, 2);
    }

    // Contract joins market
    {
      const parameters = [marketId, sharesToBuy, [maxAmountsIn, maxAmountsIn]];
      const { gasRequired } = await contract.query.neoswapJoin(SUDO.address, maxWeight2(api), ...parameters);
      await new Promise(async (resolve, _) => {
        await contract.tx
          .neoswapJoin(createGas(api, gasRequired), ...parameters)
          .signAndSend(sudo(), async (res) => {
            if (res.status.isInBlock) resolve(null);
          });
      });
    }

    // Contract exits market
    {
      let foundEvent = false;
      const parameters = [marketId, sharesToBuy, [minAmountsOut, minAmountsOut]];
      const { gasRequired } = await contract.query.neoswapExit(SUDO.address, maxWeight2(api), ...parameters);
      await new Promise(async (resolve, _) => {
        await contract.tx
          .neoswapExit(createGas(api, gasRequired), ...parameters)
          .signAndSend(sudo(), async (res) => {
            if (res.status.isInBlock) {
              res.events.forEach(({ event: { data, method, section } }) => {
                if (section === 'neoSwaps' && method === 'ExitExecuted') {
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

  it('Should withdraw fees from a pool', async function () {
    const SUDO = sudo();
    const marketId = await createCategoricalMarketWithPool(SUDO, api);

    const setToBuy = "600000000000";
    const maxAmountsIn = "100000000000000";
    const sharesToBuy = "500000000000";

    // Smart contract purchases market set
    {
      const { gasRequired } = await contract.query.buyCompleteSet(
        SUDO.address, maxWeight2(api), marketId, setToBuy
      );
      await new Promise(async (resolve, _) => {
        await contract.tx
          .buyCompleteSet(createGas(api, gasRequired), marketId, setToBuy)
          .signAndSend(sudo(), async (res) => {
            if (res.status.isInBlock) resolve(null);
          });
      });
      await waitBlocks(api, 2);
    }

    // Contract joins market
    {
      const parameters = [marketId, sharesToBuy, [maxAmountsIn, maxAmountsIn]];
      const { gasRequired } = await contract.query.neoswapJoin(SUDO.address, maxWeight2(api), ...parameters);
      await new Promise(async (resolve, _) => {
        await contract.tx
          .neoswapJoin(createGas(api, gasRequired), ...parameters)
          .signAndSend(sudo(), async (res) => {
            if (res.status.isInBlock) resolve(null);
          });
      });
    }

    // Withdraws fees (0) now that it has joined the market
    {
      let foundEvent = false;
      const { gasRequired } = await contract.query.neoswapWithdrawFees(SUDO.address, maxWeight2(api), marketId);
      await new Promise(async (resolve, _) => {
        await contract.tx
          .neoswapWithdrawFees(createGas(api, gasRequired), marketId)
          .signAndSend(sudo(), async (res) => {
            if (res.status.isInBlock) {
              res.events.forEach(({ event: { data, method, section } }) => {
                if (section === 'neoSwaps' && method === 'FeesWithdrawn') foundEvent = true;
              });
              resolve(null);
            }
          });
      });
      expect(foundEvent).to.be.true;
    }
  });

  it('Should deploy a pool', async function () {
    const SUDO = sudo();

    // Create market
    let marketId = '';
    {
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
        { Permissionless: {} },
        { Categorical: 2 },
        { Court: {} },
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
                  marketId = (data.toJSON() as any)[0];
                }
              });
              resolve(null);
            }
          });
      });
    }

    // Contract buys complete set
    {
      const { gasRequired } = await contract.query.buyCompleteSet(
        SUDO.address, maxWeight2(api), marketId, "3000000000000"
      );
      await new Promise(async (resolve, _) => {
        await contract.tx
          .buyCompleteSet(createGas(api, gasRequired), marketId, "3000000000000")
          .signAndSend(sudo(), async (res) => {
            if (res.status.isInBlock) resolve(null);
          });
      });
    }

    // Deploys the pool
    {
      let foundEvent = false;
      const params = [
        marketId,
        ZTG.mul(300).toString(),
        [
          new Decimal(0.5).mul(ZTG).toString(),
          new Decimal(0.5).mul(ZTG).toString()
        ],
        "10000000"
      ];
      const { gasRequired } = await contract.query.neoswapDeployPool(SUDO.address, maxWeight2(api), ...params);
      await new Promise(async (resolve, _) => {
        await contract.tx
          .neoswapDeployPool(createGas(api, gasRequired), ...params)
          .signAndSend(sudo(), async (res) => {
            if (res.status.isInBlock) {
              res.events.forEach(({ event: { data, method, section } }) => {
                if (section === 'neoSwaps' && method === 'PoolDeployed') foundEvent = true;
              });
              resolve(null);
            }
          });
      });
      expect(foundEvent).to.be.true;
    }
  });

  async function getNeoswapPool(marketId: string) {
    const res = await zeitgeistSDK.api.query.neoSwaps.pools(marketId);
    const unwrappedRes = res.unwrapOr(null);

    if (unwrappedRes) {
      const reserves: ReserveMap = new Map();
      const assetIds: MarketOutcomeAssetId[] = [];

      unwrappedRes.reserves.forEach((reserve, asset) => {
        const assetId = parseAssetIdString(asset.toString());
        if (IOMarketOutcomeAssetId.is(assetId)) {
          reserves.set(
            IOCategoricalAssetId.is(assetId)
              ? assetId.CategoricalOutcome[1]
              : assetId.ScalarOutcome[1],
            new Decimal(reserve.toString()),
          );
          assetIds.push(assetId);
        }
      });

      const poolAccounts: PoolAccount[] =
        unwrappedRes.liquiditySharesManager.nodes.map((node) => {
          return {
            address: node.account.toString(),
            shares: new Decimal(node.stake.toString()),
            fees: new Decimal(node.fees.toString()),
          };
        });

      const pool: Amm2Pool = {
        accountId: unwrappedRes.accountId.toString(),
        baseAsset: parseAssetIdString(unwrappedRes.collateral.toString())!,
        liquidity: new Decimal(unwrappedRes.liquidityParameter.toString()),
        swapFee: new Decimal(unwrappedRes.swapFee.toString()),
        accounts: poolAccounts,
        reserves,
        assetIds,
        totalShares: poolAccounts.reduce<Decimal>(
          (total, account) => total.plus(account.shares),
          new Decimal(0),
        ),
      };

      return pool;
    }
  }
});

type ReserveMap = Map<number | "Long" | "Short", Decimal>;

type Amm2Pool = {
  accountId: string;
  baseAsset: AssetId;
  liquidity: Decimal;
  swapFee: Decimal;
  totalShares: Decimal;
  reserves: ReserveMap;
  assetIds: MarketOutcomeAssetId[];
  accounts: PoolAccount[];
};

type PoolAccount = {
  address: string;
  shares: Decimal;
  fees: Decimal;
};

const parseAssetIdString = (
  assetId?: string | AssetId,
): AssetId | undefined => {
  return assetId ? parseAssetId(assetId).unrightOr(undefined) : undefined;
};