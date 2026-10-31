import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./lib/auth";
import "./styles.css";
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>,
);

// Prompt the existing legacy worker to fetch its retirement script.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => Promise.all(
    registrations.filter(registration => registration.active?.scriptURL === `${location.origin}/sw.js`)
      .map(registration => registration.update()),
  )).catch(error => console.warn("旧版离线缓存更新失败", error));
}