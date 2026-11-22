import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  MapPin,
  Pencil,
  Trash2,
  GitBranch,
  Plus,
  Heart,
  Baby,
  Users,
  Link2,
  CheckCircle,
  Home,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { RelationshipInspector } from '@/features/relationships/RelationshipInspector';
import { useFamilyStore } from '@/store/familyStore';
import { useIsMobile } from '@/hooks/use-mobile';
import type { Person } from '@/types';

interface PersonDetailSheetProps {
  person: Person | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPerson: (personId: string) => void;
  onEditPerson: (person: Person) => void;
  onDeletePerson: (person: Person) => void;
  onAddRelationship: (personId: string, type: 'parent' | 'spouse' | 'child') => void;
}

export function getPersonInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatFullDate(date?: string | null): string | null {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function calculateAge(birthDate?: string | null, deathDate?: string | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  const end = deathDate ? new Date(deathDate) : new Date();
  if (Number.isNaN(end.getTime())) return null;
  let age = end.getFullYear() - birth.getFullYear();
  const m = end.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && end.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

export function PersonDetailSheet({
  person,
  open,
  onOpenChange,
  onSelectPerson,
  onEditPerson,
  onDeletePerson,
  onAddRelationship,
}: PersonDetailSheetProps) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { getPersonRelatives } = useFamilyStore();

  const relatives = person ? getPersonRelatives(person.id) : null;
  const age = person ? calculateAge(person.birthDate, person.deathDate) : null;

  const handleOpenInChart = () => {
    if (!person) return;
    onOpenChange(false);
    navigate(`/chart?focus=${person.id}`);
  };

  const bodyContent = person ? (
    <div className="space-y-4">
      {/* Header Profile Summary */}
      <div className="flex items-start gap-3.5">
        <div className="relative shrink-0">
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center overflow-hidden text-base font-bold ${
              person.photoUrl ? 'border shadow-sm' : ''
            } ${
              person.gender === 'male'
                ? 'bg-node-male/20 text-node-male'
                : person.gender === 'female'
                  ? 'bg-node-female/20 text-node-female'
                  : 'bg-node-unknown/20 text-node-unknown'
            }`}
          >
            {person.photoUrl ? (
              <img
                src={person.photoUrl}
                alt={person.fullName}
                className="h-full w-full object-cover"
              />
            ) : (
              getPersonInitials(person.fullName)
            )}
          </div>
          {person.tags.includes('verified') && (
            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
              <CheckCircle className="w-3 h-3 text-white" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-display font-semibold text-lg leading-tight break-words">
            {person.fullName}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>
              {person.gender === 'male'
                ? 'Laki-laki'
                : person.gender === 'female'
                  ? 'Perempuan'
                  : 'Gender tidak diketahui'}
            </span>
            <span>•</span>
            <span className={person.deathDate ? 'text-muted-foreground' : 'text-emerald-600 dark:text-emerald-400 font-medium'}>
              {person.deathDate ? 'Almarhum/ah' : 'Masih hidup'}
            </span>
            {age !== null && (
              <>
                <span>•</span>
                <span>{age} th</span>
              </>
            )}
          </div>

          {person.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {person.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant={tag === 'verified' ? 'secondary' : 'outline'}
                  className={`text-[10px] px-2 py-0 ${
                    tag === 'needs review'
                      ? 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300'
                      : ''
                  }`}
                >
                  {tag === 'verified'
                    ? 'Terverifikasi'
                    : tag === 'needs review'
                      ? 'Perlu Review'
                      : tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Primary Actions */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="default"
            size="sm"
            className="h-9 text-xs gap-1.5"
            onClick={handleOpenInChart}
          >
            <GitBranch className="w-3.5 h-3.5" />
            Lihat di Silsilah
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-xs gap-1.5"
            onClick={() => onEditPerson(person)}
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit Profil
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 text-xs gap-1"
            onClick={() => onAddRelationship(person.id, 'parent')}
          >
            <Plus className="w-3 h-3" />
            Ortu
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 text-xs gap-1"
            onClick={() => onAddRelationship(person.id, 'spouse')}
          >
            <Heart className="w-3 h-3" />
            Pasangan
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 text-xs gap-1"
            onClick={() => onAddRelationship(person.id, 'child')}
          >
            <Baby className="w-3 h-3" />
            Anak
          </Button>
        </div>
      </div>

      {/* Dates & Places */}
      {(person.birthDate || person.deathDate || person.birthPlace || person.deathPlace || person.residence) && (
        <div className="rounded-xl border border-border/60 bg-muted/25 p-3 space-y-2 text-xs">
          {(person.birthDate || person.birthPlace) && (
            <div className="flex items-start gap-2">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <span className="text-muted-foreground">Lahir: </span>
                <span className="font-medium">
                  {formatFullDate(person.birthDate) || 'Tanggal tidak diketahui'}
                  {person.birthPlace ? ` · ${person.birthPlace}` : ''}
                </span>
              </div>
            </div>
          )}
          {(person.deathDate || person.deathPlace) && (
            <div className="flex items-start gap-2">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <span className="text-muted-foreground">Wafat: </span>
                <span className="font-medium">
                  {formatFullDate(person.deathDate) || 'Tanggal tidak diketahui'}
                  {person.deathPlace ? ` · ${person.deathPlace}` : ''}
                </span>
              </div>
            </div>
          )}
          {person.residence && (
            <div className="flex items-start gap-2">
              <Home className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <span className="text-muted-foreground">Domisili: </span>
                <span className="font-medium">{person.residence}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confidence Score */}
      <div className="rounded-xl border border-border/60 bg-muted/15 px-3 py-2.5">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-muted-foreground">Tingkat Keyakinan Data</span>
          <span className="font-semibold">{person.confidenceScore}%</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${person.confidenceScore}%` }}
          />
        </div>
      </div>

      {/* Notes */}
      {person.notes && (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">Catatan</p>
          <p className="text-xs leading-relaxed whitespace-pre-line">{person.notes}</p>
        </div>
      )}

      {/* Relationship Inspector */}
      <div className="pt-3 border-t">
        <h4 className="text-sm font-medium flex items-center gap-1.5 mb-2.5">
          <Link2 className="w-3.5 h-3.5 text-primary" />
          Relasi Keluarga
        </h4>
        <RelationshipInspector
          personId={person.id}
          onPersonClick={onSelectPerson}
        />
      </div>

      {/* Siblings */}
      {relatives && relatives.siblings.length > 0 && (
        <div className="space-y-2 pt-3 border-t">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            Saudara Kandung ({relatives.siblings.length})
          </p>
          <div className="space-y-1.5">
            {relatives.siblings.map((sib) => (
              <button
                key={sib.id}
                type="button"
                onClick={() => onSelectPerson(sib.id)}
                className="flex items-center justify-between w-full text-left text-xs px-3 py-2 rounded-xl border border-border/50 bg-background/60 hover:bg-muted transition-colors"
              >
                <span className="truncate font-medium">{sib.fullName}</span>
                {sib.birthDate && (
                  <span className="text-[11px] text-muted-foreground shrink-0 ml-2">
                    {new Date(sib.birthDate).getFullYear()}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Danger Zone */}
      <div className="pt-3 border-t">
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-9 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
          onClick={() => onDeletePerson(person)}
        >
          <Trash2 className="w-3.5 h-3.5" />
          Hapus Anggota Ini
        </Button>
      </div>
    </div>
  ) : null;

  if (isMobile) {
    return (
      <Drawer open={open && Boolean(person)} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85dvh] rounded-t-3xl safe-area-pb">
          <DrawerHeader className="px-4 pt-2 pb-2 border-b text-left">
            <DrawerTitle className="font-display text-base">Detail Anggota</DrawerTitle>
            <DrawerDescription className="sr-only">
              Ringkasan profil dan relasi keluarga
            </DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto p-4">{bodyContent}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open && Boolean(person)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0" title="Detail Anggota">
        <SheetHeader className="px-5 py-4 border-b text-left shrink-0">
          <SheetTitle className="font-display text-base">Detail Anggota</SheetTitle>
          <SheetDescription className="sr-only">
            Ringkasan profil dan relasi keluarga
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-5">{bodyContent}</div>
      </SheetContent>
    </Sheet>
  );
}
