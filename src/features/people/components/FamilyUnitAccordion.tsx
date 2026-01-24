import { ChevronDown, Users as UsersIcon, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { NuclearFamily, Person } from '@/types';
import { FamilyUnitCard } from './FamilyUnitCard';
import { getPersonFamilies } from '@/lib/familyUnits';

interface FamilyUnitAccordionProps {
    family: NuclearFamily;
    allFamilies: NuclearFamily[]; // for cross-reference
    isExpanded: boolean;
    onToggle: () => void;
    currentUserId?: string;
    onSelectPerson: (id: string) => void;
}

/**
 * Collapsible accordion component for one nuclear family unit
 * Contains parents section and children section
 */
export function FamilyUnitAccordion({
    family,
    allFamilies,
    isExpanded,
    onToggle,
    currentUserId,
    onSelectPerson,
}: FamilyUnitAccordionProps) {
    const totalMembers = family.parents.length + family.children.length;
    const isUserInFamily = [...family.parents, ...family.children].some(
        p => p.id === currentUserId
    );

    return (
        <motion.div
            className={cn(
                'border rounded-lg overflow-hidden',
                isUserInFamily && 'border-accent'
            )}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            {/* Header */}
            <button
                onClick={onToggle}
                className={cn(
                    'w-full flex items-center justify-between p-4 transition-colors',
                    'hover:bg-muted/50',
                    isExpanded && 'bg-muted/30'
                )}
            >
                <div className="flex items-center gap-3">
                    <ChevronDown
                        className={cn(
                            'w-5 h-5 transition-transform text-muted-foreground',
                            isExpanded && 'rotate-180'
                        )}
                    />

                    <div className="text-left">
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-base">
                                {family.familyName}
                            </h3>
                            {isUserInFamily && (
                                <span className="text-accent">⭐</span>
                            )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span className="flex items-center gap-1">
                                📅 Gen {family.generation}
                            </span>
                            <span>•</span>
                            <span>{totalMembers} anggota</span>
                        </div>
                    </div>
                </div>

                {/* Member count badges */}
                <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-1 rounded bg-primary/10 text-primary">
                        {family.parents.length} Orang Tua
                    </span>
                    <span className="px-2 py-1 rounded bg-secondary/10 text-secondary-foreground">
                        {family.children.length} Anak
                    </span>
                </div>
            </button>

            {/* Content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 pt-0 space-y-4">
                            {/* Parents Section */}
                            {family.parents.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                        <Heart className="w-4 h-4" />
                                        <span>Orang Tua ({family.parents.length})</span>
                                    </div>

                                    <div className="space-y-2">
                                        {family.parents.map(parent => (
                                            <FamilyUnitCard
                                                key={parent.id}
                                                person={parent}
                                                role="parent"
                                                isCurrentUser={parent.id === currentUserId}
                                                otherFamilies={getPersonFamilies(parent.id, allFamilies)}
                                                onClick={() => onSelectPerson(parent.id)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Children Section */}
                            {family.children.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                        <UsersIcon className="w-4 h-4" />
                                        <span>Anak-anak ({family.children.length})</span>
                                    </div>

                                    <div className="space-y-2">
                                        {family.children.map((child, index) => (
                                            <FamilyUnitCard
                                                key={child.id}
                                                person={child}
                                                role="child"
                                                isCurrentUser={child.id === currentUserId}
                                                otherFamilies={getPersonFamilies(child.id, allFamilies)}
                                                onClick={() => onSelectPerson(child.id)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Empty state */}
                            {family.children.length === 0 && family.parents.length === 1 && (
                                <p className="text-sm text-muted-foreground text-center py-2">
                                    Belum ada anak dalam keluarga ini
                                </p>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
