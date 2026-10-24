# BB84 Rx v2: quantum key distribution for pharmaceutical data

Same simulator, new front end. The BB84 and AES code is unchanged; only the interface layer was rebuilt.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
```

## What changed

| Piece | Where |
|---|---|
| 3D hero: split capsule, key core, orbiting photons (Three.js) | `src/components/capsuleScene.js` |
| DitherVeil shader veiling the live 3D render | `src/components/DitherVeil3D.jsx` |
| Wordmark via TechText | `src/main.jsx` (props) + `src/components/TechText.jsx` |
| GradientASCII backdrops (manifesto, vault, footer) | `src/main.jsx` + `src/components/GradientASCII.jsx` |
| Scroll-velocity bands | `src/components/ScrollBasedVelocity.jsx` |
| Design system | `src/styles.css` |
| Simulation (untouched) | `public/lab.js plant.js interceptor.js script.js aes.js pharma.js` |
| Interface glue (vault state, headings, bay light) | `public/ui.js` |

The simulation scripts are classic scripts in `public/`, so every DOM id they use still exists in `index.html`.
React components mount into placeholder divs (`#veilRoot`, `#titleRoot`, `#velocityA/B`, `#asciiA/B/C`).

## Hero interaction

Drag to rotate the capsule, hover to reveal full colour through the dither, click to split the capsule and
send a colour shockwave. The scene also reacts to the simulation: toggling the counterfeiter tints the rim light
magenta, and a finished run turns the key core green (accepted) or red (rejected).

## Notes on the DitherVeil adaptation

The React Bits DitherVeil loads a static image. Here the source is a live canvas, so only the GPU-ordered patterns
(`bayer`, `lines`) are kept. The Floyd-Steinberg, Atkinson and blue-noise modes need per-frame CPU work
and were removed. Set `pattern="lines"` on `<DitherVeil3D />` for engraving hatching.

Educational simulation only; it does not establish real-world security.
