import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network } from '../../constants';

export const CavalReMultiswapConfig: DexConfigMap<DexParams> = {
  CavalReMultiswap: {
    [Network.AVALANCHE]: {
      pools: {},
    },
  },
};

export const Adapters: Record<number, AdapterMappings> = {};
