import { useFamilyStore } from '@/store/familyStore';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Users, 
  GitBranch, 
  CheckCircle, 
  AlertCircle,
  Plus,
  TrendingUp
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function DashboardPage() {
  const { persons, relationships, evidence } = useFamilyStore();

  // Calculate stats
  const verifiedCount = persons.filter(p => p.tags.includes('verified')).length;
  const needsReviewCount = persons.filter(p => p.tags.includes('needs review')).length;
  const maleCount = persons.filter(p => p.gender === 'male').length;
  const femaleCount = persons.filter(p => p.gender === 'female').length;
  const livingCount = persons.filter(p => !p.deathDate).length;
  
  // Calculate completeness
  const totalFields = persons.length * 5; // name, gender, birthDate, photo, notes
  const filledFields = persons.reduce((acc, p) => {
    let filled = 2; // name and gender are always filled
    if (p.birthDate) filled++;
    if (p.photoUrl) filled++;
    if (p.notes) filled++;
    return acc + filled;
  }, 0);
  const completeness = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;

  // Calculate generations (simplified)
  const getGeneration = (personId: string, visited = new Set<string>()): number => {
    if (visited.has(personId)) return 0;
    visited.add(personId);
    
    const parentRels = relationships.filter(
      r => r.type === 'PARENT_CHILD' && r.toPersonId === personId
    );
    
    if (parentRels.length === 0) return 1;
    
    return Math.max(...parentRels.map(r => getGeneration(r.fromPersonId, visited))) + 1;
  };
  
  const generations = new Set(persons.map(p => getGeneration(p.id)));
  const genCount = generations.size;

  const stats = [
    {
      title: 'Total Anggota',
      value: persons.length,
      icon: Users,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Relasi',
      value: relationships.length,
      icon: GitBranch,
      color: 'text-info',
      bgColor: 'bg-info/10',
    },
    {
      title: 'Terverifikasi',
      value: verifiedCount,
      icon: CheckCircle,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: 'Perlu Review',
      value: needsReviewCount,
      icon: AlertCircle,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Ringkasan data silsilah keluarga Anda
          </p>
        </div>
        <Link to="/people">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Tambah Anggota
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="stat-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                <p className="text-3xl font-bold mt-1">{stat.value}</p>
              </div>
              <div className={`p-2.5 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Data Completeness & Demographics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Completeness Card */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="font-display font-semibold text-lg">Kelengkapan Data</h2>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Kelengkapan keseluruhan</span>
                <span className="font-medium">{completeness}%</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
                  style={{ width: `${completeness}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <p className="text-2xl font-bold">{genCount}</p>
                <p className="text-sm text-muted-foreground">Generasi</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{evidence.length}</p>
                <p className="text-sm text-muted-foreground">Dokumen</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Demographics Card */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="font-display font-semibold text-lg">Demografi</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Laki-laki</span>
                  <span className="font-medium text-node-male">{maleCount}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-node-male rounded-full"
                    style={{ width: `${persons.length ? (maleCount / persons.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Perempuan</span>
                  <span className="font-medium text-node-female">{femaleCount}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-node-female rounded-full"
                    style={{ width: `${persons.length ? (femaleCount / persons.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <p className="text-2xl font-bold text-success">{livingCount}</p>
                <p className="text-sm text-muted-foreground">Masih hidup</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-muted-foreground">{persons.length - livingCount}</p>
                <p className="text-sm text-muted-foreground">Almarhum/ah</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="p-6">
        <h2 className="font-display font-semibold text-lg mb-4">Aksi Cepat</h2>
        <div className="flex flex-wrap gap-3">
          <Link to="/people">
            <Button variant="outline" className="gap-2">
              <Users className="w-4 h-4" />
              Kelola Anggota
            </Button>
          </Link>
          <Link to="/chart">
            <Button variant="outline" className="gap-2">
              <GitBranch className="w-4 h-4" />
              Lihat Silsilah
            </Button>
          </Link>
          <Link to="/data">
            <Button variant="outline" className="gap-2">
              <Plus className="w-4 h-4" />
              Import Data
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
