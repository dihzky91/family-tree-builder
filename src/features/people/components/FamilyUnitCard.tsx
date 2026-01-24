import { User, Heart, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Person, NuclearFamily } from '@/types';

interface FamilyUnitCardProps {
    person: Person;
    role: 'parent' | 'child';
    isCurrentUser?: boolean;
    otherFamilies?: { asParent?: NuclearFamily; asChild?: NuclearFamily };
    onClick: () => void;
}

/**
 * Compact card for displaying a person within a family unit
 * Shows photo/initials, name, birth year, role badge, and cross-references
 */
export function FamilyUnitCard({
    person,
    role,
    isCurrentUser,
    otherFamilies,
    onClick,
}: FamilyUnitCardProps) {
    const yearBirth = person.birthDate ? new Date(person.birthDate).getFullYear() : null;
    const isVerified = person.tags.includes('verified');

    // Get initials for fallback display
    const getInitials = (name: string): string => {
        const parts = name.trim().split(/\s+/);
        if (parts.length === 0) return '?';
        if (parts.length === 1) return parts[0][0].toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };

    // Determine if person appears in other families
    const hasOtherFamily = role === 'child'
        ? otherFamilies?.asParent
        : otherFamilies?.asChild;

    const genderColors = {
        male: 'bg-node-male/20 text-node-male border-node-male/30',
        female: 'bg-node-female/20 text-node-female border-node-female/30',
        unknown: 'bg-node-unknown/20 text-node-unknown border-node-unknown/30',
    };

    return (
        <motion.button
            onClick={onClick}
            className={cn(
                'flex items-center gap-3 p-3 rounded-lg border transition-all',
                'hover:shadow-md hover:scale-[1.02] active:scale-[0.98]',
                'bg-card text-left w-full',
                isCurrentUser && 'ring-2 ring-accent ring-offset-2'
            )}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
        >
            {/* Avatar */}
            <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center shrink-0 border',
                genderColors[person.gender]
            )}>
                {person.photoUrl ? (
                    <img
                        src={person.photoUrl}
                        alt={person.fullName}
                        className="w-full h-full rounded-full object-cover"
                    />
                ) : (
                    <span className="text-sm font-semibold">
                        {getInitials(person.fullName)}
                    </span>
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-medium truncate">
                        {person.fullName}
                    </span>
                    {isCurrentUser && (
                        <span className="text-accent shrink-0">⭐</span>
                    )}
                    {isVerified && (
                        <span className="text-success text-xs shrink-0">✓</span>
                    )}
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {/* Role badge */}
                    <span className="flex items-center gap-1">
                        {role === 'parent' ? (
                            <>
                                <Heart className="w-3 h-3" />
                                Orang Tua
                            </>
                        ) : (
                            <>
                                <Users className="w-3 h-3" />
                                Anak
                            </>
                        )}
                    </span>

                    {yearBirth && (
                        <>
                            <span>•</span>
                            <span>{yearBirth}</span>
                        </>
                    )}

                    {/* Cross-reference indicator */}
                    {hasOtherFamily && (
                        <>
                            <span>•</span>
                            <span className="text-primary">
                                → Also in: {role === 'child' ? 'sebagai Orang Tua' : 'sebagai Anak'}
                            </span>
                        </>
                    )}
                </div>
            </div>
        </motion.button>
    );
}
