import { User, Calendar, CheckCircle, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Person } from '@/types';

interface FamilyUnitCardProps {
  person: Person;
  role: 'parent' | 'child';
  onEdit?: (person: Person) => void;
}

/**
 * Card component for displaying a single person within a family unit
 * Shows photo/initials, name, birth year, role badge
 */
export function FamilyUnitCard({ person, role, onEdit }: FamilyUnitCardProps) {
  const formatDate = (date: string | null | undefined) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div
      className={`
        flex items-center gap-2 p-2 rounded-lg border bg-card
        hover:bg-accent/50 transition-colors cursor-pointer
        ${role === 'parent' ? 'border-primary/30' : 'border-border'}
      `}
      onClick={() => onEdit?.(person)}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <div className={`
          w-8 h-8 rounded-full flex items-center justify-center overflow-hidden
          ${person.photoUrl ? 'border-2 border-border shadow-sm' : ''}
          ${person.gender === 'male' ? 'bg-node-male/20 text-node-male' :
            person.gender === 'female' ? 'bg-node-female/20 text-node-female' :
              'bg-node-unknown/20 text-node-unknown'}
        `}>
          {person.photoUrl ? (
            <img
              src={person.photoUrl}
              alt={person.fullName}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <User className="w-4 h-4" />
          )}
        </div>
        {person.tags.includes('verified') && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
            <CheckCircle className="w-2 h-2 text-white" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{person.fullName}</span>
          {role === 'parent' && (
            <Badge variant="outline" className="text-[10px] px-1.5 h-5 shrink-0">
              Orang Tua
            </Badge>
          )}
        </div>
        {person.birthDate && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
            <Calendar className="w-3 h-3" />
            <span>{formatDate(person.birthDate)}</span>
            {person.deathDate && <span> - {formatDate(person.deathDate)}</span>}
          </div>
        )}
      </div>

      {/* Tags indicator */}
      <div className="flex gap-1 shrink-0">
        {person.tags.includes('needs review') && (
          <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />
        )}
      </div>
    </div>
  );
}
