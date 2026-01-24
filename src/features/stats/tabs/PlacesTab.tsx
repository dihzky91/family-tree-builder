import { useFamilyStore } from '@/store/familyStore';
import { calculatePlaceStats } from '../utils/statsCalculations';
import { HorizontalBarChart } from '../components/HorizontalBarChart';
import { StatCard } from '../components/StatCard';
import { MapPin, Home, Building } from 'lucide-react';

export function PlacesTab() {
  const { persons } = useFamilyStore();
  const stats = calculatePlaceStats(persons);

  const hasAnyPlaceData = stats.totalBirthPlaces > 0 || 
                          stats.totalDeathPlaces > 0 || 
                          stats.totalResidences > 0;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Tempat Lahir"
          value={stats.totalBirthPlaces}
          subtitle="Lokasi berbeda"
          icon={MapPin}
        />
        <StatCard
          title="Tempat Wafat"
          value={stats.totalDeathPlaces}
          subtitle="Lokasi berbeda"
          icon={Building}
        />
        <StatCard
          title="Tempat Tinggal"
          value={stats.totalResidences}
          subtitle="Lokasi berbeda"
          icon={Home}
        />
      </div>

      {!hasAnyPlaceData ? (
        <div className="bg-muted/50 rounded-xl p-8 text-center">
          <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Belum Ada Data Lokasi</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Tambahkan informasi tempat lahir, tempat wafat, atau tempat tinggal pada data anggota keluarga 
            untuk melihat statistik lokasi.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <HorizontalBarChart
            data={stats.birthPlaces.map(p => ({ name: p.place, value: p.count }))}
            title="Tempat Lahir Terbanyak"
            color="hsl(var(--chart-1))"
          />
          <HorizontalBarChart
            data={stats.deathPlaces.map(p => ({ name: p.place, value: p.count }))}
            title="Tempat Wafat Terbanyak"
            color="hsl(var(--chart-2))"
          />
          <HorizontalBarChart
            data={stats.residences.map(p => ({ name: p.place, value: p.count }))}
            title="Tempat Tinggal Terbanyak"
            color="hsl(var(--chart-3))"
          />
        </div>
      )}
    </div>
  );
}
