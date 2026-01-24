import { z } from 'zod';

// ============= ENUMS =============
export const GenderEnum = z.enum(['male', 'female', 'unknown']);
export type Gender = z.infer<typeof GenderEnum>;

export const RelationshipTypeEnum = z.enum(['PARENT_CHILD', 'SPOUSE']);
export type RelationshipType = z.infer<typeof RelationshipTypeEnum>;

export const SpouseStatusEnum = z.enum(['married', 'divorced', 'partner', 'unknown']);
export type SpouseStatus = z.infer<typeof SpouseStatusEnum>;

export const VerificationStatusEnum = z.enum(['draft', 'under_review', 'verified', 'rejected']);
export type VerificationStatus = z.infer<typeof VerificationStatusEnum>;

export const DocumentTypeEnum = z.enum([
  'birth_certificate',
  'family_card',
  'marriage_certificate',
  'death_certificate',
  'photo',
  'other'
]);
export type DocumentType = z.infer<typeof DocumentTypeEnum>;

export const EntityTypeEnum = z.enum(['PERSON', 'RELATIONSHIP']);
export type EntityType = z.infer<typeof EntityTypeEnum>;

export const UserRoleEnum = z.enum(['admin', 'editor', 'viewer']);
export type UserRole = z.infer<typeof UserRoleEnum>;

// ============= SCHEMAS =============
export const PersonSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().min(1, 'Name is required'),
  gender: GenderEnum,
  birthDate: z.string().nullable().optional(),
  deathDate: z.string().nullable().optional(),
  birthPlace: z.string().nullable().optional(),
  deathPlace: z.string().nullable().optional(),
  residence: z.string().nullable().optional(),
  photoUrl: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  confidenceScore: z.number().min(0).max(100).default(50),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Person = z.infer<typeof PersonSchema>;

export const RelationshipSchema = z.object({
  id: z.string().uuid(),
  type: RelationshipTypeEnum,
  fromPersonId: z.string().uuid(),
  toPersonId: z.string().uuid(),
  meta: z.object({
    status: SpouseStatusEnum.optional(),
    startDate: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
  }).default({}),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Relationship = z.infer<typeof RelationshipSchema>;

export const EvidenceSchema = z.object({
  id: z.string().uuid(),
  entityType: EntityTypeEnum,
  entityId: z.string().uuid(),
  fileData: z.string().nullable().optional(), // deprecated - kept for backwards compat
  fileName: z.string().nullable().optional(),
  fileUrl: z.string().nullable().optional(), // URL from Supabase Storage
  filePath: z.string().nullable().optional(), // path in storage bucket
  docType: DocumentTypeEnum,
  source: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  status: VerificationStatusEnum.default('draft'),
  createdAt: z.string(),
});

export type Evidence = z.infer<typeof EvidenceSchema>;

export const AuditLogSchema = z.object({
  id: z.string().uuid(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  changes: z.record(z.any()).nullable().optional(),
  timestamp: z.string(),
  userId: z.string().nullable().optional(),
});

export type AuditLog = z.infer<typeof AuditLogSchema>;

// ============= FORM SCHEMAS =============
export const PersonFormSchema = z.object({
  fullName: z.string().min(1, 'Name is required').max(100),
  gender: GenderEnum,
  birthDate: z.string().optional().nullable(),
  deathDate: z.string().optional().nullable(),
  birthPlace: z.string().optional().nullable(),
  deathPlace: z.string().optional().nullable(),
  residence: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  tags: z.array(z.string()).default([]),
  confidenceScore: z.number().min(0).max(100).default(50),
});

export type PersonFormData = z.infer<typeof PersonFormSchema>;

export const RelationshipFormSchema = z.object({
  type: RelationshipTypeEnum,
  fromPersonId: z.string().uuid('Please select a person'),
  toPersonId: z.string().uuid('Please select a person'),
  status: SpouseStatusEnum.optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

export type RelationshipFormData = z.infer<typeof RelationshipFormSchema>;

// ============= FAMILY CHART TYPES =============
export interface FamilyChartPerson {
  id: string;
  data: {
    'first name': string;
    'last name': string;
    birthday: string;
    avatar?: string;
    gender: 'M' | 'F' | '';
  };
  rels: {
    spouses?: string[];
    children?: string[];
    parents?: string[];
    father?: string;
    mother?: string;
  };
}

// ============= EXPORT/IMPORT TYPES =============
export interface ExportData {
  version: string;
  exportedAt: string;
  checksum: string;
  persons: Person[];
  relationships: Relationship[];
  evidence: Evidence[];
}
