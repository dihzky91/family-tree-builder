import { useState } from 'react';
import { Users, LayoutGrid, List, ChevronLeft, ChevronRight } from 'lucide-react';
import { FamilyUnitAccordion } from './FamilyUnitAccordion';
import { FamilyUnitGridCard } from './FamilyUnitGridCard';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { NuclearFamily, Person } from '@/types';
import { useIsMobile } from '@/hooks/use-mobile';

interface FamilyUnitsViewProps {
  families: NuclearFamily[];
  onEditPerson?: (person: Person) => void;
}

type ViewType = 'list' | 'grid';

/**
 * Container component for rendering all nuclear family units
 * Groups families by generation and manages expand/collapse
 * Supports List (Accordion) and Grid views with pagination
 */
export function FamilyUnitsView({ families, onEditPerson }: FamilyUnitsViewProps) {
  const isMobile = useIsMobile();
  const [viewType, setViewType] = useState<ViewType>('grid'); // Default to grid for density
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = isMobile ? 6 : 12;

  if (families.length === 0) {
    return (
      <div className="empty-state py-20">
        <Users className="empty-state-icon" />
        <h3 className="text-lg font-medium mb-2">Belum Ada Keluarga Inti</h3>
        <p className="text-muted-foreground">
          Tambahkan anggota keluarga dan relasi pasangan untuk melihat pengelompokan keluarga inti.
        </p>
      </div>
    );
  }

  // Pagination Logic
  const totalPages = Math.ceil(families.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentFamilies = families.slice(startIndex, endIndex);

  // Group families by generation (for List view mainly, but useful for Grid context too)
  const familiesByGeneration = currentFamilies.reduce((acc, family) => {
    const gen = family.generation;
    if (!acc[gen]) acc[gen] = [];
    acc[gen].push(family);
    return acc;
  }, {} as Record<number, NuclearFamily[]>);

  const generations = Object.keys(familiesByGeneration)
    .map(Number)
    .sort((a, b) => b - a); // Highest generation first (oldest)

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-5">
      {/* Controls: View Toggle & Summary */}
      <div className="rounded-2xl border bg-muted/20 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="text-sm font-medium text-muted-foreground">Tampilan keluarga:</span>
            <ToggleGroup type="single" value={viewType} onValueChange={(v) => v && setViewType(v as ViewType)} className="w-full sm:w-auto">
            <ToggleGroupItem value="list" aria-label="Tampilan daftar" size="sm" className="flex-1 sm:flex-none">
              <List className="h-4 w-4 mr-2" />
              Daftar
            </ToggleGroupItem>
            <ToggleGroupItem value="grid" aria-label="Tampilan grid" size="sm" className="flex-1 sm:flex-none">
              <LayoutGrid className="h-4 w-4 mr-2" />
              Grid
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="text-sm text-muted-foreground sm:text-right">
          Menampilkan <span className="font-medium text-foreground">{startIndex + 1}-{Math.min(endIndex, families.length)}</span> dari <span className="font-medium text-foreground">{families.length}</span> keluarga
        </div>
        </div>
      </div>

      {/* Grid View */}
      {viewType === 'grid' && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {currentFamilies.map((family) => (
            <FamilyUnitGridCard
              key={family.id}
              family={family}
              onEditPerson={onEditPerson}
            />
          ))}
        </div>
      )}

      {/* List View (Accordion) */}
      {viewType === 'list' && (
        <div className="space-y-5 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {generations.map(gen => (
            <div key={gen}>
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Generasi {gen}
                </h3>
                <div className="flex-1 h-px bg-border" />
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {familiesByGeneration[gen].length} keluarga
                </span>
              </div>

              <div className="space-y-2">
                {familiesByGeneration[gen].map((family, index) => (
                  <FamilyUnitAccordion
                    key={family.id}
                    family={family}
                    onEditPerson={onEditPerson}
                    defaultOpen={true} // Always open in this paginated view for better visibility
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-6 border-t pt-4">
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted/20 p-3">
            <Button
              variant="outline"
              className="h-10 px-3"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Sebelumnya
            </Button>

            <div className="text-center text-sm font-medium">
              Halaman {currentPage} dari {totalPages}
            </div>

            <Button
              variant="outline"
              className="h-10 px-3"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Berikutnya
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
