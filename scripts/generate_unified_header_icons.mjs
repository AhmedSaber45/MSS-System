import fs from 'node:fs';
import path from 'node:path';

function createSvgDataUri(innerPaths) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${innerPaths}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const UNIFIED_HEADER_ICONS_SVG = {
  brand: createSvgDataUri(
    `<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>`
  ),
  price: createSvgDataUri(
    `<path d="M9 3H4a1 1 0 0 0-1 1v5l8.59 8.59a2 2 0 0 0 2.82 0l4.18-4.18a2 2 0 0 0 0-2.82L11 3z"/><circle cx="6.5" cy="6.5" r="1.5"/><path d="M16 8l4.59 4.59a2 2 0 0 1 0 2.82l-4.18 4.18a2 2 0 0 1-2.82 0L12 18"/>`
  ),
  model: createSvgDataUri(
    `<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M2 20h20"/><path d="M9 16v1h6v-1"/>`
  ),
  processor: createSvgDataUri(
    `<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="8.5" y="8.5" width="7" height="7" rx="1"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 15h3M1 9h3M1 15h3"/>`
  ),
  generation: createSvgDataUri(
    `<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>`
  ),
  ram: createSvgDataUri(
    `<rect x="2" y="7" width="20" height="10" rx="1.5"/><rect x="5" y="10" width="3" height="4" rx="0.5"/><rect x="10.5" y="10" width="3" height="4" rx="0.5"/><rect x="16" y="10" width="3" height="4" rx="0.5"/><path d="M6 17v1.5M9 17v1.5M15 17v1.5M18 17v1.5"/><path d="M11 17a1 1 0 0 1 2 0"/>`
  ),
  storage: createSvgDataUri(
    `<rect x="2" y="3" width="20" height="7" rx="2"/><rect x="2" y="14" width="20" height="7" rx="2"/><line x1="6" y1="6.5" x2="6.01" y2="6.5"/><line x1="6" y1="17.5" x2="6.01" y2="17.5"/><line x1="10" y1="6.5" x2="14" y2="6.5"/><line x1="10" y1="17.5" x2="14" y2="17.5"/>`
  ),
  screen: createSvgDataUri(
    `<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>`
  ),
  gpu: createSvgDataUri(
    `<path d="M2 5v14h18a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H2z"/><path d="M2 3v18"/><circle cx="12" cy="12" r="3.5"/><path d="M12 8.5v7M8.5 12h7"/><path d="M6 19v2M9 19v2M15 19v2"/>`
  ),
  quantity: createSvgDataUri(
    `<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/>`
  ),
};

console.log('Unified header icons generated successfully!');
for (const [k, v] of Object.entries(UNIFIED_HEADER_ICONS_SVG)) {
  console.log(`- ${k}: ${v.length} chars`);
}
