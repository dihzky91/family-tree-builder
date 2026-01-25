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
  showTopHandle?: boolean;
  onTopHandleClick?: () => void;
  onBottomHandleClick?: () => void; // New handle for children
  layoutId?: string;
}

function truncateName(name: string, maxLength: number): string {
  if (name.length <= maxLength) return name;
  return name.substring(0, maxLength).trim() + '...';
}

/**
 * Extract initials from full name (max 2 characters)
 * Examples: "John Doe" -> "JD", "Mary Jane Watson" -> "MW", "Prince" -> "P"
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  // Take first and last name initials
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function PersonNode({
  person,
  isSelected,
  onClick,
  size = 'normal',
  showAddButton,
  onAdd,
  showTopHandle,
  onTopHandleClick,
  onBottomHandleClick,
  layoutId
}: PersonNodeProps) {
  const yearBirth = person.birthDate ? new Date(person.birthDate).getFullYear() : null;
  const yearDeath = person.deathDate ? new Date(person.deathDate).getFullYear() : null;

  // New Horizontal (Landscape) sizes
  const sizeConfig = {
    small: {
      card: 'w-[160px] h-[60px] p-2',
      avatar: 'w-10 h-10',
      content: 'space-y-0.5',
      nameSize: 'text-xs',
      yearSize: 'text-[10px]',
      maxChars: 18
    },
    normal: {
      card: 'w-[200px] h-[72px] p-3',
      avatar: 'w-12 h-12',
      content: 'space-y-1',
      nameSize: 'text-sm',
      yearSize: 'text-xs',
      maxChars: 22
    },
    large: {
      card: 'w-[240px] h-[88px] p-3.5',
      avatar: 'w-14 h-14',
      content: 'space-y-1',
      nameSize: 'text-base',
      yearSize: 'text-sm',
      maxChars: 26
    },
  };

  const config = sizeConfig[size];
  const displayName = truncateName(person.fullName, config.maxChars);

  const genderColors = {
    male: {
      border: 'border-node-male',
      bg: 'bg-white', // MyHeritage style is cleaner/white
      avatar: 'bg-node-male/10 text-node-male',
      indicator: 'bg-node-male'
    },
    female: {
      border: 'border-node-female',
      bg: 'bg-white',
      avatar: 'bg-node-female/10 text-node-female',
      indicator: 'bg-node-female'
    },
    unknown: {
      border: 'border-node-unknown',
      bg: 'bg-white',
      avatar: 'bg-node-unknown/10 text-node-unknown',
      indicator: 'bg-node-unknown'
    }
  };

  const colors = genderColors[person.gender];

  return (
    <motion.div
      className="relative group z-10"
      layoutId={layoutId || `person-${person.id}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{
        opacity: 1,
        scale: 1,
        transition: { type: "spring", stiffness: 300, damping: 25 }
      }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <motion.button
        onClick={onClick}
        className={cn(
          "flex items-center text-left rounded-lg border shadow-sm transition-shadow",
          "hover:shadow-md",
          config.card,
          colors.bg,
          colors.border, // keep border color subtle or colored based on gender
          isSelected && "ring-2 ring-offset-2 ring-accent shadow-md !border-accent"
        )}
      >
        {/* Color Strip Indicator (Left) */}
        <div className={cn("absolute left-0 top-0 bottom-0 w-1.5 rounded-l-lg", colors.indicator)} />

        <div className="flex items-center gap-3 pl-2 w-full">
          {/* Avatar */}
          <motion.div
            className={cn(
              "rounded-full flex items-center justify-center shrink-0 border border-muted",
              config.avatar,
              colors.avatar
            )}
          >
            {person.photoUrl ? (
              <img
                src={person.photoUrl}
                alt={person.fullName}
                className="w-full h-full rounded-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent) {
                    parent.innerHTML = getInitials(person.fullName);
                    parent.className = cn(parent.className, "font-bold font-mono");
                  }
                }}
              />
            ) : (
              <span className="font-bold font-mono">
                {getInitials(person.fullName)}
              </span>
            )}
          </motion.div>

          {/* Text Content */}
          <div className={cn("min-w-0 flex-1", config.content)}>
            <div
              className={cn("font-semibold text-foreground truncate", config.nameSize)}
              title={person.fullName}
            >
              {displayName}
            </div>

            <div className={cn("text-muted-foreground", config.yearSize)}>
              {yearBirth || '?'}{yearDeath ? ` - ${yearDeath}` : ''}
            </div>

            {/* Verified badge */}
            {person.tags.includes('verified') && size !== 'small' && (
              <div className="flex">
                <span className="px-1.5 py-0.5 text-[9px] rounded-full bg-success/10 text-success font-medium flex items-center gap-0.5">
                  ✓ Verified
                </span>
              </div>
            )}
          </div>
        </div>
      </motion.button>

      {/* Top Handle (Add Parent) */}
      <AnimatePresence>
        {showTopHandle && onTopHandleClick && (
          <motion.button
            onClick={(e) => { e.stopPropagation(); onTopHandleClick(); }}
            className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-background border shadow-sm 
              flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors z-20 
              opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 0, y: 5 }} // Hidden by default, driven by group-hover logic mostly or CSS
            whileHover={{ scale: 1.1 }}
            title="Tambah Orang Tua"
          >
            <Plus className="w-3 h-3" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Bottom Handle (Add Child) */}
      <AnimatePresence>
        {onBottomHandleClick && (
          <motion.button
            onClick={(e) => { e.stopPropagation(); onBottomHandleClick(); }}
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-background border shadow-sm 
              flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors z-20
              opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100"
            initial={{ opacity: 0, y: -5 }}
            whileHover={{ scale: 1.1 }}
            title="Tambah Anak"
          >
            <Plus className="w-3 h-3" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Side Handle (generic add or partner) - Optional? for now keeping top/bottom */}

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
    small: 'w-[160px] h-[60px]',
    normal: 'w-[200px] h-[72px]',
    large: 'w-[240px] h-[88px]',
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
