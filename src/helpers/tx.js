import * as encoding from "@walletconnect/encoding";
import { Web3 } from "web3";
import { apiGetAccountNonce, apiGetGasPrice } from "./api";
import { logger } from "../library/logger";

export async function formatTestTransaction(
  account,
  to,
  value,
  token,
) {
  const [namespace, reference, address] = account.split(":");
  const chainId = `${namespace}:${reference}`;

  let _nonce;
  try {
    _nonce = await apiGetAccountNonce(address, chainId);
  } catch (error) {
    throw new Error(
      `Failed to fetch nonce for address ${address} on chain ${chainId}`,
    );
  }

  const nonce = encoding.sanitizeHex(encoding.numberToHex(_nonce));

  // gasPrice
  const _gasPrice = await apiGetGasPrice(chainId);
  const gasPrice = encoding.sanitizeHex(_gasPrice);

  // gasLimit
  const _gasLimit = token ? 200000 : 21000;
  const gasLimit = encoding.sanitizeHex(_gasLimit.toString(16));

  logger.info("[tx,formatTestTransaction]", "value", value);
  // value
  const _value = value ?? 0;
  const finalValue = encoding.sanitizeHex(_value.toString(16));

  logger.info("[tx,formatTestTransaction]", "finalValue", finalValue);

  if (token) {
    const web3 = new Web3(
      "https://mainnet.infura.io/v3/489e1ceeee054df59d25fca03bdba984",
    );
    const contract = new web3.eth.Contract(
      [
        {
          constant: false,
          inputs: [
            {
              name: "_to",
              type: "address",
            },
            {
              name: "_value",
              type: "uint256",
            },
          ],
          name: "transfer",
          outputs: [],
          payable: false,
          stateMutability: "nonpayable",
          type: "function",
        },
      ],
      token,
    );

    const data = contract.methods.transfer(to, finalValue).encodeABI();

    return {
      from: address,
      to: token,
      data,
      nonce,
      gasPrice,
      gasLimit,
      value: "0x00",
    };
  } else {
    return {
      from: address,
      to: to,
      data: "0x",
      nonce,
      gasPrice,
      gasLimit,
      value: finalValue,
    };
  }
}
