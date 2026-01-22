'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

type ClassRow = {
  id: string
  name: string
}

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 640)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    const init = async () => {
      setErrorMsg(null)

      const { data: { user }, error: userErr } = await supabase.auth.getUser()
      if (userErr) {
        console.error(userErr)
        setErrorMsg(userErr.message)
        setLoading(false)
        return
      }

      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profileErr) {
        console.error(profileErr)
        setErrorMsg(profileErr.message)
        setLoading(false)
        return
      }

      if (profile?.role !== 'admin') {
        router.push('/login')
        return
      }

      const { data: cls, error: clsErr } = await supabase
        .from('classes')
        .select('id, name')
        .order('name')

      if (clsErr) {
        console.error(clsErr)
        setErrorMsg('Could not load classes (check Supabase policies/grants).')
      } else {
        setClasses(cls ?? [])
      }

      setLoading(false)
    }

    init()
  }, [router])

  const S = styles(isMobile)

  return (
    <main style={S.page}>
      <div style={S.watermark} aria-hidden />

      <div style={S.content}>
        <div style={S.header}>
          <div>
            <div style={S.headerTitle}>Admin</div>
            <div style={S.headerSub}>Choose a class to log today’s points</div>
          </div>

          <button
            onClick={async () => {
              await supabase.auth.signOut()
              router.push('/login')
            }}
            style={S.logoutBtn}
          >
            Log out
          </button>
        </div>

        {loading ? (
          <div style={S.card}>Loading…</div>
        ) : (
          <>
            {errorMsg && (
              <div style={S.errorCard}>
                <b>Something went wrong:</b> {errorMsg}
              </div>
            )}

            <div style={S.card}>
              <div style={S.cardTitle}>Classes</div>
              <div style={S.cardHint}>Tap a class to open the points screen.</div>

              {classes.length === 0 ? (
                <p style={{ marginTop: 12, color: '#6B7280', fontWeight: 600 }}>
                  No classes yet. Add rows in Supabase → classes.
                </p>
              ) : (
                <div style={S.classGrid}>
                  {classes.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => router.push(`/admin/classes/${c.id}`)}
                      style={S.classRow}
                    >
                      <span style={{ fontWeight: 900 }}>{c.name}</span>
                      <span style={S.chev}>→</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
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

  // EXACT match to classId page watermark
  watermark: {
    position: 'absolute',
    inset: 0,
    backgroundImage: "url('/nasfat-logo.png')",
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center 70%',
    backgroundSize: isMobile ? '80%' : '46%',
    opacity: 0.09,
    filter: 'blur(1px)',
    transform: 'scale(1.02)',
    pointerEvents: 'none',
    zIndex: 0,
  },

  content: {
    position: 'relative',
    zIndex: 1,
    padding: isMobile ? 14 : 24,
  },

  // EXACT match to classId header
  header: {
    background: 'rgba(255, 255, 255, 0.90)',
    border: '1px solid rgba(229, 231, 235, 0.75)',
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

  headerTitle: {
    fontSize: isMobile ? 18 : 20,
    fontWeight: 900,
    color: '#1F3A5F',
    lineHeight: 1.1,
  },

  headerSub: {
    marginTop: 6,
    fontSize: 12,
    color: '#6B7280',
    fontWeight: 700,
  },

  // ✅ FIX: make logout SOLID (was transparent before)
  logoutBtn: {
    background: '#FFFFFF',
    border: '1px solid rgba(209, 213, 219, 1)',
    borderRadius: 12,
    padding: '10px 14px',
    cursor: 'pointer',
    fontWeight: 900,
    color: '#1F3A5F',
    width: isMobile ? '100%' : undefined,
  },

  // EXACT match to classId "card"
  card: {
    marginTop: 14,
    background: 'rgba(255, 255, 255, 0.7)',
    border: '1px solid rgba(229, 231, 235, 0.70)',
    borderRadius: 18,
    padding: isMobile ? 14 : 16,
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: 900,
    color: '#1F3A5F',
  },

  cardHint: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B7280',
    fontWeight: 700,
  },

  classGrid: {
    display: 'grid',
    gap: 10,
    marginTop: 14,
  },

  // ✅ FIX: make group/class rows SOLID like buttons (NOT transparent)
  // This matches your classId ctrl buttons style concept:
  classRow: {
    width: '100%',
    textAlign: 'left' as const,
    background: '#FFFFFF',
    border: '1px solid rgba(209, 213, 219, 1)',
    borderRadius: 14,
    padding: '14px 14px',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 15,
    fontWeight: 900,
    color: '#111827',
  },

  chev: {
    color: '#4DA3D9',
    fontWeight: 900,
    fontSize: 18,
  },

  errorCard: {
    marginTop: 14,
    background: 'rgba(254, 242, 242, 0.92)',
    border: '1px solid rgba(254, 202, 202, 0.9)',
    borderRadius: 16,
    padding: 14,
    color: '#991B1B',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
  },
})