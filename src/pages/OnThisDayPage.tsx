import { useMemo } from 'react';
import { useFamilyStore } from '@/store/familyStore';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Cake, Heart, Calendar, ArrowRight } from 'lucide-react';
import type { Person } from '@/types';

interface Event {
    person: Person;
    type: 'birthday' | 'death';
    date: Date;
    age: number; // Age turning or years since death
    isToday: boolean;
}

export default function OnThisDayPage() {
    const { persons } = useFamilyStore();
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentDay = today.getDate();

    // Helper to format date
    const formatDate = (date: Date) => {
        return date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    };

    // Helper to get day name
    const getDayName = (date: Date) => {
        // Construct a date object for this year's occurrence
        const thisYearDate = new Date(today.getFullYear(), date.getMonth(), date.getDate());
        return thisYearDate.toLocaleDateString('id-ID', { weekday: 'long' });
    };

    const events = useMemo(() => {
        const monthEvents: Event[] = [];

        persons.forEach(person => {
            // Check Birthday
            if (person.birthDate) {
                const birthDate = new Date(person.birthDate);
                if (birthDate.getMonth() === currentMonth) {
                    const age = today.getFullYear() - birthDate.getFullYear();
                    const isToday = birthDate.getDate() === currentDay;

                    monthEvents.push({
                        person,
                        type: 'birthday',
                        date: birthDate,
                        age,
                        isToday
                    });
                }
            }

            // Check Death Anniversary (Haul)
            if (person.deathDate) {
                const deathDate = new Date(person.deathDate);
                if (deathDate.getMonth() === currentMonth) {
                    const years = today.getFullYear() - deathDate.getFullYear();
                    const isToday = deathDate.getDate() === currentDay;

                    monthEvents.push({
                        person,
                        type: 'death',
                        date: deathDate,
                        age: years,
                        isToday
                    });
                }
            }
        });

        // Sort by day of month
        return monthEvents.sort((a, b) => a.date.getDate() - b.date.getDate());
    }, [persons, currentMonth, currentDay]);

    const todayEvents = events.filter(e => e.isToday);
    const upcomingEvents = events.filter(e => e.date.getDate() > currentDay);
    const pastEvents = events.filter(e => e.date.getDate() < currentDay);

    const EventCard = ({ event }: { event: Event }) => (
        <Card className={`
      flex items-center gap-4 p-4 transition-all hover:shadow-md
      ${event.isToday ? 'border-primary/50 bg-primary/5' : 'hover:bg-accent/50'}
    `}>
            {/* Date Box */}
            <div className={`
        flex flex-col items-center justify-center w-14 h-14 rounded-lg bg-background border shrink-0
        ${event.isToday ? 'border-primary text-primary' : 'text-muted-foreground'}
      `}>
                <span className="text-xs font-medium uppercase">{getDayName(event.date).slice(0, 3)}</span>
                <span className="text-xl font-bold leading-none">{event.date.getDate()}</span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <Badge variant={event.type === 'birthday' ? 'default' : 'secondary'} className="text-[10px] px-1.5 h-5">
                        {event.type === 'birthday' ? <Cake className="w-3 h-3 mr-1" /> : <Heart className="w-3 h-3 mr-1" />}
                        {event.type === 'birthday' ? 'Ulang Tahun' : 'Haul / Wafat'}
                    </Badge>
                    <span className="text-sm font-medium truncate">{event.person.fullName}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                    {event.type === 'birthday' ? `Ulang tahun ke-${event.age}` : `Memperingati ${event.age} tahun wafat`}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">
                    {event.date.getFullYear()}
                </p>
            </div>
        </Card>
    );

    return (
        <div className="p-6 lg:p-8 space-y-8 animate-fade-in max-w-5xl mx-auto">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-display font-bold text-foreground">
                    Hari Ini & Peristiwa Bulan Ini
                </h1>
                <p className="text-muted-foreground mt-1">
                    Momen spesial keluarga di bulan {today.toLocaleDateString('id-ID', { month: 'long' })}
                </p>
            </div>

            {/* Today's Section */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <div className="h-4 w-1 bg-primary rounded-full" />
                    <h2 className="text-lg font-semibold text-primary">Hari Ini ({today.toLocaleDateString('id-ID', { dateStyle: 'full' })})</h2>
                </div>

                {todayEvents.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {todayEvents.map((event, idx) => (
                            <EventCard key={`${event.person.id}-${event.type}-${idx}`} event={event} />
                        ))}
                    </div>
                ) : (
                    <div className="p-8 border border-dashed rounded-xl bg-muted/30 text-center text-muted-foreground">
                        <Calendar className="w-10 h-10 mx-auto mb-3 opacity-20" />
                        <p>Tidak ada peristiwa keluarga hari ini.</p>
                    </div>
                )}
            </section>

            {/* Upcoming Section */}
            {upcomingEvents.length > 0 && (
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <h2 className="text-lg font-semibold">Akan Datang</h2>
                        <Badge variant="outline" className="ml-auto">{upcomingEvents.length} Peristiwa</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {upcomingEvents.map((event, idx) => (
                            <EventCard key={`${event.person.id}-${event.type}-${idx}`} event={event} />
                        ))}
                    </div>
                </section>
            )}

            {/* Past Section */}
            {pastEvents.length > 0 && (
                <section className="opacity-70">
                    <div className="flex items-center gap-2 mb-4">
                        <h2 className="text-lg font-semibold text-muted-foreground">Sudah Berlalu</h2>
                        <Badge variant="secondary" className="ml-auto">{pastEvents.length} Peristiwa</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {pastEvents.map((event, idx) => (
                            <EventCard key={`${event.person.id}-${event.type}-${idx}`} event={event} />
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
