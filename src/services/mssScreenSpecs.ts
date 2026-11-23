/**
 * Helper utilities for building, parsing, and validating MSS Screen / Monitor specifications
 */

export interface ParsedScreenSpecs {
  size: string;
  resolution: string;
  panel: string;
  refreshRate: string;
  responseTime: string;
  aspectRatio: string;
  ports: string;
  curvature: string;
  touch: string;
  brightness: string;
  notes: string;
}

/**
 * Builds the canonical screen_size summary string for monitors
 * Example: '24" FHD (1920×1080) IPS 75Hz Flat'
 */
export function buildScreenSummary(
  size?: string | null,
  resolution?: string | null,
  panel?: string | null,
  refreshRate?: string | null,
  curvature?: string | null
): string {
  const parts: string[] = [];
  const s = size ? size.trim() : '';
  if (s) {
    parts.push(s.endsWith('"') || s.endsWith("'") || s.includes('بوصة') ? s : `${s}"`);
  }
  if (resolution && resolution.trim()) parts.push(resolution.trim());
  if (panel && panel.trim()) parts.push(panel.trim());
  if (refreshRate && refreshRate.trim()) {
    const rr = refreshRate.trim();
    parts.push(rr.toLowerCase().endsWith('hz') ? rr : `${rr}Hz`);
  }
  if (curvature && curvature.trim()) {
    if (curvature.includes('منحنية') || curvature.toLowerCase().includes('curved')) {
      parts.push('Curved');
    } else if (curvature.includes('مسطحة') || curvature.toLowerCase().includes('flat')) {
      parts.push('Flat');
    }
  }
  return parts.join(' ').trim();
}

/**
 * Builds the specifications field for monitors with structured labels
 * Example: 'زمن الاستجابة: 1ms • الأبعاد: 16:9 • المنافذ: HDMI, DisplayPort • السطوع: 250 nits • ملاحظات: ...'
 */
export function buildScreenSpecifications(details: {
  responseTime?: string | null;
  aspectRatio?: string | null;
  ports?: string | null;
  brightness?: string | null;
  touch?: string | null;
  notes?: string | null;
}): string {
  const parts: string[] = [];
  if (details.responseTime && details.responseTime.trim()) {
    const rt = details.responseTime.trim();
    parts.push(`زمن الاستجابة: ${rt.toLowerCase().endsWith('ms') ? rt : `${rt}ms`}`);
  }
  if (details.aspectRatio && details.aspectRatio.trim()) {
    parts.push(`الأبعاد: ${details.aspectRatio.trim()}`);
  }
  if (details.ports && details.ports.trim()) {
    parts.push(`المنافذ: ${details.ports.trim()}`);
  }
  if (details.brightness && details.brightness.trim()) {
    const b = details.brightness.trim();
    parts.push(`السطوع: ${b.toLowerCase().includes('nit') || b.includes('شمعة') ? b : `${b} nits`}`);
  }
  if (details.touch && details.touch.trim()) {
    const t = details.touch.trim();
    if (t === 'نعم' || t.toLowerCase() === 'yes' || t.toLowerCase().includes('touch')) {
      parts.push('شاشة لمس: نعم');
    }
  }
  if (details.notes && details.notes.trim()) {
    parts.push(`ملاحظات: ${details.notes.trim()}`);
  }
  return parts.join(' • ').trim();
}

/**
 * Parses existing screen_size and specifications strings into individual screen fields
 */
export function parseScreenSpecs(screenSizeRaw?: string | null, specsRaw?: string | null): ParsedScreenSpecs {
  const ss = screenSizeRaw ? screenSizeRaw.trim() : '';
  const sp = specsRaw ? specsRaw.trim() : '';
  const combined = `${ss} ${sp}`.trim();

  // 1. Size
  let size = '';
  const sizeMatch = combined.match(/(\d{1,2}(?:\.\d)?)\s*(?:["”']|inch|بوصة)/i);
  if (sizeMatch) {
    size = `${sizeMatch[1]}"`;
  } else if (ss) {
    const firstWord = ss.split(/\s+/)[0];
    if (/^\d{1,2}(?:\.\d)?$/.test(firstWord)) {
      size = `${firstWord}"`;
    }
  }

  // 2. Resolution
  let resolution = '';
  if (/4K|3840\s*[x×]\s*2160/i.test(combined)) {
    resolution = '4K UHD (3840×2160)';
  } else if (/UWQHD|3440\s*[x×]\s*1440/i.test(combined)) {
    resolution = 'UWQHD (3440×1440)';
  } else if (/2K|QHD|WQXGA|2560\s*[x×]\s*1440|2560\s*[x×]\s*1600/i.test(combined)) {
    resolution = '2K QHD (2560×1440)';
  } else if (/FHD|1080p|1920\s*[x×]\s*1080|1920\s*[x×]\s*1200/i.test(combined)) {
    resolution = 'FHD (1920×1080)';
  } else if (/HD\+|1600\s*[x×]\s*900/i.test(combined)) {
    resolution = 'HD+ (1600×900)';
  } else if (/HD|1366\s*[x×]\s*768/i.test(combined)) {
    resolution = 'HD (1366×768)';
  } else if (/Retina|5K|5120\s*[x×]\s*2880/i.test(combined)) {
    resolution = 'Retina 5K (5120×2880)';
  }

  // 3. Panel
  let panel = '';
  if (/Nano IPS/i.test(combined)) panel = 'Nano IPS';
  else if (/Mini-LED/i.test(combined)) panel = 'Mini-LED';
  else if (/OLED/i.test(combined)) panel = 'OLED';
  else if (/IPS/i.test(combined)) panel = 'IPS';
  else if (/VA/i.test(combined)) panel = 'VA';
  else if (/TN/i.test(combined)) panel = 'TN';

  // 4. Refresh Rate
  let refreshRate = '';
  const rrMatch = combined.match(/(\d{2,3})\s*Hz/i);
  if (rrMatch) {
    refreshRate = `${rrMatch[1]}Hz`;
  }

  // 5. Response Time
  let responseTime = '';
  const rtLabelMatch = sp.match(/زمن الاستجابة:\s*([^\s•]+)/);
  if (rtLabelMatch) {
    responseTime = rtLabelMatch[1].trim();
  } else {
    const rtMatch = combined.match(/(\d+(?:\.\d+)?)\s*ms/i);
    if (rtMatch) responseTime = `${rtMatch[1]}ms`;
  }

  // 6. Aspect Ratio
  let aspectRatio = '';
  const arLabelMatch = sp.match(/الأبعاد:\s*([^\s•]+)/);
  if (arLabelMatch) {
    aspectRatio = arLabelMatch[1].trim();
  } else {
    const arMatch = combined.match(/(16:9|16:10|21:9|32:9|4:3)/);
    if (arMatch) aspectRatio = arMatch[1];
  }

  // 7. Curvature
  let curvature = 'مسطحة (Flat)';
  if (/منحنية|curved/i.test(combined)) {
    curvature = 'منحنية (Curved)';
  }

  // 8. Touch
  let touch = 'لا';
  if (/شاشة لمس:\s*نعم/i.test(sp) || (/touch|لمس/i.test(combined) && !/non-touch|لا/i.test(combined))) {
    touch = 'نعم';
  }

  // 9. Brightness
  let brightness = '';
  const brLabelMatch = sp.match(/السطوع:\s*([^•]+)/);
  if (brLabelMatch) {
    brightness = brLabelMatch[1].trim();
  } else {
    const brMatch = combined.match(/(\d{2,4})\s*(?:nits?|cd\/m²)/i);
    if (brMatch) brightness = `${brMatch[1]} nits`;
  }

  // 10. Ports
  let ports = '';
  const portsLabelMatch = sp.match(/المنافذ:\s*([^•]+)/);
  if (portsLabelMatch) {
    ports = portsLabelMatch[1].trim();
  }

  // 11. Notes
  let notes = '';
  const notesLabelMatch = sp.match(/ملاحظات:\s*(.*)$/);
  if (notesLabelMatch) {
    notes = notesLabelMatch[1].trim();
  } else if (sp && !sp.includes('•') && !sp.includes('زمن الاستجابة') && !sp.includes('المنافذ')) {
    notes = sp;
  }

  return {
    size,
    resolution,
    panel,
    refreshRate,
    responseTime,
    aspectRatio,
    ports,
    curvature,
    touch,
    brightness,
    notes,
  };
}
