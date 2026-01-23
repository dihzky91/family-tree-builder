import { useState, useEffect, ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';
import { useFamilyStore } from '@/store/familyStore';
import { seedPersons, seedRelationships } from '@/lib/seedData';
import { v4 as uuidv4 } from 'uuid';
import { Loader2 } from 'lucide-react';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { loadData, persons, isLoading, addPerson, addRelationship } = useFamilyStore();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      await loadData();
      setInitialized(true);
    };
    initialize();
  }, [loadData]);

  // Seed data if empty
  useEffect(() => {
    const seedIfEmpty = async () => {
      if (initialized && !isLoading && persons.length === 0) {
        // Add seed persons
        const now = new Date().toISOString();
        for (const personData of seedPersons) {
          await addPerson({
            ...personData,
            createdAt: now,
            updatedAt: now,
          } as any);
        }

        // Add seed relationships
        for (const relData of seedRelationships) {
          await addRelationship({
            ...relData,
          } as any);
        }
      }
    };
    seedIfEmpty();
  }, [initialized, isLoading, persons.length, addPerson, addRelationship]);

  if (!initialized || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Memuat data keluarga...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar 
        collapsed={sidebarCollapsed} 
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
      />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
