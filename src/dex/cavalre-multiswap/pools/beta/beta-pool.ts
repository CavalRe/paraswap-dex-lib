import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Log, Logger } from '../../../../types';
import { catchParseLogError } from '../../../../utils';
import { StatefulEventSubscriber } from '../../../../stateful-event-subscriber';
import { IDexHelper } from '../../../../dex-helper/idex-helper';
import { PoolState, PoolStateMap } from '../.././types';
import { Address } from '../../../../types';
import { typecastReadOnly } from '../../utils';
import BetaPoolABI from '../../../../abi/cavalre-multiswap/cavalre-multiswap-beta.json';

export class BetaCavalReMultiswapEventPool extends StatefulEventSubscriber<PoolState> {
  handlers: {
    [event: string]: (
      event: any,
      state: PoolState,
      log: Readonly<Log>,
    ) => PoolState /* | null; */;
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
    protected betaCavalreMultiswapIface = new Interface(BetaPoolABI), // TODO: add any additional params required for event subscriber
  ) {
    // TODO: Add pool name
    super(parentName, 'Beta', dexHelper, logger);

    // TODO: make logDecoder decode logs that
    this.logDecoder = (log: Log) =>
      this.betaCavalreMultiswapIface.parseLog(log);
    this.addressesSubscribed = [poolAddress];

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
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    let _state: PoolState = typecastReadOnly<PoolState>(state);
    try {
      const event = this.logDecoder(log);
      if (event.name in this.handlers) {
        _state = this.handlers[event.name](event, _state, log);
      }
      return _state;
      //return this.handlers[event.name](event, state, log);
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
  async generateState(blockNumber: number): Promise<DeepReadonly<PoolState>> {
    const pools = await this.fetchPools();
    //this.pools = pools;
    //const poolState = pools[this.poolAddress.toLowerCase() as Address];
    return {} as PoolState; //pools;
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
