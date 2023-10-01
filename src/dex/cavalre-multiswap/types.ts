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

export type AssetStates = {
  [address: Address]: TokenState;
};

export interface PoolState extends TokenState {
  assets: AssetStates;
  addresses: Address[];
}

export type CavalreMultiswapData = {
  // TODO: CavalreMultiswapData is the dex data that is
  // returned by the API that can be used for
  // tx building. The data structure should be minimal.
  // Complete me!
  exchange: Address;
};

export type DexParams = {
  // TODO: DexParams is set of parameters the can
  // be used to initiate a DEX fork.
  // Complete me!
};
