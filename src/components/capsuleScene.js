/* Three.js scene: a split pharmaceutical capsule (R&D blue / manufacturing coral) with a
   glowing key core, orbiting photons on tilted rings and a drifting particle field.
   It renders into its own offscreen canvas; DitherVeil3D reads that canvas every frame. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const BG = 0x07090d;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const halfGeometry = (R, L) => {
  const pts = [new THREE.Vector2(0.0001, 0), new THREE.Vector2(R, 0), new THREE.Vector2(R, L)];
  const N = 28;
  for (let i = 1; i <= N; i++) {
    const a = (i / N) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.max(0.0001, Math.cos(a) * R), L + Math.sin(a) * R));
  }
  return new THREE.LatheGeometry(pts, 72);
};

export function createCapsuleScene() {
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(BG, 1);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTexture;
  scene.environmentIntensity = 0.8;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 11);

  const key = new THREE.DirectionalLight(0xffffff, 1.7);
  key.position.set(4, 5, 6);
  const rimBlue = new THREE.PointLight(0x3d5afe, 70, 22);
  rimBlue.position.set(-5, 2, -3);
  const rimCoral = new THREE.PointLight(0xff6a4d, 70, 22);
  rimCoral.position.set(5, -2, -3);
  scene.add(key, rimBlue, rimCoral);

  const rig = new THREE.Group();
  scene.add(rig);
  const tilt = new THREE.Group();
  tilt.rotation.z = -0.42;
  rig.add(tilt);
  const capsule = new THREE.Group();
  capsule.rotation.z = Math.PI / 2;
  tilt.add(capsule);

  const R = 0.62;
  const L = 0.95;
  const geoHalf = halfGeometry(R, L);
  const matBlue = new THREE.MeshPhysicalMaterial({
    color: 0x3d5afe, roughness: 0.22, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide
  });
  const matCoral = new THREE.MeshPhysicalMaterial({
    color: 0xff6a4d, roughness: 0.24, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide
  });
  const topHalf = new THREE.Mesh(geoHalf, matBlue);
  const bottomHalf = new THREE.Mesh(geoHalf, matCoral);
  bottomHalf.rotation.x = Math.PI;
  capsule.add(topHalf, bottomHalf);

  const coreMat = new THREE.MeshBasicMaterial({ color: 0xf2c35b });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.34, 32, 32), coreMat);
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0xf2c35b, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false
  });
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.56, 32, 32), haloMat);
  capsule.add(core, halo);

  const ringDefs = [
    { r: 2.5, tilt: [1.2, 0.2, 0], speed: 0.7, n: 2 },
    { r: 3.1, tilt: [0.5, 0.9, 0.3], speed: -0.5, n: 3 },
    { r: 3.7, tilt: [1.0, -0.7, 0.9], speed: 0.35, n: 2 }
  ];
  const photonColors = [0xff6a4d, 0x8fa4ff, 0xf2c35b];
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xece9e1, transparent: true, opacity: 0.3 });
  const photonGeo = new THREE.SphereGeometry(0.075, 16, 16);
  const photonMats = photonColors.map(c => new THREE.MeshBasicMaterial({ color: c }));
  const ringGeos = [];
  const orbiters = [];
  ringDefs.forEach((def, ri) => {
    const g = new THREE.Group();
    g.rotation.set(def.tilt[0], def.tilt[1], def.tilt[2]);
    const geo = new THREE.TorusGeometry(def.r, 0.006, 6, 220);
    ringGeos.push(geo);
    g.add(new THREE.Mesh(geo, ringMat));
    for (let i = 0; i < def.n; i++) {
      const pivot = new THREE.Group();
      pivot.rotation.z = (i / def.n) * Math.PI * 2;
      const p = new THREE.Mesh(photonGeo, photonMats[(ri + i) % photonMats.length]);
      p.position.x = def.r;
      pivot.add(p);
      g.add(pivot);
      orbiters.push({ pivot, speed: def.speed });
    }
    rig.add(g);
  });

  const COUNT = 420;
  const positions = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    const r = 4.2 + Math.random() * 7;
    const u = Math.random() * 2 - 1;
    const a = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    positions.set([r * s * Math.cos(a), r * u * 0.7, r * s * Math.sin(a)], i * 3);
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const dustMat = new THREE.PointsMaterial({
    color: 0xece9e1, size: 0.035, transparent: true, opacity: 0.55, depthWrite: false
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  rig.add(dust);

  const state = {
    rx: 0.22, ry: 0.4, vx: 0, vy: 0.28, dragging: false,
    hx: 0, hy: 0, hxs: 0, hys: 0,
    split: 0, splitTarget: 0, splitHold: 0, boost: 0,
    scroll: 0, time: 0, hold: 0, threat: 0, threatTarget: 0
  };
  const coreTarget = new THREE.Color(0xf2c35b);
  const MIMOSA = new THREE.Color(0xf2c35b);
  const CORAL = new THREE.Color(0xff6a4d);
  const MAGENTA = new THREE.Color(0xe5334f);

  const update = dt => {
    state.time += dt;
    if (!state.dragging) {
      state.ry += state.vy * dt;
      state.vy += (0.28 - state.vy) * Math.min(1, dt * 1.2);
      state.rx += state.vx * dt;
      state.vx *= Math.pow(0.05, dt);
      state.rx += (0.22 - state.rx) * Math.min(1, dt * 0.8);
    }
    const k4 = 1 - Math.exp(-dt * 4);
    state.hxs += (state.hx - state.hxs) * k4;
    state.hys += (state.hy - state.hys) * k4;
    rig.rotation.y = state.ry + state.hxs * 0.35;
    rig.rotation.x = state.rx + state.hys * 0.2 + state.scroll * 0.8;
    rig.position.y = state.scroll * 0.9;

    if (state.splitHold > 0) {
      state.splitHold -= dt;
      if (state.splitHold <= 0) state.splitTarget = 0;
    }
    state.split += (state.splitTarget - state.split) * (1 - Math.exp(-dt * 6));
    const gap = 0.05 + state.split * 0.95 + Math.sin(state.time * 1.2) * 0.02;
    topHalf.position.y = gap;
    bottomHalf.position.y = -gap;
    topHalf.rotation.y = state.split * 0.7;
    bottomHalf.rotation.y = -state.split * 0.7;

    state.boost *= Math.pow(0.25, dt);
    orbiters.forEach(o => {
      o.pivot.rotation.z += o.speed * dt * (1 + state.boost * 4);
    });
    dust.rotation.y += dt * 0.02;

    if (state.hold > 0) {
      state.hold -= dt;
      if (state.hold <= 0) coreTarget.copy(MIMOSA);
    }
    coreMat.color.lerp(coreTarget, 1 - Math.exp(-dt * 5));
    haloMat.color.copy(coreMat.color);
    const beat = 1 + Math.sin(state.time * 2.4) * 0.08 + state.split * 0.25;
    core.scale.setScalar(beat);
    halo.scale.setScalar(beat * (1 + state.split * 0.6));
    haloMat.opacity = 0.18 + state.split * 0.35;

    state.threat += (state.threatTarget - state.threat) * (1 - Math.exp(-dt * 4));
    rimCoral.color.copy(CORAL).lerp(MAGENTA, state.threat);

    renderer.render(scene, camera);
  };

  const resize = (w, h) => {
    renderer.setSize(Math.max(2, Math.round(w)), Math.max(2, Math.round(h)), false);
    const aspect = w / Math.max(1, h);
    camera.aspect = aspect;
    camera.position.z = 11 * Math.max(1, 1.5 / aspect);
    camera.updateProjectionMatrix();
  };

  return {
    canvas,
    update,
    resize,
    hover(nx, ny) { state.hx = clamp(nx, -1, 1); state.hy = clamp(ny, -1, 1); },
    setHover(on) { if (!state.splitHold) state.splitTarget = on ? 0.18 : 0; },
    setDragging(on) { state.dragging = on; if (on) { state.vx = 0; } },
    drag(dx, dy) {
      state.ry += dx * 0.008;
      state.rx = clamp(state.rx + dy * 0.006, -1.1, 1.1);
      state.vy = clamp(dx * 0.4, -6, 6);
      state.vx = clamp(dy * 0.3, -4, 4);
    },
    pulse() { state.splitTarget = 1; state.splitHold = 0.9; state.boost = 1; },
    signal(kind) {
      coreTarget.set(kind === 'ok' ? 0x13b98a : 0xe5334f);
      state.hold = 3.5;
      state.splitTarget = 1; state.splitHold = 0.9; state.boost = 1;
    },
    setThreat(on) { state.threatTarget = on ? 1 : 0; },
    setScroll(p) { state.scroll = clamp(p, 0, 1); },
    dispose() {
      [geoHalf, photonGeo, dustGeo, ...ringGeos, core.geometry, halo.geometry].forEach(g => g.dispose());
      [matBlue, matCoral, coreMat, haloMat, ringMat, dustMat, ...photonMats].forEach(m => m.dispose());
      envTexture.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.getContext().getExtension('WEBGL_lose_context')?.loseContext();
    }
  };
}
