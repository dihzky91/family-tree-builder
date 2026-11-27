import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.91.1';
import { clientIp, corsHeaders, hashClient, jsonResponse } from '../_shared/security.ts';

type Payload = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_TEXT = /^[0-9?\-/. ]{0,32}$/;

function text(body: Payload, key: string, max: number, required = false): string | null {
  const value = body[key];
  if (value == null || value === '') {
    if (required) throw new Error(`missing_${key}`);
    return null;
  }
  if (typeof value !== 'string') throw new Error(`invalid_${key}`);
  const clean = value.trim();
  if ((required && !clean) || clean.length > max) throw new Error(`invalid_${key}`);
  return clean || null;
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === 'OPTIONS') {
    return cors ? new Response(null, { status: 204, headers: cors }) : new Response(null, { status: 403 });
  }
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405, cors);
  if (!cors) return jsonResponse({ error: 'origin_not_allowed' }, 403, null);

  try {
    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > 750_000) return jsonResponse({ error: 'payload_too_large' }, 413, cors);
    const body = await req.json() as Payload;

    const branchId = text(body, 'branchId', 36, true)!;
    if (!UUID.test(branchId)) throw new Error('invalid_branchId');
    const gender = text(body, 'gender', 16, true)!;
    const relation = text(body, 'relationToBranch', 32, true)!;
    if (!['male', 'female', 'unknown'].includes(gender)) throw new Error('invalid_gender');
    if (!['child', 'grandchild', 'great-grandchild', 'other'].includes(relation)) throw new Error('invalid_relation');

    const birthDate = text(body, 'birthDate', 32);
    const deathDate = text(body, 'deathDate', 32);
    if ((birthDate && !DATE_TEXT.test(birthDate)) || (deathDate && !DATE_TEXT.test(deathDate))) {
      throw new Error('invalid_date');
    }
    const email = text(body, 'submitterEmail', 254);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('invalid_email');
    const photoUrl = text(body, 'photoUrl', 550_000);
    if (photoUrl && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photoUrl)) {
      throw new Error('invalid_photo');
    }
    const duplicateId = text(body, 'possibleDuplicateId', 36);
    if (duplicateId && !UUID.test(duplicateId)) throw new Error('invalid_duplicate');

    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) throw new Error('server_not_configured');
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    const { data: branch } = await admin.from('branches').select('id').eq('id', branchId)
      .eq('is_active', true).neq('coordinator_name', '__PUBLIC_SHARE__').maybeSingle();
    if (!branch) return jsonResponse({ error: 'branch_not_found' }, 404, cors);

    const clientHash = await hashClient(clientIp(req));
    const { data: limit, error: limitError } = await admin.rpc('check_public_submission_rate', {
      p_client_hash: clientHash,
      p_branch_id: branchId,
    });
    if (limitError) throw limitError;
    const rate = limit as { allowed?: boolean; retryAfter?: number };
    if (!rate?.allowed) {
      const retry = Math.max(1, Number(rate?.retryAfter) || 3600);
      return jsonResponse({ error: 'rate_limited', retryAfter: retry }, 429, cors, { 'Retry-After': String(retry) });
    }

    const id = crypto.randomUUID();
    const { error } = await admin.from('submissions').insert({
      id,
      branch_id: branchId,
      submitted_by: text(body, 'submittedBy', 120, true)!,
      submitter_email: email,
      full_name: text(body, 'fullName', 160, true)!,
      gender,
      birth_date: birthDate,
      birth_place: text(body, 'birthPlace', 200),
      death_date: deathDate,
      death_place: text(body, 'deathPlace', 200),
      residence: text(body, 'residence', 300),
      photo_url: photoUrl,
      notes: text(body, 'notes', 2000),
      relation_to_branch: relation,
      parent_name: text(body, 'parentName', 160),
      possible_duplicate_id: duplicateId,
      status: 'pending',
    });
    if (error) throw error;
    return jsonResponse({ id, status: 'pending' }, 201, cors);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid_request';
    if (message.startsWith('invalid_') || message.startsWith('missing_')) {
      return jsonResponse({ error: message }, 400, cors);
    }
    console.error('public-submission failed', message);
    return jsonResponse({ error: 'internal_error' }, 500, cors);
  }
});
