import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFamilyStore } from '@/store/familyStore';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Search,
    Users,
    ArrowLeftRight,
    Crown,
    Route,
    Layers,
    List,
    GitFork,
} from 'lucide-react';
import { PersonPicker } from '@/components/PersonPicker';
import { calculateRelationship } from '@/lib/relationshipCalculator';
import { RelationshipPathGraph } from '@/features/relationships/RelationshipPathGraph';
import type { Person } from '@/types';
import { cn } from '@/lib/utils';

export default function RelationshipCheckPage() {
    const navigate = useNavigate();
    const { persons, relationships } = useFamilyStore();
    const [person1, setPerson1] = useState<Person | null>(null);
    const [person2, setPerson2] = useState<Person | null>(null);
    const [open1, setOpen1] = useState(false);
    const [open2, setOpen2] = useState(false);
    const [displayMode, setDisplayMode] = useState<'graph' | 'list'>('graph');

    const result =
        person1 && person2 && person1.id !== person2.id
            ? calculateRelationship(person1.id, person2.id, persons, relationships)
            : null;

    const commonAncestor =
        result && result.commonAncestorIndex !== null
            ? result.path[result.commonAncestorIndex]?.person
            : null;

    const handleSwap = () => {
        setPerson1(person2);
        setPerson2(person1);
    };

    const PersonSelect = ({
        person,
        setPerson,
        open,
        setOpen,
        label,
    }: {
        person: Person | null;
        setPerson: (p: Person | null) => void;
        open: boolean;
        setOpen: (o: boolean) => void;
        label: string;
    }) => (
        <div className="flex flex-col gap-2 flex-1 w-full">
            <label className="text-sm font-medium text-muted-foreground">{label}</label>
            <PersonPicker
                persons={persons}
                relationships={relationships}
                selectedPerson={person}
                onSelect={(p) => setPerson(p)}
                open={open}
                onOpenChange={setOpen}
                popoverClassName="w-[320px] p-0"
                trigger={
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="justify-between w-full h-12"
                    >
                        {person ? (
                            <div className="flex items-center gap-2 min-w-0">
                                <div
                                    className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold
                    ${person.gender === 'male' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}
                 `}
                                >
                                    {person.fullName.charAt(0)}
                                </div>
                                <span className="truncate">{person.fullName}</span>
                            </div>
                        ) : (
                            <span className="text-muted-foreground">Pilih Anggota...</span>
                        )}
                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                }
            />
        </div>
    );

    return (
        <div className="p-6 lg:p-8 space-y-6 animate-fade-in max-w-5xl mx-auto">
            <div>
                <h1 className="text-3xl font-display font-bold text-foreground">
                    Cek Hubungan
                </h1>
                <p className="text-muted-foreground mt-1">
                    Cari tahu hubungan kekerabatan dan visualisasi jalur terpendek antara dua anggota keluarga
                </p>
            </div>

            <Card className="p-6 bg-muted/30 border-dashed">
                <div className="flex flex-col md:flex-row gap-4 items-center">
                    <PersonSelect
                        person={person1}
                        setPerson={setPerson1}
                        open={open1}
                        setOpen={setOpen1}
                        label="Orang Pertama (A)"
                    />

                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleSwap}
                        className="w-10 h-10 rounded-full bg-background shadow-sm shrink-0 md:mt-6"
                        title="Tukar posisi A dan B"
                        aria-label="Tukar posisi A dan B"
                    >
                        <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
                    </Button>

                    <PersonSelect
                        person={person2}
                        setPerson={setPerson2}
                        open={open2}
                        setOpen={setOpen2}
                        label="Orang Kedua (B)"
                    />
                </div>
            </Card>

            {person1 && person2 && (
                <div className="space-y-5 animate-slide-up">
                    {person1.id === person2.id ? (
                        <div className="text-center py-10 text-muted-foreground">
                            <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                            <p className="font-medium text-foreground">Orang yang sama dipilih</p>
                            <p className="text-sm">Pilih dua anggota keluarga yang berbeda.</p>
                        </div>
                    ) : result ? (
                        <>
                            {/* Bidirectional Summary Cards */}
                            <div className="grid gap-3 sm:grid-cols-2">
                                <Card className="p-4 border-primary/30 bg-primary/5">
                                    <p className="text-xs text-muted-foreground">
                                        Hubungan <strong className="text-foreground">{person2.fullName}</strong> terhadap{' '}
                                        <strong className="text-foreground">{person1.fullName}</strong>
                                    </p>
                                    <h2 className="mt-1 text-2xl font-display font-bold text-primary">
                                        {result.term}
                                    </h2>
                                </Card>
                                <Card className="p-4 border-emerald-500/30 bg-emerald-500/5">
                                    <p className="text-xs text-muted-foreground">
                                        Hubungan <strong className="text-foreground">{person1.fullName}</strong> terhadap{' '}
                                        <strong className="text-foreground">{person2.fullName}</strong>
                                    </p>
                                    <h2 className="mt-1 text-2xl font-display font-bold text-emerald-700 dark:text-emerald-400">
                                        {result.reverseTerm}
                                    </h2>
                                </Card>
                            </div>

                            {/* Meta Badges & View Mode Toggle */}
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="secondary" className="gap-1.5">
                                        <Route className="w-3.5 h-3.5" />
                                        {result.stepsCount} langkah
                                    </Badge>
                                    <Badge variant="outline" className="gap-1.5">
                                        <Layers className="w-3.5 h-3.5" />
                                        {result.generationDiff === 0
                                            ? 'Satu generasi'
                                            : `${Math.abs(result.generationDiff)} generasi ${
                                                  result.generationDiff < 0 ? 'lebih tua' : 'lebih muda'
                                              }`}
                                    </Badge>
                                    {commonAncestor && (
                                        <Badge className="gap-1.5 bg-amber-500/15 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300">
                                            <Crown className="w-3.5 h-3.5" />
                                            Leluhur Bersama: {commonAncestor.fullName}
                                        </Badge>
                                    )}
                                </div>

                                <div className="inline-flex items-center rounded-lg border bg-muted/40 p-0.5">
                                    <button
                                        type="button"
                                        onClick={() => setDisplayMode('graph')}
                                        className={cn(
                                            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                                            displayMode === 'graph'
                                                ? 'bg-background text-foreground shadow-sm'
                                                : 'text-muted-foreground hover:text-foreground'
                                        )}
                                    >
                                        <GitFork className="w-3.5 h-3.5" />
                                        Grafik Jalur
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDisplayMode('list')}
                                        className={cn(
                                            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                                            displayMode === 'list'
                                                ? 'bg-background text-foreground shadow-sm'
                                                : 'text-muted-foreground hover:text-foreground'
                                        )}
                                    >
                                        <List className="w-3.5 h-3.5" />
                                        Daftar Langkah
                                    </button>
                                </div>
                            </div>

                            {displayMode === 'graph' ? (
                                <div className="space-y-2">
                                    <RelationshipPathGraph
                                        result={result}
                                        onSelectPerson={(id) => navigate(`/chart?focus=${id}`)}
                                    />
                                    <p className="text-center text-xs text-muted-foreground">
                                        Klik kartu anggota untuk langsung memfokuskan profilnya di halaman Silsilah.
                                    </p>
                                </div>
                            ) : (
                                <Card className="p-0 overflow-hidden">
                                    <div className="bg-muted px-4 py-2 border-b text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        Jalur Hubungan
                                    </div>
                                    <div className="p-6">
                                        <div className="space-y-0 relative">
                                            <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-border -z-10" />

                                            {result.path.map((step, idx) => {
                                                const isCommon = result.commonAncestorIndex === idx;
                                                return (
                                                    <div key={idx} className="flex items-center gap-4 relative py-2">
                                                        <div
                                                            className={cn(
                                                                'w-12 h-12 rounded-full flex items-center justify-center border-4 border-background shadow-sm z-10 font-semibold text-sm',
                                                                idx === 0
                                                                    ? 'bg-primary text-primary-foreground'
                                                                    : idx === result.path.length - 1
                                                                      ? 'bg-emerald-600 text-white'
                                                                      : isCommon
                                                                        ? 'bg-amber-500 text-white'
                                                                        : 'bg-card'
                                                            )}
                                                        >
                                                            {idx === 0
                                                                ? 'A'
                                                                : idx === result.path.length - 1
                                                                  ? 'B'
                                                                  : idx}
                                                        </div>

                                                        <button
                                                            type="button"
                                                            onClick={() => navigate(`/chart?focus=${step.person.id}`)}
                                                            className="flex-1 bg-card p-3 rounded-lg border shadow-sm text-left hover:border-primary/50 transition-colors"
                                                        >
                                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                                <span className="font-semibold">
                                                                    {step.person.fullName}
                                                                </span>
                                                                <div className="flex items-center gap-1.5">
                                                                    {isCommon && (
                                                                        <Badge className="bg-amber-500 text-white text-[10px]">
                                                                            Leluhur Bersama
                                                                        </Badge>
                                                                    )}
                                                                    {idx > 0 && (
                                                                        <Badge
                                                                            variant="secondary"
                                                                            className="text-[10px] uppercase"
                                                                        >
                                                                            {step.relType === 'parent'
                                                                                ? 'Ayah/Ibu'
                                                                                : step.relType === 'child'
                                                                                  ? 'Anak'
                                                                                  : 'Pasangan'}
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {step.relType === 'self' && (
                                                                <p className="text-xs text-muted-foreground">
                                                                    Titik Awal
                                                                </p>
                                                            )}
                                                            {idx === result.path.length - 1 && (
                                                                <p className="text-xs text-muted-foreground">
                                                                    Target (Titik Tujuan)
                                                                </p>
                                                            )}
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </Card>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-10 opacity-50">
                            <Users className="w-12 h-12 mx-auto mb-3" />
                            <h3 className="text-lg font-medium">Tidak ada hubungan yang ditemukan</h3>
                            <p>Kedua orang ini tampaknya belum terhubung dalam silsilah.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
