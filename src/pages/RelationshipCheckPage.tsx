import { useState } from 'react';
import { useFamilyStore } from '@/store/familyStore';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowRight, Search, Users, GitMerge } from 'lucide-react';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { calculateRelationship } from '@/lib/relationshipCalculator';
import type { Person } from '@/types';
import { Badge } from '@/components/ui/badge';

export default function RelationshipCheckPage() {
    const { persons, relationships } = useFamilyStore();
    const [person1, setPerson1] = useState<Person | null>(null);
    const [person2, setPerson2] = useState<Person | null>(null);
    const [open1, setOpen1] = useState(false);
    const [open2, setOpen2] = useState(false);

    const result = (person1 && person2)
        ? calculateRelationship(person1.id, person2.id, persons, relationships)
        : null;

    const PersonSelect = ({
        person,
        setPerson,
        open,
        setOpen,
        label
    }: {
        person: Person | null,
        setPerson: (p: Person | null) => void,
        open: boolean,
        setOpen: (o: boolean) => void,
        label: string
    }) => (
        <div className="flex flex-col gap-2 flex-1">
            <label className="text-sm font-medium text-muted-foreground">{label}</label>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="justify-between w-full h-12"
                    >
                        {person ? (
                            <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px]
                    ${person.gender === 'male' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}
                 `}>
                                    {person.fullName.charAt(0)}
                                </div>
                                <span className="truncate">{person.fullName}</span>
                            </div>
                        ) : (
                            <span className="text-muted-foreground">Pilih Anggota...</span>
                        )}
                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                    <Command>
                        <CommandInput placeholder="Cari nama..." />
                        <CommandList>
                            <CommandEmpty>Tidak ditemukan.</CommandEmpty>
                            <CommandGroup>
                                {persons.map((p) => (
                                    <CommandItem
                                        key={p.id}
                                        value={p.fullName} // Search by fullname
                                        onSelect={() => {
                                            setPerson(p);
                                            setOpen(false);
                                        }}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={`w-4 h-4 rounded-full ${p.gender === 'male' ? 'bg-blue-500' : 'bg-pink-500'}`} />
                                            {p.fullName}
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );

    return (
        <div className="p-6 lg:p-8 space-y-8 animate-fade-in max-w-4xl mx-auto">
            <div>
                <h1 className="text-3xl font-display font-bold text-foreground">
                    Cek Hubungan
                </h1>
                <p className="text-muted-foreground mt-1">
                    Cari tahu hubungan kekerabatan antara dua orang
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

                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-background border shadow-sm shrink-0 md:mt-6">
                        <GitMerge className="w-5 h-5 text-muted-foreground" />
                    </div>

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
                <div className="space-y-6 animate-slide-up">
                    {result ? (
                        <>
                            <div className="text-center space-y-2">
                                <h2 className="text-2xl font-bold text-primary">
                                    {result.term}
                                </h2>
                                <p className="text-muted-foreground">
                                    Hubungan <strong>{person2.fullName}</strong> terhadap <strong>{person1.fullName}</strong>
                                </p>
                            </div>

                            <Card className="p-0 overflow-hidden">
                                <div className="bg-muted px-4 py-2 border-b text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Jalur Hubungan
                                </div>
                                <div className="p-6">
                                    <div className="space-y-0 relative">
                                        {/* Vertical line connecting nodes */}
                                        <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-border -z-10" />

                                        {result.path.map((step, idx) => (
                                            <div key={idx} className="flex items-center gap-4 relative py-2">
                                                {/* Node Icon */}
                                                <div className={`
                            w-12 h-12 rounded-full flex items-center justify-center border-4 border-background shadow-sm z-10
                            ${step.relType === 'self' ? 'bg-primary text-primary-foreground' : 'bg-card'}
                          `}>
                                                    {idx === 0 ? 'A' : idx === result.path.length - 1 ? 'B' : idx}
                                                </div>

                                                {/* Info */}
                                                <div className="flex-1 bg-card p-3 rounded-lg border shadow-sm">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="font-semibold">{step.person.fullName}</span>
                                                        {idx > 0 && (
                                                            <Badge variant="secondary" className="text-[10px] uppercase">
                                                                {step.relType === 'parent' ? 'Ayah/Ibu' : step.relType === 'child' ? 'Anak' : 'Pasangan'}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    {step.relType === 'self' && <p className="text-xs text-muted-foreground">Titik Awal</p>}
                                                    {idx === result.path.length - 1 && <p className="text-xs text-muted-foreground">Target (Titik Tujuan)</p>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </Card>
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
