import { useState } from 'react';
import { useFamilyStore } from '@/store/familyStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus,
  Search,
  User,
  Trash2,
  Edit,
  Calendar,
  CheckCircle,
  AlertCircle,
  Undo2,
  Users as UsersIcon,
  X
} from 'lucide-react';
import { PersonForm } from '@/features/people/PersonForm';
import type { Person, FilterConfig } from '@/types';
import Fuse from 'fuse.js';
import { FilterPanel } from '@/components/filter/FilterPanel';
import { applyAllFilters, getGenerationLabel } from '@/lib/filterUtils';
import { PersonCardSkeletonGrid } from '@/components/skeletons/PersonCardSkeleton';

export default function PeoplePage() {
  const { persons, deletePerson, undoStack, undo, searchQuery, setSearchQuery, relationships, isLoading } = useFamilyStore();
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Person | null>(null);
  const [filters, setFilters] = useState<FilterConfig>({
    generations: [],
    verificationStatuses: [],
    ageRange: null,
    completeness: 'all'
  });

  // Fuzzy search
  const fuse = new Fuse(persons, {
    keys: ['fullName', 'notes', 'tags'],
    threshold: 0.3,
  });

  // Apply search first, then filters
  const searchResults = localSearch
    ? fuse.search(localSearch).map(result => result.item)
    : persons;

  const filteredPersons = applyAllFilters(searchResults, filters, relationships);

  const activeFilterCount =
    filters.generations.length +
    filters.verificationStatuses.length +
    (filters.ageRange ? 1 : 0) +
    (filters.completeness !== 'all' ? 1 : 0);

  const removeFilter = (type: 'generation' | 'verification' | 'age' | 'completeness', value?: any) => {
    switch (type) {
      case 'generation':
        setFilters({ ...filters, generations: filters.generations.filter(g => g !== value) });
        break;
      case 'verification':
        setFilters({ ...filters, verificationStatuses: filters.verificationStatuses.filter(v => v !== value) });
        break;
      case 'age':
        setFilters({ ...filters, ageRange: null });
        break;
      case 'completeness':
        setFilters({ ...filters, completeness: 'all' });
        break;
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(localSearch);
  };

  const handleDelete = async (person: Person) => {
    await deletePerson(person.id);
    setDeleteConfirm(null);
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            Anggota Keluarga
          </h1>
          <p className="text-muted-foreground mt-1">
            Kelola data anggota keluarga Anda
          </p>
        </div>
        <div className="flex items-center gap-2">
          {undoStack.length > 0 && (
            <Button variant="outline" onClick={undo} className="gap-2">
              <Undo2 className="w-4 h-4" />
              Undo
            </Button>
          )}
          <FilterPanel
            filterConfig={filters}
            onFilterChange={setFilters}
            persons={persons}
            relationships={relationships}
          />
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Tambah Anggota
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display">Tambah Anggota Baru</DialogTitle>
              </DialogHeader>
              <PersonForm onSuccess={() => setIsAddOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Active Filters */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Filter Aktif:</span>
          {filters.generations.map(gen => (
            <Badge key={`gen-${gen}`} variant="secondary" className="gap-1">
              {getGenerationLabel(gen)}
              <button
                type="button"
                onClick={() => removeFilter('generation', gen)}
                className="ml-1 hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
          {filters.verificationStatuses.map(status => (
            <Badge key={`status-${status}`} variant="secondary" className="gap-1">
              {status}
              <button
                type="button"
                onClick={() => removeFilter('verification', status)}
                className="ml-1 hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
          {filters.ageRange && (
            <Badge variant="secondary" className="gap-1">
              {filters.ageRange.min} - {filters.ageRange.max}
              <button
                type="button"
                onClick={() => removeFilter('age')}
                className="ml-1 hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {filters.completeness !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              {filters.completeness === 'complete' ? 'Lengkap' : filters.completeness === 'partial' ? 'Sebagian' : 'Minimal'}
              <button
                type="button"
                onClick={() => removeFilter('completeness')}
                className="ml-1 hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
        </div>
      )}

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Cari nama, catatan, tag..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button type="submit" variant="secondary">Cari</Button>
      </form>

      {/* Result Count */}
      {(localSearch || activeFilterCount > 0) && (
        <p className="text-sm text-muted-foreground">
          Menampilkan <span className="font-semibold">{filteredPersons.length}</span> dari <span className="font-semibold">{persons.length}</span> anggota
        </p>
      )}

      {/* People Grid */}
      {isLoading ? (
        <PersonCardSkeletonGrid count={6} />
      ) : filteredPersons.length === 0 ? (
        <div className="empty-state py-20">
          <UsersIcon className="empty-state-icon" />
          <h3 className="text-lg font-medium mb-2">
            {localSearch ? 'Tidak ada hasil' : 'Belum ada anggota'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {localSearch
              ? 'Coba kata kunci lain atau hapus filter pencarian'
              : 'Mulai dengan menambahkan anggota keluarga pertama'}
          </p>
          {!localSearch && (
            <Button onClick={() => setIsAddOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Tambah Anggota Pertama
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredPersons.map((person) => (
            <Card key={person.id} className="p-4 hover:shadow-lg transition-shadow animate-slide-up">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className={`
                    w-14 h-14 rounded-full flex items-center justify-center overflow-hidden
                    ${person.photoUrl ? 'border-2 border-border shadow-sm' : ''}
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
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const parent = e.currentTarget.parentElement;
                          if (parent) {
                            const icon = document.createElement('div');
                            icon.className = 'w-6 h-6';
                            icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
                            parent.appendChild(icon);
                          }
                        }}
                      />
                    ) : (
                      <User className="w-6 h-6" />
                    )}
                  </div>
                  {/* Verified badge on avatar */}
                  {person.tags.includes('verified') && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
                      <CheckCircle className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{person.fullName}</h3>

                  {/* Dates */}
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {formatDate(person.birthDate) || '?'}
                      {person.deathDate && ` - ${formatDate(person.deathDate)}`}
                    </span>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {person.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className={
                          tag === 'verified' ? 'badge-verified' :
                            tag === 'needs review' ? 'badge-review' :
                              tag === 'draft' ? 'badge-draft' : ''
                        }
                      >
                        {tag === 'verified' && <CheckCircle className="w-3 h-3 mr-1" />}
                        {tag === 'needs review' && <AlertCircle className="w-3 h-3 mr-1" />}
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  {/* Confidence */}
                  <div className="mt-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Keyakinan:</span>
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${person.confidenceScore}%` }}
                        />
                      </div>
                      <span className="font-medium">{person.confidenceScore}%</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditingPerson(person)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="font-display">Edit Anggota</DialogTitle>
                      </DialogHeader>
                      <PersonForm person={person} onSuccess={() => setEditingPerson(null)} />
                    </DialogContent>
                  </Dialog>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleteConfirm(person)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Notes preview */}
              {person.notes && (
                <p className="text-sm text-muted-foreground mt-3 line-clamp-2 border-t pt-3">
                  {person.notes}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Anggota?</AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan menghapus <strong>{deleteConfirm?.fullName}</strong> beserta semua relasi yang terkait. Tindakan ini dapat di-undo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
