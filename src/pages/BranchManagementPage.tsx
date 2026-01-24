import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Plus, Link as LinkIcon, Edit, Trash2, QrCode, Copy, CheckCircle } from 'lucide-react';
import { getAllBranches, createBranch, updateBranch, deleteBranch } from '@/storage/supabase/branchQueries';
import { useFamilyStore } from '@/store/familyStore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BranchFormSchema, type BranchFormData, type Branch } from '@/types';
import { toast } from 'sonner';

export default function BranchManagementPage() {
    const { persons, loadData } = useFamilyStore();
    const [branches, setBranches] = useState<Branch[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

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

    useEffect(() => {
        // Data is already loaded globally by Layout
        // loadData(); // Don't need to load again
        fetchBranches();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run once on mount

    const fetchBranches = async () => {
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
            if (editingBranch) {
                // Update
                await updateBranch(editingBranch.id, data);
                toast.success('Cabang berhasil diperbarui');
            } else {
                // Create
                await createBranch({
                    ...data,
                    isActive: true,
                } as any);
                toast.success('Cabang berhasil dibuat');
            }

            fetchBranches();
            setIsCreateOpen(false);
            setEditingBranch(null);
            form.reset();
        } catch (error) {
            console.error('Error saving branch:', error);
            toast.error('Gagal menyimpan cabang');
        }
    };

    const handleEdit = (branch: Branch) => {
        setEditingBranch(branch);
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

    const handleDelete = async (id: string) => {
        if (!confirm('Yakin ingin menghapus cabang ini? Semua submission akan ikut terhapus.')) {
            return;
        }

        try {
            await deleteBranch(id);
            toast.success('Cabang berhasil dihapus');
            fetchBranches();
        } catch (error) {
            console.error('Error deleting branch:', error);
            toast.error('Gagal menghapus cabang');
        }
    };

    const copyLink = (code: string) => {
        const link = `${window.location.origin}/submit/${code}`;
        navigator.clipboard.writeText(link);
        setCopiedCode(code);
        toast.success('Link berhasil disalin!');
        setTimeout(() => setCopiedCode(null), 2000);
    };

    const generateQRCode = (code: string) => {
        const link = `${window.location.origin}/submit/${code}`;
        // For MVP, we'll just copy the link. Full QR generation can be added later
        window.open(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(link)}`, '_blank');
    };

    return (
        <div className="container max-w-6xl mx-auto p-6 space-y-8">
            {/* Header */}
            <div className="flex justify-between items-start gap-4">
                <div>
                    <h1 className="text-2xl font-display font-bold">Branch Management</h1>
                    <p className="text-muted-foreground">Kelola cabang keluarga dan form submission</p>
                </div>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={() => { setEditingBranch(null); form.reset(); }}>
                            <Plus className="w-4 h-4 mr-2" />
                            Tambah Cabang
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>{editingBranch ? 'Edit Cabang' : 'Tambah Cabang Baru'}</DialogTitle>
                            <DialogDescription>
                                Buat cabang keluarga dengan form submission unik
                            </DialogDescription>
                        </DialogHeader>

                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="code">Kode URL *</Label>
                                    <Input
                                        id="code"
                                        {...form.register('code')}
                                        placeholder="family-budi"
                                        className="font-mono"
                                    />
                                    {form.formState.errors.code && (
                                        <p className="text-sm text-destructive mt-1">{form.formState.errors.code.message}</p>
                                    )}
                                    <p className="text-xs text-muted-foreground mt-1">Hanya huruf kecil, angka, dan tanda hubung</p>
                                </div>

                                <div>
                                    <Label htmlFor="name">Nama Cabang *</Label>
                                    <Input
                                        id="name"
                                        {...form.register('name')}
                                        placeholder="Keluarga Budi Santoso"
                                    />
                                    {form.formState.errors.name && (
                                        <p className="text-sm text-destructive mt-1">{form.formState.errors.name.message}</p>
                                    )}
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="rootPersonId">Kepala Cabang *</Label>
                                <Select
                                    value={form.watch('rootPersonId')}
                                    onValueChange={(value) => form.setValue('rootPersonId', value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih kepala cabang" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {persons.map((person) => (
                                            <SelectItem key={person.id} value={person.id}>
                                                {person.fullName}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {form.formState.errors.rootPersonId && (
                                    <p className="text-sm text-destructive mt-1">{form.formState.errors.rootPersonId.message}</p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="coordinatorName">Nama Koordinator *</Label>
                                    <Input
                                        id="coordinatorName"
                                        {...form.register('coordinatorName')}
                                        placeholder="Nama koordinator cabang"
                                    />
                                    {form.formState.errors.coordinatorName && (
                                        <p className="text-sm text-destructive mt-1">{form.formState.errors.coordinatorName.message}</p>
                                    )}
                                </div>

                                <div>
                                    <Label htmlFor="coordinatorEmail">Email Koordinator</Label>
                                    <Input
                                        id="coordinatorEmail"
                                        type="email"
                                        {...form.register('coordinatorEmail')}
                                        placeholder="email@example.com"
                                    />
                                    {form.formState.errors.coordinatorEmail && (
                                        <p className="text-sm text-destructive mt-1">{form.formState.errors.coordinatorEmail.message}</p>
                                    )}
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="description">Deskripsi</Label>
                                <Textarea
                                    id="description"
                                    {...form.register('description')}
                                    placeholder="Keterangan tambahan tentang cabang ini..."
                                    rows={3}
                                />
                            </div>

                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => { setIsCreateOpen(false); form.reset(); }}>
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
                    <p className="text-muted-foreground">Memuat data...</p>
                </div>
            ) : branches.length === 0 ? (
                <Card className="p-8 text-center max-w-md mx-auto">
                    <p className="text-muted-foreground mb-4">Belum ada cabang dibuat</p>
                    <Button onClick={() => setIsCreateOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Buat Cabang Pertama
                    </Button>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {branches.map((branch) => (
                        <Card key={branch.id} className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-semibold text-lg">{branch.name}</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Koordinator: {branch.coordinatorName}
                                    </p>
                                </div>
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="sm" onClick={() => handleEdit(branch)}>
                                        <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(branch.id)}>
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                    </Button>
                                </div>
                            </div>

                            {branch.description && (
                                <p className="text-sm text-muted-foreground mb-4">{branch.description}</p>
                            )}

                            <div className="flex items-center justify-between mb-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Submissions: </span>
                                    <span className="font-medium">{branch.submissionCount}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Approved: </span>
                                    <span className="font-medium text-success">{branch.approvedCount}</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 text-xs bg-muted p-2 rounded">
                                        {window.location.origin}/submit/{branch.code}
                                    </code>
                                </div>

                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1"
                                        onClick={() => copyLink(branch.code)}
                                    >
                                        {copiedCode === branch.code ? (
                                            <>
                                                <CheckCircle className="w-4 h-4 mr-2 text-success" />
                                                Tersalin!
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="w-4 h-4 mr-2" />
                                                Copy Link
                                            </>
                                        )}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1"
                                        onClick={() => generateQRCode(branch.code)}
                                    >
                                        <QrCode className="w-4 h-4 mr-2" />
                                        QR Code
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
