import { useState, useMemo, useEffect } from 'react';
import { useFamilyStore } from '@/store/familyStore';
import type { Person, SpouseStatus } from '@/types';
import { validateRelationship } from '@/lib/relationshipValidation';
import { formatFlexibleDate, formatShortYearLabel } from '@/lib/flexibleDateUtils';
import { FlexibleDateInput } from '@/components/ui/flexible-date-input';
import { PhotoUploader } from '@/components/photo/PhotoUploader';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  User,
  UserPlus,
  Link2,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Check,
  Heart,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export type RelativeRole =
  | 'father'
  | 'mother'
  | 'brother'
  | 'sister'
  | 'partner'
  | 'son'
  | 'daughter';

export type InitialRelativeFilter = 'all' | 'parent' | 'spouse' | 'child' | 'sibling';

interface AddRelativeWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorPersonId: string | null;
  initialRole?: RelativeRole | null;
  initialFilter?: InitialRelativeFilter;
  onOpenManualLinkDialog?: () => void;
}

interface RoleConfig {
  role: RelativeRole;
  label: string;
  shortLabel: string;
  subtitle?: string;
  defaultGender: 'male' | 'female' | 'unknown';
  category: 'parent' | 'sibling' | 'spouse' | 'child';
}

const ROLE_CONFIGS: Record<RelativeRole, RoleConfig> = {
  father: {
    role: 'father',
    label: 'Tambah Ayah',
    shortLabel: 'Ayah',
    defaultGender: 'male',
    category: 'parent',
  },
  mother: {
    role: 'mother',
    label: 'Tambah Ibu',
    shortLabel: 'Ibu',
    defaultGender: 'female',
    category: 'parent',
  },
  brother: {
    role: 'brother',
    label: 'Tambah Saudara Laki-laki',
    shortLabel: 'Saudara Laki-laki',
    defaultGender: 'male',
    category: 'sibling',
  },
  sister: {
    role: 'sister',
    label: 'Tambah Saudara Perempuan',
    shortLabel: 'Saudara Perempuan',
    defaultGender: 'female',
    category: 'sibling',
  },
  partner: {
    role: 'partner',
    label: 'Tambah Pasangan',
    shortLabel: 'Pasangan',
    subtitle: 'Suami, istri, mantan pasangan...',
    defaultGender: 'unknown',
    category: 'spouse',
  },
  son: {
    role: 'son',
    label: 'Tambah Anak Laki-laki',
    shortLabel: 'Anak Laki-laki',
    defaultGender: 'male',
    category: 'child',
  },
  daughter: {
    role: 'daughter',
    label: 'Tambah Anak Perempuan',
    shortLabel: 'Anak Perempuan',
    defaultGender: 'female',
    category: 'child',
  },
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || '?';
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function AddRelativeWizardDialog({
  open,
  onOpenChange,
  anchorPersonId,
  initialRole = null,
  onOpenManualLinkDialog,
}: AddRelativeWizardDialogProps) {
  const {
    persons,
    relationships,
    addPerson,
    addRelationship,
    getPersonRelatives,
    findDuplicates,
  } = useFamilyStore();

  const anchorPerson = useMemo(
    () => persons.find((p) => p.id === anchorPersonId) || null,
    [persons, anchorPersonId]
  );

  const relatives = useMemo(
    () => (anchorPerson ? getPersonRelatives(anchorPerson.id) : null),
    [anchorPerson, getPersonRelatives, persons, relationships]
  );

  const existingFather = useMemo(
    () => relatives?.parents.find((p) => p.gender === 'male') || null,
    [relatives]
  );
  const existingMother = useMemo(
    () => relatives?.parents.find((p) => p.gender === 'female') || null,
    [relatives]
  );
  const hasTwoParents = (relatives?.parents.length || 0) >= 2;

  const [selectedRole, setSelectedRole] = useState<RelativeRole | null>(initialRole);
  const [mode, setMode] = useState<'create' | 'existing'>('create');

  // Form states for creating a new person
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'unknown'>('unknown');
  const [isLiving, setIsLiving] = useState(true);
  const [birthDate, setBirthDate] = useState('');
  const [birthPlace, setBirthPlace] = useState('');
  const [deathDate, setDeathDate] = useState('');
  const [deathPlace, setDeathPlace] = useState('');
  const [residence, setResidence] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [showMoreFields, setShowMoreFields] = useState(false);

  // Spouse / co-parent extras
  const [spouseStatus, setSpouseStatus] = useState<SpouseStatus>('married');
  const [marriageDate, setMarriageDate] = useState('');
  const [coParentId, setCoParentId] = useState<string>('all_spouses');
  const [alsoLinkOtherParent, setAlsoLinkOtherParent] = useState(true);

  // Existing person link mode
  const [existingPersonId, setExistingPersonId] = useState('');
  const [existingSearch, setExistingSearch] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset when dialog opens or anchor person / initialRole changes
  useEffect(() => {
    if (open) {
      setSelectedRole(initialRole || null);
      resetFormForRole(initialRole || null);
    }
  }, [open, anchorPersonId, initialRole]);

  const getDefaultPartnerGender = (): 'male' | 'female' | 'unknown' => {
    if (!anchorPerson) return 'unknown';
    if (anchorPerson.gender === 'male') return 'female';
    if (anchorPerson.gender === 'female') return 'male';
    return 'unknown';
  };

  const resetFormForRole = (role: RelativeRole | null) => {
    setMode('create');
    setFullName('');
    setIsLiving(true);
    setBirthDate('');
    setBirthPlace('');
    setDeathDate('');
    setDeathPlace('');
    setResidence(anchorPerson?.residence || '');
    setPhotoUrl('');
    setNotes('');
    setShowMoreFields(false);
    setSpouseStatus('married');
    setMarriageDate('');
    setExistingPersonId('');
    setExistingSearch('');
    setErrorMessage(null);
    setAlsoLinkOtherParent(true);

    if (relatives && relatives.spouses.length === 1) {
      setCoParentId(relatives.spouses[0].id);
    } else if (relatives && relatives.spouses.length > 1) {
      setCoParentId(relatives.spouses[0].id);
    } else {
      setCoParentId('none');
    }

    if (!role) {
      setGender('unknown');
      return;
    }

    if (role === 'partner') {
      setGender(getDefaultPartnerGender());
    } else {
      setGender(ROLE_CONFIGS[role].defaultGender);
    }
  };

  const handleSelectRole = (role: RelativeRole) => {
    setSelectedRole(role);
    resetFormForRole(role);
  };

  // Auto-sync role & dynamic title when user switches gender radio (like MyHeritage)
  const handleGenderChange = (nextGender: 'male' | 'female' | 'unknown') => {
    setGender(nextGender);
    if (!selectedRole) return;

    const category = ROLE_CONFIGS[selectedRole].category;
    if (category === 'parent') {
      if (nextGender === 'male' && !existingFather) setSelectedRole('father');
      else if (nextGender === 'female' && !existingMother) setSelectedRole('mother');
    } else if (category === 'sibling') {
      if (nextGender === 'male') setSelectedRole('brother');
      else if (nextGender === 'female') setSelectedRole('sister');
    } else if (category === 'child') {
      if (nextGender === 'male') setSelectedRole('son');
      else if (nextGender === 'female') setSelectedRole('daughter');
    }
  };

  // Dynamic role label based on current category + selected gender
  const dynamicRoleShortLabel = useMemo(() => {
    if (!selectedRole) return '';
    const category = ROLE_CONFIGS[selectedRole].category;
    if (category === 'parent') {
      if (gender === 'male') return 'Ayah';
      if (gender === 'female') return 'Ibu';
      return 'Orang Tua';
    }
    if (category === 'sibling') {
      if (gender === 'male') return 'Saudara Laki-laki';
      if (gender === 'female') return 'Saudara Perempuan';
      return 'Saudara Kandung';
    }
    if (category === 'child') {
      if (gender === 'male') return 'Anak Laki-laki';
      if (gender === 'female') return 'Anak Perempuan';
      return 'Anak';
    }
    if (category === 'spouse') {
      if (gender === 'male') return 'Suami / Pasangan';
      if (gender === 'female') return 'Istri / Pasangan';
      return 'Pasangan';
    }
    return ROLE_CONFIGS[selectedRole].shortLabel;
  }, [selectedRole, gender]);

  // Duplicate detection while typing new person name
  const duplicateCandidates = useMemo(() => {
    if (mode !== 'create' || fullName.trim().length < 3) return [];
    return findDuplicates(fullName.trim(), birthDate || undefined).filter(
      (p) => p.id !== anchorPerson?.id
    );
  }, [mode, fullName, birthDate, findDuplicates, anchorPerson?.id]);

  // Candidates for "Link Existing Person"
  const availableExistingPersons = useMemo(() => {
    if (!anchorPerson) return [];
    const excludedIds = new Set<string>([anchorPerson.id]);
    const q = existingSearch.trim().toLowerCase();
    return persons
      .filter((p) => !excludedIds.has(p.id))
      .filter((p) => !q || p.fullName.toLowerCase().includes(q));
  }, [persons, anchorPerson, existingSearch]);

  const connectRelativeToAnchor = async (targetPerson: Person, role: RelativeRole) => {
    if (!anchorPerson) return;

    const category = ROLE_CONFIGS[role].category;

    if (category === 'parent') {
      const check = validateRelationship(
        'PARENT_CHILD',
        targetPerson.id,
        anchorPerson.id,
        persons,
        relationships
      );
      if (!check.valid) {
        throw new Error(check.errors[0] || 'Relasi orang tua tidak valid');
      }

      await addRelationship({
        type: 'PARENT_CHILD',
        fromPersonId: targetPerson.id,
        toPersonId: anchorPerson.id,
        meta: {},
      });

      // Automatically link to existing co-parent as spouse & parent of siblings if requested
      const existingParents = relatives?.parents || [];
      if (alsoLinkOtherParent && existingParents.length === 1) {
        const otherParent = existingParents[0];
        const alreadySpouse = relationships.some(
          (r) =>
            r.type === 'SPOUSE' &&
            ((r.fromPersonId === otherParent.id && r.toPersonId === targetPerson.id) ||
              (r.fromPersonId === targetPerson.id && r.toPersonId === otherParent.id))
        );
        if (!alreadySpouse) {
          await addRelationship({
            type: 'SPOUSE',
            fromPersonId: otherParent.id,
            toPersonId: targetPerson.id,
            meta: { status: 'married' },
          });
        }

        // Also connect to full siblings who share otherParent
        const siblings = relatives?.siblings || [];
        for (const sib of siblings) {
          const sibParents = relationships.filter(
            (r) => r.type === 'PARENT_CHILD' && r.toPersonId === sib.id
          );
          if (sibParents.length < 2 && !sibParents.some((r) => r.fromPersonId === targetPerson.id)) {
            await addRelationship({
              type: 'PARENT_CHILD',
              fromPersonId: targetPerson.id,
              toPersonId: sib.id,
              meta: {},
            });
          }
        }
      }
    } else if (category === 'spouse') {
      const check = validateRelationship(
        'SPOUSE',
        anchorPerson.id,
        targetPerson.id,
        persons,
        relationships
      );
      if (!check.valid) {
        throw new Error(check.errors[0] || 'Relasi pasangan tidak valid');
      }

      await addRelationship({
        type: 'SPOUSE',
        fromPersonId: anchorPerson.id,
        toPersonId: targetPerson.id,
        meta: {
          status: spouseStatus,
          startDate: marriageDate || null,
        },
      });
    } else if (category === 'child') {
      const check = validateRelationship(
        'PARENT_CHILD',
        anchorPerson.id,
        targetPerson.id,
        persons,
        relationships
      );
      if (!check.valid) {
        throw new Error(check.errors[0] || 'Relasi anak tidak valid');
      }

      await addRelationship({
        type: 'PARENT_CHILD',
        fromPersonId: anchorPerson.id,
        toPersonId: targetPerson.id,
        meta: {},
      });

      // Also connect selected co-parent (spouse) to the child
      if (coParentId && coParentId !== 'none') {
        const alreadyLinked = relationships.some(
          (r) =>
            r.type === 'PARENT_CHILD' &&
            r.fromPersonId === coParentId &&
            r.toPersonId === targetPerson.id
        );
        if (!alreadyLinked) {
          await addRelationship({
            type: 'PARENT_CHILD',
            fromPersonId: coParentId,
            toPersonId: targetPerson.id,
            meta: {},
          });
        }
      }
    } else if (category === 'sibling') {
      const existingParents = relatives?.parents || [];

      if (existingParents.length > 0) {
        // Connect sibling to all existing parents of anchorPerson
        for (const parent of existingParents) {
          const alreadyLinked = relationships.some(
            (r) =>
              r.type === 'PARENT_CHILD' &&
              r.fromPersonId === parent.id &&
              r.toPersonId === targetPerson.id
          );
          if (!alreadyLinked) {
            await addRelationship({
              type: 'PARENT_CHILD',
              fromPersonId: parent.id,
              toPersonId: targetPerson.id,
              meta: {},
            });
          }
        }
      } else {
        // No parent exists yet: create a placeholder connecting parent so both siblings appear connected in the tree
        const placeholderParent = await addPerson({
          fullName: `Orang Tua ${anchorPerson.fullName.split(' ')[0]}`,
          gender: 'unknown',
          notes: 'Dibuat otomatis sebagai leluhur penghubung saudara kandung',
          tags: ['needs review'],
          confidenceScore: 40,
        });

        await addRelationship({
          type: 'PARENT_CHILD',
          fromPersonId: placeholderParent.id,
          toPersonId: anchorPerson.id,
          meta: {},
        });

        await addRelationship({
          type: 'PARENT_CHILD',
          fromPersonId: placeholderParent.id,
          toPersonId: targetPerson.id,
          meta: {},
        });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!anchorPerson || !selectedRole) return;

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const roleInfo = ROLE_CONFIGS[selectedRole];

      if (mode === 'create') {
        if (!fullName.trim()) {
          setErrorMessage('Nama lengkap wajib diisi.');
          setIsSubmitting(false);
          return;
        }

        const createdPerson = await addPerson({
          fullName: fullName.trim(),
          gender,
          birthDate: birthDate.trim() || null,
          birthPlace: birthPlace.trim() || null,
          deathDate: !isLiving ? deathDate.trim() || 'Wafat' : null,
          deathPlace: !isLiving ? deathPlace.trim() || null : null,
          residence: residence.trim() || null,
          photoUrl: photoUrl || null,
          notes: notes.trim() || null,
          tags: [],
          confidenceScore: 75,
        });

        await connectRelativeToAnchor(createdPerson, selectedRole);
        toast.success(
          `${createdPerson.fullName} ditambahkan sebagai ${dynamicRoleShortLabel.toLowerCase()} dari ${anchorPerson.fullName}`
        );
      } else {
        if (!existingPersonId) {
          setErrorMessage('Pilih anggota keluarga yang ingin dihubungkan.');
          setIsSubmitting(false);
          return;
        }
        const targetPerson = persons.find((p) => p.id === existingPersonId);
        if (!targetPerson) {
          setErrorMessage('Anggota tidak ditemukan.');
          setIsSubmitting(false);
          return;
        }

        await connectRelativeToAnchor(targetPerson, selectedRole);
        toast.success(
          `${targetPerson.fullName} dihubungkan sebagai ${dynamicRoleShortLabel.toLowerCase()} dari ${anchorPerson.fullName}`
        );
      }

      onOpenChange(false);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Gagal menyimpan anggota dan relasi keluarga.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!anchorPerson) return null;

  const anchorLifespan = (() => {
    const b = anchorPerson.birthDate ? formatFlexibleDate(anchorPerson.birthDate) : '';
    const d = anchorPerson.deathDate ? formatFlexibleDate(anchorPerson.deathDate) : '';
    if (b && d) return `${b} – ${d}`;
    if (b) return `Lahir ${b}`;
    if (d) return `Wafat ${d}`;
    return 'Tahun belum tercatat';
  })();

  const partnerDefaultGender = getDefaultPartnerGender();
  const activeRoleConfig = selectedRole ? ROLE_CONFIGS[selectedRole] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'p-0 sm:p-0 overflow-hidden border-border/80 shadow-2xl transition-all duration-200',
          selectedRole ? 'max-w-lg sm:max-w-lg' : 'max-w-[720px] sm:max-w-[720px]'
        )}
      >
        {!selectedRole ? (
          /* =====================================================================
           * STEP 1: MYHERITAGE-STYLE VISUAL RELATIONSHIP DIAGRAM PICKER (Gambar 2)
           * ===================================================================== */
          <div className="relative w-full min-w-0 bg-gradient-to-b from-muted/50 via-background to-muted/30 p-4 sm:p-6">
            <DialogHeader className="text-center sm:text-center mb-3 sm:mb-4 pr-6 sm:pr-0">
              <DialogTitle className="font-display text-base sm:text-xl">
                Tambah Kerabat untuk {anchorPerson.fullName}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Pilih posisi hubungan keluarga yang ingin ditambahkan pada bagan silsilah
              </DialogDescription>
            </DialogHeader>

            {/* Diagram Canvas */}
            <div className="relative mx-auto flex w-full min-w-0 flex-col items-center gap-2.5 sm:gap-3 py-1">
              {/* TOP ROW: Father & Mother */}
              <div className="flex w-full flex-col items-center">
                <div className="grid w-full max-w-[440px] grid-cols-2 gap-2.5 sm:gap-4">
                  <DiagramOptionCard
                    label={existingFather ? `Ayah: ${existingFather.fullName}` : 'Tambah Ayah'}
                    sublabel={existingFather ? 'Sudah tercatat' : 'Orang tua laki-laki'}
                    gender="male"
                    disabled={Boolean(existingFather) || hasTwoParents}
                    onClick={() => handleSelectRole('father')}
                  />
                  <DiagramOptionCard
                    label={existingMother ? `Ibu: ${existingMother.fullName}` : 'Tambah Ibu'}
                    sublabel={existingMother ? 'Sudah tercatat' : 'Orang tua perempuan'}
                    gender="female"
                    disabled={Boolean(existingMother) || hasTwoParents}
                    onClick={() => handleSelectRole('mother')}
                  />
                </div>
                {/* Connector line down from parents to anchor person */}
                <div className="flex flex-col items-center">
                  <div className="h-2.5 w-28 sm:w-44 border-b-2 border-x-2 border-border/90 rounded-b-sm" />
                  <div className="h-3.5 w-0.5 bg-border/90" />
                </div>
              </div>

              {/* MIDDLE ROW: Siblings (Left) — Anchor Person (Center) — Partner (Right) */}
              <div className="w-full min-w-0 flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-0">
                {/* Left: Brother & Sister */}
                <div className="grid grid-cols-2 sm:flex sm:flex-col gap-2 w-full max-w-[440px] sm:w-[196px] shrink-0">
                  <DiagramOptionCard
                    label="Tambah Saudara Laki-laki"
                    sublabel="Kakak / adik laki-laki"
                    gender="male"
                    onClick={() => handleSelectRole('brother')}
                  />
                  <DiagramOptionCard
                    label="Tambah Saudara Perempuan"
                    sublabel="Kakak / adik perempuan"
                    gender="female"
                    onClick={() => handleSelectRole('sister')}
                  />
                </div>

                {/* Horizontal connector left */}
                <div className="hidden sm:flex items-center shrink-0">
                  <div className="w-2.5 h-16 border-y-2 border-r-2 border-border/90 rounded-r-sm" />
                  <div className="w-3.5 h-0.5 bg-border/90" />
                </div>

                {/* CENTER: Focused Anchor Person Card */}
                <div
                  className={cn(
                    'relative z-10 flex items-center gap-2.5 rounded-2xl border-2 bg-card px-3.5 py-2.5 shadow-md w-full max-w-[240px] sm:w-[214px] shrink-0',
                    anchorPerson.gender === 'male'
                      ? 'border-node-male'
                      : anchorPerson.gender === 'female'
                        ? 'border-node-female'
                        : 'border-primary'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold overflow-hidden border',
                      anchorPerson.gender === 'male'
                        ? 'bg-node-male/15 text-node-male border-node-male/35'
                        : anchorPerson.gender === 'female'
                          ? 'bg-node-female/15 text-node-female border-node-female/35'
                          : 'bg-muted text-muted-foreground border-border'
                    )}
                  >
                    {anchorPerson.photoUrl ? (
                      <img
                        src={anchorPerson.photoUrl}
                        alt={anchorPerson.fullName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      getInitials(anchorPerson.fullName)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-sm font-bold leading-snug text-foreground truncate">
                      {anchorPerson.fullName}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {anchorLifespan}
                    </p>
                  </div>
                </div>

                {/* Horizontal connector right */}
                <div className="hidden sm:flex items-center shrink-0">
                  <div className="w-4 h-0.5 bg-border/90" />
                </div>

                {/* Right: Partner / Spouse */}
                <div className="w-full max-w-[440px] sm:w-[196px] shrink-0">
                  <DiagramOptionCard
                    label={
                      relatives && relatives.spouses.length > 0
                        ? 'Tambah Pasangan Lain'
                        : 'Tambah Pasangan'
                    }
                    sublabel="Suami, istri, pasangan..."
                    gender={partnerDefaultGender}
                    onClick={() => handleSelectRole('partner')}
                  />
                </div>
              </div>

              {/* BOTTOM ROW: Son & Daughter */}
              <div className="flex w-full flex-col items-center">
                {/* Connector line down from anchor person to children */}
                <div className="flex flex-col items-center">
                  <div className="h-3.5 w-0.5 bg-border/90" />
                  <div className="h-2.5 w-28 sm:w-44 border-t-2 border-x-2 border-border/90 rounded-t-sm" />
                </div>
                <div className="grid w-full max-w-[440px] grid-cols-2 gap-2.5 sm:gap-4">
                  <DiagramOptionCard
                    label="Tambah Anak Laki-laki"
                    sublabel="Putra"
                    gender="male"
                    onClick={() => handleSelectRole('son')}
                  />
                  <DiagramOptionCard
                    label="Tambah Anak Perempuan"
                    sublabel="Putri"
                    gender="female"
                    onClick={() => handleSelectRole('daughter')}
                  />
                </div>
              </div>
            </div>

            {/* Footer hint / manual link fallback */}
            <div className="mt-4 pt-3 border-t border-border/60 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>Klik salah satu kotak untuk mengisi profil kerabat</span>
              {onOpenManualLinkDialog && persons.length >= 2 && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    onOpenManualLinkDialog();
                  }}
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Hubungkan manual 2 anggota
                </button>
              )}
            </div>
          </div>
        ) : (
          /* =====================================================================
           * STEP 2: MYHERITAGE-STYLE STREAMLINED RELATIVE FORM MODAL (Gambar 3)
           * ===================================================================== */
          <form onSubmit={handleSubmit} className="flex flex-col max-h-[88dvh]">
            {/* Modal Header */}
            <div className="px-5 pt-5 pb-3.5 border-b bg-muted/25">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 -ml-1 rounded-lg shrink-0"
                  onClick={() => setSelectedRole(null)}
                  title="Kembali ke diagram pilihan hubungan"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0 flex-1">
                  <DialogTitle className="font-display text-base sm:text-lg leading-tight truncate">
                    Tambah {dynamicRoleShortLabel} dari {anchorPerson.fullName}
                  </DialogTitle>
                  <DialogDescription className="text-xs mt-0.5">
                    {mode === 'create'
                      ? 'Buat profil baru dan otomatis sambungkan ke pohon silsilah'
                      : 'Pilih anggota yang sudah ada di daftar untuk dihubungkan'}
                  </DialogDescription>
                </div>
              </div>

              {/* Mode Switcher: Buat Anggota Baru vs Hubungkan yang Sudah Ada */}
              <div className="mt-3 grid grid-cols-2 rounded-xl bg-muted/70 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setMode('create');
                    setErrorMessage(null);
                  }}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-lg py-1.5 font-medium transition-all',
                    mode === 'create'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Buat Anggota Baru
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('existing');
                    setErrorMessage(null);
                  }}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-lg py-1.5 font-medium transition-all',
                    mode === 'existing'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Pilih yang Sudah Ada
                </button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="overflow-y-auto p-5 space-y-4">
              {errorMessage && (
                <Alert variant="destructive" className="py-2.5">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
                </Alert>
              )}

              {mode === 'create' ? (
                <>
                  {/* Duplicate Warning with Quick "Use Existing" button */}
                  {duplicateCandidates.length > 0 && (
                    <Alert className="border-amber-500/40 bg-amber-500/10 py-2.5">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <AlertTitle className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                        Nama serupa sudah ada di silsilah
                      </AlertTitle>
                      <AlertDescription className="mt-1 space-y-1.5 text-xs">
                        {duplicateCandidates.slice(0, 2).map((dup) => (
                          <div
                            key={dup.id}
                            className="flex items-center justify-between gap-2 rounded-lg bg-background/80 px-2.5 py-1.5 border border-border/60"
                          >
                            <span className="truncate font-medium">
                              {dup.fullName}{' '}
                              {formatShortYearLabel(dup.birthDate)
                                ? `(${formatShortYearLabel(dup.birthDate)})`
                                : ''}
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="h-6 px-2 text-[11px]"
                              onClick={() => {
                                setMode('existing');
                                setExistingPersonId(dup.id);
                              }}
                            >
                              Gunakan ini
                            </Button>
                          </div>
                        ))}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Gender Radio Pills (like MyHeritage: Male / Female / Unknown) */}
                  <div className="flex items-center gap-4">
                    <Label className="text-xs text-muted-foreground shrink-0">
                      Jenis Kelamin:
                    </Label>
                    <div className="flex flex-wrap items-center gap-2">
                      {(
                        [
                          {
                            value: 'male',
                            label: 'Laki-laki',
                            dot: 'bg-node-male',
                            disabled:
                              activeRoleConfig?.category === 'parent' && Boolean(existingFather),
                          },
                          {
                            value: 'female',
                            label: 'Perempuan',
                            dot: 'bg-node-female',
                            disabled:
                              activeRoleConfig?.category === 'parent' && Boolean(existingMother),
                          },
                          {
                            value: 'unknown',
                            label: 'Tidak diketahui',
                            dot: 'bg-node-unknown',
                            disabled: false,
                          },
                        ] as const
                      ).map((opt) => (
                        <label
                          key={opt.value}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                            opt.disabled
                              ? 'opacity-45 cursor-not-allowed border-border/50 bg-muted/40 text-muted-foreground'
                              : gender === opt.value
                                ? 'border-primary bg-primary/10 text-primary cursor-pointer'
                                : 'border-border/70 bg-background text-muted-foreground hover:text-foreground cursor-pointer'
                          )}
                          title={
                            opt.disabled
                              ? opt.value === 'male'
                                ? `Ayah sudah tercatat (${existingFather?.fullName})`
                                : `Ibu sudah tercatat (${existingMother?.fullName})`
                              : undefined
                          }
                        >
                          <input
                            type="radio"
                            name="relative-gender"
                            value={opt.value}
                            disabled={opt.disabled}
                            checked={gender === opt.value}
                            onChange={() => !opt.disabled && handleGenderChange(opt.value)}
                            className="sr-only"
                          />
                          <span className={cn('h-2 w-2 rounded-full', opt.dot)} />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Full Name */}
                  <div>
                    <Label htmlFor="rel-fullName" className="text-xs font-semibold">
                      Nama Lengkap <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="rel-fullName"
                      autoFocus
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={`Masukkan nama ${dynamicRoleShortLabel.toLowerCase()}...`}
                      className="mt-1 h-10"
                    />
                  </div>

                  {/* Contextual Parent/Spouse Selector when adding a Child or Parent */}
                  {activeRoleConfig?.category === 'child' &&
                    relatives &&
                    relatives.spouses.length > 0 && (
                      <div className="rounded-xl border border-border/70 bg-muted/30 p-3 space-y-1.5">
                        <Label className="text-xs font-medium">
                          Orang tua kedua (Pasangan dari {anchorPerson.fullName})
                        </Label>
                        <Select value={coParentId} onValueChange={setCoParentId}>
                          <SelectTrigger className="h-9 bg-background text-xs">
                            <SelectValue placeholder="Pilih pasangan..." />
                          </SelectTrigger>
                          <SelectContent>
                            {relatives.spouses.map((sp) => (
                              <SelectItem key={sp.id} value={sp.id}>
                                {sp.fullName}
                              </SelectItem>
                            ))}
                            <SelectItem value="none">
                              Hanya {anchorPerson.fullName} (Tanpa pasangan kedua)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                  {activeRoleConfig?.category === 'parent' &&
                    relatives &&
                    relatives.parents.length === 1 && (
                      <label className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-muted/30 p-3 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={alsoLinkOtherParent}
                          onChange={(e) => setAlsoLinkOtherParent(e.target.checked)}
                          className="h-4 w-4 rounded border-border text-primary"
                        />
                        <span>
                          Hubungkan juga sebagai pasangan dari{' '}
                          <strong>{relatives.parents[0].fullName}</strong>
                        </span>
                      </label>
                    )}

                  {/* Birth Date & Birth/Residence Place */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="rel-birthDate" className="text-xs">
                        Tanggal / Tahun Lahir
                      </Label>
                      <FlexibleDateInput
                        id="rel-birthDate"
                        value={birthDate}
                        onChange={setBirthDate}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="rel-residence" className="text-xs">
                        Kota / Tempat Tinggal
                      </Label>
                      <Input
                        id="rel-residence"
                        value={residence}
                        onChange={(e) => setResidence(e.target.value)}
                        placeholder="Contoh: Jakarta, Bekasi..."
                        className="mt-1 h-9 text-xs"
                      />
                    </div>
                  </div>

                  {/* Living / Deceased Radio (MyHeritage style) */}
                  <div className="pt-1 border-t border-border/50">
                    <div className="flex items-center gap-4 pt-2">
                      <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
                        <input
                          type="radio"
                          checked={isLiving}
                          onChange={() => setIsLiving(true)}
                          className="text-primary"
                        />
                        Masih Hidup
                      </label>
                      <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
                        <input
                          type="radio"
                          checked={!isLiving}
                          onChange={() => setIsLiving(false)}
                          className="text-primary"
                        />
                        Telah Wafat
                      </label>
                    </div>

                    {!isLiving && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl bg-muted/30 p-3 border border-border/60">
                        <div>
                          <Label htmlFor="rel-deathDate" className="text-xs">
                            Tanggal / Tahun Wafat
                          </Label>
                          <FlexibleDateInput
                            id="rel-deathDate"
                            value={deathDate}
                            onChange={setDeathDate}
                            freeTextPlaceholder="Contoh: 2017, sekitar 1998..."
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="rel-deathPlace" className="text-xs">
                            Tempat Wafat / Makam
                          </Label>
                          <Input
                            id="rel-deathPlace"
                            value={deathPlace}
                            onChange={(e) => setDeathPlace(e.target.value)}
                            placeholder="Kota / TPU..."
                            className="mt-1 h-9 text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Partner-specific status */}
                  {activeRoleConfig?.category === 'spouse' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl bg-muted/30 p-3 border border-border/60">
                      <div>
                        <Label className="text-xs">Status Hubungan</Label>
                        <Select
                          value={spouseStatus}
                          onValueChange={(v) => setSpouseStatus(v as SpouseStatus)}
                        >
                          <SelectTrigger className="mt-1 h-9 bg-background text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="married">Menikah</SelectItem>
                            <SelectItem value="divorced">Cerai</SelectItem>
                            <SelectItem value="partner">Pasangan</SelectItem>
                            <SelectItem value="unknown">Tidak diketahui</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="rel-marriageDate" className="text-xs">
                          Tanggal Pernikahan (Opsional)
                        </Label>
                        <Input
                          id="rel-marriageDate"
                          type="date"
                          value={marriageDate}
                          onChange={(e) => setMarriageDate(e.target.value)}
                          className="mt-1 h-9 text-xs bg-background"
                        />
                      </div>
                    </div>
                  )}

                  {/* Collapsible "Edit more (bio, photo, birth place...)" like MyHeritage bottom-left link */}
                  {showMoreFields && (
                    <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-3.5">
                      <div>
                        <Label className="text-xs">Foto Profil</Label>
                        <div className="mt-1.5">
                          <PhotoUploader
                            currentPhotoUrl={photoUrl}
                            onPhotoChange={setPhotoUrl}
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="rel-birthPlace" className="text-xs">
                          Tempat Kelahiran
                        </Label>
                        <Input
                          id="rel-birthPlace"
                          value={birthPlace}
                          onChange={(e) => setBirthPlace(e.target.value)}
                          placeholder="Kota kelahiran..."
                          className="mt-1 h-9 text-xs"
                        />
                      </div>
                      <div>
                        <Label htmlFor="rel-notes" className="text-xs">
                          Catatan / Biografi Singkat
                        </Label>
                        <Textarea
                          id="rel-notes"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Catatan tambahan..."
                          rows={2}
                          className="mt-1 text-xs"
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* MODE 2: LINK EXISTING PERSON */
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="existing-search" className="text-xs">
                      Cari Anggota yang Sudah Terdaftar
                    </Label>
                    <Input
                      id="existing-search"
                      value={existingSearch}
                      onChange={(e) => setExistingSearch(e.target.value)}
                      placeholder="Ketik nama anggota..."
                      className="mt-1 h-9 text-xs"
                    />
                  </div>

                  <div className="max-h-56 overflow-y-auto rounded-xl border border-border/70 divide-y divide-border/50">
                    {availableExistingPersons.length === 0 ? (
                      <div className="p-4 text-center text-xs text-muted-foreground">
                        Tidak ada anggota yang cocok.
                      </div>
                    ) : (
                      availableExistingPersons.map((p) => {
                        const isSelected = existingPersonId === p.id;
                        const yLabel = formatShortYearLabel(p.birthDate);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setExistingPersonId(p.id)}
                            className={cn(
                              'w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-xs transition-colors',
                              isSelected
                                ? 'bg-primary/12 text-primary font-semibold'
                                : 'hover:bg-muted/60'
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className={cn(
                                  'h-2.5 w-2.5 rounded-full shrink-0',
                                  p.gender === 'male'
                                    ? 'bg-node-male'
                                    : p.gender === 'female'
                                      ? 'bg-node-female'
                                      : 'bg-node-unknown'
                                )}
                              />
                              <span className="truncate">{p.fullName}</span>
                              {yLabel && (
                                <span className="text-[11px] text-muted-foreground shrink-0">
                                  ({yLabel})
                                </span>
                              )}
                            </div>
                            {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer (MyHeritage style: "Edit more..." on left, OK & Cancel on right) */}
            <div className="px-5 py-3.5 border-t bg-muted/20 flex flex-wrap items-center justify-between gap-2">
              {mode === 'create' ? (
                <button
                  type="button"
                  onClick={() => setShowMoreFields((prev) => !prev)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  {showMoreFields ? (
                    <>
                      <ChevronUp className="h-3.5 w-3.5" />
                      Sembunyikan detail tambahan
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3.5 w-3.5" />
                      Isi detail lengkap (foto, bio...)
                    </>
                  )}
                </button>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2 ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Batal
                </Button>
                <Button type="submit" size="sm" disabled={isSubmitting}>
                  {isSubmitting
                    ? 'Menyimpan...'
                    : mode === 'create'
                      ? 'Simpan & Hubungkan'
                      : 'Hubungkan'}
                </Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface DiagramOptionCardProps {
  label: string;
  sublabel?: string;
  gender: 'male' | 'female' | 'unknown';
  disabled?: boolean;
  onClick: () => void;
}

function DiagramOptionCard({
  label,
  sublabel,
  gender,
  disabled = false,
  onClick,
}: DiagramOptionCardProps) {
  const borderClass =
    gender === 'male'
      ? 'border-node-male/65 hover:border-node-male hover:bg-node-male/5'
      : gender === 'female'
        ? 'border-node-female/65 hover:border-node-female hover:bg-node-female/5'
        : 'border-primary/55 hover:border-primary hover:bg-primary/5';

  const avatarClass =
    gender === 'male'
      ? 'bg-node-male/15 text-node-male'
      : gender === 'female'
        ? 'bg-node-female/15 text-node-female'
        : 'bg-primary/15 text-primary';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'group relative flex w-full min-w-0 items-center gap-2.5 rounded-xl border-2 bg-card px-3 py-2.5 text-left shadow-sm transition-all',
        disabled
          ? 'opacity-45 cursor-not-allowed border-border bg-muted/40'
          : cn(borderClass, 'hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]')
      )}
    >
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform group-hover:scale-105',
          disabled ? 'bg-muted text-muted-foreground' : avatarClass
        )}
      >
        {gender === 'unknown' ? (
          <Heart className="h-4 w-4" />
        ) : (
          <User className="h-4 w-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold leading-snug text-foreground">{label}</p>
        {sublabel && (
          <p className="text-[10px] text-muted-foreground truncate mt-0.5">{sublabel}</p>
        )}
      </div>
    </button>
  );
}
