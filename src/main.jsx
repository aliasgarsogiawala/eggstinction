import React from "react";
import ReactDOM from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App";
import "./styles.css";

const convexUrl = import.meta.env.VITE_CONVEX_URL;

const root = ReactDOM.createRoot(document.getElementById("root"));

if (convexUrl) {
  const client = new ConvexReactClient(convexUrl);
  root.render(
    <React.StrictMode>
      <ConvexProvider client={client}>
        <App connected />
      </ConvexProvider>
    </React.StrictMode>
  );
} else {
  // No Convex deployment linked yet — playable offline, leaderboard disabled.
  root.render(
    <React.StrictMode>
      <App connected={false} />
    </React.StrictMode>
  );
}
