import { expect, test, type Browser, type BrowserContextOptions, type TestInfo } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { moveShooter, shooterObservation, startShooter } from "./shooter-parity.fixture";

const themes = ["bangdream", "sekai", "bluearchive"] as const;
const pixelPairs = [["player1", "player2"], ["player3", "player4"], ["player5", "player6"], ["boss1", "boss2"], ["boss2", "boss3"], ["boss3", "boss4"], ["bear1", "bear2"]];

async function observeRun(browser: Browser, options: BrowserContextOptions, theme: string, level: number, scenario: "collision" | "collection" | "shooting", info: TestInfo) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const move = (x: number, y: number) => moveShooter(page, x, y, options.hasTouch);
  const errors: string[] = [];
  const inputs: number[][] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("response", response => {
    if (response.status() >= 400 && new URL(response.url()).origin === new URL(options.baseURL!).origin) {
      errors.push(`${response.status()} ${new URL(response.url()).pathname}`);
    }
  });
  try {
    await startShooter(page, theme, level);
    await move(.5, .82);
    let pauseFrozen = true;
    if (scenario === "shooting") {
      const canvas = (await page.locator("canvas").boundingBox())!;
      const touch = options.hasTouch ? await context.newCDPSession(page) : null;
      const point = async (x: number, y: number, first = false) => {
        if (touch) await touch.send("Input.dispatchTouchEvent", { type: first ? "touchStart" : "touchMove", touchPoints: [{ x: canvas.x + x, y: canvas.y + y, id: 1 }] });
        else { await page.mouse.move(canvas.x + x, canvas.y + y); if (first) await page.mouse.down(); }
      };
      await point(canvas.width * .5, canvas.height * .82, true);
      for (let step = 0; step < 330; step++) {
        const current = await page.evaluate(() => (window as any).__shooterParity.snapshot());
        if (current.state !== "playing") break;
        const [x, y, width, height] = current.player.box;
        const totalWidth = width * current.player.characters.length;
        // Pick an open lane before the next row reaches the player, using normal pointer input.
        const danger = current.bears.filter((bear: any) => bear.box[1] + bear.box[3] > y - current.canvas[1] * .06 && bear.box[1] < y + height - 14);
        const candidates = [x, ...Array.from({ length: 6 }, (_, index) => current.canvas[0] * (index + .5) / 6)]
          .filter(value => value >= totalWidth / 2 && value <= current.canvas[0] - totalWidth / 2)
          .sort((left, right) => Math.abs(left - x) - Math.abs(right - x));
        const target = candidates.find(value => danger.every((bear: any) => value + totalWidth / 2 - 14 <= bear.box[0] || value - totalWidth / 2 + 14 >= bear.box[0] + bear.box[2]));
        if (target !== undefined) {
          inputs.push([current.time, target, current.canvas[1] * .82]);
          await point(target, current.canvas[1] * .82);
        }
        await page.clock.runFor(50);
      }
      if (touch) await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      else await page.mouse.up();
      await page.locator("canvas").screenshot({ path: info.outputPath(`${theme}-shooting-phase2.png`) });
    } else if (scenario === "collection") {
      await page.clock.runFor(900);
      for (let step = 0; step < 40; step++) {
        const current = await page.evaluate(() => (window as any).__shooterParity.snapshot());
        if (current.state !== "playing") break;
        const target = current.portraits.find((portrait: any) => portrait.type !== current.player.type);
        if (target) {
          await move((target.box[0] + target.box[2] / 2) / current.canvas[0], Math.max(.01, target.box[1] / current.canvas[1]));
        }
        await page.clock.runFor(160);
      }
    } else {
      for (let frame = 1; frame <= 4; frame++) {
        await page.clock.runFor(400);
        if (level === 1 && frame <= 2) await page.locator("canvas").screenshot({ path: info.outputPath(`${theme}-${frame * 400}ms.png`) });
      }
      await move(.25, .35);
      await page.clock.runFor(800);
      await page.keyboard.press("Escape");
      await expect(page.locator("#pause-menu")).toBeVisible();
      // The already queued RAF observes the paused state once; subsequent RAFs must stop.
      await page.clock.runFor(16);
      const paused = await page.evaluate(() => (window as any).__shooterParity.snapshot());
      await page.clock.runFor(800);
      pauseFrozen = JSON.stringify(await page.evaluate(() => (window as any).__shooterParity.snapshot())) === JSON.stringify(paused);
      await page.keyboard.press("Escape");
      await expect(page.locator("#pause-menu")).toBeHidden();
      const capturedStates = new Set<string>();
      for (let step = 0; step < 12; step++) {
        await page.clock.runFor(100);
        if (level === 1) {
          const attack = await page.evaluate(() => (window as any).__shooterParity.snapshot().boss?.attack);
          if (["raising", "punching"].includes(attack) && !capturedStates.has(attack)) {
            await page.locator("canvas").screenshot({ path: info.outputPath(`${theme}-boss-${attack}.png`) });
            capturedStates.add(attack);
          }
        }
      }
      if (level === 1) expect(capturedStates).toEqual(new Set(["raising", "punching"]));
      await move(.5, .2);
      await page.clock.runFor(4000);
    }
    const observed = await shooterObservation(page);
    const pairs = await page.evaluate(pairs => pairs.map(([first, second]) => ({ first, second,
      ...(window as any).__shooterParity.imagePairDifference(first, second),
    })), pixelPairs);
    const evidenceName = `${theme}-level${level}-${scenario}.json`;
    const evidencePath = info.outputPath(evidenceName);
    await writeFile(evidencePath, JSON.stringify({ observed, pairs, pauseFrozen, errors, inputs }, null, 2), "utf8");
    await info.attach(evidenceName, { path: evidencePath, contentType: "application/json" });
    expect(errors, `${theme}: native resources and script execution`).toEqual([]);
    expect(pauseFrozen, `${theme}: paused physics and animation clock`).toBe(true);
    return { observed, pairs, inputs };
  } finally {
    await context.close();
  }
}

function motionFrames(observed: any) {
  return observed.frames.map(({ draws, ...state }: any) => ({ ...state,
    draws: draws.map(({ id, role, key, box, body, dead, attack }: any) => ({ id, role, key, box, body, dead, attack })),
  }));
}

function transitions(observed: any) {
  return observed.transitions.map(({ time, id, role, key, dead, attack }: any) => ({ time, id, role, key, dead, attack }));
}

function visibleSizes(observed: any, baseline: any) {
  const firstByKey = new Map<string, any>();
  for (const row of baseline.transitions) if (!firstByKey.has(`${row.role}:${row.key}`)) firstByKey.set(`${row.role}:${row.key}`, row);
  return [...firstByKey.values()].map(reference => {
    const actual = observed.transitions.find((row: any) => row.id === reference.id && row.key === reference.key && row.time === reference.time);
    if (!actual) return { role: reference.role, key: reference.key, missing: true };
    return { role: actual.role, key: actual.key, source: actual.source,
      widthRatio: actual.alphaBox[2] / reference.alphaBox[2], heightRatio: actual.alphaBox[3] / reference.alphaBox[3],
      footDeltaPx: actual.alphaBox[1] + actual.alphaBox[3] - reference.alphaBox[1] - reference.alphaBox[3],
    };
  });
}

async function checkPrimarySize(observed: any, baseline: any, theme: string, info: TestInfo) {
  const sizes = visibleSizes(observed, baseline);
  await info.attach(`${theme}-visible-sizes.json`, { body: JSON.stringify(sizes, null, 2), contentType: "application/json" });
  for (const size of sizes.filter(row => row.role === "player" && /^player[1-6]$/.test(row.key))) {
    expect(size.missing, `${theme}: ${size.key} actually appeared`).not.toBe(true);
    expect(size.heightRatio, `${theme}: ${size.key} visible height relative to BanG`).toBeGreaterThanOrEqual(.9);
    expect(size.heightRatio, `${theme}: ${size.key} visible height relative to BanG`).toBeLessThanOrEqual(1.1);
    expect(Math.abs(size.footDeltaPx!), `${theme}: ${size.key} feet align with BanG ground position`).toBeLessThanOrEqual(1);
  }
}

for (const level of [1, 2, 3]) {
  test(`射手第${level}关：三主题正常RAF的移动、帧序、暂停恢复、Boss攻击和真实死亡与BanG一致`, async ({ browser, baseURL, viewport, isMobile, hasTouch, deviceScaleFactor, userAgent }, info) => {
    test.setTimeout(90_000);
    const options = { baseURL, viewport, isMobile, hasTouch, deviceScaleFactor, userAgent };
    const runs = [];
    for (const theme of themes) runs.push(await observeRun(browser, options, theme, level, "collision", info));
    const baseline = runs[0].observed;
    expect(baseline.frames.length).toBeGreaterThan(100);
    expect(baseline.current.deaths).toBeGreaterThan(0);
    expect(new Set(baseline.transitions.filter((row: any) => row.role === "boss").map((row: any) => row.attack))).toEqual(new Set(["normal", "raising", "punching"]));
    for (let index = 0; index < runs.length; index++) {
      const { observed, pairs } = runs[index];
      await checkPrimarySize(observed, baseline, themes[index], info);
      expect(motionFrames(observed), `${themes[index]}: actual simulation and draw rectangles`).toEqual(motionFrames(baseline));
      expect(transitions(observed), `${themes[index]}: actual pose and state transition timestamps`).toEqual(transitions(baseline));
      expect(observed.current, `${themes[index]}: collision outcome`).toEqual(baseline.current);
      expect(observed.transitions.some((row: any) => row.role === "player" && /^defeat\d+$/.test(row.key))).toBe(true);
      const playerKeys = new Set(observed.transitions.filter((row: any) => row.role === "player").map((row: any) => row.key));
      expect(playerKeys.has(level === 3 ? "player2" : "player1")).toBe(true);
      if (level !== 3) expect(playerKeys.has("player2")).toBe(true);
      for (const pair of pairs) expect(pair.ratio, `${themes[index]}: ${pair.first}/${pair.second} must visibly change`).toBeGreaterThan(.02);
      const visibleActors = observed.firstVisible.filter((row: any) => ["player", "boss", "bear"].includes(row.role));
      const referenceActors = baseline.firstVisible.filter((row: any) => ["player", "boss", "bear"].includes(row.role));
      expect(new Set(visibleActors.map((row: any) => row.id)), `${themes[index]}: every baseline actor became visible`).toEqual(new Set(referenceActors.map((row: any) => row.id)));
      for (const first of visibleActors) {
        const reference = baseline.firstVisible.find((row: any) => row.id === first.id);
        expect(reference, `${themes[index]}: visible actor ${first.id}`).toBeDefined();
        expect(Math.abs(first.time - reference.time), `${themes[index]}: ${first.id} visible entry within one RAF`).toBeLessThanOrEqual(16);
      }
    }
  });
}

for (const level of [2, 3]) {
  test(`射手第${level}关：真实移动拾取头像后，三主题角色切换与出场轨迹沿用BanG`, async ({ browser, baseURL, viewport, isMobile, hasTouch, deviceScaleFactor, userAgent }, info) => {
    test.setTimeout(90_000);
    const options = { baseURL, viewport, isMobile, hasTouch, deviceScaleFactor, userAgent };
    const runs = [];
    for (const theme of themes) runs.push(await observeRun(browser, options, theme, level, "collection", info));
    const baseline = runs[0].observed;
    expect(new Set(baseline.frames.map((frame: any) => frame.player.type)).size).toBeGreaterThanOrEqual(3);
    if (level === 2) {
      const appeared = new Set(baseline.transitions.filter((row: any) => /^player[1-6]$/.test(row.key)).map((row: any) => row.key));
      expect(appeared).toEqual(new Set(["player1", "player2", "player3", "player4", "player5", "player6"]));
    }
    for (let index = 0; index < runs.length; index++) {
      await checkPrimarySize(runs[index].observed, baseline, themes[index], info);
      expect(motionFrames(runs[index].observed), `${themes[index]}: live pickup movement and avatar draws`).toEqual(motionFrames(baseline));
      expect(transitions(runs[index].observed), `${themes[index]}: avatar spawn and change timestamps`).toEqual(transitions(baseline));
      expect(runs[index].observed.current, `${themes[index]}: pickup effects and subsequent collision`).toEqual(baseline.current);
    }
  });
}

test("射手持续按压实际发射、击中Boss并进入第二阶段，三主题全帧一致", async ({ browser, baseURL, viewport, isMobile, hasTouch, deviceScaleFactor, userAgent }, info) => {
  test.setTimeout(120_000);
  const options = { baseURL, viewport, isMobile, hasTouch, deviceScaleFactor, userAgent };
  const runs = [];
  for (const theme of themes) runs.push(await observeRun(browser, options, theme, 1, "shooting", info));
  const baseline = runs[0].observed;
  expect(baseline.frames.length).toBeGreaterThan(1000);
  expect(Math.max(...baseline.frames.map((frame: any) => frame.bullets.length))).toBeGreaterThan(0);
  expect(baseline.current.boss.health).toBeLessThan(Math.max(...baseline.frames.map((frame: any) => frame.boss?.health || 0)));
  expect(new Set(baseline.frames.filter((frame: any) => frame.boss).map((frame: any) => frame.boss.phase))).toEqual(new Set([1, 2]));
  expect(baseline.current.state).toBe("playing");
  if (!isMobile) expect(Math.max(...baseline.frames.map((frame: any) => frame.player.characters.length))).toBeGreaterThan(1);
  for (let index = 0; index < runs.length; index++) {
    const { observed, inputs } = runs[index];
    expect(inputs, `${themes[index]}: held pointer trajectory`).toEqual(runs[0].inputs);
    expect(motionFrames(observed), `${themes[index]}: actual bullets, damage and second-phase movement`).toEqual(motionFrames(baseline));
    expect(transitions(observed), `${themes[index]}: appearance during sustained shooting`).toEqual(transitions(baseline));
    expect(observed.current, `${themes[index]}: phase and damage outcome`).toEqual(baseline.current);
    await checkPrimarySize(observed, baseline, themes[index], info);
  }
});
