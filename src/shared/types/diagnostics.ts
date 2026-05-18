export interface HealthSnapshot {
  totalCards: number;
  filteredCards: number;
  cachedSets: number;
  cachePercent: number;
  roleCounts: Record<string, number>;
  preloaded: boolean;
  effectiveFaceCropMode: string;
  ok: boolean;
  appMode: string;
  uptimeMs: number;
  version: string;
  nodeVersion: string;
  connectedClients: number;
  roles: Record<string, number>;
  cache: Record<string, unknown>;
  game: Record<string, unknown>;
  services: Record<string, unknown>;
  network: Record<string, unknown>;
  errors: Record<string, unknown>;
}

export interface DiagnosticsSnapshot {
  ok: boolean;
  exportMode: boolean;
  generatedAt: string;
  health: HealthSnapshot;
  network: Record<string, unknown>;
  websocket: Record<string, unknown>;
  game: Record<string, unknown>;
  cache: Record<string, unknown>;
  scores: Record<string, unknown>;
  recentErrors: Array<Record<string, unknown>>;
}
