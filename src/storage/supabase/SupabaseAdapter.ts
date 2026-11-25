import type { StorageAdapter } from '../StorageAdapter';
import type {
  Person,
  Relationship,
  Evidence,
  AuditLog,
  Story,
  Gender,
  RelationshipType,
  SpouseStatus,
  EntityType,
  DocumentType,
  VerificationStatus,
} from '@/types';
import type { Json, Tables, TablesInsert } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { getAllBranches } from './branchQueries';

// Helper to get current user id
async function getCurrentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

const STORIES_STORAGE_PREFIX = 'silsilah-stories';

async function getStoriesStorageKey(): Promise<string> {
  try {
    const userId = await getCurrentUserId();
    return `${STORIES_STORAGE_PREFIX}:${userId}`;
  } catch {
    return `${STORIES_STORAGE_PREFIX}:anon`;
  }
}

type DbStory = Tables<'stories'>;
type DbStoryInsert = TablesInsert<'stories'>;
type DbPerson = Tables<'persons'>;
type DbPersonInsert = TablesInsert<'persons'>;
type DbRelationship = Tables<'relationships'>;
type DbRelationshipInsert = TablesInsert<'relationships'>;
type DbEvidence = Tables<'evidence'>;
type DbEvidenceInsert = TablesInsert<'evidence'>;
type DbAuditLog = Tables<'audit_logs'>;

function dbToStory(row: DbStory): Story {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    authorId: row.author_id || null,
    personIds: row.person_ids || [],
    date: row.date || null,
    tags: row.tags || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function storyToDb(story: Story, userId: string): DbStoryInsert {
  return {
    id: story.id,
    user_id: userId,
    title: story.title,
    content: story.content,
    author_id: story.authorId || null,
    person_ids: story.personIds || [],
    date: story.date || null,
    tags: story.tags || [],
    created_at: story.createdAt,
    updated_at: story.updatedAt,
  };
}

const storiesTable = () => supabase.from('stories');

function readStories(storageKey: string): Story[] {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(storageKey);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStories(storageKey: string, stories: Story[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(storageKey, JSON.stringify(stories));
}

// Transform DB row to Person type
function dbToPerson(row: DbPerson): Person {
  return {
    id: row.id,
    fullName: row.full_name,
    gender: row.gender as Gender,
    birthDate: row.birth_date,
    deathDate: row.death_date,
    birthPlace: row.birth_place,
    deathPlace: row.death_place,
    residence: row.residence,
    photoUrl: row.photo_url,
    notes: row.notes,
    tags: row.tags || [],
    confidenceScore: row.confidence_score ?? 50,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Transform Person to DB row
function personToDb(person: Person, userId: string): DbPersonInsert {
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
    confidence_score: person.confidenceScore ?? 50,
  };
}

// Transform DB row to Relationship type
function dbToRelationship(row: DbRelationship): Relationship {
  return {
    id: row.id,
    type: row.type as RelationshipType,
    fromPersonId: row.from_person_id,
    toPersonId: row.to_person_id,
    meta: {
      status: (row.status as SpouseStatus | null) || undefined,
      startDate: row.start_date,
      endDate: row.end_date,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Transform Relationship to DB row
function relationshipToDb(rel: Relationship, userId: string): DbRelationshipInsert {
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
function dbToEvidence(row: DbEvidence): Evidence {
  return {
    id: row.id,
    entityType: row.entity_type as EntityType,
    entityId: row.entity_id,
    fileData: row.file_data, // deprecated
    fileName: row.file_name,
    fileUrl: row.file_url,
    filePath: row.file_path,
    docType: row.doc_type as DocumentType,
    source: row.source,
    date: row.date,
    description: row.description,
    status: row.status as VerificationStatus,
    createdAt: row.created_at,
  };
}

// Transform Evidence to DB row
function evidenceToDb(evidence: Evidence, userId: string): DbEvidenceInsert {
  return {
    id: evidence.id,
    user_id: userId,
    entity_type: evidence.entityType,
    entity_id: evidence.entityId,
    file_data: evidence.fileData || null,
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
function dbToAuditLog(row: DbAuditLog): AuditLog {
  const changesObj =
    row.changes && typeof row.changes === 'object' && !Array.isArray(row.changes)
      ? (row.changes as Record<string, unknown>)
      : null;

  return {
    id: row.id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    changes: changesObj,
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
        birth_place: person.birthPlace || null,
        death_place: person.deathPlace || null,
        residence: person.residence || null,
        photo_url: person.photoUrl || null,
        notes: person.notes || null,
        tags: person.tags || [],
        confidence_score: person.confidenceScore ?? 50,
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

    // 1. Try security definer RPC first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    const { data, error } = await client.rpc('create_audit_log', {
      p_user_id: userId,
      p_action: log.action,
      p_entity_type: log.entityType,
      p_entity_id: log.entityId,
      p_changes: log.changes || null,
    });

    if (!error && data) {
      return dbToAuditLog(data as DbAuditLog);
    }

    // 2. Fallback to direct table insert if the RPC migration hasn't been applied to Supabase Cloud yet
    const { data: directData, error: directError } = await supabase
      .from('audit_logs')
      .insert({
        id: log.id,
        user_id: userId,
        action: log.action,
        entity_type: log.entityType,
        entity_id: log.entityId,
        changes: ((log.changes as Json) ?? null),
        timestamp: log.timestamp,
      })
      .select()
      .single();

    if (!directError && directData) {
      return dbToAuditLog(directData);
    }

    // 3. Return in-memory log without throwing so person/relationship creation never fails due to audit logging
    return {
      ...log,
      userId,
    };
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

  // Story operations
  async getAllStories(): Promise<Story[]> {
    try {
      const { data, error } = await storiesTable()
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const rows = data || [];
      return rows.map((row) => dbToStory(row));
    } catch (error) {
      console.warn('Stories table unavailable, using local storage.', error);
      const storageKey = await getStoriesStorageKey();
      return readStories(storageKey);
    }
  }

  async createStory(story: Story): Promise<Story> {
    try {
      const userId = await getCurrentUserId();
      const { data, error } = await storiesTable()
        .upsert(storyToDb(story, userId), { onConflict: 'id' })
        .select()
        .single();

      if (error) throw error;
      return dbToStory(data as DbStory);
    } catch (error) {
      console.warn('Stories table unavailable, using local storage.', error);
      const storageKey = await getStoriesStorageKey();
      const stories = readStories(storageKey);
      const next = stories.filter(s => s.id !== story.id).concat(story);
      writeStories(storageKey, next);
      return story;
    }
  }

  async updateStory(story: Story): Promise<Story> {
    try {
      const { data, error } = await storiesTable()
        .update({
          title: story.title,
          content: story.content,
          author_id: story.authorId || null,
          person_ids: story.personIds || [],
          date: story.date || null,
          tags: story.tags || [],
          updated_at: story.updatedAt,
        })
        .eq('id', story.id)
        .select()
        .single();

      if (error) throw error;
      return dbToStory(data as DbStory);
    } catch (error) {
      console.warn('Stories table unavailable, using local storage.', error);
      const storageKey = await getStoriesStorageKey();
      const stories = readStories(storageKey);
      const next = stories.map(s => s.id === story.id ? story : s);
      writeStories(storageKey, next);
      return story;
    }
  }

  async deleteStory(id: string): Promise<void> {
    try {
      const { error } = await storiesTable()
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.warn('Stories table unavailable, using local storage.', error);
      const storageKey = await getStoriesStorageKey();
      const stories = readStories(storageKey);
      const next = stories.filter(s => s.id !== id);
      writeStories(storageKey, next);
    }
  }

  async getAllBranches() {
    return getAllBranches();
  }

  // Safe bulk import: upsert new records FIRST, then remove stale records only AFTER all inserts succeed!
  async importData(persons: Person[], relationships: Relationship[], evidence: Evidence[]): Promise<void> {
    const userId = await getCurrentUserId();

    const [existingPersonsRes, existingRelsRes, existingEvRes] = await Promise.all([
      supabase.from('persons').select('id'),
      supabase.from('relationships').select('id'),
      supabase.from('evidence').select('id'),
    ]);

    const importedPersonIds = new Set(persons.map(p => p.id));
    const importedRelIds = new Set(relationships.map(r => r.id));
    const importedEvIds = new Set(evidence.map(e => e.id));

    // 1. Upsert persons first (parent FK dependency)
    if (persons.length > 0) {
      const { error: personsError } = await supabase
        .from('persons')
        .upsert(persons.map(p => personToDb(p, userId)), { onConflict: 'id' });
      if (personsError) throw personsError;
    }

    // 2. Upsert relationships second
    if (relationships.length > 0) {
      const { error: relsError } = await supabase
        .from('relationships')
        .upsert(relationships.map(r => relationshipToDb(r, userId)), { onConflict: 'id' });
      if (relsError) throw relsError;
    }

    // 3. Upsert evidence third
    if (evidence.length > 0) {
      const { error: evidenceError } = await supabase
        .from('evidence')
        .upsert(evidence.map(e => evidenceToDb(e, userId)), { onConflict: 'id' });
      if (evidenceError) throw evidenceError;
    }

    // 4. Only now delete stale rows that were not part of the imported snapshot
    const staleEvIds = (existingEvRes.data || [])
      .map(r => r.id)
      .filter(id => !importedEvIds.has(id));
    const staleRelIds = (existingRelsRes.data || [])
      .map(r => r.id)
      .filter(id => !importedRelIds.has(id));
    const stalePersonIds = (existingPersonsRes.data || [])
      .map(r => r.id)
      .filter(id => !importedPersonIds.has(id));

    if (staleEvIds.length > 0) {
      const { error } = await supabase.from('evidence').delete().in('id', staleEvIds);
      if (error) throw error;
    }
    if (staleRelIds.length > 0) {
      const { error } = await supabase.from('relationships').delete().in('id', staleRelIds);
      if (error) throw error;
    }
    if (stalePersonIds.length > 0) {
      const { error } = await supabase.from('persons').delete().in('id', stalePersonIds);
      if (error) throw error;
    }
  }

  async clearAll(): Promise<void> {
    // Delete in order to respect foreign keys
    const { error: evErr } = await supabase
      .from('evidence')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (evErr) throw evErr;

    const { error: relErr } = await supabase
      .from('relationships')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (relErr) throw relErr;

    const { error: personErr } = await supabase
      .from('persons')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (personErr) throw personErr;

    await supabase.from('audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    try {
      await storiesTable().delete().neq('id', '00000000-0000-0000-0000-000000000000');
    } catch (error) {
      console.warn('Stories table unavailable, skipping clear.', error);
    }

    const storageKey = await getStoriesStorageKey();
    writeStories(storageKey, []);
  }
}

export const supabaseStorage = new SupabaseAdapter();
