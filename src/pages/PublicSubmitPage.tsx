import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ApprovedMembersCard } from '@/components/submission/ApprovedMembersCard';
import { getBranchByCode } from '@/storage/supabase/branchQueries';
import { getApprovedMembersByBranch, createSubmission } from '@/storage/supabase/submissionQueries';
import { useFamilyStore } from '@/store/familyStore';
import { SubmissionFormSchema, type SubmissionFormData, type Branch, type ApprovedMemberInfo } from '@/types';
import { CheckCircle, AlertCircle, Loader2, Users } from 'lucide-react';

export default function PublicSubmitPage() {
    const { branchCode } = useParams<{ branchCode: string }>();
    const navigate = useNavigate();
    const { findDuplicates } = useFamilyStore();

    const [branch, setBranch] = useState<Branch | null>(null);
    const [approvedMembers, setApprovedMembers] = useState<ApprovedMemberInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const form = useForm<SubmissionFormData>({
        resolver: zodResolver(SubmissionFormSchema),
        defaultValues: {
            submittedBy: '',
            submitterEmail: '',
            fullName: '',
            gender: 'male',
            birthDate: '',
            birthPlace: '',
            notes: '',
            relationToBranch: 'child',
            parentName: '',
        },
    });

    const watchRelation = form.watch('relationToBranch');
    const needsParent = watchRelation === 'grandchild' || watchRelation === 'great-grandchild';

    useEffect(() => {
        async function loadData() {
            if (!branchCode) return;

            try {
                setIsLoading(true);
                setError(null);

                // Load branch
                const branchData = await getBranchByCode(branchCode);
                if (!branchData) {
                    setError('Cabang keluarga tidak ditemukan atau tidak aktif');
                    return;
                }
                setBranch(branchData);

                // Load approved members
                const members = await getApprovedMembersByBranch(branchData.id);
                setApprovedMembers(members);
            } catch (err) {
                console.error('Error loading data:', err);
                setError('Gagal memuat data cabang');
            } finally {
                setIsLoading(false);
            }
        }

        loadData();
    }, [branchCode]);

    const onSubmit = async (data: SubmissionFormData) => {
        if (!branch) return;

        try {
            setIsSubmitting(true);
            setError(null);

            // Check for duplicates
            const duplicates = findDuplicates(data.fullName, data.birthDate);
            const possibleDuplicateId = duplicates.length > 0 ? duplicates[0].id : undefined;

            // Create submission
            await createSubmission({
                branchId: branch.id,
                submittedBy: data.submittedBy,
                submitterEmail: data.submitterEmail || undefined,
                fullName: data.fullName,
                gender: data.gender,
                birthDate: data.birthDate || undefined,
                birthPlace: data.birthPlace || undefined,
                deathDate: data.deathDate || undefined,
                deathPlace: data.deathPlace || undefined,
                residence: data.residence || undefined,
                photoUrl: data.photoUrl || undefined,
                notes: data.notes || undefined,
                relationToBranch: data.relationToBranch,
                parentName: needsParent ? data.parentName : undefined,
                possibleDuplicateId,
            });

            setSubmitSuccess(true);
            form.reset();
        } catch (err) {
            console.error('Error submitting:', err);
            setError('Gagal mengirim data. Silakan coba lagi.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-primary/5 to-background flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
                    <p className="text-muted-foreground">Memuat formulir...</p>
                </div>
            </div>
        );
    }

    if (error && !branch) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-primary/5 to-background flex items-center justify-center p-4">
                <Card className="max-w-md p-8 text-center">
                    <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
                    <h2 className="text-xl font-semibold mb-2">Cabang Tidak Ditemukan</h2>
                    <p className="text-muted-foreground mb-4">{error}</p>
                    <p className="text-sm text-muted-foreground">
                        Pastikan link yang Anda gunakan benar atau hubungi coordinator cabang.
                    </p>
                </Card>
            </div>
        );
    }

    if (submitSuccess) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-primary/5 to-background flex items-center justify-center p-4">
                <Card className="max-w-md p-8 text-center">
                    <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
                    <h2 className="text-2xl font-semibold mb-2">Data Berhasil Dikirim!</h2>
                    <p className="text-muted-foreground mb-6">
                        Terima kasih telah mengisi data. Data Anda akan direview oleh admin dan akan ditambahkan ke silsilah keluarga.
                    </p>
                    <div className="flex flex-col gap-2">
                        <Button onClick={() => setSubmitSuccess(false)}>
                            Tambah Anggota Lain
                        </Button>
                        <Button variant="outline" onClick={() => window.location.reload()}>
                            Muat Ulang Halaman
                        </Button>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/5 to-background">
            {/* Header */}
            <div className="bg-card border-b">
                <div className="container max-w-4xl mx-auto px-4 py-6">
                    <div className="flex items-center gap-3">
                        <Users className="w-8 h-8 text-primary" />
                        <div>
                            <h1 className="text-2xl font-display font-bold">Tambah Anggota Keluarga</h1>
                            <p className="text-muted-foreground">
                                Cabang: <span className="font-medium">{branch?.name}</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="container max-w-4xl mx-auto px-4 py-8 space-y-6">
                {/* Approved Members */}
                {approvedMembers.length > 0 && (
                    <ApprovedMembersCard members={approvedMembers} branchName={branch?.name || ''} />
                )}

                {/* Submission Form */}
                <Card className="p-6">
                    <h2 className="text-xl font-semibold mb-4">Formulir Data Anggota Baru</h2>
                    <p className="text-sm text-muted-foreground mb-6">
                        Silakan isi data Anda atau anggota keluarga yang ingin ditambahkan. Semua data akan direview terlebih dahulu sebelum ditambahkan ke silsilah.
                    </p>

                    {error && (
                        <Alert variant="destructive" className="mb-4">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        {/* Submitter Info */}
                        <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                            <h3 className="font-medium">Informasi Pengisi</h3>

                            <div>
                                <Label htmlFor="submittedBy">Nama Anda *</Label>
                                <Input
                                    id="submittedBy"
                                    {...form.register('submittedBy')}
                                    placeholder="Nama lengkap Anda"
                                />
                                {form.formState.errors.submittedBy && (
                                    <p className="text-sm text-destructive mt-1">{form.formState.errors.submittedBy.message}</p>
                                )}
                            </div>

                            <div>
                                <Label htmlFor="submitterEmail">Email Anda (Opsional)</Label>
                                <Input
                                    id="submitterEmail"
                                    type="email"
                                    {...form.register('submitterEmail')}
                                    placeholder="email@example.com"
                                />
                                {form.formState.errors.submitterEmail && (
                                    <p className="text-sm text-destructive mt-1">{form.formState.errors.submitterEmail.message}</p>
                                )}
                            </div>
                        </div>

                        {/* Personal Info */}
                        <div className="space-y-4">
                            <h3 className="font-medium">Data Pribadi</h3>

                            <div>
                                <Label htmlFor="fullName">Nama Lengkap *</Label>
                                <Input
                                    id="fullName"
                                    {...form.register('fullName')}
                                    placeholder="Nama lengkap anggota keluarga"
                                />
                                {form.formState.errors.fullName && (
                                    <p className="text-sm text-destructive mt-1">{form.formState.errors.fullName.message}</p>
                                )}
                            </div>

                            <div>
                                <Label>Jenis Kelamin *</Label>
                                <RadioGroup
                                    value={form.watch('gender')}
                                    onValueChange={(value) => form.setValue('gender', value as any)}
                                    className="flex gap-4 mt-2"
                                >
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="male" id="male" />
                                        <Label htmlFor="male" className="cursor-pointer">Laki-laki</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="female" id="female" />
                                        <Label htmlFor="female" className="cursor-pointer">Perempuan</Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="birthDate">Tanggal Lahir</Label>
                                    <Input
                                        id="birthDate"
                                        type="date"
                                        {...form.register('birthDate')}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="birthPlace">Tempat Lahir</Label>
                                    <Input
                                        id="birthPlace"
                                        {...form.register('birthPlace')}
                                        placeholder="Kota/Kabupaten"
                                    />
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="notes">Catatan (Opsional)</Label>
                                <Textarea
                                    id="notes"
                                    {...form.register('notes')}
                                    placeholder="Informasi tambahan..."
                                    rows={3}
                                    maxLength={500}
                                />
                                <p className="text-xs text-muted-foreground mt-1">Maksimal 500 karakter</p>
                            </div>
                        </div>

                        {/* Relationship */}
                        <div className="space-y-4">
                            <h3 className="font-medium">Hubungan Keluarga</h3>

                            <div>
                                <Label>Hubungan dengan {branch?.name} *</Label>
                                <RadioGroup
                                    value={form.watch('relationToBranch')}
                                    onValueChange={(value) => form.setValue('relationToBranch', value as any)}
                                    className="space-y-2 mt-2"
                                >
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="child" id="child" />
                                        <Label htmlFor="child" className="cursor-pointer">Anak</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="grandchild" id="grandchild" />
                                        <Label htmlFor="grandchild" className="cursor-pointer">Cucu</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="great-grandchild" id="great-grandchild" />
                                        <Label htmlFor="great-grandchild" className="cursor-pointer">Cicit</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="other" id="other" />
                                        <Label htmlFor="other" className="cursor-pointer">Lainnya</Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            {needsParent && (
                                <div>
                                    <Label htmlFor="parentName">Nama Orang Tua</Label>
                                    <Input
                                        id="parentName"
                                        {...form.register('parentName')}
                                        placeholder="Nama ayah atau ibu"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Untuk {watchRelation === 'grandchild' ? 'cucu' : 'cicit'}, mohon isi siapa orang tuanya
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Submit */}
                        <div className="flex gap-2 pt-4 border-t">
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex-1"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Mengirim...
                                    </>
                                ) : (
                                    'Kirim Data'
                                )}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => form.reset()}
                                disabled={isSubmitting}
                            >
                                Reset
                            </Button>
                        </div>
                    </form>
                </Card>
            </div>
        </div>
    );
}
