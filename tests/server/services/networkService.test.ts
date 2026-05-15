import { describe, expect, it } from "vitest";
import { createFakeNetworkService } from "../../../src/server/services/networkService";

describe("network service", () => {
  it("fake network service exposes stable local addresses", () => {
    const service = createFakeNetworkService(["192.168.1.10"]);
    expect(service.getLocalAddresses()).toEqual(["192.168.1.10"]);
    expect(service.lanHosts()).toEqual(["192.168.1.10"]);
  });
});
