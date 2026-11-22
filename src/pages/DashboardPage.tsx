import { useFamilyStore } from '@/store/familyStore';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Users,
  GitBranch,
  CheckCircle,
  AlertCircle,
  Plus,
  TrendingUp,
  Sun,
  Moon,
  CloudSun,
  Sparkles
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { StatsCardSkeletonGrid, LargeStatsCardSkeleton } from '@/components/skeletons/StatsCardSkeleton';
import { useMemo } from 'react';

export default function DashboardPage() {
  const { persons, relationships, evidence, isLoading } = useFamilyStore();

  // Greeting Logic
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 11) return { text: 'Selamat Pagi', icon: CloudSun };
    if (hour < 15) return { text: 'Selamat Siang', icon: Sun };
    if (hour < 18) return { text: 'Selamat Sore', icon: Sun };
    return { text: 'Selamat Malam', icon: Moon };
  };
  const { text: greetingText, icon: GreetingIcon } = getGreeting();

  // Random Memory (Person with Photo)
  const randomMemory = useMemo(() => {
    const withPhotos = persons.filter(p => p.photoUrl);
    if (withPhotos.length === 0) return null;
    const random = withPhotos[Math.floor(Math.random() * withPhotos.length)];
    return random;
  }, [persons]);

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
    <div className="p-4 md:p-6 lg:p-8 space-y-5 md:space-y-8 animate-fade-in">

      {/* HERO SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Welcome Card */}
        <div className="lg:col-span-2 relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/90 to-primary/70 text-primary-foreground p-5 sm:p-8 shadow-lg flex flex-col justify-center min-h-[168px] sm:min-h-[200px]">
          <div className="relative z-10">
            <div className="flex items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2 opacity-90">
              <GreetingIcon className="w-5 h-5 sm:w-6 sm:h-6" />
              <span className="font-medium text-sm sm:text-lg">{greetingText}</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-display font-bold mb-2 sm:mb-4">
              Selamat Datang Kembali
            </h1>
            <p className="text-sm sm:text-base text-primary-foreground/85 max-w-lg">
              Lanjutkan perjalanan menelusuri jejak leluhur dan merangkai kisah keluarga Anda.
            </p>
            <div className="mt-5 sm:mt-6 grid grid-cols-2 sm:flex gap-2.5 sm:gap-3">
              <Link to="/people" className="w-full sm:w-auto">
                <Button variant="secondary" className="gap-2 w-full sm:w-auto h-10">
                  <Users className="w-4 h-4" />
                  <span className="truncate">Kelola Anggota</span>
                </Button>
              </Link>
              <Link to="/chart" className="w-full sm:w-auto">
                <Button variant="outline" className="gap-2 w-full sm:w-auto h-10 bg-transparent border-primary-foreground/30 hover:bg-primary-foreground/10 text-primary-foreground">
                  <GitBranch className="w-4 h-4" />
                  <span className="truncate">Lihat Silsilah</span>
                </Button>
              </Link>
            </div>
          </div>
          {/* Decorative Pattern */}
          <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 pointer-events-none">
            <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-white fill-current">
              <path d="M44.7,-76.4C58.9,-69.2,71.8,-59.1,79.6,-46.3C87.4,-33.5,90.1,-18,88.7,-3.3C87.4,11.4,81.9,25.3,73.4,37.6C64.9,50,53.3,60.8,40.6,68.2C27.9,75.6,14,79.6,0.3,79.1C-13.4,78.6,-26.8,73.6,-38.7,66C-50.6,58.3,-61,48,-69.2,36.1C-77.4,24.2,-83.4,10.7,-81.8,-1.9C-80.1,-14.5,-70.9,-26.2,-61.6,-36.8C-52.3,-47.4,-42.9,-56.9,-32.1,-65.7C-21.3,-74.5,-9.1,-82.6,3.8,-88.7L16.7,-94.8" transform="translate(100 100)" />
            </svg>
          </div>
        </div>

        {/* Random Memory Card */}
        <div className="relative rounded-xl overflow-hidden bg-card border shadow-sm group min-h-[200px] flex flex-col">
          {randomMemory ? (
            <>
              <div className="absolute inset-0">
                <img
                  src={randomMemory.photoUrl || ''}
                  alt={randomMemory.fullName}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              </div>
              <div className="relative z-10 p-6 mt-auto text-white">
                <div className="flex items-center gap-2 mb-2 text-white/80">
                  <Sparkles className="w-4 h-4 text-yellow-300" />
                  <span className="text-xs font-medium uppercase tracking-wider">Kenangan</span>
                </div>
                <h3 className="font-semibold text-lg line-clamp-1">{randomMemory.fullName}</h3>
                <p className="text-xs text-white/70 line-clamp-1">
                  {randomMemory.birthDate ? `Lahir: ${new Date(randomMemory.birthDate).getFullYear()}` : 'Anggota Keluarga'}
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center text-muted-foreground">
              <Sparkles className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">Belum ada foto kenangan.</p>
              <Button variant="link" size="sm" asChild>
                <Link to="/people">Upload foto sekarang</Link>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      {isLoading ? (
        <StatsCardSkeletonGrid count={4} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {stats.map((stat) => (
            <Card key={stat.title} className="stat-card border-none shadow-sm hover:shadow-md transition-shadow p-4 sm:p-6">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">{stat.title}</p>
                  <p className="text-2xl sm:text-3xl font-bold mt-1 text-foreground/90">{stat.value}</p>
                </div>
                <div className={`p-2 sm:p-2.5 rounded-xl shrink-0 ${stat.bgColor}`}>
                  <stat.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${stat.color}`} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Data Completeness & Demographics */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <LargeStatsCardSkeleton />
          <LargeStatsCardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {/* Completeness Card */}
          <Card className="p-4 sm:p-6 border-none shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h2 className="font-display font-semibold text-lg">Kelengkapan Data</h2>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Skor database</span>
                  <span className="font-medium">{completeness}%</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-1000 ease-out"
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
          <Card className="p-6 border-none shadow-sm">
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
      )}
    </div>
  );
}
