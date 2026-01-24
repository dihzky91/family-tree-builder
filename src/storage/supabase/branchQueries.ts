import { supabase } from '@/integrations/supabase/client';
import type { Branch } from '@/types';
import type { Tables } from '@/integrations/supabase/types';

type DbBranch = Tables<'branches'>;

function mapDbBranchToBranch(db: DbBranch): Branch {
    return {
        id: db.id,
        code: db.code,
        name: db.name,
        rootPersonId: db.root_person_id,
        coordinatorName: db.coordinator_name,
        coordinatorEmail: db.coordinator_email || undefined,
        description: db.description || undefined,
        isActive: db.is_active ?? true,
        submissionCount: db.submission_count ?? 0,
        approvedCount: db.approved_count ?? 0,
        createdAt: db.created_at || new Date().toISOString(),
        updatedAt: db.updated_at || new Date().toISOString(),
    };
}

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

    return (data || []).map(mapDbBranchToBranch);
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
            return null;
        }
        console.error('Error fetching branch:', error);
        throw error;
    }

    return data ? mapDbBranchToBranch(data) : null;
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

    return data ? mapDbBranchToBranch(data) : null;
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

    return mapDbBranchToBranch(data);
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
    // Manual increment since RPC function may not exist
    const branch = await getBranchById(branchId);
    if (branch) {
        await updateBranch(branchId, {
            submissionCount: branch.submissionCount + 1,
        });
    }
}

/**
 * Increment approved count for branch
 */
export async function incrementBranchApprovedCount(branchId: string): Promise<void> {
    // Manual increment since RPC function may not exist
    const branch = await getBranchById(branchId);
    if (branch) {
        await updateBranch(branchId, {
            approvedCount: branch.approvedCount + 1,
        });
    }
}
