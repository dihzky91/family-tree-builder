import { openDB, type IDBPDatabase } from 'idb';
import type { Person, Relationship, Evidence, AuditLog, Story } from '@/types';
import type { StorageAdapter } from '../StorageAdapter';

const DB_NAME = 'silsilah-keluarga';
const DB_VERSION = 2;

interface SilsilahDB {
  persons: Person;
  relationships: Relationship;
  evidence: Evidence;
  auditLogs: AuditLog;
  stories: Story;
}

let dbInstance: IDBPDatabase<SilsilahDB> | null = null;

async function getDB(): Promise<IDBPDatabase<SilsilahDB>> {
  if (dbInstance) return dbInstance;
  
  dbInstance = await openDB<SilsilahDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create stores if they don't exist
      if (!db.objectStoreNames.contains('persons')) {
        db.createObjectStore('persons', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('relationships')) {
        const relStore = db.createObjectStore('relationships', { keyPath: 'id' });
        relStore.createIndex('fromPersonId', 'fromPersonId');
        relStore.createIndex('toPersonId', 'toPersonId');
      }
      if (!db.objectStoreNames.contains('evidence')) {
        const evStore = db.createObjectStore('evidence', { keyPath: 'id' });
        evStore.createIndex('entityId', 'entityId');
      }
      if (!db.objectStoreNames.contains('auditLogs')) {
        db.createObjectStore('auditLogs', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('stories')) {
        db.createObjectStore('stories', { keyPath: 'id' });
      }
    },
  });
  
  return dbInstance;
}

export const indexedDBAdapter: StorageAdapter = {
  // Person operations
  async getAllPersons() {
    const db = await getDB();
    return db.getAll('persons');
  },
  
  async getPersonById(id: string) {
    const db = await getDB();
    return db.get('persons', id);
  },
  
  async createPerson(person: Person) {
    const db = await getDB();
    await db.put('persons', person);
    return person;
  },
  
  async updatePerson(person: Person) {
    const db = await getDB();
    await db.put('persons', person);
    return person;
  },
  
  async deletePerson(id: string) {
    const db = await getDB();
    await db.delete('persons', id);
  },
  
  // Relationship operations
  async getAllRelationships() {
    const db = await getDB();
    return db.getAll('relationships');
  },
  
  async getRelationshipById(id: string) {
    const db = await getDB();
    return db.get('relationships', id);
  },
  
  async getRelationshipsByPersonId(personId: string) {
    const db = await getDB();
    const all = await db.getAll('relationships');
    return all.filter(r => r.fromPersonId === personId || r.toPersonId === personId);
  },
  
  async createRelationship(relationship: Relationship) {
    const db = await getDB();
    await db.put('relationships', relationship);
    return relationship;
  },
  
  async updateRelationship(relationship: Relationship) {
    const db = await getDB();
    await db.put('relationships', relationship);
    return relationship;
  },
  
  async deleteRelationship(id: string) {
    const db = await getDB();
    await db.delete('relationships', id);
  },
  
  // Evidence operations
  async getAllEvidence() {
    const db = await getDB();
    return db.getAll('evidence');
  },
  
  async getEvidenceByEntityId(entityId: string) {
    const db = await getDB();
    const all = await db.getAll('evidence');
    return all.filter(e => e.entityId === entityId);
  },
  
  async createEvidence(evidence: Evidence) {
    const db = await getDB();
    await db.put('evidence', evidence);
    return evidence;
  },
  
  async updateEvidence(evidence: Evidence) {
    const db = await getDB();
    await db.put('evidence', evidence);
    return evidence;
  },
  
  async deleteEvidence(id: string) {
    const db = await getDB();
    await db.delete('evidence', id);
  },
  
  // Audit operations
  async createAuditLog(log: AuditLog) {
    const db = await getDB();
    await db.put('auditLogs', log);
    return log;
  },
  
  async getAuditLogs() {
    const db = await getDB();
    return db.getAll('auditLogs');
  },

  // Story operations
  async getAllStories() {
    const db = await getDB();
    return db.getAll('stories');
  },

  async createStory(story: Story) {
    const db = await getDB();
    await db.put('stories', story);
    return story;
  },

  async updateStory(story: Story) {
    const db = await getDB();
    await db.put('stories', story);
    return story;
  },

  async deleteStory(id: string) {
    const db = await getDB();
    await db.delete('stories', id);
  },
  
  // Bulk operations
  async importData(persons: Person[], relationships: Relationship[], evidence: Evidence[]) {
    const db = await getDB();
    const tx = db.transaction(['persons', 'relationships', 'evidence'], 'readwrite');
    
    for (const person of persons) {
      await tx.objectStore('persons').put(person);
    }
    for (const rel of relationships) {
      await tx.objectStore('relationships').put(rel);
    }
    for (const ev of evidence) {
      await tx.objectStore('evidence').put(ev);
    }
    
    await tx.done;
  },
  
  async clearAll() {
    const db = await getDB();
    const tx = db.transaction(['persons', 'relationships', 'evidence', 'auditLogs', 'stories'], 'readwrite');
    await tx.objectStore('persons').clear();
    await tx.objectStore('relationships').clear();
    await tx.objectStore('evidence').clear();
    await tx.objectStore('auditLogs').clear();
    await tx.objectStore('stories').clear();
    await tx.done;
  },
};
