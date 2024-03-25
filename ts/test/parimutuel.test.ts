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

describe.only('zrml-prediction-markets Runtime Calls', function () {
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

  async function createMarket(signer: KeyringPair, api: ApiPromise, oracle: string) {
    const params: CreateMarketParams<typeof zeitgeistSDK> = {
      baseAsset: { Ztg: null },
      signer,
      disputeMechanism: "Court",
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
      scoringRule: "Parimutuel",
      creationType: "Permissionless"
    };
    const response = await zeitgeistSDK.model.markets.create(params);
    const marketCreatedEvent = response.raw.events.find(x => x.event.toHuman()['method'] === 'MarketCreated');
    const marketID = (marketCreatedEvent?.event?.toHuman()['data'] as any[])[0];
    await waitBlocks(api, 1);
    return marketID;
  }

  it('Should buy parimutuel shares', async function () {
    const SUDO = sudo();
    const marketID = await createMarket(SUDO, api, SUDO.address.toString());

    // Send cash to contract
    const transfer = api.tx.balances.transfer(contract.address, 5_000_000_000_000n);
    await transfer.signAndSend(new Keyring({ type: 'sr25519' }).addFromUri('//Alice'));
    await waitBlocks(api, 2);

    // Get minBetSize + parimutuelShare
    const minBetSize = api.consts.parimutuel.minBetSize;
    const parimutuelShare = { ParimutuelShare: [marketID, 1] };

    // Smart contract purchases set
    let foundEvent = false;
    const { gasRequired } = await contract.query.parimutuelBuy(
      SUDO.address, maxWeight2(api), parimutuelShare, minBetSize
    );
    await new Promise(async (resolve, _) => {
      await contract.tx
        .parimutuelBuy(createGas(api, gasRequired), parimutuelShare, minBetSize)
        .signAndSend(sudo(), async (res) => {
          if (res.status.isInBlock) {
            res.events.forEach(({ event: { data, method, section } }) => {
              if (section === 'parimutuel' && method === 'OutcomeBought') {
                foundEvent = true;
              }
            });
            resolve(null);
          }
        });
    });

    expect(foundEvent).to.be.true;
  });

  // create market -> contract buy -> admin close -> report -> admin resolve -> parimutuel claim
  it.only('Should claim parimutuel rewards', async function () {
    const SUDO = sudo();
    const marketID = await createMarket(SUDO, api, SUDO.address.toString());

    // Get minBetSize + parimutuelShare
    const minBetSize = api.consts.parimutuel.minBetSize;
    const parimutuelShare = { ParimutuelShare: [marketID, 1] };

    // Contract buy
    const { gasRequired } = await contract.query.parimutuelBuy(
      SUDO.address, maxWeight2(api), parimutuelShare, minBetSize
    );
    await new Promise(async (resolve, _) => {
      await contract.tx
        .parimutuelBuy(createGas(api, gasRequired), parimutuelShare, minBetSize)
        .signAndSend(sudo(), async (res) => {
          if (res.status.isInBlock) resolve(null);
        });
    });

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

    // Claim
    {
      let foundEvent = false;
      const { gasRequired } = await contract.query.parimutuelClaimRewards(
        SUDO.address, maxWeight2(api), marketID
      );
      await new Promise(async (resolve, _) => {
        await contract.tx
          .parimutuelClaimRewards(createGas(api, gasRequired), marketID)
          .signAndSend(sudo(), async (res) => {
            if (res.status.isInBlock) {
              res.events.forEach(({ event: { data, method, section } }) => {
                if (section === 'parimutuel' && method === 'RewardsClaimed') {
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

  it.only('Should refund parimutuel', async function () {
    const SUDO = sudo();
    const marketID = await createMarket(SUDO, api, SUDO.address.toString());

    // Get minBetSize + parimutuelShare
    const minBetSize = api.consts.parimutuel.minBetSize;
    const parimutuelShare = { ParimutuelShare: [marketID, 1] };

    // Contract buy outcome 1
    const { gasRequired } = await contract.query.parimutuelBuy(
      SUDO.address, maxWeight2(api), parimutuelShare, minBetSize
    );
    await new Promise(async (resolve, _) => {
      await contract.tx
        .parimutuelBuy(createGas(api, gasRequired), parimutuelShare, minBetSize)
        .signAndSend(sudo(), async (res) => {
          if (res.status.isInBlock) resolve(null);
        });
    });

    // Sudo closes the market
    const adminMoveMarketToClosedCall = api.tx.predictionMarkets.adminMoveMarketToClosed(marketID);
    const sudoTx = api.tx.sudo.sudo(adminMoveMarketToClosedCall);
    await sudoTx.signAndSend(SUDO);
    await waitBlocks(api, 2);

    // Sudo reports market with "0" as winner
    const reportCall = api.tx.predictionMarkets.report(marketID, { Categorical: 0 });
    await reportCall.signAndSend(SUDO);
    await waitBlocks(api, 2);

    // Sudo resolves the market
    const adminMoveMarketToResolvedCall = api.tx.predictionMarkets.adminMoveMarketToResolved(marketID);
    const resolvedTx = api.tx.sudo.sudo(adminMoveMarketToResolvedCall);
    await resolvedTx.signAndSend(SUDO);
    await waitBlocks(api, 2);

    // Claim
    {
      let foundEvent = false;
      const { gasRequired } = await contract.query.parimutuelClaimRefunds(
        SUDO.address, maxWeight2(api), parimutuelShare
      );
      await new Promise(async (resolve, _) => {
        await contract.tx
          .parimutuelClaimRefunds(createGas(api, gasRequired), parimutuelShare)
          .signAndSend(sudo(), async (res) => {
            if (res.status.isInBlock) {
              res.events.forEach(({ event: { data, method, section } }) => {
                if (section === 'parimutuel' && method === 'BalanceRefunded') {
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

