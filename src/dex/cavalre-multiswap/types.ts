import { Address } from '../../types';

export type Dict<T> = {
  [key: string]: T;
};

export type TokenState = {
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
  conversion: bigint; // Used to convert decimals
  balance: bigint; // Token reserves
  fee: bigint;
  scale: bigint; // Used to compute weight
  weight: bigint;
};

export type AssetStateMap = {
  [address: Address]: TokenState;
};

export interface PoolState extends TokenState {
  assets: AssetStateMap;
  addresses: Address[];
}

export type PoolStateMap = {
  [address: Address]: PoolState;
};

export type CavalReMultiswapData = {
  // TODO: CavalReMultiswapData is the dex data that is
  // returned by the API that can be used for
  // tx building. The data structure should be minimal.
  // Complete me!
  exchange: Address;
};

export type DexParams = {
  pools: {
    address: Address;
    name: string;
  }[];
};
