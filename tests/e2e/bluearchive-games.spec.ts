import { test, expect } from "@playwright/test";

const students = ["shiroko", "arona", "hoshino", "serika", "nonomi", "ayane", "aru", "kayoko", "mutsuki", "hina"];
const oldCharacters = /\/(?:player\d+|chara\d+|defeat\d*|kkr[1-4]|kuma[12]|kuma_icon|win|head\d+)\.(?:png|jpg)$/;

test("BA 华容道使用十位Q版角色，提示可移动，三主题进度和声音独立", async ({ page }, info) => {
  test.setTimeout(90000);
  const errors: string[] = [], images: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (request.resourceType() === "image") images.push(new URL(request.url()).pathname); });
  await page.goto("/games/bang-klotski?theme=bluearchive");
  await expect(page.getByText(/一起帮星野找到出口/)).toBeVisible();
  const frame = page.frameLocator('iframe[title="华容道"]');
  await expect(frame.locator("html")).toHaveAttribute("data-theme", "bluearchive");
  await expect(frame.locator("body")).toHaveCSS("cursor", /mouse-icon.webp.*8 7/);
  await expect(frame.locator("#btn-reset")).toHaveCSS("cursor", /mouse-icon_hover.png.*8 7/);
  await expect(frame.locator(".block")).toHaveCount(10);
  await expect.poll(() => frame.locator(".block img").evaluateAll(elements => elements.every(element => (element as HTMLImageElement).complete && (element as HTMLImageElement).naturalWidth > 0))).toBe(true);
  expect(await frame.locator(".block img").evaluateAll(elements => elements.map(element => element.getAttribute("src")).sort())).toEqual(students.map(name => `/brand/bluearchive/klotski/${name}.webp`).sort());
  await expect(frame.getByRole("button", { name: "小鸟游星野，使用方向键移动" })).toBeVisible();
  expect(images.filter(path => path.startsWith("/games/bang-klotski/images/"))).toEqual([]);
  await frame.locator("#block-otae").focus();
  await page.keyboard.press("ArrowRight");
  await expect(frame.locator("#step-display")).toHaveText("1");
  await frame.locator("#btn-hint").click();
  await expect(frame.locator("#step-display")).toHaveText("2");
  await frame.locator("#btn-voice").click();
  await expect(frame.locator("#btn-voice")).toHaveAttribute("aria-pressed", "false");
  await page.reload();
  await expect(frame.locator("#step-display")).toHaveText("2");
  for (const theme of ["bangdream", "sekai"]) {
    await page.goto(`/games/bang-klotski?theme=${theme}`);
    await expect(frame.locator("#step-display")).toHaveText("0");
    await expect(frame.locator("#btn-voice")).toHaveAttribute("aria-pressed", "true");
  }
  await page.goto("/games/bang-klotski?theme=bluearchive");
  await expect(frame.locator("#step-display")).toHaveText("2");
  await expect(frame.locator("#btn-voice")).toHaveAttribute("aria-pressed", "false");
  const captionLines = await frame.locator(".instructions p").first().evaluate(element => {
    const node = element.firstChild!, lines = new Map<string, string>();
    for (let index = 0; index < node.textContent!.length; index++) {
      const range = document.createRange(); range.setStart(node, index); range.setEnd(node, index + 1);
      const top = range.getBoundingClientRect().top.toFixed(1);
      lines.set(top, (lines.get(top) || "") + node.textContent![index]);
    }
    return [...lines.values()];
  });
  if (captionLines.length > 1) expect(captionLines.at(-1)?.trim()).not.toMatch(/^[\p{Script=Han}][\p{Punctuation}\s]*$/u);
  await page.screenshot({ path: info.outputPath("bluearchive-klotski.png"), fullPage: true });
  await frame.locator("#btn-reset").click();
  await expect(frame.locator("#step-display")).toHaveText("0");
  for (let step = 1; step <= 200; step++) {
    await frame.locator("#btn-hint").click();
    await expect(frame.locator("#step-display")).toHaveText(String(step));
    const goalReached = await frame.locator("html").evaluate(() => {
      const progress = JSON.parse(localStorage.getItem("bluearchive:klotski:progress")!);
      const goal = progress.blocks.find((block: { id: string }) => block.id === "michelle");
      return goal.x === 1 && goal.y === 3;
    });
    if (goalReached) break;
  }
  await expect(frame.locator("#victory-overlay")).toHaveClass(/show/);
  await expect(frame.locator("#victory-box")).toContainText("欢迎回到夏莱！");
  await expect(frame.locator("#victory-box img")).toHaveAttribute("src", "/brand/bluearchive/klotski/hoshino.webp");
  await expect(frame.locator("#victory-box img")).toHaveAttribute("alt", "星野");
  await page.screenshot({ path: info.outputPath("bluearchive-klotski-victory.png"), fullPage: true });
  await frame.locator("#victory-box button").click();
  await expect(frame.locator("#step-display")).toHaveText("0");
  expect(await frame.locator("html").evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.getByRole("link", { name: "返回首页 ↗", exact: true }).click();
  await expect(page).toHaveURL(url => url.pathname === "/" && url.searchParams.get("theme") === "bluearchive");
  expect(errors).toEqual([]);
});

test("BA 射手三关可开始暂停，角色帧和语言属于 BA，功能道具沿用基线且昵称独立", async ({ page }, info) => {
  test.setTimeout(90000);
  const errors: string[] = [], images: string[] = [];
  let submissions = 0;
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    if (request.resourceType() === "image") images.push(new URL(request.url()).pathname);
    if (request.url().endsWith("/gameStat") && request.method() === "POST") submissions++;
  });
  await page.addInitScript(() => {
    localStorage.setItem("playerName", "Bang nickname"); localStorage.setItem("sekai:note-shooter:playerName", "Sekai nickname");
    const state = window as unknown as { baDraws: number; baPlayerRatios: number[] };
    state.baDraws = 0; state.baPlayerRatios = [];
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (image, ...coordinates: number[]) {
      if (image instanceof HTMLImageElement && image.src.includes("/brand/bluearchive/shooter-frames/") && coordinates.length === 4) {
        state.baDraws++;
        if (/\/player\d+\.webp$/.test(image.src)) state.baPlayerRatios.push(coordinates[2] / coordinates[3]);
      }
      Reflect.apply(draw, this, [image, ...coordinates]);
    };
  });
  const frame = page.frameLocator('iframe[title="音符射手"]');
  for (const level of [1, 2, 3]) {
    await page.goto("/note-shooter?theme=bluearchive");
    await expect(frame.locator("#start-button")).toBeEnabled();
    await expect(frame.locator("body")).toHaveCSS("cursor", /mouse-icon.webp.*8 7/);
    await expect(frame.locator("#start-button")).toHaveCSS("cursor", /mouse-icon_hover.png.*8 7/);
    await expect(frame.locator("html")).toHaveAttribute("data-theme", "bluearchive");
    const nickname = frame.locator("#player-name-input");
    await expect(nickname).toHaveValue(level === 1 ? "" : "BA nickname");
    await nickname.fill("BA nickname");
    await nickname.press("Tab");
    if (level === 1) {
      for (const [language, title] of [["en", "Blue Archive Note Shooter"], ["ja", "ブルーアーカイブ ノートシューター"], ["zh", "蔚蓝档案 音符射手"]]) {
        await frame.locator(`[data-lang="${language}"]`).click();
        await expect.poll(() => frame.locator("html").evaluate(element => element.ownerDocument.title)).toBe(title);
      }
    }
    await frame.locator('[data-lang="zh"]').click();
    await frame.locator("#level-selector").selectOption(String(level));
    const registered = page.waitForResponse(response => response.url().endsWith("/startStat") && response.request().method() === "POST");
    await frame.locator("#start-button").click();
    expect((await registered).status()).toBe(200);
    await expect(frame.locator("#pause-button")).toBeVisible();
    await frame.locator("#pause-button").click();
    await expect(frame.locator("#pause-menu")).toBeVisible();
    await frame.locator("#resume-button").click();
    await expect(frame.locator("#pause-menu")).toBeHidden();
    await expect.poll(() => frame.locator("html").evaluate(() => (window as unknown as { baDraws: number }).baDraws)).toBeGreaterThan(0);
    const playerRatios = await frame.locator("html").evaluate(() => (window as unknown as { baPlayerRatios: number[] }).baPlayerRatios);
    expect(playerRatios.length).toBeGreaterThan(0);
    for (const ratio of playerRatios) expect(ratio).toBeCloseTo(1 / 1.2, 6);
    if (level === 1) await page.screenshot({ path: info.outputPath("bluearchive-shooter.png"), fullPage: true });
    await frame.locator("#pause-button").click();
    expect(await frame.locator("html").evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await frame.locator("#submit-score-button").click();
    await expect(frame.locator("#result-image")).toHaveAttribute("src", /\/brand\/bluearchive\/shooter-frames\/defeat.webp$/);
    await expect(frame.locator("#result-message")).toContainText("老师");
    await expect(frame.locator("#score-status")).toHaveText("本次不足 15 秒，不计入排行榜");
    if (level === 1) await page.screenshot({ path: info.outputPath("bluearchive-shooter-result.png"), fullPage: true });
    await frame.locator("#home-button").click();
    await frame.locator("#leaderboard-button").click();
    await expect(frame.locator("#leaderboard")).toBeVisible();
    await expect(frame.locator("#leaderboard")).toContainText("夏莱训练榜");
    await frame.locator("#leaderboard-close").click();
  }
  expect(new Set(images.filter(path => path.startsWith("/brand/bluearchive/shooter-frames/"))).size).toBe(52);
  expect(images).toContain("/note-shooter/img/item6-2.png");
  expect(images).toContain("/brand/bluearchive/shooter-frames/item7.webp");
  expect(images).not.toContain("/note-shooter/img/item7.png");
  expect(images.filter(path => path.startsWith("/note-shooter/img/") && oldCharacters.test(path))).toEqual([]);
  await page.goto("/note-shooter?theme=sekai");
  await expect(frame.locator("#player-name-input")).toHaveValue("Sekai nickname");
  await page.goto("/note-shooter");
  await expect(frame.locator("#player-name-input")).toHaveValue("Bang nickname");
  await page.goto("/note-shooter?theme=bluearchive");
  await expect(frame.locator("#player-name-input")).toHaveValue("BA nickname");
  expect(submissions).toBe(0);
  expect(errors).toEqual([]);
});

test("BA 秒表沿用基线布局，受控时钟验证胜负与稳定的操作位置", async ({ page }, info) => {
  await page.goto("/games/stopwatch-challenge?theme=bluearchive");
  const settings = await (await page.request.get("/api/stopwatch-settings")).json();
  const button = page.getByRole("button", { name: "按住开始计时，松开结束" });
  await expect(button).toBeEnabled();
  const stage = page.getByRole("region", { name: "秒表挑战舞台" });
  const initialHeight = (await stage.boundingBox())!.height;
  await expect(stage.getByRole("img")).toHaveCount(0);
  await page.clock.install({ time: new Date("2026-10-31T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-31T00:00:01Z"));
  await button.focus(); await page.keyboard.down("Space");
  await expect(page.getByRole("region", { name: "秒表挑战舞台" })).toHaveAttribute("data-mode", "holding");
  await page.clock.runFor(settings.targetSeconds * 1000);
  await page.keyboard.up("Space");
  await expect(page.getByText("计时任务完成，老师！")).toBeVisible();
  expect((await stage.boundingBox())!.height).toBe(initialHeight);
  await page.screenshot({ path: info.outputPath("bluearchive-stopwatch-win.png"), fullPage: true });
  await page.getByRole("button", { name: /重置计时/ }).click();
  await button.focus(); await page.keyboard.down("Space");
  await page.clock.runFor(settings.targetSeconds * 500);
  await page.keyboard.up("Space");
  await expect(page.getByText("稍早了一点，老师再试一次。")).toBeVisible();
  expect((await stage.boundingBox())!.height).toBe(initialHeight);
  await page.screenshot({ path: info.outputPath("bluearchive-stopwatch-lose.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("BA 白盒验证51帧角色、倒地、Boss状态与结算契约", async ({ page }, info) => {
  await page.route(/\/note-shooter\/engine\.js(?:\?|$)/, async route => {
    const response = await route.fetch();
    const probe = `
      window.archiveFrame = (kind, type, time, status) => {
        currentLevel = 3;
        const actor = kind === 'player' ? new Player() : new Boss();
        actor.animTimer = time; actor.currentCharacterType = type; actor.deadCharacterType = type;
        actor.characters = [type]; actor.isDead = status === 'dead';
        if (kind === 'boss') actor.attackState = status;
        const seen = [], draw = ctx.drawImage;
        ctx.drawImage = function(image, ...args) {
          seen.push({path:new URL(image.src).pathname, ratio:args[2]/args[3], sourceRatio:image.naturalWidth/image.naturalHeight});
          return Reflect.apply(draw,this,[image,...args]);
        };
        try { actor.draw(0); } finally { ctx.drawImage = draw; }
        return seen;
      };
      window.archiveAssets = async () => Promise.all(Object.values(assetImages)
        .filter(image => image.src.includes('/brand/bluearchive/shooter-frames/') && !image.src.endsWith('/item7.webp'))
        .map(async image => {
          const name = new URL(image.src).pathname.split('/').pop();
          const original = new Image(); original.src = '/note-shooter/img/' + name.replace('.webp', '.png');
          await original.decode();
          return {name, width:image.naturalWidth, height:image.naturalHeight,
            originalWidth:original.naturalWidth, originalHeight:original.naturalHeight};
        }));
      window.archiveResult = won => {
        gameState = 'over'; cancelAnimationFrame(gameLoopId);
        startScreen.classList.add('hidden'); pauseMenu.classList.add('hidden');
        showScoreAnimation(won,0,0,0,1000,1,0,'D');
      };
    `;
    const source = await response.text();
    expect(source).toContain("  })();");
    await route.fulfill({ response, body: source.replace("  })();", `${probe}  })();`) });
  });
  await page.goto("/note-shooter?theme=bluearchive");
  const frame = page.frameLocator('iframe[title="音符射手"]');
  await expect(frame.locator("#start-button")).toBeEnabled();
  const images = await frame.locator("html").evaluate(() => (window as unknown as { archiveAssets: () => Promise<{name: string; width: number; height: number; originalWidth: number; originalHeight: number}[]> }).archiveAssets());
  expect(images).toHaveLength(51);
  expect(new Set(images.map(image => image.name)).size).toBe(51);
  for (const image of images) {
    expect(image.width, image.name).toBeGreaterThan(0);
    expect(image.height, image.name).toBeGreaterThan(0);
    expect(image.width / image.height, image.name).toBeCloseTo(image.originalWidth / image.originalHeight, 6);
  }
  const check = (kind: string, type: number, time: number, status: string) => frame.locator("html").evaluate((_, args) => (window as unknown as { archiveFrame: (...args: (string | number)[]) => { path: string; ratio: number; sourceRatio: number }[] }).archiveFrame(...args), [kind, type, time, status]);
  for (let type = 1; type <= 13; type++) for (const status of ["normal", "dead"]) {
    const seen = await check("player", type, 400, status);
    const name = status === "dead" ? `defeat${type}` : `player${type <= 3 ? type * 2 : type + 3}`;
    const character = seen.find(value => value.path === `/brand/bluearchive/shooter-frames/${name}.webp`);
    expect(character, `${type} ${status}`).toBeDefined();
    expect(character!.ratio).toBeCloseTo(status === "dead" ? character!.sourceRatio : 1 / 1.2, 6);
  }
  for (const state of ["normal", "raising", "punching"]) for (const time of [0, 400]) {
    const seen = await check("boss", 1, time, state);
    const number = state === "raising" ? 3 : state === "punching" ? 4 : time === 0 ? 1 : 2;
    const boss = seen.find(value => value.path === `/brand/bluearchive/shooter-frames/kkr${number}.webp`);
    expect(boss, `${state} ${time}`).toBeDefined();
    expect(boss!.ratio).toBeCloseTo(1 / 1.1, 6);
  }
  await frame.locator('[data-lang="zh"]').click();
  await frame.locator("html").evaluate(() => (window as unknown as { archiveResult: (won: boolean) => void }).archiveResult(true));
  await expect(frame.locator("#result-image")).toHaveAttribute("src", /\/brand\/bluearchive\/shooter-frames\/win.webp$/);
  await expect(frame.locator("#result-message")).toContainText("任务完成");
  await page.screenshot({ path: info.outputPath("bluearchive-shooter-victory-presentation.png"), fullPage: true });
  await frame.locator("html").evaluate(() => (window as unknown as { archiveResult: (won: boolean) => void }).archiveResult(false));
  await expect(frame.locator("#result-image")).toHaveAttribute("src", /\/brand\/bluearchive\/shooter-frames\/defeat.webp$/);
  await expect(frame.locator("#pause-home-button")).toHaveText("返回训练菜单");
  await expect(frame.locator("#home-button")).toHaveText("返回训练菜单");
  await frame.locator("#home-button").click();
  await expect(frame.locator("#start-screen")).toBeVisible();
  expect(await frame.locator("html").evaluate(() => new URLSearchParams(location.search).get("theme"))).toBe("bluearchive");
});

