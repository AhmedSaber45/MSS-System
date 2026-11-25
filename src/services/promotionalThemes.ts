export type PromotionalThemeId = 'compu_mss' | 'souq' | 'makkah';

export interface PromotionalGradientStop {
  offset: number;
  color: string;
}

export interface PromotionalHeaderColors {
  id: PromotionalThemeId;
  tableHeaderBg: string;
  tableHeaderStroke: string;
  tableHeaderPriceBg: string;
  tableHeaderPriceOverlay: string | null;
  tableHeaderText: string;
  tableHeaderPriceText: string;
  tableHeaderDivider: string;
  headerFallbackAccent: string;
  gradientStops: PromotionalGradientStop[] | null;
  gradientCss: string | null;
}

function buildLinearGradientCss(stops: PromotionalGradientStop[]): string {
  const stopList = stops.map(s => `${s.color} ${Math.round(s.offset * 100)}%`).join(', ');
  return `linear-gradient(90deg, ${stopList})`;
}

const SOUQ_STOPS: PromotionalGradientStop[] = [
  { offset: 0, color: '#0c2146' },
  { offset: 0.62, color: '#163a70' },
  { offset: 1, color: '#c25e10' },
];

const MAKKAH_STOPS: PromotionalGradientStop[] = [
  { offset: 0, color: '#072e29' },
  { offset: 0.62, color: '#0e4d41' },
  { offset: 1, color: '#5a7875' },
];

/**
 * Centralized column-header color & gradient mapping for promotional tables.
 * - Compu MSS preserves its exact original solid header (#071d49 / #05163b).
 * - SOUQ and Makkah apply a conditional gradient to the column-header row only.
 * The rest of the table remains strictly white/original across all rendering paths.
 */
export const PROMOTIONAL_HEADER_COLORS: Record<PromotionalThemeId, PromotionalHeaderColors> = {
  compu_mss: {
    id: 'compu_mss',
    tableHeaderBg: '#071d49',
    tableHeaderStroke: '#0a2a6b',
    tableHeaderPriceBg: '#05163b',
    tableHeaderPriceOverlay: null,
    tableHeaderText: '#ffffff',
    tableHeaderPriceText: '#facc15',
    tableHeaderDivider: 'rgba(255, 255, 255, 0.15)',
    headerFallbackAccent: '#38bdf8',
    gradientStops: null,
    gradientCss: null,
  },
  souq: {
    id: 'souq',
    tableHeaderBg: '#102a54',
    tableHeaderStroke: '#1c3f78',
    tableHeaderPriceBg: '#0c2042',
    tableHeaderPriceOverlay: 'rgba(6, 15, 34, 0.28)',
    tableHeaderText: '#ffffff',
    tableHeaderPriceText: '#fde047',
    tableHeaderDivider: 'rgba(255, 255, 255, 0.22)',
    headerFallbackAccent: '#f59e0b',
    gradientStops: SOUQ_STOPS,
    gradientCss: buildLinearGradientCss(SOUQ_STOPS),
  },
  makkah: {
    id: 'makkah',
    tableHeaderBg: '#0b4236',
    tableHeaderStroke: '#145c4c',
    tableHeaderPriceBg: '#083329',
    tableHeaderPriceOverlay: 'rgba(4, 24, 20, 0.26)',
    tableHeaderText: '#ffffff',
    tableHeaderPriceText: '#e5c76b',
    tableHeaderDivider: 'rgba(255, 255, 255, 0.22)',
    headerFallbackAccent: '#34d399',
    gradientStops: MAKKAH_STOPS,
    gradientCss: buildLinearGradientCss(MAKKAH_STOPS),
  },
};

export function resolvePromotionalHeaderColors(
  themeId?: PromotionalThemeId | string | null,
  headerImageSrc?: string | null
): PromotionalHeaderColors {
  if (themeId === 'souq' || themeId === 'makkah' || themeId === 'compu_mss') {
    return PROMOTIONAL_HEADER_COLORS[themeId];
  }
  const src = (headerImageSrc || '').toLowerCase();
  if (src.includes('promotional-header-souq')) {
    return PROMOTIONAL_HEADER_COLORS.souq;
  }
  if (src.includes('promotional-header-makkah')) {
    return PROMOTIONAL_HEADER_COLORS.makkah;
  }
  return PROMOTIONAL_HEADER_COLORS.compu_mss;
}
