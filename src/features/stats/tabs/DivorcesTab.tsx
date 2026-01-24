import { useFamilyStore } from '@/store/familyStore';
import { calculateDivorceStats } from '../utils/statsCalculations';
import { HorizontalBarChart } from '../components/HorizontalBarChart';
import { StatCard } from '../components/StatCard';
import { HeartCrack, Percent, Clock } from 'lucide-react';

export function DivorcesTab() {
  const { persons, relationships } = useFamilyStore();
  const stats = calculateDivorceStats(persons, relationships);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Total Perceraian"
          value={stats.totalDivorces}
          subtitle="Perceraian tercatat"
          icon={HeartCrack}
        />
        <StatCard
          title="Tingkat Perceraian"
          value={`${stats.divorceRate}%`}
          subtitle="Dari semua pernikahan"
          icon={Percent}
        />
        <StatCard
          title="Rata-rata Durasi"
          value={`${stats.avgDurationBeforeDivorce} tahun`}
          subtitle="Sebelum bercerai"
          icon={Clock}
        />
      </div>

      {stats.totalDivorces === 0 ? (
        <div className="bg-muted/50 rounded-xl p-8 text-center">
          <HeartCrack className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Tidak Ada Data Perceraian</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Belum ada data perceraian yang tercatat. Data ini diambil dari relasi pasangan dengan status "divorced".
          </p>
        </div>
      ) : (
        <HorizontalBarChart
          data={stats.divorcesByDecade.map(d => ({ name: d.decade, value: d.count }))}
          title="Perceraian per Dekade"
          color="hsl(var(--chart-4))"
          showAllBars
        />
      )}
    </div>
  );
}
