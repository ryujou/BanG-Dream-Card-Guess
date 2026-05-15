// @ts-ignore Existing network module is authored as ESM JavaScript.
import * as network from "../../../src/server/network.mjs";
export function createNetworkService() {
    return {
        getLocalAddresses: network.lanHosts,
        getPublicRoutes(activePort) {
            return network.originList(activePort).map((origin) => network.pageUrls(origin));
        },
        networkState: network.networkState,
        lanHosts: network.lanHosts,
    };
}
export function createFakeNetworkService(hosts = ["127.0.0.1"]) {
    return {
        getLocalAddresses: () => hosts.slice(),
        getPublicRoutes: (activePort) => hosts.map((host) => `http://${host}:${activePort}/host`),
        networkState: () => ({ lanHosts: hosts.slice(), routes: [] }),
        lanHosts: () => hosts.slice(),
    };
}
