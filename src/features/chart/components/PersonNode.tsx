import { memo } from 'react';
import { User, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Person } from '@/types';
import { formatShortYearLabel } from '@/lib/flexibleDateUtils';

interface PersonNodeProps {
  person: Person;
  isSelected: boolean;
  onClick: () => void;
  size?: 'small' | 'normal' | 'large';
  showAddButton?: boolean;
  onAdd?: () => void;
  layoutId?: string;
  reduceMotion?: boolean;
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

export const PersonNode = memo(function PersonNode({
  person,
  isSelected,
  onClick,
  size = 'normal',
  showAddButton,
  onAdd,
  layoutId,
  reduceMotion = false,
}: PersonNodeProps) {
  const yearBirth = formatShortYearLabel(person.birthDate);
  const yearDeath = formatShortYearLabel(person.deathDate);

  const sizeConfig = {
    small: { card: 'p-2 w-[100px]', avatar: 'w-8 h-8', nameSize: 'text-[11px]', yearSize: 'text-[9px]', maxChars: 14 },
    normal: { card: 'p-3 w-[130px]', avatar: 'w-11 h-11', nameSize: 'text-sm', yearSize: 'text-xs', maxChars: 18 },
    large: { card: 'p-4 w-[160px]', avatar: 'w-14 h-14', nameSize: 'text-base', yearSize: 'text-sm', maxChars: 22 },
  };

  const config = sizeConfig[size];
  const displayName = truncateName(person.fullName, config.maxChars);
  const compactNode = reduceMotion;

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
  const cardLayoutId = reduceMotion ? undefined : (layoutId || `person-${person.id}`);
  const wrapperAnimation = reduceMotion
    ? undefined
    : {
        opacity: 1,
        scale: 1,
        transition: { type: 'spring' as const, stiffness: 300, damping: 25 },
      };
  const buttonAnimation = reduceMotion
    ? undefined
    : {
        scale: isSelected ? 1.05 : 1,
        boxShadow: isSelected
          ? '0 8px 25px -5px rgba(0, 0, 0, 0.2)'
          : '0 2px 10px -3px rgba(0, 0, 0, 0.1)',
      };

  return (
    <motion.div
      className="relative group"
      layoutId={cardLayoutId}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.8 }}
      animate={wrapperAnimation}
      exit={reduceMotion ? undefined : { opacity: 0, scale: 0.8 }}
      whileHover={reduceMotion ? undefined : { scale: 1.02 }}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
    >
      <motion.button
        onClick={onClick}
        data-person-id={person.id}
        className={cn(
          'relative flex flex-col items-center overflow-hidden rounded-2xl text-foreground',
          config.card,
          compactNode
            ? 'border border-border/70 bg-background/92 shadow-[0_12px_24px_-22px_rgba(15,23,42,0.7)]'
            : 'border-2 shadow-[0_14px_32px_-24px_rgba(15,23,42,0.7)]',
          !compactNode && colors.border,
          !compactNode && colors.bg,
          isSelected && 'ring-2 ring-offset-2 ring-accent shadow-warm'
        )}
        animate={buttonAnimation}
        transition={reduceMotion ? { duration: 0 } : { type: 'spring' as const, stiffness: 400, damping: 25 }}
      >
        {compactNode && (
          <span
            className={cn(
              'absolute inset-x-0 top-0 h-1.5',
              person.gender === 'male'
                ? 'bg-node-male/80'
                : person.gender === 'female'
                  ? 'bg-node-female/80'
                  : 'bg-node-unknown/80'
            )}
          />
        )}

        {/* Avatar */}
        <motion.div
          className={cn(
            'mb-1.5 flex items-center justify-center rounded-full',
            config.avatar,
            compactNode ? 'bg-muted text-foreground' : colors.avatar
          )}
          animate={reduceMotion ? undefined : { scale: isSelected ? 1.1 : 1 }}
          transition={reduceMotion ? { duration: 0 } : { type: 'spring' as const, stiffness: 400, damping: 25 }}
        >
          {person.photoUrl ? (
            <img
              src={person.photoUrl}
              alt={person.fullName}
              className="w-full h-full rounded-full object-cover"
              onError={(e) => {
                // Fallback if image fails to load
                e.currentTarget.style.display = 'none';
                const parent = e.currentTarget.parentElement;
                if (parent) {
                  parent.innerHTML = getInitials(person.fullName);
                  parent.className = cn(
                    parent.className,
                    "font-semibold",
                    size === 'small' ? 'text-xs' : size === 'large' ? 'text-xl' : 'text-base'
                  );
                }
              }}
            />
          ) : (
            <span className={cn(
              "font-semibold",
              size === 'small' ? 'text-xs' : size === 'large' ? 'text-xl' : 'text-base'
            )}>
              {getInitials(person.fullName)}
            </span>
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
        <span className={cn('text-muted-foreground', config.yearSize)}>
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
            initial={reduceMotion ? false : { opacity: 0, scale: 0.8 }}
            animate={reduceMotion ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1.1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
            transition={reduceMotion ? { duration: 0 } : { type: 'spring' as const, stiffness: 300, damping: 25 }}
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
            initial={reduceMotion ? false : { opacity: 0, scale: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0 }}
            whileHover={reduceMotion ? undefined : { scale: 1.1 }}
            whileTap={reduceMotion ? undefined : { scale: 0.9 }}
          >
            <Plus className="w-3 h-3" />
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

PersonNode.displayName = 'PersonNode';

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
