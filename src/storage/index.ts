import { supabaseStorage } from './supabase/SupabaseAdapter';
import type { StorageAdapter } from './StorageAdapter';

// Export the Supabase storage adapter
export const storage: StorageAdapter = supabaseStorage;

export type { StorageAdapter };
