import { Users, Heart, User, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { NuclearFamily, Person } from '@/types';

interface FamilyUnitGridCardProps {
    family: NuclearFamily;
    onEditPerson?: (person: Person) => void;
}

/**
 * Compact grid card for displaying a family unit
 * Shows parents (top) and children (bottom)
 */
export function FamilyUnitGridCard({ family, onEditPerson }: FamilyUnitGridCardProps) {
    const childCount = family.children.length;

    const formatDate = (date: string | null | undefined) => {
        if (!date) return null;
        return new Date(date).getFullYear(); // Just year for compactness
    };

    const MiniPerson = ({ person, role }: { person: Person; role: 'parent' | 'child' }) => (
        <div
            className={`
        flex items-center gap-2 p-1.5 rounded-md hover:bg-accent/50 cursor-pointer transition-colors
        ${role === 'parent' ? 'bg-primary/5' : ''}
      `}
            role="button"
            tabIndex={0}
            aria-label={`Edit ${person.fullName}`}
            onClick={(e) => {
                e.stopPropagation();
                onEditPerson?.(person);
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    onEditPerson?.(person);
                }
            }}
            title={person.fullName}
        >
            <div className={`
        w-6 h-6 rounded-full flex items-center justify-center overflow-hidden shrink-0
        ${person.photoUrl ? 'border shadow-sm' : ''}
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
                    <User className="w-3 h-3" />
                )}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate leading-none">{person.fullName}</p>
                {(person.birthDate || person.deathDate) && (
                    <p className="text-[10px] text-muted-foreground leading-none mt-0.5">
                        {formatDate(person.birthDate)}{person.deathDate ? ` - ${formatDate(person.deathDate)}` : ''}
                    </p>
                )}
            </div>
        </div>
    );

    return (
        <Card className="flex h-full flex-col overflow-hidden rounded-2xl border hover:shadow-md transition-shadow">
            {/* Header - Simpler and more compact */}
            <div className="flex items-center justify-between gap-2 border-b bg-muted/40 p-3">
                <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="secondary" className="h-5 shrink-0 bg-muted-foreground/10 px-1.5 text-[10px] font-normal text-muted-foreground">
                        Gen {family.generation}
                    </Badge>
                    <h4 className="text-xs font-semibold text-foreground/80 truncate" title={family.familyName}>
                        {family.familyName.replace('Keluarga ', '')}
                    </h4>
                </div>
                    <div className="flex shrink-0 items-center gap-1 rounded-full border bg-background/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                    <Users className="w-2.5 h-2.5" />
                    <span>{family.parents.length + childCount}</span>
                </div>
            </div>

            {/* Content */}
            <div className="flex flex-1 flex-col justify-between gap-3 p-3">
                <div className="space-y-2">
                    {/* Parents Grid */}
                    <div>
                        <div className="flex items-center gap-1 text-[9px] font-semibold text-muted-foreground/70 uppercase tracking-wider mb-1">
                            <Heart className="w-2.5 h-2.5 text-rose-400" />
                            Orang Tua
                        </div>
                            <div className={`grid gap-2 ${family.parents.length > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                            {family.parents.map(parent => (
                                <MiniPerson key={parent.id} person={parent} role="parent" />
                            ))}
                        </div>
                    </div>

                    {/* Children Grid */}
                    {childCount > 0 && (
                        <div>
                            <div className="flex items-center gap-1 text-[9px] font-semibold text-muted-foreground/70 uppercase tracking-wider mb-1 mt-1">
                                <Users className="w-2.5 h-2.5" />
                                Anak ({childCount})
                            </div>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {family.children.slice(0, 6).map(child => (
                                    <MiniPerson key={child.id} person={child} role="child" />
                                ))}
                                {childCount > 6 && (
                                    <div className="col-span-2 px-2 py-0.5 text-[10px] text-muted-foreground text-center bg-muted/20 rounded border border-dashed">
                                        + {childCount - 6} lainnya
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
}
