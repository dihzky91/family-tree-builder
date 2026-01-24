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
import { useState, useRef } from 'react';
import { Upload, X, FileText, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

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
  const [fileData, setFileData] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      docType: 'other',
    },
  });

  const watchEntityType = watch('entityType');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileError(null);

    if (!file) {
      setFileData(null);
      setFileName(null);
      return;
    }

    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      setFileError('Format file tidak didukung. Gunakan JPG, PNG, WebP, atau PDF.');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setFileError('Ukuran file terlalu besar. Maksimal 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFileData(reader.result as string);
      setFileName(file.name);
    };
    reader.onerror = () => {
      setFileError('Gagal membaca file.');
    };
    reader.readAsDataURL(file);
  };

  const removeFile = () => {
    setFileData(null);
    setFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const onSubmit = async (data: EvidenceFormData) => {
    setIsSubmitting(true);
    try {
      await addEvidence({
        ...data,
        fileData,
        fileName,
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

  const isImage = fileName?.match(/\.(jpg|jpeg|png|webp)$/i);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* File Upload */}
      <div>
        <Label>Upload File (Opsional)</Label>
        <div className="mt-2">
          {fileData ? (
            <div className="relative border rounded-lg p-4 bg-muted/50">
              <button
                type="button"
                onClick={removeFile}
                className="absolute top-2 right-2 p-1 rounded-full bg-background hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              
              {isImage ? (
                <div className="flex items-center gap-4">
                  <img 
                    src={fileData} 
                    alt="Preview" 
                    className="w-24 h-24 object-cover rounded-lg"
                  />
                  <div>
                    <p className="font-medium text-sm">{fileName}</p>
                    <p className="text-xs text-muted-foreground">Preview gambar</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-background rounded-lg flex items-center justify-center">
                    <FileText className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{fileName}</p>
                    <p className="text-xs text-muted-foreground">File PDF</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <label 
              className={cn(
                "flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
                "hover:bg-muted/50 hover:border-primary/50",
                fileError && "border-destructive"
              )}
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="mb-1 text-sm text-muted-foreground">
                  <span className="font-semibold">Klik untuk upload</span> atau drag & drop
                </p>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG, WebP, atau PDF (maks. 5MB)
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                onChange={handleFileChange}
              />
            </label>
          )}
          {fileError && (
            <p className="text-sm text-destructive mt-2">{fileError}</p>
          )}
        </div>
      </div>

      {/* Entity Type & Entity */}
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

      {/* Document Type & Status */}
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
          <Label>Status Awal</Label>
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
