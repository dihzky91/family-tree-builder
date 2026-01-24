import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Check, X, FileCheck, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { getAllSubmissions, updateSubmissionStatus } from '@/storage/supabase/submissionQueries';
import { getAllBranches, incrementBranchApprovedCount } from '@/storage/supabase/branchQueries';
import { useFamilyStore } from '@/store/familyStore';
import type { Submission, Branch } from '@/types';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

export default function SubmissionReviewPage() {
    const { addPerson, addRelationship, persons } = useFamilyStore();
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>('all');
    const [selectedStatus, setSelectedStatus] = useState<string>('pending');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, [selectedBranch, selectedStatus]);

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const [submissionsData, branchesData] = await Promise.all([
                getAllSubmissions(selectedBranch === 'all' ? undefined : selectedBranch),
                getAllBranches(),
            ]);

            // Filter by status
            const filtered = selectedStatus === 'all'
                ? submissionsData
                : submissionsData.filter(s => s.status === selectedStatus);

            setSubmissions(filtered);
            setBranches(branchesData);
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Gagal memuat data');
        } finally {
            setIsLoading(false);
        }
    };

    const getBranchName = (branchId: string) => {
        const branch = branches.find(b => b.id === branchId);
        return branch?.name || 'Unknown';
    };

    const handleApprove = async (submission: Submission) => {
        try {
            // 1. Create person from submission
            const person = await addPerson({
                fullName: submission.fullName,
                gender: submission.gender,
                birthDate: submission.birthDate || null,
                birthPlace: submission.birthPlace || null,
                deathDate: submission.deathDate || null,
                deathPlace: submission.deathPlace || null,
                residence: submission.residence || null,
                photoUrl: submission.photoUrl || null,
                notes: submission.notes || null,
                tags: [],
                confidenceScore: 50,
            });

            // 2. Create relationship to branch root
            const branch = branches.find(b => b.id === submission.branchId);
            if (branch) {
                if (submission.relationToBranch === 'child') {
                    // Direct child of root
                    await addRelationship({
                        type: 'PARENT_CHILD',
                        fromPersonId: branch.rootPersonId,
                        toPersonId: person.id,
                    });
                } else if (submission.relationToBranch === 'grandchild') {
                    // Try to find parent by name
                    if (submission.parentName) {
                        const parent = persons.find(p =>
                            p.fullName.toLowerCase().includes(submission.parentName!.toLowerCase())
                        );
                        if (parent) {
                            await addRelationship({
                                type: 'PARENT_CHILD',
                                fromPersonId: parent.id,
                                toPersonId: person.id,
                            });
                        }
                    }
                }
            }

            // 3. Update submission status
            await updateSubmissionStatus(
                submission.id,
                'approved',
                undefined, // reviewedBy (TODO: add auth user ID)
                undefined, // reviewNotes
                person.id  // createdPersonId
            );

            // 4. Increment branch approved count
            await incrementBranchApprovedCount(submission.branchId);

            toast.success(`${submission.fullName} berhasil disetujui!`);
            fetchData();
        } catch (error) {
            console.error('Error approving submission:', error);
            toast.error('Gagal menyetujui submission');
        }
    };

    const handleReject = async (submission: Submission) => {
        try {
            await updateSubmissionStatus(
                submission.id,
                'rejected',
                undefined,
                'Ditolak oleh admin'
            );

            toast.success('Submission ditolak');
            fetchData();
        } catch (error) {
            console.error('Error rejecting submission:', error);
            toast.error('Gagal menolak submission');
        }
    };

    const pendingCount = submissions.filter(s => s.status === 'pending').length;
    const approvedCount = submissions.filter(s => s.status === 'approved').length;
    const rejectedCount = submissions.filter(s => s.status === 'rejected').length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-display font-bold">Review Submissions</h1>
                <p className="text-muted-foreground">Tinjau dan setujui data yang disubmit oleh anggota keluarga</p>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground">Pending</p>
                            <p className="text-2xl font-bold">{pendingCount}</p>
                        </div>
                        <Clock className="w-8 h-8 text-warning" />
                    </div>
                </Card>
                <Card className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground">Approved</p>
                            <p className="text-2xl font-bold text-success">{approvedCount}</p>
                        </div>
                        <CheckCircle className="w-8 h-8 text-success" />
                    </div>
                </Card>
                <Card className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground">Rejected</p>
                            <p className="text-2xl font-bold text-destructive">{rejectedCount}</p>
                        </div>
                        <XCircle className="w-8 h-8 text-destructive" />
                    </div>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex gap-4">
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Semua Cabang" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Cabang</SelectItem>
                        {branches.map(branch => (
                            <SelectItem key={branch.id} value={branch.id}>
                                {branch.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Submissions List */}
            {isLoading ? (
                <div className="text-center py-12">
                    <p className="text-muted-foreground">Memuat data...</p>
                </div>
            ) : submissions.length === 0 ? (
                <Card className="p-12 text-center">
                    <FileCheck className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Tidak ada submission</p>
                </Card>
            ) : (
                <div className="space-y-4">
                    {submissions.map((submission) => (
                        <Card key={submission.id} className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-lg font-semibold">{submission.fullName}</h3>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                        <span>{submission.gender === 'male' ? '♂' : '♀'}</span>
                                        {submission.birthDate && <span>• Lahir: {submission.birthDate}</span>}
                                        {submission.birthPlace && <span>• {submission.birthPlace}</span>}
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                        <Badge variant="outline">{getBranchName(submission.branchId)}</Badge>
                                        <Badge variant="outline">{submission.relationToBranch}</Badge>
                                        {submission.parentName && (
                                            <Badge variant="outline">dari {submission.parentName}</Badge>
                                        )}
                                    </div>
                                </div>
                                <Badge
                                    variant={
                                        submission.status === 'approved' ? 'default' :
                                            submission.status === 'rejected' ? 'destructive' : 'secondary'
                                    }
                                >
                                    {submission.status}
                                </Badge>
                            </div>

                            {submission.notes && (
                                <p className="text-sm text-muted-foreground mb-4 p-3 bg-muted/50 rounded">
                                    {submission.notes}
                                </p>
                            )}

                            <div className="text-xs text-muted-foreground mb-4">
                                <p>Disubmit oleh: {submission.submittedBy}</p>
                                {submission.submitterEmail && <p>Email: {submission.submitterEmail}</p>}
                                <p>Waktu: {formatDistanceToNow(new Date(submission.createdAt), { addSuffix: true, locale: localeId })}</p>
                            </div>

                            {/* Duplicate Warning */}
                            {submission.possibleDuplicateId && (
                                <Alert variant="destructive" className="mb-4">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertDescription>
                                        ⚠️ Kemungkinan duplikat terdeteksi! Periksa data sebelum approve.
                                    </AlertDescription>
                                </Alert>
                            )}

                            {/* Actions */}
                            {submission.status === 'pending' && (
                                <div className="flex gap-2 pt-4 border-t">
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="default" className="flex-1">
                                                <Check className="w-4 h-4 mr-2" />
                                                Approve
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Approve Submission?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Data "{submission.fullName}" akan ditambahkan ke silsilah keluarga.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleApprove(submission)}>
                                                    Ya, Approve
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>

                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="destructive" className="flex-1">
                                                <X className="w-4 h-4 mr-2" />
                                                Reject
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Reject Submission?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Data "{submission.fullName}" tidak akan ditambahkan.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleReject(submission)}>
                                                    Ya, Reject
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            )}

                            {submission.status === 'approved' && submission.createdPersonId && (
                                <div className="pt-4 border-t">
                                    <p className="text-sm text-success flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4" />
                                        Sudah ditambahkan ke silsilah
                                    </p>
                                </div>
                            )}
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
