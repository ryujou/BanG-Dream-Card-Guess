
      const requestedTheme = new URLSearchParams(location.search).get('theme');
      const theme = ['sekai', 'bluearchive'].includes(requestedTheme) ? requestedTheme : 'bangdream';
      const STORAGE_PREFIX = theme === 'bangdream' ? 'bangdream:bang-klotski:' : `${theme}:klotski:`;
      const sekaiPieces = {
        michelle: ['tsukasa', '天马司'], nyamu: ['shizuku', '日野森雫'],
        moca: ['akito', '东云彰人'], arisa: ['kanade', '宵崎奏'],
        yukina: ['emu', '凤笑梦'], eve: ['rui', '神代类'],
        saya: ['ena', '东云绘名'], box: ['haruka', '桐谷遥'],
        otae: ['kohane', '小豆泽心羽'], tsukushi: ['mafuyu', '朝比奈真冬'],
      };
      const bluearchivePieces = {
        michelle: ['hoshino', '小鸟游星野'], nyamu: ['shiroko', '砂狼白子'],
        moca: ['arona', '阿洛娜'], arisa: ['serika', '黑见芹香'],
        yukina: ['nonomi', '十六夜野宫'], eve: ['ayane', '奥空绫音'],
        saya: ['aru', '陆八魔爱露'], box: ['kayoko', '鬼方佳代子'],
        otae: ['mutsuki', '浅黄睦月'], tsukushi: ['hina', '空崎日奈'],
      };
      const pieces = theme === 'sekai' ? sekaiPieces : theme === 'bluearchive' ? bluearchivePieces : null;
      const pieceImage = id => theme === 'sekai'
        ? `/brand/sekai-games/klotski/${pieces[id][0]}.webp`
        : `/brand/bluearchive/klotski/${pieces[id][0]}.webp`;
      if (pieces) {
        const name = theme === 'bluearchive' ? '星野' : pieces.michelle[1];
        document.documentElement.dataset.theme = theme;
        document.title = `华容道 · ${theme === 'sekai' ? '世界计划' : '蔚蓝档案'}同好会`;
        document.querySelector('.eyebrow').textContent = `XT ${theme === 'sekai' ? 'SEKAI' : 'BLUE ARCHIVE'} / ARCADE 02`;
        document.querySelector('.game-heading h1').innerHTML = `给${name}<br>让个位置<span>。</span>`;
        document.querySelector('.game-heading p').textContent = `滑动角色，为${name}打开下方出口。`;
        document.querySelector('.instructions p').textContent = `拖动角色，让${name}到达棋盘下方中央。`;
        document.querySelector('#victory-box img').alt = name;
        document.querySelector('#victory-box p').firstChild.textContent = `${name}的这次冒险，用了 `;
        if (theme === 'bluearchive') {
          document.querySelector('.game-heading p').textContent = '整理夏莱的通道，帮星野找到下方出口。';
          document.querySelector('.instructions p').textContent = '拖动伙伴，为星野打开通往夏莱的出口。';
          document.querySelector('#victory-box h2').textContent = '欢迎回到夏莱！';
          document.querySelector('#victory-box p').firstChild.textContent = '星野顺利抵达出口，本次任务用了 ';
          document.getElementById('btn-voice').textContent = '♫ 训练音效';
        }
      }
      const COLS = 4;
      const ROWS = 5;
      const GAP = 2;

      const TYPES = {
        "2x2": [2, 2],
        "1x2": [1, 2],
        "2x1": [2, 1],
        "1x1": [1, 1],
      };

      // 初始布局 — 参照效果图
      const INITIAL_LAYOUT = [
        { id: "michelle", type: "2x2", x: 1, y: 0, img: "images/michelle.png" },
        { id: "nyamu", type: "1x2", x: 0, y: 0, img: "images/nyamu.png" },
        { id: "moca", type: "1x2", x: 3, y: 0, img: "images/moca.png" },
        { id: "arisa", type: "1x2", x: 0, y: 2, img: "images/arisa.png" },
        { id: "yukina", type: "2x1", x: 1, y: 2, img: "images/yukina.png" },
        { id: "eve", type: "1x2", x: 3, y: 2, img: "images/eve.png" },
        { id: "saya", type: "1x1", x: 1, y: 3, img: "images/saya.png" },
        { id: "box", type: "1x1", x: 2, y: 3, img: "images/box.png" },
        { id: "otae", type: "1x1", x: 0, y: 4, img: "images/otae.png" },
        { id: "tsukushi", type: "1x1", x: 3, y: 4, img: "images/tsukushi.png" },
      ];
      if (pieces) INITIAL_LAYOUT.forEach(block => { block.img = pieceImage(block.id); });
      document.querySelector('#victory-box img').src = INITIAL_LAYOUT[0].img;

      // 当前游戏状态
      let blocks = [];
      let steps = 0;
      let solving = false;

      // 提示系统状态
      let hintSolution = null;
      let hintIndex = 0;
      let hintStateKey = null;
      let hintWorker = null;
      let hintComputing = false;

      // 拖拽状态
      let dragState = null;

      // DOM 引用
      const boardEl = document.getElementById("board");
      const stepDisplay = document.getElementById("step-display");
      const victoryOverlay = document.getElementById("victory-overlay");
      const victorySteps = document.getElementById("victory-steps");
      const elevatorFloor = document.getElementById("elevator-floor");
      const customFloorInput = document.getElementById("custom-floor");
      const randomFloorBtn = document.getElementById("random-floor");

      // ============================================================
      // 自定义楼层功能
      // ============================================================
      function updateElevatorFloor(value) {
        // 确保为正整数
        let num = parseInt(value, 10);
        if (isNaN(num) || num < 1) num = 1;
        elevatorFloor.textContent = num;
        customFloorInput.value = num; // 同步输入框
      }

      // 监听输入框变化
      customFloorInput.addEventListener('input', (e) => {
        updateElevatorFloor(e.target.value);
      });

      // 随机按钮
      randomFloorBtn.addEventListener('click', () => {
        // 生成1~1000随机整数（可调整上限）
        const randomNum = Math.floor(Math.random() * 1000) + 1;
        updateElevatorFloor(randomNum);
      });

      // ============================================================
      // 渲染
      // ============================================================
      function deepCloneLayout(layout) {
        return layout.map((b) => ({ ...b }));
      }

      function getCellSize() {
        const boardRect = boardEl.getBoundingClientRect();
        return {
          cellW: boardRect.width / COLS,
          cellH: boardRect.height / ROWS,
        };
      }

      function renderBoard() {
        boardEl.innerHTML = "";
        const { cellW, cellH } = getCellSize();

        blocks.forEach((block) => {
          const [w, h] = TYPES[block.type];
          const el = document.createElement("div");
          el.className = "block";
          el.tabIndex = 0;
          el.setAttribute('role', 'button');
          el.setAttribute('aria-label', (pieces ? pieces[block.id][1] : block.id) + '，使用方向键移动');
          el.addEventListener('keydown', event => {
            const direction = {ArrowLeft: [-1,0], ArrowRight: [1,0], ArrowUp: [0,-1], ArrowDown: [0,1]}[event.key];
            if (direction) { event.preventDefault(); moveBlock(block.id, ...direction); }
          });
          el.id = "block-" + block.id;
          el.style.width = cellW * w - GAP * 2 + "px";
          el.style.height = cellH * h - GAP * 2 + "px";
          el.style.left = block.x * cellW + GAP + "px";
          el.style.top = block.y * cellH + GAP + "px";

          const img = document.createElement("img");
          img.src = block.img;
          img.alt = pieces ? pieces[block.id][1] : block.id;
          img.draggable = false;
          el.appendChild(img);

          // 鼠标拖拽
          el.addEventListener("mousedown", (e) => {
            e.preventDefault();
            startDrag(block.id, e.clientX, e.clientY);
          });

          // 触摸拖拽
          el.addEventListener("touchstart", (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            startDrag(block.id, touch.clientX, touch.clientY);
          });

          boardEl.appendChild(el);
        });
      }

      function updateBlockPosition(block) {
        const { cellW, cellH } = getCellSize();
        const el = document.getElementById("block-" + block.id);
        if (!el) return;
        el.style.left = block.x * cellW + GAP + "px";
        el.style.top = block.y * cellH + GAP + "px";
      }

      // ============================================================
      // 拖拽交互
      // ============================================================
      function startDrag(blockId, startX, startY) {
        if (solving || hintComputing) return;
        const block = blocks.find((b) => b.id === blockId);
        if (!block) return;

        const el = document.getElementById("block-" + blockId);
        el.classList.add("dragging");

        dragState = {
          blockId,
          startX,
          startY,
          origGridX: block.x,
          origGridY: block.y,
          moved: false,
        };
      }

      function onDragMove(clientX, clientY) {
        if (!dragState) return;

        const { cellW, cellH } = getCellSize();
        const dx = clientX - dragState.startX;
        const dy = clientY - dragState.startY;

        const threshold = Math.min(cellW, cellH) * 0.1;

        if (dragState.moved) return;

        let moveDx = 0;
        let moveDy = 0;

        if (Math.abs(dx) > Math.abs(dy)) {
          if (dx > threshold) moveDx = 1;
          else if (dx < -threshold) moveDx = -1;
        } else {
          if (dy > threshold) moveDy = 1;
          else if (dy < -threshold) moveDy = -1;
        }

        if (moveDx !== 0 || moveDy !== 0) {
          const success = moveBlock(dragState.blockId, moveDx, moveDy);
          if (success) dragState.moved = true;
        }
      }

      function endDrag() {
        if (!dragState) return;
        const el = document.getElementById("block-" + dragState.blockId);
        if (el) el.classList.remove("dragging");
        dragState = null;
      }

      document.addEventListener("mousemove", (e) => onDragMove(e.clientX, e.clientY));
      document.addEventListener("mouseup", endDrag);
      document.addEventListener("touchmove", (e) => {
        if (dragState) {
          e.preventDefault();
          const touch = e.touches[0];
          onDragMove(touch.clientX, touch.clientY);
        }
      }, { passive: false });
      document.addEventListener("touchend", endDrag);
      document.addEventListener("touchcancel", endDrag);

      // ============================================================
      // 音效系统 (使用音频文件)
      // ============================================================
      const audioCache = {};

      // 角色语音配置：每个成员可配置多个音效文件，移动时随机选取一个
      const CHARACTER_AUDIO_MAP = pieces ? {} : {
        eve: ["images/eve.mp3"], // 示例：多个语音文件，请根据实际修改
        otae: ["images/otae1.mp3","images/otae2.mp3"], 
        moca: ["images/moca1.mp3",'images/moca2.mp3'],
        nyamu: ["images/nyamu.mp3"],
        saya: ["images/saya.mp3"],
        yukina: ["images/ykn.mp3"],
        arisa: ["images/aras.mp3"],
        tsukushi: ["images/tsukushi.mp3"]// 只有一个文件，则总是播放它
        // 可继续添加其他角色
      };

      // UI 音效（重置按钮等）
      const UI_AUDIO_MAP = {
        reset: "images/reset.mp3", // 重置按钮音效
      };

      let audioReady = false;

      function unlockAudioForMobile() {
        if (audioReady) return;
        audioReady = true;
        const warmup = new Audio();
        warmup.volume = 0;
        warmup.play().catch(() => {});
      }

      function tryPlayAudio(src) {
        if (!src) return;
        if (!audioReady) return;
        if (audioCache[src]) {
          const a = audioCache[src].cloneNode();
          a.volume = audioCache[src].volume || 0.6;
          a.play().catch(() => {});
          return;
        }

        const audio = new Audio(src);
        audio.volume = 0.6;

        const p = audio.play();
        if (p !== undefined) {
          p.then(() => {
            audioCache[src] = audio;
          }).catch((e) => {
            console.warn("Audio play failed or file not found:", src);
          });
        }
      }

      let voiceEnabled = localStorage.getItem(STORAGE_PREFIX + 'voice') !== 'off';
      document.getElementById('btn-voice').classList.toggle('toggle-on', voiceEnabled);
      document.getElementById('btn-voice').setAttribute('aria-pressed', String(voiceEnabled));

      function toggleVoice() {
        voiceEnabled = !voiceEnabled;
        localStorage.setItem(STORAGE_PREFIX + 'voice', voiceEnabled ? 'on' : 'off');
        const btn = document.getElementById("btn-voice");
        if (btn) {
          btn.classList.toggle("toggle-on", voiceEnabled);
          btn.setAttribute("aria-pressed", String(voiceEnabled));
        }
      }

      function playCharacterAudio(charId) {
        if (!voiceEnabled) return;
        const variants = CHARACTER_AUDIO_MAP[charId];
        if (!variants || variants.length === 0) return;
        const randomIndex = Math.floor(Math.random() * variants.length);
        tryPlayAudio(variants[randomIndex]);
      }

      const typeSoundMap = {
        "2x2": "images/2x2.mp3",
        "1x2": "images/1x2.mp3",
        "2x1": "images/1x2.mp3",
        "1x1": "images/1x1.mp3",
      };

      function playMoveSound(block) {
        if (!voiceEnabled) return;
        const typeSound = typeSoundMap[block.type];
        if (typeSound) tryPlayAudio(typeSound);
        if (block.id !== "box") {
          playCharacterAudio(block.id);
        }
      }

      function playWinSound() {
        if (!voiceEnabled) return;
        tryPlayAudio("images/win.mp3");
      }

      function playResetSound() {
        if (!voiceEnabled) return; // 重置音效也受语音开关控制
        tryPlayAudio(UI_AUDIO_MAP.reset);
      }

      function preloadSounds() {
        const audioList = [
          "images/win.mp3",
          ...Object.values(typeSoundMap),
          ...Object.values(CHARACTER_AUDIO_MAP).flat(),
          UI_AUDIO_MAP.reset,
        ];
        const uniqueSrcs = [...new Set(audioList)];
        uniqueSrcs.forEach((src) => {
          if (src && !audioCache[src]) {
            const audio = new Audio();
            audio.src = src;
            audio.volume = 0.6;
            audio.load();
            audioCache[src] = audio;
          }
        });
      }

      // ============================================================
      // 碰撞检测与移动
      // ============================================================

      function buildGrid(blocksState) {
        const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
        blocksState.forEach((b) => {
          const [w, h] = TYPES[b.type];
          for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
              grid[b.y + dy][b.x + dx] = b.id;
            }
          }
        });
        return grid;
      }

      function canMove(block, dx, dy, grid) {
        const [w, h] = TYPES[block.type];
        const nx = block.x + dx;
        const ny = block.y + dy;

        if (nx < 0 || ny < 0 || nx + w > COLS || ny + h > ROWS) return false;

        for (let r = 0; r < h; r++) {
          for (let c = 0; c < w; c++) {
            const occupant = grid[ny + r][nx + c];
            if (occupant !== null && occupant !== block.id) return false;
          }
        }
        return true;
      }

      function saveProgress() {
        localStorage.setItem(STORAGE_PREFIX + 'progress', JSON.stringify({blocks, steps}));
      }

      function moveBlock(blockId, dx, dy) {
        if (hintComputing && !solving) return false;
        const block = blocks.find((b) => b.id === blockId);
        if (!block) return false;

        const grid = buildGrid(blocks);
        if (!canMove(block, dx, dy, grid)) return false;

        block.x += dx;
        block.y += dy;
        updateBlockPosition(block);
        playMoveSound(block);

        if (!solving) {
          hintSolution = null;
          hintIndex = 0;
          hintStateKey = null;
          steps++;
          stepDisplay.textContent = steps;
        }

        saveProgress();
        if (block.id === "michelle" && block.x === 1 && block.y === 3) {
          setTimeout(() => {
            playWinSound();
            showVictory();
          }, 300);
        }

        return true;
      }

      function showVictory() {
        victorySteps.textContent = steps;
        victoryOverlay.classList.add("show");
      }

      function resetGame() {
        playResetSound(); // 播放重置音效

        solving = false;
        steps = 0;
        stepDisplay.textContent = "0";
        victoryOverlay.classList.remove("show");
        blocks = deepCloneLayout(INITIAL_LAYOUT);
        hintSolution = null;
        hintIndex = 0;
        hintStateKey = null;
        hintComputing = false;
        if (hintWorker) {
          hintWorker.terminate();
          hintWorker = null;
        }
        const btnHint = document.getElementById("btn-hint");
        if (btnHint) {
          btnHint.disabled = false;
          btnHint.textContent = "提 示";
        }
        renderBoard();
        // 重置电梯显示为1
        updateElevatorFloor(1);
        saveProgress();
      }

      // ============================================================
      // 提示系统 (Web Worker BFS)
      // ============================================================


      function getHint() {
        if (solving || hintComputing) return;

        const btnHint = document.getElementById("btn-hint");

        if (hintSolution && hintIndex < hintSolution.length) {
          const move = hintSolution[hintIndex];
          solving = true;
          moveBlock(move.id, move.dx, move.dy);
          steps++;
          stepDisplay.textContent = steps;
          saveProgress();
          solving = false;
          hintIndex++;
          if (hintIndex >= hintSolution.length) {
            hintSolution = null;
            hintStateKey = null;
          }
          return;
        }

        hintComputing = true;
        btnHint.disabled = true;
        btnHint.textContent = "思考中…";

        hintWorker = new Worker("/games/bang-klotski/solver-worker.js");

        hintWorker.onmessage = function (e) {
          hintWorker.terminate();
          hintWorker = null;
          hintComputing = false;
          btnHint.disabled = false;
          btnHint.textContent = "提 示";

          if (e.data.success && e.data.moves.length > 0) {
            hintSolution = e.data.moves;
            hintIndex = 0;
            const move = hintSolution[hintIndex];
            solving = true;
            moveBlock(move.id, move.dx, move.dy);
            steps++;
            stepDisplay.textContent = steps;
            saveProgress();
            solving = false;
            hintIndex++;
            if (hintIndex >= hintSolution.length) {
              hintSolution = null;
              hintStateKey = null;
            }
          }
        };

        hintWorker.onerror = function () {
          hintWorker.terminate();
          hintWorker = null;
          hintComputing = false;
          btnHint.disabled = false;
          btnHint.textContent = "提 示";
          alert("求解出错，请重试");
        };

        hintWorker.postMessage(deepCloneLayout(blocks));
      }

      // ============================================================
      // 启动
      // ============================================================
      document.getElementById("btn-hint").addEventListener("click", getHint);
      document.getElementById("btn-reset").addEventListener("click", resetGame);
      document.getElementById("btn-voice").addEventListener("click", toggleVoice);
      document.querySelector("#victory-box button").addEventListener("click", resetGame);
      window.addEventListener("load", () => {
        preloadSounds();
        const saved = localStorage.getItem(STORAGE_PREFIX + 'progress');
        if (saved) {
          const progress = JSON.parse(saved);
          blocks = progress.blocks.map(block => ({ ...block, img: INITIAL_LAYOUT.find(piece => piece.id === block.id).img }));
          steps = progress.steps;
          stepDisplay.textContent = steps;
          renderBoard();
          if (blocks.some(block => block.id === 'michelle' && block.x === 1 && block.y === 3)) showVictory();
        } else resetGame();
        ["pointerdown", "touchstart", "keydown"].forEach((eventName) => {
          document.addEventListener(eventName, unlockAudioForMobile, { once: true });
        });

      });

      window.addEventListener("resize", () => {
        renderBoard();
      });
    

