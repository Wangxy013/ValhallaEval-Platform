import { Tooltip } from 'antd'
import type { Annotation } from '../types'

const annotationColors: Record<Annotation['type'], { bg: string; border: string }> = {
  pass: { bg: '#f6ffed', border: '#52c41a' },
  fail: { bg: '#fff2f0', border: '#ff4d4f' },
  partial: { bg: '#fffbe6', border: '#faad14' },
}

interface ValidationAnnotationsProps {
  outputContent: string;
  annotations: Annotation[];
}

interface Segment {
  text: string;
  annotation?: Annotation;
}

function buildSegments(text: string, annotations: Annotation[]): Segment[] {
  if (!annotations.length) return [{ text }]

  // Sort annotations by position in text
  const sorted = [...annotations].filter(a => a.text && text.includes(a.text))
  if (!sorted.length) return [{ text }]

  const segments: Segment[] = []
  let cursor = 0

  // Find all occurrences and build segments
  const occurrences: Array<{ start: number; end: number; annotation: Annotation }> = []
  for (const annotation of sorted) {
    let searchFrom = 0
    const idx = text.indexOf(annotation.text, searchFrom)
    if (idx !== -1) {
      occurrences.push({ start: idx, end: idx + annotation.text.length, annotation })
      searchFrom = idx + annotation.text.length
    }
  }

  occurrences.sort((a, b) => a.start - b.start)

  for (const occ of occurrences) {
    if (occ.start > cursor) {
      segments.push({ text: text.slice(cursor, occ.start) })
    }
    if (occ.start >= cursor) {
      segments.push({ text: occ.annotation.text, annotation: occ.annotation })
      cursor = occ.end
    }
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor) })
  }

  return segments
}

export default function ValidationAnnotations({ outputContent, annotations }: ValidationAnnotationsProps) {
  const segments = buildSegments(outputContent, annotations)

  return (
    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, fontFamily: 'monospace', fontSize: 13 }}>
      {segments.map((seg, i) => {
        if (!seg.annotation) {
          return <span key={i}>{seg.text}</span>
        }
        const colors = annotationColors[seg.annotation.type]
        return (
          <Tooltip key={i} title={seg.annotation.comment || seg.annotation.type}>
            <span
              style={{
                background: colors.bg,
                borderBottom: `2px solid ${colors.border}`,
                cursor: 'help',
                borderRadius: 2,
                padding: '1px 0',
              }}
            >
              {seg.text}
            </span>
          </Tooltip>
        )
      })}
    </div>
  )
}
