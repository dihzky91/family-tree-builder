import { useEffect, useRef } from 'react';
import { createChart } from 'family-chart';
import type { Person, Relationship } from '@/types';
import { transformToFamilyChartData, findRootPerson } from '../utils/dataTransformer';
import { cn } from '@/lib/utils';

interface FamilyChartCanvasProps {
  persons: Person[];
  relationships: Relationship[];
  selectedPersonId: string | null;
  onSelectPerson: (id: string) => void;
  className?: string;
}

export function FamilyChartCanvas({
  persons,
  relationships,
  selectedPersonId,
  onSelectPerson,
  className,
}: FamilyChartCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const initializedRef = useRef(false);

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current || persons.length === 0) return;

    // Transform data to family-chart format
    const chartData = transformToFamilyChartData(persons, relationships);
    
    // Find main person (selected or root ancestor)
    const mainId = selectedPersonId || findRootPerson(persons, relationships) || chartData[0]?.id;

    // If chart doesn't exist, create it
    if (!chartRef.current && !initializedRef.current) {
      initializedRef.current = true;

      try {
        // Create chart with data (type assertion needed due to library types)
        chartRef.current = createChart(containerRef.current, chartData as any);

        // Configure spacing (increased for better layout)
        chartRef.current.setCardXSpacing(60);
        chartRef.current.setCardYSpacing(120);
        chartRef.current.setOrientationVertical();
        chartRef.current.setTransitionTime(300);

        // Set custom HTML card template
        const cardHtml = chartRef.current.setCardHtml();
        
        // Set card dimensions on the cardHtml instance (must match CSS .fc-card)
        cardHtml.setCardDim({
          w: 200,
          h: 72,
          img_w: 48,
          img_h: 48,
          img_x: 12,
          img_y: 12,
        });
        
        // Configure card display
        cardHtml
          .setCardDisplay([
            (d: any) => `${d.data.data['first name'] || ''} ${d.data.data['last name'] || ''}`.trim() || 'Unknown',
            (d: any) => d.data.data.birthday ? new Date(d.data.data.birthday).getFullYear().toString() : '',
          ])
          .setStyle('imageCircleRect')
          .setMiniTree(true)
          .setCardImageField('avatar')
          .setOnCardClick((e: any, d: any) => {
            onSelectPerson(d.data.id);
          })
          .setCardInnerHtmlCreator((d: any) => {
            const personData = d.data.data;
            const firstName = personData['first name'] || '';
            const lastName = personData['last name'] || '';
            const fullName = `${firstName} ${lastName}`.trim();
            const gender = personData.gender === 'M' ? 'male' : 'female';
            const birthday = personData.birthday || '';
            const avatar = personData.avatar;
            const isMain = d.data.id === mainId;

            let yearDisplay = '';
            if (birthday) {
              const year = new Date(birthday).getFullYear();
              if (!isNaN(year)) yearDisplay = `${year}`;
            }

            return `
              <div class="fc-card fc-card-${gender} ${isMain ? 'fc-card-main' : ''}" data-person-id="${d.data.id}">
                <div class="fc-card-inner">
                  ${avatar 
                    ? `<img class="fc-card-avatar" src="${avatar}" alt="${fullName}" />`
                    : `<div class="fc-card-avatar fc-card-avatar-placeholder fc-card-avatar-${gender}">
                        ${firstName.charAt(0).toUpperCase() || '?'}
                      </div>`
                  }
                  <div class="fc-card-content">
                    <div class="fc-card-name" title="${fullName}">${fullName || 'Unknown'}</div>
                    ${yearDisplay ? `<div class="fc-card-year">${yearDisplay}</div>` : ''}
                  </div>
                </div>
              </div>
            `;
          });

        // Set main person and initial render
        if (mainId) {
          chartRef.current.updateMainId(mainId);
        }
        chartRef.current.updateTree({ initial: true });

      } catch (error) {
        console.error('Failed to initialize family chart:', error);
        initializedRef.current = false;
      }
    } else if (chartRef.current) {
      // Update existing chart with new data
      chartRef.current.updateData(chartData as any);
      if (mainId) {
        chartRef.current.updateMainId(mainId);
      }
      chartRef.current.updateTree({ initial: false });
    }

    return () => {
      // Cleanup on unmount
    };
  }, [persons, relationships, onSelectPerson]);

  // Update main person when selection changes
  useEffect(() => {
    if (chartRef.current && selectedPersonId) {
      chartRef.current.updateMainId(selectedPersonId);
      chartRef.current.updateTree({ initial: false });
    }
  }, [selectedPersonId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      chartRef.current = null;
      initializedRef.current = false;
    };
  }, []);

  if (persons.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Tidak ada data keluarga untuk ditampilkan</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      id="family-chart-container"
      className={cn('family-chart-container w-full h-full min-h-[600px]', className)}
    />
  );
}
