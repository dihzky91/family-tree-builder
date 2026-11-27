import { supabase } from '@/integrations/supabase/client';
import { isSupabaseConfigured } from '@/storage';
import type {
  Branch,
  Person,
  PublicSharePayload,
  Relationship,
  ShareLink,
  ShareScopeType,
} from '@/types';
import { v4 as uuidv4 } from 'uuid';

const LOCAL_SHARES_KEY = 'silsilah-public-shares-v1';
const LEGACY_OWNER_PINS_KEY = 'silsilah-owner-share-pins-v1';
const MIN_SHARE_PIN_LENGTH = 8;

interface StoredLocalShare extends Omit<ShareLink, 'pinCode'> {
  branchCode?: string | null;
  branchName?: string | null;
  pinHash?: string | null;
  pinSalt?: string | null;
  snapshotData: {
    persons: Person[];
    relationships: Relationship[];
  };
}

interface DbPublicShareRpcRow {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  scope_type?: string | null;
  branch_id?: string | null;
  branch_code?: string | null;
  branch_name?: string | null;
  root_person_id?: string | null;
  has_pin?: boolean | null;
  hide_living_details?: boolean | null;
  is_active?: boolean | null;
  view_count?: number | null;
  snapshot_persons_count?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PublicShareMeta {
  id: string;
  code: string;
  title: string;
  description?: string;
  scopeType: ShareScopeType;
  branchId?: string | null;
  branchCode?: string | null;
  branchName?: string | null;
  rootPersonId?: string | null;
  hasPin: boolean;
  hideLivingDetails: boolean;
  updatedAt: string;
}

export type UnlockShareResult =
  | { status: 'not_found' }
  | { status: 'invalid_pin' }
  | { status: 'rate_limited'; retryAfter?: number }
  | { status: 'ok'; payload: PublicSharePayload };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpcClient = () => supabase as any;

function purgeLegacyPlaintextOwnerPins(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(LEGACY_OWNER_PINS_KEY);
  } catch {
    // ignore storage errors
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashLocalPin(pin: string, salt?: string): Promise<{ hash: string; salt: string }> {
  const effectiveSalt =
    salt ||
    (typeof crypto !== 'undefined' && crypto.getRandomValues
      ? bytesToHex(crypto.getRandomValues(new Uint8Array(16)))
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoded = new TextEncoder().encode(`${effectiveSalt}:${pin}`);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return {
      hash: bytesToHex(new Uint8Array(digest)),
      salt: effectiveSalt,
    };
  }

  // Deterministic non-plaintext fallback for test environments without WebCrypto subtle
  let acc = 2166136261;
  const input = `${effectiveSalt}:${pin}`;
  for (let i = 0; i < input.length; i++) {
    acc ^= input.charCodeAt(i);
    acc = Math.imul(acc, 16777619);
  }
  return {
    hash: `fnv1a:${(acc >>> 0).toString(16)}`,
    salt: effectiveSalt,
  };
}

async function verifyLocalPin(
  pin: string,
  expectedHash?: string | null,
  salt?: string | null
): Promise<boolean> {
  if (!expectedHash) return true;
  if (!pin || !pin.trim()) return false;
  const computed = await hashLocalPin(pin.trim(), salt || undefined);
  return computed.hash === expectedHash;
}

function validatePinPolicy(pin?: string): string {
  const clean = pin?.trim() || '';
  if (clean.length > 0 && clean.length < MIN_SHARE_PIN_LENGTH) {
    throw new Error(`Kode PIN / passphrase minimal ${MIN_SHARE_PIN_LENGTH} karakter.`);
  }
  return clean;
}

function readLocalShares(): StoredLocalShare[] {
  purgeLegacyPlaintextOwnerPins();
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_SHARES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Strip any legacy plaintext pinCode field on read
    return parsed.map((item: StoredLocalShare & { pinCode?: string }) => {
      const { pinCode: _legacyPin, ...rest } = item;
      return {
        ...rest,
        hasPin: Boolean(rest.hasPin || rest.pinHash),
      };
    });
  } catch {
    return [];
  }
}

function writeLocalShares(shares: StoredLocalShare[]) {
  purgeLegacyPlaintextOwnerPins();
  if (typeof localStorage === 'undefined') return;
  const sanitized = shares.map((s) => {
    const copy = { ...(s as StoredLocalShare & { pinCode?: string }) };
    delete copy.pinCode;
    return copy;
  });
  localStorage.setItem(LOCAL_SHARES_KEY, JSON.stringify(sanitized));
}

function mapRpcRowToShareLink(row: DbPublicShareRpcRow): ShareLink {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description || undefined,
    scopeType: (row.scope_type as ShareScopeType) || 'full',
    branchId: row.branch_id || null,
    rootPersonId: row.root_person_id || null,
    hasPin: Boolean(row.has_pin),
    hideLivingDetails: Boolean(row.hide_living_details),
    isActive: row.is_active ?? true,
    viewCount: row.view_count ?? 0,
    snapshotPersonsCount: row.snapshot_persons_count ?? 0,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

/**
 * Strip street-level address segments (e.g. "Jl. Merdeka No. 10, RT 01/02, Bandung" -> "Bandung")
 * while preserving the city/regency name so GeoMapView city markers still appear!
 */
function sanitizePlaceToCityOnly(rawPlace?: string | null): string | null {
  if (!rawPlace) return null;
  const trimmed = rawPlace.trim();
  if (!trimmed) return null;

  const streetPattern =
    /(?:^|\b)(?:jl\.?(?=\s|$)|jln\.?(?=\s|$)|jalan\b|gg\.?(?=\s|$)|gang\b|no\.?\s*\d+|rt\.?\s*\d+|rw\.?\s*\d+|blok\s+[a-z0-9]+|perum\.?(?=\s|$)|perumahan\b|komp\.?(?=\s|$)|komplek\b|kav\.?(?=\s|$)|apartemen\b|cluster\b|rs\.?\s+\w+|rsud\b|rsia\b|rumah\s+sakit\b)/i;

  const segments = trimmed
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Filter out segments that look like street/house numbers or hospital names
  const citySegments = segments.filter((seg) => !streetPattern.test(seg));

  if (citySegments.length > 0) {
    return citySegments.join(', ');
  }

  // If a single string without commas had street details, hide it; otherwise keep the city name
  return streetPattern.test(trimmed) ? null : trimmed;
}

/**
 * Filter persons and relationships by share scope:
 * - 'full': all persons and relationships
 * - 'branch': the branch's rootPersonId + all descendants + all spouses (and parents of root if needed)
 */
export function computeScopedShareData(
  allPersons: Person[],
  allRelationships: Relationship[],
  options: {
    scopeType: ShareScopeType;
    branch?: Branch | null;
    rootPersonId?: string | null;
    hideLivingDetails?: boolean;
  }
): { persons: Person[]; relationships: Relationship[] } {
  let scopedPersons: Person[] = [];

  const targetRootId =
    options.scopeType === 'branch'
      ? options.branch?.rootPersonId || options.rootPersonId
      : null;

  if (options.scopeType === 'branch' && targetRootId) {
    const includedIds = new Set<string>([targetRootId]);
    const queue: string[] = [targetRootId];

    // Traverse all descendants of branch root
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      for (const rel of allRelationships) {
        if (rel.type === 'PARENT_CHILD' && rel.fromPersonId === currentId) {
          if (!includedIds.has(rel.toPersonId)) {
            includedIds.add(rel.toPersonId);
            queue.push(rel.toPersonId);
          }
        }
      }
    }

    // Include spouses of anyone in the branch (including root's spouse and descendants' spouses)
    const snapshotIds = Array.from(includedIds);
    for (const rel of allRelationships) {
      if (rel.type === 'SPOUSE') {
        if (snapshotIds.includes(rel.fromPersonId)) {
          includedIds.add(rel.toPersonId);
        }
        if (snapshotIds.includes(rel.toPersonId)) {
          includedIds.add(rel.fromPersonId);
        }
      }
    }

    // Also include direct ancestors of targetRootId so Pedigree/Fan/Hourglass views work meaningfully for the branch root
    const ancestorQueue: string[] = [targetRootId];
    while (ancestorQueue.length > 0) {
      const curr = ancestorQueue.shift()!;
      for (const rel of allRelationships) {
        if (rel.type === 'PARENT_CHILD' && rel.toPersonId === curr) {
          if (!includedIds.has(rel.fromPersonId)) {
            includedIds.add(rel.fromPersonId);
            ancestorQueue.push(rel.fromPersonId);
          }
        }
      }
    }

    scopedPersons = allPersons.filter((p) => includedIds.has(p.id));
  } else {
    scopedPersons = [...allPersons];
  }

  // Apply privacy masking for living members if hideLivingDetails is enabled
  const sanitizedPersons = scopedPersons.map((person) => {
    const isLiving = !person.deathDate;
    if (options.hideLivingDetails && isLiving) {
      // Keep only birth year (YYYY) if birthDate exists, keep city/regency only for birthPlace & residence, and hide personal notes
      const yearMatch = person.birthDate?.match(/\d{4}/);
      return {
        ...person,
        birthDate: yearMatch ? yearMatch[0] : null,
        birthPlace: sanitizePlaceToCityOnly(person.birthPlace),
        residence: sanitizePlaceToCityOnly(person.residence),
        notes: null,
      };
    }
    return person;
  });

  const allowedIds = new Set(sanitizedPersons.map((p) => p.id));
  const scopedRelationships = allRelationships.filter(
    (r) => allowedIds.has(r.fromPersonId) && allowedIds.has(r.toPersonId)
  );

  return {
    persons: sanitizedPersons,
    relationships: scopedRelationships,
  };
}

export async function getAllShareLinks(): Promise<ShareLink[]> {
  const localShares = readLocalShares();

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await rpcClient().rpc('list_my_public_shares');
      if (!error && Array.isArray(data)) {
        const cloudLinks = (data as DbPublicShareRpcRow[]).map(mapRpcRowToShareLink);
        const cloudCodes = new Set(cloudLinks.map((s) => s.code));
        const merged = [
          ...cloudLinks,
          ...localShares.filter((l) => !cloudCodes.has(l.code)),
        ];
        return merged.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }
    } catch (err) {
      console.warn('Supabase share links fallback to localStorage:', err);
    }
  }

  return localShares.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export interface CreateOrUpdateShareInput {
  code: string;
  title: string;
  description?: string;
  scopeType: ShareScopeType;
  branch?: Branch | null;
  rootPersonId?: string | null;
  pinCode?: string;
  preservePinIfEmpty?: boolean;
  hideLivingDetails: boolean;
  isActive?: boolean;
  allPersons: Person[];
  allRelationships: Relationship[];
}

export async function createShareLink(input: CreateOrUpdateShareInput): Promise<ShareLink> {
  const now = new Date().toISOString();
  const cleanCode = input.code.trim().toLowerCase();
  const cleanPin = validatePinPolicy(input.pinCode);
  const newId = uuidv4();

  const effectiveRootId =
    input.scopeType === 'branch'
      ? input.branch?.rootPersonId || input.rootPersonId || null
      : input.rootPersonId || null;

  const snapshotData = computeScopedShareData(input.allPersons, input.allRelationships, {
    scopeType: input.scopeType,
    branch: input.branch,
    rootPersonId: effectiveRootId,
    hideLivingDetails: input.hideLivingDetails,
  });

  if (isSupabaseConfigured()) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId =
        sessionData?.session?.user?.id || (await supabase.auth.getUser()).data?.user?.id;

      if (userId) {
        const { data: rpcRow, error: rpcErr } = await rpcClient().rpc('save_public_share', {
          p_id: newId,
          p_code: cleanCode,
          p_title: input.title.trim(),
          p_description: input.description?.trim() || null,
          p_scope_type: input.scopeType,
          p_branch_id: input.branch?.id || null,
          p_branch_code: input.branch?.code || null,
          p_branch_name: input.branch?.name || null,
          p_root_person_id: effectiveRootId,
          p_pin: cleanPin || null,
          p_preserve_pin: false,
          p_hide_living_details: input.hideLivingDetails,
          p_is_active: input.isActive ?? true,
          p_snapshot_data: snapshotData,
        });

        if (!rpcErr && rpcRow) {
          const mapped = mapRpcRowToShareLink(rpcRow as DbPublicShareRpcRow);
          await mirrorShareToLocal(mapped, snapshotData, input.branch, cleanPin);
          return mapped;
        }
      }
    } catch (err) {
      console.warn('Supabase createShareLink fallback to local:', err);
    }
  }

  // Local fallback
  const localShares = readLocalShares();
  if (localShares.some((s) => s.code === cleanCode)) {
    throw new Error(`Kode tautan "${cleanCode}" sudah digunakan. Pilih kode lain.`);
  }

  const hashed = cleanPin ? await hashLocalPin(cleanPin) : null;

  const created: StoredLocalShare = {
    id: newId,
    code: cleanCode,
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    scopeType: input.scopeType,
    branchId: input.branch?.id || null,
    branchCode: input.branch?.code || null,
    branchName: input.branch?.name || null,
    rootPersonId: effectiveRootId,
    hasPin: Boolean(hashed),
    pinHash: hashed?.hash || null,
    pinSalt: hashed?.salt || null,
    hideLivingDetails: input.hideLivingDetails,
    isActive: input.isActive ?? true,
    viewCount: 0,
    snapshotPersonsCount: snapshotData.persons.length,
    createdAt: now,
    updatedAt: now,
    snapshotData,
  };

  writeLocalShares([created, ...localShares]);
  return created;
}

export async function updateShareLink(
  id: string,
  input: CreateOrUpdateShareInput
): Promise<ShareLink> {
  const now = new Date().toISOString();
  const cleanCode = input.code.trim().toLowerCase();
  const cleanPin = validatePinPolicy(input.pinCode);

  const effectiveRootId =
    input.scopeType === 'branch'
      ? input.branch?.rootPersonId || input.rootPersonId || null
      : input.rootPersonId || null;

  const snapshotData = computeScopedShareData(input.allPersons, input.allRelationships, {
    scopeType: input.scopeType,
    branch: input.branch,
    rootPersonId: effectiveRootId,
    hideLivingDetails: input.hideLivingDetails,
  });

  if (isSupabaseConfigured()) {
    try {
      const { data: rpcRow, error: rpcErr } = await rpcClient().rpc('save_public_share', {
        p_id: id,
        p_code: cleanCode,
        p_title: input.title.trim(),
        p_description: input.description?.trim() || null,
        p_scope_type: input.scopeType,
        p_branch_id: input.branch?.id || null,
        p_branch_code: input.branch?.code || null,
        p_branch_name: input.branch?.name || null,
        p_root_person_id: effectiveRootId,
        p_pin: cleanPin || null,
        p_preserve_pin: Boolean(input.preservePinIfEmpty),
        p_hide_living_details: input.hideLivingDetails,
        p_is_active: input.isActive ?? true,
        p_snapshot_data: snapshotData,
      });

      if (!rpcErr && rpcRow) {
        const mapped = mapRpcRowToShareLink(rpcRow as DbPublicShareRpcRow);
        await mirrorShareToLocal(
          mapped,
          snapshotData,
          input.branch,
          cleanPin,
          input.preservePinIfEmpty
        );
        return mapped;
      }
    } catch (err) {
      console.warn('Supabase updateShareLink fallback to local:', err);
    }
  }

  const localShares = readLocalShares();
  const idx = localShares.findIndex((s) => s.id === id);
  if (idx === -1) {
    throw new Error('Tautan berbagi tidak ditemukan');
  }

  const existing = localShares[idx];
  const hashed = cleanPin
    ? await hashLocalPin(cleanPin)
    : input.preservePinIfEmpty && existing.pinHash
      ? { hash: existing.pinHash, salt: existing.pinSalt || '' }
      : null;

  const updated: StoredLocalShare = {
    ...existing,
    code: cleanCode,
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    scopeType: input.scopeType,
    branchId: input.branch?.id || null,
    branchCode: input.branch?.code || null,
    branchName: input.branch?.name || null,
    rootPersonId: effectiveRootId,
    hasPin: Boolean(hashed),
    pinHash: hashed?.hash || null,
    pinSalt: hashed?.salt || null,
    hideLivingDetails: input.hideLivingDetails,
    isActive: input.isActive ?? existing.isActive,
    snapshotPersonsCount: snapshotData.persons.length,
    updatedAt: now,
    snapshotData,
  };

  localShares[idx] = updated;
  writeLocalShares(localShares);
  return updated;
}

export async function toggleShareLinkActive(id: string, isActive: boolean): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      await rpcClient()
        .from('public_shares')
        .update({ is_active: isActive })
        .eq('id', id);
    } catch (err) {
      console.warn('Supabase toggleShareLinkActive error:', err);
    }
  }

  const localShares = readLocalShares();
  const next = localShares.map((s) =>
    s.id === id ? { ...s, isActive, updatedAt: new Date().toISOString() } : s
  );
  writeLocalShares(next);
}

export async function deleteShareLink(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      await rpcClient().from('public_shares').delete().eq('id', id);
    } catch (err) {
      console.warn('Supabase deleteShareLink error:', err);
    }
  }

  const localShares = readLocalShares();
  writeLocalShares(localShares.filter((s) => s.id !== id));
}

async function mirrorShareToLocal(
  share: ShareLink,
  snapshotData: { persons: Person[]; relationships: Relationship[] },
  branch?: Branch | null,
  rawPin?: string,
  preservePin?: boolean
) {
  const existingAll = readLocalShares();
  const prev = existingAll.find((s) => s.id === share.id || s.code === share.code);
  const hashed = rawPin
    ? await hashLocalPin(rawPin)
    : preservePin && prev?.pinHash
      ? { hash: prev.pinHash, salt: prev.pinSalt || '' }
      : null;

  const localShares = existingAll.filter((s) => s.id !== share.id && s.code !== share.code);
  localShares.unshift({
    ...share,
    hasPin: Boolean(share.hasPin || hashed),
    pinHash: hashed?.hash || null,
    pinSalt: hashed?.salt || null,
    branchCode: branch?.code || prev?.branchCode || null,
    branchName: branch?.name || prev?.branchName || null,
    snapshotData,
  });
  writeLocalShares(localShares);
}

/**
 * Public reader: find an active public share code associated with a branch (or any full-tree share fallback)
 * so that family members filling out `/submit/:branchCode` can immediately jump to `/view/:shareCode`!
 */
export async function findPublicShareForBranch(
  branchCode: string,
  branchId?: string
): Promise<{ code: string; title: string; scopeType: ShareScopeType; hasPin: boolean } | null> {
  const cleanBranchCode = branchCode.trim().toLowerCase();
  const expectedShareCode = `pohon-${cleanBranchCode}`;

  // 1. Direct check for `pohon-<branchCode>` via getPublicShareMeta
  const directMeta = await getPublicShareMeta(expectedShareCode);
  if (directMeta) {
    return {
      code: directMeta.code,
      title: directMeta.title,
      scopeType: directMeta.scopeType,
      hasPin: directMeta.hasPin,
    };
  }

  // 2. Query dedicated `find_public_share_for_branch` RPC on `public_shares`
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await rpcClient().rpc('find_public_share_for_branch', {
        p_branch_code: cleanBranchCode,
        p_branch_id: branchId || null,
      });

      if (!error && data && typeof data === 'object' && !Array.isArray(data) && data.code) {
        return {
          code: String(data.code),
          title: String(data.title || 'Pohon Silsilah Keluarga'),
          scopeType: (data.scopeType as ShareScopeType) || 'full',
          hasPin: Boolean(data.hasPin),
        };
      }
    } catch {
      // Fall through to local shares
    }
  }

  // 3. Local shares fallback
  const localActives = readLocalShares().filter((s) => s.isActive);
  const matchedLocal =
    localActives.find(
      (s) => (branchId && s.branchId === branchId) || s.branchCode === cleanBranchCode
    ) ||
    localActives.find((s) => s.scopeType === 'full') ||
    localActives[0];

  if (matchedLocal) {
    return {
      code: matchedLocal.code,
      title: matchedLocal.title,
      scopeType: matchedLocal.scopeType,
      hasPin: Boolean(matchedLocal.hasPin || matchedLocal.pinHash),
    };
  }

  return null;
}

/**
 * Automatically refresh all active public share snapshots whenever the owner approves submissions
 * so that `/view/...` immediately reflects newly approved family members!
 */
export async function syncAllActiveShareSnapshots(
  allPersons: Person[],
  allRelationships: Relationship[],
  branches: Branch[] = []
): Promise<void> {
  if (allPersons.length === 0) return;
  try {
    const links = await getAllShareLinks();
    for (const link of links) {
      if (!link.isActive) continue;
      const branch = link.branchId
        ? branches.find((b) => b.id === link.branchId) || null
        : null;
      await updateShareLink(link.id, {
        code: link.code,
        title: link.title,
        description: link.description,
        scopeType: link.scopeType,
        branch,
        rootPersonId: link.rootPersonId,
        preservePinIfEmpty: link.hasPin,
        hideLivingDetails: link.hideLivingDetails,
        isActive: link.isActive,
        allPersons,
        allRelationships,
      });
    }
  } catch (err) {
    console.warn('Auto-sync public shares failed:', err);
  }
}

/**
 * Public reader: get share metadata by code (checks if it exists and whether a PIN is required)
 */
export async function getPublicShareMeta(code: string): Promise<PublicShareMeta | null> {
  const cleanCode = code.trim().toLowerCase();

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await rpcClient().rpc('get_public_share_meta', {
        p_code: cleanCode,
      });

      if (!error && data && typeof data === 'object' && !Array.isArray(data) && data.code) {
        return {
          id: String(data.id),
          code: String(data.code),
          title: String(data.title),
          description: data.description ? String(data.description) : undefined,
          scopeType: (data.scopeType as ShareScopeType) || 'full',
          branchId: data.branchId ? String(data.branchId) : null,
          branchCode: data.branchCode ? String(data.branchCode) : null,
          branchName: data.branchName ? String(data.branchName) : null,
          rootPersonId: data.rootPersonId ? String(data.rootPersonId) : null,
          hasPin: Boolean(data.hasPin),
          hideLivingDetails: Boolean(data.hideLivingDetails),
          updatedAt: data.updatedAt ? String(data.updatedAt) : new Date().toISOString(),
        };
      }
    } catch {
      // Fall through to local lookup
    }
  }

  const local = readLocalShares().find((s) => s.code === cleanCode && s.isActive);
  if (!local) return null;

  return {
    id: local.id,
    code: local.code,
    title: local.title,
    description: local.description,
    scopeType: local.scopeType,
    branchId: local.branchId,
    branchCode: local.branchCode,
    branchName: local.branchName,
    rootPersonId: local.rootPersonId,
    hasPin: Boolean(local.hasPin || local.pinHash),
    hideLivingDetails: local.hideLivingDetails,
    updatedAt: local.updatedAt,
  };
}

/**
 * Public reader: verify PIN (if required) via rate-limited Edge Function and unlock full snapshot data
 */
export async function unlockPublicShare(
  code: string,
  pin?: string
): Promise<UnlockShareResult> {
  const cleanCode = code.trim().toLowerCase();
  const cleanPin = pin?.trim() || '';

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.functions.invoke('public-share-unlock', {
        body: {
          code: cleanCode,
          pin: cleanPin || undefined,
        },
      });

      if (!error && data && typeof data === 'object') {
        const result = data as {
          status?: string;
          retryAfter?: number;
          payload?: PublicSharePayload;
        };

        if (result.status === 'ok' && result.payload) {
          return { status: 'ok', payload: result.payload };
        }
        if (result.status === 'invalid_pin') {
          return { status: 'invalid_pin' };
        }
        if (result.status === 'rate_limited') {
          return { status: 'rate_limited', retryAfter: result.retryAfter };
        }
      }
    } catch {
      // Fall through to local lookup
    }
  }

  const localShares = readLocalShares();
  const idx = localShares.findIndex((s) => s.code === cleanCode && s.isActive);
  if (idx === -1) {
    return { status: 'not_found' };
  }

  const share = localShares[idx];
  if (share.hasPin || share.pinHash) {
    const valid = await verifyLocalPin(cleanPin, share.pinHash, share.pinSalt);
    if (!valid) {
      return { status: 'invalid_pin' };
    }
  }

  // Increment view count locally
  localShares[idx] = {
    ...share,
    viewCount: (share.viewCount || 0) + 1,
  };
  writeLocalShares(localShares);

  return {
    status: 'ok',
    payload: {
      share: {
        id: share.id,
        code: share.code,
        title: share.title,
        description: share.description,
        scopeType: share.scopeType,
        branchId: share.branchId,
        branchCode: share.branchCode,
        branchName: share.branchName,
        rootPersonId: share.rootPersonId,
        hideLivingDetails: share.hideLivingDetails,
        updatedAt: share.updatedAt,
      },
      persons: share.snapshotData?.persons || [],
      relationships: share.snapshotData?.relationships || [],
    },
  };
}
