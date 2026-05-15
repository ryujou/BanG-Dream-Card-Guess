import * as network from "../network.js";

export interface NetworkService {
  getLocalAddresses(): string[];
  getPublicRoutes(activePort: number): unknown[];
  networkState(req: unknown): any;
  lanHosts(): string[];
}

export function createNetworkService(): NetworkService {
  return {
    getLocalAddresses: () => network.lanHosts() as string[],
    getPublicRoutes(activePort) {
      return network.originList(activePort).map((origin: string) => network.pageUrls(origin));
    },
    networkState: network.networkState,
    lanHosts: () => network.lanHosts() as string[],
  };
}

export function createFakeNetworkService(hosts = ["127.0.0.1"]): NetworkService {
  return {
    getLocalAddresses: () => hosts.slice(),
    getPublicRoutes: (activePort) => hosts.map((host) => `http://${host}:${activePort}/host`),
    networkState: () => ({ lanHosts: hosts.slice(), routes: [] }),
    lanHosts: () => hosts.slice(),
  };
}
