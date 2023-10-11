import { Interface } from '@ethersproject/abi';
import {
  Token,
  Address,
  ExchangePrices,
  PoolPrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
} from '../../types';
import { SwapSide, Network } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { CavalReMultiswapData, CavalrePoolType, DexParams } from './types';
import { SimpleExchange } from '../simple-exchange';
import { CavalReMultiswapConfig, Adapters } from './config';
import { CavalReMultiswapEventPool } from './cavalre-multiswap-pool';
import BetaPoolABI from '../../abi/cavalre-multiswap/cavalre-multiswap-beta.json';
import { BetaCavalReMultiswapEventPool } from './pools/beta/beta-pool';
import { Config } from '../aave-v3/config';

//For when there are multiple pool types can just add more here
export type CavalReMultiswapEventPools = BetaCavalReMultiswapEventPool;
export class CavalReMultiswap
  extends SimpleExchange
  implements IDex<CavalReMultiswapData>
{
  protected eventPools: {
    [key: Address]: CavalReMultiswapEventPools;
  } = {};
  protected poolsLiquidityUsd: { [key: string]: number } = {};
  protected dexParams: DexParams;
  protected config: any;
  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = true;
  readonly isFeeOnTransferSupported = false;

  static readonly betaPoolInterface = new Interface(BetaPoolABI);

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(CavalReMultiswapConfig);

  logger: Logger;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected adapters = Adapters[network] || {}, // TODO: add any additional optional params to support other fork DEXes
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    this.dexParams = CavalReMultiswapConfig[dexKey][network];
    this.createEventPools();
  }
  /**
   * Create event pools for each pool type
   */
  createEventPools(): void {
    //const poolAddresses = this.dexParams.poolAddresses;
    this.eventPools = this.dexParams.pools.reduce((acc, pool) => {
      switch (pool.type) {
        case CavalrePoolType.BETA:
          acc[pool.address] = new BetaCavalReMultiswapEventPool(
            this.dexKey,
            this.network,
            pool.address,
            this.dexHelper,
            this.logger,
            CavalReMultiswap.betaPoolInterface,
          );
          break;
        default:
          break;
      }
      return acc;
    }, {} as { [key: Address]: CavalReMultiswapEventPools });
  }
  async init(blockNumber: number) {
    if (!this.config) return;
  }
  async setupEventPools(blockNumber: number) {
    for (const eventPool of Object.values(this.eventPools)) {
      await eventPool.initialize(blockNumber);
    }
    //await this.eventPools.initialize(blockNumber);
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    await this.setupEventPools(blockNumber);
  }

  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[side] ? this.adapters[side] : null;
  }

  getPoolsWithTokenPair(srcToken: Token, destToken: Token): Address[] {
    //const poolStateMap = this.eventPools.pools; //need to change things.
    const pools = Object.entries(this.eventPools)
      .filter(([, pool]) =>
        pool.checkTokenSwapSupport(srcToken.address, destToken.address),
      )
      .map(([poolAddress]) => poolAddress) as Address[];
    return pools;
  }

  // Returns list of pool identifiers that can be used
  // for a given swap. poolIdentifiers must be unique
  // across DEXes. It is recommended to use
  // ${dexKey}_${poolAddress} as a poolIdentifier
  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    const pools = this.getPoolsWithTokenPair(srcToken, destToken);
    return pools.map(address => `${this.dexKey}_${address}`);
  }

  // export type ExchangePrices<T> = PoolPrices<T>[];

  // export type PoolPrices<T> = {
  //   prices: bigint[];
  //   unit: bigint;
  //   data: T;
  //   poolIdentifier?: string;
  //   exchange: string;
  //   gasCost: number | number[];
  //   gasCostL2?: number | number[];
  //   poolAddresses?: Array<Address>;
  // };

  // Returns pool prices for amounts.
  // If limitPools is defined only pools in limitPools
  // should be used. If limitPools is undefined then
  // any pools can be used.
  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<CavalReMultiswapData>> {
    //const poolState = this.eventPools.getState(blockNumber);

    // TODO: complete me!
    return null;
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(
    poolPrices: PoolPrices<CavalReMultiswapData>,
  ): number | number[] {
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
  }

  // Encode params required by the exchange adapter
  // Used for multiSwap, buy & megaSwap
  // Hint: abiCoder.encodeParameter() could be useful
  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: CavalReMultiswapData,
    side: SwapSide,
  ): AdapterExchangeParam {
    const { exchange } = data;
    const payload = '';

    return {
      targetExchange: exchange,
      payload,
      networkFee: '0',
    };
  }
  async getCavalReMultiswapParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: CavalReMultiswapData, //dont know if this is right.
    side: SwapSide,
  ): Promise<AdapterExchangeParam> {
    const { exchange } = data;
    const payload = '';

    return {
      targetExchange: exchange,
      payload,
      networkFee: '0',
    };
  }

  // Encode call data used by simpleSwap like routers
  // Used for simpleSwap & simpleBuy
  // Hint: this.buildSimpleParamWithoutWETHConversion
  // could be useful
  async getSimpleParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: CavalReMultiswapData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    // TODO: complete me!
    const { exchange } = data;
    //TODO: need to change this to the correct interface.
    //Use the getCavalReMultiswapParam once its built to find which pool to use for simple swap.
    // Encode here the transaction arguments
    const swapData = CavalReMultiswap.betaPoolInterface.encodeFunctionData(
      'swap',
      [srcToken, destToken, srcAmount, 0n],
    );

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      exchange,
    );
  }

  // This is called once before getTopPoolsForToken is
  // called for multiple tokens. This can be helpful to
  // update common state required for calculating
  // getTopPoolsForToken. It is optional for a DEX
  // to implement this
  async updatePoolState(): Promise<void> {
    Object.values(this.eventPools).forEach(eventPool => {});
    //TODO: I think this should calculate the USD value of the pools liquidity
    // and store it in this.poolsLiquidityUsd
  }

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    //TODO: complete me!
    // I think this should return the top pools based on liquidity USD value
    return [];
  }
}
