import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFamilyStore } from '@/store/familyStore';
import { PersonFormSchema, type PersonFormData, type Person } from '@/types';
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
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { X, Plus, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { PhotoUploader } from '@/components/photo/PhotoUploader';

interface PersonFormProps {
  person?: Person;
  onSuccess?: () => void;
}

const tagOptions = ['verified', 'needs review', 'draft', 'from document'];

export function PersonForm({ person, onSuccess }: PersonFormProps) {
  const { addPerson, updatePerson, findDuplicates } = useFamilyStore();
  const [tags, setTags] = useState<string[]>(person?.tags || []);
  const [newTag, setNewTag] = useState('');
  const [duplicates, setDuplicates] = useState<Person[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PersonFormData>({
    resolver: zodResolver(PersonFormSchema),
    defaultValues: {
      fullName: person?.fullName || '',
      gender: person?.gender || 'unknown',
      birthDate: person?.birthDate || '',
      deathDate: person?.deathDate || '',
      birthPlace: person?.birthPlace || '',
      deathPlace: person?.deathPlace || '',
      residence: person?.residence || '',
      photoUrl: person?.photoUrl || '',
      notes: person?.notes || '',
      tags: person?.tags || [],
      confidenceScore: person?.confidenceScore || 50,
    },
  });

  const watchName = watch('fullName');
  const watchBirthDate = watch('birthDate');
  const watchConfidence = watch('confidenceScore');

  // Check for duplicates
  useEffect(() => {
    if (watchName && watchName.length >= 3) {
      const found = findDuplicates(watchName, watchBirthDate);
      // Exclude current person if editing
      setDuplicates(person ? found.filter(p => p.id !== person.id) : found);
    } else {
      setDuplicates([]);
    }
  }, [watchName, watchBirthDate, findDuplicates, person]);

  const onSubmit = async (data: PersonFormData) => {
    setIsSubmitting(true);
    try {
      if (person) {
        await updatePerson(person.id, { ...data, tags });
      } else {
        await addPerson({ ...data, tags });
      }
      onSuccess?.();
    } catch (error) {
      console.error('Failed to save person:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addTag = (tag: string) => {
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setNewTag('');
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Duplicate Warning */}
      {duplicates.length > 0 && (
        <Alert variant="destructive" className="bg-warning/10 border-warning text-warning-foreground">
          <AlertTriangle className="h-4 w-4 !text-warning" />
          <AlertTitle>Kemungkinan Duplikat</AlertTitle>
          <AlertDescription>
            Ditemukan {duplicates.length} orang dengan nama serupa:
            <ul className="mt-2 list-disc list-inside">
              {duplicates.slice(0, 3).map(p => (
                <li key={p.id}>{p.fullName} {p.birthDate && `(${new Date(p.birthDate).getFullYear()})`}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Basic Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Label htmlFor="fullName">Nama Lengkap *</Label>
          <Input
            id="fullName"
            {...register('fullName')}
            placeholder="Masukkan nama lengkap"
            className="mt-1"
          />
          {errors.fullName && (
            <p className="text-sm text-destructive mt-1">{errors.fullName.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="gender">Jenis Kelamin</Label>
          <Select
            defaultValue={person?.gender || 'unknown'}
            onValueChange={(value) => setValue('gender', value as any)}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Pilih jenis kelamin" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Laki-laki</SelectItem>
              <SelectItem value="female">Perempuan</SelectItem>
              <SelectItem value="unknown">Tidak diketahui</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="md:col-span-2">
          <Label>Foto Profil</Label>
          <div className="mt-2">
            <PhotoUploader
              currentPhotoUrl={watch('photoUrl')}
              onPhotoChange={(url) => setValue('photoUrl', url)}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="birthDate">Tanggal Lahir</Label>
          <Input
            id="birthDate"
            type="date"
            {...register('birthDate')}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="deathDate">Tanggal Wafat</Label>
          <Input
            id="deathDate"
            type="date"
            {...register('deathDate')}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="birthPlace">Tempat Lahir</Label>
          <Input
            id="birthPlace"
            {...register('birthPlace')}
            placeholder="Kota/kabupaten..."
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="deathPlace">Tempat Wafat</Label>
          <Input
            id="deathPlace"
            {...register('deathPlace')}
            placeholder="Kota/kabupaten..."
            className="mt-1"
          />
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="residence">Tempat Tinggal</Label>
          <Input
            id="residence"
            {...register('residence')}
            placeholder="Alamat atau kota..."
            className="mt-1"
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <Label htmlFor="notes">Catatan</Label>
        <Textarea
          id="notes"
          {...register('notes')}
          placeholder="Catatan tambahan tentang anggota ini..."
          className="mt-1"
          rows={3}
        />
      </div>

      {/* Tags */}
      <div>
        <Label>Tag</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1">
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="ml-1 hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <Select onValueChange={addTag}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Pilih tag" />
            </SelectTrigger>
            <SelectContent>
              {tagOptions.filter(t => !tags.includes(t)).map((tag) => (
                <SelectItem key={tag} value={tag}>{tag}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Tag kustom..."
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTag(newTag);
              }
            }}
            className="flex-1"
          />
          <Button type="button" variant="outline" size="icon" onClick={() => addTag(newTag)}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Confidence Score */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <Label>Tingkat Keyakinan Data</Label>
          <span className="text-sm font-medium">{watchConfidence}%</span>
        </div>
        <Slider
          defaultValue={[person?.confidenceScore || 50]}
          max={100}
          step={5}
          onValueChange={(value) => setValue('confidenceScore', value[0])}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>Tidak yakin</span>
          <span>Sangat yakin</span>
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Batal
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Menyimpan...' : person ? 'Simpan Perubahan' : 'Tambah Anggota'}
        </Button>
      </div>
    </form>
  );
}
