import React from "react";
import Client from "@walletconnect/sign-client";
import { Web3Modal } from "@web3modal/standalone";
import { RELAYER_EVENTS } from "@walletconnect/core";

// import { PublicKey } from "@solana/web3.js";
import {
  createContext,
  // ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { getAppMetadata, getSdkError } from "@walletconnect/utils";
import {
  DEFAULT_APP_METADATA,
  DEFAULT_LOGGER,
  DEFAULT_PROJECT_ID,
  DEFAULT_RELAY_URL,
} from "../constants";
import { AccountBalances, apiGetAccountBalance } from "../helpers";
import {
  getOptionalNamespaces,
  getRequiredNamespaces,
} from "../helpers/namespaces";
// import { getPublicKeysFromAccounts } from "../helpers/solana";
import { logger } from "../library/logger";

/**
 * Types
 */
// interface IContext {
//   client: Client | undefined;
//   session: SessionTypes.Struct | undefined;
//   connect: (pairing?: { topic: string }) => Promise<void>;
//   disconnect: () => Promise<void>;
//   isInitializing: boolean;
//   chains: string[];
//   relayerRegion: string;
//   pairings: PairingTypes.Struct[];
//   accounts: string[];
//   solanaPublicKeys?: Record<string, PublicKey>;
//   balances: AccountBalances;
//   isFetchingBalances: boolean;
//   setChains: (chains: string[]) => void;
//   setRelayerRegion: any;
//   origin: string;
//   connectedBlockchains: string[];
// }

/**
 * Context
 */
export const ClientContext = createContext();

/**
 * Web3Modal Config
 */
const web3Modal = new Web3Modal({
  projectId: DEFAULT_PROJECT_ID,
  themeMode: "dark",
  walletConnectVersion: 2,
});

/**
 * Provider
 */
export function ClientContextProvider({ children }) {
  const [client, setClient] = useState();
  const [pairings, setPairings] = useState([]);
  const [session, setSession] = useState();

  const [isFetchingBalances, setIsFetchingBalances] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const prevRelayerValue = useRef("");

  const [balances, setBalances] = useState({});
  const [accounts, setAccounts] = useState([]);
  const [solanaPublicKeys, setSolanaPublicKeys] = useState();
  const [chains, setChains] = useState([
    "eip155:1",
    "tron:0x2b6653dc",
  ]);
  const [relayerRegion, setRelayerRegion] = useState(DEFAULT_RELAY_URL);
  const [origin, setOrigin] = useState(getAppMetadata().url);
  const reset = () => {
    setSession(undefined);
    setBalances({});
    setAccounts([]);
    setChains([]);
    setRelayerRegion(DEFAULT_RELAY_URL);
  };

  const connectedBlockchains = useMemo(
    () =>
      accounts?.map((account) => {
        const [namespace] = account.split(":");
        return namespace === "eip155"
          ? "eth"
          : namespace === "tron"
            ? "trx"
            : "";
      }) ?? [],
    [accounts],
  );
  useEffect(() => {
    logger.info(
      "[ClientContextProvider,useEffect]",
      "connectedBlockchains",
      connectedBlockchains,
    );
  }, [connectedBlockchains]);

  const getAccountBalances = async (_accounts) => {
    setIsFetchingBalances(true);
    try {
      const arr = await Promise.all(
        _accounts.map(async (account) => {
          const [namespace, reference, address] = account.split(":");
          const chainId = `${namespace}:${reference}`;
          const assets = await apiGetAccountBalance(address, chainId);

          return { account, assets: [assets] };
        }),
      );

      const balances = {};
      arr.forEach(({ account, assets }) => {
        balances[account] = assets;
      });
      setBalances(balances);
    } catch (e) {
      logger.error("[ClientContext, getAccountBalance]", e);
    } finally {
      setIsFetchingBalances(false);
    }
  };

  const onSessionConnected = useCallback(
    async (_session) => {
      const allNamespaceAccounts = Object.values(_session.namespaces)
        .map((namespace) => namespace.accounts)
        .flat();
      const allNamespaceChains = Object.keys(_session.namespaces);

      setSession(_session);
      setChains(allNamespaceChains);
      setAccounts(allNamespaceAccounts);
      // setSolanaPublicKeys(
      //   getPublicKeysFromAccounts(allNamespaceAccounts),
      // );

      await getAccountBalances(allNamespaceAccounts);
    },
    [],
  );

  const connect = useCallback(
    async (pairing) => {
      console.log(client, '------connect------');
      if (typeof client === "undefined") {
        throw new Error("WalletConnect is not initialized");
      }
      logger.info("[ClientContextProvider,connect]", "connect, pairing topic is:", pairing?.topic);
      try {
        const requiredNamespaces = getRequiredNamespaces(chains);
        logger.info(
          "[ClientContextProvider,connect]",
          "requiredNamespaces config for connect:",
          requiredNamespaces,
        );
        const optionalNamespaces = getOptionalNamespaces(chains);
        logger.info(
          "[ClientContextProvider,connect]",
          "optionalNamespaces config for connect:",
          optionalNamespaces,
        );
        const { uri, approval } = await client.connect({
          pairingTopic: pairing?.topic,
          requiredNamespaces,
          optionalNamespaces,
        });

        // Open QRCode modal if a URI was returned (i.e. we're not connecting an existing pairing).
        if (uri) {
          // Create a flat array of all requested chains across namespaces.
          const standaloneChains = Object.values(requiredNamespaces)
            .map((namespace) => namespace.chains)
            .flat();

          web3Modal.openModal({ uri, standaloneChains });
        }

        const session = await approval();
        logger.info(
          "[ClientContextProvider,connect]",
          "Established session:",
          session,
        );
        await onSessionConnected(session);
        // Update known pairings after session is connected.
        setPairings(client.pairing.getAll({ active: true }));
      } catch (e) {
        logger.error("[ClientContextProvider,connect]", e);
        // toast.error((e).message, {
        //   position: "bottom-left",
        // });
        // ignore rejection
      } finally {
        // close modal in case it was open
        web3Modal.closeModal();
      }
    },
    [chains, client, onSessionConnected],
  );

  const disconnect = useCallback(async () => {
    if (typeof client === "undefined") {
      throw new Error("WalletConnect is not initialized");
    }
    if (typeof session === "undefined") {
      throw new Error("Session is not connected");
    }

    try {
      await client.disconnect({
        topic: session.topic,
        reason: getSdkError("USER_DISCONNECTED"),
      });
    } catch (error) {
      // toast.error((error).message, {
      //   position: "bottom-left",
      // });
      return;
    }
    // Reset app state after disconnect.
    reset();
  }, [client, session]);

  const _subscribeToEvents = useCallback(
    async (_client) => {
      if (typeof _client === "undefined") {
        throw new Error("WalletConnect is not initialized");
      }

      _client.on("session_ping", (args) => {
        logger.info(
          "[ClientContextProvider,session_ping]",
          "EVENT",
          "session_ping",
          args,
        );
      });

      _client.on("session_event", (args) => {
        logger.info(
          "[ClientContextProvider,session_event]",
          "EVENT",
          "session_event",
          args,
        );
      });

      _client.on("session_update", ({ topic, params }) => {
        logger.info(
          "[ClientContextProvider,session_update]",
          "EVENT",
          "session_update",
          { topic, params },
        );
        const { namespaces } = params;
        const _session = _client.session.get(topic);
        const updatedSession = { ..._session, namespaces };
        onSessionConnected(updatedSession);
      });

      _client.on("session_delete", () => {
        logger.info(
          "[ClientContextProvider,session_delete]",
          "EVENT",
          "session_delete",
        );
        reset();
      });
    },
    [onSessionConnected],
  );

  const _checkPersistedState = useCallback(
    async (_client) => {
      if (typeof _client === "undefined") {
        throw new Error("WalletConnect is not initialized");
      }
      // populates existing pairings to state
      setPairings(_client.pairing.getAll({ active: true }));
      logger.info(
        "[ClientContextProvider,_checkPersistedState]",
        "RESTORED PAIRINGS: ",
        _client.pairing.getAll({ active: true }),
      );

      if (typeof session !== "undefined") return;
      // populates (the last) existing session to state
      if (_client.session.length) {
        const lastKeyIndex = _client.session.keys.length - 1;
        const _session = _client.session.get(
          _client.session.keys[lastKeyIndex],
        );
        logger.info(
          "[ClientContextProvider,_checkPersistedState]",
          "RESTORED SESSION:",
          _session,
        );
        await onSessionConnected(_session);
        return _session;
      }
    },
    [session, onSessionConnected],
  );

  const _logClientId = useCallback(async (_client) => {
    if (typeof _client === "undefined") {
      throw new Error("WalletConnect is not initialized");
    }
    try {
      const clientId = await _client.core.crypto.getClientId();
      logger.info(
        "[ClientContextProvider,_logClientId]",
        "WalletConnect ClientID: ",
        clientId,
      );
      localStorage.setItem("WALLETCONNECT_CLIENT_ID", clientId);
    } catch (error) {
      logger.error(
        "[ClientContextProvider,_logClientId]",
        "Failed to set WalletConnect clientId in localStorage: ",
        error,
      );
    }
  }, []);

  const createClient = useCallback(async () => {
    try {
      // as you can see here, I set it to true.
      setIsInitializing(true);
      const claimedOrigin = localStorage.getItem("wallet_connect_dapp_origin") || origin;

      console.log("Starting WalletConnect client initialization...");
      console.log("Client:", Client);

      const metadata = {
        ...(getAppMetadata() || DEFAULT_APP_METADATA),
        description: "WalletConnect Onramp App",
        url: claimedOrigin,
        verifyUrl: claimedOrigin === "unknown" ? "http://non-existent-url" : DEFAULT_APP_METADATA.verifyUrl,
      };

      console.log(metadata, '------metadata------')

      // here, Client.init takes long time maybe forever.

      const _client = await Client.init({
        logger: DEFAULT_LOGGER,
        relayUrl: relayerRegion,
        projectId: DEFAULT_PROJECT_ID,
        metadata,
      });

      // Timeout if initialization takes too long
      // const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Initialization timeout")), 10000));

      // const _client = await _clientPromise();

      setClient(_client);
      setOrigin(_client.metadata.url);
      prevRelayerValue.current = relayerRegion;
      await _subscribeToEvents(_client);
      await _checkPersistedState(_client);
      await _logClientId(_client);
    } catch (err) {
      console.error("Error initializing WalletConnect client:", err);
    } finally {
      // when init is finished with error or not it set isInitializing to false, right?
      setIsInitializing(false);
      console.log("Initialization process completed, isInitializing set to false");
    }
  }, [
    _checkPersistedState,
    _subscribeToEvents,
    _logClientId,
    relayerRegion,
    origin,
  ]);

  useEffect(() => {
    if (!client) {
      createClient();
    } else if (
      prevRelayerValue.current &&
      prevRelayerValue.current !== relayerRegion
    ) {
      client.core.relayer.restartTransport(relayerRegion);
      prevRelayerValue.current = relayerRegion;
    }
  }, [createClient, relayerRegion, client]);

  useEffect(() => {
    if (!client) return;
    client.core.relayer.on(RELAYER_EVENTS.connect, () => {
      // toast.success("Network connection is restored!", {
      //   position: "bottom-left",
      // });
    });

    client.core.relayer.on(RELAYER_EVENTS.disconnect, () => {
      // toast.error("Network connection lost.", {
      //   position: "bottom-left",
      // });
    });
  }, [client]);

  const value = useMemo(
    () => ({
      pairings,
      isInitializing,
      balances,
      isFetchingBalances,
      accounts,
      solanaPublicKeys,
      chains,
      relayerRegion,
      client,
      session,
      connect,
      disconnect,
      setChains,
      setRelayerRegion,
      origin,
      connectedBlockchains,
    }),
    [
      pairings,
      isInitializing,
      balances,
      isFetchingBalances,
      accounts,
      solanaPublicKeys,
      chains,
      relayerRegion,
      client,
      session,
      connect,
      disconnect,
      setChains,
      setRelayerRegion,
      origin,
      connectedBlockchains,
    ],
  );

  return (
    <ClientContext.Provider
      value={{
        ...value,
      }}
    >
      {children}
    </ClientContext.Provider>
  );
}

export function useWalletConnectClient() {
  const context = useContext(ClientContext);
  if (context === undefined) {
    throw new Error(
      "useWalletConnectClient must be used within a ClientContextProvider",
    );
  }
  return context;
}
