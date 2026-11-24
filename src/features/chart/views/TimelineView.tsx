import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Calendar, User, Baby, Cross } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Person } from '@/types';
import {
    getEstimatedYear,
    getSortableTimestamp,
    formatFlexibleDate,
} from '@/lib/flexibleDateUtils';

interface TimelineViewProps {
    persons: Person[];
    onSelectPerson?: (personId: string) => void;
}

interface TimelineEvent {
    year: number;
    timestamp: number;
    dateLabel: string;
    type: 'birth' | 'death';
    person: Person;
}

interface YearGroup {
    year: number;
    events: TimelineEvent[];
}

export function TimelineView({ persons, onSelectPerson }: TimelineViewProps) {
    const { groups, unknownDatePersons } = useMemo(() => {
        const events: TimelineEvent[] = [];
        const noDates: Person[] = [];

        persons.forEach(person => {
            let hasDate = false;

            // Add Birth Event
            if (person.birthDate) {
                const year = getEstimatedYear(person.birthDate);
                const ts = getSortableTimestamp(person.birthDate);
                if (year !== null && ts !== null) {
                    events.push({
                        year,
                        timestamp: ts,
                        dateLabel: formatFlexibleDate(person.birthDate) || String(year),
                        type: 'birth',
                        person
                    });
                    hasDate = true;
                }
            }

            // Add Death Event
            if (person.deathDate) {
                const year = getEstimatedYear(person.deathDate);
                const ts = getSortableTimestamp(person.deathDate);
                if (year !== null && ts !== null) {
                    events.push({
                        year,
                        timestamp: ts,
                        dateLabel: formatFlexibleDate(person.deathDate) || String(year),
                        type: 'death',
                        person
                    });
                    hasDate = true;
                }
            }

            if (!hasDate) {
                noDates.push(person);
            }
        });

        // Sort events by date (ascending)
        events.sort((a, b) => a.timestamp - b.timestamp);

        // Group by Year
        const grouped = events.reduce((acc, event) => {
            const existing = acc.find(g => g.year === event.year);
            if (existing) {
                existing.events.push(event);
            } else {
                acc.push({ year: event.year, events: [event] });
            }
            return acc;
        }, [] as YearGroup[]);

        return { groups: grouped, unknownDatePersons: noDates };
    }, [persons]);

    if (persons.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Calendar className="w-16 h-16 mb-4 opacity-50" />
                <h3 className="text-lg font-medium">Belum ada data timeline</h3>
                <p>Tambahkan anggota keluarga dengan tanggal lahir untuk melihat timeline.</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8">
            <div className="relative border-l-2 border-primary/20 ml-4 md:ml-8 space-y-12 pb-12">
                {groups.map((group, groupIndex) => (
                    <motion.div
                        key={group.year}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: groupIndex * 0.05 }}
                        className="relative pl-8 md:pl-12"
                    >
                        {/* Year Marker */}
                        <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-primary border-4 border-background" />

                        <div className="mb-4">
                            <span className="text-2xl font-display font-bold text-primary">{group.year}</span>
                        </div>

                        <div className="grid gap-3">
                            {group.events.map((event, idx) => (
                                <Card
                                    key={`${event.person.id}-${event.type}-${idx}`}
                                    className={`
                    p-3 flex items-center gap-4 cursor-pointer hover:shadow-md transition-all
                    ${event.type === 'birth' ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-gray-500'}
                  `}
                                    onClick={() => onSelectPerson?.(event.person.id)}
                                >
                                    <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center shrink-0
                    ${event.type === 'birth' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}
                  `}>
                                        {event.type === 'birth' ? <Baby className="w-5 h-5" /> : <Cross className="w-5 h-5" />}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-semibold truncate">{event.person.fullName}</h4>
                                            <Badge variant="outline" className="text-xs font-normal capitalize">
                                                {event.type === 'birth' ? 'Lahir' : 'Wafat'}
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            {event.dateLabel}
                                        </p>
                                    </div>

                                    {/* Optional: Show age at death or age related info? Keeping it simple for now */}
                                </Card>
                            ))}
                        </div>
                    </motion.div>
                ))}

                {unknownDatePersons.length > 0 && (
                    <div className="relative pl-8 md:pl-12 pt-8">
                        <div className="absolute -left-[9px] top-8 w-4 h-4 rounded-full bg-muted border-4 border-background" />
                        <h4 className="text-lg font-medium text-muted-foreground mb-4">Tanggal Tidak Diketahui</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {unknownDatePersons.map(p => (
                                <div
                                    key={p.id}
                                    className="text-sm p-2 bg-muted/30 rounded border flex items-center gap-2 cursor-pointer hover:bg-muted/50"
                                    onClick={() => onSelectPerson?.(p.id)}
                                >
                                    <User className="w-3 h-3 opacity-50" />
                                    <span className="truncate">{p.fullName}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
