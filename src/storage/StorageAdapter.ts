import type { Person, Relationship, Evidence, AuditLog, Branch, Story } from '@/types';

export interface StorageAdapter {
  // Person operations
  getAllPersons(): Promise<Person[]>;
  getPersonById(id: string): Promise<Person | undefined>;
  createPerson(person: Person): Promise<Person>;
  updatePerson(person: Person): Promise<Person>;
  deletePerson(id: string): Promise<void>;
  
  // Relationship operations
  getAllRelationships(): Promise<Relationship[]>;
  getRelationshipById(id: string): Promise<Relationship | undefined>;
  getRelationshipsByPersonId(personId: string): Promise<Relationship[]>;
  createRelationship(relationship: Relationship): Promise<Relationship>;
  updateRelationship(relationship: Relationship): Promise<Relationship>;
  deleteRelationship(id: string): Promise<void>;
  
  // Evidence operations
  getAllEvidence(): Promise<Evidence[]>;
  getEvidenceByEntityId(entityId: string): Promise<Evidence[]>;
  createEvidence(evidence: Evidence): Promise<Evidence>;
  updateEvidence(evidence: Evidence): Promise<Evidence>;
  deleteEvidence(id: string): Promise<void>;
  
  // Audit operations
  createAuditLog(log: AuditLog): Promise<AuditLog>;
  getAuditLogs(): Promise<AuditLog[]>;

  // Story operations
  getAllStories(): Promise<Story[]>;
  createStory(story: Story): Promise<Story>;
  updateStory(story: Story): Promise<Story>;
  deleteStory(id: string): Promise<void>;
  
  // Branch operations
  getAllBranches?(): Promise<Branch[]>;
  
  // Bulk operations
  importData(persons: Person[], relationships: Relationship[], evidence: Evidence[]): Promise<void>;
  clearAll(): Promise<void>;
}
