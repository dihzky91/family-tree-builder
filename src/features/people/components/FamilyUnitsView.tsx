import { useState } from 'react';
import { Users } from 'lucide-react';
import type { NuclearFamily } from '@/types';
import { FamilyUnitAccordion } from './FamilyUnitAccordion';

interface FamilyUnitsViewProps {
    families: NuclearFamily[];
    currentUserId?: string;
    onSelectPerson: (id: string) => void;
}

/**
 * Container view for rendering all nuclear family units
 * Manages expand/collapse state for accordions
 */
export function FamilyUnitsView({
    families,
    currentUserId,
    onSelectPerson,
}: FamilyUnitsViewProps) {
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const toggleFamily = (familyId: string) => {
        setExpandedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(familyId)) {
                newSet.delete(familyId);
            } else {
                newSet.add(familyId);
            }
            return newSet;
        });
    };

    if (families.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <Users className="w-16 h-16 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">
                    Belum Ada Keluarga Inti
                </h3>
                <p className="text-sm text-muted-foreground max-w-md">
                    Tambahkan pasangan (SPOUSE) dan anak-anak (PARENT_CHILD) untuk membuat keluarga inti.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {families.map(family => (
                <FamilyUnitAccordion
                    key={family.id}
                    family={family}
                    allFamilies={families}
                    isExpanded={expandedIds.has(family.id)}
                    onToggle={() => toggleFamily(family.id)}
                    currentUserId={currentUserId}
                    onSelectPerson={onSelectPerson}
                />
            ))}
        </div>
    );
}
