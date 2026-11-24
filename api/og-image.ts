export const config = {
  runtime: 'edge',
};

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1).trimEnd() + '…';
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const mode = url.searchParams.get('mode') === 'submit' ? 'submit' : 'view';
  const rawTitle =
    url.searchParams.get('title')?.trim() ||
    (mode === 'submit' ? 'Formulir Data Silsilah Keluarga' : 'Pohon Silsilah Keluarga');
  const rawSubtitle =
    url.searchParams.get('subtitle')?.trim() ||
    (mode === 'submit'
      ? 'Isi data anggota keluarga, pasangan, dan keturunan untuk disambungkan ke pohon silsilah.'
      : 'Telusuri garis keturunan, hubungan kekerabatan, dan kisah keluarga lintas generasi.');
  const rawBadge =
    url.searchParams.get('badge')?.trim() ||
    (mode === 'submit' ? 'FORMULIR CABANG KELUARGA' : 'POHON SILSILAH DIGITAL');
  const rawMeta = url.searchParams.get('meta')?.trim() || '';

  const title = escapeXml(truncate(rawTitle, 42));
  const subtitle = escapeXml(truncate(rawSubtitle, 88));
  const badge = escapeXml(truncate(rawBadge.toUpperCase(), 38));
  const meta = escapeXml(truncate(rawMeta, 64));
  const ctaText =
    mode === 'submit' ? '📝 Isi Formulir Silsilah' : '🌳 Lihat Pohon Silsilah';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#192f1e" />
      <stop offset="55%" stop-color="#23442b" />
      <stop offset="100%" stop-color="#142417" />
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#68c17b" />
      <stop offset="100%" stop-color="#d9a066" />
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bgGrad)" />
  <circle cx="1040" cy="140" r="240" fill="#409155" opacity="0.14" />
  <circle cx="140" cy="520" r="220" fill="#d9a066" opacity="0.1" />
  <rect x="68" y="60" width="1064" height="510" rx="32" fill="#1e3824" stroke="#5ca36c" stroke-opacity="0.38" stroke-width="2" />
  <rect x="116" y="112" width="190" height="8" rx="4" fill="url(#accentGrad)" />
  <text x="116" y="176" fill="#8ce09e" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="23" font-weight="700" letter-spacing="2">${badge}</text>
  <text x="116" y="264" fill="#fbf9f5" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="56" font-weight="800">${title}</text>
  <text x="116" y="330" fill="#d1dfd4" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="28" font-weight="400">${subtitle}</text>
  ${
    meta
      ? `<text x="116" y="384" fill="#e5b887" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="24" font-weight="600">${meta}</text>`
      : ''
  }
  <rect x="116" y="432" width="380" height="68" rx="16" fill="#2e5a36" stroke="#68c17b" stroke-width="2" />
  <text x="152" y="475" fill="#fbf9f5" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="26" font-weight="700">${ctaText}</text>
</svg>`;

  return new Response(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
