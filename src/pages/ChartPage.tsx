import { useEffect, useRef, useState, useCallback } from 'react';
import { useFamilyStore } from '@/store/familyStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  GitBranch
} from 'lucide-react';
import type { Person } from '@/types';

type ViewMode = 'tree' | 'timeline' | 'stats';

export default function ChartPage() {
  const { persons, relationships, getChartData, getPersonRelatives, setSelectedPerson, selectedPersonId } = useFamilyStore();
  const chartRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [searchQuery, setSearchQuery] = useState('');
  const [chartInstance, setChartInstance] = useState<any>(null);
  const [scale, setScale] = useState(1);

  const selectedPerson = persons.find(p => p.id === selectedPersonId);
  const relatives = selectedPersonId ? getPersonRelatives(selectedPersonId) : null;

  // Initialize chart - simplified without family-chart due to type issues
  useEffect(() => {
    if (viewMode !== 'tree' || !chartRef.current || persons.length === 0) return;
    // Chart will be rendered via the timeline/stats views for now
  }, [persons, relationships, viewMode]);

  // Handle search/focus
  const handleSearch = useCallback(() => {
    if (!searchQuery || !chartInstance) return;
    
    const person = persons.find(p => 
      p.fullName.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    if (person) {
      setSelectedPerson(person.id);
      // Chart focus would be handled by family-chart API
    }
  }, [searchQuery, chartInstance, persons, setSelectedPerson]);

  const handleZoom = (direction: 'in' | 'out') => {
    setScale(prev => {
      const newScale = direction === 'in' ? prev * 1.2 : prev / 1.2;
      return Math.max(0.3, Math.min(2, newScale));
    });
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
              <Button
                variant={viewMode === 'tree' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('tree')}
                className="rounded-none"
              >
                <GitBranch className="w-4 h-4 mr-2" />
                Tree
              </Button>
              <Button
                variant={viewMode === 'timeline' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('timeline')}
                className="rounded-none"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Timeline
              </Button>
              <Button
                variant={viewMode === 'stats' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('stats')}
                className="rounded-none"
              >
                <Users className="w-4 h-4 mr-2" />
                Stats
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
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

            {viewMode === 'tree' && (
              <>
                <Button variant="outline" size="icon" onClick={() => handleZoom('in')}>
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => handleZoom('out')}>
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => setScale(1)}>
                  <Maximize className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto bg-muted/30">
          {persons.length === 0 ? (
            <div className="empty-state h-full">
              <GitBranch className="empty-state-icon" />
              <h3 className="text-lg font-medium mb-2">Belum ada data</h3>
              <p className="text-muted-foreground">
                Tambahkan anggota keluarga untuk melihat silsilah
              </p>
            </div>
          ) : viewMode === 'tree' ? (
            <div 
              ref={chartRef}
              className="chart-container w-full h-full"
              style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}
            />
          ) : viewMode === 'timeline' ? (
            <div className="p-6 space-y-6">
              {getTimelineData().map(({ generation, people }) => (
                <div key={generation} className="animate-slide-up">
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
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 space-y-6">
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
            </div>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      {selectedPerson && (
        <div className="w-80 border-l bg-card overflow-y-auto animate-slide-up">
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

            {/* Relatives */}
            {relatives && (
              <div className="space-y-4 pt-4 border-t">
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
        </div>
      )}
    </div>
  );
}
