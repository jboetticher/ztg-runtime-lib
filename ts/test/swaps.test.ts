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

// Creates a pool for market 0
const ENCODED_STORAGE_KEY = '0x6ff1538f484dbd21e5c578e840f46abe4c72016d74b63ae83d79b02efdb5528e463be1d58a72e9618ea59884367c435800000000000000000000000000000000';
const ENCODED_STORAGE_DATA = '0x0c0000000000000000000000000000000000000000000000000000000000000000000000000100040000c2eb0b0000000000000000000000000000f2052a01000000000000000000000c0000000000000000000000000000000000000000807c814a00000000000000000000000000000000000000000000000000000000010000807c814a0000000000000000000000040000f902950000000000000000000000';

describe('zrml-swaps Runtime Calls', function () {
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

    // Send cash to contract
    const transfer = api.tx.balances.transfer(contract.address, 5_000_000_000_000_000n);
    await transfer.signAndSend(new Keyring({ type: 'sr25519' }).addFromUri('//Alice'));
    await waitBlocks(api, 2);
  });

  this.afterAll(async function () {
    await api.disconnect();
    process.kill('SIGTERM');
  });

  async function createCategoricalMarket(signer: KeyringPair, api: ApiPromise) {
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
      scoringRule: "Parimutuel",
      creationType: "Permissionless"
    };
    const response = await zeitgeistSDK.model.markets.create(params);
    const marketCreatedEvent = response.raw.events.find(x => x.event.toHuman()['method'] === 'MarketCreated');
    const marketID = (marketCreatedEvent?.event?.toHuman()['data'] as any[])[0];
    await waitBlocks(api, 1);
    return parseInt(marketID.toString());
  }

  // @note: pool_exit is blocked with "1010: Invalid Transaction: Transaction call is not expected"
  it.skip('Should exit a pool', async function () { });

  // @note: pool_exit_with_exact_asset_amount is blocked with "1010: Invalid Transaction: Transaction call is not expected"
  it.skip('Should exit a pool with an exact asset amount', async function () { });

  // @note: pool_exit_with_exact_pool_amount is blocked with "1010: Invalid Transaction: Transaction call is not expected"
  it.skip('Should exit a pool with an exact pool amount', async function () { });

  // @note: pool_exit is blocked with "1010: Invalid Transaction: Transaction call is not expected"
  it.skip('Should join a pool', async function () { });

  // @note: pool_join_with_exact_asset_amount is blocked with "1010: Invalid Transaction: Transaction call is not expected"
  it.skip('Should join a pool with an exact asset amount', async function () { });

  // @note: pool_join_with_exact_pool_amount is blocked with "1010: Invalid Transaction: Transaction call is not expected"
  it.skip('Should join a pool with an exact pool amount', async function () { });

  // @note: swap_exact_amount_in is blocked with "1010: Invalid Transaction: Transaction call is not expected"
  it.skip('Should swap an exact amount in', async function () { });

  // @note: swap_exact_amount_in is blocked with "1010: Invalid Transaction: Transaction call is not expected"
  it.skip('Should swap an exact amount out', async function () { });

  // NOTE: it's proving quite difficult to create a swap data structure without any available extrinsics
  // TODO: implement this extrinsic test
  it.skip('Should force a pool exit', async function () {
    /*
    const SUDO = sudo();

    // Creates market 0
    await createCategoricalMarket(SUDO, api);

    // Creates open pool at 0
    {
      const keyValue = api.createType('(StorageKey, StorageData)', [ENCODED_STORAGE_KEY, ENCODED_STORAGE_DATA]);
      const sudoTx = api.tx.sudo.sudo(api.tx.system.setStorage([keyValue]));
      await new Promise(async (resolve) => {
        await sudoTx.signAndSend(SUDO, ({ status }) => { if (status.isInBlock || status.isFinalized) resolve(null) });
      });
      await waitBlocks(api, 2);
    }
    */
  });
});

type Pool = {
  assets: [],
  status: { open?: {}, closed?: {} },
  swapFee: number,
  totalWeight: number,
  weights: any
}

/*



*/
