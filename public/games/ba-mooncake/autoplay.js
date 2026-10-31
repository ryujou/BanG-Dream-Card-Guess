(() => {
  const button = document.createElement("button");
  button.textContent = "自动游玩：关闭";
  Object.assign(button.style, {
    position: "fixed", bottom: "4px", left: "6px", zIndex: "100000",
    padding: "clamp(4px, .6vw, 8px) clamp(6px, 1vw, 14px)", minHeight: "clamp(22px, 4.3vw, 36px)", border: "1px solid #9fdcff", borderRadius: "8px",
    background: "#243c60", color: "white", font: "bold clamp(10px, 1.4vw, 14px) sans-serif",
    cursor: "pointer"
  });
  document.body.append(button);

  let enabled = false;
  let lastShot = 0;
  let lastDecision = null;
  const turnOff = () => { enabled = false; button.textContent = "自动游玩：关闭"; };

  button.addEventListener("click", () => {
    enabled = !enabled;
    button.textContent = enabled ? "自动游玩：开启" : "自动游玩：关闭";
    if (enabled) {
      const home = window.__moonGame?.scene.getScene("MainScene");
      if (home?.scene.isActive()) home.goto("PlayingScene");
    }
  });

  function boardState(scene) {
    const slots = scene._allBalls();
    const board = new Map(slots.filter(cell => cell.hasball).map(cell => [cell, cell.key]));
    const occupied = slots.filter(cell => board.has(cell) && !cell.isPreview);
    const empty = slots.filter(cell => !board.has(cell) && !cell.isPreview);
    return { slots, occupied, empty, keys: board };
  }

  function neighbors(scene, cell) {
    return scene._getNeighborSlots(cell);
  }

  function nearest(cells, x, y) {
    let best = null, bestDistance = Infinity;
    for (const cell of cells) {
      const distance = (cell.x - x) ** 2 + (cell.y - y) ** 2;
      if (distance < bestDistance) { best = cell; bestDistance = distance; }
    }
    return best;
  }

  function landing(scene, state, angle) {
    const shooter = scene._shooter;
    const diameter = 64;
    const radiusSquared = (diameter * 0.9) ** 2;
    let x = shooter._sx, y = shooter._sy;
    let vx = Math.cos(angle) * 8, vy = Math.sin(angle) * 8;
    const top = -406.5 + 45 + 32 + 55 + 10;
    for (let step = 0; step < 280; step++) {
      x += vx; y += vy;
      if (x < shooter._bounds.left) { x = 2 * shooter._bounds.left - x; vx = -vx; }
      if (x > shooter._bounds.right) { x = 2 * shooter._bounds.right - x; vx = -vx; }
      for (const hit of state.occupied) {
        if ((x - hit.x) ** 2 + (y - hit.y) ** 2 < radiusSquared) {
          const slot = nearest(neighbors(scene, hit).filter(cell => !state.keys.has(cell)), x, y);
          return slot || nearest(state.empty, x, y);
        }
      }
      if (y <= top) return nearest(state.empty, x, y);
    }
    return null;
  }

  function evaluate(scene, state, slot, key, wildcard, blast) {
    const keys = new Map(state.keys);
    if (wildcard) {
      const nearby = nearest(neighbors(scene, slot).filter(cell => state.keys.has(cell) && !cell.isPreview), slot.x, slot.y);
      if (nearby) key = nearby.key;
    }
    keys.set(slot, key);

    let cleared = [];
    if (blast) {
      cleared = state.occupied.filter(cell => Math.abs(cell.row - slot.row) <= 2 && Math.abs(cell.col - slot.col) <= 2);
      cleared.push(slot);
    } else {
      const seen = new Set([slot]);
      const queue = [slot];
      for (let i = 0; i < queue.length; i++) {
        for (const next of neighbors(scene, queue[i])) {
          if (!next.isPreview && keys.get(next) === key && !seen.has(next)) {
            seen.add(next); queue.push(next);
          }
        }
      }
      if (queue.length >= 3) cleared = queue;
    }

    const clearedSet = new Set(cleared);
    for (const cell of cleared) keys.delete(cell);
    const anchored = new Set();
    const queue = state.slots.filter(cell => cell.row === 0 && keys.has(cell));
    for (const cell of queue) anchored.add(cell);
    for (let i = 0; i < queue.length; i++) {
      for (const next of neighbors(scene, queue[i])) {
        if (!next.isPreview && keys.has(next) && !anchored.has(next)) {
          anchored.add(next); queue.push(next);
        }
      }
    }
    const dropped = [...keys.keys()].filter(cell => !cell.isPreview && !anchored.has(cell));
    for (const cell of dropped) keys.delete(cell);
    const previousMax = Math.max(0, ...state.occupied.map(cell => cell.row));
    const nextMax = Math.max(0, ...[...keys.keys()].filter(cell => !cell.isPreview).map(cell => cell.row));
    const touching = neighbors(scene, slot).filter(cell => state.keys.get(cell) === key && !cell.isPreview).length;
    const points = blast ? dropped.length * 15 : cleared.length * 10 + dropped.length * 15;
    const danger = Math.max(0, nextMax - 5);
    const value = points + (previousMax - nextMax) * 18
      + (!cleared.length && touching ? 5 + touching * 3 : 0)
      - danger * danger * 7 - slot.row * 0.8
      + (cleared.length >= 3 ? cleared.length * 0.8 : 0);
    return { value, points, cleared: clearedSet.size, dropped: dropped.length, slot };
  }

  function candidates(scene, state, key, wildcard, blast) {
    const shooter = scene._shooter;
    const choices = [];
    const seen = new Set();
    for (let i = 0; i <= 150; i++) {
      const angle = -Math.PI + Math.PI / 12 + i * (Math.PI - Math.PI / 6) / 150;
      const slot = landing(scene, state, angle);
      if (!slot) continue;
      const id = `${slot.row},${slot.col}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const result = evaluate(scene, state, slot, key, wildcard, blast);
      choices.push({ ...result, angle });
    }
    return choices.sort((a, b) => b.value - a.value);
  }

  function chooseShot(scene) {
    const shooter = scene._shooter;
    return candidates(scene, boardState(scene), shooter._currentKey,
      shooter._wildcardRemaining > 0, shooter._blastActive)[0] || null;
  }

  function useSkills(scene) {
    const skills = scene._skillPanel._skills;
    const ready = id => skills[id - 1]?.ready;
    const use = id => scene._skillPanel._onSkillClick(skills[id - 1]);
    const state = boardState(scene);
    const maxRow = Math.max(0, ...state.occupied.map(cell => cell.row));
    let used = false;
    if (ready(4) && maxRow >= 5) { use(4); used = true; }
    if (ready(2) && scene._previewOverlay._remaining <= 12) { use(2); used = true; }
    if (ready(3) && scene._shooter._wildcardRemaining === 0) { use(3); used = true; }
    if (ready(1) && !scene._shooter._blastActive && state.occupied.length >= 25) { use(1); used = true; }
    return used;
  }

  function tick() {
    if (!enabled) return;
    const game = window.__moonGame;
    const store = window.__moonStore?.getState();
    if (!game || !store) return;
    const scene = game.scene.getScene("PlayingScene");
    if (!scene?.scene.isActive()) return;
    if (store.popup === "over") { turnOff(); return; }
    if (store.gamePhase !== "playing" || store.popup || !scene._shooter ||
        scene._shootLocked || scene._pushingDown || scene._shooter.bullets.length ||
        performance.now() - lastShot < 220) return;
    if (useSkills(scene)) return;
    const shot = chooseShot(scene);
    if (!shot) return;
    const shooter = scene._shooter;
    const x = shooter._sx + Math.cos(shot.angle) * 200;
    const y = shooter._sy + Math.sin(shot.angle) * 200;
    const pointer = scene._frameContainer.getWorldTransformMatrix().transformPoint(x, y);
    shooter._handlePointerUp(pointer);
    lastShot = performance.now();
    lastDecision = shot;
  }

  window.mooncakeAuto = {
    start: () => { if (!enabled) button.click(); },
    stop: turnOff,
    get lastDecision() { return lastDecision; }
  };
  setInterval(tick, 180);
})();
