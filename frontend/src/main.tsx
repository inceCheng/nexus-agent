import React from "react";
import ReactDOM from "react-dom/client";

import { NexusWorkspace } from "./components/nexus-workspace";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <NexusWorkspace />
  </React.StrictMode>,
);
