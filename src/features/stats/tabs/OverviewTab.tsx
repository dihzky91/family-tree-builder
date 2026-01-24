import { useFamilyStore } from '@/store/familyStore';
import { calculateOverviewStats } from '../utils/statsCalculations';
import { DonutChart } from '../components/DonutChart';
import { StatCard } from '../components/StatCard';
import { Users } from 'lucide-react';

export function OverviewTab() {
  const { persons, relationships } = useFamilyStore();
  const stats = calculateOverviewStats(persons, relationships);

  const genderData = [
    { name: 'Laki-laki', value: stats.genderStats.male, color: 'hsl(var(--chart-1))' },
    { name: 'Perempuan', value: stats.genderStats.female, color: 'hsl(var(--chart-2))' },
    { name: 'Unknown', value: stats.genderStats.unknown, color: 'hsl(var(--muted))' },
  ].filter(d => d.value > 0);

  const livingData = [
    { name: 'Hidup', value: stats.livingStats.living, color: 'hsl(var(--chart-3))' },
    { name: 'Wafat', value: stats.livingStats.deceased, color: 'hsl(var(--chart-4))' },
  ];

  const statusData = [
    { name: 'Menikah', value: stats.relationshipStatus.married, color: 'hsl(var(--chart-1))' },
    { name: 'Lajang', value: stats.relationshipStatus.single, color: 'hsl(var(--chart-2))' },
    { name: 'Janda/Duda', value: stats.relationshipStatus.widowed, color: 'hsl(var(--chart-3))' },
    { name: 'Cerai', value: stats.relationshipStatus.divorced, color: 'hsl(var(--chart-4))' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Total Members */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Total Anggota Keluarga"
          value={stats.total}
          subtitle="Orang dalam silsilah"
          icon={Users}
        />
        <StatCard
          title="Masih Hidup"
          value={stats.livingStats.living}
          subtitle={`${((stats.livingStats.living / stats.total) * 100).toFixed(1)}% dari total`}
        />
        <StatCard
          title="Telah Wafat"
          value={stats.livingStats.deceased}
          subtitle={`${((stats.livingStats.deceased / stats.total) * 100).toFixed(1)}% dari total`}
        />
      </div>

      {/* Donut Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DonutChart data={genderData} title="Jenis Kelamin" />
        <DonutChart data={livingData} title="Status Kehidupan" />
        <DonutChart data={statusData} title="Status Hubungan" />
      </div>

      {/* Common Names */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl p-5 border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Nama Belakang Populer</h3>
          <div className="flex flex-wrap gap-2">
            {stats.commonLastNames.length === 0 ? (
              <p className="text-muted-foreground text-sm">Tidak ada data</p>
            ) : (
              stats.commonLastNames.map(([name, count]) => (
                <span
                  key={name}
                  className="px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium"
                  style={{ fontSize: `${Math.min(16, 12 + count)}px` }}
                >
                  {name} ({count})
                </span>
              ))
            )}
          </div>
        </div>

        <div className="bg-card rounded-xl p-5 border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Nama Depan Laki-laki</h3>
          <div className="flex flex-wrap gap-2">
            {stats.commonFirstNamesMale.length === 0 ? (
              <p className="text-muted-foreground text-sm">Tidak ada data</p>
            ) : (
              stats.commonFirstNamesMale.map(([name, count]) => (
                <span
                  key={name}
                  className="px-3 py-1.5 bg-chart-1/20 text-chart-1 rounded-full text-sm font-medium"
                  style={{ fontSize: `${Math.min(16, 12 + count)}px` }}
                >
                  {name} ({count})
                </span>
              ))
            )}
          </div>
        </div>

        <div className="bg-card rounded-xl p-5 border border-border">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Nama Depan Perempuan</h3>
          <div className="flex flex-wrap gap-2">
            {stats.commonFirstNamesFemale.length === 0 ? (
              <p className="text-muted-foreground text-sm">Tidak ada data</p>
            ) : (
              stats.commonFirstNamesFemale.map(([name, count]) => (
                <span
                  key={name}
                  className="px-3 py-1.5 bg-chart-2/20 text-chart-2 rounded-full text-sm font-medium"
                  style={{ fontSize: `${Math.min(16, 12 + count)}px` }}
                >
                  {name} ({count})
                </span>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
