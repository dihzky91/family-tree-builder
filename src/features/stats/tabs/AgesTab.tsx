import { useFamilyStore } from '@/store/familyStore';
import { calculateAgeStats } from '../utils/statsCalculations';
import { VerticalBarChart } from '../components/VerticalBarChart';
import { PersonListCard } from '../components/PersonListCard';
import { StatCard } from '../components/StatCard';
import { Clock, TrendingUp, TrendingDown } from 'lucide-react';

export function AgesTab() {
  const { persons } = useFamilyStore();
  const stats = calculateAgeStats(persons);

  const ageDistributionData = Object.entries(stats.ageDistribution)
    .map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      {/* Average Life Expectancy */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Rata-rata Usia (Laki-laki)"
          value={stats.avgMaleLife !== null ? `${stats.avgMaleLife} th` : '-'}
          subtitle="Berdasarkan yang wafat"
          icon={TrendingUp}
        />
        <StatCard
          title="Rata-rata Usia (Perempuan)"
          value={stats.avgFemaleLife !== null ? `${stats.avgFemaleLife} th` : '-'}
          subtitle="Berdasarkan yang wafat"
          icon={TrendingUp}
        />
        <StatCard
          title="Total Hidup"
          value={persons.filter(p => !p.deathDate).length}
          subtitle="Anggota masih hidup"
          icon={Clock}
        />
      </div>

      {/* Age Distribution Chart */}
      <VerticalBarChart
        data={ageDistributionData}
        title="Distribusi Usia (Anggota yang Masih Hidup)"
        color="hsl(var(--chart-1))"
        height={300}
      />

      {/* Person Lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <PersonListCard
          title="Tertua (Masih Hidup)"
          persons={stats.oldestLiving}
          showAge
        />
        <PersonListCard
          title="Termuda"
          persons={stats.youngestLiving}
          showAge
        />
        <PersonListCard
          title="Usia Terpanjang (Wafat)"
          persons={stats.livedMost}
          showAge
        />
        <PersonListCard
          title="Usia Terpendek (Wafat)"
          persons={stats.livedLeast}
          showAge
        />
      </div>
    </div>
  );
}
