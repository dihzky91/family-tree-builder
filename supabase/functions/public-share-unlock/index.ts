import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.91.1';
import { clientIp, corsHeaders, hashClient, jsonResponse } from '../_shared/security.ts';

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') {
    return cors ? new Response(null, { status: 204, headers: cors }) : new Response(null, { status: 403 });
  }
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405, cors);
  if (!cors) return jsonResponse({ error: 'origin_not_allowed' }, 403, null);

  try {
    const body = await req.json() as { code?: unknown; pin?: unknown };
    const code = typeof body.code === 'string' ? body.code.trim().toLowerCase() : '';
    const pin = typeof body.pin === 'string' ? body.pin.trim() : '';
    if (!/^[a-z0-9-]{4,64}$/.test(code) || pin.length > 128) {
      return jsonResponse({ error: 'invalid_request' }, 400, cors);
    }

    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) throw new Error('Supabase server credentials are not configured');

    const clientHash = await hashClient(clientIp(req));
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data, error } = await admin.rpc('unlock_public_share_internal', {
      p_code: code,
      p_pin: pin || null,
      p_client_hash: clientHash,
    });
    if (error) throw error;

    const result = data as { status?: string; retryAfter?: number } | null;
    if (result?.status === 'rate_limited') {
      const retry = Math.max(1, Number(result.retryAfter) || 900);
      return jsonResponse(result, 429, cors, { 'Retry-After': String(retry) });
    }
    return jsonResponse(result || { status: 'not_found' }, 200, cors);
  } catch (error) {
    console.error('public-share-unlock failed', error instanceof Error ? error.message : error);
    return jsonResponse({ error: 'internal_error' }, 500, cors);
  }
});
