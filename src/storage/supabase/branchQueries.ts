import { supabase } from '@/integrations/supabase/client';
import type { Branch } from '@/types';

/**
 * Get all branches
 */
export async function getAllBranches(): Promise<Branch[]> {
    const { data, error } = await supabase
        .from('branches')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching branches:', error);
        throw error;
    }

    return data || [];
}

/**
 * Get branch by code (for public form)
 */
export async function getBranchByCode(code: string): Promise<Branch | null> {
    const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            // Not found
            return null;
        }
        console.error('Error fetching branch:', error);
        throw error;
    }

    return data;
}

/**
 * Get branch by ID
 */
export async function getBranchById(id: string): Promise<Branch | null> {
    const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            return null;
        }
        console.error('Error fetching branch:', error);
        throw error;
    }

    return data;
}

/**
 * Create new branch
 */
export async function createBranch(
    branchData: Omit<Branch, 'id' | 'createdAt' | 'updatedAt' | 'submissionCount' | 'approvedCount'>
): Promise<Branch> {
    const { data, error } = await supabase
        .from('branches')
        .insert([{
            code: branchData.code,
            name: branchData.name,
            root_person_id: branchData.rootPersonId,
            coordinator_name: branchData.coordinatorName,
            coordinator_email: branchData.coordinatorEmail,
            description: branchData.description,
            is_active: branchData.isActive ?? true,
        }])
        .select()
        .single();

    if (error) {
        console.error('Error creating branch:', error);
        throw error;
    }

    return data;
}

/**
 * Update branch
 */
export async function updateBranch(
    id: string,
    updates: Partial<Omit<Branch, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
    const { error } = await supabase
        .from('branches')
        .update({
            ...(updates.code && { code: updates.code }),
            ...(updates.name && { name: updates.name }),
            ...(updates.rootPersonId && { root_person_id: updates.rootPersonId }),
            ...(updates.coordinatorName && { coordinator_name: updates.coordinatorName }),
            ...(updates.coordinatorEmail !== undefined && { coordinator_email: updates.coordinatorEmail }),
            ...(updates.description !== undefined && { description: updates.description }),
            ...(updates.isActive !== undefined && { is_active: updates.isActive }),
            ...(updates.submissionCount !== undefined && { submission_count: updates.submissionCount }),
            ...(updates.approvedCount !== undefined && { approved_count: updates.approvedCount }),
        })
        .eq('id', id);

    if (error) {
        console.error('Error updating branch:', error);
        throw error;
    }
}

/**
 * Delete branch
 */
export async function deleteBranch(id: string): Promise<void> {
    const { error } = await supabase
        .from('branches')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting branch:', error);
        throw error;
    }
}

/**
 * Increment submission count for branch
 */
export async function incrementBranchSubmissionCount(branchId: string): Promise<void> {
    const { error } = await supabase.rpc('increment_branch_submission_count', {
        branch_id: branchId,
    });

    if (error) {
        console.error('Error incrementing submission count:', error);
        // Fallback: manual increment
        const branch = await getBranchById(branchId);
        if (branch) {
            await updateBranch(branchId, {
                submissionCount: branch.submissionCount + 1,
            });
        }
    }
}

/**
 * Increment approved count for branch
 */
export async function incrementBranchApprovedCount(branchId: string): Promise<void> {
    const { error } = await supabase.rpc('increment_branch_approved_count', {
        branch_id: branchId,
    });

    if (error) {
        console.error('Error incrementing approved count:', error);
        // Fallback: manual increment
        const branch = await getBranchById(branchId);
        if (branch) {
            await updateBranch(branchId, {
                approvedCount: branch.approvedCount + 1,
            });
        }
    }
}
