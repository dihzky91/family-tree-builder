import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatFlexibleDate, formatShortYearLabel } from '@/lib/flexibleDateUtils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Check,
  X,
  FileCheck,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Link2,
  MapPin,
  Home,
  Users,
  CheckCheck,
  Layers,
  UserPlus,
  Sparkles,
} from 'lucide-react';
import { getAllSubmissions, updateSubmissionStatus } from '@/storage/supabase/submissionQueries';
import { getAllBranches, incrementBranchApprovedCount } from '@/storage/supabase/branchQueries';
import { syncAllActiveShareSnapshots } from '@/storage/supabase/shareQueries';
import { formatRelationLabel } from '@/components/submission/ApprovedMembersCard';
import { notifySubmissionsChanged } from '@/hooks/usePendingSubmissionCount';
import { useFamilyStore } from '@/store/familyStore';
import { getDemoData } from '@/data/demoData';
import type { Submission, Branch, Person } from '@/types';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

type LinkType = 'update_existing' | 'child_of' | 'sibling_of' | 'spouse_of' | 'none';

type BridgeLinkType = 'child_of' | 'sibling_of' | 'spouse_of' | 'none';

interface SubmissionGroup {
  key: string;
  submittedBy: string;
  branchId: string;
  items: Submission[];
}

export default function SubmissionReviewPage() {
  const { addPerson, updatePerson, addRelationship, persons, relationships, isDemoMode } = useFamilyStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [demoSubmissionsCache, setDemoSubmissionsCache] = useState<Submission[] | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>(
    () => searchParams.get('branch') || 'all'
  );
  const [selectedStatus, setSelectedStatus] = useState<string>('pending');
  const [groupBySubmitter, setGroupBySubmitter] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isBatchApproving, setIsBatchApproving] = useState<string | null>(null);

  // Interactive Approve & Link modal state
  const [approveTarget, setApproveTarget] = useState<Submission | null>(null);
  const [linkType, setLinkType] = useState<LinkType>('child_of');
  const [targetPersonId, setTargetPersonId] = useState<string>('');
  const [createBridgePerson, setCreateBridgePerson] = useState<boolean>(false);
  const [bridgePersonName, setBridgePersonName] = useState<string>('');
  const [bridgeLinkType, setBridgeLinkType] = useState<BridgeLinkType>('sibling_of');
  const [bridgeTargetPersonId, setBridgeTargetPersonId] = useState<string>('');
  const [isApproving, setIsApproving] = useState(false);

  const sortedPersons = useMemo(
    () => [...persons].sort((a, b) => a.fullName.localeCompare(b.fullName, 'id')),
    [persons]
  );

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch, selectedStatus]);

  const fetchData = async () => {
    if (isDemoMode) {
      const demo = getDemoData();
      const sourceSubs = demoSubmissionsCache ?? demo.submissions;
      if (!demoSubmissionsCache) {
        setDemoSubmissionsCache(demo.submissions);
      }
      const byBranch =
        selectedBranch === 'all'
          ? sourceSubs
          : sourceSubs.filter((s) => s.branchId === selectedBranch);
      const filtered =
        selectedStatus === 'all'
          ? byBranch
          : byBranch.filter((s) => s.status === selectedStatus);
      setSubmissions(filtered);
      setBranches(demo.branches);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const [submissionsData, branchesData] = await Promise.all([
        getAllSubmissions(selectedBranch === 'all' ? undefined : selectedBranch),
        getAllBranches(),
      ]);

      const filtered =
        selectedStatus === 'all'
          ? submissionsData
          : submissionsData.filter((s) => s.status === selectedStatus);

      setSubmissions(filtered);
      setBranches(branchesData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Gagal memuat data submisi');
    } finally {
      setIsLoading(false);
    }
  };

  const groupedSubmissions = useMemo<SubmissionGroup[]>(() => {
    const map = new Map<string, SubmissionGroup>();
    submissions.forEach((sub) => {
      const key = `${sub.branchId}::${sub.submittedBy.trim().toLowerCase()}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          submittedBy: sub.submittedBy,
          branchId: sub.branchId,
          items: [],
        });
      }
      map.get(key)!.items.push(sub);
    });
    return Array.from(map.values());
  }, [submissions]);

  const getBranchName = (branchId: string) => {
    const branch = branches.find((b) => b.id === branchId);
    return branch?.name || 'Tidak diketahui';
  };

  const getStatusLabel = (status: Submission['status']) => {
    switch (status) {
      case 'pending':
        return 'Menunggu';
      case 'approved':
        return 'Disetujui';
      case 'rejected':
        return 'Ditolak';
      default:
        return status;
    }
  };

  const inferAutoLink = (
    submission: Submission,
    availablePersons: Person[]
  ): {
    linkType: LinkType;
    targetPersonId: string;
    missingConnectorName: string | null;
    branchRootId: string;
  } => {
    const branch = branches.find((b) => b.id === submission.branchId);
    const branchRootId = branch?.rootPersonId || '';
    const rawConnector = submission.parentName?.trim() || '';
    const lowerConnector = rawConnector.toLowerCase();

    const isUpdateHint = lowerConnector.startsWith('pembaruan data anggota');
    const isSiblingHint = lowerConnector.startsWith('saudara kandung dari ');
    const isSpouseHint =
      !isSiblingHint &&
      !isUpdateHint &&
      (submission.relationToBranch === 'other' ||
        lowerConnector.startsWith('pasangan dari '));

    // Check if this submission is meant to update an existing person in the tree
    const matchedExistingById = submission.possibleDuplicateId
      ? availablePersons.find((p) => p.id === submission.possibleDuplicateId)
      : undefined;
    const matchedExistingByName = availablePersons.find(
      (p) => p.fullName.trim().toLowerCase() === submission.fullName.trim().toLowerCase()
    );
    const existingCandidate = matchedExistingById || matchedExistingByName;

    if (isUpdateHint && existingCandidate) {
      return {
        linkType: 'update_existing',
        targetPersonId: existingCandidate.id,
        missingConnectorName: null,
        branchRootId,
      };
    }

    const cleanedRawName = rawConnector
      .replace(/^pasangan dari\s+/i, '')
      .replace(/^saudara kandung dari\s+/i, '')
      .trim();
    const cleanedSearchName = cleanedRawName.toLowerCase();

    if (submission.relationToBranch === 'child' && branchRootId) {
      return {
        linkType: 'child_of',
        targetPersonId: branchRootId,
        missingConnectorName: null,
        branchRootId,
      };
    }

    if (isSiblingHint) {
      const matched = cleanedSearchName
        ? availablePersons.find(
            (p) =>
              p.fullName.toLowerCase() === cleanedSearchName ||
              p.fullName.toLowerCase().includes(cleanedSearchName)
          )
        : undefined;
      return {
        linkType: 'sibling_of',
        targetPersonId: matched?.id || branchRootId,
        missingConnectorName: null,
        branchRootId,
      };
    }

    if (cleanedSearchName) {
      const matched = availablePersons.find(
        (p) =>
          p.fullName.toLowerCase() === cleanedSearchName ||
          p.fullName.toLowerCase().includes(cleanedSearchName)
      );
      if (matched) {
        return {
          linkType: isSpouseHint ? 'spouse_of' : 'child_of',
          targetPersonId: matched.id,
          missingConnectorName: null,
          branchRootId,
        };
      }
      // The referenced connector person is NOT in the tree yet!
      return {
        linkType: isSpouseHint ? 'spouse_of' : 'child_of',
        targetPersonId: branchRootId,
        missingConnectorName: cleanedRawName,
        branchRootId,
      };
    }

    return {
      linkType: isSpouseHint ? 'spouse_of' : 'child_of',
      targetPersonId: branchRootId,
      missingConnectorName: null,
      branchRootId,
    };
  };

  /**
   * Connects `personId` as a full/half sibling of `siblingTargetId`.
   * If `siblingTargetId` already has parent(s), links `personId` as a child of the same parent(s).
   * If `siblingTargetId` has 0 parents (e.g. Khusnah is a top-level ancestor), automatically creates
   * a shared parent node ("Orang Tua dari [Nama]") so both appear side-by-side as siblings on the chart!
   */
  const connectAsSibling = async (
    personId: string,
    siblingTargetId: string,
    currentPersons: Person[],
    currentRels = relationships
  ): Promise<Person[]> => {
    const existingParentIds = currentRels
      .filter((r) => r.type === 'PARENT_CHILD' && r.toPersonId === siblingTargetId)
      .map((r) => r.fromPersonId);

    const createdParents: Person[] = [];

    if (existingParentIds.length > 0) {
      for (const pid of existingParentIds) {
        await addRelationship({
          type: 'PARENT_CHILD',
          fromPersonId: pid,
          toPersonId: personId,
        });
      }
    } else {
      const targetObj = currentPersons.find((p) => p.id === siblingTargetId);
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
      createdParents.push(sharedParent);

      await addRelationship({
        type: 'PARENT_CHILD',
        fromPersonId: sharedParent.id,
        toPersonId: siblingTargetId,
      });
      await addRelationship({
        type: 'PARENT_CHILD',
        fromPersonId: sharedParent.id,
        toPersonId: personId,
      });
    }

    return createdParents;
  };

  const openApproveDialog = (submission: Submission) => {
    const inferred = inferAutoLink(submission, persons);
    setLinkType(inferred.linkType);
    setTargetPersonId(inferred.targetPersonId);
    if (inferred.missingConnectorName) {
      setCreateBridgePerson(true);
      setBridgePersonName(inferred.missingConnectorName);
      setBridgeLinkType('sibling_of');
      setBridgeTargetPersonId(inferred.branchRootId || persons[0]?.id || '');
    } else {
      setCreateBridgePerson(false);
      setBridgePersonName('');
      setBridgeLinkType('sibling_of');
      setBridgeTargetPersonId(inferred.branchRootId || persons[0]?.id || '');
    }
    setApproveTarget(submission);
  };

  const approveSingleSubmission = async (
    submission: Submission,
    chosenLinkType: LinkType,
    chosenTargetId: string,
    bridgeOptions?: {
      enabled: boolean;
      name: string;
      linkType: BridgeLinkType;
      targetId: string;
    },
    workingPersons: Person[] = persons
  ): Promise<Person[]> => {
    const newlyCreated: Person[] = [];
    let effectiveTargetId = chosenTargetId;

    // Mode 0: Update an existing person in the tree without creating a duplicate node
    if (chosenLinkType === 'update_existing' && chosenTargetId) {
      const existingPerson =
        workingPersons.find((p) => p.id === chosenTargetId) ||
        persons.find((p) => p.id === chosenTargetId);

      if (existingPerson) {
        const mergedNotes = submission.notes
          ? existingPerson.notes && !existingPerson.notes.includes(submission.notes)
            ? `${existingPerson.notes}\n${submission.notes}`
            : submission.notes
          : existingPerson.notes;

        await updatePerson(existingPerson.id, {
          fullName: submission.fullName.trim() || existingPerson.fullName,
          gender:
            submission.gender && submission.gender !== 'unknown'
              ? submission.gender
              : existingPerson.gender,
          birthDate: submission.birthDate || existingPerson.birthDate,
          birthPlace: submission.birthPlace || existingPerson.birthPlace,
          deathDate: submission.deathDate || existingPerson.deathDate,
          deathPlace: submission.deathPlace || existingPerson.deathPlace,
          residence: submission.residence || existingPerson.residence,
          photoUrl: submission.photoUrl || existingPerson.photoUrl,
          notes: mergedNotes,
        });

        if (isDemoMode) {
          setDemoSubmissionsCache((prev) =>
            (prev ?? getDemoData().submissions).map((s) =>
              s.id === submission.id
                ? { ...s, status: 'approved', createdPersonId: existingPerson.id }
                : s
            )
          );
          setSubmissions((prev) =>
            prev
              .map((s) =>
                s.id === submission.id
                  ? { ...s, status: 'approved' as const, createdPersonId: existingPerson.id }
                  : s
              )
              .filter((s) => selectedStatus === 'all' || s.status === selectedStatus)
          );
        } else {
          await updateSubmissionStatus(
            submission.id,
            'approved',
            undefined,
            'Data anggota diperbarui',
            existingPerson.id
          );
          await incrementBranchApprovedCount(submission.branchId).catch(() => {});
        }
        return [];
      }
    }

    // If a missing connector/bridge person should be created first (e.g. Khusnah's sibling or parent)
    if (bridgeOptions?.enabled && bridgeOptions.name.trim()) {
      const bridgePerson = await addPerson({
        fullName: bridgeOptions.name.trim(),
        gender: 'unknown',
        birthDate: null,
        birthPlace: null,
        deathDate: null,
        deathPlace: null,
        residence: null,
        photoUrl: null,
        notes: `Dibuat otomatis sebagai penghubung dari submisi ${submission.fullName}`,
        tags: [],
        confidenceScore: 65,
      });
      newlyCreated.push(bridgePerson);

      if (bridgeOptions.linkType === 'child_of' && bridgeOptions.targetId) {
        await addRelationship({
          type: 'PARENT_CHILD',
          fromPersonId: bridgeOptions.targetId,
          toPersonId: bridgePerson.id,
        });
      } else if (bridgeOptions.linkType === 'spouse_of' && bridgeOptions.targetId) {
        await addRelationship({
          type: 'SPOUSE',
          fromPersonId: bridgeOptions.targetId,
          toPersonId: bridgePerson.id,
        });
      } else if (bridgeOptions.linkType === 'sibling_of' && bridgeOptions.targetId) {
        const addedParents = await connectAsSibling(
          bridgePerson.id,
          bridgeOptions.targetId,
          [...workingPersons, ...newlyCreated]
        );
        newlyCreated.push(...addedParents);
      }

      effectiveTargetId = bridgePerson.id;
    }

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
      confidenceScore: 70,
    });
    newlyCreated.push(person);

    if (chosenLinkType === 'child_of' && effectiveTargetId) {
      await addRelationship({
        type: 'PARENT_CHILD',
        fromPersonId: effectiveTargetId,
        toPersonId: person.id,
      });
    } else if (chosenLinkType === 'spouse_of' && effectiveTargetId) {
      await addRelationship({
        type: 'SPOUSE',
        fromPersonId: effectiveTargetId,
        toPersonId: person.id,
      });
    } else if (chosenLinkType === 'sibling_of' && effectiveTargetId) {
      const addedParents = await connectAsSibling(
        person.id,
        effectiveTargetId,
        [...workingPersons, ...newlyCreated]
      );
      newlyCreated.push(...addedParents);
    }

    if (isDemoMode) {
      setDemoSubmissionsCache((prev) =>
        (prev ?? getDemoData().submissions).map((s) =>
          s.id === submission.id
            ? { ...s, status: 'approved', createdPersonId: person.id }
            : s
        )
      );
      setSubmissions((prev) =>
        prev
          .map((s) =>
            s.id === submission.id
              ? { ...s, status: 'approved' as const, createdPersonId: person.id }
              : s
          )
          .filter((s) => selectedStatus === 'all' || s.status === selectedStatus)
      );
    } else {
      await updateSubmissionStatus(submission.id, 'approved', undefined, undefined, person.id);
      await incrementBranchApprovedCount(submission.branchId).catch(() => {});
    }
    return newlyCreated;
  };

  const handleConfirmApprove = async () => {
    if (!approveTarget) return;
    setIsApproving(true);
    try {
      await approveSingleSubmission(approveTarget, linkType, targetPersonId, {
        enabled: createBridgePerson,
        name: bridgePersonName,
        linkType: bridgeLinkType,
        targetId: bridgeTargetPersonId,
      });
      if (!isDemoMode) {
        const latestState = useFamilyStore.getState();
        void syncAllActiveShareSnapshots(
          latestState.persons,
          latestState.relationships,
          branches
        );
      }
      toast.success(
        linkType === 'update_existing'
          ? `Data "${approveTarget.fullName}" berhasil diperbarui di silsilah!`
          : createBridgePerson && bridgePersonName.trim()
            ? `${approveTarget.fullName} & tokoh penghubung "${bridgePersonName.trim()}" berhasil ditambahkan!`
            : `${approveTarget.fullName} berhasil disetujui & ditambahkan ke silsilah!`
      );
      setApproveTarget(null);
      if (!isDemoMode) {
        notifySubmissionsChanged();
        fetchData();
      }
    } catch (error) {
      console.error('Error approving submission:', error);
      toast.error('Gagal menyetujui submisi');
    } finally {
      setIsApproving(false);
    }
  };

  const handleBatchApproveGroup = async (group: SubmissionGroup) => {
    const pendingItems = group.items
      .filter((s) => s.status === 'pending')
      // Approve oldest first (parents/partners submitted first in topological batch order)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (pendingItems.length === 0) return;

    setIsBatchApproving(group.key);
    try {
      const workingPersons: Person[] = [...persons];
      let successCount = 0;

      for (const item of pendingItems) {
        const inferred = inferAutoLink(item, workingPersons);
        const createdList = await approveSingleSubmission(
          item,
          inferred.linkType,
          inferred.targetPersonId,
          inferred.missingConnectorName
            ? {
                enabled: true,
                name: inferred.missingConnectorName,
                linkType: 'sibling_of',
                targetId: inferred.branchRootId || workingPersons[0]?.id || '',
              }
            : undefined,
          workingPersons
        );
        workingPersons.push(...createdList);
        successCount++;
      }

      if (!isDemoMode) {
        const latestState = useFamilyStore.getState();
        void syncAllActiveShareSnapshots(
          latestState.persons,
          latestState.relationships,
          branches
        );
      }
      toast.success(`${successCount} anggota dari ${group.submittedBy} berhasil disetujui!`);
      if (!isDemoMode) {
        notifySubmissionsChanged();
        fetchData();
      }
    } catch (error) {
      console.error('Batch approve failed:', error);
      toast.error('Sebagian data gagal disetujui, silakan cek ulang.');
      if (!isDemoMode) {
        notifySubmissionsChanged();
        fetchData();
      }
    } finally {
      setIsBatchApproving(null);
    }
  };

  const handleReject = async (submission: Submission) => {
    try {
      if (isDemoMode) {
        setDemoSubmissionsCache((prev) =>
          (prev ?? getDemoData().submissions).map((s) =>
            s.id === submission.id ? { ...s, status: 'rejected' } : s
          )
        );
        setSubmissions((prev) =>
          prev
            .map((s) => (s.id === submission.id ? { ...s, status: 'rejected' as const } : s))
            .filter((s) => selectedStatus === 'all' || s.status === selectedStatus)
        );
        toast.success('Submisi ditolak');
        return;
      }
      await updateSubmissionStatus(submission.id, 'rejected', undefined, 'Ditolak oleh admin');
      toast.success('Submisi ditolak');
      notifySubmissionsChanged();
      fetchData();
    } catch (error) {
      console.error('Error rejecting submission:', error);
      toast.error('Gagal menolak submisi');
    }
  };

  const pendingCount = submissions.filter((s) => s.status === 'pending').length;
  const approvedCount = submissions.filter((s) => s.status === 'approved').length;
  const rejectedCount = submissions.filter((s) => s.status === 'rejected').length;

  const renderSubmissionCard = (submission: Submission) => (
    <Card key={submission.id} className="p-4 sm:p-5 rounded-2xl">
      <div className="flex justify-between items-start gap-3 mb-3">
        <div className="flex items-start gap-3 min-w-0">
          {submission.photoUrl && (
            <img
              src={submission.photoUrl}
              alt={submission.fullName}
              className="w-11 h-11 rounded-full object-cover border shrink-0 mt-0.5"
            />
          )}
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-semibold leading-tight">
              {submission.fullName}
            </h3>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground mt-1">
              <span>{submission.gender === 'male' ? 'Laki-laki' : 'Perempuan'}</span>
              {submission.birthDate && (
                <span>• Lahir: {formatFlexibleDate(submission.birthDate) || submission.birthDate}</span>
              )}
              {submission.birthPlace && (
                <span className="inline-flex items-center gap-0.5">
                  • <MapPin className="w-3 h-3" /> {submission.birthPlace}
                </span>
              )}
              {submission.residence && (
                <span className="inline-flex items-center gap-0.5">
                  • <Home className="w-3 h-3" /> {submission.residence}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <Badge variant="outline" className="text-[11px]">
                {getBranchName(submission.branchId)}
              </Badge>
              <Badge variant="secondary" className="text-[11px]">
                {formatRelationLabel(submission.relationToBranch)}
              </Badge>
              {submission.parentName && (
                <Badge variant="outline" className="text-[11px] border-primary/40 text-primary">
                  <Link2 className="w-3 h-3 mr-1" />
                  {submission.parentName}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <Badge
          variant={
            submission.status === 'approved'
              ? 'default'
              : submission.status === 'rejected'
                ? 'destructive'
                : 'secondary'
          }
          className="shrink-0"
        >
          {getStatusLabel(submission.status)}
        </Badge>
      </div>

      {submission.notes && (
        <p className="text-xs sm:text-sm text-muted-foreground mb-3 p-3 bg-muted/50 rounded-xl">
          {submission.notes}
        </p>
      )}

      <div className="text-xs text-muted-foreground mb-3 flex flex-wrap gap-x-3 gap-y-0.5">
        <span>
          Pengirim: <strong className="text-foreground">{submission.submittedBy}</strong>
        </span>
        <span>
          {formatDistanceToNow(new Date(submission.createdAt), {
            addSuffix: true,
            locale: localeId,
          })}
        </span>
      </div>

      {submission.possibleDuplicateId && (
        <Alert
          variant={
            (submission.parentName || '').toLowerCase().startsWith('pembaruan data anggota')
              ? 'default'
              : 'destructive'
          }
          className="mb-3"
        >
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {(submission.parentName || '').toLowerCase().startsWith('pembaruan data anggota')
              ? 'Pengirim menandai ini sebagai pembaruan/pelengkap data anggota yang sudah terdaftar. Saat disetujui, data anggota lama akan langsung diperbarui tanpa membuat duplikat.'
              : 'Anggota dengan nama serupa sudah ada di silsilah! Anda dapat memilih "Perbarui data anggota yang sudah ada" saat menyetujui.'}
          </AlertDescription>
        </Alert>
      )}

      {submission.status === 'pending' && (
        <div className="flex gap-2 pt-3 border-t">
          <Button
            variant="default"
            size="sm"
            className="flex-1"
            onClick={() => openApproveDialog(submission)}
          >
            <Check className="w-4 h-4 mr-1.5" />
            Setujui & Hubungkan
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="flex-1">
                <X className="w-4 h-4 mr-1.5" />
                Tolak
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Tolak submisi ini?</AlertDialogTitle>
                <AlertDialogDescription>
                  Data "{submission.fullName}" tidak akan ditambahkan ke silsilah.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleReject(submission)}>
                  Ya, tolak
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {submission.status === 'approved' && submission.createdPersonId && (
        <div className="pt-3 border-t">
          <p className="text-xs text-success flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" />
            Sudah ditambahkan ke silsilah
          </p>
        </div>
      )}
    </Card>
  );

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-5 md:space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold">Tinjau Submisi</h1>
        <p className="text-sm text-muted-foreground">
          Tinjau, kelompokkan per pengirim, dan sambungkan data keluarga ke silsilah
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Card className="p-3.5 sm:p-4 rounded-2xl">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">Menunggu</p>
              <p className="text-xl sm:text-2xl font-bold">{pendingCount}</p>
            </div>
            <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-warning shrink-0" />
          </div>
        </Card>
        <Card className="p-3.5 sm:p-4 rounded-2xl">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">Disetujui</p>
              <p className="text-xl sm:text-2xl font-bold text-success">{approvedCount}</p>
            </div>
            <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-success shrink-0" />
          </div>
        </Card>
        <Card className="p-3.5 sm:p-4 rounded-2xl">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">Ditolak</p>
              <p className="text-xl sm:text-2xl font-bold text-destructive">{rejectedCount}</p>
            </div>
            <XCircle className="w-6 h-6 sm:w-8 sm:h-8 text-destructive shrink-0" />
          </div>
        </Card>
      </div>

      {/* Filters + Group Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <Select
            value={selectedBranch}
            onValueChange={(v) => {
              setSelectedBranch(v);
              if (v === 'all') searchParams.delete('branch');
              else searchParams.set('branch', v);
              setSearchParams(searchParams, { replace: true });
            }}
          >
            <SelectTrigger className="w-full sm:w-[220px] rounded-xl">
              <SelectValue placeholder="Semua Cabang" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Cabang</SelectItem>
              {branches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-full sm:w-[190px] rounded-xl">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="pending">Menunggu</SelectItem>
              <SelectItem value="approved">Disetujui</SelectItem>
              <SelectItem value="rejected">Ditolak</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          variant={groupBySubmitter ? 'secondary' : 'outline'}
          size="sm"
          className="rounded-xl h-9 text-xs"
          onClick={() => setGroupBySubmitter((prev) => !prev)}
        >
          <Layers className="w-3.5 h-3.5 mr-1.5" />
          {groupBySubmitter ? 'Dikelompokkan per Pengirim' : 'Tampilkan per Pengirim'}
        </Button>
      </div>

      {/* Submissions List */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Memuat data...</p>
        </div>
      ) : submissions.length === 0 ? (
        <Card className="p-12 text-center rounded-2xl">
          <FileCheck className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground">Belum ada submisi pada filter ini</p>
        </Card>
      ) : groupBySubmitter ? (
        <div className="space-y-6">
          {groupedSubmissions.map((group) => {
            const pendingInGroup = group.items.filter((i) => i.status === 'pending').length;
            return (
              <div
                key={group.key}
                className="rounded-2xl border bg-muted/20 p-3.5 sm:p-4 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Users className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-semibold text-sm">
                      Paket dari {group.submittedBy}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {getBranchName(group.branchId)}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {group.items.length} anggota
                    </Badge>
                  </div>

                  {pendingInGroup > 1 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="default"
                          className="h-8 text-xs"
                          disabled={isBatchApproving === group.key}
                        >
                          <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
                          {isBatchApproving === group.key
                            ? 'Menyetujui...'
                            : `Setujui 1 Paket (${pendingInGroup})`}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Setujui semua {pendingInGroup} anggota dari {group.submittedBy}?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Seluruh anggota akan ditambahkan berurutan dari generasi atas dan otomatis disambungkan berdasarkan nama orang tua/pasangan yang tertera.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleBatchApproveGroup(group)}>
                            Ya, Setujui Semua
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>

                <div className="space-y-3">
                  {group.items.map((sub) => renderSubmissionCard(sub))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">{submissions.map((sub) => renderSubmissionCard(sub))}</div>
      )}

      {/* Interactive Approve & Connect Dialog */}
      <Dialog open={!!approveTarget} onOpenChange={(o) => !o && setApproveTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Setujui & Sambungkan ke Silsilah</DialogTitle>
            <DialogDescription>
              Pastikan <strong>{approveTarget?.fullName}</strong> langsung tersambung ke anggota yang tepat agar tidak menjadi data lepas (orphan).
            </DialogDescription>
          </DialogHeader>

          {approveTarget && (
            <div className="space-y-4 py-2">
              {approveTarget.parentName && (
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-xs">
                  <span className="text-muted-foreground">Keterangan dari pengirim: </span>
                  <strong className="text-foreground">
                    {formatRelationLabel(approveTarget.relationToBranch)} — {approveTarget.parentName}
                  </strong>
                </div>
              )}

              {/* Missing Bridge Person Auto-Creation Box (only for new person creation) */}
              {linkType !== 'update_existing' && (
              <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-3.5 space-y-3">
                <div className="flex items-start space-x-2.5">
                  <Checkbox
                    id="create-bridge"
                    checked={createBridgePerson}
                    onCheckedChange={(checked) => setCreateBridgePerson(Boolean(checked))}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="create-bridge"
                      className="text-xs font-semibold cursor-pointer flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      Tokoh penghubungnya belum ada di silsilah? Buat otomatis!
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Centang ini jika orang tua/leluhur penghubung dari{' '}
                      <strong>{approveTarget.fullName}</strong> (misal adik/kakak dari kepala cabang) belum pernah diinput.
                    </p>
                  </div>
                </div>

                {createBridgePerson && (
                  <div className="space-y-3 pt-2 border-t border-amber-500/20">
                    <div>
                      <Label className="text-xs">Nama Tokoh Penghubung Baru *</Label>
                      <Input
                        value={bridgePersonName}
                        onChange={(e) => setBridgePersonName(e.target.value)}
                        placeholder="Contoh: Adik Khusnah / Orang Tua dari pengirim..."
                        className="mt-1 h-8 text-xs bg-background"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <Label className="text-xs">Hubungan Tokoh Penghubung Ini</Label>
                        <Select
                          value={bridgeLinkType}
                          onValueChange={(v) => setBridgeLinkType(v as BridgeLinkType)}
                        >
                          <SelectTrigger className="mt-1 h-8 text-xs bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sibling_of">Kakak / Adik kandung dari...</SelectItem>
                            <SelectItem value="child_of">Anak kandung dari...</SelectItem>
                            <SelectItem value="spouse_of">Pasangan dari...</SelectItem>
                            <SelectItem value="none">Tanpa relasi ke atas</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {bridgeLinkType !== 'none' && (
                        <div>
                          <Label className="text-xs">Terhubung ke Anggota Terdaftar</Label>
                          <Select
                            value={bridgeTargetPersonId}
                            onValueChange={setBridgeTargetPersonId}
                          >
                            <SelectTrigger className="mt-1 h-8 text-xs bg-background">
                              <SelectValue placeholder="Pilih anggota..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-56">
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
                  </div>
                )}
              </div>
              )}

              <div className="space-y-2">
                <Label>
                  {createBridgePerson && bridgePersonName.trim() && linkType !== 'update_existing'
                    ? `Hubungan "${approveTarget.fullName}" terhadap "${bridgePersonName.trim()}"`
                    : `Tindakan / Jenis Hubungan "${approveTarget.fullName}"`}
                </Label>
                <Select
                  value={linkType}
                  onValueChange={(v) => {
                    const nextType = v as LinkType;
                    setLinkType(nextType);
                    if (nextType === 'update_existing') {
                      setCreateBridgePerson(false);
                      const match =
                        (approveTarget.possibleDuplicateId &&
                          persons.find((p) => p.id === approveTarget.possibleDuplicateId)) ||
                        persons.find(
                          (p) =>
                            p.fullName.trim().toLowerCase() ===
                            approveTarget.fullName.trim().toLowerCase()
                        );
                      if (match) {
                        setTargetPersonId(match.id);
                      }
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="update_existing">
                      🔄 Perbarui data anggota yang sudah ada (Tanpa buat duplikat)
                    </SelectItem>
                    <SelectItem value="child_of">Anak kandung dari...</SelectItem>
                    <SelectItem value="sibling_of">Kakak / Adik kandung dari...</SelectItem>
                    <SelectItem value="spouse_of">Pasangan (Suami/Istri) dari...</SelectItem>
                    <SelectItem value="none">Tambahkan baru tanpa relasi dulu</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {linkType !== 'none' && (linkType === 'update_existing' || !createBridgePerson) && (
                <div className="space-y-2">
                  <Label>
                    {linkType === 'update_existing'
                      ? 'Pilih Anggota di Silsilah yang Akan Diperbarui Datanya'
                      : linkType === 'child_of'
                        ? 'Pilih Orang Tua di Silsilah'
                        : linkType === 'sibling_of'
                          ? 'Pilih Saudara Kandung (Kakak/Adik) di Silsilah'
                          : 'Pilih Pasangan di Silsilah'}
                  </Label>
                  <Select value={targetPersonId} onValueChange={setTargetPersonId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih anggota keluarga..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {sortedPersons.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.fullName}
                          {p.birthDate ? ` (${formatShortYearLabel(p.birthDate) || p.birthDate})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {linkType === 'sibling_of' && (
                    <p className="text-[11px] text-muted-foreground">
                      💡 Jika anggota yang dipilih belum memiliki data Orang Tua di atasnya (misal Khusnah), sistem akan otomatis membuatkan 1 node Orang Tua bersama agar keduanya tampil sejajar sebagai Kakak-Adik di bagan silsilah.
                    </p>
                  )}
                  {linkType === 'update_existing' && targetPersonId && (
                    <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 text-xs space-y-1">
                      <p className="font-semibold text-primary">
                        Ringkasan Pembaruan Data:
                      </p>
                      {approveTarget.birthDate && (
                        <p>
                          • Tanggal Lahir:{' '}
                          <strong>
                            {formatFlexibleDate(approveTarget.birthDate) || approveTarget.birthDate}
                          </strong>
                        </p>
                      )}
                      {approveTarget.birthPlace && (
                        <p>
                          • Tempat Lahir: <strong>{approveTarget.birthPlace}</strong>
                        </p>
                      )}
                      {approveTarget.residence && (
                        <p>
                          • Domisili: <strong>{approveTarget.residence}</strong>
                        </p>
                      )}
                      {approveTarget.deathDate && (
                        <p>
                          • Tanggal Wafat:{' '}
                          <strong>
                            {formatFlexibleDate(approveTarget.deathDate) || approveTarget.deathDate}
                          </strong>
                        </p>
                      )}
                      {approveTarget.photoUrl && <p>• Foto Profil baru akan disimpan</p>}
                      <p className="text-[11px] text-muted-foreground pt-1">
                        Data lama yang tidak diisi di form ini (serta seluruh relasi keluarga yang sudah terhubung) tetap aman dan tidak berubah.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setApproveTarget(null)} disabled={isApproving}>
              Batal
            </Button>
            <Button
              onClick={handleConfirmApprove}
              disabled={
                isApproving ||
                (createBridgePerson
                  ? !bridgePersonName.trim() ||
                    (bridgeLinkType !== 'none' && !bridgeTargetPersonId)
                  : linkType !== 'none' && !targetPersonId)
              }
            >
              {isApproving ? 'Menyimpan...' : 'Setujui & Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
