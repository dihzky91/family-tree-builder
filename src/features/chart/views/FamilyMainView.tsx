import { useEffect, useRef } from 'react'
import * as f3 from 'family-chart'
import { format, parseISO } from 'date-fns'
import { id } from 'date-fns/locale'
import type { FamilyChartDatum } from '../utils/familyChartMapper'
import 'family-chart/styles/family-chart.css'
import './family-chart.css'

interface FamilyMainViewProps {
    data: FamilyChartDatum[]
    rootId: string
    onSelectPerson: (id: string) => void
    onAddRelationship: (id: string) => void
}

const formatDate = (dateStr?: string) => {
    if (!dateStr) return null
    try {
        return format(parseISO(dateStr), 'd MMM yyyy', { locale: id })
    } catch {
        return dateStr.slice(0, 4) // fallback ke tahun saja
    }
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

        // =========================
        // CARD HTML
        // =========================
        chart.setCardHtml((d: FamilyChartDatum) => {
            const fullName =
                `${d.data['first name']} ${d.data['last name']}`.trim()

            const birthDate = formatDate(d.data.birthday)
            const deathDate = formatDate(d.data.deathday)

            let dateHtml = ''
            if (birthDate) {
                dateHtml += `<span>* ${birthDate}</span>`
            }
            if (deathDate) {
                dateHtml += ` <span class="deceased">† ${deathDate}</span>`
            }

            const hasParents =
                Array.isArray(d.rels.parents) && d.rels.parents.length === 2

            return `
        <div
          class="f3-card ${d.data.gender === 'M' ? 'male' : 'female'}"
          data-person-id="${d.id}"
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

          ${dateHtml
                    ? `<div class="f3-meta">${dateHtml}</div>`
                    : ''
                }

          <button
            class="add-member-btn"
            data-action="add"
            data-id="${d.id}"
            title="Tambah Anggota"
          >+</button>
        </div>
      `
        })

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
        const handleClick = (e: MouseEvent) => {
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

            // 3️⃣ Select person (detail panel)
            const card = target.closest('.f3-card') as HTMLElement
            if (card) {
                const id = card.dataset.personId
                if (id) {
                    onSelectPerson(id)

                    // optional focus on select
                    if (chartRef.current && id !== rootId) {
                        chartRef.current.updateMainId(id)
                        chartRef.current.updateTree({ initial: false })
                    }
                }
            }
        }

        containerRef.current.addEventListener('click', handleClick)

        return () => {
            containerRef.current?.removeEventListener('click', handleClick)
            containerRef.current!.innerHTML = ''
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
