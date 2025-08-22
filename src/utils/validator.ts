import { isValidSuiAddress } from "@mysten/sui/utils";


export function validateAddress(address: string): string | null {
    if (!address) return "Address is required.";
    if (!isValidSuiAddress(address)) return "Not a valid Sui address.";
    return null;
}