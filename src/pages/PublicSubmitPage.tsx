import { useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FlexibleDateInput } from '@/components/ui/flexible-date-input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApprovedMembersCard } from '@/components/submission/ApprovedMembersCard';
import { getBranchByCode } from '@/storage/supabase/branchQueries';
import { getApprovedMembersByBranch, createSubmission } from '@/storage/supabase/submissionQueries';
import { findPublicShareForBranch, unlockPublicShare } from '@/storage/supabase/shareQueries';
import { useFamilyStore } from '@/store/familyStore';
import type { Branch, ApprovedMemberInfo, RelationToBranch, Person, Relationship } from '@/types';
import {
  CheckCircle,
  AlertCircle,
  Loader2,
  Users,
  Heart,
  Baby,
  GitBranch,
  UserPlus,
  Info,
  Trash2,
  ChevronDown,
  ChevronUp,
  Plus,
  Send,
  Camera,
  X,
  TreePine,
  Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type PublicRelationChoice = 'child' | 'sibling' | 'grandchild' | 'great-grandchild' | 'spouse';

interface MemberEntry {
  localId: string;
  fullName: string;
  gender: 'male' | 'female';
  birthDate: string;
  birthPlace: string;
  residence: string;
  isDeceased: boolean;
  deathDate: string;
  deathPlace: string;
  notes: string;
  relationChoice: PublicRelationChoice;
  connectorName: string;
  photoUrl?: string;
  isSelf?: boolean;
  isUpdate?: boolean;
  targetPersonId?: string;
}

async function compressPhotoToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('File bukan gambar yang valid'));
      img.onload = () => {
        const MAX_SIZE = 360;
        let { width, height } = img;
        if (width > height && width > MAX_SIZE) {
          height = Math.round((height * MAX_SIZE) / width);
          width = MAX_SIZE;
        } else if (height > MAX_SIZE) {
          width = Math.round((width * MAX_SIZE) / height);
          height = MAX_SIZE;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas tidak tersedia'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function createEmptyEntry(
  relationChoice: PublicRelationChoice = 'child',
  connectorName = ''
): MemberEntry {
  return {
    localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fullName: '',
    gender: 'male',
    birthDate: '',
    birthPlace: '',
    residence: '',
    isDeceased: false,
    deathDate: '',
    deathPlace: '',
    notes: '',
    relationChoice,
    connectorName,
  };
}

const RELATION_LABELS: Record<PublicRelationChoice, string> = {
  child: 'Anak langsung',
  sibling: 'Kakak / Adik Kandung',
  grandchild: 'Cucu / Keponakan',
  'great-grandchild': 'Cicit / Garis Jauh',
  spouse: 'Pasangan / Menantu',
};

/**
 * Topologically order entries so parents/partners referenced within the same batch
 * are submitted BEFORE their children/spouses.
 */
function sortEntriesForSubmission(entries: MemberEntry[]): MemberEntry[] {
  const rank: Record<PublicRelationChoice, number> = {
    sibling: 0,
    child: 1,
    grandchild: 2,
    'great-grandchild': 3,
    spouse: 4,
  };

  const remaining = [...entries].sort((a, b) => rank[a.relationChoice] - rank[b.relationChoice]);
  const ordered: MemberEntry[] = [];
  const addedNames = new Set<string>();

  let safety = remaining.length * remaining.length + 10;
  while (remaining.length > 0 && safety > 0) {
    safety--;
    const idx = remaining.findIndex((entry) => {
      const ref = entry.connectorName.trim().toLowerCase();
      if (!ref) return true;
      // Check if referenced person is still waiting in remaining
      const stillWaiting = remaining.some(
        (other) => other.localId !== entry.localId && other.fullName.trim().toLowerCase() === ref
      );
      return !stillWaiting || addedNames.has(ref);
    });

    const pickIdx = idx >= 0 ? idx : 0;
    const [picked] = remaining.splice(pickIdx, 1);
    ordered.push(picked);
    addedNames.add(picked.fullName.trim().toLowerCase());
  }

  return [...ordered, ...remaining];
}

/**
 * Extract ONLY the members that belong to a specific branch's lineage subtree:
 * - The branch's rootPersonId (Kepala Cabang)
 * - All direct descendants of rootPersonId (children, grandchildren, great-grandchildren)
 * - Spouses of rootPersonId or any of those descendants
 * Excludes all other branches and ancestors from a full-tree snapshot.
 */
function extractBranchMembersFromTree(
  rootPersonId: string,
  persons: Person[],
  relationships: Relationship[]
): ApprovedMemberInfo[] {
  if (!rootPersonId || persons.length === 0) return [];

  const personById = new Map<string, Person>();
  for (const p of persons) {
    personById.set(p.id, p);
  }

  if (!personById.has(rootPersonId)) return [];

  // BFS traversal down PARENT_CHILD edges starting from rootPersonId
  const depthMap = new Map<string, number>([[rootPersonId, 0]]);
  const parentNameMap = new Map<string, string>();
  const queue: string[] = [rootPersonId];

  while (queue.length > 0) {
    const currId = queue.shift()!;
    const currDepth = depthMap.get(currId)!;
    const currPerson = personById.get(currId);

    for (const rel of relationships) {
      if (rel.type === 'PARENT_CHILD' && rel.fromPersonId === currId) {
        const childId = rel.toPersonId;
        if (!depthMap.has(childId) && personById.has(childId)) {
          depthMap.set(childId, currDepth + 1);
          if (currPerson) {
            parentNameMap.set(childId, currPerson.fullName);
          }
          queue.push(childId);
        }
      }
    }
  }

  // Include spouses of rootPersonId and any descendant in this branch
  const spousePartnerMap = new Map<string, string>();
  for (const rel of relationships) {
    if (rel.type === 'SPOUSE') {
      if (
        depthMap.has(rel.fromPersonId) &&
        !depthMap.has(rel.toPersonId) &&
        personById.has(rel.toPersonId)
      ) {
        const partner = personById.get(rel.fromPersonId)!;
        spousePartnerMap.set(rel.toPersonId, partner.fullName);
      } else if (
        depthMap.has(rel.toPersonId) &&
        !depthMap.has(rel.fromPersonId) &&
        personById.has(rel.fromPersonId)
      ) {
        const partner = personById.get(rel.toPersonId)!;
        spousePartnerMap.set(rel.fromPersonId, partner.fullName);
      }
    }
  }

  const result: ApprovedMemberInfo[] = [];

  for (const [personId, depth] of depthMap.entries()) {
    const p = personById.get(personId)!;
    if (p.tags?.includes('auto-placeholder-parent')) continue;

    let relationToBranch: RelationToBranch = 'child';
    let parentName: string | undefined = parentNameMap.get(personId);

    if (depth === 0) {
      relationToBranch = 'other';
      parentName = 'Kepala Cabang';
    } else if (depth === 1) {
      relationToBranch = 'child';
    } else if (depth === 2) {
      relationToBranch = 'grandchild';
    } else {
      relationToBranch = 'great-grandchild';
    }

    result.push({
      fullName: p.fullName,
      relationToBranch,
      parentName,
      createdPersonId: p.id,
      gender: p.gender,
      hasBirthDate: Boolean(p.birthDate),
    });
  }

  for (const [spouseId, partnerName] of spousePartnerMap.entries()) {
    const p = personById.get(spouseId)!;
    if (p.tags?.includes('auto-placeholder-parent')) continue;

    result.push({
      fullName: p.fullName,
      relationToBranch: 'other',
      parentName: `Pasangan dari ${partnerName}`,
      createdPersonId: p.id,
      gender: p.gender,
      hasBirthDate: Boolean(p.birthDate),
    });
  }

  return result;
}

export default function PublicSubmitPage() {
  const { branchCode } = useParams<{ branchCode: string }>();
  const {
    findDuplicates,
    persons: storePersons,
    relationships: storeRelationships,
  } = useFamilyStore();

  const [branch, setBranch] = useState<Branch | null>(null);
  const [approvedMembers, setApprovedMembers] = useState<ApprovedMemberInfo[]>([]);
  const [publicShareInfo, setPublicShareInfo] = useState<{
    code: string;
    title: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Submitter info (filled once)
  const [submittedBy, setSubmittedBy] = useState('');
  const [submitterEmail, setSubmitterEmail] = useState('');

  // Batch entries
  const [entries, setEntries] = useState<MemberEntry[]>(() => [createEmptyEntry('child')]);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState({ current: 0, total: 0 });
  const [submittedSummary, setSubmittedSummary] = useState<
    Array<{ fullName: string; role: string; connector?: string }>
  >([]);

  // Ensure first entry starts expanded
  useEffect(() => {
    if (entries.length > 0 && Object.keys(expandedIds).length === 0) {
      setExpandedIds({ [entries[0].localId]: true });
    }
  }, [entries, expandedIds]);

  // Keep entry[0].fullName synced if marked as self
  useEffect(() => {
    setEntries((prev) =>
      prev.map((e) => (e.isSelf ? { ...e, fullName: submittedBy } : e))
    );
  }, [submittedBy]);

  useEffect(() => {
    async function loadData() {
      if (!branchCode) return;
      try {
        setIsLoading(true);
        setError(null);

        const branchData = await getBranchByCode(branchCode);
        if (!branchData) {
          setError('Cabang keluarga tidak ditemukan atau tidak aktif');
          return;
        }
        setBranch(branchData);

        const [members, shareLink] = await Promise.all([
          getApprovedMembersByBranch(branchData.id),
          findPublicShareForBranch(branchCode, branchData.id).catch(() => null),
        ]);

        // Only merge members from public share snapshot or in-memory store that actually belong
        // to THIS branch's subtree (rootPersonId + descendants + spouses), never the whole tree!
        const mergedByName = new Map<string, ApprovedMemberInfo>();
        for (const m of members) {
          mergedByName.set(m.fullName.trim().toLowerCase(), m);
        }

        const mergeScopedMembers = (scopedList: ApprovedMemberInfo[]) => {
          for (const scoped of scopedList) {
            const key = scoped.fullName.trim().toLowerCase();
            const existing = mergedByName.get(key);
            mergedByName.set(key, {
              fullName: scoped.fullName,
              relationToBranch:
                scoped.parentName === 'Kepala Cabang'
                  ? 'other'
                  : existing?.relationToBranch || scoped.relationToBranch,
              parentName:
                scoped.parentName === 'Kepala Cabang'
                  ? 'Kepala Cabang'
                  : existing?.parentName || scoped.parentName,
              createdPersonId: scoped.createdPersonId || existing?.createdPersonId,
              gender: scoped.gender || existing?.gender,
              hasBirthDate: Boolean(scoped.hasBirthDate) || Boolean(existing?.hasBirthDate),
            });
          }
        };

        if (shareLink) {
          const unlocked = await unlockPublicShare(shareLink.code).catch(() => null);
          if (unlocked && unlocked.status === 'ok') {
            const branchMembersFromShare = extractBranchMembersFromTree(
              branchData.rootPersonId,
              unlocked.payload.persons,
              unlocked.payload.relationships
            );
            mergeScopedMembers(branchMembersFromShare);

            // Also enrich any already-approved submission entries with birthDate/gender from snapshot
            for (const p of unlocked.payload.persons) {
              const key = p.fullName.trim().toLowerCase();
              if (mergedByName.has(key)) {
                const existing = mergedByName.get(key)!;
                mergedByName.set(key, {
                  ...existing,
                  createdPersonId: p.id,
                  gender: p.gender,
                  hasBirthDate: Boolean(p.birthDate) || Boolean(existing.hasBirthDate),
                });
              }
            }
          }
        }

        if (storePersons.length > 0) {
          const branchMembersFromStore = extractBranchMembersFromTree(
            branchData.rootPersonId,
            storePersons,
            storeRelationships
          );
          mergeScopedMembers(branchMembersFromStore);

          for (const p of storePersons) {
            const key = p.fullName.trim().toLowerCase();
            if (mergedByName.has(key)) {
              const existing = mergedByName.get(key)!;
              mergedByName.set(key, {
                ...existing,
                createdPersonId: p.id,
                gender: p.gender,
                hasBirthDate: Boolean(p.birthDate) || Boolean(existing.hasBirthDate),
              });
            }
          }
        }

        setApprovedMembers(Array.from(mergedByName.values()));
        setPublicShareInfo(shareLink);
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Gagal memuat data cabang');
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [branchCode]);

  const updateEntry = (localId: string, patch: Partial<MemberEntry>) => {
    setEntries((prev) => prev.map((e) => (e.localId === localId ? { ...e, ...patch } : e)));
  };

  const addNewEntry = (presetRelation: PublicRelationChoice, defaultConnector?: string) => {
    const lastNamed = [...entries].reverse().find((e) => e.fullName.trim().length > 0);
    const connector =
      presetRelation === 'child'
        ? ''
        : defaultConnector !== undefined
          ? defaultConnector
          : lastNamed?.fullName.trim() || '';

    const next = createEmptyEntry(presetRelation, connector);
    setEntries((prev) => [...prev, next]);
    // Collapse older completed cards so the new card stays focused & uncluttered
    setExpandedIds({ [next.localId]: true });
    setTimeout(() => {
      document.getElementById(`member-card-${next.localId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 80);
  };

  const removeEntry = (localId: string) => {
    setEntries((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((e) => e.localId !== localId);
    });
  };

  const toggleExpand = (localId: string) => {
    setExpandedIds((prev) => ({ ...prev, [localId]: !prev[localId] }));
  };

  const handlePickApprovedMember = (memberName: string) => {
    // Fill into the currently expanded card (or last card) as connector parent/spouse
    const target =
      entries.find((e) => expandedIds[e.localId]) || entries[entries.length - 1];
    if (!target) return;
    const pickedMember = approvedMembers.find(
      (m) => m.fullName.trim().toLowerCase() === memberName.trim().toLowerCase()
    );
    const isBranchHead = pickedMember?.parentName === 'Kepala Cabang';
    updateEntry(target.localId, {
      isUpdate: false,
      targetPersonId: undefined,
      relationChoice: isBranchHead
        ? 'child'
        : target.relationChoice === 'child'
          ? 'grandchild'
          : target.relationChoice,
      connectorName: isBranchHead ? '' : memberName,
    });
    setExpandedIds((prev) => ({ ...prev, [target.localId]: true }));
    document.getElementById(`member-card-${target.localId}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  };

  const handlePickUpdateMember = (member: ApprovedMemberInfo) => {
    // Reuse currently expanded card if it has no name yet, otherwise add a new card
    const currentExpanded = entries.find((e) => expandedIds[e.localId]);
    const targetId =
      currentExpanded && !currentExpanded.fullName.trim()
        ? currentExpanded.localId
        : null;

    // Privacy-safe: only pre-fill name & gender, never expose existing dates, places, or residences
    const patch: Partial<MemberEntry> = {
      isUpdate: true,
      targetPersonId: member.createdPersonId,
      fullName: member.fullName,
      gender: member.gender === 'female' ? 'female' : 'male',
      relationChoice:
        member.relationToBranch === 'other' ? 'spouse' : member.relationToBranch,
      connectorName: member.parentName || '',
    };

    if (targetId) {
      updateEntry(targetId, patch);
      setExpandedIds({ [targetId]: true });
      setTimeout(() => {
        document.getElementById(`member-card-${targetId}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 60);
    } else {
      const next: MemberEntry = {
        ...createEmptyEntry('child'),
        ...patch,
      };
      setEntries((prev) => [...prev, next]);
      setExpandedIds({ [next.localId]: true });
      setTimeout(() => {
        document.getElementById(`member-card-${next.localId}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 80);
    }
  };

  const handleSubmitAll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branch) return;
    setError(null);

    if (!submittedBy.trim()) {
      setError('Mohon isi Nama Anda pada bagian Identitas Pengisi.');
      return;
    }

    if (
      submitterEmail.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submitterEmail.trim())
    ) {
      setError('Format email pengisi tidak valid.');
      return;
    }

    // Validate every entry
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry.fullName.trim()) {
        setError(`Anggota #${i + 1}: Nama lengkap wajib diisi.`);
        setExpandedIds((prev) => ({ ...prev, [entry.localId]: true }));
        document.getElementById(`member-card-${entry.localId}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
        return;
      }
      if (
        !entry.isUpdate &&
        entry.relationChoice !== 'child' &&
        entry.relationChoice !== 'sibling' &&
        !entry.connectorName.trim()
      ) {
        setError(
          `Anggota #${i + 1} (${entry.fullName}): Mohon isi nama ${
            entry.relationChoice === 'spouse' ? 'suami/istri' : 'ayah atau ibu kandung'
          } yang terhubung.`
        );
        setExpandedIds((prev) => ({ ...prev, [entry.localId]: true }));
        document.getElementById(`member-card-${entry.localId}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const orderedEntries = sortEntriesForSubmission(entries);
      setSubmitProgress({ current: 0, total: orderedEntries.length });

      const sentList: Array<{ fullName: string; role: string; connector?: string }> = [];

      for (let i = 0; i < orderedEntries.length; i++) {
        const entry = orderedEntries[i];
        const duplicates = findDuplicates(entry.fullName.trim(), entry.birthDate || undefined);
        const possibleDuplicateId =
          entry.targetPersonId || (duplicates.length > 0 ? duplicates[0].id : undefined);

        const dbRelation: RelationToBranch =
          entry.relationChoice === 'spouse' || entry.relationChoice === 'sibling'
            ? 'other'
            : entry.relationChoice;

        const formattedConnector = entry.isUpdate
          ? `Pembaruan data anggota: ${entry.fullName.trim()}`
          : entry.relationChoice === 'sibling'
            ? `Saudara kandung dari ${entry.connectorName.trim() || branch.name}`
            : entry.relationChoice !== 'child' && entry.connectorName.trim()
              ? entry.relationChoice === 'spouse'
                ? `Pasangan dari ${entry.connectorName.trim()}`
                : entry.connectorName.trim()
              : undefined;

        await createSubmission({
          branchId: branch.id,
          submittedBy: submittedBy.trim(),
          submitterEmail: submitterEmail.trim() || undefined,
          fullName: entry.fullName.trim(),
          gender: entry.gender,
          birthDate: entry.birthDate || undefined,
          birthPlace: entry.birthPlace.trim() || undefined,
          deathDate: entry.isDeceased ? (entry.deathDate || 'UNKNOWN') : undefined,
          deathPlace:
            entry.isDeceased && entry.deathPlace.trim() ? entry.deathPlace.trim() : undefined,
          residence:
            !entry.isDeceased && entry.residence.trim() ? entry.residence.trim() : undefined,
          photoUrl: entry.photoUrl || undefined,
          notes: entry.notes.trim() || undefined,
          relationToBranch: dbRelation,
          parentName: formattedConnector,
          possibleDuplicateId,
        });

        sentList.push({
          fullName: entry.fullName.trim(),
          role: entry.isUpdate ? 'Pembaruan Data' : RELATION_LABELS[entry.relationChoice],
          connector: formattedConnector,
        });

        setSubmitProgress({ current: i + 1, total: orderedEntries.length });
      }

      setSubmittedSummary(sentList);
    } catch (err: any) {
      console.error('Batch submission error:', err);
      setError(`Gagal mengirim data: ${err?.message || 'Terjadi kesalahan'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartNewBatch = () => {
    const fresh = createEmptyEntry('grandchild');
    setSubmittedSummary([]);
    setEntries([fresh]);
    setExpandedIds({ [fresh.localId]: true });
    setError(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-primary/5 to-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
          <p className="text-sm text-muted-foreground">Memuat formulir silsilah...</p>
        </div>
      </div>
    );
  }

  if (error && !branch) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-primary/5 to-background flex items-center justify-center p-4">
        <Card className="max-w-md p-6 sm:p-8 text-center rounded-2xl">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Cabang Tidak Ditemukan</h2>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <p className="text-xs text-muted-foreground">
            Pastikan tautan yang Anda buka benar atau hubungi koordinator cabang keluarga.
          </p>
        </Card>
      </div>
    );
  }

  if (submittedSummary.length > 0) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-primary/5 to-background flex items-center justify-center p-4">
        <Card className="max-w-lg w-full p-6 sm:p-8 text-center rounded-2xl space-y-5">
          <div>
            <CheckCircle className="w-14 h-14 text-success mx-auto mb-3" />
            <h2 className="text-2xl font-display font-bold mb-1.5">
              {submittedSummary.length} Data Berhasil Dikirim!
            </h2>
            <p className="text-sm text-muted-foreground">
              Terima kasih, <strong>{submittedBy}</strong>. Seluruh data di bawah ini sudah masuk antrean tinjauan admin untuk disambungkan ke pohon silsilah.
            </p>
          </div>

          <div className="rounded-xl border bg-muted/35 p-3.5 text-left space-y-2 max-h-64 overflow-y-auto">
            {submittedSummary.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 text-xs sm:text-sm bg-background rounded-lg px-3 py-2 border border-border/60"
              >
                <div className="min-w-0">
                  <p className="font-semibold truncate">{item.fullName}</p>
                  {item.connector && (
                    <p className="text-[11px] text-muted-foreground truncate">{item.connector}</p>
                  )}
                </div>
                <Badge variant="secondary" className="text-[10px] shrink-0">
                  {item.role}
                </Badge>
              </div>
            ))}
          </div>

          <div className="space-y-2.5">
            {publicShareInfo && (
              <Button asChild variant="default" className="w-full h-11">
                <Link to={`/view/${publicShareInfo.code}`}>
                  <TreePine className="w-4 h-4 mr-2" />
                  Lihat Pohon Silsilah ({publicShareInfo.title})
                </Link>
              </Button>
            )}
            <Button
              variant={publicShareInfo ? 'outline' : 'default'}
              onClick={handleStartNewBatch}
              className="w-full h-11"
            >
              <Plus className="w-4 h-4 mr-2" />
              Kirim Daftar Anggota Lain
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const relationOptions: {
    id: PublicRelationChoice;
    title: string;
    icon: React.ElementType;
  }[] = [
    { id: 'child', title: 'Anak langsung', icon: Baby },
    { id: 'sibling', title: 'Kakak / Adik', icon: Users },
    { id: 'grandchild', title: 'Cucu / Keponakan', icon: Users },
    { id: 'great-grandchild', title: 'Cicit / Garis Jauh', icon: GitBranch },
    { id: 'spouse', title: 'Pasangan / Menantu', icon: Heart },
  ];

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-primary/5 to-background pb-12">
      {/* Header */}
      <div className="bg-card border-b">
        <div className="container max-w-3xl mx-auto px-4 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Users className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-display font-bold leading-tight">
                  Formulir Data Silsilah Keluarga
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Cabang: <span className="font-semibold text-foreground">{branch?.name}</span>
                  {branch?.coordinatorName ? ` · Koordinator: ${branch.coordinatorName}` : ''}
                </p>
                {branch?.description && (
                  <p className="text-xs text-muted-foreground mt-1.5 bg-muted/40 rounded-lg px-2.5 py-1.5">
                    {branch.description}
                  </p>
                )}
              </div>
            </div>

            {publicShareInfo && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="shrink-0 rounded-xl border-primary/35 bg-primary/5 hover:bg-primary/10 text-primary text-xs"
              >
                <Link to={`/view/${publicShareInfo.code}`}>
                  <TreePine className="w-3.5 h-3.5 mr-1.5" />
                  Lihat Pohon Silsilah
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container max-w-3xl mx-auto px-4 py-5 space-y-5">
        {/* Quick Guide */}
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3.5 flex items-start gap-2.5 text-xs sm:text-sm text-foreground/85">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p>
            <strong>Bisa kirim banyak orang sekaligus!</strong> Tambahkan data Anda, pasangan, anak, menantu, hingga cucu dalam satu formulir ini—nama yang baru Anda ketik di kartu sebelumnya otomatis muncul di pilihan <em>"Terhubung ke siapa?"</em>.
          </p>
        </div>

        {/* Approved Members */}
        {approvedMembers.length > 0 && (
          <ApprovedMembersCard
            members={approvedMembers}
            branchName={branch?.name || ''}
            onSelectMember={handlePickApprovedMember}
            onUpdateMember={handlePickUpdateMember}
          />
        )}

        <form onSubmit={handleSubmitAll} className="space-y-5">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Step 1: Submitter Info (Once) */}
          <Card className="p-4 sm:p-5 rounded-2xl space-y-3.5">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold">
                1
              </span>
              Identitas Pengisi (Cukup Isi Sekali)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="submittedBy" className="text-xs sm:text-sm">
                  Nama Anda *
                </Label>
                <Input
                  id="submittedBy"
                  value={submittedBy}
                  onChange={(e) => setSubmittedBy(e.target.value)}
                  placeholder="Nama lengkap Anda"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="submitterEmail" className="text-xs sm:text-sm">
                  Email (Opsional)
                </Label>
                <Input
                  id="submitterEmail"
                  type="email"
                  value={submitterEmail}
                  onChange={(e) => setSubmitterEmail(e.target.value)}
                  placeholder="email@contoh.com"
                  className="mt-1"
                />
              </div>
            </div>
          </Card>

          {/* Step 2: Member Cards List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold">
                  2
                </span>
                Daftar Anggota yang Akan Dikirim ({entries.length})
              </h2>
            </div>

            {entries.map((entry, idx) => {
              const isExpanded = Boolean(expandedIds[entry.localId]);
              const otherBatchMembers = entries
                .map((other, otherIdx) => ({ other, num: otherIdx + 1 }))
                .filter(
                  ({ other }) =>
                    other.localId !== entry.localId && other.fullName.trim().length > 0
                );

              return (
                <Card
                  key={entry.localId}
                  id={`member-card-${entry.localId}`}
                  className="rounded-2xl overflow-hidden border shadow-sm"
                >
                  {/* Card Header (Collapsible) */}
                  <div
                    className="flex items-center justify-between gap-2 px-4 py-3 bg-muted/35 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => toggleExpand(entry.localId)}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Badge variant="default" className="h-6 px-2 text-xs shrink-0">
                        #{idx + 1}
                      </Badge>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold truncate">
                            {entry.fullName.trim() || `Anggota Baru #${idx + 1}`}
                          </p>
                          {entry.isUpdate && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-primary/15 text-primary shrink-0">
                              Update Data
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {entry.isUpdate
                            ? 'Melengkapi / memperbarui data anggota yang sudah terdaftar'
                            : `${RELATION_LABELS[entry.relationChoice]}${
                                entry.relationChoice !== 'child' && entry.connectorName
                                  ? ` · ${entry.connectorName}`
                                  : ''
                              }`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {entries.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          aria-label="Hapus anggota ini"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeEntry(entry.localId);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={isExpanded ? 'Lipat' : 'Buka'}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Card Body */}
                  {isExpanded && (
                    <div className="p-4 sm:p-5 space-y-5 border-t">
                      {/* Mode Switcher: Tambah Anggota Baru vs Lengkapi / Update Anggota Terdaftar */}
                      <div className="space-y-2.5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              updateEntry(entry.localId, {
                                isUpdate: false,
                                targetPersonId: undefined,
                              })
                            }
                            className={cn(
                              'flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-xs font-semibold transition-all',
                              !entry.isUpdate
                                ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30'
                                : 'border-border hover:border-primary/40 text-muted-foreground'
                            )}
                          >
                            <UserPlus className="w-4 h-4 shrink-0" />
                            <div>
                              <p>Tambah Anggota Baru</p>
                              <p className="text-[10px] font-normal opacity-80">
                                Belum pernah terdaftar di silsilah
                              </p>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              updateEntry(entry.localId, {
                                isUpdate: true,
                              })
                            }
                            className={cn(
                              'flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-xs font-semibold transition-all',
                              entry.isUpdate
                                ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30'
                                : 'border-border hover:border-primary/40 text-muted-foreground'
                            )}
                          >
                            <Pencil className="w-4 h-4 shrink-0" />
                            <div>
                              <p>Lengkapi / Update Anggota Terdaftar</p>
                              <p className="text-[10px] font-normal opacity-80">
                                Susulkan tanggal lahir / foto / biodata
                              </p>
                            </div>
                          </button>
                        </div>

                        {idx === 0 && (
                          <div className="flex items-center space-x-2 px-1 pt-0.5">
                            <Checkbox
                              id={`self-${entry.localId}`}
                              checked={Boolean(entry.isSelf)}
                              onCheckedChange={(checked) => {
                                const flag = Boolean(checked);
                                updateEntry(entry.localId, {
                                  isSelf: flag,
                                  fullName: flag ? submittedBy : entry.fullName,
                                });
                              }}
                            />
                            <Label
                              htmlFor={`self-${entry.localId}`}
                              className="text-xs sm:text-sm cursor-pointer"
                            >
                              Ini adalah data <strong>diri saya sendiri</strong>
                            </Label>
                          </div>
                        )}
                      </div>

                      {/* Quick Picker when updating an already registered member */}
                      {entry.isUpdate && (
                        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-2">
                          <Label className="text-xs sm:text-sm font-semibold text-primary">
                            Pilih Anggota yang Ingin Dilengkapi / Diperbarui Datanya
                          </Label>
                          {approvedMembers.length > 0 ? (
                            <Select
                              value={entry.fullName}
                              onValueChange={(selectedName) => {
                                const found = approvedMembers.find(
                                  (m) => m.fullName === selectedName
                                );
                                if (found) {
                                  updateEntry(entry.localId, {
                                    isUpdate: true,
                                    targetPersonId: found.createdPersonId,
                                    fullName: found.fullName,
                                    gender: found.gender === 'female' ? 'female' : 'male',
                                  });
                                } else {
                                  updateEntry(entry.localId, { fullName: selectedName });
                                }
                              }}
                            >
                              <SelectTrigger className="bg-background h-9 text-xs">
                                <SelectValue placeholder="Pilih nama anggota dari daftar cabang..." />
                              </SelectTrigger>
                              <SelectContent className="max-h-64">
                                {approvedMembers.map((m, mIdx) => (
                                  <SelectItem key={`${m.fullName}-${mIdx}`} value={m.fullName}>
                                    {m.fullName}
                                    {!m.hasBirthDate ? ' — Belum ada tanggal lahir' : ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : null}
                          <p className="text-[11px] text-muted-foreground">
                            💡 Pilih nama anggota di atas (atau ketik langsung pada kolom <strong>Nama Lengkap</strong> di bawah), lalu isi <strong>Tanggal Lahir</strong> atau biodata yang ingin dilengkapi.
                          </p>
                        </div>
                      )}

                      {/* Role / Position Picker (hidden when updating an existing member) */}
                      {!entry.isUpdate && (
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Posisi di Cabang {branch?.name} *
                        </Label>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                          {relationOptions.map((opt) => {
                            const Icon = opt.icon;
                            const active = entry.relationChoice === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() =>
                                  updateEntry(entry.localId, {
                                    relationChoice: opt.id,
                                    connectorName: opt.id === 'child' ? '' : entry.connectorName,
                                  })
                                }
                                className={cn(
                                  'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-all',
                                  active
                                    ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30'
                                    : 'border-border hover:border-primary/40 text-foreground'
                                )}
                              >
                                <Icon className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">{opt.title}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      )}

                      {/* Cross-Reference Connector */}
                      {!entry.isUpdate && entry.relationChoice !== 'child' && (
                        <div className="rounded-xl border border-primary/25 bg-primary/5 p-3.5 space-y-2">
                          <Label className="text-xs sm:text-sm font-semibold">
                            {entry.relationChoice === 'spouse'
                              ? 'Suami / Istri dari siapa? *'
                              : entry.relationChoice === 'sibling'
                                ? `Kakak / Adik kandung dari siapa? (Kosongkan jika langsung saudara kandung Kepala Cabang ${branch?.name})`
                                : 'Anak kandung dari siapa? (Nama Ayah / Ibu) *'}
                          </Label>

                          {(otherBatchMembers.length > 0 || approvedMembers.length > 0) && (
                            <Select
                              value=""
                              onValueChange={(val) =>
                                updateEntry(entry.localId, { connectorName: val })
                              }
                            >
                              <SelectTrigger className="bg-background h-9 text-xs">
                                <SelectValue placeholder="Pilih cepat dari daftar formulir ini atau anggota terdaftar..." />
                              </SelectTrigger>
                              <SelectContent>
                                {otherBatchMembers.length > 0 && (
                                  <SelectGroup>
                                    <SelectLabel className="text-[11px] text-primary">
                                      Baru ditambahkan di formulir ini
                                    </SelectLabel>
                                    {otherBatchMembers.map(({ other, num }) => (
                                      <SelectItem
                                        key={other.localId}
                                        value={other.fullName.trim()}
                                      >
                                        #{num} {other.fullName.trim()} ({RELATION_LABELS[other.relationChoice]})
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                )}
                                {approvedMembers.length > 0 && (
                                  <SelectGroup>
                                    <SelectLabel className="text-[11px]">
                                      Sudah terdaftar di cabang
                                    </SelectLabel>
                                    {approvedMembers.map((m, mIdx) => (
                                      <SelectItem key={`${m.fullName}-${mIdx}`} value={m.fullName}>
                                        {m.fullName}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                )}
                              </SelectContent>
                            </Select>
                          )}

                          <Input
                            value={entry.connectorName}
                            onChange={(e) =>
                              updateEntry(entry.localId, { connectorName: e.target.value })
                            }
                            placeholder={
                              entry.relationChoice === 'spouse'
                                ? 'Atau ketik nama suami/istri di sini...'
                                : entry.relationChoice === 'sibling'
                                  ? `Kosongkan jika Kakak/Adik dari Kepala Cabang (${branch?.name})...`
                                  : 'Ketik nama ayah/ibu kandung (boleh ketik nama yang belum terdaftar)...'
                            }
                            className="bg-background"
                          />
                          {entry.relationChoice !== 'spouse' && entry.relationChoice !== 'sibling' && (
                            <p className="text-[11px] text-muted-foreground">
                              💡 Jika nama orang tua/leluhur penghubung belum terdaftar di daftar di atas, Anda bisa <strong>menambahkan kartu beliau terlebih dahulu</strong> atau langsung ketik namanya di sini (admin dapat membuatkan datanya otomatis).
                            </p>
                          )}
                        </div>
                      )}

                      {/* Personal Details */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {/* Optional Photo Upload */}
                        <div className="sm:col-span-2 flex items-center gap-3.5 rounded-xl border border-border/60 bg-muted/20 p-3">
                          <div className="w-14 h-14 rounded-full overflow-hidden bg-muted border flex items-center justify-center shrink-0">
                            {entry.photoUrl ? (
                              <img
                                src={entry.photoUrl}
                                alt={entry.fullName || 'Foto'}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Camera className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium">Foto Profil (Opsional)</p>
                            <p className="text-[11px] text-muted-foreground">
                              Otomatis dikompresi ringan (JPG/PNG)
                            </p>
                            <div className="mt-1.5 flex items-center gap-2">
                              <label className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1 text-xs font-medium cursor-pointer hover:bg-accent transition-colors">
                                <Camera className="w-3.5 h-3.5" />
                                <span>{entry.photoUrl ? 'Ganti Foto' : 'Pilih Foto'}</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={async (ev) => {
                                    const file = ev.target.files?.[0];
                                    if (!file) return;
                                    if (!file.type.startsWith('image/')) {
                                      setError('File foto harus berupa gambar (JPG/PNG).');
                                      return;
                                    }
                                    if (file.size > 8 * 1024 * 1024) {
                                      setError('Ukuran foto maksimal 8MB.');
                                      return;
                                    }
                                    try {
                                      const dataUrl = await compressPhotoToDataUrl(file);
                                      updateEntry(entry.localId, { photoUrl: dataUrl });
                                    } catch {
                                      setError('Gagal memproses foto.');
                                    }
                                  }}
                                />
                              </label>
                              {entry.photoUrl && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                                  onClick={() => updateEntry(entry.localId, { photoUrl: undefined })}
                                >
                                  <X className="w-3 h-3 mr-1" />
                                  Hapus
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="sm:col-span-2">
                          <Label>Nama Lengkap *</Label>
                          <Input
                            value={entry.fullName}
                            onChange={(e) =>
                              updateEntry(entry.localId, {
                                fullName: e.target.value,
                                isSelf: false,
                              })
                            }
                            placeholder="Nama lengkap anggota keluarga"
                            className="mt-1"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <Label>Jenis Kelamin *</Label>
                          <RadioGroup
                            value={entry.gender}
                            onValueChange={(v) =>
                              updateEntry(entry.localId, { gender: v as 'male' | 'female' })
                            }
                            className="flex gap-5 mt-2"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="male" id={`male-${entry.localId}`} />
                              <Label htmlFor={`male-${entry.localId}`} className="cursor-pointer">
                                Laki-laki
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="female" id={`female-${entry.localId}`} />
                              <Label htmlFor={`female-${entry.localId}`} className="cursor-pointer">
                                Perempuan
                              </Label>
                            </div>
                          </RadioGroup>
                        </div>

                        <div>
                          <Label>Tanggal Lahir</Label>
                          <FlexibleDateInput
                            value={entry.birthDate}
                            onChange={(val) =>
                              updateEntry(entry.localId, { birthDate: val })
                            }
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label>Tempat Lahir</Label>
                          <Input
                            value={entry.birthPlace}
                            onChange={(e) =>
                              updateEntry(entry.localId, { birthPlace: e.target.value })
                            }
                            placeholder="Kota / Kabupaten"
                            className="mt-1"
                          />
                        </div>

                        {!entry.isDeceased && (
                          <div className="sm:col-span-2">
                            <Label>Domisili Saat Ini (Opsional)</Label>
                            <Input
                              value={entry.residence}
                              onChange={(e) =>
                                updateEntry(entry.localId, { residence: e.target.value })
                              }
                              placeholder="Kota tempat tinggal sekarang..."
                              className="mt-1"
                            />
                          </div>
                        )}

                        <div className="sm:col-span-2 flex items-center space-x-2">
                          <Checkbox
                            id={`dec-${entry.localId}`}
                            checked={entry.isDeceased}
                            onCheckedChange={(checked) =>
                              updateEntry(entry.localId, { isDeceased: Boolean(checked) })
                            }
                          />
                          <Label htmlFor={`dec-${entry.localId}`} className="text-sm cursor-pointer">
                            Sudah wafat (Almarhum / Almarhumah)
                          </Label>
                        </div>

                        {entry.isDeceased && (
                          <>
                            <div>
                              <Label>Tanggal Wafat</Label>
                              <FlexibleDateInput
                                value={entry.deathDate}
                                onChange={(val) =>
                                  updateEntry(entry.localId, { deathDate: val })
                                }
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label>Tempat Wafat / Makam</Label>
                              <Input
                                value={entry.deathPlace}
                                onChange={(e) =>
                                  updateEntry(entry.localId, { deathPlace: e.target.value })
                                }
                                placeholder="Kota / Kabupaten"
                                className="mt-1"
                              />
                            </div>
                          </>
                        )}

                        <div className="sm:col-span-2">
                          <Label>Catatan (Opsional)</Label>
                          <Textarea
                            value={entry.notes}
                            onChange={(e) =>
                              updateEntry(entry.localId, { notes: e.target.value })
                            }
                            placeholder="Anak ke berapa, nama panggilan, atau info garis kakek/nenek..."
                            rows={2}
                            maxLength={500}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}

            {/* Quick Add Buttons */}
            <Card className="p-3.5 rounded-2xl border-dashed bg-muted/20">
              <p className="text-xs font-medium text-muted-foreground mb-2.5 text-center">
                Tambah anggota lain untuk dikirim bersamaan:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs bg-background"
                  onClick={() => addNewEntry('sibling', '')}
                >
                  <Users className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                  + Kakak / Adik
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs bg-background"
                  onClick={() => addNewEntry('spouse')}
                >
                  <Heart className="w-3.5 h-3.5 mr-1.5 text-rose-500" />
                  + Pasangan / Menantu
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs bg-background"
                  onClick={() => addNewEntry('grandchild')}
                >
                  <Baby className="w-3.5 h-3.5 mr-1.5 text-primary" />
                  + Anak / Cucu
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs bg-background"
                  onClick={() => addNewEntry('great-grandchild')}
                >
                  <UserPlus className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                  + Cicit / Lainnya
                </Button>
              </div>
            </Card>
          </div>

          {/* Progress Bar while submitting */}
          {isSubmitting && submitProgress.total > 0 && (
            <Card className="p-4 rounded-2xl space-y-2">
              <div className="flex justify-between text-xs font-medium">
                <span>
                  Mengirim {submitProgress.current} dari {submitProgress.total} anggota...
                </span>
                <span>
                  {Math.round((submitProgress.current / submitProgress.total) * 100)}%
                </span>
              </div>
              <Progress
                value={(submitProgress.current / submitProgress.total) * 100}
                className="h-2"
              />
            </Card>
          )}

          {/* Submit All Button */}
          <div className="sticky bottom-3 z-20">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 text-sm sm:text-base shadow-lg rounded-xl"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Mengirim {entries.length} Data...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Kirim Semua ({entries.length} Anggota)
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
