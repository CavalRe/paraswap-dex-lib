/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { CavalReMultiswapEventPool } from './cavalre-multiswap-pool';
import { Network } from '../../constants';
import { Address, Logger } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { CavalrePoolType, DexParams, PoolState } from './types';
import { CavalReMultiswapConfig } from './config';
import {
  CavalReMultiswap,
  CavalReMultiswapEventPools,
} from './cavalre-multiswap';
import { BetaCavalReMultiswapEventPool } from './pools/beta/beta-pool';

/*
  README
  ======

  This test script adds unit tests for CavalReMultiswap event based
  system. This is done by fetching the state on-chain before the
  event block, manually pushing the block logs to the event-subscriber,
  comparing the local state with on-chain state.

  Most of the logic for testing is abstracted by `testEventSubscriber`.
  You need to do two things to make the tests work:

  1. Fetch the block numbers where certain events were released. You
  can modify the `./scripts/fetch-event-blocknumber.ts` to get the
  block numbers for different events. Make sure to get sufficient
  number of blockNumbers to cover all possible cases for the event
  mutations.

  2. Complete the implementation for fetchPoolState function. The
  function should fetch the on-chain state of the event subscriber
  using just the blocknumber.

  The template tests only include the test for a single event
  subscriber. There can be cases where multiple event subscribers
  exist for a single DEX. In such cases additional tests should be
  added.

  You can run this individual test script by running:
  `npx jest src/dex/<dex-name>/<dex-name>-events.test.ts`

  (This comment should be removed from the final implementation)
*/

jest.setTimeout(50 * 1000);

async function fetchPoolState(
  cavalreMultiswapPools: CavalReMultiswapEventPools,
  blockNumber: number,
  poolAddress: string,
): Promise<PoolState> {
  const state = await cavalreMultiswapPools.generateState(blockNumber);
  return {
    ...state,
    assetsAddresses: [...state.assetsAddresses],
  };
}

// eventName -> blockNumbers
type EventMappings = Record<string, number[]>;

describe('CavalReMultiswap EventPool Mainnet', function () {
  const dexKey = 'CavalReMultiswap';
  const network = Network.AVALANCHE;
  const dexHelper = new DummyDexHelper(network);
  const logger = dexHelper.getLogger(dexKey);
  let cavalreMultiswapPool: CavalReMultiswapEventPools;
  const dexParams = CavalReMultiswapConfig[dexKey][network];
  // poolAddress -> EventMappings
  const eventsToTest: Record<Address, EventMappings> = {
    // TODO: complete me!
  };

  Object.entries(eventsToTest).forEach(
    ([poolAddress, events]: [string, EventMappings], index) => {
      describe(`Events for ${poolAddress}`, () => {
        Object.entries(events).forEach(
          ([eventName, blockNumbers]: [string, number[]]) => {
            describe(`${eventName}`, () => {
              blockNumbers.forEach((blockNumber: number) => {
                it(`State after ${blockNumber}`, async function () {
                  cavalreMultiswapPool = createPool(
                    dexParams.pools[index],
                    dexKey,
                    network,
                    dexHelper,
                    logger,
                  );

                  await testEventSubscriber(
                    cavalreMultiswapPool,
                    cavalreMultiswapPool.addressesSubscribed,
                    (_blockNumber: number) =>
                      fetchPoolState(
                        cavalreMultiswapPool,
                        _blockNumber,
                        poolAddress,
                      ),
                    blockNumber,
                    `${dexKey}_${poolAddress}`,
                    dexHelper.provider,
                  );
                });
              });
            });
          },
        );
      });
    },
  );
});

const createPool = (
  pool: DexParams['pools'][0],
  dexKey: string,
  network: Network,
  dexHelper: DummyDexHelper,
  logger: Logger,
) => {
  switch (pool.type) {
    case CavalrePoolType.BETA:
      return new BetaCavalReMultiswapEventPool(
        dexKey,
        network,
        pool.address,
        dexHelper,
        logger,
        CavalReMultiswap.betaPoolInterface,
      );
    default:
      throw new Error('Invalid pool type');
  }
};
