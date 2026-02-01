import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { toast } from 'sonner';

export type PremiumTheme = 'modern' | 'classic';

export interface PremiumStats {
  totalMembers: number;
  totalRelationships: number;
  generations: number;
  verifiedMembers: number;
  livingMembers: number;
  documents: number;
}

export interface PremiumPaletteOverrides {
  backgroundStart?: string;
  backgroundEnd?: string;
  panel?: string;
  border?: string;
  textPrimary?: string;
  textSecondary?: string;
  accent?: string;
  shadow?: string;
}

interface PremiumExportOptions {
  title?: string;
  subtitle?: string;
  theme?: PremiumTheme;
  scale?: number;
  stats?: PremiumStats;
  qrData?: string;
  paletteOverrides?: PremiumPaletteOverrides;
  highlightedPersonIds?: string[];
}

const DEFAULT_THEME: PremiumTheme = 'modern';

const MODERN_THEME = {
  backgroundStart: '#f8fafc',
  backgroundEnd: '#eef2f7',
  panel: '#ffffff',
  border: '#d6dde6',
  textPrimary: '#0f172a',
  textSecondary: '#64748b',
  accent: '#14b8a6',
  shadow: 'rgba(15, 23, 42, 0.12)',
};

const CLASSIC_THEME = {
  backgroundStart: '#fbf7f2',
  backgroundEnd: '#efe5d6',
  panel: '#fffaf3',
  border: '#d5c3a6',
  textPrimary: '#4a3626',
  textSecondary: '#7a5f45',
  accent: '#b07b37',
  shadow: 'rgba(74, 54, 38, 0.16)',
};

const loadImage = (dataUrl: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (error) => reject(error);
    img.src = dataUrl;
  });

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
};

const formatDate = () =>
  new Date().toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

const getPalette = (
  theme: PremiumTheme,
  overrides?: PremiumPaletteOverrides
) => {
  const base = theme === 'classic' ? CLASSIC_THEME : MODERN_THEME;
  return { ...base, ...(overrides || {}) };
};

type PremiumPalette = ReturnType<typeof getPalette>;

const buildTreeCanvas = async (options: {
  image: HTMLImageElement;
  palette: PremiumPalette;
  title: string;
  subtitle?: string;
  qrDataUrl?: string | null;
}) => {
  const { image, palette, title, subtitle, qrDataUrl } = options;
  const headerHeight = 220;
  const footerHeight = 120;
  const padding = 120;
  const frameRadius = 36;

  const canvas = document.createElement('canvas');
  canvas.width = image.width + padding * 2;
  canvas.height = image.height + padding * 2 + headerHeight + footerHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas context not available');
  }

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, palette.backgroundStart);
  gradient.addColorStop(1, palette.backgroundEnd);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = palette.accent;
  ctx.fillRect(0, 0, canvas.width, 6);

  ctx.fillStyle = palette.textPrimary;
  ctx.font = '700 64px "Playfair Display", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, canvas.width / 2, 110);

  ctx.fillStyle = palette.textSecondary;
  ctx.font = '500 26px "Inter", sans-serif';
  const metaText = subtitle ? `${subtitle} - ${formatDate()}` : formatDate();
  ctx.fillText(metaText, canvas.width / 2, 160);

  const panelX = padding;
  const panelY = headerHeight + padding;
  const panelWidth = image.width;
  const panelHeight = image.height;

  ctx.save();
  ctx.shadowColor = palette.shadow;
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 12;
  drawRoundedRect(ctx, panelX, panelY, panelWidth, panelHeight, frameRadius);
  ctx.fillStyle = palette.panel;
  ctx.fill();
  ctx.restore();

  ctx.save();
  drawRoundedRect(ctx, panelX, panelY, panelWidth, panelHeight, frameRadius);
  ctx.clip();
  ctx.drawImage(image, panelX, panelY, panelWidth, panelHeight);
  ctx.restore();

  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, panelX, panelY, panelWidth, panelHeight, frameRadius);
  ctx.stroke();

  ctx.fillStyle = palette.textSecondary;
  ctx.font = '500 20px "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Export Premium - Digital', canvas.width / 2, canvas.height - 45);

  if (qrDataUrl) {
    const qrImage = await loadImage(qrDataUrl);
    const qrSize = 96;
    const qrX = canvas.width - padding - qrSize;
    const qrY = canvas.height - footerHeight + 12;

    ctx.save();
    drawRoundedRect(ctx, qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 16);
    ctx.fillStyle = palette.panel;
    ctx.fill();
    ctx.restore();

    ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
    ctx.fillStyle = palette.textSecondary;
    ctx.font = '500 14px "Inter", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Scan untuk akses', qrX + qrSize, qrY + qrSize + 18);
  }

  return canvas;
};

const buildCoverCanvas = async (options: {
  width: number;
  height: number;
  palette: PremiumPalette;
  title: string;
  subtitle?: string;
  stats: PremiumStats;
  qrDataUrl?: string | null;
}) => {
  const { width, height, palette, title, subtitle, stats, qrDataUrl } = options;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas context not available');
  }

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, palette.backgroundStart);
  gradient.addColorStop(1, palette.backgroundEnd);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = palette.accent;
  ctx.fillRect(0, 0, width, 8);

  ctx.fillStyle = palette.textPrimary;
  ctx.font = '700 72px "Playfair Display", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, width / 2, 160);

  ctx.fillStyle = palette.textSecondary;
  ctx.font = '500 28px "Inter", sans-serif';
  const subtitleText = subtitle ? `${subtitle} - ${formatDate()}` : formatDate();
  ctx.fillText(subtitleText, width / 2, 220);

  const panelWidth = width * 0.72;
  const panelHeight = height * 0.45;
  const panelX = (width - panelWidth) / 2;
  const panelY = height * 0.32;

  ctx.save();
  ctx.shadowColor = palette.shadow;
  ctx.shadowBlur = 35;
  ctx.shadowOffsetY = 10;
  drawRoundedRect(ctx, panelX, panelY, panelWidth, panelHeight, 32);
  ctx.fillStyle = palette.panel;
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, panelX, panelY, panelWidth, panelHeight, 32);
  ctx.stroke();

  const statItems = [
    { label: 'Anggota', value: stats.totalMembers },
    { label: 'Relasi', value: stats.totalRelationships },
    { label: 'Generasi', value: stats.generations },
    { label: 'Terverifikasi', value: stats.verifiedMembers },
    { label: 'Masih Hidup', value: stats.livingMembers },
    { label: 'Dokumen', value: stats.documents },
  ];

  const columns = 3;
  const rows = 2;
  const cellWidth = panelWidth / columns;
  const cellHeight = panelHeight / rows;

  ctx.textAlign = 'center';
  statItems.forEach((stat, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const centerX = panelX + col * cellWidth + cellWidth / 2;
    const centerY = panelY + row * cellHeight + cellHeight / 2;

    ctx.fillStyle = palette.textPrimary;
    ctx.font = '700 36px "Inter", sans-serif';
    ctx.fillText(String(stat.value), centerX, centerY - 6);

    ctx.fillStyle = palette.textSecondary;
    ctx.font = '500 18px "Inter", sans-serif';
    ctx.fillText(stat.label, centerX, centerY + 28);
  });

  ctx.fillStyle = palette.textSecondary;
  ctx.font = '500 20px "Inter", sans-serif';
  ctx.fillText('Ringkasan Data Keluarga', width / 2, panelY - 30);

  if (qrDataUrl) {
    const qrImage = await loadImage(qrDataUrl);
    const qrSize = 120;
    const qrX = width - qrSize - 120;
    const qrY = height - qrSize - 120;

    ctx.save();
    drawRoundedRect(ctx, qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 18);
    ctx.fillStyle = palette.panel;
    ctx.fill();
    ctx.restore();

    ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
    ctx.fillStyle = palette.textSecondary;
    ctx.font = '500 16px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Scan untuk membuka', qrX + qrSize / 2, qrY + qrSize + 26);
  }

  ctx.fillStyle = palette.textSecondary;
  ctx.font = '500 18px "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Dokumen ini dibuat otomatis oleh Family Tree Builder', width / 2, height - 70);

  return canvas;
};

const generateQrDataUrl = async (
  qrData?: string,
  darkColor: string = '#111827'
) => {
  if (!qrData) return null;
  try {
    return await QRCode.toDataURL(qrData, {
      width: 200,
      margin: 1,
      color: {
        dark: darkColor,
        light: '#ffffff',
      },
    });
  } catch (error) {
    console.error('QR generation failed:', error);
    return null;
  }
};

const applyHighlight = (
  root: HTMLElement,
  highlightIds?: string[],
  accentColor: string = 'rgba(20, 184, 166, 0.8)'
) => {
  if (!highlightIds || highlightIds.length === 0) return () => {};
  const highlightSet = new Set(highlightIds);
  const nodes = Array.from(root.querySelectorAll('[data-person-id]')) as HTMLElement[];
  const previous = nodes.map((node) => ({
    node,
    opacity: node.style.opacity,
    outline: node.style.outline,
    outlineOffset: node.style.outlineOffset,
    boxShadow: node.style.boxShadow,
  }));

  nodes.forEach((node) => {
    const id = node.getAttribute('data-person-id');
    if (id && highlightSet.has(id)) {
      node.style.outline = `3px solid ${accentColor}`;
      node.style.outlineOffset = '2px';
      node.style.boxShadow = '0 12px 25px rgba(20, 184, 166, 0.2)';
      node.style.opacity = '1';
    } else {
      node.style.opacity = '0.45';
    }
  });

  return () => {
    previous.forEach(({ node, opacity, outline, outlineOffset, boxShadow }) => {
      node.style.opacity = opacity;
      node.style.outline = outline;
      node.style.outlineOffset = outlineOffset;
      node.style.boxShadow = boxShadow;
    });
  };
};

export async function exportTreePremiumDigital(
  element: HTMLElement,
  options: PremiumExportOptions = {}
): Promise<void> {
  const {
    title = 'Silsilah Keluarga',
    subtitle,
    theme = DEFAULT_THEME,
    scale = 3,
    stats,
    qrData,
    paletteOverrides,
    highlightedPersonIds,
  } = options;

  const palette = getPalette(theme, paletteOverrides);
  const datePart = new Date().toISOString().split('T')[0];
  const baseFilename = `silsilah-premium-${datePart}`;

  let cleanupHighlight = () => {};

  try {
    toast.loading('Menyiapkan export premium...', { id: 'premium-export' });

    cleanupHighlight = applyHighlight(element, highlightedPersonIds, palette.accent);
    const qrDataUrl = await generateQrDataUrl(qrData, palette.textPrimary);

    const rawDataUrl = await toPng(element, {
      backgroundColor: '#ffffff',
      pixelRatio: scale,
      cacheBust: true,
      style: {
        transform: 'none',
      },
      filter: (node) => {
        if (node instanceof Element) {
          if (node.classList?.contains('scrollbar')) return false;
        }
        return true;
      },
    });

    const image = await loadImage(rawDataUrl);
    const treeCanvas = await buildTreeCanvas({
      image,
      palette,
      title,
      subtitle,
      qrDataUrl,
    });

    const coverCanvas = stats
      ? await buildCoverCanvas({
          width: treeCanvas.width,
          height: treeCanvas.height,
          palette,
          title,
          subtitle,
          stats,
          qrDataUrl,
        })
      : null;

    const treeDataUrl = treeCanvas.toDataURL('image/png');
    const pngLink = document.createElement('a');
    pngLink.download = `${baseFilename}.png`;
    pngLink.href = treeDataUrl;
    pngLink.click();

    const pdfWidth = treeCanvas.width * 0.75;
    const pdfHeight = treeCanvas.height * 0.75;
    const orientation = pdfWidth >= pdfHeight ? 'l' : 'p';

    const pdf = new jsPDF({
      orientation,
      unit: 'pt',
      format: [pdfWidth, pdfHeight],
    });

    if (coverCanvas) {
      const coverDataUrl = coverCanvas.toDataURL('image/png');
      pdf.addImage(coverDataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.addPage([pdfWidth, pdfHeight], orientation);
    }

    pdf.addImage(treeDataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);

    pdf.save(`${baseFilename}.pdf`);

    toast.success('Export premium selesai (PNG + PDF).', { id: 'premium-export' });
  } catch (error) {
    console.error('Premium export failed:', error);
    toast.error('Gagal membuat export premium.', { id: 'premium-export' });
  } finally {
    cleanupHighlight();
  }
}
