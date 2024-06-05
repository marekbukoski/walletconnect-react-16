import React from 'react';
import { ClientContextProvider } from "./context/ClientContext";
import { Connect as ConnectComponent } from "./Connect";

function App() {
  return (
    <ClientContextProvider>
      <ConnectComponent />
    </ClientContextProvider>
  );
}

export default App;
