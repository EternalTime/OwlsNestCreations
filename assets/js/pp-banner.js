import { palette } from './pp-palette.js';

for (const banner of document.querySelectorAll('[data-pp-banner]')) {
  banner.style.setProperty('--pp-ink', palette.ink);
}
