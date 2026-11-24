import { supabase } from '@/integrations/supabase/client';
import type { Submission, ApprovedMemberInfo } from '@/types';
import type { Tables } from '@/integrations/supabase/types';
import { v4 as uuidv4 } from 'uuid';

type DbSubmission = Tables<'submissions'>;

function mapDbSubmissionToSubmission(db: DbSubmission): Submission {
    return {
        id: db.id,
        branchId: db.branch_id,
        submittedBy: db.submitted_by,
        submitterEmail: db.submitter_email || undefined,
        fullName: db.full_name,
        gender: db.gender as 'male' | 'female' | 'unknown',
        birthDate: db.birth_date || undefined,
        birthPlace: db.birth_place || undefined,
        deathDate: db.death_date || undefined,
        deathPlace: db.death_place || undefined,
        residence: db.residence || undefined,
        photoUrl: db.photo_url || undefined,
        notes: db.notes || undefined,
        relationToBranch: db.relation_to_branch as 'child' | 'grandchild' | 'great-grandchild' | 'other',
        parentName: db.parent_name || undefined,
        possibleDuplicateId: db.possible_duplicate_id || undefined,
        status: db.status as 'pending' | 'approved' | 'rejected',
        reviewedAt: db.reviewed_at || undefined,
        reviewedBy: db.reviewed_by || undefined,
        reviewNotes: db.review_notes || undefined,
        createdPersonId: db.created_person_id || undefined,
        createdAt: db.created_at || new Date().toISOString(),
        updatedAt: db.updated_at || new Date().toISOString(),
    };
}

/**
 * Get all submissions (optionally filter by branch)
 */
export async function getAllSubmissions(branchId?: string): Promise<Submission[]> {
    let query = supabase
        .from('submissions')
        .select('*')
        .order('created_at', { ascending: false });

    if (branchId) {
        query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching submissions:', error);
        throw error;
    }

    return (data || []).map(mapDbSubmissionToSubmission);
}

/**
 * Get submissions by status
 */
export async function getSubmissionsByStatus(
    status: 'pending' | 'approved' | 'rejected',
    branchId?: string
): Promise<Submission[]> {
    let query = supabase
        .from('submissions')
        .select('*')
        .eq('status', status)
        .order('created_at', { ascending: false });

    if (branchId) {
        query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching submissions by status:', error);
        throw error;
    }

    return (data || []).map(mapDbSubmissionToSubmission);
}

/**
 * Get submission by ID
 */
export async function getSubmissionById(id: string): Promise<Submission | null> {
    const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            return null;
        }
        console.error('Error fetching submission:', error);
        throw error;
    }

    return data ? mapDbSubmissionToSubmission(data) : null;
}

/**
 * Create new submission (public form)
 * IMPORTANT: Do NOT chain `.select()` after `.insert()`!
 * In Supabase RLS, anonymous visitors have INSERT permission (`WITH CHECK`)
 * on `submissions`, but they only have SELECT permission for `status = 'approved'`.
 * Since new rows have `status = 'pending'`, chaining `.select()` triggers a SELECT RLS
 * check on the newly inserted row and throws:
 * `new row violates row-level security policy for table "submissions"`.
 */
export async function createSubmission(
    submissionData: Omit<Submission, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'createdPersonId'>
): Promise<Submission> {
    const id = uuidv4();
    const now = new Date().toISOString();

    const { error } = await supabase
        .from('submissions')
        .insert([{
            id,
            branch_id: submissionData.branchId,
            submitted_by: submissionData.submittedBy,
            submitter_email: submissionData.submitterEmail,
            full_name: submissionData.fullName,
            gender: submissionData.gender,
            birth_date: submissionData.birthDate,
            birth_place: submissionData.birthPlace,
            death_date: submissionData.deathDate,
            death_place: submissionData.deathPlace,
            residence: submissionData.residence,
            photo_url: submissionData.photoUrl,
            notes: submissionData.notes,
            relation_to_branch: submissionData.relationToBranch,
            parent_name: submissionData.parentName,
            possible_duplicate_id: submissionData.possibleDuplicateId,
            status: 'pending',
        }]);

    if (error) {
        console.error('Error creating submission:', error);
        throw error;
    }

    return {
        ...submissionData,
        id,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * Update submission status (approve/reject)
 */
export async function updateSubmissionStatus(
    id: string,
    status: 'approved' | 'rejected',
    reviewedBy?: string,
    reviewNotes?: string,
    createdPersonId?: string
): Promise<void> {
    const { error } = await supabase
        .from('submissions')
        .update({
            status,
            reviewed_at: new Date().toISOString(),
            reviewed_by: reviewedBy,
            review_notes: reviewNotes,
            ...(createdPersonId && { created_person_id: createdPersonId }),
        })
        .eq('id', id);

    if (error) {
        console.error('Error updating submission status:', error);
        throw error;
    }
}

/**
 * Update submission
 */
export async function updateSubmission(
    id: string,
    updates: Partial<Omit<Submission, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
    const { error } = await supabase
        .from('submissions')
        .update({
            ...(updates.status && { status: updates.status }),
            ...(updates.fullName && { full_name: updates.fullName }),
            ...(updates.gender && { gender: updates.gender }),
            ...(updates.birthDate !== undefined && { birth_date: updates.birthDate }),
            ...(updates.birthPlace !== undefined && { birth_place: updates.birthPlace }),
            ...(updates.deathDate !== undefined && { death_date: updates.deathDate }),
            ...(updates.deathPlace !== undefined && { death_place: updates.deathPlace }),
            ...(updates.residence !== undefined && { residence: updates.residence }),
            ...(updates.photoUrl !== undefined && { photo_url: updates.photoUrl }),
            ...(updates.notes !== undefined && { notes: updates.notes }),
            ...(updates.relationToBranch && { relation_to_branch: updates.relationToBranch }),
            ...(updates.parentName !== undefined && { parent_name: updates.parentName }),
            ...(updates.reviewNotes !== undefined && { review_notes: updates.reviewNotes }),
            ...(updates.createdPersonId !== undefined && { created_person_id: updates.createdPersonId }),
        })
        .eq('id', id);

    if (error) {
        console.error('Error updating submission:', error);
        throw error;
    }
}

/**
 * Delete submission
 */
export async function deleteSubmission(id: string): Promise<void> {
    const { error } = await supabase
        .from('submissions')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting submission:', error);
        throw error;
    }
}

/**
 * Get approved members for a branch (for public display and quick data completion)
 * Deduplicates by normalized full_name so repeated updates merge into one entry.
 */
export async function getApprovedMembersByBranch(branchId: string): Promise<ApprovedMemberInfo[]> {
    const { data, error } = await supabase
        .from('submissions')
        .select('full_name, relation_to_branch, parent_name, created_person_id, gender, birth_date, birth_place, residence, death_date, death_place')
        .eq('branch_id', branchId)
        .eq('status', 'approved')
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching approved members:', error);
        throw error;
    }

    const byName = new Map<string, ApprovedMemberInfo>();
    for (const item of data || []) {
        const key = item.full_name.trim().toLowerCase();
        const existing = byName.get(key);
        const isUpdateRecord = (item.parent_name || '').toLowerCase().startsWith('pembaruan data anggota');
        byName.set(key, {
            fullName: item.full_name,
            relationToBranch: (isUpdateRecord && existing
                ? existing.relationToBranch
                : item.relation_to_branch) as 'child' | 'grandchild' | 'great-grandchild' | 'other',
            parentName: isUpdateRecord && existing
                ? existing.parentName
                : item.parent_name || existing?.parentName || undefined,
            createdPersonId: item.created_person_id || existing?.createdPersonId || undefined,
            gender: (item.gender as 'male' | 'female' | 'unknown') || existing?.gender,
            hasBirthDate: Boolean(item.birth_date) || Boolean(existing?.hasBirthDate),
        });
    }

    return Array.from(byName.values());
}

/**
 * Get pending submission count
 */
export async function getPendingSubmissionCount(branchId?: string): Promise<number> {
    let query = supabase
        .from('submissions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');

    if (branchId) {
        query = query.eq('branch_id', branchId);
    }

    const { count, error } = await query;

    if (error) {
        console.error('Error getting pending count:', error);
        return 0;
    }

    return count || 0;
}
