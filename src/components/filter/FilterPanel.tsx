import { useState } from 'react';
import { Filter, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import type { FilterConfig, Person, Relationship } from '@/types';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { getAvailableGenerations, getGenerationLabel } from '@/lib/filterUtils';

interface FilterPanelProps {
    filterConfig: FilterConfig;
    onFilterChange: (config: FilterConfig) => void;
    persons: Person[];
    relationships: Relationship[];
}

export function FilterPanel({ filterConfig, onFilterChange, persons, relationships }: FilterPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [minYear, setMinYear] = useState(filterConfig.ageRange?.min?.toString() || '');
    const [maxYear, setMaxYear] = useState(filterConfig.ageRange?.max?.toString() || '');

    const availableGenerations = getAvailableGenerations(persons, relationships);
    const verificationOptions = [
        { value: 'verified', label: 'Terverifikasi', icon: '✓' },
        { value: 'needs review', label: 'Perlu Review', icon: '⚠' },
        { value: 'draft', label: 'Draft', icon: '📝' },
    ];

    const completenessOptions = [
        { value: 'all', label: 'Semua' },
        { value: 'complete', label: 'Lengkap' },
        { value: 'partial', label: 'Sebagian' },
        { value: 'minimal', label: 'Minimal' },
    ];

    const activeFilterCount =
        filterConfig.generations.length +
        filterConfig.verificationStatuses.length +
        (filterConfig.ageRange ? 1 : 0) +
        (filterConfig.completeness !== 'all' ? 1 : 0);

    const handleGenerationToggle = (gen: number) => {
        const newGenerations = filterConfig.generations.includes(gen)
            ? filterConfig.generations.filter(g => g !== gen)
            : [...filterConfig.generations, gen];
        onFilterChange({ ...filterConfig, generations: newGenerations });
    };

    const handleVerificationToggle = (status: string) => {
        const newStatuses = filterConfig.verificationStatuses.includes(status)
            ? filterConfig.verificationStatuses.filter(s => s !== status)
            : [...filterConfig.verificationStatuses, status];
        onFilterChange({ ...filterConfig, verificationStatuses: newStatuses });
    };

    const handleAgeRangeApply = () => {
        const min = minYear ? parseInt(minYear) : null;
        const max = maxYear ? parseInt(maxYear) : null;
        onFilterChange({
            ...filterConfig,
            ageRange: (min !== null || max !== null) ? { min: min || 1900, max: max || new Date().getFullYear() } : null,
        });
    };

    const handleCompletenessChange = (value: FilterConfig['completeness']) => {
        onFilterChange({ ...filterConfig, completeness: value });
    };

    const handleClearAll = () => {
        onFilterChange({
            generations: [],
            verificationStatuses: [],
            ageRange: null,
            completeness: 'all',
        });
        setMinYear('');
        setMaxYear('');
    };

    const FilterContent = () => (
        <div className="space-y-6">
            {/* Generation Filter */}
            <div>
                <Label className="text-base font-semibold">Generasi</Label>
                <p className="text-xs text-muted-foreground mb-3">Pilih tingkat generasi</p>
                <div className="space-y-2">
                    {availableGenerations.map(gen => (
                        <div key={gen} className="flex items-center space-x-2">
                            <Checkbox
                                id={`gen-${gen}`}
                                checked={filterConfig.generations.includes(gen)}
                                onCheckedChange={() => handleGenerationToggle(gen)}
                            />
                            <label
                                htmlFor={`gen-${gen}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                                {getGenerationLabel(gen)}
                            </label>
                        </div>
                    ))}
                </div>
            </div>

            <Separator />

            {/* Verification Status Filter */}
            <div>
                <Label className="text-base font-semibold">Status Verifikasi</Label>
                <p className="text-xs text-muted-foreground mb-3">Filter berdasarkan tag</p>
                <div className="space-y-2">
                    {verificationOptions.map(option => (
                        <div key={option.value} className="flex items-center space-x-2">
                            <Checkbox
                                id={`verify-${option.value}`}
                                checked={filterConfig.verificationStatuses.includes(option.value)}
                                onCheckedChange={() => handleVerificationToggle(option.value)}
                            />
                            <label
                                htmlFor={`verify-${option.value}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-1.5"
                            >
                                <span>{option.icon}</span>
                                <span>{option.label}</span>
                            </label>
                        </div>
                    ))}
                </div>
            </div>

            <Separator />

            {/* Age Range Filter */}
            <div>
                <Label className="text-base font-semibold">Rentang Tahun Lahir</Label>
                <p className="text-xs text-muted-foreground mb-3">Filter berdasarkan usia</p>
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label htmlFor="min-year" className="text-xs">Dari Tahun</Label>
                            <input
                                id="min-year"
                                type="number"
                                placeholder="1900"
                                value={minYear}
                                onChange={(e) => setMinYear(e.target.value)}
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </div>
                        <div>
                            <Label htmlFor="max-year" className="text-xs">Sampai Tahun</Label>
                            <input
                                id="max-year"
                                type="number"
                                placeholder={new Date().getFullYear().toString()}
                                value={maxYear}
                                onChange={(e) => setMaxYear(e.target.value)}
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </div>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAgeRangeApply}
                        className="w-full"
                    >
                        Terapkan Rentang
                    </Button>
                </div>
            </div>

            <Separator />

            {/* Data Completeness Filter */}
            <div>
                <Label className="text-base font-semibold">Kelengkapan Data</Label>
                <p className="text-xs text-muted-foreground mb-3">Filter berdasarkan kelengkapan</p>
                <div className="space-y-2">
                    {completenessOptions.map(option => (
                        <div key={option.value} className="flex items-center space-x-2">
                            <Checkbox
                                id={`complete-${option.value}`}
                                checked={filterConfig.completeness === option.value}
                                onCheckedChange={() => handleCompletenessChange(option.value as FilterConfig['completeness'])}
                            />
                            <label
                                htmlFor={`complete-${option.value}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                                {option.label}
                            </label>
                        </div>
                    ))}
                </div>
            </div>

            {/* Clear All Button */}
            {activeFilterCount > 0 && (
                <>
                    <Separator />
                    <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={handleClearAll}
                        className="w-full"
                    >
                        <X className="w-4 h-4 mr-2" />
                        Hapus Semua Filter
                    </Button>
                </>
            )}
        </div>
    );

    return (
        <>
            {/* Desktop: Popover */}
            <div className="hidden md:block">
                <Popover open={isOpen} onOpenChange={setIsOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="gap-2">
                            <Filter className="w-4 h-4" />
                            Filter
                            {activeFilterCount > 0 && (
                                <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
                                    {activeFilterCount}
                                </Badge>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 max-h-[600px] overflow-y-auto" align="start">
                        <div className="space-y-4">
                            <div>
                                <h4 className="font-semibold">Filter Anggota</h4>
                                <p className="text-xs text-muted-foreground">Sesuaikan tampilan data</p>
                            </div>
                            <Separator />
                            <FilterContent />
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

            {/* Mobile: Sheet */}
            <div className="md:hidden">
                <Sheet open={isOpen} onOpenChange={setIsOpen}>
                    <SheetTrigger asChild>
                        <Button variant="outline" className="h-11 w-full gap-2 sm:w-auto">
                            <Filter className="w-4 h-4" />
                            Filter
                            {activeFilterCount > 0 && (
                                <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
                                    {activeFilterCount}
                                </Badge>
                            )}
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="max-h-[85vh] rounded-t-3xl overflow-y-auto px-4 pb-8">
                        <SheetHeader>
                            <SheetTitle>Filter Anggota</SheetTitle>
                            <SheetDescription>Sesuaikan tampilan data anggota keluarga</SheetDescription>
                        </SheetHeader>
                        <div className="mt-6">
                            <FilterContent />
                        </div>
                    </SheetContent>
                </Sheet>
            </div>
        </>
    );
}
