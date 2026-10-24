'use client';

/* DitherVeil (React Bits) adapted to veil a LIVE Three.js render instead of a static image.
   The Three.js scene draws into an offscreen canvas; every frame that canvas is uploaded as the
   source texture. Ordered patterns (bayer / lines) run fully on the GPU, so they stay cheap while
   the scene moves. Error-diffusion and blue-noise patterns need per-frame CPU work and were dropped. */

import { useEffect, useRef } from 'react';
import { Renderer, Program, Mesh, Triangle, Texture, RenderTarget } from 'ogl';
import { createCapsuleScene } from './capsuleScene';

import './DitherVeil.css';

const ORDERED = { bayer: 0, lines: 2 };
const MASK_SCALE = 0.5;
const MAX_BURSTS = 4;
const BURST_SECONDS = 1.2;
const HOLD = 1.6;
const INTRO_MS = 1100;
const SCENE_SCALE = 0.75;

const hexToRgb = hex => {
  let h = String(hex || '').replace('#', '');
  if (h.length === 3) h = h.replace(/./g, c => c + c);
  const n = parseInt(h.slice(0, 6), 16);
  return Number.isNaN(n) ? [0, 0, 0] : [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

const wanderAt = (t, w, h) => [
  w * (0.5 + 0.33 * Math.sin(t * 0.53) + 0.08 * Math.sin(t * 1.31 + 0.6)),
  h * (0.5 + 0.28 * Math.sin(t * 0.71 + 1.1) + 0.07 * Math.cos(t * 1.57))
];

const vertex = `#version 300 es
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const maskFragment = `#version 300 es
precision highp float;

uniform sampler2D tPrev;
uniform vec2 uSize;
uniform vec2 uFrom;
uniform vec2 uTo;
uniform float uRadius;
uniform float uSoftness;
uniform float uStrength;
uniform float uFade;
uniform float uHold;

in vec2 vUv;
out vec4 fragColor;

float strokeDistance(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float h = clamp(dot(p - a, ab) / max(dot(ab, ab), 0.0001), 0.0, 1.0);
  return length(p - a - ab * h);
}

void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uSize;
  float trail = max(texture(tPrev, vUv).r - uFade, 0.0);
  float band = max(uRadius * uSoftness, 1.0) * uHold;
  float d = strokeDistance(p, uFrom, uTo);
  trail = max(trail, clamp((uRadius - d) / band, 0.0, 1.0) * uStrength);
  fragColor = vec4(trail, 0.0, 0.0, 1.0);
}
`;

const viewFragment = `#version 300 es
precision highp float;
precision highp int;

uniform sampler2D tImage;
uniform sampler2D tMask;
uniform vec2 uResolution;
uniform float uLod;
uniform float uCell;
uniform int uPattern;
uniform int uPalette;
uniform float uLevels;
uniform vec3 uInk;
uniform vec3 uPaper;
uniform vec3 uRimColor;
uniform float uRim;
uniform float uContrast;
uniform float uBrightness;
uniform float uReverse;
uniform float uIntro;
uniform float uHold;
uniform vec2 uSize;
uniform vec4 uBursts[4];
uniform float uBurstWidth;

in vec2 vUv;
out vec4 fragColor;

float bayer(vec2 cell) {
  ivec2 p = ivec2(mod(cell, 8.0));
  int v = p.x ^ p.y;
  int m = ((v & 1) << 5) | ((p.y & 1) << 4) | ((v & 2) << 2) | ((p.y & 2) << 1) | ((v & 4) >> 1) | ((p.y & 4) >> 2);
  return (float(m) + 0.5) / 64.0;
}

float engraving(vec2 cell) {
  float period = 6.0;
  float f = (mod(cell.x + cell.y, period) + 0.5) / period;
  return clamp(abs(f * 2.0 - 1.0) + (bayer(cell) - 0.5) * (2.0 / period), 0.0, 1.0);
}

vec3 grade(vec3 c) {
  return pow(clamp((c - 0.5) * uContrast + 0.5 + uBrightness, 0.0, 1.0), vec3(1.6));
}

float shockwave(vec2 p) {
  float value = 0.0;
  for (int i = 0; i < 4; i++) {
    vec4 burst = uBursts[i];
    if (burst.w <= 0.0) continue;
    float offset = distance(p, burst.xy) - burst.z;
    float edge = offset > 0.0 ? offset / (uBurstWidth * 0.35) : -offset / uBurstWidth;
    value = max(value, clamp(1.0 - edge, 0.0, 1.0) * burst.w);
  }
  return value;
}

vec3 toned(vec3 c) {
  return uPalette == 1 ? grade(c) : grade(vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))));
}

vec3 quantize(vec3 v, float t) {
  float steps = max(uLevels - 1.0, 1.0);
  vec3 s = v * steps;
  vec3 base = floor(s);
  return min(base + step(vec3(t), s - base), vec3(steps)) / steps;
}

void main() {
  vec2 px = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
  vec2 cell = floor(px / uCell);
  vec2 center = (cell + 0.5) * uCell;
  vec2 cellUv = vec2(center.x / uResolution.x, 1.0 - center.y / uResolution.y);

  vec3 c = textureLod(tImage, cellUv, uLod).rgb;
  float t = uPattern == 2 ? engraving(cell) : bayer(cell);
  vec3 level = quantize(toned(c), t);
  vec3 color = mix(uInk, uPaper, level);
  vec3 photo = texture(tImage, vUv).rgb;

  vec2 point = vec2(cellUv.x, 1.0 - cellUv.y) * uSize;
  float mask = max(clamp(texture(tMask, cellUv).r * uHold, 0.0, 1.0), shockwave(point));
  float shown = mix(mask, 1.0 - mask, uReverse);
  float order = bayer(cell.yx);
  float low = order * (1.0 - uRim);
  color = mix(color, uRimColor, step(low, shown) * step(0.001, uRim));
  color = mix(color, photo, step(low + uRim, shown));

  vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
  float spread = length((cellUv - 0.5) * aspect) / length(aspect * 0.5);
  float appear = step(spread * 0.72 + bayer(cell + vec2(3.0, 5.0)) * 0.28, uIntro * 1.001);
  fragColor = vec4(mix(uInk, color, appear), 1.0);
}
`;

const DitherVeil3D = ({
  pattern = 'bayer',
  pixelSize = 3,
  levels = 2,
  palette = 'duotone',
  inkColor = '#07090d',
  paperColor = '#ece9e1',
  contrast = 1.3,
  brightness = 0.03,
  revealRadius = 230,
  softness = 0.7,
  linger = 1.2,
  rimColor = '#ff6a4d',
  rim = 0.12,
  reverse = false,
  wander = true,
  clickBurst = true,
  className = '',
  style
}) => {
  const containerRef = useRef(null);
  const settingsRef = useRef(null);
  const wakeRef = useRef(() => {});

  useEffect(() => {
    settingsRef.current = {
      pattern, pixelSize, levels, palette, inkColor, paperColor, contrast, brightness,
      revealRadius, softness, linger, rimColor, rim, reverse, wander, clickBurst
    };
    wakeRef.current();
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const scene3d = createCapsuleScene();
    const renderer = new Renderer({ dpr: Math.min(window.devicePixelRatio || 1, 2), alpha: false, antialias: false });
    const gl = renderer.gl;
    const canvas = gl.canvas;
    canvas.style.display = 'block';
    container.appendChild(canvas);

    const floatMask = renderer.isWebgl2 && !!renderer.getExtension('EXT_color_buffer_float');
    const geometry = new Triangle(gl);
    const imageTexture = new Texture(gl, { minFilter: gl.LINEAR_MIPMAP_LINEAR, magFilter: gl.LINEAR });

    const createMask = (w, h) =>
      new RenderTarget(gl, {
        width: w,
        height: h,
        depth: false,
        type: floatMask ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE,
        internalFormat: floatMask ? gl.RGBA16F : gl.RGBA,
        minFilter: gl.LINEAR,
        magFilter: gl.LINEAR
      });
    const destroyMask = target => {
      gl.deleteFramebuffer(target.buffer);
      gl.deleteTexture(target.texture.texture);
    };
    let masks = [createMask(2, 2), createMask(2, 2)];

    const maskUniforms = {
      tPrev: { value: masks[0].texture },
      uSize: { value: [1, 1] },
      uFrom: { value: [0, 0] },
      uTo: { value: [0, 0] },
      uRadius: { value: 1 },
      uSoftness: { value: 0.5 },
      uStrength: { value: 0 },
      uFade: { value: 1 },
      uHold: { value: HOLD }
    };
    const viewUniforms = {
      tImage: { value: imageTexture },
      tMask: { value: masks[0].texture },
      uResolution: { value: [1, 1] },
      uLod: { value: 0 },
      uCell: { value: 3 },
      uPattern: { value: 0 },
      uPalette: { value: 0 },
      uLevels: { value: 2 },
      uInk: { value: [0, 0, 0] },
      uPaper: { value: [1, 1, 1] },
      uRimColor: { value: [1, 1, 1] },
      uRim: { value: 0 },
      uContrast: { value: 1 },
      uBrightness: { value: 0 },
      uReverse: { value: 0 },
      uIntro: { value: 0 },
      uHold: { value: HOLD },
      uSize: { value: [1, 1] },
      uBursts: { value: Array.from({ length: MAX_BURSTS * 4 }, () => 0) },
      uBurstWidth: { value: 60 }
    };
    const program = (fragment, uniforms) =>
      new Program(gl, { vertex, fragment, uniforms, depthTest: false, depthWrite: false });
    const maskMesh = new Mesh(gl, { geometry, program: program(maskFragment, maskUniforms) });
    const viewMesh = new Mesh(gl, { geometry, program: program(viewFragment, viewUniforms) });

    let width = 1;
    let height = 1;
    let sceneW = 2;
    let visible = true;
    let raf = 0;
    let last = performance.now();
    const introStart = performance.now();
    let trailUntil = 0;
    let presence = 0;
    let drift = 0;
    let dragging = false;
    let dragX = 0;
    let dragY = 0;
    const pointer = { x: 0, y: 0, inside: false, fresh: true, placed: false };
    const brush = { x: 0, y: 0, px: 0, py: 0 };
    const bursts = [];

    const layout = () => {
      width = Math.max(1, container.clientWidth);
      height = Math.max(1, container.clientHeight);
      renderer.setSize(width, height);
      viewUniforms.uResolution.value = [canvas.width, canvas.height];
      maskUniforms.uSize.value = [width, height];
      viewUniforms.uSize.value = [width, height];
      sceneW = Math.round(width * SCENE_SCALE);
      scene3d.resize(sceneW, Math.round(height * SCENE_SCALE));
      const mw = Math.max(2, Math.round(width * MASK_SCALE));
      const mh = Math.max(2, Math.round(height * MASK_SCALE));
      if (mw !== masks[0].width || mh !== masks[0].height) {
        masks.forEach(destroyMask);
        masks = [createMask(mw, mh), createMask(mw, mh)];
      }
      if (!pointer.placed) {
        pointer.x = width / 2;
        pointer.y = height / 2;
      }
    };

    const frame = now => {
      raf = 0;
      const s = settingsRef.current;
      if (!s) return;
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;

      const wanderOn = s.wander && !reducedMotion;
      let targetX = pointer.x;
      let targetY = pointer.y;
      if (!pointer.inside && wanderOn) {
        drift = Math.min(1, drift + dt / 1.2);
        const [wx, wy] = wanderAt(now / 1000, width, height);
        const k = drift * drift * (3 - 2 * drift);
        targetX += (wx - targetX) * k;
        targetY += (wy - targetY) * k;
      } else {
        drift = 0;
      }
      presence += ((pointer.inside || wanderOn ? 1 : 0) - presence) * (1 - Math.exp(-dt / 0.16));

      if (pointer.fresh) {
        brush.x = brush.px = targetX;
        brush.y = brush.py = targetY;
        pointer.fresh = false;
      } else {
        const follow = 1 - Math.exp(-dt / 0.035);
        brush.x += (targetX - brush.x) * follow;
        brush.y += (targetY - brush.y) * follow;
      }

      const burstData = viewUniforms.uBursts.value;
      burstData.fill(0);
      for (let i = bursts.length - 1; i >= 0; i--) {
        if ((now - bursts[i].start) / 1000 >= BURST_SECONDS) bursts.splice(i, 1);
      }
      bursts.forEach((b, i) => {
        const k = Math.max(0, (now - b.start) / 1000 / BURST_SECONDS);
        const reach = Math.hypot(Math.max(b.x, width - b.x), Math.max(b.y, height - b.y)) + viewUniforms.uBurstWidth.value;
        burstData[i * 4] = b.x;
        burstData[i * 4 + 1] = b.y;
        burstData[i * 4 + 2] = reach * Math.sin((k * Math.PI) / 2);
        burstData[i * 4 + 3] = 1 - k * k * k;
      });

      if (presence > 0.002) trailUntil = now + s.linger * 1000 + 150;

      const minFade = floatMask ? 0 : 1.5 / 255;
      const fade = s.linger > 0 ? dt / s.linger : 1;
      maskUniforms.tPrev.value = masks[0].texture;
      maskUniforms.uFrom.value = [brush.px, brush.py];
      maskUniforms.uTo.value = [brush.x, brush.y];
      maskUniforms.uRadius.value = s.revealRadius * (0.45 + 0.55 * presence);
      maskUniforms.uSoftness.value = s.softness;
      maskUniforms.uStrength.value = presence;
      maskUniforms.uFade.value = Math.max(fade, minFade);
      viewUniforms.uBurstWidth.value = Math.max(60, s.revealRadius * 0.9);
      renderer.render({ scene: maskMesh, target: masks[1] });
      masks.reverse();
      brush.px = brush.x;
      brush.py = brush.y;

      /* Live source: step the 3D scene, then upload its canvas */
      if (!pointer.inside && wanderOn) scene3d.hover(0, 0);
      scene3d.update(reducedMotion ? 0 : dt);
      imageTexture.image = scene3d.canvas;
      imageTexture.needsUpdate = true;

      const cell = Math.max(1, Math.round(s.pixelSize * renderer.dpr));
      const texelsPerCell = cell * (sceneW / canvas.width);
      viewUniforms.tMask.value = masks[0].texture;
      viewUniforms.uCell.value = cell;
      viewUniforms.uLod.value = Math.log2(Math.max(texelsPerCell, 1));
      viewUniforms.uPattern.value = ORDERED[s.pattern] ?? 0;
      viewUniforms.uPalette.value = s.palette === 'rgb' ? 1 : 0;
      viewUniforms.uLevels.value = Math.max(2, Math.round(s.levels));
      viewUniforms.uInk.value = hexToRgb(s.inkColor);
      viewUniforms.uPaper.value = hexToRgb(s.paperColor);
      viewUniforms.uRimColor.value = hexToRgb(s.rimColor);
      viewUniforms.uRim.value = Math.min(Math.max(s.rim, 0), 0.95);
      viewUniforms.uContrast.value = s.contrast;
      viewUniforms.uBrightness.value = s.brightness;
      viewUniforms.uReverse.value = s.reverse ? 1 : 0;
      const intro = Math.min(1, (now - introStart) / INTRO_MS);
      viewUniforms.uIntro.value = 1 - Math.pow(1 - intro, 2);
      renderer.render({ scene: viewMesh });

      const busy = !reducedMotion || pointer.inside || presence > 0.002 || bursts.length > 0 || now < trailUntil || intro < 1;
      if (busy && visible) raf = requestAnimationFrame(frame);
    };

    const wake = () => {
      if (raf || !visible) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    wakeRef.current = wake;

    const locate = e => {
      const rect = container.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.placed = true;
      scene3d.hover((pointer.x / Math.max(1, rect.width) - 0.5) * 2, (pointer.y / Math.max(1, rect.height) - 0.5) * 2);
    };
    const onMove = e => {
      locate(e);
      if (!pointer.inside) {
        pointer.inside = true;
        pointer.fresh = true;
        scene3d.setHover(true);
      }
      if (dragging) {
        scene3d.drag(e.clientX - dragX, e.clientY - dragY);
        dragX = e.clientX;
        dragY = e.clientY;
      }
      wake();
    };
    const onLeave = () => {
      if (dragging) return;
      pointer.inside = false;
      scene3d.setHover(false);
      wake();
    };
    const onDown = e => {
      onMove(e);
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true;
      dragX = e.clientX;
      dragY = e.clientY;
      scene3d.setDragging(true);
      container.setPointerCapture?.(e.pointerId);
      scene3d.pulse();
      if (!settingsRef.current?.clickBurst) return;
      bursts.push({ x: pointer.x, y: pointer.y, start: performance.now() });
      if (bursts.length > MAX_BURSTS) bursts.shift();
    };
    const onUp = e => {
      if (!dragging) return;
      dragging = false;
      scene3d.setDragging(false);
      container.releasePointerCapture?.(e.pointerId);
      const rect = container.getBoundingClientRect();
      pointer.inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (!pointer.inside) scene3d.setHover(false);
      wake();
    };
    container.addEventListener('pointermove', onMove, { passive: true });
    container.addEventListener('pointerenter', onMove, { passive: true });
    container.addEventListener('pointerdown', onDown, { passive: true });
    container.addEventListener('pointerup', onUp, { passive: true });
    container.addEventListener('pointercancel', onUp, { passive: true });
    container.addEventListener('pointerleave', onLeave, { passive: true });

    /* Coherence with the simulation: key result tints the core, interception tints the rim light */
    const onKey = () => {
      const v = window.bb84KeyVerified;
      if (v === true) scene3d.signal('ok');
      else if (v === false) scene3d.signal('bad');
      else scene3d.pulse();
      wake();
    };
    window.addEventListener('bb84-key-updated', onKey);
    const toggle = document.getElementById('interceptToggle');
    const onToggle = () => scene3d.setThreat(!!toggle.checked);
    toggle?.addEventListener('change', onToggle);
    const onScroll = () => {
      scene3d.setScroll(window.scrollY / Math.max(1, container.offsetHeight));
      wake();
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    const resizeObserver = new ResizeObserver(() => {
      layout();
      wake();
    });
    resizeObserver.observe(container);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      wake();
    });
    intersectionObserver.observe(container);

    layout();
    wake();

    return () => {
      cancelAnimationFrame(raf);
      wakeRef.current = () => {};
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      window.removeEventListener('bb84-key-updated', onKey);
      window.removeEventListener('scroll', onScroll);
      toggle?.removeEventListener('change', onToggle);
      container.removeEventListener('pointermove', onMove);
      container.removeEventListener('pointerenter', onMove);
      container.removeEventListener('pointerdown', onDown);
      container.removeEventListener('pointerup', onUp);
      container.removeEventListener('pointercancel', onUp);
      container.removeEventListener('pointerleave', onLeave);
      scene3d.dispose();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    };
  }, []);

  return <div ref={containerRef} className={`dither-veil ${className}`.trim()} style={style} />;
};

export default DitherVeil3D;
