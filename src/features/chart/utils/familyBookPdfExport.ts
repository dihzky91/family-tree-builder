import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import type { Evidence, Person, Relationship, Story } from '@/types';

export type BookThemeId = 'heritage' | 'modern' | 'minimal';

export interface FamilyBookSections {
  cover: boolean;
  analytics: boolean;
  diagram: boolean;
  directory: boolean;
  birthdaysAndStories: boolean;
}

export interface FamilyBookExportOptions {
  title: string;
  subtitle?: string;
  theme: BookThemeId;
  sections: FamilyBookSections;
  viewLabel?: string;
  qrUrl?: string;
  persons: Person[];
  relationships: Relationship[];
  evidence: Evidence[];
  stories: Story[];
  chartElement?: HTMLElement | null;
}

interface BookPalette {
  bg: [number, number, number];
  panel: [number, number, number];
  panelAlt: [number, number, number];
  border: [number, number, number];
  primary: [number, number, number];
  accent: [number, number, number];
  text: [number, number, number];
  muted: [number, number, number];
  maleHex: string;
  femaleHex: string;
  unknownHex: string;
  accentHex: string;
  primaryHex: string;
  panelHex: string;
  textHex: string;
  mutedHex: string;
  borderHex: string;
}

const PALETTES: Record<BookThemeId, BookPalette> = {
  heritage: {
    bg: [251, 248, 242],
    panel: [255, 253, 249],
    panelAlt: [245, 239, 229],
    border: [219, 205, 184],
    primary: [145, 82, 34],
    accent: [204, 142, 42],
    text: [46, 33, 22],
    muted: [115, 95, 76],
    maleHex: '#2f7da3',
    femaleHex: '#c8507a',
    unknownHex: '#8c7a6b',
    accentHex: '#cc8e2a',
    primaryHex: '#915222',
    panelHex: '#fffdf9',
    textHex: '#2e2116',
    mutedHex: '#735f4c',
    borderHex: '#dbcdb8',
  },
  modern: {
    bg: [248, 250, 252],
    panel: [255, 255, 255],
    panelAlt: [241, 245, 249],
    border: [203, 213, 225],
    primary: [15, 118, 110],
    accent: [2, 132, 199],
    text: [15, 23, 42],
    muted: [100, 116, 139],
    maleHex: '#0284c7',
    femaleHex: '#db2777',
    unknownHex: '#64748b',
    accentHex: '#0284c7',
    primaryHex: '#0f766e',
    panelHex: '#ffffff',
    textHex: '#0f172a',
    mutedHex: '#64748b',
    borderHex: '#cbd5e1',
  },
  minimal: {
    bg: [255, 255, 255],
    panel: [255, 255, 255],
    panelAlt: [248, 248, 248],
    border: [212, 212, 216],
    primary: [39, 39, 42],
    accent: [113, 113, 122],
    text: [24, 24, 27],
    muted: [113, 113, 122],
    maleHex: '#3b82f6',
    femaleHex: '#ec4899',
    unknownHex: '#71717a',
    accentHex: '#52525b',
    primaryHex: '#27272a',
    panelHex: '#ffffff',
    textHex: '#18181b',
    mutedHex: '#71717a',
    borderHex: '#d4d4d8',
  },
};

const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

function extractYear(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const m = dateStr.match(/\d{4}/);
  return m ? Number(m[0]) : null;
}

function formatLifeSpan(p: Person): string {
  const b = extractYear(p.birthDate);
  const d = extractYear(p.deathDate);
  if (b && d) return `${b} - ${d}`;
  if (b) return `Lahir ${b}`;
  if (d) return `Wafat ${d}`;
  return '-';
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizePdfText(text: string): string {
  // jsPDF standard Helvetica handles Latin-1; normalize fancy dashes/quotes
  return text
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}

function computeFamilyAnalytics(
  persons: Person[],
  relationships: Relationship[],
  evidence: Evidence[],
  stories: Story[]
) {
  const personById = new Map(persons.map((p) => [p.id, p]));
  const parentsByChild = new Map<string, string[]>();
  const childrenByParent = new Map<string, string[]>();
  const spousesByPerson = new Map<string, string[]>();

  for (const r of relationships) {
    if (r.type === 'PARENT_CHILD') {
      if (!parentsByChild.has(r.toPersonId)) parentsByChild.set(r.toPersonId, []);
      parentsByChild.get(r.toPersonId)!.push(r.fromPersonId);
      if (!childrenByParent.has(r.fromPersonId)) childrenByParent.set(r.fromPersonId, []);
      childrenByParent.get(r.fromPersonId)!.push(r.toPersonId);
    } else if (r.type === 'SPOUSE') {
      if (!spousesByPerson.has(r.fromPersonId)) spousesByPerson.set(r.fromPersonId, []);
      spousesByPerson.get(r.fromPersonId)!.push(r.toPersonId);
      if (!spousesByPerson.has(r.toPersonId)) spousesByPerson.set(r.toPersonId, []);
      spousesByPerson.get(r.toPersonId)!.push(r.fromPersonId);
    }
  }

  // Compute generation per person
  const genCache = new Map<string, number>();
  const getGen = (id: string, visited = new Set<string>()): number => {
    const cached = genCache.get(id);
    if (cached) return cached;
    if (visited.has(id)) return 1;
    const nextV = new Set(visited);
    nextV.add(id);
    const parents = parentsByChild.get(id) ?? [];
    if (parents.length === 0) {
      genCache.set(id, 1);
      return 1;
    }
    const gen = Math.max(...parents.map((pid) => getGen(pid, nextV))) + 1;
    genCache.set(id, gen);
    return gen;
  };

  const byGenerationMap = new Map<number, Person[]>();
  for (const p of persons) {
    const g = getGen(p.id);
    if (!byGenerationMap.has(g)) byGenerationMap.set(g, []);
    byGenerationMap.get(g)!.push(p);
  }

  const byGeneration = Array.from(byGenerationMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([generation, members]) => ({
      generation,
      members: members.sort((a, b) => {
        const ya = extractYear(a.birthDate) ?? 9999;
        const yb = extractYear(b.birthDate) ?? 9999;
        return ya !== yb ? ya - yb : a.fullName.localeCompare(b.fullName);
      }),
    }));

  const male = persons.filter((p) => p.gender === 'male').length;
  const female = persons.filter((p) => p.gender === 'female').length;
  const unknownGender = persons.length - male - female;
  const living = persons.filter((p) => !p.deathDate).length;
  const deceased = persons.length - living;
  const verified = persons.filter((p) => p.tags.includes('verified')).length;

  // Birth years, decades, oldest & youngest
  const withBirthYear = persons
    .map((p) => ({ person: p, year: extractYear(p.birthDate) }))
    .filter((item): item is { person: Person; year: number } => item.year !== null)
    .sort((a, b) => a.year - b.year);

  const oldest = withBirthYear[0] ?? null;
  const youngest = withBirthYear[withBirthYear.length - 1] ?? null;

  const decadeMap = new Map<number, number>();
  for (const { year } of withBirthYear) {
    const decade = Math.floor(year / 10) * 10;
    decadeMap.set(decade, (decadeMap.get(decade) ?? 0) + 1);
  }
  const byDecade = Array.from(decadeMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([decade, count]) => ({ label: `${decade}-an`, count }));

  // Top places (residence or birthPlace)
  const placeMap = new Map<string, number>();
  for (const p of persons) {
    const place = (p.residence || p.birthPlace || '').trim();
    if (!place) continue;
    const normalized = place.split(',')[0].trim();
    if (normalized) {
      placeMap.set(normalized, (placeMap.get(normalized) ?? 0) + 1);
    }
  }
  const topPlaces = Array.from(placeMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // Average children per parent who has children
  const parentCounts = Array.from(childrenByParent.values()).map((c) => c.length);
  const avgChildren =
    parentCounts.length > 0
      ? Number((parentCounts.reduce((a, b) => a + b, 0) / parentCounts.length).toFixed(1))
      : 0;

  // Completeness score
  let filledFields = 0;
  const totalFields = Math.max(1, persons.length * 4);
  for (const p of persons) {
    if (p.gender !== 'unknown') filledFields++;
    if (p.birthDate) filledFields++;
    if (p.birthPlace || p.residence) filledFields++;
    if (p.photoUrl) filledFields++;
  }
  const completenessPct = Math.round((filledFields / totalFields) * 100);

  // Birthdays by month
  const birthdaysByMonth: { month: number; name: string; day: number; year: number | null }[][] =
    Array.from({ length: 12 }, () => []);
  for (const p of persons) {
    if (!p.birthDate) continue;
    const d = new Date(p.birthDate);
    if (Number.isNaN(d.getTime())) continue;
    birthdaysByMonth[d.getMonth()].push({
      month: d.getMonth(),
      name: p.fullName,
      day: d.getDate(),
      year: extractYear(p.birthDate),
    });
  }
  birthdaysByMonth.forEach((list) => list.sort((a, b) => a.day - b.day));

  return {
    personById,
    parentsByChild,
    childrenByParent,
    spousesByPerson,
    byGeneration,
    male,
    female,
    unknownGender,
    living,
    deceased,
    verified,
    documentsCount: evidence.length,
    storiesCount: stories.length,
    oldest,
    youngest,
    byDecade,
    topPlaces,
    avgChildren,
    completenessPct,
    birthdaysByMonth,
  };
}

// --- HIGH-DPI CANVAS CHART RENDERERS FOR CRISP PDF INFOGRAPHICS ---

function renderGenerationBarChart(
  data: { generation: number; count: number }[],
  palette: BookPalette
): string {
  const w = 920;
  const h = 340;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = palette.panelHex;
  ctx.fillRect(0, 0, w, h);

  const maxCount = Math.max(1, ...data.map((d) => d.count));
  const total = Math.max(1, data.reduce((sum, d) => sum + d.count, 0));
  const padL = 135;
  const padR = 110;
  const padT = 26;
  const padB = 20;
  const chartW = w - padL - padR;
  const rowH = Math.min(54, (h - padT - padB) / Math.max(1, data.length));
  const barH = Math.min(28, rowH * 0.58);

  data.forEach((item, idx) => {
    const y = padT + idx * rowH + (rowH - barH) / 2;
    const barW = Math.max(8, (item.count / maxCount) * chartW);
    const pct = Math.round((item.count / total) * 100);

    // Label
    ctx.fillStyle = palette.textHex;
    ctx.font = '600 22px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Generasi ${item.generation}`, padL - 18, y + barH / 2);

    // Track
    ctx.fillStyle = `${palette.borderHex}66`;
    ctx.beginPath();
    ctx.roundRect(padL, y, chartW, barH, 8);
    ctx.fill();

    // Bar gradient
    const grad = ctx.createLinearGradient(padL, y, padL + barW, y);
    grad.addColorStop(0, palette.primaryHex);
    grad.addColorStop(1, palette.accentHex);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(padL, y, barW, barH, 8);
    ctx.fill();

    // Value label
    ctx.fillStyle = palette.textHex;
    ctx.font = '600 20px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${item.count} (${pct}%)`, padL + barW + 14, y + barH / 2);
  });

  return canvas.toDataURL('image/png');
}

function renderDonutChart(
  slices: { label: string; value: number; color: string }[],
  centerLabel: string,
  palette: BookPalette
): string {
  const w = 540;
  const h = 320;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = palette.panelHex;
  ctx.fillRect(0, 0, w, h);

  const total = Math.max(1, slices.reduce((s, x) => s + x.value, 0));
  const cx = 148;
  const cy = h / 2;
  const outerR = 112;
  const innerR = 66;

  let startAngle = -Math.PI / 2;
  for (const slice of slices) {
    if (slice.value <= 0) continue;
    const sweep = (slice.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, startAngle, startAngle + sweep);
    ctx.arc(cx, cy, innerR, startAngle + sweep, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = slice.color;
    ctx.fill();
    startAngle += sweep;
  }

  // Center text
  ctx.fillStyle = palette.textHex;
  ctx.font = '700 32px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(total), cx, cy - 10);

  ctx.fillStyle = palette.mutedHex;
  ctx.font = '500 17px Inter, sans-serif';
  ctx.fillText(centerLabel, cx, cy + 20);

  // Legend on right
  const legX = 292;
  let legY = cy - ((slices.length - 1) * 44) / 2;
  for (const slice of slices) {
    const pct = Math.round((slice.value / total) * 100);
    ctx.fillStyle = slice.color;
    ctx.beginPath();
    ctx.roundRect(legX, legY - 9, 18, 18, 5);
    ctx.fill();

    ctx.fillStyle = palette.textHex;
    ctx.font = '600 20px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${slice.label}`, legX + 28, legY - 2);

    ctx.fillStyle = palette.mutedHex;
    ctx.font = '500 17px Inter, sans-serif';
    ctx.fillText(`${slice.value} (${pct}%)`, legX + 28, legY + 20);

    legY += 54;
  }

  return canvas.toDataURL('image/png');
}

function renderDecadeBarChart(
  data: { label: string; count: number }[],
  palette: BookPalette
): string {
  const w = 920;
  const h = 290;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = palette.panelHex;
  ctx.fillRect(0, 0, w, h);

  if (data.length === 0) {
    ctx.fillStyle = palette.mutedHex;
    ctx.font = '500 22px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Belum ada data tahun kelahiran yang tercatat', w / 2, h / 2);
    return canvas.toDataURL('image/png');
  }

  const maxCount = Math.max(1, ...data.map((d) => d.count));
  const padL = 44;
  const padR = 44;
  const padT = 44;
  const padB = 56;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;
  const slotW = chartW / data.length;
  const barW = Math.min(64, slotW * 0.56);

  // Baseline
  ctx.strokeStyle = palette.borderHex;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padL, padT + chartH);
  ctx.lineTo(w - padR, padT + chartH);
  ctx.stroke();

  data.forEach((item, idx) => {
    const cx = padL + idx * slotW + slotW / 2;
    const barH = Math.max(10, (item.count / maxCount) * chartH);
    const x = cx - barW / 2;
    const y = padT + chartH - barH;

    const grad = ctx.createLinearGradient(x, y, x, padT + chartH);
    grad.addColorStop(0, palette.accentHex);
    grad.addColorStop(1, palette.primaryHex);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, [8, 8, 2, 2]);
    ctx.fill();

    // Count above bar
    ctx.fillStyle = palette.textHex;
    ctx.font = '700 20px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(String(item.count), cx, y - 8);

    // Decade label below baseline
    ctx.fillStyle = palette.mutedHex;
    ctx.font = '600 18px Inter, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(item.label, cx, padT + chartH + 12);
  });

  return canvas.toDataURL('image/png');
}

// --- MAIN PDF BUILDER ---

export async function exportFamilyBookPdf(options: FamilyBookExportOptions): Promise<void> {
  const {
    title,
    subtitle,
    theme,
    sections,
    viewLabel = 'Diagram Silsilah',
    qrUrl,
    persons,
    relationships,
    evidence,
    stories,
    chartElement,
  } = options;

  const toastId = 'family-book-pdf';
  toast.loading('Menyusun Buku Silsilah PDF...', { id: toastId });

  try {
    const palette = PALETTES[theme];
    const analytics = computeFamilyAnalytics(persons, relationships, evidence, stories);
    const dateStr = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    let hasStartedPage = false;
    const addPage = (orientation: 'portrait' | 'landscape' = 'portrait') => {
      if (!hasStartedPage) {
        hasStartedPage = true;
        if (orientation === 'landscape') {
          pdf.deletePage(1);
          pdf.addPage('a4', 'landscape');
        }
      } else {
        pdf.addPage('a4', orientation);
      }
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      pdf.setFillColor(...palette.bg);
      pdf.rect(0, 0, pw, ph, 'F');
      // Top accent strip
      pdf.setFillColor(...palette.primary);
      pdf.rect(0, 0, pw, 2.5, 'F');
    };

    const drawPageHeader = (heading: string, tag: string) => {
      const pw = pdf.internal.pageSize.getWidth();
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(...palette.accent);
      pdf.text(sanitizePdfText(tag.toUpperCase()), 16, 14);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(17);
      pdf.setTextColor(...palette.text);
      pdf.text(sanitizePdfText(heading), 16, 22);

      pdf.setDrawColor(...palette.border);
      pdf.setLineWidth(0.35);
      pdf.line(16, 26, pw - 16, 26);
    };

    // ==================== 1. COVER PAGE ====================
    if (sections.cover) {
      addPage('portrait');
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();

      // Decorative heritage border frame
      pdf.setDrawColor(...palette.border);
      pdf.setLineWidth(0.6);
      pdf.roundedRect(12, 12, pw - 24, ph - 24, 5, 5, 'S');
      pdf.setDrawColor(...palette.accent);
      pdf.setLineWidth(0.25);
      pdf.roundedRect(14.5, 14.5, pw - 29, ph - 29, 4, 4, 'S');

      // Tagline
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9.5);
      pdf.setTextColor(...palette.accent);
      pdf.text('ARSIP & DOKUMENTASI KELUARGA', pw / 2, 42, { align: 'center' });

      // Main Title
      pdf.setFont('times', 'bold');
      pdf.setFontSize(28);
      pdf.setTextColor(...palette.text);
      const titleLines = pdf.splitTextToSize(sanitizePdfText(title || 'Buku Silsilah Keluarga'), pw - 50);
      pdf.text(titleLines, pw / 2, 58, { align: 'center' });

      const afterTitleY = 58 + titleLines.length * 11;

      // Decorative divider
      pdf.setDrawColor(...palette.accent);
      pdf.setLineWidth(0.8);
      pdf.line(pw / 2 - 22, afterTitleY + 2, pw / 2 + 22, afterTitleY + 2);

      // Subtitle
      if (subtitle) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(11.5);
        pdf.setTextColor(...palette.muted);
        const subLines = pdf.splitTextToSize(sanitizePdfText(subtitle), pw - 60);
        pdf.text(subLines, pw / 2, afterTitleY + 13, { align: 'center' });
      }

      // Year span badge
      if (analytics.oldest && analytics.youngest) {
        const spanLabel = `Rentang Generasi: ${analytics.oldest.year} - ${analytics.youngest.year}`;
        pdf.setFillColor(...palette.panelAlt);
        pdf.setDrawColor(...palette.border);
        pdf.roundedRect(pw / 2 - 42, afterTitleY + 25, 84, 9, 4.5, 4.5, 'FD');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9.5);
        pdf.setTextColor(...palette.primary);
        pdf.text(spanLabel, pw / 2, afterTitleY + 31, { align: 'center' });
      }

      // 6 KPI Cards Grid
      const gridTop = Math.max(122, afterTitleY + 46);
      const cardW = 52;
      const cardH = 30;
      const gapX = 7;
      const gapY = 7;
      const startX = (pw - (cardW * 3 + gapX * 2)) / 2;

      const kpis = [
        { label: 'Total Anggota', value: String(persons.length) },
        { label: 'Generasi', value: String(analytics.byGeneration.length) },
        { label: 'Masih Hidup', value: String(analytics.living) },
        { label: 'Terverifikasi', value: String(analytics.verified) },
        { label: 'Dokumen Arsip', value: String(analytics.documentsCount) },
        { label: 'Kisah Keluarga', value: String(analytics.storiesCount) },
      ];

      kpis.forEach((kpi, idx) => {
        const col = idx % 3;
        const row = Math.floor(idx / 3);
        const cx = startX + col * (cardW + gapX);
        const cy = gridTop + row * (cardH + gapY);

        pdf.setFillColor(...palette.panel);
        pdf.setDrawColor(...palette.border);
        pdf.setLineWidth(0.35);
        pdf.roundedRect(cx, cy, cardW, cardH, 3.5, 3.5, 'FD');

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(20);
        pdf.setTextColor(...palette.primary);
        pdf.text(kpi.value, cx + cardW / 2, cy + 14.5, { align: 'center' });

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8.5);
        pdf.setTextColor(...palette.muted);
        pdf.text(kpi.label, cx + cardW / 2, cy + 23, { align: 'center' });
      });

      // QR Code & Metadata Footer on Cover
      if (qrUrl) {
        try {
          const qrDataUrl = await QRCode.toDataURL(qrUrl, {
            width: 220,
            margin: 1,
            color: { dark: palette.textHex, light: '#ffffff' },
          });
          const qrSize = 26;
          const qrX = pw / 2 - qrSize / 2;
          const qrY = ph - 66;
          pdf.setFillColor(255, 255, 255);
          pdf.setDrawColor(...palette.border);
          pdf.roundedRect(qrX - 2.5, qrY - 2.5, qrSize + 5, qrSize + 5, 2.5, 2.5, 'FD');
          pdf.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8);
          pdf.setTextColor(...palette.muted);
          pdf.text('Pindai QR untuk membuka silsilah interaktif', pw / 2, qrY + qrSize + 7, {
            align: 'center',
          });
        } catch {
          // Ignore QR failure silently
        }
      }

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(...palette.muted);
      pdf.text(`Disusun pada ${dateStr}`, pw / 2, ph - 22, { align: 'center' });
    }

    // ==================== 2. ANALYTICS & INFOGRAPHICS PAGE ====================
    if (sections.analytics) {
      addPage('portrait');
      drawPageHeader('Infografis & Fakta Keluarga', 'Statistik Silsilah');
      const pw = pdf.internal.pageSize.getWidth();
      const contentW = pw - 32;

      // Section A: Generation Bar Chart
      pdf.setFillColor(...palette.panel);
      pdf.setDrawColor(...palette.border);
      pdf.setLineWidth(0.3);
      pdf.roundedRect(16, 32, contentW, 68, 3.5, 3.5, 'FD');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10.5);
      pdf.setTextColor(...palette.text);
      pdf.text('Distribusi Anggota per Generasi', 21, 39.5);

      const genChartImg = renderGenerationBarChart(
        analytics.byGeneration.map((g) => ({
          generation: g.generation,
          count: g.members.length,
        })),
        palette
      );
      pdf.addImage(genChartImg, 'PNG', 19, 43, contentW - 6, 54);

      // Section B: Two Donut Charts (Gender + Living Status)
      const halfW = (contentW - 6) / 2;
      const donutTop = 105;
      const donutH = 62;

      // Left Donut: Gender
      pdf.setFillColor(...palette.panel);
      pdf.setDrawColor(...palette.border);
      pdf.roundedRect(16, donutTop, halfW, donutH, 3.5, 3.5, 'FD');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(...palette.text);
      pdf.text('Komposisi Gender', 21, donutTop + 7.5);

      const genderImg = renderDonutChart(
        [
          { label: 'Laki-laki', value: analytics.male, color: palette.maleHex },
          { label: 'Perempuan', value: analytics.female, color: palette.femaleHex },
          ...(analytics.unknownGender > 0
            ? [{ label: 'Lainnya', value: analytics.unknownGender, color: palette.unknownHex }]
            : []),
        ],
        'Anggota',
        palette
      );
      pdf.addImage(genderImg, 'PNG', 18, donutTop + 11, halfW - 4, 48);

      // Right Donut: Living Status
      const rightX = 16 + halfW + 6;
      pdf.setFillColor(...palette.panel);
      pdf.setDrawColor(...palette.border);
      pdf.roundedRect(rightX, donutTop, halfW, donutH, 3.5, 3.5, 'FD');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(...palette.text);
      pdf.text('Status Kehidupan', rightX + 5, donutTop + 7.5);

      const livingImg = renderDonutChart(
        [
          { label: 'Masih Hidup', value: analytics.living, color: '#16a34a' },
          { label: 'Telah Wafat', value: analytics.deceased, color: palette.unknownHex },
        ],
        'Total',
        palette
      );
      pdf.addImage(livingImg, 'PNG', rightX + 2, donutTop + 11, halfW - 4, 48);

      // Section C: Decade Bar Chart
      const decTop = 172;
      pdf.setFillColor(...palette.panel);
      pdf.setDrawColor(...palette.border);
      pdf.roundedRect(16, decTop, contentW, 56, 3.5, 3.5, 'FD');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(...palette.text);
      pdf.text('Sebaran Kelahiran per Dekade', 21, decTop + 7.5);

      const decImg = renderDecadeBarChart(analytics.byDecade, palette);
      pdf.addImage(decImg, 'PNG', 19, decTop + 11, contentW - 6, 42);

      // Section D: Interesting Family Highlights (4 cards)
      const hiTop = 233;
      const hiW = (contentW - 6) / 2;
      const hiH = 22;

      const highlights = [
        {
          label: 'LELUHUR TERTUA TERCATAT',
          value: analytics.oldest
            ? `${analytics.oldest.person.fullName} (${analytics.oldest.year})`
            : 'Belum ada data tahun lahir',
        },
        {
          label: 'ANGGOTA TERMUDA TERCATAT',
          value: analytics.youngest
            ? `${analytics.youngest.person.fullName} (${analytics.youngest.year})`
            : 'Belum ada data tahun lahir',
        },
        {
          label: 'DOMISILI / ASAL TERBANYAK',
          value:
            analytics.topPlaces.length > 0
              ? analytics.topPlaces.map(([place, cnt]) => `${place} (${cnt})`).join(', ')
              : 'Belum ada data lokasi',
        },
        {
          label: 'KELENGKAPAN & RATA-RATA ANAK',
          value: `${analytics.completenessPct}% data lengkap  |  Rata-rata ${analytics.avgChildren} anak/keluarga`,
        },
      ];

      highlights.forEach((hItem, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const hx = 16 + col * (hiW + 6);
        const hy = hiTop + row * (hiH + 4);

        pdf.setFillColor(...palette.panelAlt);
        pdf.setDrawColor(...palette.border);
        pdf.roundedRect(hx, hy, hiW, hiH, 3, 3, 'FD');

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7);
        pdf.setTextColor(...palette.accent);
        pdf.text(hItem.label, hx + 4, hy + 7);

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9.5);
        pdf.setTextColor(...palette.text);
        const valText = sanitizePdfText(hItem.value);
        const truncated = valText.length > 44 ? `${valText.slice(0, 42)}...` : valText;
        pdf.text(truncated, hx + 4, hy + 15.5);
      });
    }

    // ==================== 3. VISUAL DIAGRAM PAGE (LANDSCAPE) ====================
    if (sections.diagram && chartElement) {
      try {
        const dataUrl = await toPng(chartElement, {
          backgroundColor: palette.panelHex,
          pixelRatio: 2.5,
          cacheBust: true,
          filter: (node) => {
            if (node instanceof Element) {
              if (node.getAttribute('data-export-ignore') === 'true') return false;
              if (node.classList?.contains('scrollbar')) return false;
            }
            return true;
          },
        });

        addPage('landscape');
        const pw = pdf.internal.pageSize.getWidth();
        const ph = pdf.internal.pageSize.getHeight();
        drawPageHeader(`Diagram Silsilah (${viewLabel})`, 'Visualisasi Pohon Keluarga');

        const boxX = 16;
        const boxY = 31;
        const boxW = pw - 32;
        const boxH = ph - 46;

        pdf.setFillColor(...palette.panel);
        pdf.setDrawColor(...palette.border);
        pdf.setLineWidth(0.35);
        pdf.roundedRect(boxX, boxY, boxW, boxH, 3.5, 3.5, 'FD');

        // Preserve aspect ratio cleanly inside box
        const imgProps = pdf.getImageProperties(dataUrl);
        const imgRatio = imgProps.width / Math.max(1, imgProps.height);
        const innerW = boxW - 6;
        const innerH = boxH - 6;
        let drawW = innerW;
        let drawH = drawW / imgRatio;
        if (drawH > innerH) {
          drawH = innerH;
          drawW = drawH * imgRatio;
        }
        const drawX = boxX + (boxW - drawW) / 2;
        const drawY = boxY + (boxH - drawH) / 2;

        pdf.addImage(dataUrl, 'PNG', drawX, drawY, drawW, drawH);
      } catch (err) {
        console.warn('Could not capture diagram for PDF:', err);
      }
    }

    // ==================== 4. FAMILY DIRECTORY BY GENERATION ====================
    if (sections.directory) {
      addPage('portrait');
      drawPageHeader('Direktori Anggota per Generasi', 'Daftar Keluarga');
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const contentW = pw - 32;
      let cursorY = 33;

      const ensureSpace = (needed: number) => {
        if (cursorY + needed > ph - 18) {
          addPage('portrait');
          drawPageHeader('Direktori Anggota (Lanjutan)', 'Daftar Keluarga');
          cursorY = 33;
        }
      };

      for (const { generation, members } of analytics.byGeneration) {
        ensureSpace(16);

        // Generation Section Banner
        pdf.setFillColor(...palette.panelAlt);
        pdf.setDrawColor(...palette.border);
        pdf.roundedRect(16, cursorY, contentW, 8.5, 2, 2, 'FD');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9.5);
        pdf.setTextColor(...palette.primary);
        pdf.text(`Generasi ${generation}  (${members.length} anggota)`, 20, cursorY + 5.7);
        cursorY += 11;

        for (const member of members) {
          const spouseNames = (analytics.spousesByPerson.get(member.id) ?? [])
            .map((id) => analytics.personById.get(id)?.fullName)
            .filter(Boolean) as string[];
          const childCount = (analytics.childrenByParent.get(member.id) ?? []).length;
          const location = member.residence || member.birthPlace || '';

          const rowH = spouseNames.length > 0 || location ? 14 : 10.5;
          ensureSpace(rowH + 2);

          pdf.setFillColor(...palette.panel);
          pdf.setDrawColor(...palette.border);
          pdf.setLineWidth(0.2);
          pdf.roundedRect(16, cursorY, contentW, rowH, 2, 2, 'FD');

          // Gender accent dot
          const dotColor =
            member.gender === 'male'
              ? ([47, 125, 163] as [number, number, number])
              : member.gender === 'female'
                ? ([200, 80, 122] as [number, number, number])
                : palette.muted;
          pdf.setFillColor(...dotColor);
          pdf.circle(20.5, cursorY + 4.8, 1.4, 'F');

          // Name
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(9.5);
          pdf.setTextColor(...palette.text);
          pdf.text(sanitizePdfText(member.fullName), 24.5, cursorY + 5.8);

          // Right side: lifespan + child count
          const rightMeta = [
            formatLifeSpan(member),
            childCount > 0 ? `${childCount} anak` : null,
          ]
            .filter(Boolean)
            .join('  |  ');
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8);
          pdf.setTextColor(...palette.muted);
          pdf.text(sanitizePdfText(rightMeta), pw - 19, cursorY + 5.8, { align: 'right' });

          // Second line: spouse & location
          if (spouseNames.length > 0 || location) {
            const subParts: string[] = [];
            if (spouseNames.length > 0) subParts.push(`Pasangan: ${spouseNames.join(', ')}`);
            if (location) subParts.push(`Lokasi: ${location}`);
            const subLine = sanitizePdfText(subParts.join('  |  '));
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(7.8);
            pdf.setTextColor(...palette.muted);
            pdf.text(
              subLine.length > 96 ? `${subLine.slice(0, 94)}...` : subLine,
              24.5,
              cursorY + 11.2
            );
          }

          cursorY += rowH + 2;
        }

        cursorY += 3;
      }
    }

    // ==================== 5. BIRTHDAYS & STORIES ====================
    if (sections.birthdaysAndStories) {
      const hasAnyBirthday = analytics.birthdaysByMonth.some((m) => m.length > 0);
      if (hasAnyBirthday || stories.length > 0) {
        addPage('portrait');
        drawPageHeader('Kalender Ulang Tahun & Kisah Keluarga', 'Kenangan & Momen');
        const pw = pdf.internal.pageSize.getWidth();
        const ph = pdf.internal.pageSize.getHeight();
        const contentW = pw - 32;
        let cursorY = 33;

        if (hasAnyBirthday) {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(11);
          pdf.setTextColor(...palette.primary);
          pdf.text('Kalender Ulang Tahun (Januari - Desember)', 16, cursorY);
          cursorY += 5;

          const colW = (contentW - 6) / 2;
          const activeMonths = analytics.birthdaysByMonth
            .map((items, idx) => ({ monthName: MONTH_NAMES[idx], items }))
            .filter((m) => m.items.length > 0);

          for (let i = 0; i < activeMonths.length; i += 2) {
            const leftM = activeMonths[i];
            const rightM = activeMonths[i + 1];
            const maxLines = Math.max(leftM.items.length, rightM?.items.length ?? 0);
            const boxH = 10 + maxLines * 4.8;

            if (cursorY + boxH > ph - 20) {
              addPage('portrait');
              drawPageHeader('Kalender Ulang Tahun (Lanjutan)', 'Kenangan & Momen');
              cursorY = 33;
            }

            [leftM, rightM].forEach((mObj, colIdx) => {
              if (!mObj) return;
              const bx = 16 + colIdx * (colW + 6);
              pdf.setFillColor(...palette.panel);
              pdf.setDrawColor(...palette.border);
              pdf.setLineWidth(0.25);
              pdf.roundedRect(bx, cursorY, colW, boxH, 2.5, 2.5, 'FD');

              pdf.setFont('helvetica', 'bold');
              pdf.setFontSize(8.5);
              pdf.setTextColor(...palette.primary);
              pdf.text(mObj.monthName, bx + 4, cursorY + 6);

              pdf.setFont('helvetica', 'normal');
              pdf.setFontSize(8);
              pdf.setTextColor(...palette.text);
              mObj.items.forEach((b, bIdx) => {
                const line = sanitizePdfText(
                  `${String(b.day).padStart(2, '0')} - ${b.name}${b.year ? ` (${b.year})` : ''}`
                );
                pdf.text(
                  line.length > 38 ? `${line.slice(0, 36)}...` : line,
                  bx + 4,
                  cursorY + 11.5 + bIdx * 4.8
                );
              });
            });

            cursorY += boxH + 4;
          }
        }

        if (stories.length > 0) {
          if (cursorY + 30 > ph - 20) {
            addPage('portrait');
            drawPageHeader('Kisah Keluarga', 'Kenangan & Momen');
            cursorY = 33;
          } else {
            cursorY += 4;
          }

          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(11);
          pdf.setTextColor(...palette.primary);
          pdf.text(`Kisah & Catatan Keluarga (${stories.length})`, 16, cursorY);
          cursorY += 6;

          for (const story of stories) {
            const plain = sanitizePdfText(stripHtml(story.content));
            const excerpt = plain.length > 320 ? `${plain.slice(0, 318)}...` : plain;
            const textLines = pdf.splitTextToSize(excerpt, contentW - 10);
            const cardH = 14 + textLines.length * 4.2;

            if (cursorY + cardH > ph - 20) {
              addPage('portrait');
              drawPageHeader('Kisah Keluarga (Lanjutan)', 'Kenangan & Momen');
              cursorY = 33;
            }

            pdf.setFillColor(...palette.panel);
            pdf.setDrawColor(...palette.border);
            pdf.roundedRect(16, cursorY, contentW, cardH, 3, 3, 'FD');

            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(10);
            pdf.setTextColor(...palette.text);
            pdf.text(sanitizePdfText(story.title), 21, cursorY + 7);

            if (story.date) {
              pdf.setFont('helvetica', 'normal');
              pdf.setFontSize(8);
              pdf.setTextColor(...palette.muted);
              pdf.text(sanitizePdfText(story.date), pw - 21, cursorY + 7, { align: 'right' });
            }

            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8.5);
            pdf.setTextColor(...palette.muted);
            pdf.text(textLines, 21, cursorY + 13);

            cursorY += cardH + 4;
          }
        }
      }
    }

    // ==================== ADD PAGE NUMBERS & FOOTERS ====================
    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      if (i === 1 && sections.cover) continue;
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      pdf.setDrawColor(...palette.border);
      pdf.setLineWidth(0.2);
      pdf.line(16, ph - 12, pw - 16, ph - 12);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(...palette.muted);
      pdf.text(sanitizePdfText(title || 'Buku Silsilah Keluarga'), 16, ph - 7.5);
      pdf.text(`Halaman ${i} dari ${totalPages}`, pw - 16, ph - 7.5, { align: 'right' });
    }

    const slug = (title || 'buku-silsilah')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const stamp = new Date().toISOString().split('T')[0];
    pdf.save(`${slug || 'buku-silsilah'}-${stamp}.pdf`);

    toast.success(`Buku Silsilah PDF (${totalPages} halaman) berhasil diunduh!`, { id: toastId });
  } catch (error) {
    console.error('Family Book PDF export failed:', error);
    toast.error('Gagal membuat Buku Silsilah PDF', { id: toastId });
  }
}

// --- EXCEL-FRIENDLY CSV EXPORT ---

export function exportFamilyCsv(persons: Person[], relationships: Relationship[]): void {
  try {
    const personById = new Map(persons.map((p) => [p.id, p]));
    const parentsByChild = new Map<string, string[]>();
    const childrenByParent = new Map<string, string[]>();
    const spousesByPerson = new Map<string, string[]>();

    for (const r of relationships) {
      if (r.type === 'PARENT_CHILD') {
        if (!parentsByChild.has(r.toPersonId)) parentsByChild.set(r.toPersonId, []);
        parentsByChild.get(r.toPersonId)!.push(r.fromPersonId);
        if (!childrenByParent.has(r.fromPersonId)) childrenByParent.set(r.fromPersonId, []);
        childrenByParent.get(r.fromPersonId)!.push(r.toPersonId);
      } else if (r.type === 'SPOUSE') {
        if (!spousesByPerson.has(r.fromPersonId)) spousesByPerson.set(r.fromPersonId, []);
        spousesByPerson.get(r.fromPersonId)!.push(r.toPersonId);
        if (!spousesByPerson.has(r.toPersonId)) spousesByPerson.set(r.toPersonId, []);
        spousesByPerson.get(r.toPersonId)!.push(r.fromPersonId);
      }
    }

    const escapeCsv = (val: string) => `"${val.replace(/"/g, '""')}"`;

    const headers = [
      'Nama Lengkap',
      'Gender',
      'Tanggal Lahir',
      'Tempat Lahir',
      'Tanggal Wafat',
      'Domisili',
      'Status',
      'Orang Tua',
      'Pasangan',
      'Jumlah Anak',
      'Tag',
    ];

    const rows = [...persons]
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
      .map((p) => {
        const parents = (parentsByChild.get(p.id) ?? [])
          .map((id) => personById.get(id)?.fullName)
          .filter(Boolean)
          .join('; ');
        const spouses = (spousesByPerson.get(p.id) ?? [])
          .map((id) => personById.get(id)?.fullName)
          .filter(Boolean)
          .join('; ');
        const childrenCount = (childrenByParent.get(p.id) ?? []).length;

        return [
          p.fullName,
          p.gender === 'male' ? 'Laki-laki' : p.gender === 'female' ? 'Perempuan' : 'Lainnya',
          p.birthDate || '',
          p.birthPlace || '',
          p.deathDate || '',
          p.residence || '',
          p.deathDate ? 'Wafat' : 'Hidup',
          parents,
          spouses,
          String(childrenCount),
          p.tags.join('; '),
        ]
          .map(escapeCsv)
          .join(',');
      });

    // UTF-8 BOM so Microsoft Excel opens Indonesian characters cleanly
    const csvContent = `\uFEFF${headers.map(escapeCsv).join(',')}\n${rows.join('\n')}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `data-silsilah-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success('Data keluarga berhasil di-export ke CSV!');
  } catch (error) {
    console.error('CSV export failed:', error);
    toast.error('Gagal meng-export data CSV');
  }
}
