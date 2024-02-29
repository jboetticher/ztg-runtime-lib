import { expect } from 'chai';
import { createGas, deployTestContract, generateRandomAddress, getAPI, maxWeight2, setSudoKey, startNode, sudo, waitBlocks } from '../utils.js';
import { ChildProcessWithoutNullStreams } from 'child_process';
import { ApiPromise, Keyring } from '@polkadot/api';
import { ContractPromise } from '@polkadot/api-contract';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { AccountInfo } from '@polkadot/types/interfaces';

describe.only('asset-manager Runtime Calls', function () {
  let api: ApiPromise;
  let contract: ContractPromise;
  let process: ChildProcessWithoutNullStreams;

  this.beforeAll(async function () {
    process = startNode();
    await cryptoWaitReady();
    ({ api } = await getAPI());
    contract = await deployTestContract(api);
  });

  this.afterAll(async function () {
    await api.disconnect();
    process.kill('SIGTERM');
  });

  it.only('Should transfer ZTG', async function() {
    const SUDO = sudo();

    // Gives contract DEV to burn during cross
    const transfer = api.tx.balances.transfer(contract.address, 500_000_000_000n);
    await transfer.signAndSend(new Keyring({ type: 'sr25519' }).addFromUri('//Alice'));

    // Initiates send
    const transferAmount = 5_000_000_000n;
    const randomAddress = generateRandomAddress();
    const { gasRequired } = await contract.query.transfer(SUDO.address, maxWeight2(api), randomAddress, transferAmount);
    await new Promise(async (resolve, _) => {
      await contract.tx
        .transfer(createGas(api, gasRequired), randomAddress, 5_000_000_000n)
        .signAndSend(sudo(), async (res) => {
          if (res.status.isInBlock) resolve(null);
        });
    });
    

    // Query for balance change
    const { data: { free: balance } } = await api.query.system.account(randomAddress) as AccountInfo;
    expect(balance.toBigInt()).to.equal(transferAmount);
  });
});
