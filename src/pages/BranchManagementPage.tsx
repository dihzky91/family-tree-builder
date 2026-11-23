import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';
import { ShareTreeDialog } from '@/features/chart/components/ShareTreeDialog';
import {
  getAllBranches,
  createBranch,
  updateBranch,
  deleteBranch,
} from '@/storage/supabase/branchQueries';
import { useFamilyStore } from '@/store/familyStore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BranchFormSchema, type BranchFormData, type Branch } from '@/types';
import { toast } from 'sonner';

function slugifyBranchName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

export default function BranchManagementPage() {
  const { persons, relationships, addPerson, addRelationship, isDemoMode } = useFamilyStore();
  const navigate = useNavigate();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);

  // Quick-create new head of branch inline
  const [rootMode, setRootMode] = useState<'existing' | 'new'>('existing');
  const [newHeadName, setNewHeadName] = useState('');
  const [newHeadGender, setNewHeadGender] = useState<'male' | 'female' | 'unknown'>('unknown');
  const [newHeadLinkType, setNewHeadLinkType] = useState<'none' | 'sibling_of' | 'child_of'>('sibling_of');
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
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const data = await getAllBranches();
      setBranches(data);
    } catch (error) {
      console.error('Error fetching branches:', error);
      toast.error('Gagal memuat data cabang');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: BranchFormData) => {
    try {
      let effectiveRootPersonId = data.rootPersonId;

      // If creating a new head of branch inline
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

  const handleEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setCodeManuallyEdited(true);
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
    return (
      `Assalamu'alaikum / Halo keluarga besar *${branch.name}* 🙏\n\n` +
      `Kami sedang melengkapi data silsilah keluarga besar. Mohon bantuannya untuk mengisi data diri, pasangan, dan anak-anak melalui tautan berikut:\n\n` +
      `🔗 ${link}\n\n` +
      `Panduan singkat:\n` +
      `1. Isi nama pengisi & pilih hubungan (Anak / Cucu / Cicit / Pasangan).\n` +
      `2. Tulis nama orang tua atau pasangan yang terhubung agar posisi di silsilah tepat.\n` +
      `3. Setelah kirim, bisa langsung lanjut tambah pasangan & anak tanpa ketik ulang nama pengisi.\n\n` +
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

  const sortedPersons = [...persons].sort((a, b) => a.fullName.localeCompare(b.fullName, 'id'));

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 animate-fade-in max-w-6xl">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
        <div>
          <h1 className="text-2xl font-display font-bold">Manajemen Cabang</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Kelola cabang keluarga, undangan WhatsApp, dan formulir pengisian mandiri
          </p>
        </div>
        <Dialog
          open={isCreateOpen}
          onOpenChange={(open) => {
            setIsCreateOpen(open);
            if (!open) {
              setEditingBranch(null);
              setCodeManuallyEdited(false);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button
              className="w-full sm:w-auto"
              onClick={() => {
                setEditingBranch(null);
                setCodeManuallyEdited(false);
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
                        // Pre-fill dummy id so Zod validation passes before onSubmit creates the real person
                        form.setValue('rootPersonId', sortedPersons[0]?.id || 'new-head-pending');
                        const guessedName = watchName.replace(/^keluarga\s+(besar\s+)?/i, '').trim();
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
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {branches.map((branch) => {
            const link = getBranchLink(branch.code);
            return (
              <Card key={branch.id} className="p-4 sm:p-5 rounded-2xl flex flex-col justify-between gap-4">
                <div>
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <div className="min-w-0">
                      <h3 className="font-display font-semibold text-lg truncate">{branch.name}</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        Koordinator: {branch.coordinatorName}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Preview Formulir"
                        onClick={() => window.open(link, '_blank', 'noopener,noreferrer')}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Edit Cabang"
                        onClick={() => handleEdit(branch)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        title="Hapus Cabang"
                        onClick={() => setDeleteTarget(branch)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <Badge variant="secondary" className="text-xs">
                      Submisi: {branch.submissionCount || 0}
                    </Badge>
                    <Badge variant="outline" className="text-xs text-success border-success/40">
                      Disetujui: {branch.approvedCount || 0}
                    </Badge>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs ml-auto"
                      onClick={() => navigate(`/submissions?branch=${branch.id}`)}
                    >
                      <FileCheck className="w-3.5 h-3.5 mr-1" />
                      Tinjau Submisi
                    </Button>
                  </div>

                  {/* URL Box */}
                  <div className="rounded-xl bg-muted/60 px-3 py-2 text-xs font-mono text-muted-foreground truncate">
                    {link}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => shareWhatsApp(branch)}
                  >
                    <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
                    Undang WA
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs"
                    onClick={() => copyLink(branch.code)}
                  >
                    {copiedCode === branch.code ? (
                      <>
                        <CheckCircle className="w-3.5 h-3.5 mr-1.5 text-success" />
                        Tersalin
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 mr-1.5" />
                        Salin Link
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs"
                    onClick={() => openQrModal(branch)}
                  >
                    <QrCode className="w-3.5 h-3.5 mr-1.5" />
                    QR Code
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-9 text-xs"
                    title="Buat tautan baca-saja pohon silsilah khusus cabang ini"
                    onClick={() => {
                      setShareTreeBranch(branch);
                      setIsShareTreeOpen(true);
                    }}
                  >
                    <Share2 className="w-3.5 h-3.5 mr-1.5 text-primary" />
                    Link Pohon
                  </Button>
                </div>
              </Card>
            );
          })}
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
          if (!open) setShareTreeBranch(null);
        }}
        defaultBranch={shareTreeBranch}
      />
    </div>
  );
}
