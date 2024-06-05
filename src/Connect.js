import React, { useEffect } from "react";
import { useWalletConnectClient } from "./context/ClientContext";

export const Connect = () => {
  const { connectedBlockchains, setChains, connect, session, isInitializing } =
    useWalletConnectClient();


  return (
    <div>
      <button disabled={isInitializing} onClick={() => connect()}>Connect</button>
    </div>
  );
};
