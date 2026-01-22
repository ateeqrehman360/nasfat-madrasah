'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useParams, useRouter } from 'next/navigation'

type Student = {
  id: string
  first_name: string
  last_name: string | null
}

type PointRow = {
  student_id: string
  points: number
}

export default function ClassPage() {
  const { classId } = useParams<{ classId: string }>()
  const router = useRouter()

  const [students, setStudents] = useState<Student[]>([])
  const [points, setPoints] = useState<Record<string, number>>({})
  const [totals, setTotals] = useState<Record<string, number>>({})

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), [])

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 640)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const clampPoints = (n: number) => Math.max(-1, Math.min(2, n))

  useEffect(() => {
    const loadStudentsAndTotals = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')

      const { data, error } = await supabase
        .from('students')
        .select('id, first_name, last_name')
        .eq('class_id', classId)
        .order('first_name')

      if (error) {
        console.error(error)
        setLoading(false)
        return
      }

      const studentList = data ?? []
      setStudents(studentList)

      const initialPoints: Record<string, number> = {}
      studentList.forEach((s) => (initialPoints[s.id] = 0))
      setPoints(initialPoints)

      if (studentList.length > 0) {
        const ids = studentList.map((s) => s.id)
        const { data: totalsData, error: totalsErr } = await supabase
          .from('daily_points')
          .select('student_id, points')
          .in('student_id', ids)

        if (totalsErr) console.error(totalsErr)
        else {
          const rows = (totalsData ?? []) as PointRow[]
          const t: Record<string, number> = {}
          for (const row of rows) t[row.student_id] = (t[row.student_id] ?? 0) + row.points
          setTotals(t)
        }
      } else {
        setTotals({})
      }

      setLoading(false)
    }

    loadStudentsAndTotals()
  }, [classId, router])

  const handleSaveToday = async () => {
    setSaving(true)
    setSaveMsg(null)

    const rows = students.map((s) => ({
      student_id: s.id,
      date: todayISO,
      points: clampPoints(points[s.id] ?? 0),
    }))

    const { error } = await supabase
      .from('daily_points')
      .upsert(rows, { onConflict: 'student_id,date' })

    setSaving(false)

    if (error) {
      console.error(error)
      setSaveMsg(`❌ Save failed: ${error.message}`)
      return
    }

    // Re-fetch totals (simple & correct)
    const ids = students.map((s) => s.id)
    const { data: totalsData, error: totalsErr } = await supabase
      .from('daily_points')
      .select('student_id, points')
      .in('student_id', ids)

    if (!totalsErr) {
      const rows = (totalsData ?? []) as PointRow[]
      const t: Record<string, number> = {}
      for (const row of rows) t[row.student_id] = (t[row.student_id] ?? 0) + row.points
      setTotals(t)
    } else {
      console.error(totalsErr)
    }

    setSaveMsg('✅ Saved for today')
  }

  const S = styles(isMobile)

  if (loading) {
    return (
      <main style={S.page}>
        <div style={S.watermark} aria-hidden />
        <div style={S.content}>
          <div style={S.card}>Loading…</div>
        </div>
      </main>
    )
  }

  return (
    <main style={S.page}>
      <div style={S.watermark} aria-hidden />
      <div style={S.content}>
        <div style={S.header}>
          <button onClick={() => router.push('/admin')} style={S.backBtn}>← Back</button>
          <div>
            <div style={S.headerTitle}>Class</div>
            <div style={S.headerSub}>Log points for today</div>
          </div>
        </div>

        <div style={S.stickyBar}>
          <div>
            <div style={S.mutedLabel}>Today</div>
            <div style={S.todayBig}>{todayISO}</div>
            {saveMsg && <div style={S.saveMsg}>{saveMsg}</div>}
          </div>

          <button onClick={handleSaveToday} disabled={saving} style={S.saveBtn}>
            {saving ? 'Saving…' : 'Save today'}
          </button>
        </div>

        {students.length === 0 ? (
          <div style={S.card}>No students in this class.</div>
        ) : (
          <div style={S.grid}>
            {students.map((s) => {
              const name = `${s.first_name}${s.last_name ? ` ${s.last_name}` : ''}`
              return (
                <div key={s.id} style={S.studentRow}>
                  <div style={{ minWidth: 0 }}>
                    <div style={S.studentName}>{name}</div>
                    <div style={S.studentMeta}>Total: {totals[s.id] ?? 0}</div>
                  </div>

                  <div style={S.controls}>
                    <button
                      style={S.ctrlBtn}
                      onClick={() =>
                        setPoints((p) => ({ ...p, [s.id]: clampPoints((p[s.id] ?? 0) - 1) }))
                      }
                    >
                      –
                    </button>

                    <div style={S.valuePill}>{points[s.id] ?? 0}</div>

                    <button
                      style={S.ctrlBtn}
                      onClick={() =>
                        setPoints((p) => ({ ...p, [s.id]: clampPoints((p[s.id] ?? 0) + 1) }))
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}

const styles = (isMobile: boolean): Record<string, React.CSSProperties> => ({
  page: {
    position: 'relative',
    minHeight: '100vh',
    background: '#F5F7FA',
    overflow: 'hidden',
  },

  // Watermark: soft + blurred so it doesn't look messy through cards
  watermark: {
    position: 'absolute',
    inset: 0,
    backgroundImage: "url('/nasfat-logo.png')",
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center 70%',
    backgroundSize: isMobile ? '80%' : '46%',
    opacity: 0.09,
    filter: 'blur(1.5px)',      // subtle, won’t look low-quality
    transform: 'scale(1.02)',   // prevents blur edge artifacts
    pointerEvents: 'none',
    zIndex: 0,
  },

  content: {
    position: 'relative',
    zIndex: 1,
    padding: isMobile ? 14 : 24,
  },

  // HEADER: slightly translucent but still readable
  header: {
    background: 'rgba(255, 255, 255, 0.90)',
    border: '1px solid rgba(229, 231, 235, 0.75)',
    borderRadius: 16,
    padding: isMobile ? 14 : 16,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  },

  // Buttons should be SOLID (no "disabled" look)
  backBtn: {
    background: '#FFFFFF',
    border: '1px solid rgba(209, 213, 219, 1)',
    borderRadius: 12,
    padding: '10px 12px',
    fontWeight: 900,
    cursor: 'pointer',
    color: '#111827',
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: 900,
    color: '#1F3A5F',
  },

  headerSub: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B7280',
    fontWeight: 700,
  },

  // Sticky bar can stay a bit more opaque (info section)
  stickyBar: {
    marginTop: 14,
    background: 'rgba(234, 244, 251, 0.92)',
    border: '1px solid rgba(207, 230, 246, 0.95)',
    borderRadius: 16,
    padding: isMobile ? 14 : 16,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  },

  mutedLabel: {
    fontSize: 12,
    fontWeight: 900,
    color: '#1F3A5F',
    opacity: 0.75,
  },

  todayBig: {
    fontSize: 20,
    fontWeight: 900,
    color: '#1F3A5F',
    marginTop: 2,
  },

  saveMsg: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: 800,
    color: '#1F3A5F',
  },

  // Save button: SOLID + visible
  saveBtn: {
    background: '#1F3A5F',
    color: '#FFFFFF',
    border: '1px solid rgba(15, 23, 42, 0.2)',
    borderRadius: 14,
    padding: '12px 16px',
    cursor: 'pointer',
    fontWeight: 900,
    width: isMobile ? '100%' : undefined,
  },

  // Generic card (if used)
  card: {
    marginTop: 14,
    background: 'rgba(255, 255, 255, 0.86)',
    border: '1px solid rgba(229, 231, 235, 0.70)',
    borderRadius: 18,
    padding: isMobile ? 14 : 16,
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
  },

  grid: {
    marginTop: 14,
    display: 'grid',
    gap: 10,
  },

  // Student rows: MORE see-through so watermark actually shows "behind cards"
  studentRow: {
    background: 'rgba(255, 255, 255, 0.7)',
    border: '1px solid rgba(229, 231, 235, 0.68)',
    borderRadius: 18,
    padding: 14,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 14,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  },

  studentName: {
    fontSize: 16,
    fontWeight: 900,
    color: '#1F3A5F',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: isMobile ? 150 : 260,
  },

  studentMeta: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B7280',
    fontWeight: 700,
  },

  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },

  // +/- buttons: solid, with clear border + visible text
  ctrlBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    border: '1px solid rgba(209, 213, 219, 1)',
    background: '#FFFFFF',
    fontSize: 20,
    fontWeight: 900,
    cursor: 'pointer',
    color: '#111827',
  },

  // value pill can be slightly translucent but still readable
  valuePill: {
    minWidth: 54,
    textAlign: 'center' as const,
    padding: '10px 12px',
    borderRadius: 999,
    background: 'rgba(255, 255, 255, 0.88)',
    border: '1px solid rgba(229, 231, 235, 0.7)',
    fontWeight: 900,
    color: '#1F3A5F',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  },
})