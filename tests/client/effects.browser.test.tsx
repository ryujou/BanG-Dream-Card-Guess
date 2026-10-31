import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { CharacterCursor } from "../../src/client/components/CharacterCursor";
import { StageParticles } from "../../src/client/components/StageParticles";
import HeroScene from "../../src/client/motion/HeroScene";
import RevealScene from "../../src/client/motion/RevealScene";
import { HOME_THEMES } from "../../src/client/lib/home-theme";

let preference: MediaQueryList;
beforeEach(async () => {
  await page.viewport(1280, 900);
  const original = window.matchMedia.bind(window);
  preference = Object.assign(new EventTarget(), { matches: false, media: "(prefers-reduced-motion: reduce)" }) as MediaQueryList;
  vi.spyOn(window, "matchMedia").mockImplementation(query => query.includes("prefers-reduced-motion") ? preference : original(query));
});
afterEach(() => vi.restoreAllMocks());
function reduceMotion() {
  Object.assign(preference, { matches: true });
  preference.dispatchEvent(new Event("change"));
}

test.each(["sekai", "bluearchive"] as const)("%s desktop character trail follows the pointer, resets on blur and releases its layer on unmount", async themeId => {
  const view = await render(<CharacterCursor themeId={themeId} character={HOME_THEMES[themeId].cursor} />);
  const layer = document.querySelector<HTMLElement>("[data-character-layer]")!;
  expect(layer.dataset.mode).toBe("follow");
  window.dispatchEvent(new PointerEvent("pointermove", { clientX: 100, clientY: 150, pointerType: "mouse" }));
  expect(layer.dataset.active).toBe("true");
  expect(layer.querySelector<HTMLElement>('[data-character-follow="main"]')!.style.transform).toContain("100px, 150px");
  window.dispatchEvent(new PointerEvent("pointermove", { clientX: 150, clientY: 200, pointerType: "mouse" }));
  await expect.poll(() => layer.querySelector<HTMLElement>('[data-character-follow="main"]')!.style.transform).not.toContain("100px, 150px");
  window.dispatchEvent(new Event("blur"));
  expect(layer.dataset.active).toBeUndefined();
  reduceMotion();
  expect(layer.dataset.mode).toBe("off");
  window.dispatchEvent(new PointerEvent("pointermove", { clientX: 80, pointerType: "touch" }));
  expect(layer.dataset.active).toBeUndefined();
  await view.unmount();
  expect(document.querySelector("[data-character-layer]")).toBeNull();
  expect(document.body.dataset.characterCursor).toBeUndefined();
});

test.each(["bangdream", "bluearchive"] as const)("%s mobile character bursts are bounded, ignore keyboard clicks, and honor live motion preferences", async themeId => {
  await page.viewport(390, 844);
  await render(<CharacterCursor themeId={themeId} character={HOME_THEMES[themeId].cursor} />);
  const layer = document.querySelector<HTMLElement>("[data-character-layer]")!;
  const bursts = layer.querySelector("[data-character-bursts]")!;
  expect(layer.dataset.mode).toBe("burst");
  window.dispatchEvent(new MouseEvent("click", { detail: 0 }));
  expect(bursts.childElementCount).toBe(0);
  for (let n = 0; n < 10; n++) window.dispatchEvent(new MouseEvent("click", { detail: 1, clientX: 50, clientY: 60 }));
  expect(bursts.childElementCount).toBeLessThanOrEqual(8);
  expect(bursts.firstElementChild?.getAttribute("src")).toBe(HOME_THEMES[themeId].cursor.main);
  expect(bursts.children[1]?.getAttribute("src")).toBe(HOME_THEMES[themeId].cursor.mascot);
  const count = bursts.childElementCount;
  bursts.firstElementChild!.dispatchEvent(new Event("animationend"));
  expect(bursts.childElementCount).toBe(count - 1);
  reduceMotion();
  expect(bursts.childElementCount).toBe(0);
  window.dispatchEvent(new MouseEvent("click", { detail: 1 }));
  expect(bursts.childElementCount).toBe(0);
});

test("particles draw at the rendered size and release animation/observers when motion is disabled", async () => {
  const cancel = vi.spyOn(window, "cancelAnimationFrame");
  const disconnect = vi.spyOn(IntersectionObserver.prototype, "disconnect");
  const resizeDisconnect = vi.spyOn(ResizeObserver.prototype, "disconnect");
  const view = await render(<div style={{ width: 400, height: 300, position: "relative" }}><StageParticles /></div>);
  const canvas = document.querySelector("canvas")!;
  await expect.poll(() => canvas.dataset.running).toBe("true");
  expect(canvas.width).toBe(Math.round(400 * Math.min(devicePixelRatio, 1.5)));
  canvas.parentElement!.dispatchEvent(new PointerEvent("pointermove", { clientX: 100, clientY: 100 }));
  await expect.poll(() => canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data.some(value => value !== 0)).toBe(true);
  canvas.parentElement!.dispatchEvent(new PointerEvent("pointerleave"));
  reduceMotion();
  await expect.poll(() => document.querySelector("canvas")).toBeNull();
  expect(cancel).toHaveBeenCalled();
  expect(disconnect).toHaveBeenCalled();
  expect(resizeDisconnect).toHaveBeenCalled();
  await view.unmount();
});

test("hero playback uses the supplied character and reveal animation owns no interactive controls", async () => {
  const view = await render(<><div style={{ width: 700, height: 650 }}><HeroScene character={HOME_THEMES.sekai.character} /></div><RevealScene /></>);
  const hero = document.querySelector(".hero-scene")!;
  await expect.poll(() => hero.querySelector("img")?.getAttribute("src")).toBe(HOME_THEMES.sekai.character.src);
  expect(hero.getAttribute("aria-hidden")).toBe("true");
  expect(document.querySelector(".reveal-scene")?.getAttribute("aria-hidden")).toBe("true");
  expect(document.querySelectorAll("button")).toHaveLength(0);
  await view.unmount();
  expect(document.querySelector(".hero-scene")).toBeNull();
});

test("reveal panels retain their real motion and follow the theme accent", async () => {
  const view = await render(<div data-testid="reveal-theme"><RevealScene /></div>);
  const parent = page.getByTestId("reveal-theme").element();
  await expect.poll(() => parent.querySelector('[style*="skewX"]')).not.toBeNull();
  const panel = parent.querySelector('[style*="skewX"]') as HTMLElement;
  const initialTransform = getComputedStyle(panel).transform;
  await expect.poll(() => getComputedStyle(panel).transform).not.toBe(initialTransform);
  for (const [accent, expected] of [["#f43f78", "rgb(244, 63, 120)"], ["#004190", "rgb(0, 65, 144)"], ["#1d66ed", "rgb(29, 102, 237)"]]) {
    parent.style.setProperty("--arcade-accent", accent);
    await expect.poll(() => getComputedStyle(panel).backgroundColor).toBe(expected);
  }
  await view.unmount();
});
