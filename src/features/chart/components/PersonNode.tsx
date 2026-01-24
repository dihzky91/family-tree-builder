import { User, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Person } from '@/types';

interface PersonNodeProps {
  person: Person;
  isSelected: boolean;
  onClick: () => void;
  size?: 'small' | 'normal' | 'large';
  showAddButton?: boolean;
  onAdd?: () => void;
  layoutId?: string;
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
  onAdd,
  layoutId
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
    <motion.div 
      className="relative group"
      layoutId={layoutId || `person-${person.id}`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ 
        opacity: 1, 
        scale: 1,
        transition: { type: "spring", stiffness: 300, damping: 25 }
      }}
      exit={{ opacity: 0, scale: 0.8 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <motion.button
        onClick={onClick}
        className={cn(
          "flex flex-col items-center rounded-lg border-2",
          config.card,
          colors.border,
          colors.bg,
          isSelected && "ring-2 ring-offset-2 ring-accent shadow-warm"
        )}
        animate={{
          scale: isSelected ? 1.05 : 1,
          boxShadow: isSelected 
            ? "0 8px 25px -5px rgba(0, 0, 0, 0.2)" 
            : "0 2px 10px -3px rgba(0, 0, 0, 0.1)"
        }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      >
        {/* Avatar */}
        <motion.div 
          className={cn(
            "rounded-full flex items-center justify-center mb-1.5",
            config.avatar,
            colors.avatar
          )}
          animate={{ scale: isSelected ? 1.1 : 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          {person.photoUrl ? (
            <img 
              src={person.photoUrl} 
              alt={person.fullName}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <User className={size === 'small' ? "w-4 h-4" : size === 'large' ? "w-7 h-7" : "w-5 h-5"} />
          )}
        </motion.div>

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
        <AnimatePresence>
          {person.tags.includes('verified') && size !== 'small' && (
            <motion.span 
              className="mt-1 px-1 py-0.5 text-[9px] rounded bg-success/20 text-success font-medium"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
            >
              ✓ Verified
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Glow effect for selected */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            className="absolute inset-0 rounded-lg bg-accent/20 -z-10"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1.1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          />
        )}
      </AnimatePresence>

      {/* Add button overlay */}
      <AnimatePresence>
        {showAddButton && onAdd && (
          <motion.button
            onClick={(e) => { e.stopPropagation(); onAdd(); }}
            className="absolute -right-2 -top-2 w-6 h-6 rounded-full bg-primary text-primary-foreground 
              flex items-center justify-center hover:bg-primary/80 shadow-md"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Plus className="w-3 h-3" />
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
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
    <motion.button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border-2 border-dashed",
        "border-muted-foreground/30 bg-muted/30 text-muted-foreground",
        sizeConfig[size]
      )}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ 
        scale: 1.05, 
        borderColor: "hsl(var(--primary))",
        backgroundColor: "hsl(var(--primary) / 0.05)"
      }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <Plus className="w-5 h-5 mb-1" />
      <span className="text-xs font-medium text-center">{label}</span>
    </motion.button>
  );
}
