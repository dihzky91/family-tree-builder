import type { StorageAdapter } from './StorageAdapter';
import { indexedDBAdapter } from './indexeddb/IndexedDBAdapter';

export type StorageMode = 'private' | 'cloud';

const hasSupabaseConfig = () => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return Boolean(url && key);
};

let currentAdapter: StorageAdapter = indexedDBAdapter;
let currentMode: StorageMode = 'private';
let adapterPromise: Promise<StorageAdapter> = Promise.resolve(currentAdapter);

const loadSupabaseAdapter = async (): Promise<StorageAdapter> => {
  const module = await import('./supabase/SupabaseAdapter');
  return module.supabaseStorage;
};

export const isSupabaseConfigured = () => hasSupabaseConfig();

export const setStorageMode = async (mode: StorageMode): Promise<StorageMode> => {
  if (mode === 'cloud' && hasSupabaseConfig()) {
    currentMode = 'cloud';
    adapterPromise = loadSupabaseAdapter().then((adapter) => {
      currentAdapter = adapter;
      return adapter;
    });
    await adapterPromise;
    return currentMode;
  }

  currentMode = 'private';
  currentAdapter = indexedDBAdapter;
  adapterPromise = Promise.resolve(currentAdapter);
  return currentMode;
};

export const getStorageMode = (): StorageMode => currentMode;

const getAdapter = async (): Promise<StorageAdapter> => adapterPromise;

export const storage: StorageAdapter = {
  async getAllPersons() {
    return (await getAdapter()).getAllPersons();
  },
  async getPersonById(id) {
    return (await getAdapter()).getPersonById(id);
  },
  async createPerson(person) {
    return (await getAdapter()).createPerson(person);
  },
  async updatePerson(person) {
    return (await getAdapter()).updatePerson(person);
  },
  async deletePerson(id) {
    return (await getAdapter()).deletePerson(id);
  },
  async getAllRelationships() {
    return (await getAdapter()).getAllRelationships();
  },
  async getRelationshipById(id) {
    return (await getAdapter()).getRelationshipById(id);
  },
  async getRelationshipsByPersonId(personId) {
    return (await getAdapter()).getRelationshipsByPersonId(personId);
  },
  async createRelationship(relationship) {
    return (await getAdapter()).createRelationship(relationship);
  },
  async updateRelationship(relationship) {
    return (await getAdapter()).updateRelationship(relationship);
  },
  async deleteRelationship(id) {
    return (await getAdapter()).deleteRelationship(id);
  },
  async getAllEvidence() {
    return (await getAdapter()).getAllEvidence();
  },
  async getEvidenceByEntityId(entityId) {
    return (await getAdapter()).getEvidenceByEntityId(entityId);
  },
  async createEvidence(evidence) {
    return (await getAdapter()).createEvidence(evidence);
  },
  async updateEvidence(evidence) {
    return (await getAdapter()).updateEvidence(evidence);
  },
  async deleteEvidence(id) {
    return (await getAdapter()).deleteEvidence(id);
  },
  async createAuditLog(log) {
    return (await getAdapter()).createAuditLog(log);
  },
  async getAuditLogs() {
    return (await getAdapter()).getAuditLogs();
  },
  async getAllStories() {
    return (await getAdapter()).getAllStories();
  },
  async createStory(story) {
    return (await getAdapter()).createStory(story);
  },
  async updateStory(story) {
    return (await getAdapter()).updateStory(story);
  },
  async deleteStory(id) {
    return (await getAdapter()).deleteStory(id);
  },
  async importData(persons, relationships, evidence) {
    return (await getAdapter()).importData(persons, relationships, evidence);
  },
  async clearAll() {
    return (await getAdapter()).clearAll();
  },
  async getAllBranches() {
    const adapter = await getAdapter();
    if (!adapter.getAllBranches) return [];
    return adapter.getAllBranches();
  },
};

export type { StorageAdapter };
