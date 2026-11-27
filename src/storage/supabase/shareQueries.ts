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
const LOCAL_OWNER_PINS_KEY = 'silsilah-owner-share-pins-v1';
const CLOUD_SHARE_PREFIX = '__PUBLIC_SHARE_V1__:';

interface StoredLocalShare extends ShareLink {
  branchCode?: string | null;
  branchName?: string | null;
  snapshotData: {
    persons: Person[];
    relationships: Relationship[];
  };
}

interface EncryptedSnapshotEnvelope {
  alg: 'AES-GCM-256/PBKDF2-SHA256';
  iter: number;
  salt: string;
  iv: string;
  ct: string;
}

interface CloudBranchPayload {
  title: string;
  description?: string;
  scopeType: ShareScopeType;
  branchId?: string | null;
  branchCode?: string | null;
  branchName?: string | null;
  rootPersonId?: string | null;
  hasPin?: boolean;
  /** Legacy field kept only for reading old records before re-encryption */
  pinCode?: string;
  hideLivingDetails: boolean;
  updatedAt: string;
  personsCount?: number;
  snapshotData?: {
    persons: Person[];
    relationships: Relationship[];
  };
  encryptedSnapshot?: EncryptedSnapshotEnvelope;
}

interface DbBranchShareRow {
  id: string;
  code: string;
  name: string;
  root_person_id: string | null;
  description: string | null;
  is_active: boolean | null;
  submission_count: number | null;
  created_at: string | null;
  updated_at: string | null;
}

interface DbPublicShareRow {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  scope_type?: string | null;
  branch_id?: string | null;
  root_person_id?: string | null;
  pin_code?: string | null;
  hide_living_details?: boolean | null;
  is_active?: boolean | null;
  view_count?: number | null;
  snapshot_data?: {
    persons?: unknown[];
    relationships?: unknown[];
  } | null;
  created_at?: string | null;
  updated_at?: string | null;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function derivePinKey(
  pin: string,
  salt: Uint8Array,
  iterations: number,
  usage: KeyUsage[]
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    usage
  );
}

async function encryptSnapshotWithPin(
  snapshotData: { persons: Person[]; relationships: Relationship[] },
  pin: string
): Promise<EncryptedSnapshotEnvelope> {
  const iter = 100_000;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derivePinKey(pin, salt, iter, ['encrypt']);
  const plaintext = new TextEncoder().encode(JSON.stringify(snapshotData));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    plaintext
  );
  return {
    alg: 'AES-GCM-256/PBKDF2-SHA256',
    iter,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ct: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

async function decryptSnapshotWithPin(
  envelope: EncryptedSnapshotEnvelope,
  pin: string
): Promise<{ persons: Person[]; relationships: Relationship[] } | null> {
  try {
    const salt = base64ToBytes(envelope.salt);
    const iv = base64ToBytes(envelope.iv);
    const ct = base64ToBytes(envelope.ct);
    const key = await derivePinKey(pin, salt, envelope.iter || 100_000, ['decrypt']);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ct as BufferSource
    );
    const json = new TextDecoder().decode(decrypted);
    const parsed = JSON.parse(json) as { persons?: Person[]; relationships?: Relationship[] };
    return {
      persons: Array.isArray(parsed.persons) ? parsed.persons : [],
      relationships: Array.isArray(parsed.relationships) ? parsed.relationships : [],
    };
  } catch {
    return null;
  }
}

function readOwnerPins(): Record<string, string> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LOCAL_OWNER_PINS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveOwnerPin(code: string, pin?: string) {
  if (typeof localStorage === 'undefined') return;
  const pins = readOwnerPins();
  const cleanCode = code.trim().toLowerCase();
  const cleanPin = pin?.trim() || '';
  if (cleanPin) {
    pins[cleanCode] = cleanPin;
  } else {
    delete pins[cleanCode];
  }
  localStorage.setItem(LOCAL_OWNER_PINS_KEY, JSON.stringify(pins));
}

async function buildCloudBranchPayload(params: {
  title: string;
  description?: string;
  scopeType: ShareScopeType;
  branchId?: string | null;
  branchCode?: string | null;
  branchName?: string | null;
  rootPersonId?: string | null;
  pinCode?: string;
  hideLivingDetails: boolean;
  updatedAt: string;
  snapshotData: { persons: Person[]; relationships: Relationship[] };
}): Promise<string> {
  const cleanPin = params.pinCode?.trim() || '';
  const base: CloudBranchPayload = {
    title: params.title,
    description: params.description,
    scopeType: params.scopeType,
    branchId: params.branchId || null,
    branchCode: params.branchCode || null,
    branchName: params.branchName || null,
    rootPersonId: params.rootPersonId || null,
    hasPin: cleanPin.length > 0,
    hideLivingDetails: params.hideLivingDetails,
    updatedAt: params.updatedAt,
    personsCount: params.snapshotData.persons.length,
  };

  if (cleanPin.length > 0 && typeof crypto !== 'undefined' && crypto.subtle) {
    base.encryptedSnapshot = await encryptSnapshotWithPin(params.snapshotData, cleanPin);
  } else {
    base.snapshotData = params.snapshotData;
  }

  return `${CLOUD_SHARE_PREFIX}${JSON.stringify(base)}`;
}

function decodeCloudBranchPayload(raw: string | null | undefined): CloudBranchPayload | null {
  if (!raw || !raw.startsWith(CLOUD_SHARE_PREFIX)) return null;
  try {
    return JSON.parse(raw.slice(CLOUD_SHARE_PREFIX.length)) as CloudBranchPayload;
  } catch {
    return null;
  }
}

function mapBranchRowToShareLink(row: DbBranchShareRow): ShareLink | null {
  const decoded = decodeCloudBranchPayload(row.description);
  if (!decoded) return null;

  const ownerPins = readOwnerPins();
  const legacyPin = decoded.pinCode ? String(decoded.pinCode).trim() : '';
  const cachedOwnerPin = ownerPins[row.code.trim().toLowerCase()] || legacyPin;
  const hasPin = Boolean(decoded.hasPin || decoded.encryptedSnapshot || legacyPin.length > 0);
  const snapshotPersons =
    typeof decoded.personsCount === 'number'
      ? decoded.personsCount
      : Array.isArray(decoded.snapshotData?.persons)
        ? decoded.snapshotData.persons.length
        : 0;

  return {
    id: row.id,
    code: row.code,
    title: decoded.title || row.name,
    description: decoded.description || undefined,
    scopeType: decoded.scopeType || 'full',
    branchId: decoded.branchId || null,
    rootPersonId: decoded.rootPersonId || row.root_person_id || null,
    hasPin,
    pinCode: hasPin && cachedOwnerPin ? cachedOwnerPin : undefined,
    hideLivingDetails: Boolean(decoded.hideLivingDetails),
    isActive: row.is_active ?? true,
    viewCount: row.submission_count ?? 0,
    snapshotPersonsCount: snapshotPersons,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: decoded.updatedAt || row.updated_at || new Date().toISOString(),
  };
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
  | { status: 'ok'; payload: PublicSharePayload };

function readLocalShares(): StoredLocalShare[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_SHARES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalShares(shares: StoredLocalShare[]) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LOCAL_SHARES_KEY, JSON.stringify(shares));
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

function mapDbRowToShareLink(row: DbPublicShareRow): ShareLink {
  const snapshotPersons = Array.isArray(row.snapshot_data?.persons)
    ? row.snapshot_data.persons.length
    : 0;
  const rawPin = row.pin_code ? String(row.pin_code).trim() : '';
  if (rawPin) {
    saveOwnerPin(row.code, rawPin);
  }

  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description || undefined,
    scopeType: (row.scope_type as ShareScopeType) || 'full',
    branchId: row.branch_id || null,
    rootPersonId: row.root_person_id || null,
    hasPin: rawPin.length > 0,
    pinCode: rawPin || undefined,
    hideLivingDetails: Boolean(row.hide_living_details),
    isActive: row.is_active ?? true,
    viewCount: row.view_count ?? 0,
    snapshotPersonsCount: snapshotPersons,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export async function getAllShareLinks(): Promise<ShareLink[]> {
  const localShares = readLocalShares();

  if (isSupabaseConfigured()) {
    try {
      // Read public share records stored inside the existing `branches` table (avoids 404 when public_shares table isn't deployed)
      const { data: branchRows, error: branchErr } = await supabase
        .from('branches')
        .select('*')
        .like('description', `${CLOUD_SHARE_PREFIX}%`)
        .order('created_at', { ascending: false });

      if (!branchErr && Array.isArray(branchRows)) {
        const cloudLinks = branchRows
          .map((row) => mapBranchRowToShareLink(row as DbBranchShareRow))
          .filter((item): item is ShareLink => item !== null);
        // Auto-sync any local-only links into cloud so they immediately work in Incognito / other browsers!
        const cloudCodes = new Set(cloudLinks.map((s) => s.code));
        const unsyncedLocal = localShares.filter((l) => !cloudCodes.has(l.code));

        for (const localItem of unsyncedLocal) {
          const fallbackRootId =
            localItem.rootPersonId || localItem.snapshotData?.persons?.[0]?.id;
          if (!fallbackRootId) continue;

          try {
            const encodedDescription = await buildCloudBranchPayload({
              title: localItem.title,
              description: localItem.description,
              scopeType: localItem.scopeType,
              branchId: localItem.branchId || null,
              branchCode: localItem.branchCode || null,
              branchName: localItem.branchName || null,
              rootPersonId: localItem.rootPersonId || null,
              pinCode: localItem.pinCode,
              hideLivingDetails: localItem.hideLivingDetails,
              updatedAt: localItem.updatedAt,
              snapshotData: localItem.snapshotData || { persons: [], relationships: [] },
            });

            const { data: syncedRow, error: syncErr } = await supabase
              .from('branches')
              .upsert(
                [
                  {
                    id: localItem.id,
                    code: localItem.code,
                    name: localItem.title,
                    root_person_id: fallbackRootId,
                    coordinator_name: '__PUBLIC_SHARE__',
                    description: encodedDescription,
                    is_active: localItem.isActive ?? true,
                  },
                ],
                { onConflict: 'code' }
              )
              .select('*')
              .single();

            if (!syncErr && syncedRow) {
              const mapped = mapBranchRowToShareLink(syncedRow as DbBranchShareRow);
              if (mapped) {
                cloudLinks.push(mapped);
                cloudCodes.add(mapped.code);
              }
            }
          } catch {
            // Keep local item if sync fails
          }
        }

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
  const cleanPin = input.pinCode?.trim() || '';
  saveOwnerPin(cleanCode, cleanPin);

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
      const userId = sessionData?.session?.user?.id || (await supabase.auth.getUser()).data?.user?.id;

      if (userId) {
        // Store in existing `branches` table in Supabase with AES-GCM encryption when PIN is set
        const fallbackRootId =
          effectiveRootId ||
          snapshotData.persons[0]?.id ||
          input.allPersons[0]?.id;

        if (fallbackRootId) {
          const encodedDescription = await buildCloudBranchPayload({
            title: input.title.trim(),
            description: input.description?.trim() || undefined,
            scopeType: input.scopeType,
            branchId: input.branch?.id || null,
            branchCode: input.branch?.code || null,
            branchName: input.branch?.name || null,
            rootPersonId: effectiveRootId,
            pinCode: cleanPin || undefined,
            hideLivingDetails: input.hideLivingDetails,
            updatedAt: now,
            snapshotData,
          });

          const { data: branchRow, error: branchErr } = await supabase
            .from('branches')
            .insert([
              {
                code: cleanCode,
                name: input.title.trim(),
                root_person_id: fallbackRootId,
                coordinator_name: '__PUBLIC_SHARE__',
                description: encodedDescription,
                is_active: input.isActive ?? true,
              },
            ])
            .select('*')
            .single();

          if (!branchErr && branchRow) {
            const mapped = mapBranchRowToShareLink(branchRow as DbBranchShareRow);
            if (mapped) {
              mirrorShareToLocal(mapped, snapshotData, input.branch);
              return mapped;
            }
          }
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

  const created: StoredLocalShare = {
    id: uuidv4(),
    code: cleanCode,
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    scopeType: input.scopeType,
    branchId: input.branch?.id || null,
    branchCode: input.branch?.code || null,
    branchName: input.branch?.name || null,
    rootPersonId: effectiveRootId,
    hasPin: cleanPin.length > 0,
    pinCode: cleanPin || undefined,
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
  const cachedPin = readOwnerPins()[cleanCode] || '';
  const cleanPin =
    input.pinCode && input.pinCode.trim().length > 0
      ? input.pinCode.trim()
      : input.preservePinIfEmpty
        ? cachedPin
        : '';

  if (!input.preservePinIfEmpty || cleanPin) {
    saveOwnerPin(cleanCode, cleanPin);
  }

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
      // Update or upsert in `branches` table
      const fallbackRootId =
        effectiveRootId ||
        snapshotData.persons[0]?.id ||
        input.allPersons[0]?.id;

      if (fallbackRootId) {
        // If preservePinIfEmpty is true and we don't know the PIN on this device, skip overwriting an encrypted cloud branch row
        if (input.preservePinIfEmpty && !cleanPin) {
          const { data: existingBranch } = await supabase
            .from('branches')
            .select('description')
            .eq('id', id)
            .maybeSingle();
          const existingDecoded = decodeCloudBranchPayload(existingBranch?.description);
          if (existingDecoded?.hasPin || existingDecoded?.encryptedSnapshot) {
            throw new Error('Tidak dapat menyinkronkan tautan ber-PIN tanpa kode PIN pada perangkat ini');
          }
        }

        const encodedDescription = await buildCloudBranchPayload({
          title: input.title.trim(),
          description: input.description?.trim() || undefined,
          scopeType: input.scopeType,
          branchId: input.branch?.id || null,
          branchCode: input.branch?.code || null,
          branchName: input.branch?.name || null,
          rootPersonId: effectiveRootId,
          pinCode: cleanPin || undefined,
          hideLivingDetails: input.hideLivingDetails,
          updatedAt: now,
          snapshotData,
        });

        // Try updating existing row by id
        const { data: updatedBranch, error: updErr } = await supabase
          .from('branches')
          .update({
            code: cleanCode,
            name: input.title.trim(),
            root_person_id: fallbackRootId,
            coordinator_name: '__PUBLIC_SHARE__',
            description: encodedDescription,
            ...(input.isActive !== undefined && { is_active: input.isActive }),
          })
          .eq('id', id)
          .select('*')
          .maybeSingle();

        if (!updErr && updatedBranch) {
          const mapped = mapBranchRowToShareLink(updatedBranch as DbBranchShareRow);
          if (mapped) {
            mirrorShareToLocal(mapped, snapshotData, input.branch);
            return mapped;
          }
        }

        // If row wasn't in cloud yet (was previously local-only), insert it into cloud now!
        const { data: insertedBranch, error: insErr } = await supabase
          .from('branches')
          .upsert(
            [
              {
                id,
                code: cleanCode,
                name: input.title.trim(),
                root_person_id: fallbackRootId,
                coordinator_name: '__PUBLIC_SHARE__',
                description: encodedDescription,
                is_active: input.isActive ?? true,
              },
            ],
            { onConflict: 'code' }
          )
          .select('*')
          .single();

        if (!insErr && insertedBranch) {
          const mapped = mapBranchRowToShareLink(insertedBranch as DbBranchShareRow);
          if (mapped) {
            mirrorShareToLocal(mapped, snapshotData, input.branch);
            return mapped;
          }
        }
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

  const finalPin =
    input.preservePinIfEmpty && !cleanPin ? localShares[idx].pinCode || '' : cleanPin;

  const updated: StoredLocalShare = {
    ...localShares[idx],
    code: cleanCode,
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    scopeType: input.scopeType,
    branchId: input.branch?.id || null,
    branchCode: input.branch?.code || null,
    branchName: input.branch?.name || null,
    rootPersonId: effectiveRootId,
    hasPin: finalPin.length > 0,
    pinCode: finalPin || undefined,
    hideLivingDetails: input.hideLivingDetails,
    isActive: input.isActive ?? localShares[idx].isActive,
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
      await supabase
        .from('branches')
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
  const localShares = readLocalShares();
  const target = localShares.find((s) => s.id === id);
  if (target) {
    saveOwnerPin(target.code, '');
  }

  if (isSupabaseConfigured()) {
    try {
      await supabase.from('branches').delete().eq('id', id);
    } catch (err) {
      console.warn('Supabase deleteShareLink error:', err);
    }
  }

  writeLocalShares(localShares.filter((s) => s.id !== id));
}

function mirrorShareToLocal(
  share: ShareLink,
  snapshotData: { persons: Person[]; relationships: Relationship[] },
  branch?: Branch | null
) {
  const localShares = readLocalShares().filter((s) => s.id !== share.id && s.code !== share.code);
  localShares.unshift({
    ...share,
    branchCode: branch?.code || null,
    branchName: branch?.name || null,
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

  // 2. Search Supabase `branches` cloud fallback rows for a share matching this branchId/branchCode, or any active full-tree share
  if (isSupabaseConfigured()) {
    try {
      const { data: rows } = await supabase
        .from('branches')
        .select('*')
        .eq('is_active', true)
        .like('description', `${CLOUD_SHARE_PREFIX}%`)
        .order('created_at', { ascending: false });

      if (Array.isArray(rows) && rows.length > 0) {
        for (const r of rows) {
          const decoded = decodeCloudBranchPayload(r.description);
          if (
            decoded &&
            ((branchId && decoded.branchId === branchId) ||
              decoded.branchCode === cleanBranchCode)
          ) {
            return {
              code: r.code,
              title: decoded.title || r.name,
              scopeType: decoded.scopeType || 'branch',
              hasPin: Boolean(
                decoded.hasPin ||
                  decoded.encryptedSnapshot ||
                  (decoded.pinCode && decoded.pinCode.trim().length > 0)
              ),
            };
          }
        }
        // Fallback to the latest full-tree share if available
        for (const r of rows) {
          const decoded = decodeCloudBranchPayload(r.description);
          if (decoded && decoded.scopeType === 'full') {
            return {
              code: r.code,
              title: decoded.title || r.name,
              scopeType: 'full',
              hasPin: Boolean(
                decoded.hasPin ||
                  decoded.encryptedSnapshot ||
                  (decoded.pinCode && decoded.pinCode.trim().length > 0)
              ),
            };
          }
        }
        // Or first available active share
        const firstDecoded = decodeCloudBranchPayload(rows[0].description);
        if (firstDecoded) {
          return {
            code: rows[0].code,
            title: firstDecoded.title || rows[0].name,
            scopeType: firstDecoded.scopeType || 'full',
            hasPin: Boolean(
              firstDecoded.hasPin ||
                firstDecoded.encryptedSnapshot ||
                (firstDecoded.pinCode && firstDecoded.pinCode.trim().length > 0)
            ),
          };
        }
      }
    } catch {
      // Ignore
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
      hasPin: Boolean(matchedLocal.hasPin || (matchedLocal.pinCode && matchedLocal.pinCode.trim().length > 0)),
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
        pinCode: link.pinCode,
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
      // 1. Query `branches` table first (primary cloud store)
      const { data: branchRow, error: branchErr } = await supabase
        .from('branches')
        .select('*')
        .eq('code', cleanCode)
        .eq('is_active', true)
        .maybeSingle();

      if (!branchErr && branchRow) {
        const decoded = decodeCloudBranchPayload(branchRow.description);
        if (decoded) {
          return {
            id: branchRow.id,
            code: branchRow.code,
            title: decoded.title || branchRow.name,
            description: decoded.description,
            scopeType: decoded.scopeType || 'full',
            branchId: decoded.branchId || null,
            branchCode: decoded.branchCode || null,
            branchName: decoded.branchName || null,
            rootPersonId: decoded.rootPersonId || branchRow.root_person_id,
            hasPin: Boolean(
              decoded.hasPin ||
                decoded.encryptedSnapshot ||
                (decoded.pinCode && decoded.pinCode.trim().length > 0)
            ),
            hideLivingDetails: Boolean(decoded.hideLivingDetails),
            updatedAt: decoded.updatedAt || branchRow.updated_at || new Date().toISOString(),
          };
        }
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
    hasPin: Boolean(local.hasPin || (local.pinCode && local.pinCode.trim().length > 0)),
    hideLivingDetails: local.hideLivingDetails,
    updatedAt: local.updatedAt,
  };
}

/**
 * Public reader: verify PIN (if required) and unlock full snapshot data
 */
export async function unlockPublicShare(
  code: string,
  pin?: string
): Promise<UnlockShareResult> {
  const cleanCode = code.trim().toLowerCase();

  if (isSupabaseConfigured()) {
    try {
      // Query `branches` table (AES-GCM encrypted if PIN-protected)
      const { data: branchRow, error: branchErr } = await supabase
        .from('branches')
        .select('*')
        .eq('code', cleanCode)
        .eq('is_active', true)
        .maybeSingle();

      if (!branchErr && branchRow) {
        const decoded = decodeCloudBranchPayload(branchRow.description);
        if (decoded) {
          let resolvedPersons = decoded.snapshotData?.persons || [];
          let resolvedRelationships = decoded.snapshotData?.relationships || [];

          if (decoded.encryptedSnapshot) {
            if (!pin || !pin.trim()) {
              return { status: 'invalid_pin' };
            }
            const decrypted = await decryptSnapshotWithPin(decoded.encryptedSnapshot, pin.trim());
            if (!decrypted) {
              return { status: 'invalid_pin' };
            }
            resolvedPersons = decrypted.persons;
            resolvedRelationships = decrypted.relationships;
          } else {
            const legacyPin = decoded.pinCode?.trim() || '';
            if (legacyPin.length > 0) {
              if (!pin || pin.trim() !== legacyPin) {
                return { status: 'invalid_pin' };
              }
            }
          }

          return {
            status: 'ok',
            payload: {
              share: {
                id: branchRow.id,
                code: branchRow.code,
                title: decoded.title || branchRow.name,
                description: decoded.description,
                scopeType: decoded.scopeType || 'full',
                branchId: decoded.branchId || null,
                branchCode: decoded.branchCode || null,
                branchName: decoded.branchName || null,
                rootPersonId: decoded.rootPersonId || branchRow.root_person_id,
                hideLivingDetails: Boolean(decoded.hideLivingDetails),
                updatedAt: decoded.updatedAt || branchRow.updated_at || new Date().toISOString(),
              },
              persons: resolvedPersons,
              relationships: resolvedRelationships,
            },
          };
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
  const expectedPin = share.pinCode?.trim() || '';
  if (expectedPin.length > 0) {
    if (!pin || pin.trim() !== expectedPin) {
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
