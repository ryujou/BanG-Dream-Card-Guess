import { test, expect } from "@playwright/test";

test("世界计划社团文案及公共页面跳转保留主题", async ({page}) => {
  const aboutUs = "欢迎来到湘潭 BanG Dream! 同好会！我们是一群热爱 BanG Dream! 的玩家。";
  await page.route("**/api/community", route => route.fulfill({json:{
    aboutUs, members:[], events:[], photos:[], bilibili:[],
    socialLinks:[{title:"QQ群聊 (点击加入)",url:"https://qm.qq.com/q/6ytGE7qIWQ"}],
  }}));
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("/?theme=sekai");
  await expect(page.getByText("一起聊音乐、玩游戏，遇见身边的世界计划同好。")).toBeVisible();
  const intro = "欢迎来到湘潭 世界计划 同好会！我们是一群热爱 世界计划 的玩家。";
  await expect(page.getByText(intro,{exact:true})).toBeVisible();
  await page.getByRole("link",{name:"认识我们"}).click();
  await expect(page).toHaveURL(/\/community\?theme=sekai$/);
  await expect(page.getByText("XIANGTAN / PROJECT SEKAI COMMUNITY",{exact:true})).toBeVisible();
  await expect(page.getByText(intro,{exact:true})).toBeVisible();
  await expect(page.getByRole("link",{name:"QQ群聊"})).toHaveAttribute("href","https://qm.qq.com/q/EF4FxmYc6W");
  const menu = page.getByRole("button",{name:"打开菜单"});
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("navigation",{name:"主要导航"}).getByRole("link",{name:"周边",exact:true}).click();
  await expect(page).toHaveURL(/\/shop\?theme=sekai$/);
  await expect(page.getByText("来自湘潭 世界计划 同好会的周边。挑选喜欢的款式，通过小程序下单。")).toBeVisible();
  await page.getByRole("link",{name:/购物清单/}).click();
  await expect(page).toHaveURL(/\/cart\?theme=sekai$/);
  await expect(page).toHaveTitle("湘潭 世界计划 同好会");
  await page.getByRole("link",{name:/看看周边/}).click();
  await expect(page).toHaveURL(/\/shop\?theme=sekai$/);
  await page.goto("/host?theme=sekai");
  await expect(page).toHaveURL(/\/login\?.*theme=sekai$/);
  await expect(page).toHaveTitle("湘潭 世界计划 同好会");
  await page.getByRole("link",{name:"返回首页",exact:true}).click();
  await expect(page).toHaveURL(/\/\?theme=sekai$/);
  await page.getByRole("button",{name:"BanG Dream!",exact:true}).click();
  await expect(page.getByText(aboutUs,{exact:true})).toBeVisible();
  await expect(page.getByText("一起聊音乐、玩游戏，遇见身边的邦邦人。")).toBeVisible();
});

test("世界计划游戏入口、社群链接和返回路径", async ({page}) => {
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("/?theme=sekai");
  await expect(page.getByRole("heading", {name:"世界计划猜卡",exact:true})).toBeVisible();
  await expect(page.locator('a[href="https://qm.qq.com/q/EF4FxmYc6W"]')).toHaveCount(2);
  await expect(page.getByText("QQ 群：1030720768")).toBeVisible();
  const images = page.locator('[class*="gameIllustration"] img');
  await expect(images).toHaveCount(4);
  await expect.poll(() => images.evaluateAll(items => items.every(img => (img as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await expect(page.getByRole("link",{name:"单人挑战"})).toHaveAttribute("href","/solo?theme=sekai");
  await page.getByRole("link",{name:"开始华容道"}).click();
  await expect(page).toHaveURL(/\/games\/bang-klotski\?theme=sekai$/);
  await expect(page.locator('iframe[title="华容道"]')).toHaveAttribute("src","/games/bang-klotski/game.html?v=parity-20261031&theme=sekai");
  await page.getByRole("link",{name:"返回首页"}).click();
  await expect(page).toHaveURL(/\/\?theme=sekai$/);
  await page.getByRole("button",{name:"BanG Dream!",exact:true}).click();
  await expect(page.getByRole("heading",{name:"邦邦猜卡",exact:true})).toBeVisible();
  await expect(page.locator('a[href="https://qm.qq.com/q/6ytGE7qIWQ"]')).toHaveCount(2);
});

test("世界计划棋子、键盘移动、提示及与红色版隔离的存档", async ({page}) => {
  const errors:string[]=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto("/games/bang-klotski?theme=sekai");
  const frame=page.frameLocator('iframe[title="华容道"]');
  await expect(frame.locator(".block img")).toHaveCount(10);
  await expect.poll(()=>frame.locator(".block img").evaluateAll(items=>items.every(img=>(img as HTMLImageElement).naturalWidth>0 && (img as HTMLImageElement).src.includes("/brand/sekai-games/klotski/")))).toBe(true);
  await expect(frame.locator("#block-michelle img")).toHaveAttribute("alt","天马司");
  await frame.getByRole("button",{name:"小豆泽心羽，使用方向键移动"}).focus();
  await page.keyboard.press("ArrowRight");
  await expect(frame.locator("#step-display")).toHaveText("1");
  await frame.locator("#btn-hint").click();
  await expect(frame.locator("#step-display")).toHaveText("2");
  const savedPositions = await frame.locator(".block").evaluateAll(items => items.map(el => ({id:el.id,left:(el as HTMLElement).style.left,top:(el as HTMLElement).style.top})));
  await page.evaluate(() => {
    const key = "sekai:klotski:progress";
    const progress = JSON.parse(localStorage.getItem(key)!);
    progress.blocks.forEach((block: {img:string}) => { block.img = "/brand/sekai-games/sprites/tofu.webp"; });
    localStorage.setItem(key, JSON.stringify(progress));
  });
  await page.reload();
  await expect(frame.locator("#step-display")).toHaveText("2");
  await expect(frame.locator("#block-michelle img")).toHaveAttribute("src","/brand/sekai-games/klotski/tsukasa.webp");
  await expect.poll(()=>frame.locator(".block img").evaluateAll(items=>items.every(img=>(img as HTMLImageElement).naturalWidth>0 && (img as HTMLImageElement).src.includes("/brand/sekai-games/klotski/")))).toBe(true);
  expect(await frame.locator(".block").evaluateAll(items => items.map(el => ({id:el.id,left:(el as HTMLElement).style.left,top:(el as HTMLElement).style.top})))).toEqual(savedPositions);
  await page.goto("/games/bang-klotski");
  await expect(frame.locator("#step-display")).toHaveText("0");
  await expect(frame.locator("#block-michelle img")).toHaveAttribute("src","images/michelle.png");
  await page.goto("/games/bang-klotski?theme=sekai");
  await expect(frame.locator("#step-display")).toHaveText("2");
  expect(await frame.locator("html").evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("世界计划射手加载全部角色并实玩三个关卡", async ({page}) => {
  const errors:string[]=[], failed:string[]=[];
  page.on("pageerror",e=>errors.push(e.message));
  page.on("response",r=>{if(r.status()>=400 && r.url().includes("/brand/sekai-games/"))failed.push(r.url());});
  await page.goto("/note-shooter?theme=sekai");
  const frame=page.frameLocator('iframe[title="音符射手"]');
  await expect(frame.locator("#start-button")).toBeEnabled();
  await expect(frame.locator("#header-image")).toHaveAttribute("src","/brand/sekai-games/shooter.webp");
  await frame.locator("#player-name-input").fill("世界计划测试");
  await frame.locator('.difficulty-btn[data-text="easy"]').click();
  for(const level of ["1","2","3"]){
    await frame.locator("#level-selector").selectOption(level);
    await frame.locator("#start-button").click();
    await expect(frame.locator("#pause-button")).toBeVisible();
    const canvas=frame.locator("#game-canvas"),box=(await canvas.boundingBox())!;
    await page.mouse.move(box.x+box.width/2,box.y+box.height*.8);
    await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
    await frame.locator("#pause-button").click();
    await expect(frame.locator("#pause-menu")).toBeVisible();
    await page.reload();
    await expect(frame.locator("#start-button")).toBeEnabled();
  }
  const requested=await frame.locator("html").evaluate(()=>performance.getEntriesByType("resource").map(r=>r.name));
  expect(requested.filter(url=>url.includes("/brand/sekai-games/shooter-frames/")).length).toBe(13);
  expect(requested.filter(url=>url.includes("/brand/sekai-games/shooter-frames-parity/")).length).toBe(39);
  expect(requested.some(url=>url.endsWith("/shooter-frames-parity/item7.webp"))).toBe(true);
  expect(requested.some(url=>url.endsWith("/note-shooter/img/item7.png"))).toBe(false);
  expect(requested.some(url=>/\/img\/(?:player|chara|defeat\d|kuma|kkr|head)\d*/.test(url))).toBe(false);
  expect(errors).toEqual([]);expect(failed).toEqual([]);
});

test("射手逐帧对应：400 毫秒边界、第三关角色、倒地与 Boss 攻击", async ({page}) => {
  await page.route(/\/note-shooter\/engine\.js(?:\?|$)/,async route=>{
    const response=await route.fetch();
    const probe=`
    window.frameCheck = (kind, level, type, time, state) => {
      currentLevel = level;
      const actor = kind === 'player' ? new Player() : kind === 'bear' ? new Bear(0, 0) : new Boss();
      actor.animTimer = time;
      actor.currentCharacterType = type;
      actor.characters = [type];
      actor.deadCharacterType = type;
      actor.isDead = state === 'dead';
      if (kind === 'boss') actor.attackState = state;
      const seen = [], draw = ctx.drawImage;
      ctx.drawImage = function(image, ...args) { seen.push(new URL(image.src).pathname); return draw.call(this, image, ...args); };
      try { actor.draw(0); } finally { ctx.drawImage = draw; }
      return seen;
    };
    `;
    await route.fulfill({response,body:(await response.text()).replace("  })();",probe+"  })();")});
  });
  await page.goto("/note-shooter?theme=sekai");
  const frame=page.frameLocator('iframe[title="音符射手"]');
  await expect(frame.locator("#start-button")).toBeEnabled();
  const check=async(kind:string,level:number,type:number,time:number,state="normal")=>
    frame.locator("html").evaluate((_,args)=>(window as unknown as {frameCheck:(...args:(string|number)[])=>string[]}).frameCheck(...args),[kind,level,type,time,state]);
  const path=(name:string)=>`/brand/sekai-games/${name.startsWith("chara")?"shooter-frames":"shooter-frames-parity"}/${name}.webp`;
  for(const level of [1,2])for(const type of [1,2,3])for(const time of [0,399,400,799,800]){
    const frameNumber=type*2-(time===400||time===799?0:1);
    expect(await check("player",level,type,time)).toContain(path("player"+frameNumber));
  }
  for(let type=1;type<=13;type++){
    expect(await check("player",3,type,400)).toContain(path("player"+(type<=3?type*2:type+3)));
    expect(await check("player",3,type,400,"dead")).toContain(path("defeat"+type));
  }
  for(const time of [0,399,400,799,800]){
    const frameNumber=time===400||time===799?2:1;
    expect(await check("bear",2,1,time)).toContain(path("kuma"+frameNumber));
    expect(await check("boss",2,1,time)).toContain(path("kkr"+frameNumber));
  }
  expect(await check("boss",2,1,0,"raising")).toContain(path("kkr3"));
  expect(await check("boss",2,1,0,"punching")).toContain(path("kkr4"));
});

test("世界计划真实卡面出题、重切、揭晓和双主题单人状态隔离", async ({page}) => {
  test.setTimeout(60000);
  await page.goto("/solo?theme=sekai");
  await expect(page.getByText("已连接",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:/开始挑战/}).click();
  await expect(page.getByLabel("角色名字或昵称")).toBeVisible({timeout:30000});
  await page.getByRole("button",{name:"换个局部"}).click();
  await expect(page.getByText("已重切",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:/揭晓/}).first().click();
  await expect(page.locator('img[src^="/cards/sekai/"]')).toBeVisible();
  await page.reload();
  await expect(page.locator('img[src^="/cards/sekai/"]')).toBeVisible();
  await page.goto("/solo");
  await expect(page.getByRole("button",{name:/开始挑战/})).toBeVisible();
  await page.goto("/solo?theme=sekai");
  await expect(page.locator('img[src^="/cards/sekai/"]')).toBeVisible();
});
