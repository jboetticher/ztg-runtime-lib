import { expect } from 'chai';
import { createGas, deployTestContract, getAPI, maxWeight2, setSudoKey, startNode, sudo, waitBlocks } from '../utils.js';
import { ChildProcess } from 'child_process';
import { ApiPromise, Keyring } from '@polkadot/api';
import { ContractPromise } from '@polkadot/api-contract';
import { cryptoWaitReady } from '@polkadot/util-crypto';

describe('zrml-authorized Runtime Calls', function () {
  let api: ApiPromise;
  let contract: ContractPromise;
  let process: ChildProcess;

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

  // NOTE: can only be called with the sudo.sudo() extrinsic
  it.skip('Should authorize a market outcome', async function() {});
});
