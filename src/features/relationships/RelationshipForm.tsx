import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState, useEffect } from 'react';
import { useFamilyStore } from '@/store/familyStore';
import { RelationshipTypeEnum, SpouseStatusEnum, type Relationship } from '@/types';
import { validateRelationship } from '@/lib/relationshipValidation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert';
import { AlertTriangle, XCircle, Users, Heart } from 'lucide-react';

const RelationshipFormSchema = z.object({
  type: RelationshipTypeEnum,
  fromPersonId: z.string().min(1, 'Pilih orang pertama'),
  toPersonId: z.string().min(1, 'Pilih orang kedua'),
  status: SpouseStatusEnum.optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

type FormData = z.infer<typeof RelationshipFormSchema>;

interface RelationshipFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  editingRelationship?: Relationship;
  preselectedPersonId?: string;
  suggestedType?: 'parent' | 'spouse' | 'child';
}

export function RelationshipForm({ 
  onSuccess, 
  onCancel, 
  editingRelationship,
  preselectedPersonId,
  suggestedType,
}: RelationshipFormProps) {
  const { addRelationship, updateRelationship, persons, relationships } = useFamilyStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

  const isEditing = !!editingRelationship;

  const initialDefaults: FormData = editingRelationship
    ? {
        type: editingRelationship.type,
        fromPersonId: editingRelationship.fromPersonId,
        toPersonId: editingRelationship.toPersonId,
        status: editingRelationship.meta?.status,
        startDate: editingRelationship.meta?.startDate,
        endDate: editingRelationship.meta?.endDate,
      }
    : suggestedType === 'spouse'
      ? {
          type: 'SPOUSE',
          fromPersonId: preselectedPersonId || '',
          toPersonId: '',
          status: 'married',
        }
      : suggestedType === 'parent'
        ? {
            type: 'PARENT_CHILD',
            fromPersonId: '',
            toPersonId: preselectedPersonId || '',
          }
        : {
            type: 'PARENT_CHILD',
            fromPersonId: preselectedPersonId || '',
            toPersonId: '',
          };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(RelationshipFormSchema),
    defaultValues: initialDefaults,
  });

  const watchType = watch('type');
  const watchFromPerson = watch('fromPersonId');
  const watchToPerson = watch('toPersonId');

  // Real-time validation
  useEffect(() => {
    if (watchFromPerson && watchToPerson) {
      const result = validateRelationship(
        watchType,
        watchFromPerson,
        watchToPerson,
        persons,
        relationships,
        editingRelationship?.id
      );
      setValidationErrors(result.errors);
      setValidationWarnings(result.warnings);
    } else {
      setValidationErrors([]);
      setValidationWarnings([]);
    }
  }, [watchType, watchFromPerson, watchToPerson, persons, relationships, editingRelationship?.id]);

  const onSubmit = async (data: FormData) => {
    // Final validation
    const result = validateRelationship(
      data.type,
      data.fromPersonId,
      data.toPersonId,
      persons,
      relationships,
      editingRelationship?.id
    );

    if (!result.valid) {
      setValidationErrors(result.errors);
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing) {
        await updateRelationship(editingRelationship.id, {
          type: data.type,
          fromPersonId: data.fromPersonId,
          toPersonId: data.toPersonId,
          meta: data.type === 'SPOUSE' ? {
            status: data.status,
            startDate: data.startDate,
            endDate: data.endDate,
          } : {},
        });
      } else {
        await addRelationship({
          type: data.type,
          fromPersonId: data.fromPersonId,
          toPersonId: data.toPersonId,
          meta: data.type === 'SPOUSE' ? {
            status: data.status,
            startDate: data.startDate,
            endDate: data.endDate,
          } : {},
        });
      }
      onSuccess?.();
    } catch (error) {
      console.error('Failed to save relationship:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTypeLabel = () => {
    if (watchType === 'PARENT_CHILD') {
      return {
        from: 'Orang Tua',
        to: 'Anak',
        icon: <Users className="w-4 h-4" />
      };
    }
    return {
      from: 'Pasangan 1',
      to: 'Pasangan 2',
      icon: <Heart className="w-4 h-4" />
    };
  };

  const labels = getTypeLabel();

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Relationship Type */}
      <div>
        <Label>Tipe Relasi</Label>
        <Select 
          value={watchType}
          onValueChange={(value) => setValue('type', value as 'PARENT_CHILD' | 'SPOUSE')}
        >
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PARENT_CHILD">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Orang Tua - Anak
              </div>
            </SelectItem>
            <SelectItem value="SPOUSE">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4" />
                Pasangan / Suami-Istri
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Person Selectors */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="flex items-center gap-2">
            {labels.icon} {labels.from}
          </Label>
          <Select 
            value={watchFromPerson}
            onValueChange={(value) => setValue('fromPersonId', value)}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Pilih..." />
            </SelectTrigger>
            <SelectContent>
              {persons
                .filter(p => p.id !== watchToPerson)
                .map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.fullName}
                  </SelectItem>
                ))
              }
            </SelectContent>
          </Select>
          {errors.fromPersonId && (
            <p className="text-sm text-destructive mt-1">{errors.fromPersonId.message}</p>
          )}
        </div>

        <div>
          <Label className="flex items-center gap-2">
            {labels.icon} {labels.to}
          </Label>
          <Select 
            value={watchToPerson}
            onValueChange={(value) => setValue('toPersonId', value)}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Pilih..." />
            </SelectTrigger>
            <SelectContent>
              {persons
                .filter(p => p.id !== watchFromPerson)
                .map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.fullName}
                  </SelectItem>
                ))
              }
            </SelectContent>
          </Select>
          {errors.toPersonId && (
            <p className="text-sm text-destructive mt-1">{errors.toPersonId.message}</p>
          )}
        </div>
      </div>

      {/* Spouse-specific fields */}
      {watchType === 'SPOUSE' && (
        <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
          <div>
            <Label>Status Pernikahan</Label>
            <Select 
              value={watch('status') || 'married'}
              onValueChange={(value) => setValue('status', value as any)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="married">Menikah</SelectItem>
                <SelectItem value="divorced">Cerai</SelectItem>
                <SelectItem value="partner">Pasangan (tidak resmi)</SelectItem>
                <SelectItem value="unknown">Tidak diketahui</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Tanggal Mulai</Label>
              <Input
                id="startDate"
                type="date"
                {...register('startDate')}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="endDate">Tanggal Berakhir</Label>
              <Input
                id="endDate"
                type="date"
                {...register('endDate')}
                className="mt-1"
              />
            </div>
          </div>
        </div>
      )}

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1">
              {validationErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Validation Warnings */}
      {validationWarnings.length > 0 && validationErrors.length === 0 && (
        <Alert className="border-warning bg-warning/10">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-warning">
            <ul className="list-disc list-inside space-y-1">
              {validationWarnings.map((warn, i) => (
                <li key={i}>{warn}</li>
              ))}
            </ul>
            <p className="mt-2 text-sm">Anda tetap bisa menyimpan jika data sudah benar.</p>
          </AlertDescription>
        </Alert>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Batal
        </Button>
        <Button 
          type="submit" 
          disabled={isSubmitting || validationErrors.length > 0}
        >
          {isSubmitting ? 'Menyimpan...' : isEditing ? 'Simpan Perubahan' : 'Tambah Relasi'}
        </Button>
      </div>
    </form>
  );
}
