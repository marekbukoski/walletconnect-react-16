import { PublicKey } from "@solana/web3.js";

export function getPublicKeysFromAccounts(accounts) {
  return (
    accounts
      // Filter out any non-solana accounts.
      .filter((account) => account.startsWith("solana:"))
      // Create a map of Solana address -> publicKey.
      .reduce((map, account) => {
        const address = account.split(":").pop();
        if (!address) {
          throw new Error(
            `Could not derive Solana address from CAIP account: ${account}`
          );
        }
        map[address] = new PublicKey(address);
        return map;
      }, {})
  );
}
