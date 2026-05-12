import * as THREE from "three";

const DEFAULT_SETTINGS = { targetSeconds: 10, toleranceSeconds: 0.02 };

export function mountStopwatchChallenge(container) {
  container.innerHTML = renderLayout();
  const root = container.querySelector(".stopwatch-page");
  const ui = bindUi(root);
  const state = createState({ ...DEFAULT_SETTINGS });
  const three = createThreeBackground(ui.canvas, () => state.mode);

  requestFullscreenSafe();
  loadServerSettings().then((next) => {
    state.targetSeconds = next.targetSeconds;
    state.toleranceSeconds = next.toleranceSeconds;
    render();
  });

  let disposed = false;

  const render = () => {
    if (disposed) return;
    const elapsed = state.mode === "holding" ? (performance.now() - state.startTime) / 1000 : state.elapsedSeconds;
    ui.timer.textContent = `${formatSeconds(elapsed)} s`;
    ui.targetBadge.textContent = `目标 ${formatSeconds(state.targetSeconds)} s`;
    ui.modeHint.textContent = modeHintText(state.mode);
    ui.modeHint.className = `stopwatch-mode-hint is-${state.mode}`;
    root.dataset.mode = state.mode;
  };

  const stopTick = () => {
    if (!state.rafId) return;
    cancelAnimationFrame(state.rafId);
    state.rafId = 0;
  };

  const tick = () => {
    if (state.mode !== "holding") {
      state.rafId = 0;
      return;
    }
    render();
    state.rafId = requestAnimationFrame(tick);
  };

  const startHolding = () => {
    if (state.mode === "holding") return;
    state.mode = "holding";
    state.startTime = performance.now();
    state.elapsedSeconds = 0;
    render();
    stopTick();
    state.rafId = requestAnimationFrame(tick);
  };

  const stopHolding = () => {
    if (state.mode !== "holding") return;
    stopTick();
    const elapsedSeconds = (performance.now() - state.startTime) / 1000;
    const error = Math.abs(elapsedSeconds - state.targetSeconds);
    state.elapsedSeconds = elapsedSeconds;
    state.mode = error <= state.toleranceSeconds ? "win" : "lose";
    render();
  };

  const resetRound = () => {
    stopTick();
    state.mode = "idle";
    state.elapsedSeconds = 0;
    render();
  };

  const onPointerDown = (event) => {
    event.preventDefault();
    ui.pad.setPointerCapture?.(event.pointerId);
    startHolding();
  };

  const onPointerUpLike = (event) => {
    event.preventDefault();
    stopHolding();
  };

  const shouldIgnoreKey = () => {
    const active = document.activeElement;
    if (!active) return false;
    return ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(active.tagName);
  };

  const onKeyDown = (event) => {
    const key = event.key;
    if ((key !== " " && key !== "Enter") || shouldIgnoreKey()) return;
    event.preventDefault();
    if (event.repeat) return;
    startHolding();
  };

  const onKeyUp = (event) => {
    const key = event.key;
    if (key !== " " && key !== "Enter") return;
    event.preventDefault();
    stopHolding();
  };

  const onVisibilityLoss = () => {
    if (document.hidden) stopHolding();
  };

  ui.pad.addEventListener("pointerdown", onPointerDown);
  ui.pad.addEventListener("pointerup", onPointerUpLike);
  ui.pad.addEventListener("pointercancel", onPointerUpLike);
  ui.pad.addEventListener("pointerleave", onPointerUpLike);
  ui.pad.addEventListener("dblclick", (event) => {
    event.preventDefault();
    resetRound();
  });
  window.addEventListener("pointerup", onPointerUpLike);
  window.addEventListener("blur", stopHolding);
  document.addEventListener("visibilitychange", onVisibilityLoss);
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);

  render();

  return () => {
    disposed = true;
    stopTick();
    ui.pad.removeEventListener("pointerdown", onPointerDown);
    ui.pad.removeEventListener("pointerup", onPointerUpLike);
    ui.pad.removeEventListener("pointercancel", onPointerUpLike);
    ui.pad.removeEventListener("pointerleave", onPointerUpLike);
    window.removeEventListener("pointerup", onPointerUpLike);
    window.removeEventListener("blur", stopHolding);
    document.removeEventListener("visibilitychange", onVisibilityLoss);
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("keyup", onKeyUp);
    three.destroy();
  };
}

function createState(settings) {
  return {
    mode: "idle",
    startTime: 0,
    elapsedSeconds: 0,
    targetSeconds: settings.targetSeconds,
    toleranceSeconds: settings.toleranceSeconds,
    rafId: 0,
  };
}

function bindUi(root) {
  return {
    canvas: root.querySelector("#stopwatchScene"),
    timer: root.querySelector("#stopwatchTimer"),
    targetBadge: root.querySelector("#targetBadge"),
    modeHint: root.querySelector("#modeHint"),
    pad: root.querySelector("#holdPad"),
  };
}

function renderLayout() {
  return `
    <main class="stopwatch-page" data-mode="idle">
      <canvas id="stopwatchScene" aria-hidden="true"></canvas>
      <section class="stopwatch-card stopwatch-card-minimal">
        <div class="stopwatch-display-wrap">
          <div id="targetBadge" class="stopwatch-target">目标 10.00 s</div>
          <div id="stopwatchTimer" class="stopwatch-timer">0.00 s</div>
          <div id="modeHint" class="stopwatch-mode-hint is-idle">准备开始</div>
        </div>
        <button id="holdPad" type="button" class="stopwatch-hold-pad stopwatch-hold-circle" aria-label="按住计时">
          <span>按住</span>
        </button>
      </section>
    </main>
  `;
}

function modeHintText(mode) {
  if (mode === "holding") return "计时进行中";
  if (mode === "win") return "挑战成功";
  if (mode === "lose") return "挑战失败";
  return "准备开始";
}

async function loadServerSettings() {
  try {
    const response = await fetch("/api/stopwatch-settings", { cache: "no-store" });
    if (!response.ok) return { ...DEFAULT_SETTINGS };
    const value = await response.json();
    const target = Number(value.targetSeconds);
    const tolerance = Number(value.toleranceSeconds);
    if (!Number.isFinite(target) || !Number.isFinite(tolerance)) return { ...DEFAULT_SETTINGS };
    if (target < 1 || target > 99.99 || tolerance <= 0 || tolerance > target) return { ...DEFAULT_SETTINGS };
    return { targetSeconds: round2(target), toleranceSeconds: round2(tolerance) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function requestFullscreenSafe() {
  const el = document.documentElement;
  if (!document.fullscreenElement && el?.requestFullscreen) el.requestFullscreen().catch(() => {});
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function formatSeconds(value) {
  return Number(value || 0).toFixed(2);
}

function createThreeBackground(canvas, getMode) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 120);
  camera.position.set(0, 0.2, 7);

  const group = new THREE.Group();
  scene.add(group);

  const icosa = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.2, 1),
    new THREE.MeshStandardMaterial({ color: 0x6e5dff, metalness: 0.35, roughness: 0.18, emissive: 0x141432, emissiveIntensity: 0.9 })
  );
  group.add(icosa);

  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.06, 24, 160),
    new THREE.MeshBasicMaterial({ color: 0x5adfff, transparent: true, opacity: 0.7 })
  );
  torus.rotation.x = Math.PI / 2.8;
  group.add(torus);

  const particleCount = 700;
  const particleGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i += 1) {
    const radius = 6 + Math.random() * 12;
    const angle = Math.random() * Math.PI * 2;
    const y = (Math.random() - 0.5) * 8;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = Math.sin(angle) * radius;
  }
  particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const particles = new THREE.Points(
    particleGeometry,
    new THREE.PointsMaterial({ color: 0x8cd4ff, size: 0.042, transparent: true, opacity: 0.9 })
  );
  scene.add(particles);

  const lightA = new THREE.PointLight(0x66b3ff, 2.1, 26);
  lightA.position.set(4, 3, 6);
  scene.add(lightA);
  const lightB = new THREE.PointLight(0x51ffd2, 1.8, 22);
  lightB.position.set(-5, -2, 5);
  scene.add(lightB);
  scene.add(new THREE.AmbientLight(0x5b7aa8, 0.55));

  let raf = 0;
  const clock = new THREE.Clock();

  const onResize = () => {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };

  const palette = {
    idle: { emissive: 0x141432, ring: 0x5adfff, particle: 0x8cd4ff },
    holding: { emissive: 0x0f3a36, ring: 0x39ffd3, particle: 0x7dffe8 },
    win: { emissive: 0x183d17, ring: 0x61ff79, particle: 0xa3ff8d },
    lose: { emissive: 0x3a1717, ring: 0xff8f55, particle: 0xffb08a },
  };

  const animate = () => {
    const t = clock.getElapsedTime();
    const mode = getMode();
    const current = palette[mode] || palette.idle;
    icosa.rotation.x += 0.0038;
    icosa.rotation.y += 0.005;
    torus.rotation.z += 0.0028;
    group.position.y = Math.sin(t * 0.8) * 0.22;
    particles.rotation.y += 0.0007;

    icosa.material.emissive.lerp(new THREE.Color(current.emissive), 0.09);
    torus.material.color.lerp(new THREE.Color(current.ring), 0.08);
    particles.material.color.lerp(new THREE.Color(current.particle), 0.08);
    particles.material.size = mode === "win" ? 0.064 : 0.042;

    renderer.render(scene, camera);
    raf = requestAnimationFrame(animate);
  };

  window.addEventListener("resize", onResize);
  onResize();
  animate();

  return {
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      icosa.geometry.dispose();
      icosa.material.dispose();
      torus.geometry.dispose();
      torus.material.dispose();
      particleGeometry.dispose();
      particles.material.dispose();
    },
  };
}
