import { User, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Person } from '@/types';

interface PersonNodeProps {
  person: Person;
  isSelected: boolean;
  onClick: () => void;
  size?: 'small' | 'normal' | 'large';
  showAddButton?: boolean;
  onAdd?: () => void;
}

function truncateName(name: string, maxLength: number): string {
  if (name.length <= maxLength) return name;
  return name.substring(0, maxLength).trim() + '...';
}

export function PersonNode({ 
  person, 
  isSelected, 
  onClick, 
  size = 'normal',
  showAddButton,
  onAdd 
}: PersonNodeProps) {
  const yearBirth = person.birthDate ? new Date(person.birthDate).getFullYear() : null;
  const yearDeath = person.deathDate ? new Date(person.deathDate).getFullYear() : null;
  
  const sizeConfig = {
    small: { card: 'p-2 w-[100px]', avatar: 'w-8 h-8', nameSize: 'text-[11px]', yearSize: 'text-[9px]', maxChars: 14 },
    normal: { card: 'p-3 w-[130px]', avatar: 'w-11 h-11', nameSize: 'text-sm', yearSize: 'text-xs', maxChars: 18 },
    large: { card: 'p-4 w-[160px]', avatar: 'w-14 h-14', nameSize: 'text-base', yearSize: 'text-sm', maxChars: 22 },
  };

  const config = sizeConfig[size];
  const displayName = truncateName(person.fullName, config.maxChars);

  const genderColors = {
    male: {
      border: 'border-node-male',
      bg: 'bg-node-male/15',
      avatar: 'bg-node-male/25 text-node-male'
    },
    female: {
      border: 'border-node-female',
      bg: 'bg-node-female/15',
      avatar: 'bg-node-female/25 text-node-female'
    },
    unknown: {
      border: 'border-node-unknown',
      bg: 'bg-node-unknown/15',
      avatar: 'bg-node-unknown/25 text-node-unknown'
    }
  };

  const colors = genderColors[person.gender];

  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className={cn(
          "flex flex-col items-center rounded-lg border-2 transition-all duration-200",
          "hover:shadow-md hover:scale-105",
          config.card,
          colors.border,
          colors.bg,
          isSelected && "ring-2 ring-offset-2 ring-accent shadow-warm scale-105"
        )}
      >
        {/* Avatar */}
        <div className={cn(
          "rounded-full flex items-center justify-center mb-1.5",
          config.avatar,
          colors.avatar
        )}>
          {person.photoUrl ? (
            <img 
              src={person.photoUrl} 
              alt={person.fullName}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <User className={size === 'small' ? "w-4 h-4" : size === 'large' ? "w-7 h-7" : "w-5 h-5"} />
          )}
        </div>

        {/* Name */}
        <span 
          className={cn("font-medium text-center leading-tight", config.nameSize)}
          title={person.fullName}
        >
          {displayName}
        </span>

        {/* Years */}
        <span className={cn("text-muted-foreground", config.yearSize)}>
          {yearBirth || '?'}{yearDeath ? ` - ${yearDeath}` : ''}
        </span>

        {/* Verified badge */}
        {person.tags.includes('verified') && size !== 'small' && (
          <span className="mt-1 px-1 py-0.5 text-[9px] rounded bg-success/20 text-success font-medium">
            ✓ Verified
          </span>
        )}
      </button>

      {/* Add button overlay */}
      {showAddButton && onAdd && (
        <button
          onClick={(e) => { e.stopPropagation(); onAdd(); }}
          className="absolute -right-2 -top-2 w-6 h-6 rounded-full bg-primary text-primary-foreground 
            flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity 
            hover:bg-primary/80 shadow-md"
        >
          <Plus className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

interface PlaceholderNodeProps {
  label: string;
  onClick: () => void;
  size?: 'small' | 'normal' | 'large';
}

export function PlaceholderNode({ label, onClick, size = 'normal' }: PlaceholderNodeProps) {
  const sizeConfig = {
    small: 'p-2 w-[100px] h-[70px]',
    normal: 'p-3 w-[130px] h-[90px]',
    large: 'p-4 w-[160px] h-[110px]',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border-2 border-dashed",
        "border-muted-foreground/30 bg-muted/30 text-muted-foreground",
        "hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all duration-200",
        sizeConfig[size]
      )}
    >
      <Plus className="w-5 h-5 mb-1" />
      <span className="text-xs font-medium text-center">{label}</span>
    </button>
  );
}
