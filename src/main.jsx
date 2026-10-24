import { createRoot } from 'react-dom/client';
import GradientASCII from './components/GradientASCII';
import TechText from './components/TechText';
import DitherVeil3D from './components/DitherVeil3D';
import { ScrollBasedVelocity } from './components/ScrollBasedVelocity';

const ASCII_COLORS = ['#1f3fd0', '#f1ece2', '#9db4ff', '#ff7a5c'];
const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

const mount = (id, node) => {
  const el = document.getElementById(id);
  if (el) createRoot(el).render(node);
};

/* Hero: Three.js capsule veiled by the dither shader, and the TechText wordmark */
mount('veilRoot', <DitherVeil3D pattern="bayer" pixelSize={3} revealRadius={230} rim={0.12} wander />);
mount(
  'titleRoot',
  <TechText
    text="BB84 Rx"
    fontFamily='"Bricolage Grotesque", system-ui, sans-serif'
    fontWeight={700}
    fontSize={420}
    letterSpacing={-0.045}
    color="#ece9e1"
    accentColor="#ff6a4d"
    reveal="letter"
    reach={220}
    dashLength={5}
    dashGap={3}
    strokeWidth={1.5}
    specks={18}
    intro="metrics"
    introDuration={2.4}
    guides
    clickKick
    draggable
    bounce={0.5}
  />
);

/* Velocity bands */
mount(
  'velocityA',
  <ScrollBasedVelocity text="NO-CLONING · EVERY LOOK LEAVES A TRACE · " default_velocity={3} className="sv-big" />
);
mount(
  'velocityB',
  <ScrollBasedVelocity text="2,048 PHOTONS · 11% QBER · AES-256-GCM · " default_velocity={-2} className="sv-mid" />
);

/* GradientASCII backdrops */
mount(
  'asciiA',
  <GradientASCII colors={ASCII_COLORS} shape="pinch" cellSize={16} density={0.75} glow={0.3} fontFamily={MONO} />
);
mount(
  'asciiB',
  <GradientASCII colors={ASCII_COLORS} shape="eclipse" cellSize={16} density={0.7} glow={0.25} fontFamily={MONO} clickEffect="burst" />
);
mount(
  'asciiC',
  <GradientASCII colors={ASCII_COLORS} shape="horizon" cellSize={18} density={0.8} fontFamily={MONO} variation={2} />
);
