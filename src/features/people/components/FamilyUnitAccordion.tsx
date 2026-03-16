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
      <AccordionItem value={family.id} className="rounded-2xl border bg-card px-0">
        <AccordionTrigger className="rounded-t-2xl px-4 py-3 hover:bg-accent/50 hover:no-underline [&[data-state=open]]:rounded-b-none">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Family Icon */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Users className="w-4 h-4" />
            </div>

            {/* Family Info */}
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="truncate text-sm font-semibold md:text-base">{family.familyName}</span>
                <Badge variant="secondary" className="h-5 shrink-0 text-[10px]">
                  Gen {family.generation}
                </Badge>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Heart className="w-3 h-3" />
                <span>{family.parents.length} orang tua</span>
                <span>•</span>
                <span>{childCount} anak</span>
              </div>
            </div>
          </div>
        </AccordionTrigger>

        <AccordionContent className="px-4 pb-4 pt-1">
          <div className="space-y-3">
            {/* Parents Section */}
            <div>
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Orang Tua
              </h4>
              <div className="space-y-1">
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
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  Anak-anak ({childCount})
                </h4>
                <div className="space-y-1">
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
