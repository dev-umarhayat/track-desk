import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import { WidgetWindow } from "./widget/WidgetWindow";
import { DevSyncScreen } from "./screens/DevSyncScreen";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/widget" element={<WidgetWindow />} />
        {import.meta.env.DEV && <Route path="/dev" element={<DevSyncScreen />} />}
        <Route path="/" element={<App />} />
      </Routes>
    </HashRouter>
  </React.StrictMode>,
);
