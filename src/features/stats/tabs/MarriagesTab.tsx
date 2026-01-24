import { useFamilyStore } from '@/store/familyStore';
import { calculateMarriageStats } from '../utils/statsCalculations';
import { HorizontalBarChart } from '../components/HorizontalBarChart';
import { StatCard } from '../components/StatCard';
import { Heart, Clock, Trophy } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User } from 'lucide-react';

export function MarriagesTab() {
  const { persons, relationships } = useFamilyStore();
  const stats = calculateMarriageStats(persons, relationships);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Total Pernikahan"
          value={stats.totalMarriages}
          subtitle="Pernikahan tercatat"
          icon={Heart}
        />
        <StatCard
          title="Rata-rata Durasi"
          value={`${stats.avgDuration} tahun`}
          subtitle="Lama pernikahan"
          icon={Clock}
        />
        <StatCard
          title="Pernikahan Terlama"
          value={stats.longestMarriages[0]?.duration ? `${stats.longestMarriages[0].duration} tahun` : '-'}
          subtitle="Rekor keluarga"
          icon={Trophy}
        />
      </div>

      {/* Marriages by Decade */}
      <HorizontalBarChart
        data={stats.marriagesByDecade.map(d => ({ name: d.decade, value: d.count }))}
        title="Pernikahan per Dekade"
        color="hsl(var(--chart-1))"
        showAllBars
      />

      {/* Longest Marriages */}
      <div className="bg-card rounded-xl p-5 border border-border">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">Pernikahan Terlama</h3>
        {stats.longestMarriages.length === 0 ? (
          <p className="text-muted-foreground text-sm">Tidak ada data pernikahan dengan tanggal</p>
        ) : (
          <div className="space-y-4">
            {stats.longestMarriages.map((marriage, index) => (
              <div key={index} className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
                <span className="text-lg font-bold text-primary w-6">{index + 1}</span>
                <div className="flex items-center gap-2 flex-1">
                  <div className="flex -space-x-2">
                    {marriage.persons.map((person) => (
                      <Avatar key={person.id} className="h-10 w-10 border-2 border-background">
                        <AvatarImage src={person.photoUrl || undefined} alt={person.fullName} />
                        <AvatarFallback className="bg-muted">
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                  <div className="ml-2">
                    <p className="text-sm font-medium">
                      {marriage.persons.map(p => p.fullName).join(' & ')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Sejak {new Date(marriage.startDate).getFullYear()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-primary">{marriage.duration}</p>
                  <p className="text-xs text-muted-foreground">tahun</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
