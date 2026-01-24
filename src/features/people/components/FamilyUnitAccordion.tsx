import { Users, Heart } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { FamilyUnitCard } from './FamilyUnitCard';
import type { NuclearFamily, Person } from '@/types';

interface FamilyUnitAccordionProps {
  family: NuclearFamily;
  onEditPerson?: (person: Person) => void;
  defaultOpen?: boolean;
}

/**
 * Collapsible accordion for displaying a single nuclear family
 * Contains parents section and children section
 */
export function FamilyUnitAccordion({ 
  family, 
  onEditPerson,
  defaultOpen = false 
}: FamilyUnitAccordionProps) {
  const childCount = family.children.length;

  return (
    <Accordion 
      type="single" 
      collapsible 
      defaultValue={defaultOpen ? family.id : undefined}
    >
      <AccordionItem value={family.id} className="border rounded-lg bg-card">
        <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-accent/50 rounded-t-lg [&[data-state=open]]:rounded-b-none">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Family Icon */}
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            
            {/* Family Info */}
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold truncate">{family.familyName}</span>
                <Badge variant="secondary" className="text-xs shrink-0">
                  Gen {family.generation}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                <Heart className="w-3 h-3" />
                <span>{family.parents.length} orang tua</span>
                <span>•</span>
                <span>{childCount} anak</span>
              </div>
            </div>
          </div>
        </AccordionTrigger>
        
        <AccordionContent className="px-4 pb-4">
          <div className="space-y-4">
            {/* Parents Section */}
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Orang Tua
              </h4>
              <div className="space-y-2">
                {family.parents.map(parent => (
                  <FamilyUnitCard
                    key={parent.id}
                    person={parent}
                    role="parent"
                    onEdit={onEditPerson}
                  />
                ))}
              </div>
            </div>

            {/* Children Section */}
            {childCount > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Anak-anak ({childCount})
                </h4>
                <div className="space-y-2">
                  {family.children.map(child => (
                    <FamilyUnitCard
                      key={child.id}
                      person={child}
                      role="child"
                      onEdit={onEditPerson}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
