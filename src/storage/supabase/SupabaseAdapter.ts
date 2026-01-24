import type { StorageAdapter } from '../StorageAdapter';
import type { Person, Relationship, Evidence, AuditLog } from '@/types';
import { supabase } from '@/integrations/supabase/client';

// Helper to get current user id
async function getCurrentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

// Transform DB row to Person type
function dbToPerson(row: any): Person {
  return {
    id: row.id,
    fullName: row.full_name,
    gender: row.gender,
    birthDate: row.birth_date,
    deathDate: row.death_date,
    birthPlace: row.birth_place,
    deathPlace: row.death_place,
    residence: row.residence,
    photoUrl: row.photo_url,
    notes: row.notes,
    tags: row.tags || [],
    confidenceScore: row.confidence_score || 50,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Transform Person to DB row
function personToDb(person: Person, userId: string): any {
  return {
    id: person.id,
    user_id: userId,
    full_name: person.fullName,
    gender: person.gender,
    birth_date: person.birthDate || null,
    death_date: person.deathDate || null,
    birth_place: person.birthPlace || null,
    death_place: person.deathPlace || null,
    residence: person.residence || null,
    photo_url: person.photoUrl || null,
    notes: person.notes || null,
    tags: person.tags || [],
    confidence_score: person.confidenceScore || 50,
  };
}

// Transform DB row to Relationship type
function dbToRelationship(row: any): Relationship {
  return {
    id: row.id,
    type: row.type,
    fromPersonId: row.from_person_id,
    toPersonId: row.to_person_id,
    meta: {
      status: row.status,
      startDate: row.start_date,
      endDate: row.end_date,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Transform Relationship to DB row
function relationshipToDb(rel: Relationship, userId: string): any {
  return {
    id: rel.id,
    user_id: userId,
    type: rel.type,
    from_person_id: rel.fromPersonId,
    to_person_id: rel.toPersonId,
    status: rel.meta?.status || null,
    start_date: rel.meta?.startDate || null,
    end_date: rel.meta?.endDate || null,
  };
}

// Transform DB row to Evidence type
function dbToEvidence(row: any): Evidence {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    fileData: row.file_data, // deprecated
    fileName: row.file_name,
    fileUrl: row.file_url,
    filePath: row.file_path,
    docType: row.doc_type,
    source: row.source,
    date: row.date,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
  };
}

// Transform Evidence to DB row
function evidenceToDb(evidence: Evidence, userId: string): any {
  return {
    id: evidence.id,
    user_id: userId,
    entity_type: evidence.entityType,
    entity_id: evidence.entityId,
    file_data: null, // deprecated - no longer store base64
    file_name: evidence.fileName || null,
    file_url: evidence.fileUrl || null,
    file_path: evidence.filePath || null,
    doc_type: evidence.docType,
    source: evidence.source || null,
    date: evidence.date || null,
    description: evidence.description || null,
    status: evidence.status || 'draft',
  };
}

// Transform DB row to AuditLog type
function dbToAuditLog(row: any): AuditLog {
  return {
    id: row.id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    changes: row.changes,
    timestamp: row.timestamp,
    userId: row.user_id,
  };
}

export class SupabaseAdapter implements StorageAdapter {
  // Person operations
  async getAllPersons(): Promise<Person[]> {
    const { data, error } = await supabase
      .from('persons')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return (data || []).map(dbToPerson);
  }

  async getPersonById(id: string): Promise<Person | undefined> {
    const { data, error } = await supabase
      .from('persons')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    if (error) throw error;
    return data ? dbToPerson(data) : undefined;
  }

  async createPerson(person: Person): Promise<Person> {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('persons')
      .insert(personToDb(person, userId))
      .select()
      .single();
    
    if (error) throw error;
    return dbToPerson(data);
  }

  async updatePerson(person: Person): Promise<Person> {
    const { data, error } = await supabase
      .from('persons')
      .update({
        full_name: person.fullName,
        gender: person.gender,
        birth_date: person.birthDate || null,
        death_date: person.deathDate || null,
        photo_url: person.photoUrl || null,
        notes: person.notes || null,
        tags: person.tags || [],
        confidence_score: person.confidenceScore || 50,
      })
      .eq('id', person.id)
      .select()
      .single();
    
    if (error) throw error;
    return dbToPerson(data);
  }

  async deletePerson(id: string): Promise<void> {
    const { error } = await supabase
      .from('persons')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  // Relationship operations
  async getAllRelationships(): Promise<Relationship[]> {
    const { data, error } = await supabase
      .from('relationships')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return (data || []).map(dbToRelationship);
  }

  async getRelationshipById(id: string): Promise<Relationship | undefined> {
    const { data, error } = await supabase
      .from('relationships')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    if (error) throw error;
    return data ? dbToRelationship(data) : undefined;
  }

  async getRelationshipsByPersonId(personId: string): Promise<Relationship[]> {
    const { data, error } = await supabase
      .from('relationships')
      .select('*')
      .or(`from_person_id.eq.${personId},to_person_id.eq.${personId}`);
    
    if (error) throw error;
    return (data || []).map(dbToRelationship);
  }

  async createRelationship(relationship: Relationship): Promise<Relationship> {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('relationships')
      .insert(relationshipToDb(relationship, userId))
      .select()
      .single();
    
    if (error) throw error;
    return dbToRelationship(data);
  }

  async updateRelationship(relationship: Relationship): Promise<Relationship> {
    const { data, error } = await supabase
      .from('relationships')
      .update({
        type: relationship.type,
        from_person_id: relationship.fromPersonId,
        to_person_id: relationship.toPersonId,
        status: relationship.meta?.status || null,
        start_date: relationship.meta?.startDate || null,
        end_date: relationship.meta?.endDate || null,
      })
      .eq('id', relationship.id)
      .select()
      .single();
    
    if (error) throw error;
    return dbToRelationship(data);
  }

  async deleteRelationship(id: string): Promise<void> {
    const { error } = await supabase
      .from('relationships')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  // Evidence operations
  async getAllEvidence(): Promise<Evidence[]> {
    const { data, error } = await supabase
      .from('evidence')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return (data || []).map(dbToEvidence);
  }

  async getEvidenceByEntityId(entityId: string): Promise<Evidence[]> {
    const { data, error } = await supabase
      .from('evidence')
      .select('*')
      .eq('entity_id', entityId);
    
    if (error) throw error;
    return (data || []).map(dbToEvidence);
  }

  async createEvidence(evidence: Evidence): Promise<Evidence> {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('evidence')
      .insert(evidenceToDb(evidence, userId))
      .select()
      .single();
    
    if (error) throw error;
    return dbToEvidence(data);
  }

  async updateEvidence(evidence: Evidence): Promise<Evidence> {
    const { data, error } = await supabase
      .from('evidence')
      .update({
        entity_type: evidence.entityType,
        entity_id: evidence.entityId,
        file_name: evidence.fileName || null,
        file_url: evidence.fileUrl || null,
        file_path: evidence.filePath || null,
        doc_type: evidence.docType,
        source: evidence.source || null,
        date: evidence.date || null,
        description: evidence.description || null,
        status: evidence.status || 'draft',
      })
      .eq('id', evidence.id)
      .select()
      .single();
    
    if (error) throw error;
    return dbToEvidence(data);
  }

  async deleteEvidence(id: string): Promise<void> {
    const { error } = await supabase
      .from('evidence')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  // Audit operations
  async createAuditLog(log: AuditLog): Promise<AuditLog> {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('audit_logs')
      .insert({
        id: log.id,
        user_id: userId,
        action: log.action,
        entity_type: log.entityType,
        entity_id: log.entityId,
        changes: log.changes || null,
        timestamp: log.timestamp,
      })
      .select()
      .single();
    
    if (error) throw error;
    return dbToAuditLog(data);
  }

  async getAuditLogs(): Promise<AuditLog[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);
    
    if (error) throw error;
    return (data || []).map(dbToAuditLog);
  }

  // Bulk operations
  async importData(persons: Person[], relationships: Relationship[], evidence: Evidence[]): Promise<void> {
    const userId = await getCurrentUserId();
    
    // Clear existing data first
    await this.clearAll();
    
    // Insert persons
    if (persons.length > 0) {
      const { error: personsError } = await supabase
        .from('persons')
        .insert(persons.map(p => personToDb(p, userId)));
      if (personsError) throw personsError;
    }
    
    // Insert relationships
    if (relationships.length > 0) {
      const { error: relsError } = await supabase
        .from('relationships')
        .insert(relationships.map(r => relationshipToDb(r, userId)));
      if (relsError) throw relsError;
    }
    
    // Insert evidence
    if (evidence.length > 0) {
      const { error: evidenceError } = await supabase
        .from('evidence')
        .insert(evidence.map(e => evidenceToDb(e, userId)));
      if (evidenceError) throw evidenceError;
    }
  }

  async clearAll(): Promise<void> {
    // Delete in order to respect foreign keys
    await supabase.from('evidence').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('relationships').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('persons').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  }
}

export const supabaseStorage = new SupabaseAdapter();
