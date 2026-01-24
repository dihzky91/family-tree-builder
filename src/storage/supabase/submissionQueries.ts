import { supabase } from '@/integrations/supabase/client';
import type { Submission, ApprovedMemberInfo } from '@/types';

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

    return data || [];
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

    return data || [];
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

    return data;
}

/**
 * Create new submission (public form)
 */
export async function createSubmission(
    submissionData: Omit<Submission, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'createdPersonId'>
): Promise<Submission> {
    const { data, error } = await supabase
        .from('submissions')
        .insert([{
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
        }])
        .select()
        .single();

    if (error) {
        console.error('Error creating submission:', error);
        throw error;
    }

    return data;
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
 * Get approved members for a branch (for public display - names only)
 */
export async function getApprovedMembersByBranch(branchId: string): Promise<ApprovedMemberInfo[]> {
    const { data, error } = await supabase
        .from('submissions')
        .select('full_name, relation_to_branch, parent_name')
        .eq('branch_id', branchId)
        .eq('status', 'approved')
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching approved members:', error);
        throw error;
    }

    return (data || []).map(item => ({
        fullName: item.full_name,
        relationToBranch: item.relation_to_branch as any,
        parentName: item.parent_name || undefined,
    }));
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
