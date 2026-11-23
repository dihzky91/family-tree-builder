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
const CLOUD_SHARE_PREFIX = '__PUBLIC_SHARE_V1__:';

interface StoredLocalShare extends ShareLink {
  branchCode?: string | null;
  branchName?: string | null;
  snapshotData: {
    persons: Person[];
    relationships: Relationship[];
  };
}

interface CloudBranchPayload {
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
  snapshotData: {
    persons: Person[];
    relationships: Relationship[];
  };
}

function encodeCloudBranchPayload(payload: CloudBranchPayload): string {
  return `${CLOUD_SHARE_PREFIX}${JSON.stringify(payload)}`;
}

function decodeCloudBranchPayload(raw: string | null | undefined): CloudBranchPayload | null {
  if (!raw || !raw.startsWith(CLOUD_SHARE_PREFIX)) return null;
  try {
    return JSON.parse(raw.slice(CLOUD_SHARE_PREFIX.length)) as CloudBranchPayload;
  } catch {
    return null;
  }
}

function mapBranchRowToShareLink(row: any): ShareLink | null {
  const decoded = decodeCloudBranchPayload(row.description);
  if (!decoded) return null;

  const rawPin = decoded.pinCode ? String(decoded.pinCode).trim() : '';
  const snapshotPersons = Array.isArray(decoded.snapshotData?.persons)
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
    hasPin: rawPin.length > 0,
    pinCode: rawPin || undefined,
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
 * Extract scoped persons & relationships for a share link:
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
      // Keep only birth year (YYYY) if birthDate exists, hide exact day/month and personal notes
      const yearMatch = person.birthDate?.match(/\d{4}/);
      return {
        ...person,
        birthDate: yearMatch ? `${yearMatch[0]}-01-01` : null,
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

function mapDbRowToShareLink(row: any): ShareLink {
  const snapshotPersons = Array.isArray(row.snapshot_data?.persons)
    ? row.snapshot_data.persons.length
    : 0;
  const rawPin = row.pin_code ? String(row.pin_code).trim() : '';

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
      // 1. Try dedicated public_shares table first
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('public_shares')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        return data.map(mapDbRowToShareLink);
      }

      // 2. Fallback: read public share records stored inside the existing `branches` table
      const { data: branchRows, error: branchErr } = await supabase
        .from('branches')
        .select('*')
        .like('description', `${CLOUD_SHARE_PREFIX}%`)
        .order('created_at', { ascending: false });

      if (!branchErr && Array.isArray(branchRows)) {
        const cloudLinks = branchRows
          .map(mapBranchRowToShareLink)
          .filter((item): item is ShareLink => item !== null);
        // Auto-sync any local-only links into cloud so they immediately work in Incognito / other browsers!
        const cloudCodes = new Set(cloudLinks.map((s) => s.code));
        const unsyncedLocal = localShares.filter((l) => !cloudCodes.has(l.code));

        for (const localItem of unsyncedLocal) {
          const fallbackRootId =
            localItem.rootPersonId || localItem.snapshotData?.persons?.[0]?.id;
          if (!fallbackRootId) continue;

          try {
            const encodedDescription = encodeCloudBranchPayload({
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
              const mapped = mapBranchRowToShareLink(syncedRow);
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
      console.warn('Supabase public_shares fallback to localStorage:', err);
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
  hideLivingDetails: boolean;
  isActive?: boolean;
  allPersons: Person[];
  allRelationships: Relationship[];
}

export async function createShareLink(input: CreateOrUpdateShareInput): Promise<ShareLink> {
  const now = new Date().toISOString();
  const cleanCode = input.code.trim().toLowerCase();
  const cleanPin = input.pinCode?.trim() || '';

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
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;

      if (userId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('public_shares')
          .insert([
            {
              user_id: userId,
              code: cleanCode,
              title: input.title.trim(),
              description: input.description?.trim() || null,
              scope_type: input.scopeType,
              branch_id: input.branch?.id || null,
              branch_code: input.branch?.code || null,
              branch_name: input.branch?.name || null,
              root_person_id: effectiveRootId,
              pin_code: cleanPin || null,
              hide_living_details: input.hideLivingDetails,
              is_active: input.isActive ?? true,
              snapshot_data: snapshotData,
            },
          ])
          .select('*')
          .single();

        if (!error && data) {
          // Also mirror to localStorage so instant local preview always works
          mirrorShareToLocal(mapDbRowToShareLink(data), snapshotData, input.branch);
          return mapDbRowToShareLink(data);
        }

        // Fallback to existing `branches` table in Supabase (which already has anon SELECT RLS!)
        const fallbackRootId =
          effectiveRootId ||
          snapshotData.persons[0]?.id ||
          input.allPersons[0]?.id;

        if (fallbackRootId) {
          const encodedDescription = encodeCloudBranchPayload({
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
            const mapped = mapBranchRowToShareLink(branchRow);
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
  const cleanPin = input.pinCode?.trim() || '';

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('public_shares')
        .update({
          code: cleanCode,
          title: input.title.trim(),
          description: input.description?.trim() || null,
          scope_type: input.scopeType,
          branch_id: input.branch?.id || null,
          branch_code: input.branch?.code || null,
          branch_name: input.branch?.name || null,
          root_person_id: effectiveRootId,
          pin_code: cleanPin || null,
          hide_living_details: input.hideLivingDetails,
          ...(input.isActive !== undefined && { is_active: input.isActive }),
          snapshot_data: snapshotData,
          updated_at: now,
        })
        .eq('id', id)
        .select('*')
        .single();

      if (!error && data) {
        const mapped = mapDbRowToShareLink(data);
        mirrorShareToLocal(mapped, snapshotData, input.branch);
        return mapped;
      }

      // Fallback: update or upsert in `branches` table
      const fallbackRootId =
        effectiveRootId ||
        snapshotData.persons[0]?.id ||
        input.allPersons[0]?.id;

      if (fallbackRootId) {
        const encodedDescription = encodeCloudBranchPayload({
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

        // Try updating existing row by id or code
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
          const mapped = mapBranchRowToShareLink(updatedBranch);
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
          const mapped = mapBranchRowToShareLink(insertedBranch);
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
    hasPin: cleanPin.length > 0,
    pinCode: cleanPin || undefined,
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('public_shares')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        await supabase
          .from('branches')
          .update({ is_active: isActive })
          .eq('id', id);
      }
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('public_shares').delete().eq('id', id);
      if (error) {
        await supabase.from('branches').delete().eq('id', id);
      }
    } catch (err) {
      console.warn('Supabase deleteShareLink error:', err);
    }
  }

  const localShares = readLocalShares();
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
 * Public reader: get share metadata by code (checks if it exists and whether a PIN is required)
 */
export async function getPublicShareMeta(code: string): Promise<PublicShareMeta | null> {
  const cleanCode = code.trim().toLowerCase();

  if (isSupabaseConfigured()) {
    try {
      // 1. Try RPC get_public_share_meta
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_public_share_meta', {
        p_code: cleanCode,
      });
      if (!error && data) {
        return data as PublicShareMeta;
      }

      // 2. Fallback: query `branches` table (public anon SELECT is allowed when is_active = true!)
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
            hasPin: Boolean(decoded.pinCode && decoded.pinCode.trim().length > 0),
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
    hasPin: Boolean(local.pinCode && local.pinCode.trim().length > 0),
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
      // 1. Try RPC unlock_public_share
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('unlock_public_share', {
        p_code: cleanCode,
        p_pin: pin?.trim() || null,
      });

      if (!error && data && typeof data === 'object' && 'status' in data) {
        if (data.status === 'ok') {
          return { status: 'ok', payload: data.payload as PublicSharePayload };
        }
        if (data.status === 'invalid_pin') {
          return { status: 'invalid_pin' };
        }
      }

      // 2. Fallback: query `branches` table (public anon SELECT is allowed when is_active = true!)
      const { data: branchRow, error: branchErr } = await supabase
        .from('branches')
        .select('*')
        .eq('code', cleanCode)
        .eq('is_active', true)
        .maybeSingle();

      if (!branchErr && branchRow) {
        const decoded = decodeCloudBranchPayload(branchRow.description);
        if (decoded) {
          const expectedPin = decoded.pinCode?.trim() || '';
          if (expectedPin.length > 0) {
            if (!pin || pin.trim() !== expectedPin) {
              return { status: 'invalid_pin' };
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
              persons: decoded.snapshotData?.persons || [],
              relationships: decoded.snapshotData?.relationships || [],
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
