import { indexedDBAdapter } from './indexeddb/IndexedDBAdapter';
import type { StorageAdapter } from './StorageAdapter';

// Export the current storage adapter
// This can be swapped to PostgreSQL/Supabase adapter later
export const storage: StorageAdapter = indexedDBAdapter;

export type { StorageAdapter };
