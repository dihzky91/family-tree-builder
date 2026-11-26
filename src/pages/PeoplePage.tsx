import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFamilyStore } from '@/store/familyStore';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Plus,
  Search,
  Trash2,
  Edit,
  Calendar,
  CheckCircle,
  Undo2,
  Users as UsersIcon,
  X,
  ListTree,
  LayoutGrid,
  TableProperties,
  GitBranch,
  MapPin,
  Link2,
  ArrowUpDown,
  ChevronDown,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FamilyUnitsView } from '@/features/people/components/FamilyUnitsView';
import { GenerationView } from '@/features/people/components/GenerationView';
import {
  PersonDetailSheet,
  getPersonInitials,
} from '@/features/people/components/PersonDetailSheet';
import {
  formatLifeSpan,
  getSortableTimestamp,
} from '@/lib/flexibleDateUtils';
import { RelationshipForm } from '@/features/relationships/RelationshipForm';
import { calculateNuclearFamilies } from '@/lib/familyUnits';
import { PersonForm } from '@/features/people/PersonForm';
import type { Person, FilterConfig } from '@/types';
import { FilterPanel } from '@/components/filter/FilterPanel';
import { applyAllFilters, getGenerationLabel } from '@/lib/filterUtils';
import { PersonCardSkeletonGrid } from '@/components/skeletons/PersonCardSkeleton';
import { smartSearch } from '@/lib/smartSearchUtils';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

type QuickFilter = 'all' | 'living' | 'deceased' | 'verified' | 'needs_review' | 'no_photo';
type SortOption = 'name_asc' | 'name_desc' | 'birth_asc' | 'birth_desc' | 'confidence_desc' | 'confidence_asc';

export default function PeoplePage() {
  const {
    persons,
    deletePerson,
    undoStack,
    undo,
    searchQuery,
    setSearchQuery,
    relationships,
    isLoading,
  } = useFamilyStore();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const [localSearch, setLocalSearch] = useState(searchQuery);
  const debouncedSearch = useDebouncedValue(localSearch, 180);
  const [visibleLimit, setVisibleLimit] = useState(36);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Person | null>(null);
  const [viewMode, setViewMode] = useState<'nuclear' | 'generation' | 'all'>('nuclear');
  const [allDisplayMode, setAllDisplayMode] = useState<'grid' | 'table'>('grid');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('name_asc');
  const [showAddRelationship, setShowAddRelationship] = useState(false);
  const [addRelContext, setAddRelContext] = useState<{
    personId?: string;
    suggestedType?: 'parent' | 'spouse' | 'child';
  }>({});
  const [filters, setFilters] = useState<FilterConfig>({
    generations: [],
    verificationStatuses: [],
    ageRange: null,
    completeness: 'all',
  });

  const selectedPerson = useMemo(
    () => persons.find((p) => p.id === selectedPersonId) || null,
    [persons, selectedPersonId]
  );

  // Relation count per person for cards & table
  const relationCountMap = useMemo(() => {
    const map = new Map<string, number>();
    relationships.forEach((r) => {
      map.set(r.fromPersonId, (map.get(r.fromPersonId) || 0) + 1);
      map.set(r.toPersonId, (map.get(r.toPersonId) || 0) + 1);
    });
    return map;
  }, [relationships]);

  // Quick filter counts
  const quickCounts = useMemo(() => {
    let living = 0;
    let deceased = 0;
    let verified = 0;
    let needsReview = 0;
    let noPhoto = 0;
    persons.forEach((p) => {
      if (p.deathDate) deceased++;
      else living++;
      if (p.tags.includes('verified')) verified++;
      if (p.tags.includes('needs review')) needsReview++;
      if (!p.photoUrl) noPhoto++;
    });
    return {
      all: persons.length,
      living,
      deceased,
      verified,
      needs_review: needsReview,
      no_photo: noPhoto,
    };
  }, [persons]);

  // Sync debounced search query to global store and reset incremental pagination on filter change
  useEffect(() => {
    setSearchQuery(debouncedSearch);
  }, [debouncedSearch, setSearchQuery]);

  useEffect(() => {
    setVisibleLimit(36);
  }, [debouncedSearch, quickFilter, sortBy, filters, allDisplayMode]);

  // Smart Search (runs on debouncedSearch so typing on mobile keyboard never stutters)
  const searchResults = useMemo(() => {
    if (!debouncedSearch) return persons;
    return smartSearch(debouncedSearch, persons, relationships).map((r) => r.person);
  }, [debouncedSearch, persons, relationships]);

  // Apply FilterPanel + QuickFilter + Sort
  const filteredPersons = useMemo(() => {
    let list = applyAllFilters(searchResults, filters, relationships);

    if (quickFilter === 'living') list = list.filter((p) => !p.deathDate);
    else if (quickFilter === 'deceased') list = list.filter((p) => Boolean(p.deathDate));
    else if (quickFilter === 'verified') list = list.filter((p) => p.tags.includes('verified'));
    else if (quickFilter === 'needs_review') list = list.filter((p) => p.tags.includes('needs review'));
    else if (quickFilter === 'no_photo') list = list.filter((p) => !p.photoUrl);

    return [...list].sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          return a.fullName.localeCompare(b.fullName, 'id');
        case 'name_desc':
          return b.fullName.localeCompare(a.fullName, 'id');
        case 'birth_asc': {
          const tA = getSortableTimestamp(a.birthDate);
          const tB = getSortableTimestamp(b.birthDate);
          if (tA === null && tB === null) return 0;
          if (tA === null) return 1;
          if (tB === null) return -1;
          return tA - tB;
        }
        case 'birth_desc': {
          const tA = getSortableTimestamp(a.birthDate);
          const tB = getSortableTimestamp(b.birthDate);
          if (tA === null && tB === null) return 0;
          if (tA === null) return 1;
          if (tB === null) return -1;
          return tB - tA;
        }
        case 'confidence_desc':
          return b.confidenceScore - a.confidenceScore;
        case 'confidence_asc':
          return a.confidenceScore - b.confidenceScore;
        default:
          return 0;
      }
    });
  }, [searchResults, filters, relationships, quickFilter, sortBy]);

  // Calculate nuclear families for grouping view
  const nuclearFamilies = useMemo(
    () => calculateNuclearFamilies(persons, relationships),
    [persons, relationships]
  );

  // Filter families based on filteredPersons
  const filteredFamilies = useMemo(() => {
    if (filteredPersons.length === persons.length && quickFilter === 'all') return nuclearFamilies;
    const includedIds = new Set(filteredPersons.map((p) => p.id));
    return nuclearFamilies.filter(
      (family) =>
        family.parents.some((p) => includedIds.has(p.id)) ||
        family.children.some((p) => includedIds.has(p.id))
    );
  }, [nuclearFamilies, filteredPersons, persons.length, quickFilter]);

  const activeFilterCount =
    filters.generations.length +
    filters.verificationStatuses.length +
    (filters.ageRange ? 1 : 0) +
    (filters.completeness !== 'all' ? 1 : 0);

  const hasActiveQuery = Boolean(localSearch || activeFilterCount > 0 || quickFilter !== 'all');

  const removeFilter = (
    type: 'generation' | 'verification' | 'age' | 'completeness',
    value?: number | string
  ) => {
    switch (type) {
      case 'generation':
        setFilters({ ...filters, generations: filters.generations.filter((g) => g !== value) });
        break;
      case 'verification':
        setFilters({
          ...filters,
          verificationStatuses: filters.verificationStatuses.filter((v) => v !== value),
        });
        break;
      case 'age':
        setFilters({ ...filters, ageRange: null });
        break;
      case 'completeness':
        setFilters({ ...filters, completeness: 'all' });
        break;
    }
  };

  const handleDelete = async (person: Person) => {
    if (selectedPersonId === person.id) {
      setSelectedPersonId(null);
    }
    await deletePerson(person.id);
    setDeleteConfirm(null);
  };

  const handleOpenAddRelationship = (personId: string, type: 'parent' | 'spouse' | 'child') => {
    setAddRelContext({ personId, suggestedType: type });
    setShowAddRelationship(true);
  };

  const quickFilterChips: { id: QuickFilter; label: string; count: number }[] = [
    { id: 'all', label: 'Semua', count: quickCounts.all },
    { id: 'living', label: 'Masih Hidup', count: quickCounts.living },
    { id: 'deceased', label: 'Almarhum/ah', count: quickCounts.deceased },
    { id: 'verified', label: 'Terverifikasi', count: quickCounts.verified },
    { id: 'needs_review', label: 'Perlu Review', count: quickCounts.needs_review },
    { id: 'no_photo', label: 'Tanpa Foto', count: quickCounts.no_photo },
  ];

  return (
    <div className="space-y-4 p-4 md:space-y-5 md:p-6 lg:p-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Data Keluarga</p>
          <h1 className="mt-0.5 text-2xl font-display font-bold text-foreground md:text-3xl">
            Anggota Keluarga
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Kelola, filter, dan telusuri data anggota keluarga Anda
          </p>
        </div>
        <div className="flex items-center gap-2">
          {undoStack.length > 0 && (
            <Button variant="outline" onClick={undo} className="gap-2 shrink-0">
              <Undo2 className="w-4 h-4" />
              <span className={isMobile ? 'sr-only' : ''}>Undo</span>
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
              <Button className="gap-2 flex-1 sm:flex-none">
                <Plus className="w-4 h-4" />
                Tambah Anggota
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[88dvh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display">Tambah Anggota Baru</DialogTitle>
              </DialogHeader>
              <PersonForm onSuccess={() => setIsAddOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Unified Full-Width Control Bar */}
      <div className="rounded-2xl border bg-card p-3 sm:p-4 shadow-sm space-y-3">
        {/* Row 1: Search + Sort + View Switcher */}
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
          {/* Live Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Cari nama, tempat, catatan, tag..."
              value={localSearch}
              onChange={(e) => {
                setLocalSearch(e.target.value);
              }}
              className="h-10 pl-9 pr-9 rounded-xl"
            />
            {localSearch && (
              <button
                type="button"
                onClick={() => {
                  setLocalSearch('');
                  setSearchQuery('');
                }}
                aria-label="Hapus pencarian"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* Sort Select */}
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="h-10 w-full sm:w-[185px] rounded-xl text-xs">
                <ArrowUpDown className="w-3.5 h-3.5 mr-1.5 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Urutkan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name_asc">Nama (A – Z)</SelectItem>
                <SelectItem value="name_desc">Nama (Z – A)</SelectItem>
                <SelectItem value="birth_asc">Lahir Tertua</SelectItem>
                <SelectItem value="birth_desc">Lahir Termuda</SelectItem>
                <SelectItem value="confidence_desc">Keyakinan Tertinggi</SelectItem>
                <SelectItem value="confidence_asc">Keyakinan Terendah</SelectItem>
              </SelectContent>
            </Select>

            {/* View Mode Tabs */}
            <Tabs
              value={viewMode}
              onValueChange={(v) => setViewMode(v as 'nuclear' | 'generation' | 'all')}
              className="w-full sm:w-auto"
            >
              <TabsList className="grid h-10 w-full grid-cols-3 rounded-xl bg-muted p-1 sm:w-[360px]">
                <TabsTrigger value="nuclear" className="gap-1.5 py-1.5 text-xs">
                  <UsersIcon className="w-3.5 h-3.5" />
                  <span>{isMobile ? 'Inti' : 'Keluarga Inti'}</span>
                </TabsTrigger>
                <TabsTrigger value="generation" className="gap-1.5 py-1.5 text-xs">
                  <ListTree className="w-3.5 h-3.5" />
                  <span>{isMobile ? 'Generasi' : 'Per Generasi'}</span>
                </TabsTrigger>
                <TabsTrigger value="all" className="gap-1.5 py-1.5 text-xs">
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>{isMobile ? 'Semua' : 'Semua'}</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Row 2: Quick Filter Chips + Result Summary + Grid/Table Toggle */}
        <div className="flex flex-col gap-2.5 pt-2 border-t border-border/60 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {quickFilterChips.map((chip) => {
              const isActive = quickFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setQuickFilter(chip.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-background/80 text-muted-foreground border-border/70 hover:text-foreground hover:bg-muted/60'
                  )}
                >
                  <span>{chip.label}</span>
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0 text-[10px]',
                      isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {chip.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
            <div className="text-xs text-muted-foreground">
              {hasActiveQuery ? (
                <>
                  Menampilkan <span className="font-semibold text-foreground">{filteredPersons.length}</span> dari{' '}
                  <span className="font-semibold text-foreground">{persons.length}</span>
                </>
              ) : (
                <>
                  Total <span className="font-semibold text-foreground">{persons.length}</span> anggota
                </>
              )}
            </div>

            {viewMode === 'all' && (
              <div className="inline-flex items-center rounded-lg border bg-muted/40 p-0.5">
                <button
                  type="button"
                  onClick={() => setAllDisplayMode('grid')}
                  aria-label="Tampilan kartu"
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                    allDisplayMode === 'grid'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Kartu</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAllDisplayMode('table')}
                  aria-label="Tampilan tabel"
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                    allDisplayMode === 'table'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <TableProperties className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Tabel</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active Advanced Filters */}
      {activeFilterCount > 0 && (
        <div className="rounded-2xl border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-foreground">Filter Lanjutan Aktif</span>
            <span className="text-xs text-muted-foreground">{activeFilterCount} filter</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {filters.generations.map((gen) => (
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
            {filters.verificationStatuses.map((status) => (
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
                {filters.completeness === 'complete'
                  ? 'Lengkap'
                  : filters.completeness === 'partial'
                    ? 'Sebagian'
                    : 'Minimal'}
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
        </div>
      )}

      {/* Content based on view mode */}
      {viewMode === 'nuclear' ? (
        <FamilyUnitsView
          families={filteredFamilies}
          onEditPerson={(person) => setSelectedPersonId(person.id)}
        />
      ) : viewMode === 'generation' ? (
        <GenerationView
          persons={filteredPersons}
          relationships={relationships}
          onEditPerson={(person) => setSelectedPersonId(person.id)}
        />
      ) : (
        <>
          {isLoading ? (
            <PersonCardSkeletonGrid count={6} />
          ) : filteredPersons.length === 0 ? (
            <div className="empty-state py-16">
              <UsersIcon className="empty-state-icon" />
              <h3 className="text-lg font-medium mb-2">
                {hasActiveQuery ? 'Tidak ada hasil yang cocok' : 'Belum ada anggota'}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {hasActiveQuery
                  ? 'Coba ubah kata kunci atau reset filter pencarian'
                  : 'Mulai dengan menambahkan anggota keluarga pertama'}
              </p>
              {hasActiveQuery ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setLocalSearch('');
                    setSearchQuery('');
                    setQuickFilter('all');
                    setFilters({
                      generations: [],
                      verificationStatuses: [],
                      ageRange: null,
                      completeness: 'all',
                    });
                  }}
                >
                  Reset Filter
                </Button>
              ) : (
                <Button onClick={() => setIsAddOpen(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Tambah Anggota Pertama
                </Button>
              )}
            </div>
          ) : allDisplayMode === 'table' ? (
            <div className="space-y-4">
              <Card className="overflow-hidden rounded-2xl border shadow-sm">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/35 hover:bg-muted/35">
                        <TableHead className="min-w-[200px]">Anggota</TableHead>
                        <TableHead className="min-w-[120px]">Lahir / Wafat</TableHead>
                        <TableHead className="hidden md:table-cell min-w-[130px]">Lokasi</TableHead>
                        <TableHead className="min-w-[90px]">Relasi</TableHead>
                        <TableHead className="hidden sm:table-cell min-w-[120px]">Keyakinan</TableHead>
                        <TableHead className="text-right w-[110px]">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPersons.slice(0, visibleLimit).map((person) => {
                        const relCount = relationCountMap.get(person.id) || 0;
                        const lifeSpanLabel = formatLifeSpan(person.birthDate, person.deathDate, '—');
                        const locationText = person.residence || person.birthPlace;

                        return (
                          <TableRow
                            key={person.id}
                            className="cursor-pointer"
                            onClick={() => setSelectedPersonId(person.id)}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2.5">
                                <div className="relative shrink-0">
                                  <div
                                    className={`w-9 h-9 rounded-full flex items-center justify-center overflow-hidden text-xs font-bold ${
                                      person.gender === 'male'
                                        ? 'bg-node-male/20 text-node-male'
                                        : person.gender === 'female'
                                          ? 'bg-node-female/20 text-node-female'
                                          : 'bg-node-unknown/20 text-node-unknown'
                                    }`}
                                  >
                                    {person.photoUrl ? (
                                      <img
                                        src={person.photoUrl}
                                        alt={person.fullName}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                        decoding="async"
                                      />
                                    ) : (
                                      getPersonInitials(person.fullName)
                                    )}
                                  </div>
                                  {person.tags.includes('verified') && (
                                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
                                      <CheckCircle className="w-2 h-2 text-white" />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-sm truncate max-w-[180px] sm:max-w-[240px]">
                                    {person.fullName}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground">
                                    {person.gender === 'male'
                                      ? 'Laki-laki'
                                      : person.gender === 'female'
                                        ? 'Perempuan'
                                        : 'Tidak diketahui'}
                                    {person.deathDate ? ' · Almarhum/ah' : ''}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {lifeSpanLabel}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                              <span className="truncate block max-w-[160px]">{locationText || '—'}</span>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={relCount > 0 ? 'secondary' : 'outline'}
                                className={cn(
                                  'text-[10px] font-medium',
                                  relCount === 0 && 'text-amber-600 border-amber-300 dark:text-amber-400'
                                )}
                              >
                                {relCount > 0 ? `${relCount} relasi` : 'Orphan'}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-primary/80 rounded-full"
                                    style={{ width: `${person.confidenceScore}%` }}
                                  />
                                </div>
                                <span className="text-[11px] text-muted-foreground">
                                  {person.confidenceScore}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-0.5">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                                  title="Lihat di Silsilah"
                                  aria-label={`Lihat ${person.fullName} di silsilah`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/chart?focus=${person.id}`);
                                  }}
                                >
                                  <GitBranch className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                  title="Edit"
                                  aria-label={`Edit ${person.fullName}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingPerson(person);
                                  }}
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  title="Hapus"
                                  aria-label={`Hapus ${person.fullName}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteConfirm(person);
                                  }}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </Card>

              {filteredPersons.length > visibleLimit && (
                <div className="flex flex-col items-center justify-center gap-1.5 pt-1">
                  <Button
                    variant="outline"
                    onClick={() => setVisibleLimit((prev) => prev + 36)}
                    className="gap-2 rounded-xl"
                  >
                    <ChevronDown className="w-4 h-4" />
                    Tampilkan Lebih Banyak ({filteredPersons.length - visibleLimit} tersisa)
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {filteredPersons.slice(0, visibleLimit).map((person) => {
                  const relCount = relationCountMap.get(person.id) || 0;
                  const lifeSpanLabel = formatLifeSpan(
                    person.birthDate,
                    person.deathDate,
                    'Tahun tidak diketahui'
                  );
                  const locationText = person.residence || person.birthPlace;

                  return (
                    <Card
                      key={person.id}
                      onClick={() => setSelectedPersonId(person.id)}
                      style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 120px' }}
                      className="group flex cursor-pointer flex-col gap-2.5 rounded-2xl p-3 transition-colors hover:border-primary/40 hover:bg-accent/35 hover:shadow-md"
                    >
                      <div className="flex items-start gap-3">
                        {/* Avatar / Initials */}
                        <div className="relative shrink-0">
                          <div
                            className={`w-11 h-11 rounded-full flex items-center justify-center overflow-hidden text-xs font-bold ${
                              person.photoUrl ? 'border shadow-sm' : ''
                            } ${
                              person.gender === 'male'
                                ? 'bg-node-male/20 text-node-male'
                                : person.gender === 'female'
                                  ? 'bg-node-female/20 text-node-female'
                                  : 'bg-node-unknown/20 text-node-unknown'
                            }`}
                          >
                            {person.photoUrl ? (
                              <img
                                src={person.photoUrl}
                                alt={person.fullName}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                decoding="async"
                              />
                            ) : (
                              getPersonInitials(person.fullName)
                            )}
                          </div>
                          {person.tags.includes('verified') && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
                              <CheckCircle className="w-2.5 h-2.5 text-white" />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1">
                            <div className="min-w-0">
                              <h3
                                className="truncate text-sm font-semibold leading-tight group-hover:text-primary transition-colors"
                                title={person.fullName}
                              >
                                {person.fullName}
                              </h3>
                              <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Calendar className="w-3 h-3 shrink-0" />
                                <span className="truncate">
                                  {lifeSpanLabel}
                                </span>
                              </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="flex gap-0.5 shrink-0 -mr-1 -mt-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Lihat di Silsilah"
                                aria-label={`Lihat ${person.fullName} di silsilah`}
                                className="h-8 w-8 sm:h-7 sm:w-7 text-muted-foreground hover:text-primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/chart?focus=${person.id}`);
                                }}
                              >
                                <GitBranch className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Edit"
                                aria-label={`Edit ${person.fullName}`}
                                className="h-8 w-8 sm:h-7 sm:w-7 text-muted-foreground hover:text-foreground"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingPerson(person);
                                }}
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Hapus"
                                aria-label={`Hapus ${person.fullName}`}
                                className="h-8 w-8 sm:h-7 sm:w-7 text-muted-foreground hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirm(person);
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* Meta row: location + relations */}
                          <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                            {locationText && (
                              <span className="inline-flex items-center gap-0.5 truncate max-w-[110px]">
                                <MapPin className="w-2.5 h-2.5 shrink-0" />
                                <span className="truncate">{locationText}</span>
                              </span>
                            )}
                            <span
                              className={cn(
                                'inline-flex items-center gap-0.5 shrink-0',
                                relCount === 0 && 'text-amber-600 dark:text-amber-400'
                              )}
                            >
                              <Link2 className="w-2.5 h-2.5" />
                              {relCount > 0 ? `${relCount} relasi` : 'Belum terhubung'}
                            </span>
                          </div>

                          {/* Tags */}
                          {person.tags.filter((t) => t !== 'verified').length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {person.tags
                                .filter((t) => t !== 'verified')
                                .slice(0, 2)
                                .map((tag) => (
                                  <Badge
                                    key={tag}
                                    variant="secondary"
                                    className={`h-4 px-1.5 text-[10px] font-normal ${
                                      tag === 'needs review'
                                        ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300'
                                        : ''
                                    }`}
                                  >
                                    {tag}
                                  </Badge>
                                ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Confidence Bar */}
                      <div className="mt-auto pt-1 flex items-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Keyakinan
                        </span>
                        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary/75 rounded-full"
                            style={{ width: `${person.confidenceScore}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-medium text-muted-foreground">
                          {person.confidenceScore}%
                        </span>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {filteredPersons.length > visibleLimit && (
                <div className="flex flex-col items-center justify-center gap-1.5 pt-1">
                  <Button
                    variant="outline"
                    onClick={() => setVisibleLimit((prev) => prev + 36)}
                    className="gap-2 rounded-xl"
                  >
                    <ChevronDown className="w-4 h-4" />
                    Tampilkan Lebih Banyak ({filteredPersons.length - visibleLimit} tersisa)
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Person Detail Sheet / Drawer */}
      <PersonDetailSheet
        person={selectedPerson}
        open={Boolean(selectedPerson)}
        onOpenChange={(open) => {
          if (!open) setSelectedPersonId(null);
        }}
        onSelectPerson={(id) => setSelectedPersonId(id)}
        onEditPerson={(person) => setEditingPerson(person)}
        onDeletePerson={(person) => setDeleteConfirm(person)}
        onAddRelationship={handleOpenAddRelationship}
      />

      {/* Edit Dialog */}
      <Dialog open={!!editingPerson} onOpenChange={(open) => !open && setEditingPerson(null)}>
        <DialogContent className="max-w-2xl max-h-[88dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Edit Anggota</DialogTitle>
          </DialogHeader>
          <PersonForm
            person={editingPerson || undefined}
            onSuccess={() => setEditingPerson(null)}
          />
        </DialogContent>
      </Dialog>

      {/* Add Relationship Dialog */}
      <Dialog open={showAddRelationship} onOpenChange={setShowAddRelationship}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tambah Relasi Baru</DialogTitle>
            <DialogDescription>
              Hubungkan anggota keluarga dengan orang tua, pasangan, atau anak
            </DialogDescription>
          </DialogHeader>
          <RelationshipForm
            key={`${addRelContext.personId || 'none'}-${addRelContext.suggestedType || 'default'}`}
            preselectedPersonId={addRelContext.personId}
            suggestedType={addRelContext.suggestedType}
            onSuccess={() => {
              setShowAddRelationship(false);
              setAddRelContext({});
            }}
            onCancel={() => {
              setShowAddRelationship(false);
              setAddRelContext({});
            }}
          />
        </DialogContent>
      </Dialog>

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
