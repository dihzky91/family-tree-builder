import { useState, useEffect, ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';
import { useFamilyStore } from '@/store/familyStore';
import { seedPersons, seedRelationships } from '@/lib/seedData';
import { v4 as uuidv4 } from 'uuid';
import { Loader2 } from 'lucide-react';
import { storage } from '@/storage';
import type { Person, Relationship } from '@/types';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { loadData, persons, isLoading } = useFamilyStore();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      await loadData();
      setInitialized(true);
    };
    initialize();
  }, [loadData]);

  // Seed data if empty - directly to storage to preserve IDs
  useEffect(() => {
    const seedIfEmpty = async () => {
      if (initialized && !isLoading && persons.length === 0) {
        const now = new Date().toISOString();
        
        // Create persons with their original seed IDs
        const personsToAdd: Person[] = seedPersons.map(p => ({
          ...p,
          id: p.id, // Keep original ID
          tags: p.tags || [],
          confidenceScore: p.confidenceScore ?? 50,
          createdAt: now,
          updatedAt: now,
        }));

        // Create relationships with generated IDs but keep person IDs
        const relationshipsToAdd: Relationship[] = seedRelationships.map(r => ({
          ...r,
          id: uuidv4(),
          meta: r.meta || {},
          createdAt: now,
          updatedAt: now,
        }));

        // Bulk import to storage
        await storage.importData(personsToAdd, relationshipsToAdd, []);
        
        // Reload data
        await loadData();
      }
    };
    seedIfEmpty();
  }, [initialized, isLoading, persons.length, loadData]);

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
