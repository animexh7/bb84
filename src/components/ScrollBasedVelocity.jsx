import React, { useRef } from 'react';
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  useMotionValue,
  useVelocity,
  useAnimationFrame,
  wrap
} from 'framer-motion';

/* Componentry "scroll based velocity", ported from TSX + Tailwind to plain JSX + CSS (see .sv-* in styles.css). */
function ParallaxText({ children, baseVelocity = 100, className = '', containerRef }) {
  const baseX = useMotionValue(0);
  const { scrollY } = useScroll(containerRef ? { container: containerRef } : undefined);
  const scrollVelocity = useVelocity(scrollY);
  const smoothVelocity = useSpring(scrollVelocity, { damping: 50, stiffness: 400 });
  const velocityFactor = useTransform(smoothVelocity, [0, 1000], [0, 5], { clamp: false });

  /* 8 copies, so one copy is 12.5% of the track: wrap between -12.5% and 0 */
  const x = useTransform(baseX, v => `${wrap(-12.5, 0, v)}%`);

  const directionFactor = useRef(1);
  useAnimationFrame((t, delta) => {
    let moveBy = directionFactor.current * baseVelocity * (delta / 1000);
    if (velocityFactor.get() < 0) directionFactor.current = -1;
    else if (velocityFactor.get() > 0) directionFactor.current = 1;
    moveBy += directionFactor.current * moveBy * velocityFactor.get();
    baseX.set(baseX.get() + moveBy);
  });

  return (
    <div className="sv-row">
      <motion.div className={`sv-track ${className}`.trim()} style={{ x }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <span key={i} className="sv-item">
            {children}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

export function ScrollBasedVelocity({ text, default_velocity = 5, className = '', containerRef }) {
  return (
    <section className="sv-root">
      <ParallaxText baseVelocity={default_velocity} className={className} containerRef={containerRef}>
        {text}
      </ParallaxText>
      <ParallaxText baseVelocity={-default_velocity} className={`${className} sv-alt`.trim()} containerRef={containerRef}>
        {text}
      </ParallaxText>
    </section>
  );
}

export default ScrollBasedVelocity;
