import { useEffect, useRef } from 'react'
import * as f3 from 'family-chart'
import type { FamilyChartDatum } from '../utils/familyChartMapper'
import 'family-chart/styles/family-chart.css'
import './family-chart.css'

interface FamilyMainViewProps {
    data: FamilyChartDatum[]
    rootId: string
    onSelectPerson: (id: string) => void
    onAddRelationship: (id: string) => void
}

export function FamilyMainView({
    data,
    rootId,
    onSelectPerson,
    onAddRelationship,
}: FamilyMainViewProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const chartRef = useRef<any>(null)

    useEffect(() => {
        if (!containerRef.current || !data.length || !rootId) return

        containerRef.current.innerHTML = ''

        const chart: any = f3.createChart(containerRef.current, data)
        chartRef.current = chart

        chart
            .setCardHtml((d: FamilyChartDatum) => {
                const fullName =
                    `${d.data['first name']} ${d.data['last name']}`.trim()

                const hasParents =
                    Array.isArray(d.rels.parents) && d.rels.parents.length > 0

                return `
        <div
          class="f3-card ${d.data.gender === 'M' ? 'male' : 'female'}"
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
        } else if (containerRef.current) {
            fallbackListener = (e: MouseEvent) => {
                const target = e.target as HTMLElement
                const card = target.closest('[data-action="select"]') as HTMLElement
                if (card?.dataset.personId) {
                    handleCardClick(e, { id: card.dataset.personId } as FamilyChartDatum)
                }
            }
            containerRef.current.addEventListener('click', fallbackListener)
        }

        return () => {
            if (fallbackListener && containerRef.current) {
                containerRef.current.removeEventListener('click', fallbackListener)
            }
            if (containerRef.current) {
                containerRef.current.innerHTML = ''
            }
        }
    }, [data, rootId, onSelectPerson, onAddRelationship])

    return (
        <div
            ref={containerRef}
            className="f3"
            style={{ width: '100%', height: '900px' }}
        />
    )
}
