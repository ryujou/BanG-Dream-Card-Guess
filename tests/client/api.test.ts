import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

describe("first-visit session initialization", () => {
  it("clearing a revoked session makes the next mutation obtain a fresh CSRF token", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ csrfToken: "old" }))
      .mockResolvedValueOnce(Response.json({ csrfToken: "new" }))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetch);
    const { api, clearSession } = await import("../../src/client/lib/api");
    await api("/api/auth/me");
    clearSession();
    await api("/api/auth/login", { method: "POST", body: { username: "host", password: "test-password" } });
    expect(fetch.mock.calls.map(call => call[0])).toEqual(["/api/auth/me", "/api/auth/me", "/api/auth/login"]);
    expect(fetch.mock.calls[2][1].headers["X-CSRF-Token"]).toBe("new");
  });

  it.each([{ error: "详细错误" }, { message: "接口错误" }, {}])("reports a rejected JSON response: %j", async response => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(response, { status: 400 })));
    const { api } = await import("../../src/client/lib/api");
    await expect(api("/api/test")).rejects.toThrow("error" in response ? response.error : "message" in response ? response.message : "请求失败");
  });

  it("formats both Error objects and thrown primitive values", async () => {
    const { errorText } = await import("../../src/client/lib/api");
    expect(errorText(new Error("network"))).toBe("network");
    expect(errorText("offline")).toBe("offline");
  });
  it.each(["provider-first", "solo-first"])("shares auth and first write requests: %s", async order => {
    let finishSession!: (response: Response) => void;
    const waiting = new Promise<Response>(resolve => { finishSession = resolve; });
    const fetch = vi.fn().mockReturnValueOnce(waiting).mockResolvedValueOnce(Response.json({ id: "solo-1" }));
    vi.stubGlobal("fetch", fetch);
    const { api } = await import("../../src/client/lib/api");
    let identity: Promise<unknown>, solo: Promise<unknown>;
    if (order === "provider-first") {
      identity = api("/api/auth/me");
      solo = api("/api/solo", { method: "POST", body: { theme: "sekai" } });
    } else {
      solo = api("/api/solo", { method: "POST", body: { theme: "sekai" } });
      identity = api("/api/auth/me");
    }
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe("/api/auth/me");
    finishSession(Response.json({ user: null, csrfToken: "session-one" }));
    await expect(Promise.all([identity, solo])).resolves.toEqual([{ user: null, csrfToken: "session-one" }, { id: "solo-1" }]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1]).toEqual(["/api/solo", expect.objectContaining({ credentials: "same-origin", method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": "session-one" } })]);
  });

  it("shares concurrent refreshes and fetches fresh identity after login", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ user: null, csrfToken: "anonymous" }))
      .mockResolvedValueOnce(Response.json({ user: { id: "admin" }, csrfToken: "signed-in" }))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetch);
    const { api } = await import("../../src/client/lib/api");
    await Promise.all([api("/api/auth/me"), api("/api/auth/me")]);
    expect(fetch).toHaveBeenCalledTimes(1);
    const refresh = api("/api/auth/me");
    const save = api("/api/settings", { method: "PUT", body: { showTimer: false } });
    await expect(refresh).resolves.toMatchObject({ user: { id: "admin" } });
    await save;
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[2][1].headers["X-CSRF-Token"]).toBe("signed-in");
  });

  it("does not send a write after failed session creation and permits a later refresh", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ error: "会话创建失败" }, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ user: null, csrfToken: "recovered" }));
    vi.stubGlobal("fetch", fetch);
    const { api } = await import("../../src/client/lib/api");
    const results = await Promise.allSettled([api("/api/auth/me"), api("/api/solo", { method: "POST" })]);
    expect(results.map(result => result.status)).toEqual(["rejected", "rejected"]);
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(api("/api/auth/me")).resolves.toMatchObject({ csrfToken: "recovered" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
