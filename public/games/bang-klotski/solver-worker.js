        const COLS = 4, ROWS = 5;
        const TYPES = { '2x2': [2,2], '1x2': [1,2], '2x1': [2,1], '1x1': [1,1] };
        // 类型编码: 0=空, 1=1x1, 2=1x2(占上半), 3=1x2(占下半), 4=2x1(占左半), 5=2x1(占右半),
        //           6=michelle左上, 7=michelle右上, 8=michelle左下, 9=michelle右下

        function encodeState(bs) {
          const g = new Uint8Array(20);
          for (const b of bs) {
            const [w, h] = TYPES[b.type];
            if (b.id === 'michelle') {
              g[b.y * COLS + b.x] = 6;
              g[b.y * COLS + b.x + 1] = 7;
              g[(b.y + 1) * COLS + b.x] = 8;
              g[(b.y + 1) * COLS + b.x + 1] = 9;
            } else if (b.type === '1x1') {
              g[b.y * COLS + b.x] = 1;
            } else if (b.type === '1x2') {
              g[b.y * COLS + b.x] = 2;
              g[(b.y + 1) * COLS + b.x] = 3;
            } else if (b.type === '2x1') {
              g[b.y * COLS + b.x] = 4;
              g[b.y * COLS + b.x + 1] = 5;
            }
          }
          return String.fromCharCode.apply(null, g);
        }

        function buildGrid(bs) {
          const grid = [];
          for (let r = 0; r < ROWS; r++) grid[r] = new Array(COLS).fill(-1);
          for (let i = 0; i < bs.length; i++) {
            const b = bs[i];
            const [w, h] = TYPES[b.type];
            for (let dy = 0; dy < h; dy++)
              for (let dx = 0; dx < w; dx++)
                grid[b.y + dy][b.x + dx] = i;
          }
          return grid;
        }

        function canMove(b, dx, dy, grid, idx) {
          const [w, h] = TYPES[b.type];
          const nx = b.x + dx, ny = b.y + dy;
          if (nx < 0 || ny < 0 || nx + w > COLS || ny + h > ROWS) return false;
          for (let r = 0; r < h; r++)
            for (let c = 0; c < w; c++) {
              const occ = grid[ny + r][nx + c];
              if (occ !== -1 && occ !== idx) return false;
            }
          return true;
        }

        self.onmessage = function(e) {
          const startBlocks = e.data;
          const visited = new Set();
          const startKey = encodeState(startBlocks);
          visited.add(startKey);

          const queue = [startBlocks.map(b => ({...b}))];
          const parent = [null];
          let head = 0;

          const dirs = [[0,-1],[0,1],[-1,0],[1,0]];

          while (head < queue.length) {
            const state = queue[head];
            const michIdx = state.findIndex(b => b.id === 'michelle');

            if (state[michIdx].x === 1 && state[michIdx].y === 3) {
              const path = [];
              let cur = head;
              while (parent[cur] !== null) {
                const p = parent[cur];
                path.unshift({ id: queue[p.stateIdx][p.blockIdx].id, dx: p.dx, dy: p.dy });
                cur = p.stateIdx;
              }
              self.postMessage({ success: true, moves: path });
              return;
            }

            const grid = buildGrid(state);

            for (let bi = 0; bi < state.length; bi++) {
              const b = state[bi];
              for (const [dx, dy] of dirs) {
                if (!canMove(b, dx, dy, grid, bi)) continue;
                const ns = state.map(x => ({...x}));
                ns[bi] = {...ns[bi], x: ns[bi].x + dx, y: ns[bi].y + dy};
                const key = encodeState(ns);
                if (visited.has(key)) continue;
                visited.add(key);
                queue.push(ns);
                parent.push({ stateIdx: head, blockIdx: bi, dx, dy });
              }
            }
            head++;
          }

          self.postMessage({ success: false });
        };
