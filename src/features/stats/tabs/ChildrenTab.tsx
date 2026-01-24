import { useFamilyStore } from '@/store/familyStore';
import { calculateChildrenStats } from '../utils/statsCalculations';
import { VerticalBarChart } from '../components/VerticalBarChart';
import { StatCard } from '../components/StatCard';
import { Baby, Users, Trophy } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User } from 'lucide-react';

export function ChildrenTab() {
  const { persons, relationships } = useFamilyStore();
  const stats = calculateChildrenStats(persons, relationships);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Total Anak"
          value={stats.totalChildren}
          subtitle="Relasi orang tua-anak"
          icon={Baby}
        />
        <StatCard
          title="Rata-rata per Keluarga"
          value={stats.avgChildren}
          subtitle="Anak per keluarga"
          icon={Users}
        />
        <StatCard
          title="Anak Terbanyak"
          value={stats.topFamilies[0]?.childCount || 0}
          subtitle="Dalam satu keluarga"
          icon={Trophy}
        />
      </div>

      {/* Distribution Chart */}
      <VerticalBarChart
        data={stats.distribution.map(d => ({ name: `${d.count} anak`, value: d.families }))}
        title="Distribusi Jumlah Anak per Keluarga"
        color="hsl(var(--chart-1))"
        height={300}
      />

      {/* Top Families */}
      <div className="bg-card rounded-xl p-5 border border-border">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">Keluarga dengan Anak Terbanyak</h3>
        {stats.topFamilies.length === 0 ? (
          <p className="text-muted-foreground text-sm">Tidak ada data relasi orang tua-anak</p>
        ) : (
          <div className="space-y-4">
            {stats.topFamilies.map((family, index) => (
              <div key={index} className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
                <span className="text-lg font-bold text-primary w-6">{index + 1}</span>
                <div className="flex items-center gap-2 flex-1">
                  <div className="flex -space-x-2">
                    {family.parents.slice(0, 2).map((person) => (
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
                      {family.parents.map(p => p.fullName).join(' & ')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-primary">{family.childCount}</p>
                  <p className="text-xs text-muted-foreground">anak</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
