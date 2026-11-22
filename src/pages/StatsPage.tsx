import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OverviewTab } from '@/features/stats/tabs/OverviewTab';
import { RelationshipsTab } from '@/features/stats/tabs/RelationshipsTab';
import { PlacesTab } from '@/features/stats/tabs/PlacesTab';
import { AgesTab } from '@/features/stats/tabs/AgesTab';
import { BirthsTab } from '@/features/stats/tabs/BirthsTab';
import { MarriagesTab } from '@/features/stats/tabs/MarriagesTab';
import { ChildrenTab } from '@/features/stats/tabs/ChildrenTab';
import { DivorcesTab } from '@/features/stats/tabs/DivorcesTab';
import { useFamilyStore } from '@/store/familyStore';
import {
  BarChart3,
  GitBranch,
  MapPin,
  Clock,
  Baby,
  Heart,
  Users,
  HeartCrack
} from 'lucide-react';

const tabs = [
  { id: 'overview', label: 'Ringkasan', icon: BarChart3 },
  { id: 'relationships', label: 'Relasi', icon: GitBranch },
  { id: 'places', label: 'Tempat', icon: MapPin },
  { id: 'ages', label: 'Usia', icon: Clock },
  { id: 'births', label: 'Kelahiran', icon: Baby },
  { id: 'marriages', label: 'Pernikahan', icon: Heart },
  { id: 'children', label: 'Anak', icon: Users },
  { id: 'divorces', label: 'Perceraian', icon: HeartCrack },
];

export default function StatsPage() {
  const { isLoading, persons } = useFamilyStore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (persons.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-4">
        <BarChart3 className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Belum Ada Data</h2>
        <p className="text-muted-foreground max-w-md">
          Tambahkan anggota keluarga terlebih dahulu untuk melihat statistik silsilah.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-5 md:space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl sm:text-2xl font-display font-bold">Statistik Keluarga</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Analisis dan visualisasi data silsilah keluarga
        </p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex flex-nowrap sm:flex-wrap justify-start overflow-x-auto no-scrollbar h-auto w-full gap-1.5 bg-muted/50 p-1.5 mb-5 rounded-xl">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 shrink-0 rounded-lg text-xs sm:text-sm whitespace-nowrap data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <tab.icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="relationships" className="mt-0">
          <RelationshipsTab />
        </TabsContent>
        <TabsContent value="places" className="mt-0">
          <PlacesTab />
        </TabsContent>
        <TabsContent value="ages" className="mt-0">
          <AgesTab />
        </TabsContent>
        <TabsContent value="births" className="mt-0">
          <BirthsTab />
        </TabsContent>
        <TabsContent value="marriages" className="mt-0">
          <MarriagesTab />
        </TabsContent>
        <TabsContent value="children" className="mt-0">
          <ChildrenTab />
        </TabsContent>
        <TabsContent value="divorces" className="mt-0">
          <DivorcesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
