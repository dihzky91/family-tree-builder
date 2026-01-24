import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFamilyStore } from '@/store/familyStore';
import { usePanZoom } from '@/hooks/usePanZoom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize, 
  Search,
  User,
  Users,
  Heart,
  Baby,
  X,
  Calendar,
  GitBranch,
  Plus,
  Link2,
  Download,
  Network,
  TreePine,
  Printer,
  Move,
  RotateCcw
} from 'lucide-react';
import type { Person } from '@/types';
import { GenerationView } from '@/features/chart/views/GenerationView';
import { FamilyView } from '@/features/chart/views/FamilyView';
import { PedigreeView } from '@/features/chart/views/PedigreeView';
import { RelationshipForm } from '@/features/relationships/RelationshipForm';
import { RelationshipInspector } from '@/features/relationships/RelationshipInspector';
import { MiniMap } from '@/features/chart/components/MiniMap';
import { exportTreeAsImage, type ExportFormat } from '@/features/chart/utils/exportTreeAsImage';
import { PrintDialog } from '@/features/chart/components/PrintDialog';

// Animation variants
const viewTransition = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: { type: "spring" as const, stiffness: 300, damping: 30 }
};

const panelVariants = {
  hidden: { opacity: 0, x: 50 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 30 }
  },
  exit: { 
    opacity: 0, 
    x: 50,
    transition: { duration: 0.2 }
  }
};

type ViewMode = 'family' | 'pedigree' | 'tree' | 'timeline' | 'stats';

export default function ChartPage() {
  const { persons, relationships, getPersonRelatives, setSelectedPerson, selectedPersonId } = useFamilyStore();
  const [viewMode, setViewMode] = useState<ViewMode>('family');
  const [searchQuery, setSearchQuery] = useState('');
  const [pedigreeGenerations, setPedigreeGenerations] = useState(4);
  const [showAddRelationship, setShowAddRelationship] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [addRelationshipContext, setAddRelationshipContext] = useState<{
    personId?: string;
    suggestedType?: 'parent' | 'spouse' | 'child';
  }>({});
  const chartRef = useRef<HTMLDivElement>(null);
  
  // Pan and Zoom hook
  const { state: panZoomState, isDragging, handlers: panZoomHandlers, zoomIn, zoomOut, reset } = usePanZoom({
    minScale: 0.3,
    maxScale: 2,
    initialScale: 1,
  });
  const selectedPerson = persons.find(p => p.id === selectedPersonId);
  const relatives = selectedPersonId ? getPersonRelatives(selectedPersonId) : null;

  // Handle search/focus
  const handleSearch = useCallback(() => {
    if (!searchQuery) return;
    
    const person = persons.find(p => 
      p.fullName.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    if (person) {
      setSelectedPerson(person.id);
    }
  }, [searchQuery, persons, setSelectedPerson]);

  const handleZoom = (direction: 'in' | 'out') => {
    if (direction === 'in') {
      zoomIn();
    } else {
      zoomOut();
    }
  };

  const handleExport = async (format: ExportFormat) => {
    if (!chartRef.current) return;
    await exportTreeAsImage(chartRef.current, { format, filename: 'silsilah-keluarga' });
  };

  const handleAddRelationship = (personId: string, type: 'parent' | 'spouse' | 'child') => {
    setAddRelationshipContext({ personId, suggestedType: type });
    setShowAddRelationship(true);
  };

  // Calculate timeline data
  const getTimelineData = () => {
    const byGeneration: Record<number, Person[]> = {};
    
    const getGen = (personId: string, visited = new Set<string>()): number => {
      if (visited.has(personId)) return 0;
      visited.add(personId);
      
      const parentRels = relationships.filter(
        r => r.type === 'PARENT_CHILD' && r.toPersonId === personId
      );
      
      if (parentRels.length === 0) return 1;
      return Math.max(...parentRels.map(r => getGen(r.fromPersonId, visited))) + 1;
    };

    persons.forEach(p => {
      const gen = getGen(p.id);
      if (!byGeneration[gen]) byGeneration[gen] = [];
      byGeneration[gen].push(p);
    });

    return Object.entries(byGeneration)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([gen, people]) => ({ generation: Number(gen), people }));
  };

  // Calculate stats
  const getStats = () => {
    const maleCount = persons.filter(p => p.gender === 'male').length;
    const femaleCount = persons.filter(p => p.gender === 'female').length;
    const unknownCount = persons.filter(p => p.gender === 'unknown').length;
    const livingCount = persons.filter(p => !p.deathDate).length;
    const verifiedCount = persons.filter(p => p.tags.includes('verified')).length;
    
    const timeline = getTimelineData();
    
    return {
      total: persons.length,
      byGender: { male: maleCount, female: femaleCount, unknown: unknownCount },
      living: livingCount,
      deceased: persons.length - livingCount,
      verified: verifiedCount,
      generations: timeline.length,
      generationData: timeline,
    };
  };

  const viewModeOptions = [
    { value: 'family', label: 'Family', icon: Users, description: 'Fokus pada satu orang' },
    { value: 'pedigree', label: 'Pedigree', icon: TreePine, description: 'Silsilah leluhur' },
    { value: 'tree', label: 'Tree', icon: Network, description: 'Semua per generasi' },
    { value: 'timeline', label: 'Timeline', icon: Calendar, description: 'Urutan waktu' },
    { value: 'stats', label: 'Stats', icon: GitBranch, description: 'Statistik keluarga' },
  ];

  return (
    <div className="flex h-[calc(100vh-0px)] animate-fade-in">
      {/* Main Chart Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between p-4 border-b bg-card">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-display font-bold">Silsilah Keluarga</h1>
            
            {/* View Mode Toggle */}
            <div className="flex border rounded-lg overflow-hidden">
              {viewModeOptions.map(opt => {
                const Icon = opt.icon;
                return (
                  <Button
                    key={opt.value}
                    variant={viewMode === opt.value ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode(opt.value as ViewMode)}
                    className="rounded-none"
                    title={opt.description}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {opt.label}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Print Button */}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowPrintDialog(true)}
              disabled={persons.length === 0}
            >
              <Printer className="w-4 h-4 mr-2" />
              Cetak
            </Button>

            {/* Export Button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={persons.length === 0}>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover">
                <DropdownMenuItem onClick={() => handleExport('png')}>
                  Export as PNG
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('svg')}>
                  Export as SVG
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Add Relationship Button */}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setAddRelationshipContext({});
                setShowAddRelationship(true);
              }}
              disabled={persons.length < 2}
            >
              <Link2 className="w-4 h-4 mr-2" />
              Tambah Relasi
            </Button>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Cari nama..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-9 w-48"
              />
            </div>

            {/* Pedigree Generation Slider */}
            {viewMode === 'pedigree' && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50 border">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Generasi:</span>
                <input
                  type="range"
                  min={2}
                  max={6}
                  value={pedigreeGenerations}
                  onChange={(e) => setPedigreeGenerations(Number(e.target.value))}
                  className="w-20 h-1.5 accent-primary cursor-pointer"
                />
                <span className="text-sm font-medium w-4 text-center">{pedigreeGenerations}</span>
              </div>
            )}

            {(viewMode === 'tree' || viewMode === 'family' || viewMode === 'pedigree') && (
              <>
                <Button variant="outline" size="icon" onClick={() => handleZoom('in')} title="Zoom In">
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => handleZoom('out')} title="Zoom Out">
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={reset} title="Reset View">
                  <RotateCcw className="w-4 h-4" />
                </Button>
                <div className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground bg-muted/50 rounded">
                  <Move className="w-3 h-3" />
                  <span>Drag to pan</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto bg-muted/30">
          {persons.length === 0 ? (
            <motion.div 
              className="empty-state h-full"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <GitBranch className="empty-state-icon" />
              <h3 className="text-lg font-medium mb-2">Belum ada data</h3>
              <p className="text-muted-foreground">
                Tambahkan anggota keluarga untuk melihat silsilah
              </p>
            </motion.div>
          ) : (
            <div 
              className={`w-full h-full overflow-hidden ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
              {...panZoomHandlers}
            >
              <div
                ref={chartRef}
                className="w-full h-full"
                style={{ 
                  transform: `translate(${panZoomState.x}px, ${panZoomState.y}px) scale(${panZoomState.scale})`, 
                  transformOrigin: 'center center',
                  minHeight: '100%',
                  transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                }}
              >
              <AnimatePresence mode="wait">
                {viewMode === 'family' && (
                  <motion.div
                    key="family"
                    {...viewTransition}
                  >
                    <FamilyView
                      persons={persons}
                      relationships={relationships}
                      selectedPersonId={selectedPersonId}
                      onSelectPerson={setSelectedPerson}
                      onAddRelationship={handleAddRelationship}
                    />
                  </motion.div>
                )}
                {viewMode === 'pedigree' && (
                  <motion.div
                    key="pedigree"
                    {...viewTransition}
                  >
                    <PedigreeView
                      persons={persons}
                      relationships={relationships}
                      selectedPersonId={selectedPersonId}
                      onSelectPerson={setSelectedPerson}
                      onAddRelationship={(personId) => handleAddRelationship(personId, 'parent')}
                      maxGenerations={pedigreeGenerations}
                    />
                  </motion.div>
                )}
                {viewMode === 'tree' && (
                  <motion.div
                    key="tree"
                    {...viewTransition}
                  >
                    <GenerationView
                      persons={persons}
                      relationships={relationships}
                      selectedPersonId={selectedPersonId}
                      onSelectPerson={setSelectedPerson}
                    />
                  </motion.div>
                )}
                {viewMode === 'timeline' && (
                  <motion.div
                    key="timeline"
                    {...viewTransition}
                    className="p-6 space-y-6"
                  >
                    {getTimelineData().map(({ generation, people }, index) => (
                      <motion.div 
                        key={generation}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <h3 className="font-display font-semibold text-lg mb-3 flex items-center gap-2">
                          <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm">
                            {generation}
                          </span>
                          Generasi {generation}
                          <span className="text-sm font-normal text-muted-foreground">
                            ({people.length} orang)
                          </span>
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pl-10">
                          {people.map(person => (
                            <Card 
                              key={person.id} 
                              className="p-3 cursor-pointer hover:shadow-md transition-shadow"
                              onClick={() => setSelectedPerson(person.id)}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`
                                  w-10 h-10 rounded-full flex items-center justify-center shrink-0
                                  ${person.gender === 'male' ? 'bg-node-male/20 text-node-male' : 
                                    person.gender === 'female' ? 'bg-node-female/20 text-node-female' : 
                                    'bg-node-unknown/20 text-node-unknown'}
                                `}>
                                  <User className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{person.fullName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {person.birthDate ? new Date(person.birthDate).getFullYear() : '?'}
                                    {person.deathDate && ` - ${new Date(person.deathDate).getFullYear()}`}
                                  </p>
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
                {viewMode === 'stats' && (
                  <motion.div
                    key="stats"
                    {...viewTransition}
                    className="p-6 space-y-6"
                  >
                  {(() => {
                    const stats = getStats();
                    return (
                      <>
                        {/* Overview Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <Card className="stat-card">
                            <p className="text-3xl font-bold">{stats.total}</p>
                            <p className="text-sm text-muted-foreground">Total Anggota</p>
                          </Card>
                          <Card className="stat-card">
                            <p className="text-3xl font-bold">{stats.generations}</p>
                            <p className="text-sm text-muted-foreground">Generasi</p>
                          </Card>
                          <Card className="stat-card">
                            <p className="text-3xl font-bold text-success">{stats.living}</p>
                            <p className="text-sm text-muted-foreground">Masih Hidup</p>
                          </Card>
                          <Card className="stat-card">
                            <p className="text-3xl font-bold text-info">{stats.verified}</p>
                            <p className="text-sm text-muted-foreground">Terverifikasi</p>
                          </Card>
                        </div>

                        {/* Gender Distribution */}
                        <Card className="p-6">
                          <h3 className="font-display font-semibold text-lg mb-4">Distribusi Gender</h3>
                          <div className="space-y-3">
                            <div>
                              <div className="flex justify-between text-sm mb-1">
                                <span>Laki-laki</span>
                                <span className="font-medium">{stats.byGender.male}</span>
                              </div>
                              <div className="h-3 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-node-male rounded-full"
                                  style={{ width: `${(stats.byGender.male / stats.total) * 100}%` }}
                                />
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between text-sm mb-1">
                                <span>Perempuan</span>
                                <span className="font-medium">{stats.byGender.female}</span>
                              </div>
                              <div className="h-3 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-node-female rounded-full"
                                  style={{ width: `${(stats.byGender.female / stats.total) * 100}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </Card>

                        {/* Per Generation */}
                        <Card className="p-6">
                          <h3 className="font-display font-semibold text-lg mb-4">Per Generasi</h3>
                          <div className="space-y-2">
                            {stats.generationData.map(({ generation, people }) => (
                              <div key={generation} className="flex items-center gap-3">
                                <span className="w-20 text-sm text-muted-foreground">Gen {generation}</span>
                                <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-end pr-2"
                                    style={{ width: `${Math.max((people.length / Math.max(...stats.generationData.map(g => g.people.length))) * 100, 20)}%` }}
                                  >
                                    <span className="text-xs font-medium text-primary-foreground">{people.length}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </Card>
                      </>
                    );
                  })()}
                  </motion.div>
                )}
              </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      <AnimatePresence>
        {selectedPerson && (
          <motion.div 
            className="w-96 border-l bg-card overflow-y-auto"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-display font-semibold">Detail Anggota</h2>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setSelectedPerson(null)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="p-4 space-y-4">
            {/* Avatar & Name */}
            <div className="flex items-center gap-3">
              <div className={`
                w-16 h-16 rounded-full flex items-center justify-center
                ${selectedPerson.gender === 'male' ? 'bg-node-male/20 text-node-male' : 
                  selectedPerson.gender === 'female' ? 'bg-node-female/20 text-node-female' : 
                  'bg-node-unknown/20 text-node-unknown'}
              `}>
                <User className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{selectedPerson.fullName}</h3>
                <p className="text-sm text-muted-foreground capitalize">{selectedPerson.gender}</p>
              </div>
            </div>

            {/* Dates */}
            <div className="space-y-2">
              {selectedPerson.birthDate && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>Lahir: {new Date(selectedPerson.birthDate).toLocaleDateString('id-ID')}</span>
                </div>
              )}
              {selectedPerson.deathDate && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>Wafat: {new Date(selectedPerson.deathDate).toLocaleDateString('id-ID')}</span>
                </div>
              )}
            </div>

            {/* Tags */}
            {selectedPerson.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedPerson.tags.map(tag => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Notes */}
            {selectedPerson.notes && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Catatan</p>
                <p className="text-sm">{selectedPerson.notes}</p>
              </div>
            )}

            {/* Relationship Inspector */}
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Link2 className="w-4 h-4" />
                  Relasi
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAddRelationshipContext({ personId: selectedPerson.id });
                    setShowAddRelationship(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Tambah
                </Button>
              </div>
              <RelationshipInspector 
                personId={selectedPerson.id}
                onPersonClick={setSelectedPerson}
              />
            </div>

            {/* Quick Navigate */}
            {relatives && (
              <div className="space-y-4 pt-4 border-t">
                <h4 className="font-medium text-sm text-muted-foreground">Navigasi Cepat</h4>
                
                {relatives.parents.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Users className="w-4 h-4" /> Orang Tua
                    </p>
                    <div className="space-y-1">
                      {relatives.parents.map(p => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedPerson(p.id)}
                          className="w-full text-left text-sm p-2 rounded hover:bg-muted transition-colors"
                        >
                          {p.fullName}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {relatives.spouses.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Heart className="w-4 h-4" /> Pasangan
                    </p>
                    <div className="space-y-1">
                      {relatives.spouses.map(p => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedPerson(p.id)}
                          className="w-full text-left text-sm p-2 rounded hover:bg-muted transition-colors"
                        >
                          {p.fullName}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {relatives.children.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Baby className="w-4 h-4" /> Anak
                    </p>
                    <div className="space-y-1">
                      {relatives.children.map(p => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedPerson(p.id)}
                          className="w-full text-left text-sm p-2 rounded hover:bg-muted transition-colors"
                        >
                          {p.fullName}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {relatives.siblings.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Users className="w-4 h-4" /> Saudara
                    </p>
                    <div className="space-y-1">
                      {relatives.siblings.map(p => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedPerson(p.id)}
                          className="w-full text-left text-sm p-2 rounded hover:bg-muted transition-colors"
                        >
                          {p.fullName}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
        )}
      </AnimatePresence>

      {/* Add Relationship Dialog */}
      <Dialog open={showAddRelationship} onOpenChange={setShowAddRelationship}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tambah Relasi Baru</DialogTitle>
            <DialogDescription>
              Buat relasi keluarga baru antara dua anggota
            </DialogDescription>
          </DialogHeader>
          <RelationshipForm
            preselectedPersonId={addRelationshipContext.personId || selectedPersonId || undefined}
            onSuccess={() => {
              setShowAddRelationship(false);
              setAddRelationshipContext({});
            }}
            onCancel={() => {
              setShowAddRelationship(false);
              setAddRelationshipContext({});
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Print Dialog */}
      <PrintDialog
        open={showPrintDialog}
        onOpenChange={setShowPrintDialog}
        elementRef={chartRef}
        title="Silsilah Keluarga"
      />

      {/* Mini Map for navigation */}
      {(viewMode === 'family' || viewMode === 'pedigree' || viewMode === 'tree') && (
        <MiniMap
          persons={persons}
          relationships={relationships}
          selectedPersonId={selectedPersonId}
          onSelectPerson={setSelectedPerson}
        />
      )}
    </div>
  );
}
