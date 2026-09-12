import "./styles/theme.css";
import "./styles/layout.css";
import "./styles/components.css";
import "./styles/auth.css";
import "./styles/feed.css";
import "./styles/compose.css";
import "./styles/profile.css";
import "./styles/messaging.css";
import "./styles/channels.css";
import "./styles/wallet.css";
import "./styles/notifications.css";
import "./styles/stories.css";
import "./styles/live.css";
import "./styles/live-room.css";
import "./styles/space.css";
import "./styles/calls.css";
import "./styles/shop.css";
import "./styles/leaderboard.css";
import "./styles/legal.css";
import "./styles/admin.css";
import "./styles/app-extras.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { AuthProvider } from "./auth";

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
