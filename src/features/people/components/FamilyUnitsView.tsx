import { useState } from 'react';
import { Users, LayoutGrid, List, ChevronLeft, ChevronRight } from 'lucide-react';
import { FamilyUnitAccordion } from './FamilyUnitAccordion';
import { FamilyUnitGridCard } from './FamilyUnitGridCard';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from '@/components/ui/pagination';
import type { NuclearFamily, Person } from '@/types';

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
  const [viewType, setViewType] = useState<ViewType>('grid'); // Default to grid for density
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12; // Increased for higher density (divisible by 2, 3, 4)

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
    <div className="space-y-6">
      {/* Controls: View Toggle & Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/20 p-3 rounded-lg border">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Tampilan:</span>
          <ToggleGroup type="single" value={viewType} onValueChange={(v) => v && setViewType(v as ViewType)}>
            <ToggleGroupItem value="list" aria-label="List view" size="sm">
              <List className="h-4 w-4 mr-2" />
              List
            </ToggleGroupItem>
            <ToggleGroupItem value="grid" aria-label="Grid view" size="sm">
              <LayoutGrid className="h-4 w-4 mr-2" />
              Grid
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="text-sm text-muted-foreground text-right">
          Menampilkan <span className="font-medium text-foreground">{startIndex + 1}-{Math.min(endIndex, families.length)}</span> dari <span className="font-medium text-foreground">{families.length}</span> keluarga
        </div>
      </div>

      {/* Grid View */}
      {viewType === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {generations.map(gen => (
            <div key={gen}>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Generasi {gen}
                </h3>
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
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
        <div className="flex justify-center mt-8 pt-4 border-t">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="text-sm font-medium">
              Halaman {currentPage} dari {totalPages}
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
