export const config = {
  runtime: 'edge',
};

const CLOUD_SHARE_PREFIX = '__PUBLIC_SHARE_V1__:';

interface ResolvedOgMeta {
  title: string;
  description: string;
  imageUrl: string;
  canonicalUrl: string;
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getSupabaseEnv(): { url: string; key: string } | null {
  const env = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } })
    .process?.env || {};
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL || '';
  const key =
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    env.SUPABASE_ANON_KEY ||
    '';

  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ''), key };
}

async function fetchBranchMeta(
  code: string
): Promise<{ name: string; coordinatorName?: string; description?: string } | null> {
  const supa = getSupabaseEnv();
  if (!supa) return null;

  try {
    const endpoint = `${supa.url}/rest/v1/branches?code=eq.${encodeURIComponent(
      code
    )}&is_active=eq.true&select=name,coordinator_name,description&limit=1`;

    const res = await fetch(endpoint, {
      headers: {
        apikey: supa.key,
        Authorization: `Bearer ${supa.key}`,
      },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{
      name?: string;
      coordinator_name?: string;
      description?: string | null;
    }>;
    const row = rows?.[0];
    if (
      !row ||
      !row.name ||
      row.coordinator_name === '__PUBLIC_SHARE__' ||
      row.description?.startsWith(CLOUD_SHARE_PREFIX)
    ) {
      return null;
    }

    return {
      name: row.name,
      coordinatorName: row.coordinator_name || undefined,
      description: row.description || undefined,
    };
  } catch {
    return null;
  }
}

async function fetchShareMeta(
  code: string
): Promise<{ title: string; description?: string; personsCount?: number; hasPin?: boolean } | null> {
  const supa = getSupabaseEnv();
  if (!supa) return null;
  const cleanCode = code.trim().toLowerCase();

  try {
    // 1. Check dedicated public_shares table or RPC first
    const rpcRes = await fetch(`${supa.url}/rest/v1/rpc/get_public_share_meta`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supa.key,
        Authorization: `Bearer ${supa.key}`,
      },
      body: JSON.stringify({ p_code: cleanCode }),
    });

    if (rpcRes.ok) {
      const data = (await rpcRes.json()) as {
        title?: string;
        description?: string;
        hasPin?: boolean;
      } | null;
      if (data && data.title) {
        return {
          title: data.title,
          description: data.description,
          hasPin: Boolean(data.hasPin),
        };
      }
    }

    // 2. Fallback: check branches table where cloud shares are stored with __PUBLIC_SHARE_V1__: prefix
    const endpoint = `${supa.url}/rest/v1/branches?code=eq.${encodeURIComponent(
      cleanCode
    )}&is_active=eq.true&select=name,description&limit=1`;

    const branchRes = await fetch(endpoint, {
      headers: {
        apikey: supa.key,
        Authorization: `Bearer ${supa.key}`,
      },
    });
    if (!branchRes.ok) return null;

    const rows = (await branchRes.json()) as Array<{
      name?: string;
      description?: string | null;
    }>;
    const row = rows?.[0];
    if (!row) return null;

    if (row.description?.startsWith(CLOUD_SHARE_PREFIX)) {
      const decoded = JSON.parse(row.description.slice(CLOUD_SHARE_PREFIX.length)) as {
        title?: string;
        description?: string;
        hasPin?: boolean;
        pinCode?: string;
        personsCount?: number;
        snapshotData?: { persons?: unknown[] };
      };
      return {
        title: decoded.title || row.name || 'Pohon Silsilah Keluarga',
        description: decoded.description,
        personsCount:
          typeof decoded.personsCount === 'number'
            ? decoded.personsCount
            : Array.isArray(decoded.snapshotData?.persons)
              ? decoded.snapshotData?.persons.length
              : undefined,
        hasPin: Boolean(decoded.hasPin || (decoded.pinCode && decoded.pinCode.trim().length > 0)),
      };
    }

    if (row.name) {
      return {
        title: row.name,
        description: row.description || undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function resolveRouteOgMeta(reqUrl: URL): Promise<ResolvedOgMeta> {
  const origin = reqUrl.origin;
  const type = reqUrl.searchParams.get('type');
  const code = reqUrl.searchParams.get('code')?.trim() || '';

  if (type === 'submit' && code) {
    const branch = await fetchBranchMeta(code);
    const branchName = branch?.name || code;
    const title = `Formulir Silsilah — Cabang ${branchName}`;
    const coordinatorPart = branch?.coordinatorName
      ? `Koordinator: ${branch.coordinatorName}. `
      : '';
    const descPart =
      branch?.description ||
      'Tambahkan data diri, pasangan, anak, dan cucu Anda secara langsung ke pohon silsilah keluarga.';
    const description = `${coordinatorPart}${descPart}`;

    const ogImg = new URL('/api/og-image', origin);
    ogImg.searchParams.set('mode', 'submit');
    ogImg.searchParams.set('badge', 'FORMULIR SILSILAH KELUARGA');
    ogImg.searchParams.set('title', `Cabang ${branchName}`);
    ogImg.searchParams.set('subtitle', descPart);
    if (branch?.coordinatorName) {
      ogImg.searchParams.set('meta', `Koordinator Cabang: ${branch.coordinatorName}`);
    }

    return {
      title,
      description,
      imageUrl: ogImg.toString(),
      canonicalUrl: `${origin}/submit/${encodeURIComponent(code)}`,
    };
  }

  if (type === 'view' && code) {
    const share = await fetchShareMeta(code);
    const shareTitle = share?.title || `Pohon Silsilah (${code})`;
    const title = `${shareTitle} — Silsilah Keluarga Digital`;
    const countInfo =
      typeof share?.personsCount === 'number' && share.personsCount > 0
        ? `${share.personsCount} anggota keluarga tercatat`
        : 'Pohon Silsilah Interaktif';
    const pinInfo = share?.hasPin ? ' · Dilindungi PIN Keluarga' : '';
    const description =
      share?.description ||
      `Lihat diagram pohon silsilah keluarga ${shareTitle} (${countInfo}${pinInfo}).`;

    const ogImg = new URL('/api/og-image', origin);
    ogImg.searchParams.set('mode', 'view');
    ogImg.searchParams.set('badge', 'POHON SILSILAH KELUARGA');
    ogImg.searchParams.set('title', shareTitle);
    ogImg.searchParams.set(
      'subtitle',
      share?.description || 'Telusuri garis keturunan, cek hubungan kekerabatan, dan lihat bagan keluarga.'
    );
    ogImg.searchParams.set('meta', `${countInfo}${pinInfo}`);

    return {
      title,
      description,
      imageUrl: ogImg.toString(),
      canonicalUrl: `${origin}/view/${encodeURIComponent(code)}`,
    };
  }

  const defaultImg = new URL('/api/og-image', origin).toString();
  return {
    title: 'Silsilah Keluarga — Pohon Silsilah & Arsip Keluarga Digital',
    description:
      'Bangun, telusuri, dan kelola pohon silsilah keluarga lintas generasi secara kolaboratif maupun offline.',
    imageUrl: defaultImg,
    canonicalUrl: origin,
  };
}

function injectMetaIntoHtml(html: string, meta: ResolvedOgMeta): string {
  const safeTitle = escapeHtml(meta.title);
  const safeDesc = escapeHtml(meta.description);
  const safeImg = escapeHtml(meta.imageUrl);
  const safeUrl = escapeHtml(meta.canonicalUrl);

  let result = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${safeTitle}</title>`);

  const replacements: Array<[RegExp, string]> = [
    [/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, `<meta name="description" content="${safeDesc}" />`],
    [/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:title" content="${safeTitle}" />`],
    [/<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:description" content="${safeDesc}" />`],
    [/<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:image" content="${safeImg}" />`],
    [/<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i, `<meta name="twitter:title" content="${safeTitle}" />`],
    [/<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i, `<meta name="twitter:description" content="${safeDesc}" />`],
    [/<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/i, `<meta name="twitter:image" content="${safeImg}" />`],
  ];

  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }

  result = result.replace(
    '</head>',
    `  <meta property="og:url" content="${safeUrl}" />\n  <link rel="canonical" href="${safeUrl}" />\n</head>`
  );

  return result;
}

export default async function handler(req: Request): Promise<Response> {
  const reqUrl = new URL(req.url);
  const indexUrl = new URL('/index.html', reqUrl.origin);

  const [indexResponse, ogMeta] = await Promise.all([
    fetch(indexUrl.toString()),
    resolveRouteOgMeta(reqUrl),
  ]);

  const rawHtml = await indexResponse.text();
  const transformedHtml = injectMetaIntoHtml(rawHtml, ogMeta);

  return new Response(transformedHtml, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
    },
  });
}
