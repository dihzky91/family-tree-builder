import { useState, useMemo, useEffect } from 'react';
import { useFamilyStore } from '@/store/familyStore';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  History, 
  Search,
  User,
  Link2,
  FileText,
  Plus,
  Pencil,
  Trash2,
  Filter,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

const actionIcons: Record<string, typeof Plus> = {
  CREATE: Plus,
  UPDATE: Pencil,
  DELETE: Trash2,
};

const actionColors: Record<string, string> = {
  CREATE: 'bg-success/10 text-success',
  UPDATE: 'bg-info/10 text-info',
  DELETE: 'bg-destructive/10 text-destructive',
};

const entityIcons: Record<string, typeof User> = {
  PERSON: User,
  RELATIONSHIP: Link2,
  EVIDENCE: FileText,
};

export default function AuditLogPage() {
  const { auditLogs, persons } = useFamilyStore();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery, 180);
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterEntity, setFilterEntity] = useState<string>('all');
  const [visibleLimit, setVisibleLimit] = useState(40);

  useEffect(() => {
    setVisibleLimit(40);
  }, [debouncedSearch, filterAction, filterEntity]);

  const filteredLogs = useMemo(() => {
    return auditLogs
      .filter(log => {
        // Filter by action
        if (filterAction !== 'all' && log.action !== filterAction) return false;
        
        // Filter by entity type
        if (filterEntity !== 'all' && log.entityType !== filterEntity) return false;
        
        // Search in changes
        if (debouncedSearch) {
          const searchLower = debouncedSearch.toLowerCase();
          const changesStr = JSON.stringify(log.changes || {}).toLowerCase();
          const entityId = log.entityId.toLowerCase();
          
          // Search in person name if applicable
          if (log.entityType === 'PERSON') {
            const person = persons.find(p => p.id === log.entityId);
            if (person?.fullName.toLowerCase().includes(searchLower)) return true;
          }
          
          return changesStr.includes(searchLower) || entityId.includes(searchLower);
        }
        
        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [auditLogs, debouncedSearch, filterAction, filterEntity, persons]);

  const getEntityName = (entityType: string, entityId: string) => {
    if (entityType === 'PERSON') {
      const person = persons.find(p => p.id === entityId);
      return person?.fullName || 'Person tidak ditemukan';
    }
    return entityId.slice(0, 8) + '...';
  };

  const formatChanges = (changes: Record<string, unknown> | null | undefined): string[] => {
    if (!changes) return [];
    
    const formatted: string[] = [];
    for (const [key, value] of Object.entries(changes)) {
      if (key === 'id' || key === 'createdAt' || key === 'updatedAt') continue;
      
      let displayValue = value;
      if (typeof value === 'object' && value !== null) {
        displayValue = JSON.stringify(value);
      } else if (value === null || value === undefined) {
        displayValue = '(kosong)';
      }
      
      formatted.push(`${key}: ${displayValue}`);
    }
    return formatted.slice(0, 5); // Limit to 5 fields
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }),
      time: date.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit'
      })
    };
  };

  // Group visible logs by date
  const visibleLogs = useMemo(
    () => filteredLogs.slice(0, visibleLimit),
    [filteredLogs, visibleLimit]
  );

  const groupedLogs = useMemo(() => {
    const groups: Record<string, typeof visibleLogs> = {};
    
    visibleLogs.forEach(log => {
      const dateKey = new Date(log.timestamp).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(log);
    });
    
    return groups;
  }, [visibleLogs]);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-5 md:space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <History className="w-6 h-6" />
          Audit Log
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Riwayat semua perubahan data dalam sistem
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
        <div className="relative flex-1 min-w-[200px] sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Cari perubahan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 rounded-xl h-10"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger className="flex-1 sm:w-32 h-10 rounded-xl">
              <SelectValue placeholder="Aksi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Aksi</SelectItem>
              <SelectItem value="CREATE">Tambah</SelectItem>
              <SelectItem value="UPDATE">Ubah</SelectItem>
              <SelectItem value="DELETE">Hapus</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterEntity} onValueChange={setFilterEntity}>
            <SelectTrigger className="flex-1 sm:w-36 h-10 rounded-xl">
              <SelectValue placeholder="Entitas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Entitas</SelectItem>
              <SelectItem value="PERSON">Person</SelectItem>
              <SelectItem value="RELATIONSHIP">Relationship</SelectItem>
              <SelectItem value="EVIDENCE">Evidence</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-3.5 sm:p-4 rounded-2xl">
          <p className="text-xl sm:text-2xl font-bold">{auditLogs.length}</p>
          <p className="text-xs sm:text-sm text-muted-foreground">Total Log</p>
        </Card>
        <Card className="p-3.5 sm:p-4 rounded-2xl">
          <p className="text-xl sm:text-2xl font-bold text-success">
            {auditLogs.filter(l => l.action === 'CREATE').length}
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground">Data Ditambahkan</p>
        </Card>
        <Card className="p-3.5 sm:p-4 rounded-2xl">
          <p className="text-xl sm:text-2xl font-bold text-info">
            {auditLogs.filter(l => l.action === 'UPDATE').length}
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground">Data Diubah</p>
        </Card>
        <Card className="p-3.5 sm:p-4 rounded-2xl">
          <p className="text-xl sm:text-2xl font-bold text-destructive">
            {auditLogs.filter(l => l.action === 'DELETE').length}
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground">Data Dihapus</p>
        </Card>
      </div>

      {/* Log Timeline */}
      {filteredLogs.length === 0 ? (
        <Card className="p-10 sm:p-12 text-center rounded-2xl">
          <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Tidak Ada Log</h3>
          <p className="text-sm text-muted-foreground">
            {searchQuery || filterAction !== 'all' || filterEntity !== 'all'
              ? 'Coba ubah filter atau kata kunci pencarian'
              : 'Belum ada aktivitas yang tercatat'}
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedLogs).map(([date, logs]) => (
            <div key={date}>
              <h3 className="text-xs sm:text-sm font-semibold text-muted-foreground mb-3 sticky top-0 z-10 bg-background/95 py-2 border-b border-border/50">
                {date}
              </h3>
              <div className="space-y-3">
                {logs.map((log) => {
                  const ActionIcon = actionIcons[log.action] || Pencil;
                  const EntityIcon = entityIcons[log.entityType] || FileText;
                  const { time } = formatDate(log.timestamp);
                  const changes = formatChanges(log.changes);

                  return (
                    <Card
                      key={log.id}
                      style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 110px' }}
                      className="p-3.5 sm:p-4 rounded-2xl hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start gap-3 sm:gap-4">
                        {/* Action Icon */}
                        <div className={cn(
                          "w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0",
                          actionColors[log.action]
                        )}>
                          <ActionIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                            <Badge variant="outline" className={cn("text-[11px]", actionColors[log.action])}>
                              {log.action}
                            </Badge>
                            <Badge variant="outline" className="gap-1 text-[11px]">
                              <EntityIcon className="w-3 h-3" />
                              {log.entityType}
                            </Badge>
                            <span className="text-xs sm:text-sm text-muted-foreground">
                              {time}
                            </span>
                          </div>

                          <p className="font-medium text-sm sm:text-base mt-1 truncate">
                            {getEntityName(log.entityType, log.entityId)}
                          </p>

                          {/* Changes */}
                          {changes.length > 0 && (
                            <div className="mt-2 text-xs sm:text-sm text-muted-foreground bg-muted/50 rounded-xl p-2.5">
                              {changes.map((change, i) => (
                                <p key={i} className="truncate">{change}</p>
                              ))}
                              {(log.changes && Object.keys(log.changes).length > 5) && (
                                <p className="text-xs mt-1">...dan lainnya</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}

          {filteredLogs.length > visibleLimit && (
            <div className="flex justify-center pt-1">
              <Button
                variant="outline"
                onClick={() => setVisibleLimit((prev) => prev + 40)}
                className="gap-2 rounded-xl"
              >
                <ChevronDown className="w-4 h-4" />
                Tampilkan Lebih Banyak ({filteredLogs.length - visibleLimit} log lagi)
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
