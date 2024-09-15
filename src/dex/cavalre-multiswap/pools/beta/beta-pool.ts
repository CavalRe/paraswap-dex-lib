import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import {
  ExchangePrices,
  Log,
  Logger,
  PoolPrices,
  Token,
} from '../../../../types';
import { catchParseLogError, getBigIntPow } from '../../../../utils';
import { StatefulEventSubscriber } from '../../../../stateful-event-subscriber';
import { IDexHelper } from '../../../../dex-helper/idex-helper';
import {
  AssetStateMap,
  CavalReBetaPoolConfigInfo,
  CavalReMultiswapData,
  PoolState,
  PoolStateMap,
  TokenState,
} from '../.././types';
import { Address } from '../../../../types';
import { ONE, typecastReadOnly } from '../../utils';
import BetaPoolABI from '../../../../abi/cavalre-multiswap/cavalre-multiswap-beta.json';
import { SwapSide } from '../../../../constants';
import { MultiswapBetaQuoteInputs, multiswapBetaQuote } from './beta-math';

export class BetaCavalReMultiswapEventPool extends StatefulEventSubscriber<PoolState> {
  handlers: {
    [event: string]: (
      event: any,
      state: PoolState,
      log: Readonly<Log>,
    ) => PoolState;
  } = {};

  //pools: PoolStateMap = {};
  protected config?: CavalReBetaPoolConfigInfo;
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
    this.handlers['BalanceUpdate'] = this.handleBalanceUpdate.bind(this);
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
    //const pools = await this.fetchPools();
    let multiCallData = [
      {
        target: this.poolAddress,
        callData: this.betaCavalreMultiswapIface.encodeFunctionData('info', []),
      },
      {
        target: this.poolAddress,
        callData: this.betaCavalreMultiswapIface.encodeFunctionData(
          'assets',
          [],
        ),
      },
    ];
    const returnData = (
      await this.dexHelper.multiContract.methods
        .aggregate(multiCallData)
        .call({}, blockNumber)
    ).returnData;
    const poolInfoRes = this.betaCavalreMultiswapIface.decodeFunctionResult(
      'info',
      returnData[0],
    )[0];
    const assetsRes = this.betaCavalreMultiswapIface.decodeFunctionResult(
      'assets',
      returnData[1],
    )[0];
    const poolInfo: TokenState = {
      address: poolInfoRes.token,
      name: poolInfoRes.name,
      symbol: poolInfoRes.symbol,
      decimals: poolInfoRes.decimals,
      balance: BigInt(poolInfoRes.balance.toString()),
      conversion: BigInt(1),
      weight: BigInt(1e18),
      fee: BigInt(0),
      scale: BigInt(poolInfoRes.scale.toString()),
    };
    const assets = assetsRes.reduce((acc: any, asset: any) => {
      acc[asset.token] = {
        address: asset.token,
        name: asset.name,
        symbol: asset.symbol,
        decimals: asset.decimals,
        conversion: BigInt(asset.conversion.toString()),
        balance: BigInt(asset.balance.toString()),
        fee: BigInt(asset.fee.toString()),
        scale: BigInt(asset.scale.toString()),
        weight:
          (BigInt(asset.scale.toString()) * BigInt(1e18)) / poolInfo.scale,
      } as TokenState;
      return acc;
    }, {} as AssetStateMap);
    const assetsAddresses = assetsRes.map((asset: any) => asset.token);
    const poolState: PoolState = {
      ...poolInfo,
      assets,
      assetsAddresses,
    };
    this.config = {
      poolAddress: this.poolAddress,
      tokenAddresses: assetsAddresses,
      tokens: assets,
    };

    //this.pools = pools;
    //const poolState = pools[this.poolAddress.toLowerCase() as Address];
    return poolState;
  }
  getConfig(): CavalReBetaPoolConfigInfo | undefined {
    return this.config;
  }
  checkTokenSwapSupport(srcToken: Address, destToken: Address): boolean {
    return (
      !!this.config &&
      this.config.tokenAddresses.includes(srcToken) &&
      this.config.tokenAddresses.includes(destToken)
    );
  }
  checkTokenSupport(srcToken: Address): boolean {
    return !!this.config && this.config.tokenAddresses.includes(srcToken);
  }

  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    poolIdentifier: string,
    limitPools?: string[],
  ): Promise<null | PoolPrices<CavalReMultiswapData>> {
    let poolState = this.getState(blockNumber);
    if (!poolState) {
      poolState = await this.generateState(blockNumber);
      this.setState(poolState, blockNumber);
    }
    const inputs: MultiswapBetaQuoteInputs[] = [
      getBigIntPow(srcToken.decimals),
      ...amounts,
    ].map(amt => ({
      payTokens: [srcToken.address],
      amounts: [amt],
      receiveTokens: [destToken.address],
      allocations: [BigInt(1)],
    }));
    const results = inputs
      .map(input => multiswapBetaQuote(poolState as PoolState, input))
      .filter(result => result.isValid);
    const unit = results[0].receiveAmounts[0];
    const prices = results.map(result => result.receiveAmounts[0]);
    const ret = {
      prices,
      unit,
      data: {
        exchange: this.poolAddress,
      },
      poolIdentifier,
      exchange: this.parentName,
      gasCost: 0,
    } as PoolPrices<CavalReMultiswapData>;
    return ret;
  }
  async getPoolLiquidityUSD() {
    const blockNumber = await this.dexHelper.web3Provider.eth.getBlockNumber();
    let poolState = this.getState(blockNumber);
    if (!poolState) {
      poolState = await this.generateState(blockNumber);
    }
    const { assets } = poolState;
    let assetLiquidityProm: Promise<number>[] = [];
    for (const asset of Object.values(assets)) {
      assetLiquidityProm.push(
        this.dexHelper.getTokenUSDPrice(
          { address: asset.address, decimals: asset.decimals },
          asset.balance,
        ),
      );
    }
    const assetLiquidity = await Promise.all(assetLiquidityProm);
    const totalLiquidity = assetLiquidity.reduce((acc, liquidity) => {
      return acc + liquidity;
    }, 0);

    return totalLiquidity;
  }

  handleBalanceUpdate(
    event: any,
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): PoolState {
    /* 
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "txCount",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "token",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "balance",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "meanBalance",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "userBalance",
        "type": "uint256"
      }
    ],
    */
    const assetAddress = event.args.token.toLowerCase() as Address;
    const assetBal = BigInt(event.args.balance.toString());
    const newAssetState = {
      ...state.assets[assetAddress],
      balance: assetBal,
    };
    return {
      ...state,
      assets: { ...state.assets, [assetAddress]: newAssetState },
    } as PoolState;
  }
}
