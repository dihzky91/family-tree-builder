import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFamilyStore } from '@/store/familyStore';
import { DocumentTypeEnum, VerificationStatusEnum, EntityTypeEnum } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useState } from 'react';

const EvidenceFormSchema = z.object({
  entityType: EntityTypeEnum,
  entityId: z.string().min(1, 'Please select an entity'),
  docType: DocumentTypeEnum,
  source: z.string().optional(),
  date: z.string().optional(),
  description: z.string().max(500).optional(),
  status: VerificationStatusEnum.default('draft'),
});

type EvidenceFormData = z.infer<typeof EvidenceFormSchema>;

interface EvidenceFormProps {
  onSuccess?: () => void;
}

export function EvidenceForm({ onSuccess }: EvidenceFormProps) {
  const { addEvidence, persons, relationships } = useFamilyStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EvidenceFormData>({
    resolver: zodResolver(EvidenceFormSchema),
    defaultValues: {
      entityType: 'PERSON',
      status: 'draft',
    },
  });

  const watchEntityType = watch('entityType');

  const onSubmit = async (data: EvidenceFormData) => {
    setIsSubmitting(true);
    try {
      await addEvidence({
        ...data,
        fileData: null, // File upload would go here
        fileName: null,
      });
      onSuccess?.();
    } catch (error) {
      console.error('Failed to save evidence:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const docTypeLabels: Record<string, string> = {
    birth_certificate: 'Akta Lahir',
    family_card: 'Kartu Keluarga',
    marriage_certificate: 'Surat Nikah',
    death_certificate: 'Akta Kematian',
    photo: 'Foto',
    other: 'Lainnya',
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Entity Type */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Tipe Entitas</Label>
          <Select 
            defaultValue="PERSON"
            onValueChange={(value) => {
              setValue('entityType', value as any);
              setValue('entityId', '');
            }}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PERSON">Anggota</SelectItem>
              <SelectItem value="RELATIONSHIP">Relasi</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Entitas Terkait *</Label>
          <Select onValueChange={(value) => setValue('entityId', value)}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Pilih..." />
            </SelectTrigger>
            <SelectContent>
              {watchEntityType === 'PERSON' ? (
                persons.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.fullName}</SelectItem>
                ))
              ) : (
                relationships.map((r) => {
                  const from = persons.find(p => p.id === r.fromPersonId);
                  const to = persons.find(p => p.id === r.toPersonId);
                  return (
                    <SelectItem key={r.id} value={r.id}>
                      {from?.fullName || '?'} → {to?.fullName || '?'} ({r.type})
                    </SelectItem>
                  );
                })
              )}
            </SelectContent>
          </Select>
          {errors.entityId && (
            <p className="text-sm text-destructive mt-1">{errors.entityId.message}</p>
          )}
        </div>
      </div>

      {/* Document Type */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Tipe Dokumen</Label>
          <Select 
            defaultValue="other"
            onValueChange={(value) => setValue('docType', value as any)}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(docTypeLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Status</Label>
          <Select 
            defaultValue="draft"
            onValueChange={(value) => setValue('status', value as any)}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="under_review">Dalam Review</SelectItem>
              <SelectItem value="verified">Terverifikasi</SelectItem>
              <SelectItem value="rejected">Ditolak</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Source & Date */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="source">Sumber</Label>
          <Input
            id="source"
            {...register('source')}
            placeholder="Arsip keluarga, kantor catatan sipil..."
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="date">Tanggal Dokumen</Label>
          <Input
            id="date"
            type="date"
            {...register('date')}
            className="mt-1"
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <Label htmlFor="description">Deskripsi</Label>
        <Textarea
          id="description"
          {...register('description')}
          placeholder="Keterangan tambahan tentang dokumen ini..."
          className="mt-1"
          rows={3}
        />
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Batal
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Menyimpan...' : 'Tambah Dokumen'}
        </Button>
      </div>
    </form>
  );
}
