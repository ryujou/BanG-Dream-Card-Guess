import type { Page } from "@playwright/test";

const observer = String.raw`
    const parity = {frames: [], transitions: [], firstVisible: [], frame: 0};
    const objectIds = new WeakMap(), imageInfo = new WeakMap(), previousDraw = new Map();
    const counters = {}, visibleObjects = new Set();
    let drawingObject = null, draws = [];
    const rounded = value => Math.round(value * 1000000) / 1000000;
    const rect = value => [value.x, value.y, value.width, value.height].map(rounded);
    function imageMetadata(image) {
      if (imageInfo.has(image)) return imageInfo.get(image);
      const buffer = document.createElement('canvas');
      buffer.width = image.naturalWidth; buffer.height = image.naturalHeight;
      const context = buffer.getContext('2d', {willReadFrequently:true});
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, buffer.width, buffer.height).data;
      let left = buffer.width, top = buffer.height, right = -1, bottom = -1;
      for (let y=0;y<buffer.height;y++) for (let x=0;x<buffer.width;x++) {
        if (pixels[(y*buffer.width+x)*4+3] > 16) {
          left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
        }
      }
      const metadata = {key:Object.keys(assetImages).find(key=>assetImages[key]===image),
        source:new URL(image.src).pathname,width:image.naturalWidth,height:image.naturalHeight,
        alpha:[left,top,right-left+1,bottom-top+1]};
      imageInfo.set(image,metadata);return metadata;
    }
    function identify(object,role) {
      if (!objectIds.has(object)) objectIds.set(object, role+':'+(counters[role]=(counters[role]||0)+1));
      return objectIds.get(object);
    }
    for (const [role,Class] of [['player',Player],['bear',Bear],['boss',Boss],['portrait',PowerUp],['item',CharaItem]]) {
      const draw = Class.prototype.draw;
      Class.prototype.draw = function(...args) {
        const parent=drawingObject;drawingObject={role,object:this,id:identify(this,role)};
        try{return draw.apply(this,args)}finally{drawingObject=parent}
      };
    }
    const drawImage = ctx.drawImage;
    ctx.drawImage = function(image,...coordinates) {
      if (drawingObject && coordinates.length===4) {
        const metadata=imageMetadata(image), [x,y,width,height]=coordinates;
        const visible=[x+metadata.alpha[0]/metadata.width*width,y+metadata.alpha[1]/metadata.height*height,
          metadata.alpha[2]/metadata.width*width,metadata.alpha[3]/metadata.height*height].map(rounded);
        const {object,role,id}=drawingObject;
        const row={id,role,key:metadata.key,source:metadata.source,box:coordinates.map(rounded),alphaBox:visible,
          body:rect(object),dead:!!object.isDead,attack:object.attackState||null};
        draws.push(row);
        const signature=[row.key,row.dead,row.attack].join('|');
        if(previousDraw.get(id)!==signature){parity.transitions.push({time:rounded(lastTime-gameStartTime),...row});previousDraw.set(id,signature)}
        if(!visibleObjects.has(id)&&visible[0]+visible[2]>0&&visible[1]+visible[3]>0&&visible[0]<canvasWidth&&visible[1]<canvasHeight){
          visibleObjects.add(id);parity.firstVisible.push({time:rounded(lastTime-gameStartTime),...row});
        }
      }
      return drawImage.call(this,image,...coordinates);
    };
    const snapshot=()=>({time:rounded(lastTime-gameStartTime),state:gameState,level:currentLevel,canvas:[canvasWidth,canvasHeight],
      player:player?{box:rect(player),characters:[...player.characters],type:player.currentCharacterType,dead:player.isDead,
        health:playerHealth,anim:rounded(player.animTimer),defeated:player.defeatCharacters.map(item=>({...item}))}:null,
      boss:boss?{box:rect(boss),phase:boss.phase,attack:boss.attackState,health:boss.health,anim:rounded(boss.animTimer)}:null,
      bears:bears.map(value=>({id:identify(value,'bear'),box:rect(value),health:value.health})),
      portraits:powerUps.map(value=>({id:identify(value,'portrait'),box:rect(value),type:value.type})),
      items:charaItems.map(value=>({id:identify(value,'item'),box:rect(value),type:value.itemNum,variant:value.variant})),
      bullets:bullets.map(value=>({box:rect(value),type:value.bulletType})),
      bossBullets:bossBullets.map(value=>({box:rect(value),velocity:[rounded(value.vx),rounded(value.vy)]})),deaths:deathCount});
    const loop=gameLoop;
    gameLoop=function(timestamp){
      draws=[];loop(timestamp);parity.frame++;
      parity.frames.push({...snapshot(),draws});
    };
    window.__shooterParity={read:()=>({...parity,current:snapshot()}),snapshot,started:()=>parity.frame>0,
      imagePairDifference:(first,second)=>{
        const arrays=[first,second].map(key=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
          const context=canvas.getContext('2d');context.drawImage(assetImages[key],0,0,128,128);return context.getImageData(0,0,128,128).data});
        let changed=0;for(let index=0;index<arrays[0].length;index+=4)if([0,1,2,3].some(channel=>Math.abs(arrays[0][index+channel]-arrays[1][index+channel])>16))changed++;
        return {changedPixels:changed,ratio:changed/(128*128)};
      }};
    document.addEventListener('click',event=>{
      if(!event.target.closest('#start-button'))return;
      let seed=123456789;
      Math.random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296};
    },true);
`;

export async function installShooterObserver(page: Page, source?: string) {
  await page.route(/\/note-shooter\/engine\.js(?:\?|$)/, async route => {
    const response = await route.fetch();
    const engine = source ?? await response.text();
    if (!engine.endsWith("  })();\r\n") && !engine.trimEnd().endsWith("})();")) throw new Error("Unexpected shooter module boundary");
    await route.fulfill({ response, body: engine.replace(/  \}\)\(\);\s*$/, observer + "  })();") });
  });
  await page.route("**/note-shooter-api/gameStat", route => route.fulfill({ json: {success:true} }));
}

export async function startShooter(page: Page, theme: string, level: number, source?: string) {
  await installShooterObserver(page, source);
  await page.goto(`/note-shooter/bangdream.html?theme=${theme}`);
  await page.waitForFunction(() => !(document.querySelector("#start-button") as HTMLButtonElement)?.disabled);
  await page.locator('[data-lang="zh"]').click();
  await page.locator("#level-selector").selectOption(String(level));
  await page.locator("#player-name-input").fill("Parity QA");
  await page.clock.install({ time: new Date("2026-10-31T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-31T00:00:01Z"));
  await page.locator("#start-button").click();
  await page.waitForFunction(() => (window as any).__shooterParity.started());
}

export async function moveShooter(page: Page, x: number, y: number, touch = false) {
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("Shooter canvas is not visible");
  if (touch) await page.touchscreen.tap(box.x + box.width * x, box.y + box.height * y);
  else await page.mouse.move(box.x + box.width * x, box.y + box.height * y);
}

export async function shooterObservation(page: Page) {
  return page.evaluate(() => (window as any).__shooterParity.read());
}
