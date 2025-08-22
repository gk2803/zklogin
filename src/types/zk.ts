import { getZkLoginSignature } from '@mysten/sui/zklogin';

export type PartialZkLoginSignature = Omit<Parameters<typeof getZkLoginSignature>["0"]["inputs"],
    "addressSeed">;