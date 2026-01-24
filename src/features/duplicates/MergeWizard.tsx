import { useState } from 'react';
import { useFamilyStore } from '@/store/familyStore';
import { 
  type DuplicateCandidate, 
  type MergeDecision,
  getDefaultMergeDecision,
  applyMergeDecision 
} from '@/lib/duplicateDetection';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert';
import { 
  User, 
  Calendar, 
  FileText, 
  Tag, 
  Image,
  Check,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MergeWizardProps {
  candidate: DuplicateCandidate;
  onComplete: () => void;
  onCancel: () => void;
}

export function MergeWizard({ candidate, onComplete, onCancel }: MergeWizardProps) {
  const { updatePerson, deletePerson, relationships, updateRelationship } = useFamilyStore();
  const [decision, setDecision] = useState<MergeDecision>(() => getDefaultMergeDecision(candidate));
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'select' | 'preview' | 'complete'>('select');

  const { person1, person2 } = candidate;

  const handleMerge = async () => {
    setIsProcessing(true);
    try {
      const { merged, deleteId } = applyMergeDecision(candidate, decision);
      const keepId = merged.id;

      // Update all relationships that reference the deleted person
      const affectedRelationships = relationships.filter(
        r => r.fromPersonId === deleteId || r.toPersonId === deleteId
      );

      for (const rel of affectedRelationships) {
        await updateRelationship(rel.id, {
          fromPersonId: rel.fromPersonId === deleteId ? keepId : rel.fromPersonId,
          toPersonId: rel.toPersonId === deleteId ? keepId : rel.toPersonId,
        });
      }

      // Update the kept person with merged data
      await updatePerson(keepId, merged);

      // Delete the other person
      await deletePerson(deleteId);

      setStep('complete');
      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch (error) {
      console.error('Merge failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const genderLabels: Record<string, string> = {
    male: 'Laki-laki',
    female: 'Perempuan',
    unknown: 'Tidak diketahui'
  };

  if (step === 'complete') {
    return (
      <div className="py-8 text-center">
        <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-success" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Merge Berhasil!</h3>
        <p className="text-muted-foreground">Data telah digabungkan dan relasi dipindahkan.</p>
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
            Preview hasil merge. Klik "Konfirmasi Merge" untuk melanjutkan.
          </AlertDescription>
        </Alert>

        <div className="p-4 bg-muted/50 rounded-lg space-y-3">
          <h4 className="font-medium">Hasil Merge:</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-muted-foreground">Nama:</span>
            <span className="font-medium">{merged.fullName}</span>
            
            <span className="text-muted-foreground">Gender:</span>
            <span>{genderLabels[merged.gender]}</span>
            
            <span className="text-muted-foreground">Tanggal Lahir:</span>
            <span>{formatDate(merged.birthDate)}</span>
            
            <span className="text-muted-foreground">Tanggal Wafat:</span>
            <span>{formatDate(merged.deathDate)}</span>
            
            <span className="text-muted-foreground">Tags:</span>
            <div className="flex flex-wrap gap-1">
              {merged.tags.map(tag => (
                <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
              ))}
            </div>
            
            <span className="text-muted-foreground">Confidence:</span>
            <span>{merged.confidenceScore}%</span>
          </div>
          
          {merged.notes && (
            <div className="pt-2 border-t">
              <span className="text-sm text-muted-foreground">Catatan:</span>
              <p className="text-sm mt-1 whitespace-pre-wrap">{merged.notes}</p>
            </div>
          )}
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={() => setStep('select')}>
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
    <div className="space-y-6">
      {/* Header comparison */}
      <div className="flex items-center justify-center gap-4 py-2">
        <PersonBadge person={person1} label="A" />
        <ArrowRight className="w-5 h-5 text-muted-foreground" />
        <PersonBadge person={person2} label="B" />
      </div>

      <Separator />

      {/* Field selections */}
      <div className="space-y-5">
        {/* Name */}
        <FieldSelector
          icon={<User className="w-4 h-4" />}
          label="Nama Lengkap"
          value1={person1.fullName}
          value2={person2.fullName}
          selected={decision.fullName}
          onChange={(v) => setDecision(d => ({ ...d, fullName: v as 'person1' | 'person2' }))}
        />

        {/* Gender */}
        <FieldSelector
          icon={<User className="w-4 h-4" />}
          label="Gender"
          value1={genderLabels[person1.gender]}
          value2={genderLabels[person2.gender]}
          selected={decision.gender}
          onChange={(v) => setDecision(d => ({ ...d, gender: v as 'person1' | 'person2' }))}
        />

        {/* Birth Date */}
        <FieldSelector
          icon={<Calendar className="w-4 h-4" />}
          label="Tanggal Lahir"
          value1={formatDate(person1.birthDate)}
          value2={formatDate(person2.birthDate)}
          selected={decision.birthDate}
          onChange={(v) => setDecision(d => ({ ...d, birthDate: v as 'person1' | 'person2' | 'none' }))}
          allowNone
        />

        {/* Death Date */}
        {(person1.deathDate || person2.deathDate) && (
          <FieldSelector
            icon={<Calendar className="w-4 h-4" />}
            label="Tanggal Wafat"
            value1={formatDate(person1.deathDate)}
            value2={formatDate(person2.deathDate)}
            selected={decision.deathDate}
            onChange={(v) => setDecision(d => ({ ...d, deathDate: v as 'person1' | 'person2' | 'none' }))}
            allowNone
          />
        )}

        {/* Photo */}
        {(person1.photoUrl || person2.photoUrl) && (
          <FieldSelector
            icon={<Image className="w-4 h-4" />}
            label="Foto"
            value1={person1.photoUrl ? '📷 Ada foto' : '-'}
            value2={person2.photoUrl ? '📷 Ada foto' : '-'}
            selected={decision.photoUrl}
            onChange={(v) => setDecision(d => ({ ...d, photoUrl: v as 'person1' | 'person2' | 'none' }))}
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
            onValueChange={(v) => setDecision(d => ({ ...d, notes: v as 'merge' | 'person1' | 'person2' }))}
            className="grid grid-cols-3 gap-2"
          >
            <label className={cn(
              "flex items-center justify-center p-2 border rounded-lg cursor-pointer transition-colors",
              decision.notes === 'merge' && "border-primary bg-primary/5"
            )}>
              <RadioGroupItem value="merge" className="sr-only" />
              <span className="text-sm">Gabungkan</span>
            </label>
            <label className={cn(
              "flex items-center justify-center p-2 border rounded-lg cursor-pointer transition-colors",
              decision.notes === 'person1' && "border-primary bg-primary/5"
            )}>
              <RadioGroupItem value="person1" className="sr-only" />
              <span className="text-sm">Orang A</span>
            </label>
            <label className={cn(
              "flex items-center justify-center p-2 border rounded-lg cursor-pointer transition-colors",
              decision.notes === 'person2' && "border-primary bg-primary/5"
            )}>
              <RadioGroupItem value="person2" className="sr-only" />
              <span className="text-sm">Orang B</span>
            </label>
          </RadioGroup>
        </div>

        {/* Tags info */}
        <div className="p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Tag className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Tags (otomatis digabung)</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {[...new Set([...person1.tags, ...person2.tags])].map(tag => (
              <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
            ))}
          </div>
        </div>

        {/* Keep ID */}
        <div className="space-y-2">
          <Label className="font-medium">Simpan data ke record:</Label>
          <RadioGroup 
            value={decision.keepId} 
            onValueChange={(v) => setDecision(d => ({ ...d, keepId: v as 'person1' | 'person2' }))}
            className="grid grid-cols-2 gap-2"
          >
            <label className={cn(
              "flex flex-col items-center p-3 border rounded-lg cursor-pointer transition-colors",
              decision.keepId === 'person1' && "border-primary bg-primary/5"
            )}>
              <RadioGroupItem value="person1" className="sr-only" />
              <span className="text-sm font-medium">{person1.fullName}</span>
              <span className="text-xs text-muted-foreground">
                Dibuat: {new Date(person1.createdAt).toLocaleDateString('id-ID')}
              </span>
            </label>
            <label className={cn(
              "flex flex-col items-center p-3 border rounded-lg cursor-pointer transition-colors",
              decision.keepId === 'person2' && "border-primary bg-primary/5"
            )}>
              <RadioGroupItem value="person2" className="sr-only" />
              <span className="text-sm font-medium">{person2.fullName}</span>
              <span className="text-xs text-muted-foreground">
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
        <Button onClick={() => setStep('preview')}>
          Preview Hasil
        </Button>
      </div>
    </div>
  );
}

function PersonBadge({ person, label }: { person: any; label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
        person.gender === 'male' ? 'bg-node-male/20 text-node-male' :
        person.gender === 'female' ? 'bg-node-female/20 text-node-female' :
        'bg-node-unknown/20 text-node-unknown'
      )}>
        {label}
      </div>
      <span className="font-medium text-sm">{person.fullName}</span>
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

function FieldSelector({ icon, label, value1, value2, selected, onChange, allowNone }: FieldSelectorProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <Label className="font-medium">{label}</Label>
      </div>
      <RadioGroup 
        value={selected} 
        onValueChange={onChange}
        className={cn("grid gap-2", allowNone ? "grid-cols-3" : "grid-cols-2")}
      >
        <label className={cn(
          "flex flex-col p-2 border rounded-lg cursor-pointer transition-colors text-sm",
          selected === 'person1' && "border-primary bg-primary/5"
        )}>
          <RadioGroupItem value="person1" className="sr-only" />
          <span className="text-xs text-muted-foreground mb-1">Orang A</span>
          <span className="font-medium truncate">{value1}</span>
        </label>
        <label className={cn(
          "flex flex-col p-2 border rounded-lg cursor-pointer transition-colors text-sm",
          selected === 'person2' && "border-primary bg-primary/5"
        )}>
          <RadioGroupItem value="person2" className="sr-only" />
          <span className="text-xs text-muted-foreground mb-1">Orang B</span>
          <span className="font-medium truncate">{value2}</span>
        </label>
        {allowNone && (
          <label className={cn(
            "flex flex-col items-center justify-center p-2 border rounded-lg cursor-pointer transition-colors text-sm",
            selected === 'none' && "border-primary bg-primary/5"
          )}>
            <RadioGroupItem value="none" className="sr-only" />
            <span className="text-muted-foreground">Kosongkan</span>
          </label>
        )}
      </RadioGroup>
    </div>
  );
}
