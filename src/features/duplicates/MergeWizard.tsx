import { useState } from 'react';
import { useFamilyStore } from '@/store/familyStore';
import {
  type DuplicateCandidate,
  type MergeDecision,
  getDefaultMergeDecision,
  applyMergeDecision,
} from '@/lib/duplicateDetection';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  User,
  Calendar,
  FileText,
  Tag,
  Image,
  Check,
  AlertTriangle,
  ArrowRight,
  MapPin,
  Home,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatFlexibleDate } from '@/lib/flexibleDateUtils';

interface MergeWizardProps {
  candidate: DuplicateCandidate;
  onComplete: () => void;
  onCancel: () => void;
}

export function MergeWizard({ candidate, onComplete, onCancel }: MergeWizardProps) {
  const { updatePerson, deletePerson, relationships, updateRelationship, deleteRelationship } =
    useFamilyStore();
  const [decision, setDecision] = useState<MergeDecision>(() => getDefaultMergeDecision(candidate));
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'select' | 'preview' | 'complete'>('select');

  const { person1, person2 } = candidate;

  const handleMerge = async () => {
    setIsProcessing(true);
    try {
      const { merged, deleteId } = applyMergeDecision(candidate, decision);
      const keepId = merged.id;

      // Track existing relationships on keepId to avoid creating duplicates or self-loops
      const existingKeys = new Set<string>();
      relationships
        .filter((r) => r.fromPersonId === keepId || r.toPersonId === keepId)
        .forEach((r) => {
          const key =
            r.type === 'SPOUSE'
              ? `SPOUSE:${[r.fromPersonId, r.toPersonId].sort().join('-')}`
              : `${r.type}:${r.fromPersonId}->${r.toPersonId}`;
          existingKeys.add(key);
        });

      const affectedRelationships = relationships.filter(
        (r) => r.fromPersonId === deleteId || r.toPersonId === deleteId
      );

      for (const rel of affectedRelationships) {
        const nextFrom = rel.fromPersonId === deleteId ? keepId : rel.fromPersonId;
        const nextTo = rel.toPersonId === deleteId ? keepId : rel.toPersonId;

        // Prevent self-loop
        if (nextFrom === nextTo) {
          await deleteRelationship(rel.id);
          continue;
        }

        const nextKey =
          rel.type === 'SPOUSE'
            ? `SPOUSE:${[nextFrom, nextTo].sort().join('-')}`
            : `${rel.type}:${nextFrom}->${nextTo}`;

        // Prevent duplicate relationship after migration
        if (existingKeys.has(nextKey)) {
          await deleteRelationship(rel.id);
          continue;
        }

        existingKeys.add(nextKey);
        await updateRelationship(rel.id, {
          fromPersonId: nextFrom,
          toPersonId: nextTo,
        });
      }

      await updatePerson(keepId, merged);
      await deletePerson(deleteId);

      setStep('complete');
      toast.success('Data berhasil digabungkan');
      setTimeout(() => {
        onComplete();
      }, 1200);
    } catch (error) {
      console.error('Merge failed:', error);
      toast.error(
        'Gagal menggabungkan data: ' + (error instanceof Error ? error.message : 'Terjadi kesalahan')
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-';
    return formatFlexibleDate(date) || date;
  };

  const genderLabels: Record<string, string> = {
    male: 'Laki-laki',
    female: 'Perempuan',
    unknown: 'Tidak diketahui',
  };

  if (step === 'complete') {
    return (
      <div className="py-8 text-center">
        <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-success" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Merge Berhasil!</h3>
        <p className="text-sm text-muted-foreground">
          Data telah digabungkan dan seluruh relasi dipindahkan dengan aman.
        </p>
      </div>
    );
  }

  if (step === 'preview') {
    const { merged } = applyMergeDecision(candidate, decision);

    return (
      <div className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Periksa hasil penggabungan di bawah ini sebelum mengonfirmasi.
          </AlertDescription>
        </Alert>

        <div className="p-4 bg-muted/50 rounded-xl space-y-3">
          <h4 className="font-medium text-sm">Hasil Merge:</h4>
          <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
            <span className="text-muted-foreground">Nama:</span>
            <span className="font-medium">{merged.fullName}</span>

            <span className="text-muted-foreground">Gender:</span>
            <span>{genderLabels[merged.gender]}</span>

            <span className="text-muted-foreground">Tanggal Lahir:</span>
            <span>{formatDate(merged.birthDate)}</span>

            {merged.birthPlace && (
              <>
                <span className="text-muted-foreground">Tempat Lahir:</span>
                <span>{merged.birthPlace}</span>
              </>
            )}

            {merged.deathDate && (
              <>
                <span className="text-muted-foreground">Tanggal Wafat:</span>
                <span>{formatDate(merged.deathDate)}</span>
              </>
            )}

            {merged.deathPlace && (
              <>
                <span className="text-muted-foreground">Tempat Wafat:</span>
                <span>{merged.deathPlace}</span>
              </>
            )}

            {merged.residence && (
              <>
                <span className="text-muted-foreground">Domisili:</span>
                <span>{merged.residence}</span>
              </>
            )}

            <span className="text-muted-foreground">Tags:</span>
            <div className="flex flex-wrap gap-1">
              {merged.tags.length > 0 ? (
                merged.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))
              ) : (
                <span>-</span>
              )}
            </div>

            <span className="text-muted-foreground">Keyakinan:</span>
            <span>{merged.confidenceScore}%</span>
          </div>

          {merged.notes && (
            <div className="pt-2 border-t">
              <span className="text-xs text-muted-foreground">Catatan:</span>
              <p className="text-sm mt-1 whitespace-pre-wrap">{merged.notes}</p>
            </div>
          )}
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={() => setStep('select')} disabled={isProcessing}>
            Kembali
          </Button>
          <Button onClick={handleMerge} disabled={isProcessing}>
            {isProcessing ? 'Memproses...' : 'Konfirmasi Merge'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header comparison */}
      <div className="flex items-center justify-center gap-3 py-1 flex-wrap">
        <PersonBadge person={person1} label="A" />
        <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
        <PersonBadge person={person2} label="B" />
      </div>

      <Separator />

      {/* Field selections */}
      <div className="space-y-4">
        <FieldSelector
          icon={<User className="w-4 h-4" />}
          label="Nama Lengkap"
          value1={person1.fullName}
          value2={person2.fullName}
          selected={decision.fullName}
          onChange={(v) => setDecision((d) => ({ ...d, fullName: v as 'person1' | 'person2' }))}
        />

        <FieldSelector
          icon={<User className="w-4 h-4" />}
          label="Gender"
          value1={genderLabels[person1.gender]}
          value2={genderLabels[person2.gender]}
          selected={decision.gender}
          onChange={(v) => setDecision((d) => ({ ...d, gender: v as 'person1' | 'person2' }))}
        />

        <FieldSelector
          icon={<Calendar className="w-4 h-4" />}
          label="Tanggal Lahir"
          value1={formatDate(person1.birthDate)}
          value2={formatDate(person2.birthDate)}
          selected={decision.birthDate}
          onChange={(v) =>
            setDecision((d) => ({ ...d, birthDate: v as 'person1' | 'person2' | 'none' }))
          }
          allowNone
        />

        {(person1.birthPlace || person2.birthPlace) && (
          <FieldSelector
            icon={<MapPin className="w-4 h-4" />}
            label="Tempat Lahir"
            value1={person1.birthPlace || '-'}
            value2={person2.birthPlace || '-'}
            selected={decision.birthPlace}
            onChange={(v) =>
              setDecision((d) => ({ ...d, birthPlace: v as 'person1' | 'person2' | 'none' }))
            }
            allowNone
          />
        )}

        {(person1.deathDate || person2.deathDate) && (
          <FieldSelector
            icon={<Calendar className="w-4 h-4" />}
            label="Tanggal Wafat"
            value1={formatDate(person1.deathDate)}
            value2={formatDate(person2.deathDate)}
            selected={decision.deathDate}
            onChange={(v) =>
              setDecision((d) => ({ ...d, deathDate: v as 'person1' | 'person2' | 'none' }))
            }
            allowNone
          />
        )}

        {(person1.deathPlace || person2.deathPlace) && (
          <FieldSelector
            icon={<MapPin className="w-4 h-4" />}
            label="Tempat Wafat"
            value1={person1.deathPlace || '-'}
            value2={person2.deathPlace || '-'}
            selected={decision.deathPlace}
            onChange={(v) =>
              setDecision((d) => ({ ...d, deathPlace: v as 'person1' | 'person2' | 'none' }))
            }
            allowNone
          />
        )}

        {(person1.residence || person2.residence) && (
          <FieldSelector
            icon={<Home className="w-4 h-4" />}
            label="Domisili"
            value1={person1.residence || '-'}
            value2={person2.residence || '-'}
            selected={decision.residence}
            onChange={(v) =>
              setDecision((d) => ({ ...d, residence: v as 'person1' | 'person2' | 'none' }))
            }
            allowNone
          />
        )}

        {(person1.photoUrl || person2.photoUrl) && (
          <FieldSelector
            icon={<Image className="w-4 h-4" />}
            label="Foto"
            value1={person1.photoUrl ? 'Ada foto' : '-'}
            value2={person2.photoUrl ? 'Ada foto' : '-'}
            selected={decision.photoUrl}
            onChange={(v) =>
              setDecision((d) => ({ ...d, photoUrl: v as 'person1' | 'person2' | 'none' }))
            }
            allowNone
          />
        )}

        {/* Notes */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <Label className="font-medium">Catatan</Label>
          </div>
          <RadioGroup
            value={decision.notes}
            onValueChange={(v) =>
              setDecision((d) => ({ ...d, notes: v as 'merge' | 'person1' | 'person2' }))
            }
            className="grid grid-cols-3 gap-2"
          >
            <label
              className={cn(
                'flex items-center justify-center p-2 border rounded-lg cursor-pointer transition-colors',
                decision.notes === 'merge' && 'border-primary bg-primary/5'
              )}
            >
              <RadioGroupItem value="merge" className="sr-only" />
              <span className="text-xs sm:text-sm">Gabungkan</span>
            </label>
            <label
              className={cn(
                'flex items-center justify-center p-2 border rounded-lg cursor-pointer transition-colors',
                decision.notes === 'person1' && 'border-primary bg-primary/5'
              )}
            >
              <RadioGroupItem value="person1" className="sr-only" />
              <span className="text-xs sm:text-sm">Orang A</span>
            </label>
            <label
              className={cn(
                'flex items-center justify-center p-2 border rounded-lg cursor-pointer transition-colors',
                decision.notes === 'person2' && 'border-primary bg-primary/5'
              )}
            >
              <RadioGroupItem value="person2" className="sr-only" />
              <span className="text-xs sm:text-sm">Orang B</span>
            </label>
          </RadioGroup>
        </div>

        {/* Tags info */}
        <div className="p-3 bg-muted/50 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Tag className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs sm:text-sm font-medium">Tags (otomatis digabung)</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {[...new Set([...person1.tags, ...person2.tags])].map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        {/* Keep ID */}
        <div className="space-y-2">
          <Label className="font-medium">Simpan data ke record:</Label>
          <RadioGroup
            value={decision.keepId}
            onValueChange={(v) => setDecision((d) => ({ ...d, keepId: v as 'person1' | 'person2' }))}
            className="grid grid-cols-2 gap-2"
          >
            <label
              className={cn(
                'flex flex-col items-center p-3 border rounded-xl cursor-pointer transition-colors text-center',
                decision.keepId === 'person1' && 'border-primary bg-primary/5'
              )}
            >
              <RadioGroupItem value="person1" className="sr-only" />
              <span className="text-sm font-medium truncate max-w-full">{person1.fullName}</span>
              <span className="text-[11px] text-muted-foreground">
                Dibuat: {new Date(person1.createdAt).toLocaleDateString('id-ID')}
              </span>
            </label>
            <label
              className={cn(
                'flex flex-col items-center p-3 border rounded-xl cursor-pointer transition-colors text-center',
                decision.keepId === 'person2' && 'border-primary bg-primary/5'
              )}
            >
              <RadioGroupItem value="person2" className="sr-only" />
              <span className="text-sm font-medium truncate max-w-full">{person2.fullName}</span>
              <span className="text-[11px] text-muted-foreground">
                Dibuat: {new Date(person2.createdAt).toLocaleDateString('id-ID')}
              </span>
            </label>
          </RadioGroup>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Batal
        </Button>
        <Button onClick={() => setStep('preview')}>Preview Hasil</Button>
      </div>
    </div>
  );
}

function PersonBadge({ person, label }: { person: { fullName: string; gender: string }; label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg">
      <div
        className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
          person.gender === 'male'
            ? 'bg-node-male/20 text-node-male'
            : person.gender === 'female'
              ? 'bg-node-female/20 text-node-female'
              : 'bg-node-unknown/20 text-node-unknown'
        )}
      >
        {label}
      </div>
      <span className="font-medium text-xs sm:text-sm">{person.fullName}</span>
    </div>
  );
}

interface FieldSelectorProps {
  icon: React.ReactNode;
  label: string;
  value1: string;
  value2: string;
  selected: string;
  onChange: (value: string) => void;
  allowNone?: boolean;
}

function FieldSelector({
  icon,
  label,
  value1,
  value2,
  selected,
  onChange,
  allowNone,
}: FieldSelectorProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <Label className="font-medium text-sm">{label}</Label>
      </div>
      <RadioGroup
        value={selected}
        onValueChange={onChange}
        className={cn('grid gap-2', allowNone ? 'grid-cols-3' : 'grid-cols-2')}
      >
        <label
          className={cn(
            'flex flex-col p-2 border rounded-lg cursor-pointer transition-colors text-xs sm:text-sm',
            selected === 'person1' && 'border-primary bg-primary/5'
          )}
        >
          <RadioGroupItem value="person1" className="sr-only" />
          <span className="text-[11px] text-muted-foreground mb-0.5">Orang A</span>
          <span className="font-medium truncate">{value1}</span>
        </label>
        <label
          className={cn(
            'flex flex-col p-2 border rounded-lg cursor-pointer transition-colors text-xs sm:text-sm',
            selected === 'person2' && 'border-primary bg-primary/5'
          )}
        >
          <RadioGroupItem value="person2" className="sr-only" />
          <span className="text-[11px] text-muted-foreground mb-0.5">Orang B</span>
          <span className="font-medium truncate">{value2}</span>
        </label>
        {allowNone && (
          <label
            className={cn(
              'flex flex-col items-center justify-center p-2 border rounded-lg cursor-pointer transition-colors text-xs sm:text-sm',
              selected === 'none' && 'border-primary bg-primary/5'
            )}
          >
            <RadioGroupItem value="none" className="sr-only" />
            <span className="text-muted-foreground">Kosongkan</span>
          </label>
        )}
      </RadioGroup>
    </div>
  );
}
