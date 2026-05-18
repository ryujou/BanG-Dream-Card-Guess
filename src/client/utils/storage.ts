export interface WifiQrConfig {
  ssid: string;
  password: string;
  auth: "WPA" | "nopass";
}

export function loadWifiQr(): WifiQrConfig {
  try {
    return { ssid: "", password: "", auth: "WPA", ...JSON.parse(localStorage.getItem("bangbangcai:wifi") || "{}") };
  } catch {
    return { ssid: "", password: "", auth: "WPA" };
  }
}

export function saveWifiQr(wifiQr: WifiQrConfig | null) {
  localStorage.setItem("bangbangcai:wifi", JSON.stringify(wifiQr));
}

export function escapeWifi(str: string) {
  return str.replace(/([\\;:])/g, "\\$1");
}

export function wifiQrText(value: WifiQrConfig | null) {
  if (!value?.ssid) return "";
  const auth = value.auth === "nopass" ? "nopass" : "WPA";
  const pass = auth === "nopass" ? "" : escapeWifi(value.password);
  return `WIFI:T:${auth};S:${escapeWifi(value.ssid)};P:${pass};;`;
}
