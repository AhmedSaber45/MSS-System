export type PromotionalThemeId = 'compu_mss' | 'souq' | 'makkah';

export interface PromotionalTableTheme {
  id: PromotionalThemeId;
  isDark: boolean;
  posterBg: string;
  posterBorder: string;
  headerBackdropBg: string;
  headerBottomBorder: string;
  tableOuterBorder: string;
  tableHeaderBg: string;
  tableHeaderStroke: string;
  tableHeaderText: string;
  tableHeaderDivider: string;
  tableHeaderPriceBg: string;
  tableHeaderPriceText: string;
  rowEvenBg: string;
  rowOddBg: string;
  rowBorderBottom: string;
  cellDivider: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  gpuNvidia: string;
  gpuAmd: string;
  gpuIntel: string;
  gpuDefault: string;
  priceText: string;
  footerBg: string;
  footerBorderTop: string;
  pageBadgeBg: string;
  pageBadgeText: string;
  footerBranchText: string;
  headerFallbackAccent: string;
  brandBadgePillBg: string | null;
}

/**
 * Centralized theme configuration for promotional image tables.
 * Ensures HTML preview, Canvas rendering, and exported PNG/JPG/PDF outputs
 * resolve to the exact same color tokens for each header selection.
 */
export const PROMOTIONAL_THEMES: Record<PromotionalThemeId, PromotionalTableTheme> = {
  compu_mss: {
    id: 'compu_mss',
    isDark: false,
    posterBg: '#ffffff',
    posterBorder: '#cbd5e1',
    headerBackdropBg: '#040e24',
    headerBottomBorder: 'rgba(56, 189, 248, 0.2)',
    tableOuterBorder: '#94a3b8',
    tableHeaderBg: '#071d49',
    tableHeaderStroke: '#0a2a6b',
    tableHeaderText: '#ffffff',
    tableHeaderDivider: 'rgba(255, 255, 255, 0.15)',
    tableHeaderPriceBg: '#05163b',
    tableHeaderPriceText: '#facc15',
    rowEvenBg: '#ffffff',
    rowOddBg: '#f8faff',
    rowBorderBottom: '#cbd5e1',
    cellDivider: '#e2e8f0',
    textPrimary: '#0f172a',
    textSecondary: '#1e293b',
    textMuted: '#334155',
    gpuNvidia: '#16a34a',
    gpuAmd: '#dc2626',
    gpuIntel: '#2563eb',
    gpuDefault: '#475569',
    priceText: '#0a2558',
    footerBg: '#f8fafc',
    footerBorderTop: '#e2e8f0',
    pageBadgeBg: '#0c3582',
    pageBadgeText: '#facc15',
    footerBranchText: '#64748b',
    headerFallbackAccent: '#38bdf8',
    brandBadgePillBg: null,
  },
  souq: {
    id: 'souq',
    isDark: true,
    posterBg: '#0b1426',
    posterBorder: '#1e3a6d',
    headerBackdropBg: '#091120',
    headerBottomBorder: 'rgba(245, 158, 11, 0.35)',
    tableOuterBorder: '#2b4c8c',
    tableHeaderBg: '#10244d',
    tableHeaderStroke: '#24478f',
    tableHeaderText: '#f8fafc',
    tableHeaderDivider: 'rgba(147, 197, 253, 0.22)',
    tableHeaderPriceBg: '#173268',
    tableHeaderPriceText: '#fbbf24',
    rowEvenBg: '#0e1a33',
    rowOddBg: '#132344',
    rowBorderBottom: '#203866',
    cellDivider: '#1c325c',
    textPrimary: '#f8fafc',
    textSecondary: '#e2e8f0',
    textMuted: '#cbd5e1',
    gpuNvidia: '#4ade80',
    gpuAmd: '#fb923c',
    gpuIntel: '#60a5fa',
    gpuDefault: '#94a3b8',
    priceText: '#fbbf24',
    footerBg: '#091120',
    footerBorderTop: '#1e3a6d',
    pageBadgeBg: '#173268',
    pageBadgeText: '#fbbf24',
    footerBranchText: '#94a3b8',
    headerFallbackAccent: '#f59e0b',
    brandBadgePillBg: 'rgba(248, 250, 252, 0.94)',
  },
  makkah: {
    id: 'makkah',
    isDark: true,
    posterBg: '#071c1e',
    posterBorder: '#134e4a',
    headerBackdropBg: '#051618',
    headerBottomBorder: 'rgba(52, 211, 153, 0.28)',
    tableOuterBorder: '#1f635c',
    tableHeaderBg: '#0b2e31',
    tableHeaderStroke: '#1a5c56',
    tableHeaderText: '#fafaf9',
    tableHeaderDivider: 'rgba(167, 243, 208, 0.2)',
    tableHeaderPriceBg: '#0f3d3b',
    tableHeaderPriceText: '#e5c76b',
    rowEvenBg: '#092225',
    rowOddBg: '#0d2d30',
    rowBorderBottom: '#164745',
    cellDivider: '#133d3c',
    textPrimary: '#fafaf9',
    textSecondary: '#e7e5e4',
    textMuted: '#cbd5d1',
    gpuNvidia: '#34d399',
    gpuAmd: '#f87171',
    gpuIntel: '#67e8f9',
    gpuDefault: '#9ca3af',
    priceText: '#e5c76b',
    footerBg: '#051618',
    footerBorderTop: '#134e4a',
    pageBadgeBg: '#0f3d3b',
    pageBadgeText: '#e5c76b',
    footerBranchText: '#94a3b8',
    headerFallbackAccent: '#34d399',
    brandBadgePillBg: 'rgba(250, 250, 249, 0.94)',
  },
};

export function resolvePromotionalTheme(
  themeId?: PromotionalThemeId | string | null,
  headerImageSrc?: string | null
): PromotionalTableTheme {
  if (themeId === 'souq' || themeId === 'makkah' || themeId === 'compu_mss') {
    return PROMOTIONAL_THEMES[themeId];
  }
  const src = (headerImageSrc || '').toLowerCase();
  if (src.includes('promotional-header-souq')) {
    return PROMOTIONAL_THEMES.souq;
  }
  if (src.includes('promotional-header-makkah')) {
    return PROMOTIONAL_THEMES.makkah;
  }
  return PROMOTIONAL_THEMES.compu_mss;
}
