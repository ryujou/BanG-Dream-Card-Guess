export function loadWifiQr() {
  try {
    return { ssid: "", password: "", auth: "WPA", ...JSON.parse(localStorage.getItem("bangbangcai:wifi") || "{}") };
  } catch {
    return { ssid: "", password: "", auth: "WPA" };
  }
}

export function saveWifiQr(wifiQr: Record<string, unknown> | null) {
  localStorage.setItem("bangbangcai:wifi", JSON.stringify(wifiQr));
}

export function escapeWifi(str: string) {
  return str.replace(/([\\;:])/g, "\\$1");
}

export function wifiQrText(value: Record<string, unknown> | null) {
  if (!(value && (value as any).ssid)) return "";
  const auth = (value as any).auth === "nopass" ? "nopass" : "WPA";
  const pass = auth === "nopass" ? "" : escapeWifi((value as any).password);
  return `WIFI:T:${auth};S:${escapeWifi((value as any).ssid)};P:${pass};;`;
}
