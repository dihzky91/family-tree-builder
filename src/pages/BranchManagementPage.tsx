import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Edit,
  Trash2,
  QrCode,
  Copy,
  CheckCircle,
  ExternalLink,
  MessageCircle,
  Download,
  FileCheck,
  Share2,
  UserPlus,
  Users,
  Search,
  GitBranch,
  TreePine,
  Clock,
  MoreVertical,
  LayoutGrid,
  List,
  X,
  Link2,
} from 'lucide-react';
import { ShareTreeDialog } from '@/features/chart/components/ShareTreeDialog';
import {
  getAllBranches,
  createBranch,
  updateBranch,
  deleteBranch,
} from '@/storage/supabase/branchQueries';
import { getAllSubmissions } from '@/storage/supabase/submissionQueries';
import { getAllShareLinks } from '@/storage/supabase/shareQueries';
import { useFamilyStore } from '@/store/familyStore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  BranchFormSchema,
  type BranchFormData,
  type Branch,
  type Submission,
  type ShareLink,
  type Person,
  type Relationship,
} from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function slugifyBranchName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || '?';
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * Count how many family members in the tree belong to this branch
 * (rootPerson + all descendants + their spouses)
 */
function countBranchTreeMembers(
  rootPersonId: string,
  persons: Person[],
  relationships: Relationship[]
): number {
  if (!rootPersonId || !persons.some((p) => p.id === rootPersonId)) return 0;

  const included = new Set<string>([rootPersonId]);
  const queue: string[] = [rootPersonId];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const rel of relationships) {
      if (rel.type === 'PARENT_CHILD' && rel.fromPersonId === curr) {
        if (!included.has(rel.toPersonId)) {
          included.add(rel.toPersonId);
          queue.push(rel.toPersonId);
        }
      }
    }
  }

  const snapshot = Array.from(included);
  for (const rel of relationships) {
    if (rel.type === 'SPOUSE') {
      if (snapshot.includes(rel.fromPersonId)) included.add(rel.toPersonId);
      if (snapshot.includes(rel.toPersonId)) included.add(rel.fromPersonId);
    }
  }

  return persons.filter((p) => included.has(p.id)).length;
}

/**
 * Compute generation depth of a person (1 = top ancestor, 2 = child, etc.)
 */
function computeGenerationDepthMap(
  persons: Person[],
  relationships: Relationship[]
): Map<string, number> {
  const parentsByChild = new Map<string, string[]>();
  relationships.forEach((rel) => {
    if (rel.type !== 'PARENT_CHILD') return;
    const arr = parentsByChild.get(rel.toPersonId) || [];
    arr.push(rel.fromPersonId);
    parentsByChild.set(rel.toPersonId, arr);
  });

  const cache = new Map<string, number>();
  const getGen = (id: string, visited = new Set<string>()): number => {
    if (cache.has(id)) return cache.get(id)!;
    if (visited.has(id)) return 1;
    const nextVisited = new Set(visited);
    nextVisited.add(id);
    const pIds = parentsByChild.get(id) || [];
    if (pIds.length === 0) {
      cache.set(id, 1);
      return 1;
    }
    const g = Math.max(...pIds.map((pid) => getGen(pid, nextVisited))) + 1;
    cache.set(id, g);
    return g;
  };

  persons.forEach((p) => getGen(p.id));
  return cache;
}

type FilterStatus = 'all' | 'pending' | 'active';
type SortMode = 'lineage' | 'name' | 'members' | 'recent';

export default function BranchManagementPage() {
  const { persons, relationships, addPerson, addRelationship, isDemoMode } = useFamilyStore();
  const navigate = useNavigate();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);

  // Filter, Search & Layout View Controls
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [sortMode, setSortMode] = useState<SortMode>('lineage');
  const [layoutMode, setLayoutMode] = useState<'grid' | 'compact'>('grid');

  // Quick-create new head of branch inline
  const [rootMode, setRootMode] = useState<'existing' | 'new'>('existing');
  const [newHeadName, setNewHeadName] = useState('');
  const [newHeadGender, setNewHeadGender] = useState<'male' | 'female' | 'unknown'>('unknown');
  const [newHeadLinkType, setNewHeadLinkType] = useState<'none' | 'sibling_of' | 'child_of'>(
    'sibling_of'
  );
  const [newHeadTargetId, setNewHeadTargetId] = useState<string>('');

  const [qrDialog, setQrDialog] = useState<{
    branch: Branch;
    dataUrl: string;
    link: string;
  } | null>(null);
  const [shareTreeBranch, setShareTreeBranch] = useState<Branch | null>(null);
  const [isShareTreeOpen, setIsShareTreeOpen] = useState(false);

  const form = useForm<BranchFormData>({
    resolver: zodResolver(BranchFormSchema),
    defaultValues: {
      code: '',
      name: '',
      rootPersonId: '',
      coordinatorName: '',
      coordinatorEmail: '',
      description: '',
    },
  });

  const watchName = form.watch('name');

  // Auto-generate URL code from branch name in create mode
  useEffect(() => {
    if (!editingBranch && !codeManuallyEdited && watchName) {
      form.setValue('code', slugifyBranchName(watchName), { shouldValidate: false });
    }
  }, [watchName, editingBranch, codeManuallyEdited, form]);

  useEffect(() => {
    fetchBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchBranches = async () => {
    if (isDemoMode) {
      setBranches([]);
      setSubmissions([]);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const [branchData, subData, sharesData] = await Promise.all([
        getAllBranches(),
        getAllSubmissions().catch(() => [] as Submission[]),
        getAllShareLinks().catch(() => [] as ShareLink[]),
      ]);
      setBranches(branchData);
      setSubmissions(subData);
      setShareLinks(sharesData);
    } catch (error) {
      console.error('Error fetching branches:', error);
      toast.error('Gagal memuat data cabang');
    } finally {
      setIsLoading(false);
    }
  };

  const generationMap = useMemo(
    () => computeGenerationDepthMap(persons, relationships),
    [persons, relationships]
  );

  // Enrich each branch with live stats from the tree & submissions
  const enrichedBranches = useMemo(() => {
    return branches.map((branch) => {
      const rootPerson = persons.find((p) => p.id === branch.rootPersonId) || null;
      const generation = rootPerson ? generationMap.get(rootPerson.id) || 1 : 99;

      // Find parent of rootPerson to display lineage context (e.g. "Putra/Putri dari Khusnah")
      const parentIds = relationships
        .filter((r) => r.type === 'PARENT_CHILD' && r.toPersonId === branch.rootPersonId)
        .map((r) => r.fromPersonId);
      const parentNames = persons
        .filter((p) => parentIds.includes(p.id) && !p.tags.includes('auto-placeholder-parent'))
        .map((p) => p.fullName);

      const treeMemberCount = countBranchTreeMembers(
        branch.rootPersonId,
        persons,
        relationships
      );

      const branchSubs = submissions.filter((s) => s.branchId === branch.id);
      const pendingCount = branchSubs.filter((s) => s.status === 'pending').length;
      const approvedCount =
        branchSubs.filter((s) => s.status === 'approved').length || branch.approvedCount || 0;
      const totalSubCount = branchSubs.length || branch.submissionCount || 0;

      return {
        branch,
        rootPerson,
        generation,
        parentNames,
        treeMemberCount,
        pendingCount,
        approvedCount,
        totalSubCount,
      };
    });
  }, [branches, persons, relationships, generationMap, submissions]);

  const summaryStats = useMemo(() => {
    const totalBranches = enrichedBranches.length;
    const activeBranches = enrichedBranches.filter((b) => b.branch.isActive).length;
    const totalPending = enrichedBranches.reduce((sum, b) => sum + b.pendingCount, 0);
    const totalApproved = enrichedBranches.reduce((sum, b) => sum + b.approvedCount, 0);
    return { totalBranches, activeBranches, totalPending, totalApproved };
  }, [enrichedBranches]);

  const filteredAndSortedBranches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = enrichedBranches.filter((item) => {
      if (filterStatus === 'pending' && item.pendingCount === 0) return false;
      if (filterStatus === 'active' && !item.branch.isActive) return false;

      if (!q) return true;
      return (
        item.branch.name.toLowerCase().includes(q) ||
        item.branch.coordinatorName.toLowerCase().includes(q) ||
        item.branch.code.toLowerCase().includes(q) ||
        (item.rootPerson?.fullName.toLowerCase().includes(q) ?? false)
      );
    });

    return filtered.sort((a, b) => {
      // Always surface branches with pending submissions first when in default lineage mode
      if (sortMode === 'lineage') {
        if (b.pendingCount !== a.pendingCount) return b.pendingCount - a.pendingCount;
        if (a.generation !== b.generation) return a.generation - b.generation;
        if (b.treeMemberCount !== a.treeMemberCount) return b.treeMemberCount - a.treeMemberCount;
        return a.branch.name.localeCompare(b.branch.name, 'id');
      }
      if (sortMode === 'name') {
        return a.branch.name.localeCompare(b.branch.name, 'id');
      }
      if (sortMode === 'members') {
        return b.treeMemberCount - a.treeMemberCount;
      }
      return (
        new Date(b.branch.createdAt).getTime() - new Date(a.branch.createdAt).getTime()
      );
    });
  }, [enrichedBranches, searchQuery, filterStatus, sortMode]);

  const onSubmit = async (data: BranchFormData) => {
    try {
      let effectiveRootPersonId = data.rootPersonId;

      if (rootMode === 'new') {
        const cleanHeadName = newHeadName.trim();
        if (!cleanHeadName) {
          toast.error('Masukkan nama Kepala Cabang baru terlebih dahulu');
          return;
        }

        const createdHead = await addPerson({
          fullName: cleanHeadName,
          gender: newHeadGender,
          birthDate: null,
          birthPlace: null,
          deathDate: null,
          deathPlace: null,
          residence: null,
          photoUrl: null,
          notes: `Kepala cabang ${data.name}`,
          tags: [],
          confidenceScore: 70,
        });

        effectiveRootPersonId = createdHead.id;

        if (newHeadLinkType === 'child_of' && newHeadTargetId) {
          await addRelationship({
            type: 'PARENT_CHILD',
            fromPersonId: newHeadTargetId,
            toPersonId: createdHead.id,
          });
        } else if (newHeadLinkType === 'sibling_of' && newHeadTargetId) {
          const existingParentIds = relationships
            .filter((r) => r.type === 'PARENT_CHILD' && r.toPersonId === newHeadTargetId)
            .map((r) => r.fromPersonId);

          if (existingParentIds.length > 0) {
            for (const pid of existingParentIds) {
              await addRelationship({
                type: 'PARENT_CHILD',
                fromPersonId: pid,
                toPersonId: createdHead.id,
              });
            }
          } else {
            const targetObj = persons.find((p) => p.id === newHeadTargetId);
            const sharedParent = await addPerson({
              fullName: `Orang Tua ${targetObj?.fullName || 'Keluarga'}`,
              gender: 'male',
              birthDate: null,
              birthPlace: null,
              deathDate: null,
              deathPlace: null,
              residence: null,
              photoUrl: null,
              notes: 'Dibuat otomatis sebagai leluhur penghubung saudara kandung',
              tags: ['auto-placeholder-parent'],
              confidenceScore: 60,
            });
            await addRelationship({
              type: 'PARENT_CHILD',
              fromPersonId: sharedParent.id,
              toPersonId: newHeadTargetId,
            });
            await addRelationship({
              type: 'PARENT_CHILD',
              fromPersonId: sharedParent.id,
              toPersonId: createdHead.id,
            });
          }
        }
      }

      const payload = {
        ...data,
        rootPersonId: effectiveRootPersonId,
      };

      if (editingBranch) {
        await updateBranch(editingBranch.id, payload);
        toast.success('Cabang berhasil diperbarui');
      } else {
        await createBranch({
          ...payload,
          isActive: true,
        } as any);
        toast.success(
          rootMode === 'new'
            ? `Tokoh "${newHeadName.trim()}" & Cabang "${data.name}" berhasil dibuat!`
            : 'Cabang berhasil dibuat'
        );
      }

      fetchBranches();
      setIsCreateOpen(false);
      setEditingBranch(null);
      setCodeManuallyEdited(false);
      setRootMode('existing');
      setNewHeadName('');
      form.reset();
    } catch (error) {
      console.error('Error saving branch:', error);
      toast.error('Gagal menyimpan cabang');
    }
  };

  const handleToggleBranchActive = async (branch: Branch, nextActive: boolean) => {
    try {
      await updateBranch(branch.id, { isActive: nextActive });
      setBranches((prev) =>
        prev.map((b) => (b.id === branch.id ? { ...b, isActive: nextActive } : b))
      );
      toast.success(
        nextActive
          ? `Formulir "${branch.name}" diaktifkan`
          : `Formulir "${branch.name}" ditutup sementara`
      );
    } catch {
      toast.error('Gagal mengubah status cabang');
    }
  };

  const handleEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setCodeManuallyEdited(true);
    setRootMode('existing');
    form.reset({
      code: branch.code,
      name: branch.name,
      rootPersonId: branch.rootPersonId,
      coordinatorName: branch.coordinatorName,
      coordinatorEmail: branch.coordinatorEmail || '',
      description: branch.description || '',
    });
    setIsCreateOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteBranch(deleteTarget.id);
      toast.success('Cabang berhasil dihapus');
      setDeleteTarget(null);
      fetchBranches();
    } catch (error) {
      console.error('Error deleting branch:', error);
      toast.error('Gagal menghapus cabang');
    }
  };

  const getBranchLink = (code: string) => `${window.location.origin}/submit/${code}`;

  const buildWhatsAppMessage = (branch: Branch) => {
    const link = getBranchLink(branch.code);
    const activeShares = shareLinks.filter((s) => s.isActive);
    const matchedShare =
      activeShares.find((s) => s.branchId === branch.id || s.code === `pohon-${branch.code}`) ||
      activeShares.find((s) => s.scopeType === 'full') ||
      activeShares[0];

    const viewTreeLine = matchedShare
      ? `\n🌳 *Lihat Pohon Silsilah Interaktif:*\n${window.location.origin}/view/${matchedShare.code}${
          matchedShare.hasPin && matchedShare.pinCode
            ? ` (PIN: *${matchedShare.pinCode}*)`
            : ''
        }\n`
      : '';

    return (
      `Assalamu'alaikum / Halo keluarga besar *${branch.name}* 🙏\n\n` +
      `Kami sedang melengkapi data silsilah keluarga besar. Mohon bantuannya untuk mengisi data diri, pasangan, dan anak-anak melalui tautan berikut:\n\n` +
      `📝 *Formulir Pengisian Data:*\n${link}\n` +
      viewTreeLine +
      `\nPanduan singkat:\n` +
      `1. Isi nama pengisi & pilih hubungan (Anak / Kakak-Adik / Cucu / Cicit / Pasangan).\n` +
      `2. Tulis nama orang tua atau pasangan yang terhubung agar posisi di silsilah tepat.\n` +
      `3. Bisa kirim 1 keluarga sekaligus (suami/istri & anak-anak) dalam satu formulir.\n\n` +
      `Terima kasih banyak! — Koordinator: ${branch.coordinatorName}`
    );
  };

  const copyLink = (code: string) => {
    navigator.clipboard.writeText(getBranchLink(code));
    setCopiedCode(code);
    toast.success('Link formulir berhasil disalin!');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const shareWhatsApp = (branch: Branch) => {
    const msg = buildWhatsAppMessage(branch);
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  };

  const openQrModal = async (branch: Branch) => {
    try {
      const link = getBranchLink(branch.code);
      const dataUrl = await QRCode.toDataURL(link, {
        width: 320,
        margin: 2,
        color: { dark: '#2c1e14', light: '#ffffff' },
      });
      setQrDialog({ branch, dataUrl, link });
    } catch (error) {
      console.error('QR generation failed:', error);
      toast.error('Gagal membuat QR Code');
    }
  };

  const downloadQr = () => {
    if (!qrDialog) return;
    const a = document.createElement('a');
    a.href = qrDialog.dataUrl;
    a.download = `qr-${qrDialog.branch.code}.png`;
    a.click();
  };

  const sortedPersons = useMemo(
    () => [...persons].sort((a, b) => a.fullName.localeCompare(b.fullName, 'id')),
    [persons]
  );

  return (
    <div className="w-full p-4 md:p-6 lg:p-8 space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight">
            Manajemen Cabang Keluarga
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Kelola tautan formulir per trah/cabang, pantau submisi masuk, dan bagikan pohon silsilah
          </p>
        </div>

        <Dialog
          open={isCreateOpen}
          onOpenChange={(open) => {
            setIsCreateOpen(open);
            if (!open) {
              setEditingBranch(null);
              setCodeManuallyEdited(false);
              setRootMode('existing');
              setNewHeadName('');
            }
          }}
        >
          <DialogTrigger asChild>
            <Button
              className="w-full sm:w-auto rounded-xl shadow-sm"
              onClick={() => {
                setEditingBranch(null);
                setCodeManuallyEdited(false);
                setRootMode('existing');
                setNewHeadName('');
                form.reset();
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Tambah Cabang
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[88dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">
                {editingBranch ? 'Edit Cabang' : 'Tambah Cabang Baru'}
              </DialogTitle>
              <DialogDescription>
                Buat tautan formulir khusus agar anggota di cabang ini bisa mengisi data keluarga mereka sendiri
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Nama Cabang *</Label>
                  <Input
                    id="name"
                    {...form.register('name')}
                    placeholder="Keluarga Budi Santoso"
                    className="mt-1"
                  />
                  {form.formState.errors.name && (
                    <p className="text-xs text-destructive mt-1">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="code">Kode URL * (otomatis)</Label>
                  <Input
                    id="code"
                    {...form.register('code', {
                      onChange: () => setCodeManuallyEdited(true),
                    })}
                    placeholder="keluarga-budi-santoso"
                    className="font-mono mt-1"
                  />
                  {form.formState.errors.code && (
                    <p className="text-xs text-destructive mt-1">
                      {form.formState.errors.code.message}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Hanya huruf kecil, angka, dan tanda hubung
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="rootPersonId">Kepala Cabang *</Label>
                  <button
                    type="button"
                    onClick={() => {
                      if (rootMode === 'existing') {
                        setRootMode('new');
                        form.setValue(
                          'rootPersonId',
                          sortedPersons[0]?.id || 'new-head-pending'
                        );
                        const guessedName = watchName
                          .replace(/^keluarga\s+(besar\s+)?/i, '')
                          .trim();
                        if (guessedName && !newHeadName) {
                          setNewHeadName(guessedName);
                        }
                        if (!newHeadTargetId && sortedPersons[0]?.id) {
                          setNewHeadTargetId(sortedPersons[0].id);
                        }
                      } else {
                        setRootMode('existing');
                        form.setValue('rootPersonId', '');
                      }
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    {rootMode === 'existing' ? (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Belum ada di daftar? Buat tokoh baru</span>
                      </>
                    ) : (
                      <>
                        <Users className="w-3.5 h-3.5" />
                        <span>Pilih dari anggota yang sudah ada</span>
                      </>
                    )}
                  </button>
                </div>

                {rootMode === 'existing' ? (
                  <>
                    <Select
                      value={form.watch('rootPersonId')}
                      onValueChange={(value) => form.setValue('rootPersonId', value)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Pilih kepala cabang dari silsilah" />
                      </SelectTrigger>
                      <SelectContent>
                        {sortedPersons.map((person) => (
                          <SelectItem key={person.id} value={person.id}>
                            {person.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.rootPersonId && (
                      <p className="text-xs text-destructive mt-1">
                        {form.formState.errors.rootPersonId.message}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="sm:col-span-2">
                        <Label className="text-xs">Nama Lengkap Kepala Cabang Baru *</Label>
                        <Input
                          value={newHeadName}
                          onChange={(e) => setNewHeadName(e.target.value)}
                          placeholder="Contoh: Adik Khusnah / Mbah Sari..."
                          className="mt-1 h-9 text-xs bg-background"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Jenis Kelamin</Label>
                        <Select
                          value={newHeadGender}
                          onValueChange={(v) =>
                            setNewHeadGender(v as 'male' | 'female' | 'unknown')
                          }
                        >
                          <SelectTrigger className="mt-1 h-9 text-xs bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Laki-laki</SelectItem>
                            <SelectItem value="female">Perempuan</SelectItem>
                            <SelectItem value="unknown">Belum tahu</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <Label className="text-xs">Hubungan dengan Silsilah Saat Ini</Label>
                        <Select
                          value={newHeadLinkType}
                          onValueChange={(v) =>
                            setNewHeadLinkType(v as 'none' | 'sibling_of' | 'child_of')
                          }
                        >
                          <SelectTrigger className="mt-1 h-9 text-xs bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sibling_of">Kakak / Adik kandung dari...</SelectItem>
                            <SelectItem value="child_of">Anak kandung dari...</SelectItem>
                            <SelectItem value="none">Belum tahu (Sambungkan nanti)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {newHeadLinkType !== 'none' && (
                        <div>
                          <Label className="text-xs">Terhubung ke Siapa?</Label>
                          <Select value={newHeadTargetId} onValueChange={setNewHeadTargetId}>
                            <SelectTrigger className="mt-1 h-9 text-xs bg-background">
                              <SelectValue placeholder="Pilih anggota..." />
                            </SelectTrigger>
                            <SelectContent>
                              {sortedPersons.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.fullName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      💡 Tokoh ini akan otomatis dibuatkan di silsilah dan langsung dijadikan Kepala Cabang untuk formulir ini.
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="coordinatorName">Nama Koordinator *</Label>
                  <Input
                    id="coordinatorName"
                    {...form.register('coordinatorName')}
                    placeholder="Nama koordinator cabang"
                    className="mt-1"
                  />
                  {form.formState.errors.coordinatorName && (
                    <p className="text-xs text-destructive mt-1">
                      {form.formState.errors.coordinatorName.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="coordinatorEmail">Email Koordinator</Label>
                  <Input
                    id="coordinatorEmail"
                    type="email"
                    {...form.register('coordinatorEmail')}
                    placeholder="email@example.com"
                    className="mt-1"
                  />
                  {form.formState.errors.coordinatorEmail && (
                    <p className="text-xs text-destructive mt-1">
                      {form.formState.errors.coordinatorEmail.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="description">Catatan / Panduan untuk Pengisi</Label>
                <Textarea
                  id="description"
                  {...form.register('description')}
                  placeholder="Contoh: Khusus keturunan Mbah Hardianto (anak, cucu, cicit & menantu)..."
                  rows={3}
                  className="mt-1"
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateOpen(false);
                    form.reset();
                  }}
                >
                  Batal
                </Button>
                <Button type="submit">
                  {editingBranch ? 'Simpan Perubahan' : 'Buat Cabang'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary KPI Bar */}
      {!isLoading && branches.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="p-3.5 sm:p-4 rounded-2xl border-border/70 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Cabang</p>
              <p className="text-xl sm:text-2xl font-display font-bold mt-0.5">
                {summaryStats.totalBranches}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {summaryStats.activeBranches} formulir aktif
              </p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <GitBranch className="w-5 h-5" />
            </div>
          </Card>

          <Card
            onClick={() =>
              summaryStats.totalPending > 0
                ? setFilterStatus(filterStatus === 'pending' ? 'all' : 'pending')
                : navigate('/submissions')
            }
            className={cn(
              'p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3',
              summaryStats.totalPending > 0
                ? 'border-amber-500/45 bg-amber-500/10 hover:bg-amber-500/15'
                : 'border-border/70 hover:bg-muted/40'
            )}
          >
            <div>
              <p className="text-xs text-muted-foreground font-medium">Menunggu Tinjauan</p>
              <p
                className={cn(
                  'text-xl sm:text-2xl font-display font-bold mt-0.5',
                  summaryStats.totalPending > 0 ? 'text-amber-600 dark:text-amber-400' : ''
                )}
              >
                {summaryStats.totalPending}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {summaryStats.totalPending > 0
                  ? 'Klik untuk filter cabang'
                  : 'Semua submisi tertinjau'}
              </p>
            </div>
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                summaryStats.totalPending > 0
                  ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              <Clock className="w-5 h-5" />
            </div>
          </Card>

          <Card className="p-3.5 sm:p-4 rounded-2xl border-border/70 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Submisi Disetujui</p>
              <p className="text-xl sm:text-2xl font-display font-bold text-success mt-0.5">
                {summaryStats.totalApproved}
              </p>
              <p className="text-[11px] text-muted-foreground">Masuk ke pohon silsilah</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
              <CheckCircle className="w-5 h-5" />
            </div>
          </Card>

          <Card className="p-3.5 sm:p-4 rounded-2xl border-border/70 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Anggota Pohon</p>
              <p className="text-xl sm:text-2xl font-display font-bold mt-0.5">
                {persons.length}
              </p>
              <p className="text-[11px] text-muted-foreground">Tersambung di silsilah</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Users className="w-5 h-5" />
            </div>
          </Card>
        </div>
      )}

      {/* Search, Filter & Layout Toolbar */}
      {!isLoading && branches.length > 0 && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card/80 p-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama cabang, kepala cabang, atau koordinator..."
              className="h-9 rounded-xl pl-9 pr-8 text-xs sm:text-sm bg-background"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Pills + Sort + Grid/Compact Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-xl border border-border/70 bg-muted/40 p-0.5">
              {(
                [
                  { id: 'all', label: `Semua (${branches.length})` },
                  {
                    id: 'pending',
                    label: `Perlu Review (${summaryStats.totalPending})`,
                  },
                  { id: 'active', label: 'Aktif' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterStatus(tab.id)}
                  className={cn(
                    'h-7 rounded-lg px-2.5 text-xs font-medium transition-colors',
                    filterStatus === tab.id
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
              <SelectTrigger className="h-8 w-[160px] rounded-xl text-xs bg-background">
                <SelectValue placeholder="Urutkan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lineage" className="text-xs">
                  Urutan Generasi (Induk → Anak)
                </SelectItem>
                <SelectItem value="members" className="text-xs">
                  Anggota Terbanyak
                </SelectItem>
                <SelectItem value="name" className="text-xs">
                  Nama Cabang (A–Z)
                </SelectItem>
                <SelectItem value="recent" className="text-xs">
                  Terbaru Dibuat
                </SelectItem>
              </SelectContent>
            </Select>

            <div className="hidden sm:flex items-center rounded-xl border border-border/70 bg-background p-0.5">
              <button
                type="button"
                onClick={() => setLayoutMode('grid')}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
                  layoutMode === 'grid'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                title="Tampilan Kartu Grid (3 Kolom)"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('compact')}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
                  layoutMode === 'compact'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                title="Tampilan Daftar Ringkas"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Branch List */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Memuat data cabang...</p>
        </div>
      ) : branches.length === 0 ? (
        <Card className="p-8 text-center max-w-md mx-auto rounded-2xl">
          <p className="text-muted-foreground mb-4">Belum ada cabang dibuat</p>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Buat Cabang Pertama
          </Button>
        </Card>
      ) : filteredAndSortedBranches.length === 0 ? (
        <Card className="p-8 text-center rounded-2xl border-dashed">
          <p className="text-sm text-muted-foreground">
            Tidak ada cabang yang cocok dengan pencarian atau filter ini.
          </p>
          <Button
            variant="link"
            size="sm"
            className="mt-1"
            onClick={() => {
              setSearchQuery('');
              setFilterStatus('all');
            }}
          >
            Reset Filter
          </Button>
        </Card>
      ) : layoutMode === 'compact' ? (
        /* Compact List Layout */
        <div className="space-y-2.5">
          {filteredAndSortedBranches.map(
            ({
              branch,
              rootPerson,
              generation,
              treeMemberCount,
              pendingCount,
              approvedCount,
            }) => {
              const isCopied = copiedCode === branch.code;
              const genderClass =
                rootPerson?.gender === 'male'
                  ? 'bg-node-male/15 text-node-male border-node-male/35'
                  : rootPerson?.gender === 'female'
                    ? 'bg-node-female/15 text-node-female border-node-female/35'
                    : 'bg-primary/10 text-primary border-primary/25';

              return (
                <Card
                  key={branch.id}
                  className={cn(
                    'p-3.5 rounded-2xl border transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:border-primary/40',
                    !branch.isActive && 'opacity-65 bg-muted/30'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-full border flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden',
                        genderClass
                      )}
                    >
                      {rootPerson?.photoUrl ? (
                        <img
                          src={rootPerson.photoUrl}
                          alt={rootPerson.fullName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        getInitials(rootPerson?.fullName || branch.name)
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="font-display font-semibold text-sm sm:text-base truncate">
                          {branch.name}
                        </h3>
                        {generation < 99 && (
                          <Badge
                            variant={generation === 1 ? 'default' : 'outline'}
                            className="text-[10px] px-1.5 py-0"
                          >
                            {generation === 1 ? 'Cabang Induk' : `Gen ${generation}`}
                          </Badge>
                        )}
                        {pendingCount > 0 && (
                          <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0">
                            {pendingCount} Menunggu
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        Kepala Cabang: <strong className="text-foreground/85">{rootPerson?.fullName || '-'}</strong> · Koordinator: {branch.coordinatorName} · {treeMemberCount} anggota di pohon ({approvedCount} disetujui)
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                      onClick={() => shareWhatsApp(branch)}
                    >
                      <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
                      Undang WA
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs rounded-xl"
                      onClick={() => copyLink(branch.code)}
                    >
                      {isCopied ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5 mr-1 text-success" />
                          Tersalin
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 mr-1" />
                          Salin Form
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs rounded-xl"
                      onClick={() => {
                        setShareTreeBranch(branch);
                        setIsShareTreeOpen(true);
                      }}
                    >
                      <Share2 className="w-3.5 h-3.5 mr-1 text-primary" />
                      Link Pohon
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-xl"
                      title="QR Code"
                      onClick={() => openQrModal(branch)}
                    >
                      <QrCode className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-xl"
                      title="Edit Cabang"
                      onClick={() => handleEdit(branch)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-xl text-destructive hover:text-destructive"
                      title="Hapus Cabang"
                      onClick={() => setDeleteTarget(branch)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              );
            }
          )}
        </div>
      ) : (
        /* Modern 3-Column Responsive Heritage Card Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredAndSortedBranches.map(
            ({
              branch,
              rootPerson,
              generation,
              parentNames,
              treeMemberCount,
              pendingCount,
              approvedCount,
            }) => {
              const link = getBranchLink(branch.code);
              const isCopied = copiedCode === branch.code;
              const isInduk = generation === 1;
              const genderAccent =
                rootPerson?.gender === 'male'
                  ? 'border-l-node-male'
                  : rootPerson?.gender === 'female'
                    ? 'border-l-node-female'
                    : 'border-l-primary';
              const avatarStyle =
                rootPerson?.gender === 'male'
                  ? 'bg-node-male/15 text-node-male border-node-male/35'
                  : rootPerson?.gender === 'female'
                    ? 'bg-node-female/15 text-node-female border-node-female/35'
                    : 'bg-primary/12 text-primary border-primary/25';

              return (
                <Card
                  key={branch.id}
                  className={cn(
                    'group relative rounded-2xl border border-border/80 border-l-4 p-4 sm:p-5 flex flex-col justify-between gap-3.5 transition-all hover:shadow-md hover:border-primary/40',
                    genderAccent,
                    isInduk && 'ring-1 ring-primary/20 bg-gradient-to-br from-primary/[0.04] to-transparent',
                    !branch.isActive && 'opacity-65 bg-muted/25'
                  )}
                >
                  {/* Top Section: Avatar + Branch Name + Quick Menu */}
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-start gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() =>
                            rootPerson && navigate(`/chart?focus=${rootPerson.id}`)
                          }
                          title={
                            rootPerson
                              ? `Lihat ${rootPerson.fullName} di Pohon Silsilah`
                              : branch.name
                          }
                          className={cn(
                            'w-11 h-11 rounded-full border-1.5 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden transition-transform hover:scale-105',
                            avatarStyle
                          )}
                        >
                          {rootPerson?.photoUrl ? (
                            <img
                              src={rootPerson.photoUrl}
                              alt={rootPerson.fullName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            getInitials(rootPerson?.fullName || branch.name)
                          )}
                        </button>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h3
                              className="font-display font-bold text-base leading-snug truncate"
                              title={branch.name}
                            >
                              {branch.name}
                            </h3>
                            {generation < 99 && (
                              <Badge
                                variant={isInduk ? 'default' : 'secondary'}
                                className="text-[10px] px-1.5 py-0 h-4 font-semibold"
                              >
                                {isInduk ? 'Induk / Gen 1' : `Gen ${generation}`}
                              </Badge>
                            )}
                          </div>

                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {rootPerson ? (
                              <>
                                Tokoh: <strong className="text-foreground/85">{rootPerson.fullName}</strong>
                                {parentNames.length > 0 && (
                                  <span className="text-muted-foreground">
                                    {' '}
                                    (Anak {parentNames[0]})
                                  </span>
                                )}
                              </>
                            ) : (
                              'Kepala cabang belum terhubung'
                            )}
                          </p>
                          <p className="text-[11px] text-muted-foreground/85 truncate">
                            Koordinator: <span className="font-medium">{branch.coordinatorName}</span>
                          </p>
                        </div>
                      </div>

                      {/* Compact Top-Right Menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-xl shrink-0 text-muted-foreground hover:text-foreground"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem
                            onClick={() => window.open(link, '_blank', 'noopener,noreferrer')}
                          >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Buka Formulir Publik
                          </DropdownMenuItem>
                          {rootPerson && (
                            <DropdownMenuItem
                              onClick={() => navigate(`/chart?focus=${rootPerson.id}`)}
                            >
                              <TreePine className="w-4 h-4 mr-2 text-primary" />
                              Fokus di Pohon Silsilah
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => navigate(`/submissions?branch=${branch.id}`)}
                          >
                            <FileCheck className="w-4 h-4 mr-2" />
                            Tinjau Submisi Cabang
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <div className="flex items-center justify-between px-2 py-1.5 text-xs">
                            <span>Terima Submisi Form</span>
                            <Switch
                              checked={branch.isActive}
                              onCheckedChange={(checked) =>
                                handleToggleBranchActive(branch, checked)
                              }
                            />
                          </div>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleEdit(branch)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Cabang
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteTarget(branch)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Hapus Cabang
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Metrics Strip: Tree Members | Approved | Pending Review */}
                    <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-muted/45 p-2 text-center border border-border/50">
                      <button
                        type="button"
                        onClick={() =>
                          rootPerson && navigate(`/chart?focus=${rootPerson.id}`)
                        }
                        className="rounded-lg py-1 px-1.5 hover:bg-background/80 transition-colors"
                        title="Jumlah anggota di cabang ini yang sudah ada di pohon silsilah"
                      >
                        <p className="text-xs sm:text-sm font-bold text-foreground">
                          {treeMemberCount}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          Di Silsilah
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => navigate(`/submissions?branch=${branch.id}`)}
                        className="rounded-lg py-1 px-1.5 hover:bg-background/80 transition-colors border-x border-border/50"
                        title="Submisi formulir yang sudah disetujui"
                      >
                        <p className="text-xs sm:text-sm font-bold text-success">
                          {approvedCount}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          Disetujui
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => navigate(`/submissions?branch=${branch.id}`)}
                        className={cn(
                          'rounded-lg py-1 px-1.5 transition-colors',
                          pendingCount > 0
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold'
                            : 'hover:bg-background/80'
                        )}
                        title="Submisi baru yang menunggu persetujuan"
                      >
                        <p
                          className={cn(
                            'text-xs sm:text-sm font-bold',
                            pendingCount > 0
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-muted-foreground'
                          )}
                        >
                          {pendingCount}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          Menunggu
                        </p>
                      </button>
                    </div>

                    {/* Interactive One-Click Copy URL Pill */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => copyLink(branch.code)}
                        title={`Klik untuk menyalin tautan: ${link}`}
                        className={cn(
                          'flex-1 min-w-0 flex items-center justify-between gap-2 rounded-xl border px-3 py-1.5 text-xs font-mono transition-colors',
                          isCopied
                            ? 'border-success/50 bg-success/10 text-success'
                            : 'border-border/70 bg-muted/35 text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                        )}
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <Link2 className="w-3.5 h-3.5 shrink-0 opacity-70" />
                          <span className="truncate">/submit/{branch.code}</span>
                        </span>
                        <span className="shrink-0 inline-flex items-center gap-1 font-sans text-[11px] font-medium">
                          {isCopied ? (
                            <>
                              <CheckCircle className="w-3.5 h-3.5 text-success" />
                              <span>Tersalin</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Salin</span>
                            </>
                          )}
                        </span>
                      </button>

                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 shrink-0 rounded-xl border-border/70"
                        title="Tampilkan QR Code Formulir"
                        onClick={() => openQrModal(branch)}
                      >
                        <QrCode className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Bottom Primary Action Row */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/50">
                    <Button
                      variant="default"
                      size="sm"
                      className="h-8.5 rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                      onClick={() => shareWhatsApp(branch)}
                    >
                      <MessageCircle className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                      <span className="truncate">Undang WA</span>
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-8.5 rounded-xl text-xs border border-primary/20 bg-primary/10 hover:bg-primary/15 text-primary"
                      title="Buat atau bagikan tautan baca-saja pohon silsilah khusus cabang ini"
                      onClick={() => {
                        setShareTreeBranch(branch);
                        setIsShareTreeOpen(true);
                      }}
                    >
                      <Share2 className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                      <span className="truncate">Bagikan Pohon</span>
                    </Button>
                  </div>
                </Card>
              );
            }
          )}
        </div>
      )}

      {/* Local QR Code Dialog */}
      <Dialog open={!!qrDialog} onOpenChange={(o) => !o && setQrDialog(null)}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="font-display">QR Code Formulir</DialogTitle>
            <DialogDescription>
              Pindai untuk mengisi data silsilah cabang <strong>{qrDialog?.branch.name}</strong>
            </DialogDescription>
          </DialogHeader>
          {qrDialog && (
            <div className="space-y-4 py-2">
              <div className="mx-auto w-fit rounded-2xl border bg-white p-3 shadow-sm">
                <img
                  src={qrDialog.dataUrl}
                  alt={`QR Code ${qrDialog.branch.name}`}
                  className="w-56 h-56"
                />
              </div>
              <p className="text-xs font-mono text-muted-foreground break-all">
                {qrDialog.link}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => copyLink(qrDialog.branch.code)}>
                  <Copy className="w-4 h-4 mr-1.5" />
                  Salin Link
                </Button>
                <Button onClick={downloadQr}>
                  <Download className="w-4 h-4 mr-1.5" />
                  Unduh PNG
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Cabang?</AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan menghapus cabang <strong>{deleteTarget?.name}</strong> beserta seluruh data submisi yang terkait.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Share Read-Only Branch Tree Dialog */}
      <ShareTreeDialog
        open={isShareTreeOpen}
        onOpenChange={(open) => {
          setIsShareTreeOpen(open);
          if (!open) {
            setShareTreeBranch(null);
            getAllShareLinks()
              .then(setShareLinks)
              .catch(() => {});
          }
        }}
        defaultBranch={shareTreeBranch}
      />
    </div>
  );
}
