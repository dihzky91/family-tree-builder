import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Person, Relationship, Evidence, AuditLog, FamilyChartPerson, Story, Branch } from '@/types';
import { storage, setStorageMode, isSupabaseConfigured, type StorageMode } from '@/storage';
import { getDemoData } from '@/data/demoData';
import { deleteEvidenceFile } from '@/lib/evidenceStorage';

interface UndoAction {
  type: 'DELETE_PERSON' | 'DELETE_RELATIONSHIP' | 'DELETE_STORY';
  data: Person | Relationship | Story;
  relatedData?: Relationship[];
}

interface FamilyState {
  // Data
  persons: Person[];
  relationships: Relationship[];
  evidence: Evidence[];
  stories: Story[];
  auditLogs: AuditLog[];
  branches: Branch[];

  // UI State
  selectedPersonId: string | null;
  homePersonId: string | null;
  isLoading: boolean;
  searchQuery: string;
  undoStack: UndoAction[];
  isDemoMode: boolean;
  isPrivateMode: boolean;

  // Actions
  loadData: () => Promise<void>;

  // Person actions
  addPerson: (person: Omit<Person, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Person>;
  updatePerson: (id: string, updates: Partial<Person>) => Promise<void>;
  deletePerson: (id: string) => Promise<void>;

  // Relationship actions
  addRelationship: (relationship: Omit<Relationship, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Relationship>;
  updateRelationship: (id: string, updates: Partial<Relationship>) => Promise<void>;
  deleteRelationship: (id: string) => Promise<void>;

  // Evidence actions
  addEvidence: (evidence: Omit<Evidence, 'createdAt'> & { id?: string }) => Promise<Evidence>;
  updateEvidence: (id: string, updates: Partial<Evidence>) => Promise<void>;
  deleteEvidence: (id: string) => Promise<void>;

  // Story actions
  addStory: (story: Omit<Story, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<Story>;
  updateStory: (id: string, updates: Partial<Story>) => Promise<void>;
  deleteStory: (id: string) => Promise<void>;

  // UI actions
  setSelectedPerson: (id: string | null) => void;
  setHomePerson: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  toggleZenMode: () => void;
  isZenMode: boolean;

  // Storage mode
  setPrivateMode: (isPrivate: boolean) => Promise<void>;

  // Undo
  undo: () => Promise<void>;

  // Import/Export
  exportData: () => Promise<string>;
  importData: (jsonData: string) => Promise<void>;
  clearAllData: () => Promise<void>;

  // Helpers
  getChartData: () => FamilyChartPerson[];
  getPersonRelatives: (personId: string) => {
    parents: Person[];
    children: Person[];
    spouses: Person[];
    siblings: Person[];
  };
  findDuplicates: (name: string, birthDate?: string | null) => Person[];

  // Demo mode
  loadDemoData: () => void;
  exitDemoMode: () => Promise<void>;
}

const STORAGE_MODE_KEY = 'silsilah-storage-mode';
const HOME_PERSON_KEY = 'silsilah-home-person-id';

const getInitialHomePersonId = (): string | null => {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(HOME_PERSON_KEY) || null;
};

const getInitialPrivateMode = (): boolean => {
  if (typeof localStorage === 'undefined') return !isSupabaseConfigured();
  const stored = localStorage.getItem(STORAGE_MODE_KEY);
  if (stored === 'private') return true;
  if (stored === 'cloud') return false;
  return !isSupabaseConfigured();
};

export const useFamilyStore = create<FamilyState>((set, get) => ({
  persons: [],
  relationships: [],
  evidence: [],
  stories: [],
  auditLogs: [],
  branches: [],
  selectedPersonId: null,
  homePersonId: getInitialHomePersonId(),
  isLoading: true,
  searchQuery: '',
  isZenMode: false,
  undoStack: [],
  isDemoMode: false,
  isPrivateMode: getInitialPrivateMode(),

  toggleZenMode: () => set(state => ({ isZenMode: !state.isZenMode })),

  setPrivateMode: async (isPrivate) => {
    const mode: StorageMode = isPrivate ? 'private' : 'cloud';
    const activeMode = await setStorageMode(mode);
    const nextIsPrivate = activeMode === 'private';
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_MODE_KEY, activeMode);
    }
    set({ isPrivateMode: nextIsPrivate });
    await get().loadData();
  },

  loadData: async () => {
    if (get().isDemoMode) return;
    set({ isLoading: true });
    try {
      const desiredMode: StorageMode = get().isPrivateMode ? 'private' : 'cloud';
      const activeMode = await setStorageMode(desiredMode);
      if (activeMode !== desiredMode) {
        const nextIsPrivate = activeMode === 'private';
        set({ isPrivateMode: nextIsPrivate });
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_MODE_KEY, activeMode);
        }
      }

      const [persons, relationships, evidence, auditLogs] = await Promise.all([
        storage.getAllPersons(),
        storage.getAllRelationships(),
        storage.getAllEvidence(),
        storage.getAuditLogs(),
      ]);

      const stories = await storage.getAllStories();
      
      let branches: Branch[] = [];
      try {
        branches = await storage.getAllBranches();
      } catch (e) {
        console.warn('Failed to load branches:', e);
      }
      
      set({ persons, relationships, evidence, auditLogs, branches, stories, isLoading: false });
    } catch (error) {
      console.error('Failed to load data:', error);
      set({ isLoading: false });
    }
  },

  addPerson: async (personData) => {
    const now = new Date().toISOString();
    const person: Person = {
      ...personData,
      id: uuidv4(),
      tags: personData.tags || [],
      confidenceScore: personData.confidenceScore ?? 50,
      createdAt: now,
      updatedAt: now,
    };

    await storage.createPerson(person);
    try {
      await storage.createAuditLog({
        id: uuidv4(),
        action: 'CREATE',
        entityType: 'PERSON',
        entityId: person.id,
        changes: person,
        timestamp: now,
        userId: null,
      });
    } catch (auditErr) {
      console.warn('Non-fatal audit log error on addPerson:', auditErr);
    }

    set(state => ({
      persons: [...state.persons, person],
    }));

    return person;
  },

  updatePerson: async (id, updates) => {
    const state = get();
    const existing = state.persons.find(p => p.id === id);
    if (!existing) return;

    const now = new Date().toISOString();
    const updated: Person = {
      ...existing,
      ...updates,
      updatedAt: now,
    };

    await storage.updatePerson(updated);
    try {
      await storage.createAuditLog({
        id: uuidv4(),
        action: 'UPDATE',
        entityType: 'PERSON',
        entityId: id,
        changes: updates,
        timestamp: now,
        userId: null,
      });
    } catch (auditErr) {
      console.warn('Non-fatal audit log error on updatePerson:', auditErr);
    }

    set(state => ({
      persons: state.persons.map(p => p.id === id ? updated : p),
    }));
  },

  deletePerson: async (id) => {
    const state = get();
    const person = state.persons.find(p => p.id === id);
    if (!person) return;

    // Get related relationships for undo
    const relatedRelationships = state.relationships.filter(
      r => r.fromPersonId === id || r.toPersonId === id
    );

    // Delete related relationships first
    for (const rel of relatedRelationships) {
      await storage.deleteRelationship(rel.id);
    }

    await storage.deletePerson(id);
    try {
      await storage.createAuditLog({
        id: uuidv4(),
        action: 'DELETE',
        entityType: 'PERSON',
        entityId: id,
        changes: person,
        timestamp: new Date().toISOString(),
        userId: null,
      });
    } catch (auditErr) {
      console.warn('Non-fatal audit log error on deletePerson:', auditErr);
    }

    set(state => ({
      persons: state.persons.filter(p => p.id !== id),
      relationships: state.relationships.filter(
        r => r.fromPersonId !== id && r.toPersonId !== id
      ),
      selectedPersonId: state.selectedPersonId === id ? null : state.selectedPersonId,
      undoStack: [...state.undoStack, {
        type: 'DELETE_PERSON',
        data: person,
        relatedData: relatedRelationships
      }],
    }));
  },

  addRelationship: async (relData) => {
    const now = new Date().toISOString();
    const relationship: Relationship = {
      ...relData,
      id: uuidv4(),
      meta: relData.meta || {},
      createdAt: now,
      updatedAt: now,
    };

    await storage.createRelationship(relationship);
    set(state => ({
      relationships: [...state.relationships, relationship],
    }));

    // Auto-replace & delete placeholder shared parent ("Orang Tua ...") when a real parent is linked
    if (relData.type === 'PARENT_CHILD') {
      const currentState = get();
      const addedParent = currentState.persons.find(p => p.id === relData.fromPersonId);
      const isAddedPlaceholder =
        addedParent?.tags.includes('auto-placeholder-parent') ||
        addedParent?.notes === 'Dibuat otomatis sebagai leluhur penghubung saudara kandung';

      if (addedParent && !isAddedPlaceholder) {
        const childParentRels = currentState.relationships.filter(
          r => r.type === 'PARENT_CHILD' && r.toPersonId === relData.toPersonId && r.fromPersonId !== addedParent.id
        );

        for (const oldParentRel of childParentRels) {
          const oldParent = currentState.persons.find(p => p.id === oldParentRel.fromPersonId);
          const isPlaceholder =
            oldParent &&
            (oldParent.tags.includes('auto-placeholder-parent') ||
              oldParent.notes === 'Dibuat otomatis sebagai leluhur penghubung saudara kandung');

          if (isPlaceholder && oldParent) {
            // Transfer all siblings connected to this placeholder parent to the real parent
            const siblingRels = currentState.relationships.filter(
              r => r.type === 'PARENT_CHILD' && r.fromPersonId === oldParent.id
            );

            for (const sibRel of siblingRels) {
              const alreadyLinked = get().relationships.some(
                r =>
                  r.type === 'PARENT_CHILD' &&
                  r.fromPersonId === addedParent.id &&
                  r.toPersonId === sibRel.toPersonId
              );
              if (!alreadyLinked) {
                const transferredRel: Relationship = {
                  id: uuidv4(),
                  type: 'PARENT_CHILD',
                  fromPersonId: addedParent.id,
                  toPersonId: sibRel.toPersonId,
                  meta: {},
                  createdAt: now,
                  updatedAt: now,
                };
                await storage.createRelationship(transferredRel);
                set(st => ({
                  relationships: [...st.relationships, transferredRel],
                }));
              }
            }

            // Now delete the temporary placeholder parent node (and its old relationships)
            await get().deletePerson(oldParent.id);
          }
        }
      }
    }

    return relationship;
  },

  updateRelationship: async (id, updates) => {
    const state = get();
    const existing = state.relationships.find(r => r.id === id);
    if (!existing) return;

    const updated: Relationship = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await storage.updateRelationship(updated);
    set(state => ({
      relationships: state.relationships.map(r => r.id === id ? updated : r),
    }));
  },

  deleteRelationship: async (id) => {
    const state = get();
    const relationship = state.relationships.find(r => r.id === id);
    if (!relationship) return;

    await storage.deleteRelationship(id);
    set(state => ({
      relationships: state.relationships.filter(r => r.id !== id),
      undoStack: [...state.undoStack, { type: 'DELETE_RELATIONSHIP', data: relationship }],
    }));
  },

  addEvidence: async (evData) => {
    const now = new Date().toISOString();
    const evidence: Evidence = {
      ...evData,
      id: evData.id || uuidv4(),
      createdAt: now,
    };

    await storage.createEvidence(evidence);
    set(state => ({
      evidence: [...state.evidence, evidence],
    }));

    return evidence;
  },

  updateEvidence: async (id, updates) => {
    const state = get();
    const existing = state.evidence.find(e => e.id === id);
    if (!existing) return;

    const updated: Evidence = {
      ...existing,
      ...updates,
    };

    await storage.updateEvidence(updated);
    try {
      await storage.createAuditLog({
        id: uuidv4(),
        action: 'UPDATE',
        entityType: 'EVIDENCE',
        entityId: id,
        changes: updates,
        timestamp: new Date().toISOString(),
        userId: null,
      });
    } catch (auditErr) {
      console.warn('Non-fatal audit log error on updateEvidence:', auditErr);
    }

    set(state => ({
      evidence: state.evidence.map(e => e.id === id ? updated : e),
    }));
  },

  deleteEvidence: async (id) => {
    const state = get();
    const existing = state.evidence.find(e => e.id === id);
    if (existing?.filePath) {
      try {
        await deleteEvidenceFile(existing.filePath);
      } catch (error) {
        console.warn('Failed to delete evidence file:', error);
      }
    }
    await storage.deleteEvidence(id);
    set(state => ({
      evidence: state.evidence.filter(e => e.id !== id),
    }));
  },

  setSelectedPerson: (id) => set({ selectedPersonId: id }),
  setHomePerson: (id) => {
    if (typeof localStorage !== 'undefined') {
      if (id) {
        localStorage.setItem(HOME_PERSON_KEY, id);
      } else {
        localStorage.removeItem(HOME_PERSON_KEY);
      }
    }
    set({ homePersonId: id });
  },
  setSearchQuery: (query) => set({ searchQuery: query }),

  undo: async () => {
    const state = get();
    const lastAction = state.undoStack[state.undoStack.length - 1];
    if (!lastAction) return;

    if (lastAction.type === 'DELETE_PERSON') {
      const person = lastAction.data as Person;
      await storage.createPerson(person);

      // Restore related relationships
      if (lastAction.relatedData) {
        for (const rel of lastAction.relatedData) {
          await storage.createRelationship(rel);
        }
      }

      set(state => ({
        persons: [...state.persons, person],
        relationships: lastAction.relatedData
          ? [...state.relationships, ...lastAction.relatedData]
          : state.relationships,
        undoStack: state.undoStack.slice(0, -1),
      }));
    } else if (lastAction.type === 'DELETE_RELATIONSHIP') {
      const relationship = lastAction.data as Relationship;
      await storage.createRelationship(relationship);
      set(state => ({
        relationships: [...state.relationships, relationship],
        undoStack: state.undoStack.slice(0, -1),
      }));
    }
  },

  exportData: async () => {
    const state = get();
    const data = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      checksum: btoa(String(state.persons.length + state.relationships.length + state.stories.length)),
      persons: state.persons,
      relationships: state.relationships,
      evidence: state.evidence,
      stories: state.stories,
    };
    return JSON.stringify(data, null, 2);
  },

  importData: async (jsonData) => {
    try {
      const data = JSON.parse(jsonData);
      await storage.importData(data.persons || [], data.relationships || [], data.evidence || []);
      if (Array.isArray(data.stories)) {
        for (const story of data.stories) {
          try {
            await storage.createStory(story);
          } catch (error) {
            console.warn('Failed to import story:', error);
          }
        }
      }
      await get().loadData();
    } catch (error) {
      console.error('Import failed:', error);
      throw new Error('Invalid import data');
    }
  },

  clearAllData: async () => {
    await storage.clearAll();
    set({
      persons: [],
      relationships: [],
      evidence: [],
      auditLogs: [],
      stories: [],
      selectedPersonId: null,
      undoStack: [],
    });
  },

  getChartData: () => {
    const state = get();
    const { persons, relationships } = state;

    return persons.map(person => {
      const nameParts = person.fullName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Find relationships
      const spouseRels = relationships.filter(
        r => r.type === 'SPOUSE' && (r.fromPersonId === person.id || r.toPersonId === person.id)
      );
      const spouseIds = spouseRels.map(r =>
        r.fromPersonId === person.id ? r.toPersonId : r.fromPersonId
      );

      // Find children (where this person is the parent)
      const childRels = relationships.filter(
        r => r.type === 'PARENT_CHILD' && r.fromPersonId === person.id
      );
      const childIds = childRels.map(r => r.toPersonId);

      // Find parents (where this person is the child)
      const parentRels = relationships.filter(
        r => r.type === 'PARENT_CHILD' && r.toPersonId === person.id
      );
      const parentIds = parentRels.map(r => r.fromPersonId);

      // Separate father and mother
      const parents = parentIds.map(id => persons.find(p => p.id === id)).filter(Boolean);
      const father = parents.find(p => p?.gender === 'male')?.id;
      const mother = parents.find(p => p?.gender === 'female')?.id;

      return {
        id: person.id,
        data: {
          'first name': firstName,
          'last name': lastName,
          birthday: person.birthDate ? new Date(person.birthDate).getFullYear().toString() : '',
          avatar: person.photoUrl || undefined,
          gender: person.gender === 'male' ? 'M' : person.gender === 'female' ? 'F' : '',
        },
        rels: {
          spouses: spouseIds.length > 0 ? spouseIds : undefined,
          children: childIds.length > 0 ? childIds : undefined,
          father: father,
          mother: mother,
        },
      } as FamilyChartPerson;
    });
  },

  getPersonRelatives: (personId) => {
    const state = get();
    const { persons, relationships } = state;

    // Parents
    const parentRels = relationships.filter(
      r => r.type === 'PARENT_CHILD' && r.toPersonId === personId
    );
    const parentIds = parentRels.map(r => r.fromPersonId);
    const parents = persons.filter(p => parentIds.includes(p.id));

    // Children
    const childRels = relationships.filter(
      r => r.type === 'PARENT_CHILD' && r.fromPersonId === personId
    );
    const childIds = childRels.map(r => r.toPersonId);
    const children = persons.filter(p => childIds.includes(p.id));

    // Spouses
    const spouseRels = relationships.filter(
      r => r.type === 'SPOUSE' && (r.fromPersonId === personId || r.toPersonId === personId)
    );
    const spouseIds = spouseRels.map(r =>
      r.fromPersonId === personId ? r.toPersonId : r.fromPersonId
    );
    const spouses = persons.filter(p => spouseIds.includes(p.id));

    // Siblings (share at least one parent)
    const siblingIds = new Set<string>();
    for (const parentId of parentIds) {
      const siblingRels = relationships.filter(
        r => r.type === 'PARENT_CHILD' && r.fromPersonId === parentId && r.toPersonId !== personId
      );
      siblingRels.forEach(r => siblingIds.add(r.toPersonId));
    }
    const siblings = persons.filter(p => siblingIds.has(p.id));

    return { parents, children, spouses, siblings };
  },

  addStory: async (storyData) => {
    const now = new Date().toISOString();
    const story: Story = {
      ...storyData,
      id: storyData.id || uuidv4(),
      createdAt: now,
      updatedAt: now,
    };

    await storage.createStory(story);

    set(state => ({
      stories: [...state.stories, story],
    }));

    return story;
  },

  updateStory: async (id, updates) => {
    const state = get();
    const existing = state.stories.find(s => s.id === id);
    if (!existing) return;

    const updated: Story = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await storage.updateStory(updated);

    set(state => ({
      stories: state.stories.map(s => s.id === id ? updated : s),
    }));
  },

  deleteStory: async (id) => {
    await storage.deleteStory(id);
    set(state => ({
      stories: state.stories.filter(s => s.id !== id),
    }));
  },

  findDuplicates: (name, birthDate) => {
    const state = get();
    const nameLower = name.toLowerCase().trim();

    return state.persons.filter(person => {
      const personNameLower = person.fullName.toLowerCase().trim();

      // Check name similarity (simple contains check)
      const nameSimilar = personNameLower.includes(nameLower) ||
        nameLower.includes(personNameLower) ||
        levenshteinDistance(nameLower, personNameLower) < 3;

      // Check birth date if provided
      if (birthDate && person.birthDate) {
        const dateSimilar = person.birthDate === birthDate;
        return nameSimilar && dateSimilar;
      }

      return nameSimilar;
    });
  },

  loadDemoData: () => {
    const { persons, relationships, branches, stories } = getDemoData();

    set({
      persons,
      relationships,
      branches,
      evidence: [],
      stories,
      auditLogs: [],
      selectedPersonId: null,
      homePersonId: 'demo-p-1', // Default focus on Andi Santoso (middle generation with parents, siblings, spouse & children)
      isLoading: false,
      isDemoMode: true,
      undoStack: [],
    });
  },

  exitDemoMode: async () => {
    set({ isDemoMode: false });
    await get().loadData();
  },
}));

// Simple Levenshtein distance for fuzzy matching
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}
