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

export const StorySchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, 'Title is required'),
  content: z.string(), // can be HTML or simple text
  authorId: z.string().uuid().optional().nullable(),
  personIds: z.array(z.string().uuid()).default([]), // people mentioned
  date: z.string().optional().nullable(), // date of the event in the story
  tags: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Story = z.infer<typeof StorySchema>;

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
  stories: Story[];
}

// ============= FILTER TYPES =============
export interface FilterConfig {
  generations: number[]; // 0 = root, 1 = children, -1 = parents, etc.
  verificationStatuses: string[]; // 'verified', 'needs review', 'draft'
  ageRange: { min: number; max: number } | null;
  completeness: 'all' | 'complete' | 'partial' | 'minimal';
}

export type GenerationLevel = -3 | -2 | -1 | 0 | 1 | 2 | 3;

export interface PersonWithGeneration extends Person {
  generation?: GenerationLevel;
}

// ============= BRANCH & SUBMISSION TYPES =============

// Branch represents a family branch with its own submission form
export const BranchSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1).max(50), // URL-safe code like "family-budi"
  name: z.string().min(1), // "Keluarga Budi Santoso"
  rootPersonId: z.string().uuid(), // Person ID of branch head
  coordinatorName: z.string(),
  coordinatorEmail: z.string().email().optional(),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  submissionCount: z.number().default(0),
  approvedCount: z.number().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Branch = z.infer<typeof BranchSchema>;

// Form schema for creating branch
export const BranchFormSchema = z.object({
  code: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens'),
  name: z.string().min(1),
  rootPersonId: z.string().uuid(),
  coordinatorName: z.string().min(1),
  coordinatorEmail: z.string().email().optional(),
  description: z.string().optional(),
});

export type BranchFormData = z.infer<typeof BranchFormSchema>;

// Enum for relationship to branch
export const RelationToBranchEnum = z.enum(['child', 'grandchild', 'great-grandchild', 'other']);
export type RelationToBranch = z.infer<typeof RelationToBranchEnum>;

// Enum for submission status
export const SubmissionStatusEnum = z.enum(['pending', 'approved', 'rejected']);
export type SubmissionStatus = z.infer<typeof SubmissionStatusEnum>;

// Submission represents a public form submission
export const SubmissionSchema = z.object({
  id: z.string().uuid(),
  branchId: z.string().uuid(),

  // Submitter info
  submittedBy: z.string().min(1),
  submitterEmail: z.string().email().optional(),

  // Person data (to be created when approved)
  fullName: z.string().min(1),
  gender: GenderEnum,
  birthDate: z.string().optional(),
  birthPlace: z.string().optional(),
  deathDate: z.string().optional(),
  deathPlace: z.string().optional(),
  residence: z.string().optional(),
  photoUrl: z.string().optional(),
  notes: z.string().optional(),

  // Relationship info
  relationToBranch: RelationToBranchEnum,
  parentName: z.string().optional(), // If grandchild+, who is the parent

  // Review status
  status: SubmissionStatusEnum.default('pending'),
  reviewedAt: z.string().optional(),
  reviewedBy: z.string().uuid().optional(),
  reviewNotes: z.string().optional(),

  // Link to created person (when approved)
  createdPersonId: z.string().uuid().optional(),

  // Duplicate detection
  possibleDuplicateId: z.string().uuid().optional(),

  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Submission = z.infer<typeof SubmissionSchema>;

// Form schema for public submission
export const SubmissionFormSchema = z.object({
  submittedBy: z.string().min(1, 'Nama Anda diperlukan'),
  submitterEmail: z.string().email('Email tidak valid').optional().or(z.literal('')),
  fullName: z.string().min(1, 'Nama lengkap diperlukan'),
  gender: GenderEnum,
  birthDate: z.string().optional(),
  birthPlace: z.string().optional(),
  deathDate: z.string().optional(),
  deathPlace: z.string().optional(),
  residence: z.string().optional(),
  photoUrl: z.string().optional(),
  notes: z.string().max(500).optional(),
  relationToBranch: RelationToBranchEnum,
  parentName: z.string().optional(),
});

export type SubmissionFormData = z.infer<typeof SubmissionFormSchema>;

// Approved member info (for public display & quick self-update - privacy safe: no personal dates/addresses exposed)
export interface ApprovedMemberInfo {
  fullName: string;
  relationToBranch: RelationToBranch;
  parentName?: string;
  createdPersonId?: string;
  gender?: Gender;
  hasBirthDate?: boolean;
}

// ============= NUCLEAR FAMILY (for family grouping feature) =============
export interface NuclearFamily {
  id: string; // generated from parent IDs
  parents: Person[]; // 1-2 people (couple or single parent)
  children: Person[]; // all children of this couple/parent
  generation: number; // calculated from oldest ancestor (higher = older)
  createdAt: Date; // earliest marriage date or birth of first child
  familyName: string; // "Keluarga [Parent1] & [Parent2]" or "Keluarga [SingleParent]"
}

// ============= PUBLIC SHARE LINKS (Read-Only Shared Family Tree) =============
export const ShareScopeTypeEnum = z.enum(['full', 'branch']);
export type ShareScopeType = z.infer<typeof ShareScopeTypeEnum>;

export const ShareLinkSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1).max(60),
  title: z.string().min(1),
  description: z.string().optional(),
  scopeType: ShareScopeTypeEnum,
  branchId: z.string().uuid().optional().nullable(),
  rootPersonId: z.string().uuid().optional().nullable(),
  hasPin: z.boolean().default(false),
  pinCode: z.string().optional(), // Only returned to owner in management UI
  hideLivingDetails: z.boolean().default(false),
  isActive: z.boolean().default(true),
  viewCount: z.number().default(0),
  snapshotPersonsCount: z.number().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ShareLink = z.infer<typeof ShareLinkSchema>;

export const ShareLinkFormSchema = z.object({
  code: z
    .string()
    .min(4, 'Kode tautan minimal 4 karakter')
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'Hanya huruf kecil, angka, dan tanda hubung'),
  title: z.string().min(1, 'Judul silsilah diperlukan').max(120),
  description: z.string().max(300).optional(),
  scopeType: ShareScopeTypeEnum,
  branchId: z.string().optional(),
  rootPersonId: z.string().optional(),
  pinCode: z
    .string()
    .max(64, 'PIN maksimal 64 karakter')
    .refine((val) => !val || val.trim().length === 0 || val.trim().length >= 8, {
      message: 'PIN / passphrase minimal 8 karakter untuk keamanan',
    })
    .optional(),
  hideLivingDetails: z.boolean().default(false),
});

export type ShareLinkFormData = z.infer<typeof ShareLinkFormSchema>;

export interface PublicSharePayload {
  share: {
    id: string;
    code: string;
    title: string;
    description?: string;
    scopeType: ShareScopeType;
    branchId?: string | null;
    branchCode?: string | null;
    branchName?: string | null;
    rootPersonId?: string | null;
    hideLivingDetails: boolean;
    updatedAt: string;
  };
  persons: Person[];
  relationships: Relationship[];
}

