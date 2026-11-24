import { useState } from 'react';
import { useFamilyStore } from '@/store/familyStore';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Image as ImageIcon, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PersonForm } from '@/features/people/PersonForm';
import type { Person } from '@/types';
import { formatShortYearLabel } from '@/lib/flexibleDateUtils';

export default function GalleryPage() {
    const { persons } = useFamilyStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [editingPerson, setEditingPerson] = useState<Person | null>(null);

    // Filter persons with photos
    const photoPersons = persons.filter(p =>
        p.photoUrl &&
        (searchTerm === '' || p.fullName.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-5 md:space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
                        Galeri Foto
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Koleksi foto anggota keluarga ({photoPersons.length} foto)
                    </p>
                </div>

                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari nama..."
                        className="pl-9 pr-9 rounded-xl h-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            onClick={() => setSearchTerm('')}
                            aria-label="Hapus pencarian"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {photoPersons.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                    {photoPersons.map((person) => (
                        <div
                            key={person.id}
                            className="group relative aspect-square rounded-2xl overflow-hidden bg-muted cursor-pointer hover:shadow-lg transition-all"
                            onClick={() => setEditingPerson(person)}
                        >
                            <img
                                src={person.photoUrl}
                                alt={person.fullName}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                loading="lazy"
                            />

                            {/* Gradient Overlay - always visible on mobile touchscreens */}
                            <div className="absolute inset-x-0 bottom-0 pt-10 pb-2.5 px-2.5 sm:pb-3 sm:px-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end">
                                <p className="text-white font-medium text-sm truncate">{person.fullName}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    {person.birthDate && formatShortYearLabel(person.birthDate) && (
                                        <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-white/20 text-white hover:bg-white/30 border-none">
                                            {formatShortYearLabel(person.birthDate)}
                                        </Badge>
                                    )}
                                    {person.tags.includes('verified') && (
                                        <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-green-500/80 text-white hover:bg-green-500 border-none">
                                            Verified
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground border-2 border-dashed rounded-xl bg-muted/30">
                    <ImageIcon className="w-12 h-12 mb-4 opacity-20" />
                    <h3 className="text-lg font-medium">Belum ada foto</h3>
                    <p className="max-w-sm mt-1">
                        {searchTerm
                            ? 'Tidak ada anggota dengan foto yang cocok dengan pencarian Anda.'
                            : 'Tambahkan foto profil pada anggota keluarga untuk menampilkannya di sini.'}
                    </p>
                </div>
            )}

            {/* Edit Dialog (to view/edit person details) */}
            <Dialog open={!!editingPerson} onOpenChange={(open) => !open && setEditingPerson(null)}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="font-display">Detail Anggota</DialogTitle>
                    </DialogHeader>
                    <PersonForm
                        person={editingPerson || undefined}
                        onSuccess={() => setEditingPerson(null)}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}
