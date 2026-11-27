const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function corsHeaders(req: Request): Record<string, string> | null {
  const origin = req.headers.get('origin');
  if (!origin) return null;

  const configured = (Deno.env.get('ALLOWED_ORIGINS') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const allowed = configured.includes(origin) || LOCAL_ORIGIN.test(origin);
  if (!allowed) return null;

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

export function jsonResponse(
  body: unknown,
  status: number,
  cors: Record<string, string> | null,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...(cors || {}),
      ...extraHeaders,
    },
  });
}

export function clientIp(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

export async function hashClient(value: string): Promise<string> {
  const secret = Deno.env.get('RATE_LIMIT_SECRET');
  if (!secret) throw new Error('RATE_LIMIT_SECRET is not configured');
  const data = new TextEncoder().encode(`${secret}:${value}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
