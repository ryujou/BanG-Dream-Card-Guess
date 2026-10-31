import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { HeroCharacters } from "../../src/client/components/HeroCharacters";
import { HERO_CHARACTERS, type HomeThemeId } from "../../src/client/lib/home-theme";

const art = () => document.querySelector<HTMLElement>("[data-hero-character]")!;
const source = () => art().dataset.heroCharacter;
const show = (themeId: HomeThemeId = "bluearchive", reduced = true) => render(<div style={{ position: "relative", width: 700, height: 650 }}><HeroCharacters themeId={themeId} reduced={reduced} /></div>);
beforeEach(() => { sessionStorage.clear(); vi.spyOn(Math, "random"); });
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

test("refresh avoids the last displayed character, with a separate record for each theme", async () => {
  for (const theme of ["bangdream", "sekai", "bluearchive"] as const) {
    for (let reload = 0; reload < 3; reload++) {
      const before = sessionStorage.getItem(`xtbang:hero:${theme}`);
      const view = await show(theme);
      await expect.poll(() => art().dataset.heroReady).toBe("true");
      expect(source()).not.toBe(before);
      expect(sessionStorage.getItem(`xtbang:hero:${theme}`)).toBe(source());
      expect(HERO_CHARACTERS[theme].some(character => character.src === source())).toBe(true);
      await view.unmount();
    }
  }
});

test("portraits rotate automatically across the end of the roster without visible controls", async () => {
  vi.mocked(Math.random).mockReturnValueOnce(.99999);
  await show("bluearchive", false);
  await expect.poll(() => art().dataset.heroReady).toBe("true");
  expect(source()).toBe(HERO_CHARACTERS.bluearchive[23].src);
  expect(art().querySelector("button")).toBeNull();
  expect(art().textContent).toBe("");
  await expect.poll(source, { timeout: 9000 }).toBe(HERO_CHARACTERS.bluearchive[0].src);
});

test("failed image decoding retains the current portrait and refresh can recover", async () => {
  const view = await show("bluearchive", false);
  await expect.poll(() => art().dataset.heroReady).toBe("true");
  const before = source();
  vi.spyOn(HTMLImageElement.prototype, "decode").mockRejectedValueOnce(new Error("Image failed"));
  await expect.poll(() => art().textContent, { timeout: 9000 }).toContain("立绘暂时加载失败，请刷新页面重试");
  expect(source()).toBe(before);
  expect(sessionStorage.getItem("xtbang:hero:bluearchive")).toBe(before);
  await view.unmount();
  await show();
  await expect.poll(() => art().dataset.heroReady).toBe("true");
  expect(source()).not.toBe(before);
});

test("reduced motion keeps a static portrait and changing the preference resumes rotation", async () => {
  const view = await show();
  await expect.poll(() => art().dataset.heroReady).toBe("true");
  const initial = source();
  await new Promise(resolve => setTimeout(resolve, 6200));
  expect(source()).toBe(initial);
  await view.rerender(<div style={{ position: "relative", width: 700, height: 650 }}><HeroCharacters themeId="bluearchive" reduced={false} /></div>);
  await expect.poll(source, { timeout: 9000 }).not.toBe(initial);
});

test("unmount cancels an in-flight portrait switch", async () => {
  const view = await show("bluearchive", false);
  await expect.poll(() => art().dataset.heroReady).toBe("true");
  const before = source();
  let finish!: () => void;
  vi.spyOn(HTMLImageElement.prototype, "decode").mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  await expect.poll(() => typeof finish, { timeout: 9000 }).toBe("function");
  await view.unmount();
  finish();
  await Promise.resolve();
  expect(sessionStorage.getItem("xtbang:hero:bluearchive")).toBe(before);
});
