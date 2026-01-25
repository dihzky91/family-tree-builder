import { useState, useMemo } from 'react';
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
  X,
  ListTree,
  LayoutGrid,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FamilyUnitsView } from '@/features/people/components/FamilyUnitsView';
import { GenerationView } from '@/features/people/components/GenerationView';
import { calculateNuclearFamilies } from '@/lib/familyUnits';
import { PersonForm } from '@/features/people/PersonForm';
import type { Person, FilterConfig } from '@/types';
import { FilterPanel } from '@/components/filter/FilterPanel';
import { applyAllFilters, getGenerationLabel } from '@/lib/filterUtils';
import { PersonCardSkeletonGrid } from '@/components/skeletons/PersonCardSkeleton';
import { smartSearch } from '@/lib/smartSearchUtils';

export default function PeoplePage() {
  const { persons, deletePerson, undoStack, undo, searchQuery, setSearchQuery, relationships, isLoading } = useFamilyStore();
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Person | null>(null);
  const [viewMode, setViewMode] = useState<'nuclear' | 'generation' | 'all'>('nuclear');
  const [filters, setFilters] = useState<FilterConfig>({
    generations: [],
    verificationStatuses: [],
    ageRange: null,
    completeness: 'all'
  });

  // Smart Search
  const searchResults = useMemo(() => {
    if (!localSearch) return persons;
    return smartSearch(localSearch, persons, relationships).map(r => r.person);
  }, [localSearch, persons, relationships]);

  const filteredPersons = applyAllFilters(searchResults, filters, relationships);

  // Calculate nuclear families for grouping view
  const nuclearFamilies = useMemo(
    () => calculateNuclearFamilies(persons, relationships),
    [persons, relationships]
  );

  // Filter families based on search results
  const filteredFamilies = useMemo(() => {
    // If no filter active (based on count matching total), return all
    if (filteredPersons.length === persons.length) return nuclearFamilies;

    const includedIds = new Set(filteredPersons.map(p => p.id));

    return nuclearFamilies.filter(family =>
      family.parents.some(p => includedIds.has(p.id)) ||
      family.children.some(p => includedIds.has(p.id))
    );
  }, [nuclearFamilies, filteredPersons, persons.length]);

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

      {/* View Mode Tabs */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'nuclear' | 'generation' | 'all')}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="nuclear" className="gap-2">
            <UsersIcon className="w-4 h-4" />
            Keluarga Inti
          </TabsTrigger>
          <TabsTrigger value="generation" className="gap-2">
            <ListTree className="w-4 h-4" />
            Generation
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-2">
            <LayoutGrid className="w-4 h-4" />
            All List
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Content based on view mode */}
      {viewMode === 'nuclear' ? (
        <FamilyUnitsView
          families={filteredFamilies}
          onEditPerson={(person) => setEditingPerson(person)}
        />
      ) : viewMode === 'generation' ? (
        <GenerationView
          persons={filteredPersons}
          relationships={relationships}
          onEditPerson={(person) => setEditingPerson(person)}
        />
      ) : (
        /* All List - Original People Grid */
        <>
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredPersons.map((person) => (
                <Card key={person.id} className="p-2.5 hover:shadow-md hover:bg-accent/50 transition-all cursor-pointer animate-slide-up flex flex-col gap-2">
                  <div className="flex items-start gap-2.5">
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <div className={`
                        w-10 h-10 rounded-full flex items-center justify-center overflow-hidden
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
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const parent = e.currentTarget.parentElement;
                              if (parent) {
                                const icon = document.createElement('div');
                                icon.className = 'w-5 h-5';
                                icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
                                parent.appendChild(icon);
                              }
                            }}
                          />
                        ) : (
                          <User className="w-5 h-5" />
                        )}
                      </div>
                      {/* Verified badge on avatar */}
                      {person.tags.includes('verified') && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
                          <CheckCircle className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <h3 className="font-semibold text-sm truncate leading-tight" title={person.fullName}>{person.fullName}</h3>

                        {/* Actions (Compact) */}
                        <div className="flex gap-0.5 shrink-0 -mt-1 -mr-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingPerson(person);
                            }}
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm(person);
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Dates */}
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                        <Calendar className="w-3 h-3" />
                        <span className="truncate">
                          {person.birthDate ? new Date(person.birthDate).toLocaleDateString('id-ID', { year: 'numeric', month: 'short' }) : '?'}
                          {person.deathDate && ` - ${new Date(person.deathDate).getFullYear()}`}
                        </span>
                      </div>

                      {/* Tags (Compact) */}
                      {person.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {person.tags.slice(0, 2).map((tag) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className={`
                                text-[10px] px-1 h-4 font-normal
                                ${tag === 'verified' ? 'hidden' : ''} 
                                ${tag === 'needs review' ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' : ''}
                              `}
                            >
                              {tag}
                            </Badge>
                          ))}
                          {person.tags.filter(t => t !== 'verified').length > 2 && (
                            <span className="text-[10px] text-muted-foreground self-center">+{person.tags.filter(t => t !== 'verified').length - 2}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Keyakinan Bar (Slim) */}
                  <div className="mt-1 flex items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
                    <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary/70 rounded-full"
                        style={{ width: `${person.confidenceScore}%` }}
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingPerson} onOpenChange={(open) => !open && setEditingPerson(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Edit Anggota</DialogTitle>
          </DialogHeader>
          <PersonForm
            person={editingPerson || undefined}
            onSuccess={() => setEditingPerson(null)}
          />
        </DialogContent>
      </Dialog>
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
