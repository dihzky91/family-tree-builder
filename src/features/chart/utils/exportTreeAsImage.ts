import { toPng, toSvg } from 'html-to-image';
import { toast } from 'sonner';

export type ExportFormat = 'png' | 'svg';

interface ExportOptions {
  format: ExportFormat;
  filename?: string;
  backgroundColor?: string;
  scale?: number;
}

const MAX_CANVAS_DIMENSION = 6000;

function computeSafeScale(width: number, height: number, requestedScale: number): number {
  const maxDim = Math.max(width, height, 1);
  if (maxDim * requestedScale <= MAX_CANVAS_DIMENSION) return requestedScale;
  return Math.max(1, Math.floor((MAX_CANVAS_DIMENSION / maxDim) * 10) / 10);
}

function downloadDataUrl(dataUrl: string, filename: string, format: ExportFormat) {
  const link = document.createElement('a');
  link.download = `${filename}-${new Date().toISOString().split('T')[0]}.${format}`;
  link.href = dataUrl;
  link.click();
}

function exportFilter(node: HTMLElement): boolean {
  if (node instanceof Element) {
    if (node.getAttribute('data-export-ignore') === 'true') return false;
    if (node.classList?.contains('scrollbar')) return false;
  }
  return true;
}

/**
 * Strategy 1: Export pure D3 SVG charts using the true untransformed getBBox()
 */
async function renderPureSvgChart(
  svgEl: SVGSVGElement,
  format: ExportFormat,
  backgroundColor: string,
  scale: number
): Promise<string> {
  const mainG = svgEl.querySelector('g');
  const bbox = mainG ? mainG.getBBox() : svgEl.getBBox();

  if (!bbox || bbox.width <= 0 || bbox.height <= 0) {
    throw new Error('SVG chart bounding box is empty');
  }

  const pad = 36;
  const viewX = bbox.x - pad;
  const viewY = bbox.y - pad;
  const fullW = Math.ceil(bbox.width + pad * 2);
  const fullH = Math.ceil(bbox.height + pad * 2);

  const clonedSvg = svgEl.cloneNode(true) as SVGSVGElement;
  clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clonedSvg.setAttribute('viewBox', `${viewX} ${viewY} ${fullW} ${fullH}`);
  clonedSvg.setAttribute('width', `${fullW}`);
  clonedSvg.setAttribute('height', `${fullH}`);
  clonedSvg.style.fontFamily =
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif';

  // Reset pan/zoom transform on the root <g> so the entire chart is centered cleanly
  const clonedMainG = clonedSvg.querySelector('g');
  if (clonedMainG) {
    clonedMainG.removeAttribute('transform');
  }

  // Insert solid background rect behind the chart
  const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bgRect.setAttribute('x', `${viewX}`);
  bgRect.setAttribute('y', `${viewY}`);
  bgRect.setAttribute('width', `${fullW}`);
  bgRect.setAttribute('height', `${fullH}`);
  bgRect.setAttribute('fill', backgroundColor);
  clonedSvg.insertBefore(bgRect, clonedSvg.firstChild);

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clonedSvg);
  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;

  if (format === 'svg') {
    return svgDataUrl;
  }

  // Render crisp SVG onto an offscreen high-res canvas
  const safeScale = computeSafeScale(fullW, fullH, scale);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(fullW * safeScale);
  canvas.height = Math.round(fullH * safeScale);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not acquire 2D canvas context');

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve();
    };
    img.onerror = (err) => reject(err);
    img.src = svgDataUrl;
  });

  return canvas.toDataURL('image/png');
}

/**
 * Strategy 2: Export donatso/family-chart (.f3) by measuring all card positions
 * in untransformed chart space and temporarily fitting the entire tree into bounds.
 */
async function renderFamilyChartFull(
  f3Container: HTMLElement,
  format: ExportFormat,
  backgroundColor: string,
  scale: number
): Promise<string> {
  const mainSvg = f3Container.querySelector('svg.main_svg') as SVGSVGElement | null;
  const svgView = f3Container.querySelector('svg.main_svg g.view') as SVGGElement | null;
  const cardsView = f3Container.querySelector('.cards_view') as HTMLElement | null;
  const cardConts = Array.from(f3Container.querySelectorAll('.card_cont')) as HTMLElement[];

  if (!mainSvg || !svgView || !cardsView || cardConts.length === 0) {
    // Fallback to standard HTML capture
    return renderHtmlFull(f3Container, format, backgroundColor, scale);
  }

  // Parse untransformed coordinates of every rendered card
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const card of cardConts) {
    const tf = card.style.transform || '';
    const match = tf.match(/translate\(\s*([-\d.]+)px\s*,\s*([-\d.]+)px\s*\)/);
    const x = match ? parseFloat(match[1]) : card.offsetLeft;
    const y = match ? parseFloat(match[2]) : card.offsetTop;
    const w = card.offsetWidth || 220;
    const h = card.offsetHeight || 96;

    // family-chart centers cards around (x, y) or top-left depending on CSS; include generous bounds
    minX = Math.min(minX, x - w / 2);
    minY = Math.min(minY, y - h / 2);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
    return renderHtmlFull(f3Container, format, backgroundColor, scale);
  }

  const pad = 64;
  const fullW = Math.ceil(maxX - minX + pad * 2);
  const fullH = Math.ceil(maxY - minY + pad * 2);
  const offsetX = Math.round(-minX + pad);
  const offsetY = Math.round(-minY + pad);

  // Save original inline styles
  const prevF3Width = f3Container.style.width;
  const prevF3Height = f3Container.style.height;
  const prevF3Overflow = f3Container.style.overflow;
  const prevSvgTransform = svgView.getAttribute('transform');
  const prevSvgStyleTransform = svgView.style.transform;
  const prevCardsTransform = cardsView.style.transform;
  const prevCardsTransition = cardsView.style.transition;
  const prevSvgWidth = mainSvg.style.width;
  const prevSvgHeight = mainSvg.style.height;

  try {
    f3Container.style.width = `${fullW}px`;
    f3Container.style.height = `${fullH}px`;
    f3Container.style.overflow = 'visible';
    mainSvg.style.width = `${fullW}px`;
    mainSvg.style.height = `${fullH}px`;

    svgView.setAttribute('transform', `translate(${offsetX}, ${offsetY}) scale(1)`);
    svgView.style.transform = '';
    cardsView.style.transition = 'none';
    cardsView.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(1)`;

    // Wait one frame for browser layout/paint
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const safeScale = computeSafeScale(fullW, fullH, scale);
    const exportFn = format === 'png' ? toPng : toSvg;

    return await exportFn(f3Container, {
      backgroundColor,
      pixelRatio: safeScale,
      cacheBust: true,
      width: fullW,
      height: fullH,
      filter: exportFilter,
    });
  } finally {
    f3Container.style.width = prevF3Width;
    f3Container.style.height = prevF3Height;
    f3Container.style.overflow = prevF3Overflow;
    mainSvg.style.width = prevSvgWidth;
    mainSvg.style.height = prevSvgHeight;

    if (prevSvgTransform !== null) svgView.setAttribute('transform', prevSvgTransform);
    else svgView.removeAttribute('transform');
    svgView.style.transform = prevSvgStyleTransform;
    cardsView.style.transform = prevCardsTransform;
    cardsView.style.transition = prevCardsTransition;
  }
}

/**
 * Strategy 3: Export general HTML / scrollable / panned charts at full scrollWidth x scrollHeight
 */
async function renderHtmlFull(
  target: HTMLElement,
  format: ExportFormat,
  backgroundColor: string,
  scale: number
): Promise<string> {
  const fullW = Math.max(target.scrollWidth, target.offsetWidth, 1);
  const fullH = Math.max(target.scrollHeight, target.offsetHeight, 1);
  const safeScale = computeSafeScale(fullW, fullH, scale);
  const exportFn = format === 'png' ? toPng : toSvg;

  return await exportFn(target, {
    backgroundColor,
    pixelRatio: safeScale,
    cacheBust: true,
    width: fullW,
    height: fullH,
    style: {
      transform: 'none',
      overflow: 'visible',
      width: `${fullW}px`,
      height: `${fullH}px`,
      maxWidth: 'none',
      maxHeight: 'none',
    },
    filter: exportFilter,
  });
}

async function generateChartDataUrl(
  element: HTMLElement,
  format: ExportFormat,
  backgroundColor: string,
  scale: number
): Promise<string> {
  // 1. Check for dedicated pure-SVG chart (e.g. FanChartView, SunburstView)
  const pureSvg =
    element instanceof SVGSVGElement
      ? element
      : (element.querySelector('svg[data-export-svg="true"]') as SVGSVGElement | null);
  if (pureSvg) {
    return renderPureSvgChart(pureSvg, format, backgroundColor, scale);
  }

  // 2. Check for family-chart (.f3) container
  const f3Container = element.classList.contains('f3')
    ? element
    : (element.querySelector('.f3') as HTMLElement | null);
  if (f3Container) {
    return renderFamilyChartFull(f3Container, format, backgroundColor, scale);
  }

  // 3. Check for explicit inner export target (e.g. HourglassView, RelationshipPathView, DescendantOutlineView, LifespanGanttView)
  const explicitTarget = element.querySelector('[data-export-target="true"]') as HTMLElement | null;
  const target = explicitTarget || element;

  return renderHtmlFull(target, format, backgroundColor, scale);
}

export async function exportTreeAsImage(
  element: HTMLElement,
  options: ExportOptions
): Promise<void> {
  const { format, filename = 'family-tree', backgroundColor = '#ffffff', scale = 2 } = options;

  try {
    toast.loading('Menyiapkan export grafik penuh...', { id: 'export' });
    const dataUrl = await generateChartDataUrl(element, format, backgroundColor, scale);
    downloadDataUrl(dataUrl, filename, format);
    toast.success('Seluruh grafik silsilah berhasil di-export!', { id: 'export' });
  } catch (error) {
    console.error('Export failed:', error);
    toast.error('Gagal meng-export silsilah', { id: 'export' });
  }
}

export async function copyTreeToClipboard(element: HTMLElement): Promise<void> {
  try {
    toast.loading('Menyalin grafik penuh ke clipboard...', { id: 'copy' });
    const dataUrl = await generateChartDataUrl(element, 'png', '#ffffff', 2);

    const response = await fetch(dataUrl);
    const blob = await response.blob();

    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    toast.success('Seluruh grafik berhasil disalin ke clipboard!', { id: 'copy' });
  } catch (error) {
    console.error('Copy failed:', error);
    toast.error('Gagal menyalin ke clipboard', { id: 'copy' });
  }
}
