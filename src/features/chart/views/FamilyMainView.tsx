import { useEffect, useRef } from 'react'
import * as f3 from 'family-chart'
import type { FamilyChartDatum } from '../utils/familyChartMapper'
import type { Person } from '@/types'
import 'family-chart/styles/family-chart.css'
import './family-chart.css'

interface FamilyMainViewProps {
    data: FamilyChartDatum[]
    rootId: string
    rootPerson: Person
    onSelectPerson: (id: string) => void
    onAddRelationship: (id: string) => void
}

interface FamilyChartApi {
    setCardHtml: (render: (datum: FamilyChartDatum) => string) => FamilyChartApi
    setCardDisplay: (fields: string[][]) => FamilyChartApi
    setCardXSpacing: (value: number) => FamilyChartApi
    setCardYSpacing: (value: number) => FamilyChartApi
    updateMainId: (id: string) => void
    updateTree: (options: { initial: boolean }) => void
    setOnCardClick?: (handler: (e: MouseEvent, d: FamilyChartDatum) => void) => void
    onCardClickDefault?: (e: MouseEvent, d: FamilyChartDatum) => void
}

export function FamilyMainView({
    data,
    rootId,
    rootPerson,
    onSelectPerson,
    onAddRelationship,
}: FamilyMainViewProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const chartRef = useRef<FamilyChartApi | null>(null)

    useEffect(() => {
        const container = containerRef.current
        if (!container || !data.length || !rootId) return

        container.innerHTML = ''

        const chart = f3.createChart(container, data) as unknown as FamilyChartApi
        chartRef.current = chart

        chart
            .setCardHtml((d: FamilyChartDatum) => {
                const fullName =
                    `${d.data['first name']} ${d.data['last name']}`.trim()

                const hasParents =
                    Array.isArray(d.rels.parents) && d.rels.parents.length > 0

                return `
        <div
          class="f3-card ${d.data.gender === 'M' ? 'male' : 'female'} ${d.id === rootId ? 'is-root' : ''}"
          data-person-id="${d.id}"
          data-action="select"
          data-id="${d.id}"
        >
          ${hasParents
                        ? `
              <button
                class="mini-root-switch"
                data-action="root"
                data-id="${d.id}"
                title="Lihat silsilah orang tua"
              ></button>
              `
                        : ''
                    }

          ${d.data.avatar
                        ? `<img src="${d.data.avatar}" class="f3-avatar" />`
                        : ''
                    }

          <div class="f3-name">${fullName || '-'}</div>
          <div class="f3-meta" data-card-text></div>

          <button
            class="add-member-btn"
            data-action="add"
            data-id="${d.id}"
            title="Tambah Anggota"
          >+</button>
        </div>
      `
            })
            .setCardDisplay([['first name', 'last name'], ['birthYear', 'deathYear']])

        // =========================
        // LAYOUT
        // =========================
        chart.setCardXSpacing(220)
        chart.setCardYSpacing(140)
        chart.updateMainId(rootId)
        chart.updateTree({ initial: true })

        // =========================
        // EVENT HANDLER
        // =========================
        const handleCardClick = (e: MouseEvent, d: FamilyChartDatum) => {
            const target = e.target as HTMLElement

            // 1️⃣ Mini root switch (ancestor focus)
            const rootBtn = target.closest('[data-action="root"]') as HTMLElement
            if (rootBtn) {
                e.stopPropagation()
                const id = rootBtn.dataset.id
                if (id && chartRef.current) {
                    chartRef.current.updateMainId(id)
                    chartRef.current.updateTree({ initial: false })
                }
                return
            }

            // 2️⃣ Add relationship
            const addBtn = target.closest('[data-action="add"]') as HTMLElement
            if (addBtn) {
                e.stopPropagation()
                const id = addBtn.dataset.id
                if (id) onAddRelationship(id)
                return
            }

            // 3️⃣ Select person + default focus
            if (d?.id) {
                onSelectPerson(d.id)
                if (chartRef.current?.onCardClickDefault) {
                    chartRef.current.onCardClickDefault(e, d)
                } else if (chartRef.current && d.id !== rootId) {
                    chartRef.current.updateMainId(d.id)
                    chartRef.current.updateTree({ initial: false })
                }
            }
        }

        let fallbackListener: ((e: MouseEvent) => void) | null = null

        if (chartRef.current?.setOnCardClick) {
            chartRef.current.setOnCardClick(handleCardClick)
        } else {
            fallbackListener = (e: MouseEvent) => {
                const target = e.target as HTMLElement
                const card = target.closest('[data-action="select"]') as HTMLElement
                if (card?.dataset.personId) {
                    handleCardClick(e, { id: card.dataset.personId } as FamilyChartDatum)
                }
            }
            container.addEventListener('click', fallbackListener)
        }

        return () => {
            if (fallbackListener) {
                container.removeEventListener('click', fallbackListener)
            }
            container.innerHTML = ''
        }
    }, [data, rootId, onSelectPerson, onAddRelationship])

    return (
        <div className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Figur pusat</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-sm font-semibold text-primary">
                        {rootPerson.fullName
                            .split(/\s+/)
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((part) => part[0]?.toUpperCase())
                            .join('') || '?'}
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-foreground">{rootPerson.fullName}</p>
                        <p className="text-xs text-muted-foreground">Klik anggota lain untuk memindahkan pusat keluarga ke orang tersebut.</p>
                    </div>
                </div>
            </div>
            <div
                ref={containerRef}
                className="f3 family-stage"
                style={{ width: '100%', height: '900px' }}
            />
        </div>
    )
}
