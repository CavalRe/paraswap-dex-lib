import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Log, Logger } from '../../types';
import { catchParseLogError } from '../../utils';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { PoolState, PoolStateMap } from './types';
import { Address } from '../../types';
import _ from 'lodash';

const ONE = BigInt(10 ** 18);
function typecastReadOnlyPoolState(pool: DeepReadonly<PoolState>): PoolState {
  return _.cloneDeep(pool) as PoolState;
}
export class CavalReMultiswapEventPool extends StatefulEventSubscriber<PoolStateMap> {
  handlers: {
    [event: string]: (
      event: any,
      state: PoolState,
      log: Readonly<Log>,
    ) => PoolState; //| null;
  } = {};

  //pools: PoolStateMap = {};

  logDecoder: (log: Log) => any;

  addressesSubscribed: string[];

  constructor(
    readonly parentName: string,
    protected network: number,
    public poolAddress: Address,
    protected dexHelper: IDexHelper,
    logger: Logger,
    protected cavalreMultiswapIface = new Interface(
      '' /* TODO: Import and put here CavalreMultiswap ABI */,
    ), // TODO: add any additional params required for event subscriber
  ) {
    // TODO: Add pool name
    super(parentName, 'POOL_NAME', dexHelper, logger);

    // TODO: make logDecoder decode logs that
    this.logDecoder = (log: Log) => this.cavalreMultiswapIface.parseLog(log);
    this.addressesSubscribed = [
      /* subscribed addresses */
    ];

    // Add handlers
    //this.handlers['myEvent'] = this.handleMyEvent.bind(this);
  }

  /**
   * The function is called every time any of the subscribed
   * addresses release log. The function accepts the current
   * state, updates the state according to the log, and returns
   * the updated state.
   * @param state - Current state of event subscriber
   * @param log - Log released by one of the subscribed addresses
   * @returns Updates state of the event subscriber after the log
   */
  protected processLog(
    state: DeepReadonly<PoolStateMap>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolStateMap> | null {
    const _state: PoolStateMap = {};
    for (const [address, pool] of Object.entries(state))
      _state[address] = typecastReadOnlyPoolState(pool);

    try {
      const event = this.logDecoder(log);
      if (event.name in this.handlers) {
        const poolAddress = event.args.poolId.slice(0, 42).toLowerCase();
        if (poolAddress in _state) {
          _state[poolAddress] = this.handlers[event.name](
            event,
            _state[poolAddress],
            log,
          );
        }
        //return this.handlers[event.name](event, state, log);
      }
    } catch (e) {
      catchParseLogError(e, this.logger);
    }

    return null;
  }

  async fetchPools(): Promise<PoolStateMap> {
    // Fetch pools from network
    return {};
  }

  /**
   * The function generates state using on-chain calls. This
   * function is called to regenerate state if the event based
   * system fails to fetch events and the local state is no
   * more correct.
   * @param blockNumber - Blocknumber for which the state should
   * should be generated
   * @returns state of the event subscriber at blocknumber
   */
  async generateState(
    blockNumber: number,
  ): Promise<DeepReadonly<PoolStateMap>> {
    const pools = await this.fetchPools();
    //this.pools = pools;
    //const poolState = pools[this.poolAddress.toLowerCase() as Address];
    return pools;
  }

  // Its just a dummy example
  handleMyEvent(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    return null;
  }
}
