// The WebGL half of the VoidFlux banner: glowing flux loops and the game's
// real gem mesh, floating over the perspective grid drawn by voidflux-banner.js.
//
// three.js is vendored (assets/js/lib) rather than CDN-loaded: this is a static
// GitHub Pages site with no build step, and a pinned local copy means no
// third-party runtime dependency, no CDN outage, and no cross-origin request.

import * as THREE from './lib/three.module.min.js';

const MAX_DPR = 1.75;

function makeRenderer(canvas) {
  try {
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
    return renderer;
  } catch {
    return null;
  }
}

export function mount(banner) {
  const canvas = banner.querySelector('.vf-scene');
  if (!canvas) return;

  const renderer = makeRenderer(canvas);
  if (!renderer) return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);

  const resize = () => {
    const w = banner.clientWidth;
    const h = banner.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  new ResizeObserver(resize).observe(banner);

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Only run the loop while the banner is on screen, so scrolling past it
  // costs nothing.
  let visible = true;
  new IntersectionObserver(
    ([entry]) => { visible = entry.isIntersecting; },
    { rootMargin: '100px' }
  ).observe(banner);

  const clock = new THREE.Clock();
  let elapsed = 0;

  const frame = () => {
    requestAnimationFrame(frame);
    const dt = clock.getDelta();
    if (!visible) return;
    if (!reduceMotion.matches) elapsed += dt;
    renderer.render(scene, camera);
  };

  banner.setAttribute('data-vf-ready', '');
  frame();
}
