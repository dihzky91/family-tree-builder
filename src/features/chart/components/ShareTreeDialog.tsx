import { useState, useEffect, useMemo } from 'react';
import QRCode from 'qrcode';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFamilyStore } from '@/store/familyStore';
import {
  ShareLinkFormSchema,
  type ShareLinkFormData,
  type ShareLink,
  type Branch,
} from '@/types';
import {
  getAllShareLinks,
  createShareLink,
  updateShareLink,
  deleteShareLink,
  toggleShareLinkActive,
  computeScopedShareData,
} from '@/storage/supabase/shareQueries';
import { getAllBranches } from '@/storage/supabase/branchQueries';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Share2,
  Plus,
  Copy,
  CheckCircle,
  ExternalLink,
  MessageCircle,
  QrCode,
  Download,
  Trash2,
  Edit,
  Lock,
  Globe,
  TreePine,
  GitBranch,
  Eye,
  RefreshCw,
  ShieldCheck,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ShareTreeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultBranch?: Branch | null;
}

function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

export function ShareTreeDialog({
  open,
  onOpenChange,
  defaultBranch = null,
}: ShareTreeDialogProps) {
  const { persons, relationships, branches: storeBranches, isDemoMode } = useFamilyStore();

  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [branches, setBranches] = useState<Branch[]>(storeBranches);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [mode, setMode] = useState<'list' | 'form'>('list');
  const [editingLink, setEditingLink] = useState<ShareLink | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ShareLink | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);
  const [qrView, setQrView] = useState<{
    share: ShareLink;
    dataUrl: string;
    url: string;
  } | null>(null);

  const form = useForm<ShareLinkFormData>({
    resolver: zodResolver(ShareLinkFormSchema),
    defaultValues: {
      code: '',
      title: '',
      description: '',
      scopeType: 'full',
      branchId: '',
      rootPersonId: '',
      pinCode: '',
      hideLivingDetails: false,
    },
  });

  const watchTitle = form.watch('title');
  const watchScopeType = form.watch('scopeType');
  const watchBranchId = form.watch('branchId');
  const watchRootPersonId = form.watch('rootPersonId');
  const watchHideLiving = form.watch('hideLivingDetails');

  useEffect(() => {
    if (!open) return;
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultBranch]);

  // Auto-generate slug code from title when creating a new share link
  useEffect(() => {
    if (mode === 'form' && !editingLink && !codeManuallyEdited && watchTitle) {
      const base = slugifyTitle(watchTitle);
      if (base) {
        form.setValue('code', base, { shouldValidate: false });
      }
    }
  }, [watchTitle, mode, editingLink, codeManuallyEdited, form]);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [links, loadedBranches] = await Promise.all([
        getAllShareLinks(),
        isDemoMode ? Promise.resolve(storeBranches) : getAllBranches().catch(() => storeBranches),
      ]);
      setShareLinks(links);
      setBranches(loadedBranches);

      if (defaultBranch) {
        openCreateForBranch(defaultBranch, loadedBranches);
      } else if (links.length === 0) {
        openCreateForm();
      } else {
        setMode('list');
      }
    } catch (err) {
      console.error('Error loading share links:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateForm = () => {
    setEditingLink(null);
    setCodeManuallyEdited(false);
    const defaultTitle = 'Silsilah Keluarga Besar';
    form.reset({
      title: defaultTitle,
      code: `silsilah-keluarga-${Math.random().toString(36).slice(2, 6)}`,
      description: 'Tautan baca-saja untuk menjelajahi pohon silsilah keluarga secara interaktif.',
      scopeType: 'full',
      branchId: '',
      rootPersonId: '',
      pinCode: '',
      hideLivingDetails: false,
    });
    setMode('form');
  };

  const openCreateForBranch = (branch: Branch, branchList = branches) => {
    void branchList;
    setEditingLink(null);
    setCodeManuallyEdited(true);
    form.reset({
      title: `Silsilah ${branch.name}`,
      code: `pohon-${branch.code}`,
      description: branch.description || `Tampilan pohon silsilah khusus cabang ${branch.name}.`,
      scopeType: 'branch',
      branchId: branch.id,
      rootPersonId: branch.rootPersonId,
      pinCode: '',
      hideLivingDetails: false,
    });
    setMode('form');
  };

  const handleEditLink = (link: ShareLink) => {
    setEditingLink(link);
    setCodeManuallyEdited(true);
    form.reset({
      code: link.code,
      title: link.title,
      description: link.description || '',
      scopeType: link.scopeType,
      branchId: link.branchId || '',
      rootPersonId: link.rootPersonId || '',
      pinCode: link.pinCode || '',
      hideLivingDetails: link.hideLivingDetails,
    });
    setMode('form');
  };

  // Live preview of how many members & relationships will be included in this share link
  const scopedPreview = useMemo(() => {
    const selectedBranch =
      watchScopeType === 'branch' && watchBranchId
        ? branches.find((b) => b.id === watchBranchId) || null
        : null;

    return computeScopedShareData(persons, relationships, {
      scopeType: watchScopeType,
      branch: selectedBranch,
      rootPersonId:
        watchScopeType === 'branch'
          ? selectedBranch?.rootPersonId || watchRootPersonId || null
          : watchRootPersonId || null,
      hideLivingDetails: watchHideLiving,
    });
  }, [
    persons,
    relationships,
    branches,
    watchScopeType,
    watchBranchId,
    watchRootPersonId,
    watchHideLiving,
  ]);

  const onSubmit = async (data: ShareLinkFormData) => {
    const selectedBranch =
      data.scopeType === 'branch' && data.branchId
        ? branches.find((b) => b.id === data.branchId) || null
        : null;

    const effectiveRootPersonId =
      data.scopeType === 'branch'
        ? selectedBranch?.rootPersonId || data.rootPersonId || null
        : data.rootPersonId || null;

    if (data.scopeType === 'branch' && !selectedBranch && !effectiveRootPersonId) {
      toast.error('Pilih cabang atau tokoh kepala cabang terlebih dahulu');
      return;
    }

    setIsSaving(true);
    try {
      if (editingLink) {
        await updateShareLink(editingLink.id, {
          code: data.code,
          title: data.title,
          description: data.description,
          scopeType: data.scopeType,
          branch: selectedBranch,
          rootPersonId: effectiveRootPersonId,
          pinCode: data.pinCode,
          hideLivingDetails: data.hideLivingDetails,
          allPersons: persons,
          allRelationships: relationships,
        });
        toast.success('Tautan berbagi berhasil diperbarui & data disinkronkan!');
      } else {
        await createShareLink({
          code: data.code,
          title: data.title,
          description: data.description,
          scopeType: data.scopeType,
          branch: selectedBranch,
          rootPersonId: effectiveRootPersonId,
          pinCode: data.pinCode,
          hideLivingDetails: data.hideLivingDetails,
          allPersons: persons,
          allRelationships: relationships,
        });
        toast.success('Tautan baca-saja berhasil dibuat!');
      }

      const updatedLinks = await getAllShareLinks();
      setShareLinks(updatedLinks);
      setMode('list');
      setEditingLink(null);
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menyimpan tautan berbagi');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncSnapshot = async (link: ShareLink) => {
    const selectedBranch = link.branchId
      ? branches.find((b) => b.id === link.branchId) || null
      : null;
    try {
      await updateShareLink(link.id, {
        code: link.code,
        title: link.title,
        description: link.description,
        scopeType: link.scopeType,
        branch: selectedBranch,
        rootPersonId: link.rootPersonId,
        pinCode: link.pinCode,
        hideLivingDetails: link.hideLivingDetails,
        isActive: link.isActive,
        allPersons: persons,
        allRelationships: relationships,
      });
      const updatedLinks = await getAllShareLinks();
      setShareLinks(updatedLinks);
      toast.success(`Data silsilah "${link.title}" berhasil diperbarui ke versi terbaru!`);
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menyinkronkan data');
    }
  };

  const handleToggleActive = async (link: ShareLink, nextActive: boolean) => {
    await toggleShareLinkActive(link.id, nextActive);
    setShareLinks((prev) =>
      prev.map((item) => (item.id === link.id ? { ...item, isActive: nextActive } : item))
    );
    toast.success(nextActive ? 'Tautan diaktifkan' : 'Tautan dinonaktifkan sementara');
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteShareLink(deleteTarget.id);
    setShareLinks((prev) => prev.filter((item) => item.id !== deleteTarget.id));
    setDeleteTarget(null);
    toast.success('Tautan berbagi berhasil dihapus');
  };

  const getPublicShareUrl = (code: string) => `${window.location.origin}/view/${code}`;

  const copyShareUrl = (link: ShareLink) => {
    const url = getPublicShareUrl(link.code);
    navigator.clipboard.writeText(url);
    setCopiedCode(link.code);
    toast.success('Tautan baca-saja berhasil disalin!');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const shareViaWhatsApp = (link: ShareLink) => {
    const url = getPublicShareUrl(link.code);
    const pinLine =
      link.hasPin && link.pinCode
        ? `\n🔒 *Kode Akses / PIN:* ${link.pinCode}\n`
        : '';
    const msg =
      `Assalamu'alaikum / Halo keluarga besar 🙏\n\n` +
      `Mari jelajahi pohon silsilah interaktif *${link.title}* melalui tautan berikut:\n\n` +
      `🌳 ${url}\n` +
      pinLine +
      `\nAnda dapat melihat diagram pohon keluarga, mencari nama kerabat, dan menelusuri garis keturunan secara langsung tanpa perlu login.`;

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  };

  const openQrForShare = async (link: ShareLink) => {
    try {
      const url = getPublicShareUrl(link.code);
      const dataUrl = await QRCode.toDataURL(url, {
        width: 320,
        margin: 2,
        color: { dark: '#2c1e14', light: '#ffffff' },
      });
      setQrView({ share: link, dataUrl, url });
    } catch {
      toast.error('Gagal membuat QR Code');
    }
  };

  const sortedPersons = useMemo(
    () => [...persons].sort((a, b) => a.fullName.localeCompare(b.fullName, 'id')),
    [persons]
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[88dvh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2 pr-6">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <DialogTitle className="font-display text-lg">
                    {mode === 'form'
                      ? editingLink
                        ? 'Edit Tautan Baca-Saja'
                        : 'Buat Tautan Baca-Saja Baru'
                      : 'Tautan Baca-Saja Publik'}
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    {mode === 'form'
                      ? 'Atur cakupan silsilah dan opsi PIN keamanan untuk pengunjung'
                      : 'Bagikan pohon silsilah interaktif ke kerabat tanpa perlu login atau hak edit'}
                  </DialogDescription>
                </div>
              </div>

              {mode === 'list' ? (
                <Button size="sm" onClick={openCreateForm} className="shrink-0 gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  Buat Link
                </Button>
              ) : (
                shareLinks.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setMode('list');
                      setEditingLink(null);
                    }}
                    className="shrink-0 gap-1.5 text-xs"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Daftar Link
                  </Button>
                )
              )}
            </div>
          </DialogHeader>

          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span>Memuat daftar tautan...</span>
            </div>
          ) : mode === 'list' ? (
            <div className="space-y-3 pt-2">
              {shareLinks.length === 0 ? (
                <Card className="p-8 text-center rounded-2xl border-dashed space-y-3">
                  <Globe className="w-10 h-10 text-muted-foreground mx-auto stroke-[1.5]" />
                  <div>
                    <p className="font-medium text-sm">Belum ada tautan baca-saja</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Buat tautan untuk membagikan seluruh silsilah atau cabang tertentu lengkap dengan proteksi PIN opsional.
                    </p>
                  </div>
                  <Button size="sm" onClick={openCreateForm}>
                    <Plus className="w-4 h-4 mr-1.5" />
                    Buat Tautan Pertama
                  </Button>
                </Card>
              ) : (
                shareLinks.map((link) => {
                  const publicUrl = getPublicShareUrl(link.code);
                  const branchObj = link.branchId
                    ? branches.find((b) => b.id === link.branchId)
                    : null;
                  const rootPersonObj = link.rootPersonId
                    ? persons.find((p) => p.id === link.rootPersonId)
                    : null;

                  return (
                    <Card
                      key={link.id}
                      className={cn(
                        'p-4 rounded-2xl border transition-all space-y-3',
                        !link.isActive && 'opacity-60 bg-muted/30'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h3 className="font-display font-semibold text-base truncate">
                              {link.title}
                            </h3>
                            <Badge
                              variant={link.scopeType === 'full' ? 'default' : 'secondary'}
                              className="text-[10px] px-2 py-0"
                            >
                              {link.scopeType === 'full' ? (
                                <span className="flex items-center gap-1">
                                  <TreePine className="w-3 h-3" /> Seluruh Silsilah
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <GitBranch className="w-3 h-3" />{' '}
                                  {branchObj?.name ||
                                    (rootPersonObj ? `Keturunan ${rootPersonObj.fullName}` : 'Per Cabang')}
                                </span>
                              )}
                            </Badge>
                            {link.hasPin && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-2 py-0 border-amber-500/40 text-amber-600 dark:text-amber-400"
                              >
                                <Lock className="w-2.5 h-2.5 mr-1" />
                                PIN: {link.pinCode || 'Aktif'}
                              </Badge>
                            )}
                            {link.hideLivingDetails && (
                              <Badge variant="outline" className="text-[10px] px-2 py-0">
                                <ShieldCheck className="w-2.5 h-2.5 mr-1" />
                                Privasi Aktif
                              </Badge>
                            )}
                          </div>

                          {link.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {link.description}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground pt-0.5">
                            <span>{link.snapshotPersonsCount} anggota</span>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1">
                              <Eye className="w-3 h-3" /> {link.viewCount}x dilihat
                            </span>
                            <span>·</span>
                            <span>
                              Diperbarui{' '}
                              {new Date(link.updatedAt).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <Switch
                            checked={link.isActive}
                            onCheckedChange={(checked) => handleToggleActive(link, checked)}
                            title={link.isActive ? 'Tautan Aktif' : 'Tautan Nonaktif'}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Perbarui / Sinkronkan Data Pohon Terbaru"
                            onClick={() => handleSyncSnapshot(link)}
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Buka di Tab Baru"
                            onClick={() => window.open(publicUrl, '_blank', 'noopener,noreferrer')}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Edit Pengaturan Link"
                            onClick={() => handleEditLink(link)}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            title="Hapus Tautan"
                            onClick={() => setDeleteTarget(link)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* URL Pill */}
                      <div className="rounded-xl bg-muted/60 px-3 py-1.5 text-xs font-mono text-muted-foreground truncate">
                        {publicUrl}
                      </div>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => shareViaWhatsApp(link)}
                        >
                          <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
                          Bagikan WA
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => copyShareUrl(link)}
                        >
                          {copiedCode === link.code ? (
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
                          className="h-8 text-xs"
                          onClick={() => openQrForShare(link)}
                        >
                          <QrCode className="w-3.5 h-3.5 mr-1.5" />
                          QR Code
                        </Button>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          ) : (
            /* Create / Edit Form */
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
              {/* Scope Selection: Seluruh Silsilah vs Per Cabang */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Cakupan Silsilah yang Dibagikan *
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => form.setValue('scopeType', 'full')}
                    className={cn(
                      'flex items-start gap-3 rounded-xl border p-3 text-left transition-all',
                      watchScopeType === 'full'
                        ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                        : 'border-border hover:border-primary/40'
                    )}
                  >
                    <TreePine className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs sm:text-sm font-semibold">Seluruh Silsilah Keluarga</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Bagikan seluruh pohon keluarga besar ({persons.length} anggota)
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => form.setValue('scopeType', 'branch')}
                    className={cn(
                      'flex items-start gap-3 rounded-xl border p-3 text-left transition-all',
                      watchScopeType === 'branch'
                        ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                        : 'border-border hover:border-primary/40'
                    )}
                  >
                    <GitBranch className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs sm:text-sm font-semibold">Per Cabang / Trah Tertentu</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Hanya tampilkan 1 cabang keluarga beserta pasangan & keturunannya
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Branch or Root Person Selector when scopeType === 'branch' */}
              {watchScopeType === 'branch' && (
                <div className="rounded-xl border border-primary/25 bg-primary/5 p-3.5 space-y-3">
                  {branches.length > 0 && (
                    <div>
                      <Label className="text-xs font-medium">Pilih dari Cabang Terdaftar</Label>
                      <Select
                        value={watchBranchId || 'custom'}
                        onValueChange={(val) => {
                          if (val === 'custom') {
                            form.setValue('branchId', '');
                          } else {
                            form.setValue('branchId', val);
                            const found = branches.find((b) => b.id === val);
                            if (found) {
                              form.setValue('rootPersonId', found.rootPersonId);
                              if (!editingLink) {
                                form.setValue('title', `Silsilah ${found.name}`);
                                form.setValue('code', `pohon-${found.code}`);
                                setCodeManuallyEdited(true);
                              }
                            }
                          }
                        }}
                      >
                        <SelectTrigger className="mt-1 bg-background h-9 text-xs">
                          <SelectValue placeholder="Pilih cabang keluarga..." />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map((b) => (
                            <SelectItem key={b.id} value={b.id} className="text-xs">
                              {b.name} (Koordinator: {b.coordinatorName})
                            </SelectItem>
                          ))}
                          <SelectItem value="custom" className="text-xs font-medium text-primary">
                            + Pilih Tokoh Leluhur / Kepala Cabang Secara Manual...
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {(!watchBranchId || branches.length === 0) && (
                    <div>
                      <Label className="text-xs font-medium">
                        Pilih Tokoh Kepala Cabang / Leluhur Utama *
                      </Label>
                      <Select
                        value={watchRootPersonId || ''}
                        onValueChange={(val) => {
                          form.setValue('rootPersonId', val);
                          const p = persons.find((item) => item.id === val);
                          if (p && !editingLink) {
                            const title = `Silsilah Keluarga ${p.fullName}`;
                            form.setValue('title', title);
                            form.setValue('code', slugifyTitle(title));
                          }
                        }}
                      >
                        <SelectTrigger className="mt-1 bg-background h-9 text-xs">
                          <SelectValue placeholder="Pilih tokoh pusat cabang..." />
                        </SelectTrigger>
                        <SelectContent>
                          {sortedPersons.map((p) => (
                            <SelectItem key={p.id} value={p.id} className="text-xs">
                              {p.fullName}
                              {p.birthDate ? ` (${new Date(p.birthDate).getFullYear()})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}

              {/* Optional Root Focus Person for Full Tree */}
              {watchScopeType === 'full' && (
                <div>
                  <Label className="text-xs font-medium">
                    Fokus Awal Saat Pohon Dibuka (Opsional)
                  </Label>
                  <Select
                    value={watchRootPersonId || 'auto'}
                    onValueChange={(val) =>
                      form.setValue('rootPersonId', val === 'auto' ? '' : val)
                    }
                  >
                    <SelectTrigger className="mt-1 h-9 text-xs">
                      <SelectValue placeholder="Otomatis (Tokoh dengan relasi terbanyak)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto" className="text-xs">
                        Otomatis (Tokoh paling terhubung)
                      </SelectItem>
                      {sortedPersons.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">
                          {p.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Title & URL Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <Label htmlFor="share-title" className="text-xs font-medium">
                    Judul Silsilah *
                  </Label>
                  <Input
                    id="share-title"
                    {...form.register('title')}
                    placeholder="Silsilah Keluarga Besar..."
                    className="mt-1 h-9 text-xs"
                  />
                  {form.formState.errors.title && (
                    <p className="text-[11px] text-destructive mt-1">
                      {form.formState.errors.title.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="share-code" className="text-xs font-medium">
                    Kode URL Publik *
                  </Label>
                  <Input
                    id="share-code"
                    {...form.register('code', {
                      onChange: () => setCodeManuallyEdited(true),
                    })}
                    placeholder="keluarga-budi-santoso"
                    className="mt-1 h-9 text-xs font-mono"
                  />
                  {form.formState.errors.code && (
                    <p className="text-[11px] text-destructive mt-1">
                      {form.formState.errors.code.message}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    Link: {window.location.origin}/view/{form.watch('code') || '...'}
                  </p>
                </div>
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="share-desc" className="text-xs font-medium">
                  Catatan / Sambutan singkat (Opsional)
                </Label>
                <Textarea
                  id="share-desc"
                  {...form.register('description')}
                  placeholder="Contoh: Dokumentasi silsilah keluarga besar untuk reuni..."
                  rows={2}
                  className="mt-1 text-xs"
                />
              </div>

              {/* Security & Privacy Settings: PIN & Living Member Masking */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 rounded-xl border border-border/80 bg-muted/25 p-3.5">
                <div className="space-y-1.5">
                  <Label htmlFor="share-pin" className="text-xs font-semibold flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-primary" />
                    Proteksi PIN / Kode Akses (Opsional)
                  </Label>
                  <Input
                    id="share-pin"
                    {...form.register('pinCode')}
                    placeholder="Kosongkan jika tanpa PIN (misal: 1234)"
                    className="h-8 text-xs font-mono bg-background"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Jika diisi, pengunjung wajib memasukkan kode ini sebelum bisa melihat pohon silsilah.
                  </p>
                </div>

                <div className="space-y-2 flex flex-col justify-between">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Label
                        htmlFor="hide-living"
                        className="text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                        Samarkan Detail Anggota Hidup
                      </Label>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Hanya tampilkan tahun lahir (tanpa tanggal lengkap) dan sembunyikan catatan pribadi untuk anggota yang masih hidup.
                      </p>
                    </div>
                    <Switch
                      id="hide-living"
                      checked={watchHideLiving}
                      onCheckedChange={(checked) => form.setValue('hideLivingDetails', checked)}
                    />
                  </div>
                </div>
              </div>

              {/* Live Preview Counter */}
              <div className="flex items-center justify-between rounded-xl border border-primary/25 bg-primary/5 px-3.5 py-2.5 text-xs">
                <span className="text-muted-foreground">
                  Data yang akan disertakan dalam tautan ini:
                </span>
                <span className="font-semibold text-foreground">
                  {scopedPreview.persons.length} anggota · {scopedPreview.relationships.length} relasi
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                {shareLinks.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setMode('list');
                      setEditingLink(null);
                    }}
                  >
                    Batal
                  </Button>
                )}
                <Button type="submit" disabled={isSaving || scopedPreview.persons.length === 0}>
                  {isSaving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                  {editingLink ? 'Simpan & Sinkronkan' : 'Buat Tautan Baca-Saja'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* QR Code Modal */}
      <Dialog open={!!qrView} onOpenChange={(o) => !o && setQrView(null)}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="font-display">QR Code Pohon Silsilah</DialogTitle>
            <DialogDescription>
              Pindai untuk membuka tampilan baca-saja <strong>{qrView?.share.title}</strong>
            </DialogDescription>
          </DialogHeader>
          {qrView && (
            <div className="space-y-4 py-2">
              <div className="mx-auto w-fit rounded-2xl border bg-white p-3 shadow-sm">
                <img
                  src={qrView.dataUrl}
                  alt={`QR Code ${qrView.share.title}`}
                  className="w-56 h-56"
                />
              </div>
              {qrView.share.hasPin && qrView.share.pinCode && (
                <Badge variant="secondary" className="text-xs">
                  <Lock className="w-3 h-3 mr-1" />
                  PIN Akses: {qrView.share.pinCode}
                </Badge>
              )}
              <p className="text-xs font-mono text-muted-foreground break-all">{qrView.url}</p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => copyShareUrl(qrView.share)}>
                  <Copy className="w-4 h-4 mr-1.5" />
                  Salin Link
                </Button>
                <Button
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = qrView.dataUrl;
                    a.download = `qr-silsilah-${qrView.share.code}.png`;
                    a.click();
                  }}
                >
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
            <AlertDialogTitle>Hapus Tautan Baca-Saja?</AlertDialogTitle>
            <AlertDialogDescription>
              Tautan <strong>{deleteTarget?.title}</strong> tidak akan bisa diakses lagi oleh kerabat yang memiliki link tersebut. Data silsilah utama Anda tidak akan terhapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus Tautan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
