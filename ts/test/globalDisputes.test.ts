import { expect } from 'chai';
import { createGas, deployTestContract, generateRandomAddress, getAPI, maxWeight2, setSudoKey, startNode, sudo, waitBlocks } from '../utils.js';
import { ChildProcess } from 'child_process';
import { ApiPromise, Keyring, WsProvider } from '@polkadot/api';
import { ContractPromise } from '@polkadot/api-contract';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { CreateMarketParams, MetadataStorage, RpcContext, Sdk, ZTG, create, createStorage } from "@zeitgeistpm/sdk";
import { Memory } from "@zeitgeistpm/web3.storage";
import { KeyringPair } from '@polkadot/keyring/types.js';
import { CourtInfo } from './court.test.js';

describe('zrml-global-disputes Runtime Calls', function () {
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

    // Gives the contract a lot of DEV
    const transfer = api.tx.balances.transfer(contract.address, "500000000000000000000000000");
    await transfer.signAndSend(new Keyring({ type: 'sr25519' }).addFromUri('//Alice'));
  });

  this.afterAll(async function () {
    await api.disconnect();
    // process.kill('SIGTERM');
  });

  async function createScalarMarket(signer: KeyringPair, api: ApiPromise, oracle: string, disputeMechanism: "Authorized" | "Court" = "Authorized") {
    const params: CreateMarketParams<typeof zeitgeistSDK> = {
      baseAsset: { Ztg: null },
      signer,
      disputeMechanism,
      marketType: { Scalar: [0, 100] },
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

  async function createGlobalDispute() {
    // Creates a market with Court dispute
    const SUDO = sudo();
    const marketID = await createScalarMarket(SUDO, api, SUDO.address.toString(), "Court");

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
    const reportTx = api.tx.predictionMarkets.report(marketID, { Scalar: 1 });
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
      appealedVoteItem: { Outcome: { Scalar: 2 } }
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
    const globalDisputeTx = api.tx.predictionMarkets.startGlobalDispute(marketID);
    await globalDisputeTx.signAndSend(SUDO);
    await waitBlocks(api, 2);

    return marketID;
  }

  async function setDisputeToVotingPhase(marketId: any, SUDO: KeyringPair) {
    const disputeInfoJSON: ZrmlGlobalDisputesGlobalDisputeInfo = (await api.query.globalDisputes.globalDisputesInfo(marketId)).toJSON() as ZrmlGlobalDisputesGlobalDisputeInfo;
    const disputeInfoKey = api.query.globalDisputes.globalDisputesInfo.key(marketId);
    disputeInfoJSON.status.active!.addOutcomeEnd = 1;
    const encodedData = api.createType('ZrmlGlobalDisputesGlobalDisputeInfo', disputeInfoJSON);
    const keyValue = api.createType('(StorageKey, StorageData)', [disputeInfoKey, encodedData.toHex()]);
    const sudoTx = api.tx.sudo.sudo(api.tx.system.setStorage([keyValue]));
    await new Promise(async (resolve) => {
      await sudoTx.signAndSend(SUDO, ({ status }) => {
        if (status.isInBlock || status.isFinalized) resolve(null);
      });
    });
    await waitBlocks(api, 2);
  }

  async function createGlobalDisputeInVotePhase() {
    const marketId = await createGlobalDispute();
    const SUDO = sudo();

    // Set the global dispute's status for addOutcomeEnd in the past
    await setDisputeToVotingPhase(marketId, SUDO);

    return marketId;
  }

  async function finishDispute(marketID: any, SUDO: KeyringPair, destroy: boolean = false) {
    const disputeInfoJSON: ZrmlGlobalDisputesGlobalDisputeInfo = (await api.query.globalDisputes.globalDisputesInfo(marketID)).toJSON() as ZrmlGlobalDisputesGlobalDisputeInfo;
    const disputeInfoKey = api.query.globalDisputes.globalDisputesInfo.key(marketID);
    disputeInfoJSON.status = destroy ? { destroyed: {} } : { finished: {} };
    const encodedData = api.createType('ZrmlGlobalDisputesGlobalDisputeInfo', disputeInfoJSON);
    const keyValue = api.createType('(StorageKey, StorageData)', [disputeInfoKey, encodedData.toHex()]);
    const sudoTx = api.tx.sudo.sudo(api.tx.system.setStorage([keyValue]));
    await new Promise(async (resolve) => {
      await sudoTx.signAndSend(SUDO, ({ status }) => {
        if (status.isInBlock || status.isFinalized) resolve(null);
      });
    });
    await waitBlocks(api, 2);
  }

  it('Should add a vote outcome', async function () {
    const SUDO = sudo();
    const marketID = await createGlobalDispute();

    // Smart contract adds a vote outcome
    let foundEvent = false;
    const { gasRequired } = await contract.query.addVoteOutcome(SUDO.address, maxWeight2(api), marketID, { Scalar: 5 });
    await new Promise(async (resolve, _) => {
      await contract.tx
        .addVoteOutcome(createGas(api, gasRequired), marketID, { Scalar: 5 })
        .signAndSend(sudo(), async (res) => {
          if (res.status.isInBlock) {
            res.events.forEach(({ event: { data, method, section } }) => {
              if (section === 'globalDisputes' && method === 'AddedVotingOutcome') foundEvent = true;
            });
            resolve(null);
          }
        });
    });

    expect(foundEvent).to.be.true;
  });

  it('Should purge outcomes', async function () {
    const SUDO = sudo();
    const marketID = await createGlobalDisputeInVotePhase();

    // Votes in an outcome
    const voteTx = await api.tx.globalDisputes.voteOnOutcome(marketID, { Scalar: 1 }, "1000000000000");
    await voteTx.signAndSend(SUDO);
    await waitBlocks(api, 2);

    // SUDO sets dispute to finished
    await finishDispute(marketID, SUDO);

    // Contract purges outcome
    let foundEvent = false;
    const { gasRequired } = await contract.query.purgeOutcomes(SUDO.address, maxWeight2(api), marketID);
    await new Promise(async (resolve, _) => {
      await contract.tx
        .purgeOutcomes(createGas(api, gasRequired), marketID)
        .signAndSend(sudo(), async (res) => {
          if (res.status.isInBlock) {
            res.events.forEach(({ event: { data, method, section } }) => {
              if (section === 'globalDisputes' && method === 'OutcomesFullyCleaned') foundEvent = true;
            });
            resolve(null);
          }
        });
    });

    expect(foundEvent).to.be.true;
  });

  it('Should reward outcome owners', async function () {
    const SUDO = sudo();
    const ALICE = new Keyring({ type: 'sr25519' }).addFromUri('//Alice');
    const marketID = await createGlobalDispute();

    // Alice creates a vote outcome, which adds to reward_account
    await api.tx.globalDisputes.addVoteOutcome(marketID, { Scalar: 5 }).signAndSend(ALICE);
    await waitBlocks(api, 2);

    // Sudo sets the status to voting
    await setDisputeToVotingPhase(marketID, SUDO);

    // Vote for the new vote outcome with a lot of money
    await api.tx.globalDisputes.voteOnOutcome(marketID, { Scalar: 5 }, "1000000000000000000000000000").signAndSend(SUDO);
    await waitBlocks(api, 2);

    // Sudo sets the status to finished
    await finishDispute(marketID, SUDO);

    // Purge outcomes
    await api.tx.globalDisputes.purgeOutcomes(marketID).signAndSend(SUDO);
    await waitBlocks(api, 2);

    // Contract rewards the outcome owner
    let foundEvent = false;
    const { gasRequired } = await contract.query.rewardOutcomeOwner(SUDO.address, maxWeight2(api), marketID);
    await new Promise(async (resolve, _) => {
      await contract.tx
        .rewardOutcomeOwner(createGas(api, gasRequired), marketID)
        .signAndSend(sudo(), async (res) => {
          if (res.status.isInBlock) {
            res.events.forEach(({ event: { data, method, section } }) => {
              if (section === 'globalDisputes' && method === 'OutcomeOwnerRewarded') foundEvent = true;
            });
            resolve(null);
          }
        });
    });

    expect(foundEvent).to.be.true;
  })

  it('Should vote on an outcome', async function () {
    const marketID = await createGlobalDisputeInVotePhase();
    const SUDO = sudo();

    // Smart contract votes
    let foundEvent = false;
    const params = [marketID, { Scalar: 1 }, "100000000000000000"];
    const { gasRequired } = await contract.query.voteOnOutcome(SUDO.address, maxWeight2(api), ...params);
    await new Promise(async (resolve, _) => {
      await contract.tx
        .voteOnOutcome(createGas(api, gasRequired), ...params)
        .signAndSend(sudo(), async (res) => {
          if (res.status.isInBlock) {
            res.events.forEach(({ event: { data, method, section } }) => {
              if (section === 'globalDisputes' && method === 'VotedOnOutcome') foundEvent = true;
            });
            resolve(null);
          }
        });
    });

    expect(foundEvent).to.be.true;
  })

  it('Should unlock a vote balance', async function () {
    const SUDO = sudo();

    const randomAddress = generateRandomAddress();

    // Contract unlocks vote balance
    const { gasRequired } = await contract.query.unlockVoteBalance(SUDO.address, maxWeight2(api), randomAddress);
    await new Promise(async (resolve, _) => {
      await contract.tx
        .unlockVoteBalance(createGas(api, gasRequired), randomAddress)
        .signAndSend(sudo(), async (res) => {
          expect(res.isError).to.be.false;
          if (res.status.isInBlock && !res.isError) resolve(null);
        });
    });
  })

  it('Should refund vote fees', async function () {
    const marketID = await createGlobalDisputeInVotePhase();
    const SUDO = sudo();

    // A user votes
    await api.tx.globalDisputes.voteOnOutcome(marketID, { Scalar: 1 }, "100000000000000000").signAndSend(SUDO);
    await waitBlocks(api, 2);

    // Sudo sets market to destroyed
    await finishDispute(marketID, SUDO, true);

    // Smart contract refunds vote fees
    let foundEvent = false;
    const { gasRequired } = await contract.query.refundVoteFees(SUDO.address, maxWeight2(api), marketID);
    await new Promise(async (resolve, _) => {
      await contract.tx
        .refundVoteFees(createGas(api, gasRequired), marketID)
        .signAndSend(sudo(), async (res) => {
          if (res.status.isInBlock) {
            res.events.forEach(({ event: { data, method, section } }) => {
              if (section === 'globalDisputes' && method === 'OutcomesFullyCleaned') foundEvent = true;
            });
            resolve(null);
          }
        });
    });

    expect(foundEvent).to.be.true;
  });
});

type ZrmlGlobalDisputesGlobalDisputeInfo = {
  winnerOutcome: any,
  outcomeInfo: any,
  status: {
    active?: {
      addOutcomeEnd: number,
      voteEnd: number
    },
    finished?: {},
    destroyed?: {}
  }
}
