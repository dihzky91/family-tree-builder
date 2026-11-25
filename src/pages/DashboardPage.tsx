import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFamilyStore } from '@/store/familyStore';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  GitBranch,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Sun,
  Moon,
  CloudSun,
  Sparkles,
  Cake,
  Clock,
  ArrowUpRight,
  RefreshCw,
  BookOpen,
  FileText,
  Inbox,
  Route,
  Calendar,
  Camera,
  StickyNote,
} from 'lucide-react';
import { StatsCardSkeletonGrid, LargeStatsCardSkeleton } from '@/components/skeletons/StatsCardSkeleton';
import { formatShortYearLabel, formatFlexibleDate } from '@/lib/flexibleDateUtils';
import { getUpcomingBirthdays } from '@/lib/birthdayUtils';
import { usePendingSubmissionCount } from '@/hooks/usePendingSubmissionCount';
import { getPersonInitials } from '@/features/people/components/PersonDetailSheet';

function formatRelativeTime(isoDate?: string | null): string {
  if (!isoDate) return '';
  const time = new Date(isoDate).getTime();
  if (Number.isNaN(time)) return '';
  const diffMs = Date.now() - time;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Baru saja';
  if (diffMins < 60) return `${diffMins} mnt lalu`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} jam lalu`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} hari lalu`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} bln lalu`;
  return `${Math.floor(diffMonths / 12)} thn lalu`;
}

export default function DashboardPage() {
  const { persons, relationships, evidence, stories, isLoading } = useFamilyStore();
  const pendingSubmissions = usePendingSubmissionCount();
  const [memorySeed, setMemorySeed] = useState(0);

  // Greeting Logic
  const { text: greetingText, icon: GreetingIcon } = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 11) return { text: 'Selamat Pagi', icon: CloudSun };
    if (hour < 15) return { text: 'Selamat Siang', icon: Sun };
    if (hour < 18) return { text: 'Selamat Sore', icon: Sun };
    return { text: 'Selamat Malam', icon: Moon };
  }, []);

  // Photos pool & interactive Random Memory
  const personsWithPhotos = useMemo(
    () => persons.filter((p) => Boolean(p.photoUrl)),
    [persons]
  );

  const currentMemory = useMemo(() => {
    if (personsWithPhotos.length === 0) return null;
    // Pick deterministic-ish start based on day, then cycle via memorySeed
    const dayOffset = new Date().getDate();
    const index = (dayOffset + memorySeed) % personsWithPhotos.length;
    return personsWithPhotos[index];
  }, [personsWithPhotos, memorySeed]);

  // Memoized Dashboard Metrics (O(N + E))
  const metrics = useMemo(() => {
    let verifiedCount = 0;
    let needsReviewCount = 0;
    let maleCount = 0;
    let femaleCount = 0;
    let livingCount = 0;
    let missingPhoto = 0;
    let missingBirthDate = 0;
    let missingNotes = 0;
    let filledFields = 0;

    for (const p of persons) {
      if (p.tags.includes('verified')) verifiedCount++;
      if (p.tags.includes('needs review')) needsReviewCount++;
      if (p.gender === 'male') maleCount++;
      if (p.gender === 'female') femaleCount++;
      if (!p.deathDate) livingCount++;

      let filled = 2; // name & gender
      if (p.birthDate) {
        filled++;
      } else {
        missingBirthDate++;
      }
      if (p.photoUrl) {
        filled++;
      } else {
        missingPhoto++;
      }
      if (p.notes) {
        filled++;
      } else {
        missingNotes++;
      }
      filledFields += filled;
    }

    const totalFields = persons.length * 5;
    const completeness = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;

    // Memoized generation depth calculation
    const parentsByChild = new Map<string, string[]>();
    for (const r of relationships) {
      if (r.type === 'PARENT_CHILD') {
        const list = parentsByChild.get(r.toPersonId);
        if (list) list.push(r.fromPersonId);
        else parentsByChild.set(r.toPersonId, [r.fromPersonId]);
      }
    }

    const genCache = new Map<string, number>();
    const visiting = new Set<string>();

    const getGen = (personId: string): number => {
      const cached = genCache.get(personId);
      if (cached !== undefined) return cached;
      if (visiting.has(personId)) return 1;

      visiting.add(personId);
      const parents = parentsByChild.get(personId);
      let gen = 1;
      if (parents && parents.length > 0) {
        let maxParentGen = 0;
        for (const pid of parents) {
          const pg = getGen(pid);
          if (pg > maxParentGen) maxParentGen = pg;
        }
        gen = maxParentGen + 1;
      }
      visiting.delete(personId);
      genCache.set(personId, gen);
      return gen;
    };

    const generations = new Set<number>();
    for (const p of persons) {
      generations.add(getGen(p.id));
    }

    return {
      verifiedCount,
      needsReviewCount,
      maleCount,
      femaleCount,
      livingCount,
      deceasedCount: persons.length - livingCount,
      missingPhoto,
      missingBirthDate,
      missingNotes,
      completeness,
      genCount: generations.size,
      verifiedPercent: persons.length > 0 ? Math.round((verifiedCount / persons.length) * 100) : 0,
      malePercent: persons.length > 0 ? Math.round((maleCount / persons.length) * 100) : 0,
      femalePercent: persons.length > 0 ? Math.round((femaleCount / persons.length) * 100) : 0,
    };
  }, [persons, relationships]);

  // Upcoming Birthdays (top 4)
  const upcomingBirthdays = useMemo(
    () => getUpcomingBirthdays(persons, 4),
    [persons]
  );

  // Recently updated/added members (top 4)
  const recentPersons = useMemo(() => {
    return [...persons]
      .sort((a, b) => {
        const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return timeB - timeA;
      })
      .slice(0, 4);
  }, [persons]);

  const stats = [
    {
      title: 'Total Anggota',
      value: persons.length,
      subtext: `${metrics.genCount} generasi tercatat`,
      to: '/people',
      icon: Users,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Relasi',
      value: relationships.length,
      subtext: 'Lihat peta silsilah',
      to: '/chart',
      icon: GitBranch,
      color: 'text-info',
      bgColor: 'bg-info/10',
    },
    {
      title: 'Terverifikasi',
      value: metrics.verifiedCount,
      subtext: `${metrics.verifiedPercent}% dari total`,
      to: '/people',
      icon: CheckCircle,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: 'Perlu Review',
      value: metrics.needsReviewCount,
      subtext: metrics.needsReviewCount > 0 ? 'Periksa kualitas data' : 'Semua data rapi',
      to: '/data-quality',
      icon: AlertCircle,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-5 md:space-y-6 animate-fade-in">
      {/* Pending Submissions Banner */}
      {pendingSubmissions > 0 && (
        <Link to="/submissions" className="block group">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm transition-colors hover:bg-warning/15">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-warning/20 text-warning shrink-0">
                <Inbox className="w-4 h-4" />
              </div>
              <p className="font-medium text-foreground truncate">
                Ada <span className="font-bold">{pendingSubmissions}</span> pengajuan data cabang keluarga yang menunggu persetujuan Anda.
              </p>
            </div>
            <span className="text-xs font-semibold text-warning shrink-0 inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              Tinjau Sekarang
              <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </Link>
      )}

      {/* HERO SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Welcome Card */}
        <div className="lg:col-span-2 relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/90 to-primary/70 text-primary-foreground p-5 sm:p-8 shadow-lg flex flex-col justify-center min-h-[168px] sm:min-h-[210px]">
          <div className="relative z-10">
            <div className="flex items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2 opacity-90">
              <GreetingIcon className="w-5 h-5 sm:w-6 sm:h-6" />
              <span className="font-medium text-sm sm:text-lg">{greetingText}</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-display font-bold mb-2 sm:mb-3">
              Selamat Datang Kembali
            </h1>
            <p className="text-sm sm:text-base text-primary-foreground/85 max-w-lg">
              Lanjutkan perjalanan menelusuri jejak leluhur dan merangkai kisah keluarga Anda.
            </p>
            <div className="mt-5 sm:mt-6 flex flex-wrap gap-2.5 sm:gap-3">
              <Link to="/people" className="flex-1 sm:flex-none">
                <Button variant="secondary" className="gap-2 w-full sm:w-auto h-10">
                  <Users className="w-4 h-4" />
                  <span className="truncate">Kelola Anggota</span>
                </Button>
              </Link>
              <Link to="/chart" className="flex-1 sm:flex-none">
                <Button
                  variant="outline"
                  className="gap-2 w-full sm:w-auto h-10 bg-transparent border-primary-foreground/30 hover:bg-primary-foreground/10 text-primary-foreground"
                >
                  <GitBranch className="w-4 h-4" />
                  <span className="truncate">Lihat Silsilah</span>
                </Button>
              </Link>
              <Link to="/relationship-check" className="hidden sm:inline-flex">
                <Button
                  variant="ghost"
                  className="gap-2 h-10 text-primary-foreground/90 hover:text-primary-foreground hover:bg-primary-foreground/10"
                >
                  <Route className="w-4 h-4" />
                  <span>Cek Hubungan</span>
                </Button>
              </Link>
            </div>
          </div>
          {/* Decorative Pattern */}
          <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 pointer-events-none">
            <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-white fill-current">
              <path
                d="M44.7,-76.4C58.9,-69.2,71.8,-59.1,79.6,-46.3C87.4,-33.5,90.1,-18,88.7,-3.3C87.4,11.4,81.9,25.3,73.4,37.6C64.9,50,53.3,60.8,40.6,68.2C27.9,75.6,14,79.6,0.3,79.1C-13.4,78.6,-26.8,73.6,-38.7,66C-50.6,58.3,-61,48,-69.2,36.1C-77.4,24.2,-83.4,10.7,-81.8,-1.9C-80.1,-14.5,-70.9,-26.2,-61.6,-36.8C-52.3,-47.4,-42.9,-56.9,-32.1,-65.7C-21.3,-74.5,-9.1,-82.6,3.8,-88.7L16.7,-94.8"
                transform="translate(100 100)"
              />
            </svg>
          </div>
        </div>

        {/* Random Memory Card (Interactive) */}
        <div className="relative rounded-xl overflow-hidden bg-card border shadow-sm group min-h-[210px] flex flex-col">
          {currentMemory ? (
            <>
              <Link
                to={`/chart?focus=${currentMemory.id}`}
                className="absolute inset-0 z-10"
                aria-label={`Lihat ${currentMemory.fullName} di silsilah`}
              />
              <div className="absolute inset-0">
                <img
                  src={currentMemory.photoUrl || ''}
                  alt={currentMemory.fullName}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/15" />
              </div>

              {personsWithPhotos.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMemorySeed((prev) => prev + 1);
                  }}
                  title="Tampilkan kenangan lain"
                  className="absolute top-3 right-3 z-20 inline-flex items-center gap-1.5 rounded-full bg-black/45 hover:bg-black/65 text-white/90 px-2.5 py-1.5 text-xs font-medium backdrop-blur-sm transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Acak</span>
                </button>
              )}

              <div className="relative z-10 p-5 mt-auto text-white pointer-events-none">
                <div className="flex items-center gap-1.5 mb-1.5 text-white/85">
                  <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Kenangan</span>
                </div>
                <div className="flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-lg leading-snug line-clamp-1 drop-shadow-sm">
                      {currentMemory.fullName}
                    </h3>
                    <p className="text-xs text-white/80 line-clamp-1 mt-0.5">
                      {currentMemory.birthDate
                        ? `Lahir: ${formatShortYearLabel(currentMemory.birthDate) || formatFlexibleDate(currentMemory.birthDate)}`
                        : 'Anggota Keluarga'}
                    </p>
                  </div>
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/15 group-hover:bg-white/25 transition-colors shrink-0">
                    <ArrowUpRight className="w-4 h-4 text-white" />
                  </span>
                </div>
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

      {/* Actionable Stats Grid */}
      {isLoading ? (
        <StatsCardSkeletonGrid count={4} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {stats.map((stat) => (
            <Link key={stat.title} to={stat.to} className="group block">
              <Card className="stat-card border-none shadow-sm hover:shadow-md transition-all duration-200 p-4 sm:p-5 h-full group-hover:-translate-y-0.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">{stat.title}</p>
                    <p className="text-2xl sm:text-3xl font-bold mt-1 text-foreground/90">{stat.value}</p>
                    <p className="text-[11px] sm:text-xs text-muted-foreground/80 mt-1.5 flex items-center gap-1 truncate">
                      <span className="truncate">{stat.subtext}</span>
                      <ArrowUpRight className="w-3 h-3 shrink-0 opacity-0 -translate-x-0.5 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                    </p>
                  </div>
                  <div className={`p-2 sm:p-2.5 rounded-xl shrink-0 ${stat.bgColor}`}>
                    <stat.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${stat.color}`} />
                  </div>
                </div>
              </Card>
            </Link>
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
          <Card className="p-4 sm:p-6 border-none shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <h2 className="font-display font-semibold text-lg">Kelengkapan Data</h2>
                </div>
                <Link
                  to="/data-quality"
                  className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
                >
                  Perbaiki Data
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Skor database</span>
                    <span className="font-semibold">{metrics.completeness}%</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${metrics.completeness}%` }}
                    />
                  </div>
                </div>

                {/* Actionable missing-data hints */}
                {persons.length > 0 && (metrics.missingPhoto > 0 || metrics.missingBirthDate > 0 || metrics.missingNotes > 0) && (
                  <div className="flex flex-wrap gap-2">
                    {metrics.missingPhoto > 0 && (
                      <Link to="/data-quality">
                        <Badge variant="secondary" className="gap-1.5 font-normal text-xs hover:bg-secondary/80">
                          <Camera className="w-3 h-3 text-muted-foreground" />
                          {metrics.missingPhoto} tanpa foto
                        </Badge>
                      </Link>
                    )}
                    {metrics.missingBirthDate > 0 && (
                      <Link to="/data-quality">
                        <Badge variant="secondary" className="gap-1.5 font-normal text-xs hover:bg-secondary/80">
                          <Calendar className="w-3 h-3 text-muted-foreground" />
                          {metrics.missingBirthDate} tanpa tgl lahir
                        </Badge>
                      </Link>
                    )}
                    {metrics.missingNotes > 0 && (
                      <Link to="/data-quality">
                        <Badge variant="secondary" className="gap-1.5 font-normal text-xs hover:bg-secondary/80">
                          <StickyNote className="w-3 h-3 text-muted-foreground" />
                          {metrics.missingNotes} tanpa catatan
                        </Badge>
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-4 mt-4 border-t">
              <div>
                <p className="text-2xl font-bold">{metrics.genCount}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Generasi</p>
              </div>
              <Link to="/evidence" className="group">
                <p className="text-2xl font-bold group-hover:text-primary transition-colors">{evidence.length}</p>
                <p className="text-xs sm:text-sm text-muted-foreground inline-flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" />
                  Dokumen
                </p>
              </Link>
              <Link to="/stories" className="group">
                <p className="text-2xl font-bold group-hover:text-primary transition-colors">{stories.length}</p>
                <p className="text-xs sm:text-sm text-muted-foreground inline-flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5" />
                  Kisah
                </p>
              </Link>
            </div>
          </Card>

          {/* Demographics Card */}
          <Card className="p-4 sm:p-6 border-none shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  <h2 className="font-display font-semibold text-lg">Demografi</h2>
                </div>
                <Link
                  to="/stats"
                  className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
                >
                  Statistik Lengkap
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Laki-laki</span>
                      <span className="font-medium text-node-male">
                        {metrics.maleCount}{' '}
                        <span className="text-xs text-muted-foreground font-normal">({metrics.malePercent}%)</span>
                      </span>
                    </div>
                    <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-node-male rounded-full transition-all duration-700"
                        style={{ width: `${metrics.malePercent}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Perempuan</span>
                      <span className="font-medium text-node-female">
                        {metrics.femaleCount}{' '}
                        <span className="text-xs text-muted-foreground font-normal">({metrics.femalePercent}%)</span>
                      </span>
                    </div>
                    <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-node-female rounded-full transition-all duration-700"
                        style={{ width: `${metrics.femalePercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 mt-4 border-t">
              <div>
                <p className="text-2xl font-bold text-success">{metrics.livingCount}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Masih hidup</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-muted-foreground">{metrics.deceasedCount}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Almarhum/ah</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Dynamic Widgets: Upcoming Birthdays & Recent Activity */}
      {!isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {/* Upcoming Birthdays Widget */}
          <Card className="p-4 sm:p-6 border-none shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <Cake className="w-5 h-5 text-primary" />
                <h2 className="font-display font-semibold text-lg">Ulang Tahun Terdekat</h2>
              </div>
              <Link
                to="/calendar"
                className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
              >
                Lihat Kalender
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {upcomingBirthdays.length > 0 ? (
              <div className="space-y-2.5">
                {upcomingBirthdays.map((item) => (
                  <Link
                    key={item.person.id}
                    to={`/chart?focus=${item.person.id}`}
                    className="flex items-center justify-between gap-3 p-2.5 -mx-2.5 rounded-lg hover:bg-muted/60 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {item.person.photoUrl ? (
                        <img
                          src={item.person.photoUrl}
                          alt={item.person.fullName}
                          className="w-9 h-9 rounded-full object-cover shrink-0 border"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-semibold text-xs flex items-center justify-center shrink-0">
                          {getPersonInitials(item.person.fullName)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                          {item.person.fullName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {formatFlexibleDate(item.person.birthDate)}
                          {item.ageOnNextBirthday !== null && !item.person.deathDate
                            ? ` • Ke-${item.ageOnNextBirthday}`
                            : ''}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={item.isToday ? 'default' : 'secondary'}
                      className="shrink-0 text-xs"
                    >
                      {item.isToday
                        ? 'Hari ini!'
                        : item.isTomorrow
                          ? 'Besok'
                          : `${item.daysUntil} hari`}
                    </Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-muted-foreground text-sm">
                <p>Belum ada tanggal lahir lengkap yang tercatat.</p>
                <Button variant="link" size="sm" asChild className="mt-1">
                  <Link to="/people">Lengkapi tanggal lahir</Link>
                </Button>
              </div>
            )}
          </Card>

          {/* Recently Updated Members Widget */}
          <Card className="p-4 sm:p-6 border-none shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                <h2 className="font-display font-semibold text-lg">Baru Diperbarui</h2>
              </div>
              <Link
                to="/people"
                className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
              >
                Semua Anggota
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {recentPersons.length > 0 ? (
              <div className="space-y-2.5">
                {recentPersons.map((person) => (
                  <Link
                    key={person.id}
                    to={`/chart?focus=${person.id}`}
                    className="flex items-center justify-between gap-3 p-2.5 -mx-2.5 rounded-lg hover:bg-muted/60 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {person.photoUrl ? (
                        <img
                          src={person.photoUrl}
                          alt={person.fullName}
                          className="w-9 h-9 rounded-full object-cover shrink-0 border"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-semibold text-xs flex items-center justify-center shrink-0">
                          {getPersonInitials(person.fullName)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                          {person.fullName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {person.birthDate
                            ? `Lahir ${formatShortYearLabel(person.birthDate) || formatFlexibleDate(person.birthDate)}`
                            : person.residence || 'Belum ada tahun lahir'}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatRelativeTime(person.updatedAt || person.createdAt)}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-muted-foreground text-sm">
                <p>Belum ada data anggota keluarga.</p>
                <Button variant="link" size="sm" asChild className="mt-1">
                  <Link to="/people">Tambah anggota pertama</Link>
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
