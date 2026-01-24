import { Person } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User } from 'lucide-react';

interface PersonListCardProps {
  title: string;
  persons: (Person & { age?: number | null })[];
  showAge?: boolean;
  emptyMessage?: string;
}

export function PersonListCard({ 
  title, 
  persons, 
  showAge = true,
  emptyMessage = 'Tidak ada data' 
}: PersonListCardProps) {
  return (
    <div className="bg-card rounded-xl p-5 border border-border">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">{title}</h3>
      {persons.length === 0 ? (
        <p className="text-muted-foreground text-sm">{emptyMessage}</p>
      ) : (
        <div className="space-y-3">
          {persons.map((person, index) => (
            <div key={person.id} className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground w-5">{index + 1}.</span>
              <Avatar className="h-8 w-8">
                <AvatarImage src={person.photoUrl || undefined} alt={person.fullName} />
                <AvatarFallback className="bg-muted">
                  <User className="h-4 w-4 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{person.fullName}</p>
                {showAge && person.age !== null && person.age !== undefined && (
                  <p className="text-xs text-muted-foreground">{person.age} tahun</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
