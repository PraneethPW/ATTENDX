import { Canvas, useFrame } from '@react-three/fiber'
import { Float, OrbitControls } from '@react-three/drei'
import axios from 'axios'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  BarChart3,
  BookOpen,
  Building2,
  CalendarCheck,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  FileUp,
  Fingerprint,
  Layers3,
  LayoutDashboard,
  Loader2,
  LockKeyhole,
  LogOut,
  MapPin,
  Menu,
  Plus,
  QrCode,
  RadioTower,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
  Zap,
} from 'lucide-react'
import { createContext, Suspense, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import type { FormEvent, ReactNode } from 'react'
import type { Mesh } from 'three'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:4000'

type Role = 'student' | 'faculty' | 'admin'
type User = { id: string; name?: string; email: string; role: Role; department?: string }
type Course = { id: string; title: string; code: string; room: string; facultyName?: string; latitude: number; longitude: number; radiusMeters: number }
type Session = { id: string; courseId: string; qrToken: string; qrDataUrl: string; expiresAt: string; active: boolean }
type AttendanceRecord = { id: string; courseId: string; studentName: string; status: string; riskScore: number; distanceMeters: number; createdAt: string }
type Assignment = { id: string; title: string; fileName: string; status: string; createdAt: string }
type Analytics = { metrics: { attendanceRate: number; liveSessions: number; uploadedAssignments: number; securityFlags: number }; attendance: AttendanceRecord[]; assignments: Assignment[]; auditLogs: { id: string; action: string; createdAt: string }[] }

const api = axios.create({ baseURL: API_URL })

const AuthContext = createContext<{
  user: User | null
  token: string
  login: (email: string, password: string) => Promise<void>
  register: (payload: { name: string; email: string; password: string; role: Role; department: string }) => Promise<void>
  logout: () => void
} | null>(null)

function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('Auth provider missing')
  return value
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(localStorage.getItem('attendx-token') || '')
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem('attendx-user')
    return raw ? JSON.parse(raw) : null
  })

  useEffect(() => {
    api.defaults.headers.common.Authorization = token ? `Bearer ${token}` : ''
  }, [token])

  async function login(email: string, password: string) {
    const { data } = await api.post('/api/auth/login', { email, password })
    setToken(data.token)
    setUser(data.user)
    localStorage.setItem('attendx-token', data.token)
    localStorage.setItem('attendx-user', JSON.stringify(data.user))
  }

  async function register(payload: { name: string; email: string; password: string; role: Role; department: string }) {
    const { data } = await api.post('/api/auth/register', payload)
    setToken(data.token)
    setUser(data.user)
    localStorage.setItem('attendx-token', data.token)
    localStorage.setItem('attendx-user', JSON.stringify(data.user))
  }

  function logout() {
    setToken('')
    setUser(null)
    localStorage.removeItem('attendx-token')
    localStorage.removeItem('attendx-user')
  }

  return <AuthContext.Provider value={{ user, token, login, register, logout }}>{children}</AuthContext.Provider>
}

function useApiData<T>(path: string, fallback: T, deps: unknown[] = []) {
  const { token } = useAuth()
  const [data, setData] = useState<T>(fallback)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    let active = true
    setLoading(true)
    api.get(path)
      .then((res) => active && setData(res.data))
      .catch((err) => active && setError(err.response?.data?.message || 'Could not load data.'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [path, token, ...deps])

  return { data, setData, loading, error }
}

function QRScene() {
  const group = useRef<Mesh>(null)
  useFrame(({ clock }) => {
    if (!group.current) return
    group.current.rotation.y = Math.sin(clock.elapsedTime * 0.7) * 0.45
    group.current.rotation.x = Math.cos(clock.elapsedTime * 0.5) * 0.14
  })
  const cells = useMemo(() => Array.from({ length: 64 }, (_, i) => (i * 11 + 5) % 7 < 4), [])
  return (
    <group ref={group}>
      <mesh>
        <boxGeometry args={[3.2, 3.2, 0.18]} />
        <meshStandardMaterial color="#fbfbf8" metalness={0.2} roughness={0.18} />
      </mesh>
      {cells.map((active, index) => active && (
        <mesh key={index} position={[(index % 8) * 0.32 - 1.12, Math.floor(index / 8) * 0.32 - 1.12, 0.14]}>
          <boxGeometry args={[0.22, 0.22, 0.09]} />
          <meshStandardMaterial color={index % 5 === 0 ? '#00d3b0' : '#171717'} emissive={index % 5 === 0 ? '#00d3b0' : '#000'} emissiveIntensity={0.15} />
        </mesh>
      ))}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.35, 0.018, 24, 110]} />
        <meshStandardMaterial color="#f4c430" emissive="#f4c430" emissiveIntensity={0.55} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.8, 0.012, 24, 120]} />
        <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.5} />
      </mesh>
    </group>
  )
}

function Hero3D() {
  return (
    <Canvas camera={{ position: [0, 1, 6], fov: 42 }}>
      <ambientLight intensity={0.7} />
      <pointLight position={[2.5, 3, 3]} intensity={2.7} color="#67e8f9" />
      <pointLight position={[-3, -2, 3]} intensity={2} color="#fbbf24" />
      <Suspense fallback={null}>
        <Float speed={1.7} floatIntensity={0.7} rotationIntensity={0.4}>
          <QRScene />
        </Float>
      </Suspense>
      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.5} />
    </Canvas>
  )
}

function PublicShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const { user } = useAuth()
  const nav = [
    ['Product', '/'],
    ['Security', '/security'],
    ['Pricing', '/pricing'],
  ]
  return (
    <div className="min-h-screen bg-[#f7f4ed] text-neutral-950">
      <header className="sticky top-0 z-50 border-b border-neutral-950/10 bg-[#f7f4ed]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-neutral-950 text-[#f4c430]"><Fingerprint size={22} /></span>
            <span className="text-xl font-black">AttendX</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map(([label, path]) => <NavLink key={path} to={path} className={({ isActive }) => `rounded-lg px-4 py-2 text-sm font-bold ${isActive ? 'bg-neutral-950 text-white' : 'text-neutral-600 hover:bg-white'}`}>{label}</NavLink>)}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            <Link to={user ? '/app' : '/login'} className="rounded-lg bg-neutral-950 px-4 py-2 text-sm font-black text-white">{user ? 'Open app' : 'Login'}</Link>
            <Link to="/signup" className="rounded-lg bg-[#f4c430] px-4 py-2 text-sm font-black text-neutral-950">Create account</Link>
          </div>
          <button className="rounded-lg border border-neutral-950/20 p-2 md:hidden" onClick={() => setOpen((v) => !v)}>{open ? <X /> : <Menu />}</button>
        </div>
        {open && (
          <div className="border-t border-neutral-950/10 px-4 pb-4 md:hidden">
            {nav.map(([label, path]) => <Link key={path} to={path} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-3 font-bold">{label}</Link>)}
            <Link to={user ? '/app' : '/login'} className="mt-2 block rounded-lg bg-neutral-950 px-4 py-3 text-center font-black text-white">{user ? 'Open app' : 'Login'}</Link>
          </div>
        )}
      </header>
      {children}
    </div>
  )
}

function Landing() {
  return (
    <PublicShell>
      <main>
        <section className="relative overflow-hidden border-b border-neutral-950/10 bg-[linear-gradient(135deg,#f7f4ed_0%,#fff9df_42%,#e9fbf8_100%)]">
          <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(#111_1px,transparent_1px),linear-gradient(90deg,#111_1px,transparent_1px)] [background-size:42px_42px]" />
          <div className="relative mx-auto grid min-h-[calc(100vh-74px)] max-w-7xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_.95fr] lg:px-8">
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-lg border border-neutral-950/10 bg-white/90 px-3 py-2 text-sm font-black shadow-sm backdrop-blur">
                <Sparkles size={16} className="text-teal-600" /> Built for live academic operations
              </div>
              <h1 className="text-5xl font-black leading-[1.02] tracking-normal text-neutral-950 sm:text-6xl lg:text-7xl">Attendance that students cannot fake and faculty do not have to chase.</h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-neutral-650">AttendX combines encrypted rotating QR codes, GPS geofencing, live faculty verification, secure submissions, audit logs, and AI risk summaries in one serious academic operating system.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/signup" className="inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-950 px-5 py-3 font-black text-white shadow-xl shadow-neutral-950/15">Start free <ArrowRight size={18} /></Link>
                <Link to="/login" className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-950/15 bg-white px-5 py-3 font-black text-neutral-950">Use demo accounts</Link>
              </div>
              <div className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[['90s', 'QR expiry'], ['GPS', 'Haversine validation'], ['Live', 'Socket sync'], ['AI', 'OpenRouter-ready']].map(([value, label]) => (
                  <div key={label} className="rounded-lg border border-neutral-950/10 bg-white/90 p-4 shadow-sm backdrop-blur">
                    <div className="text-2xl font-black">{value}</div>
                    <div className="mt-1 text-xs font-bold uppercase text-neutral-500">{label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {['SIS portal', 'QR engine', 'Risk desk'].map((item, index) => (
                  <div key={item} className="rounded-lg border border-neutral-950/10 bg-neutral-950 p-4 text-white shadow-xl shadow-neutral-950/10">
                    <div className={`mb-4 h-2 w-16 rounded-full ${index === 0 ? 'bg-[#f4c430]' : index === 1 ? 'bg-teal-400' : 'bg-rose-400'}`} />
                    <p className="font-black">{item}</p>
                    <p className="mt-1 text-xs font-bold text-neutral-400">{['Student and faculty role views', 'Rotating encrypted sessions', 'Flags spoofing and proxy risk'][index]}</p>
                  </div>
                ))}
              </div>
            </motion.div>
            <div className="relative h-[500px] overflow-hidden rounded-lg border border-neutral-950/10 bg-neutral-950 shadow-2xl shadow-neutral-950/20 lg:h-[640px]">
              <Hero3D />
              <div className="absolute left-4 top-4 w-[min(330px,calc(100%-32px))] rounded-lg border border-white/10 bg-white/10 p-4 text-white backdrop-blur">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-neutral-300">Live session</p>
                  <span className="rounded-lg bg-teal-300 px-2 py-1 text-xs font-black text-neutral-950">ACTIVE</span>
                </div>
                <p className="mt-3 text-2xl font-black">CSE-402 ML Lab</p>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-black">
                  <span className="rounded-lg bg-white/10 p-2">73 present</span>
                  <span className="rounded-lg bg-white/10 p-2">2 flagged</span>
                  <span className="rounded-lg bg-white/10 p-2">28s QR</span>
                </div>
              </div>
              <div className="absolute bottom-4 left-4 right-4 grid gap-3 rounded-lg border border-white/10 bg-white/10 p-4 text-white backdrop-blur md:grid-cols-3">
                {['QR encrypted', 'Geo verified', 'Audit logged'].map((item) => <div key={item} className="flex items-center gap-2 text-sm font-bold"><CheckCircle2 size={16} className="text-[#f4c430]" /> {item}</div>)}
              </div>
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
            <div>
              <p className="text-sm font-black uppercase text-teal-700">The AttendX stack</p>
              <h2 className="mt-3 text-4xl font-black leading-tight sm:text-5xl">One product layer for every attendance moment.</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {[
                [QrCode, 'Rotating QR sessions', 'Faculty generates encrypted short-lived QR codes for each class session.', 'bg-[#f4c430]'],
                [MapPin, 'Geofence validation', 'Location is verified with Haversine distance before attendance is accepted.', 'bg-teal-300'],
                [ShieldCheck, 'Security checks', 'JWT roles, rate limits, session validation, and audit logs keep attempts traceable.', 'bg-rose-300'],
                [LayoutDashboard, 'SIS portals', 'Separate student and faculty portals keep workflows clear and role-specific.', 'bg-sky-300'],
              ].map(([Icon, title, text, tone]) => (
                <article key={String(title)} className="group rounded-lg border border-neutral-950/10 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                  <div className={`grid h-12 w-12 place-items-center rounded-lg ${tone as string} text-neutral-950`}><Icon size={24} /></div>
                  <h3 className="mt-5 text-xl font-black">{title as string}</h3>
                  <p className="mt-3 leading-7 text-neutral-600">{text as string}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="border-y border-neutral-950/10 bg-neutral-950 text-white">
          <div className="mx-auto grid max-w-7xl gap-5 px-4 py-14 sm:px-6 lg:grid-cols-3 lg:px-8">
            {[
              ['Student SIS', 'Timetable, attendance status, assignments, academic record, profile, and submissions.'],
              ['Faculty SIS', 'Course operations, QR sessions, class roster, review queue, analytics, and audit history.'],
              ['AI operations', 'OpenRouter-ready insights for attendance risk, engagement patterns, and intervention notes.'],
            ].map(([title, text], index) => (
              <div key={title} className="rounded-lg border border-white/10 bg-white/[0.06] p-6">
                <div className={`mb-8 h-1.5 w-24 rounded-full ${index === 0 ? 'bg-teal-300' : index === 1 ? 'bg-[#f4c430]' : 'bg-rose-300'}`} />
                <h3 className="text-2xl font-black">{title}</h3>
                <p className="mt-4 leading-7 text-neutral-300">{text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </PublicShell>
  )
}

function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const [role, setRole] = useState<Role>('student')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setLoading(true)
    setError('')
    try {
      if (mode === 'login') await login(String(form.get('email')), String(form.get('password')))
      else await register({ name: String(form.get('name')), email: String(form.get('email')), password: String(form.get('password')), role, department: String(form.get('department')) })
      navigate('/app')
    } catch (err) {
      setError(axios.isAxiosError(err) ? err.response?.data?.message || 'Action failed.' : 'Action failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PublicShell>
      <main className="mx-auto grid min-h-[calc(100vh-74px)] max-w-6xl items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[.9fr_1.1fr] lg:px-8">
        <section>
          <div className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-black shadow-sm"><ShieldCheck size={16} className="text-teal-600" /> Secure academic identity</div>
          <h1 className="mt-5 text-4xl font-black sm:text-6xl">{mode === 'login' ? 'Welcome back to AttendX.' : 'Create your AttendX workspace.'}</h1>
          <p className="mt-5 text-lg leading-8 text-neutral-600">Demo accounts: `student@attendx.edu` or `faculty@attendx.edu`, password `password123`.</p>
        </section>
        <section className="rounded-lg border border-neutral-950/10 bg-white p-6 shadow-xl">
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-neutral-100 p-1">
            <button onClick={() => setRole('student')} className={`rounded-lg px-4 py-3 font-black ${role === 'student' ? 'bg-neutral-950 text-white' : 'text-neutral-500'}`}>Student</button>
            <button onClick={() => setRole('faculty')} className={`rounded-lg px-4 py-3 font-black ${role === 'faculty' ? 'bg-neutral-950 text-white' : 'text-neutral-500'}`}>Faculty</button>
          </div>
          <form onSubmit={submit} className="mt-6 grid gap-4">
            {mode === 'signup' && <Input name="name" label="Full name" placeholder="Aarav Sharma" />}
            <Input name="email" label="Email" placeholder={role === 'student' ? 'student@attendx.edu' : 'faculty@attendx.edu'} type="email" />
            <Input name="password" label="Password" placeholder="password123" type="password" />
            {mode === 'signup' && <Input name="department" label="Department" placeholder="CSE AI" />}
            {error && <div className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
            <button disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#f4c430] px-5 py-3 font-black text-neutral-950 disabled:opacity-70">
              {loading && <Loader2 className="animate-spin" size={18} />} {mode === 'login' ? 'Login' : 'Create account'}
            </button>
          </form>
          <Link to={mode === 'login' ? '/signup' : '/login'} className="mt-5 block text-center text-sm font-black text-neutral-600">
            {mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Login'}
          </Link>
        </section>
      </main>
    </PublicShell>
  )
}

function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const studentNav = [
    ['Student Home', '/app', LayoutDashboard],
    ['My Attendance', '/app/attendance', CalendarCheck],
    ['Assignments', '/app/assignments', FileUp],
    ['Academic Record', '/app/analytics', BookOpen],
  ] as const
  const facultyNav = [
    ['Faculty Home', '/app', LayoutDashboard],
    ['Class Sessions', '/app/attendance', QrCode],
    ['Submissions', '/app/assignments', ClipboardList],
    ['Class Analytics', '/app/analytics', BarChart3],
  ] as const
  const nav = user?.role === 'faculty' ? facultyNav : studentNav
  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-950 lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="hidden border-r border-neutral-950/10 bg-neutral-950 p-5 text-white lg:block">
        <Link to="/" className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-[#f4c430] text-neutral-950"><Fingerprint /></span><span className="text-xl font-black">AttendX</span></Link>
        <div className="mt-8 rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="font-black">{user?.name || user?.email}</p>
          <p className="mt-1 text-sm font-bold capitalize text-neutral-400">{user?.role} • {user?.department || 'Campus'}</p>
        </div>
        <nav className="mt-6 grid gap-1">
          {nav.map(([label, path, Icon]) => <NavLink key={path as string} end={path === '/app'} to={path as string} className={({ isActive }) => `flex items-center gap-3 rounded-lg px-4 py-3 font-bold ${isActive ? 'bg-white text-neutral-950' : 'text-neutral-300 hover:bg-white/10'}`}><Icon size={18} /> {label as string}</NavLink>)}
        </nav>
        <button onClick={logout} className="mt-8 flex w-full items-center gap-3 rounded-lg border border-white/10 px-4 py-3 font-bold text-neutral-300"><LogOut size={18} /> Logout</button>
      </aside>
      <div>
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-neutral-950/10 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
          <Link to="/" className="font-black">AttendX</Link>
          <button onClick={() => setOpen((v) => !v)} className="rounded-lg border border-neutral-950/10 p-2">{open ? <X /> : <Menu />}</button>
        </header>
        {open && <div className="border-b border-neutral-950/10 bg-white p-4 lg:hidden">{nav.map(([label, path]) => <Link key={path as string} to={path as string} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-3 font-bold">{label as string}</Link>)}</div>}
        {children}
      </div>
    </div>
  )
}

function Protected({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  return user ? <>{children}</> : <Navigate to="/login" replace />
}

function Dashboard() {
  const { user } = useAuth()
  return user?.role === 'faculty' ? <FacultyDashboard /> : <StudentDashboard />
}

function FacultyDashboard() {
  const [refresh, setRefresh] = useState(0)
  const coursesState = useApiData<{ courses: Course[] }>('/api/courses', { courses: [] }, [refresh])
  const analyticsState = useApiData<Analytics>('/api/analytics/overview', { metrics: { attendanceRate: 0, liveSessions: 0, uploadedAssignments: 0, securityFlags: 0 }, attendance: [], assignments: [], auditLogs: [] }, [refresh])

  async function createCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    await api.post('/api/courses', {
      title: String(form.get('title')),
      code: String(form.get('code')),
      room: String(form.get('room')),
      latitude: Number(form.get('latitude') || 28.6139),
      longitude: Number(form.get('longitude') || 77.209),
      radiusMeters: Number(form.get('radiusMeters') || 180),
    })
    event.currentTarget.reset()
    setRefresh((v) => v + 1)
  }

  return (
    <AppShell>
      <WorkspaceHeader eyebrow="Faculty SIS portal" title="Teaching operations, attendance control, and class intelligence." subtitle="Manage courses, start QR sessions, monitor rosters, review submissions, and track classroom risk." />
      <main className="grid gap-5 p-4 sm:p-6">
        <Metrics metrics={[
          ['Active classes', coursesState.data.courses.length, Building2],
          ['Live sessions', analyticsState.data.metrics.liveSessions, RadioTower],
          ['Pending reviews', analyticsState.data.metrics.uploadedAssignments, ClipboardList],
          ['Verification flags', analyticsState.data.metrics.securityFlags, CircleAlert],
        ]} />
        <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
          <Panel title="Create course">
            <form onSubmit={createCourse} className="grid gap-3 sm:grid-cols-2">
              <Input name="title" label="Course title" placeholder="AI Capstone Studio" />
              <Input name="code" label="Course code" placeholder="CSE-499" />
              <Input name="room" label="Room" placeholder="Lab 4" />
              <Input name="radiusMeters" label="Geofence radius" placeholder="180" type="number" />
              <Input name="latitude" label="Latitude" placeholder="28.6139" />
              <Input name="longitude" label="Longitude" placeholder="77.209" />
              <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-950 px-4 py-3 font-black text-white sm:col-span-2"><Plus size={18} /> Add course</button>
            </form>
          </Panel>
          <Panel title="Course operations">
            <CourseList courses={coursesState.data.courses} faculty onChanged={() => setRefresh((v) => v + 1)} />
          </Panel>
        </div>
        <div className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
          <FacultyRoster records={analyticsState.data.attendance} />
          <FacultyReviewQueue assignments={analyticsState.data.assignments} />
        </div>
      </main>
    </AppShell>
  )
}

function StudentDashboard() {
  const [refresh, setRefresh] = useState(0)
  const coursesState = useApiData<{ courses: Course[] }>('/api/courses', { courses: [] }, [refresh])
  const analyticsState = useApiData<Analytics>('/api/analytics/overview', { metrics: { attendanceRate: 0, liveSessions: 0, uploadedAssignments: 0, securityFlags: 0 }, attendance: [], assignments: [], auditLogs: [] }, [refresh])
  return (
    <AppShell>
      <WorkspaceHeader eyebrow="Student SIS portal" title="Your academic day, attendance status, and submissions in one place." subtitle="Track courses, timetable, attendance verification, assignments, profile, and academic progress." />
      <main className="grid gap-5 p-4 sm:p-6">
        <Metrics metrics={[
          ['Attendance', `${analyticsState.data.metrics.attendanceRate}%`, CalendarCheck],
          ['Enrolled courses', coursesState.data.courses.length, BookOpen],
          ['Submissions', analyticsState.data.metrics.uploadedAssignments, UploadCloud],
          ['Clearance', analyticsState.data.metrics.securityFlags ? 'Review' : 'Clear', ShieldCheck],
        ]} />
        <div className="grid gap-5 xl:grid-cols-[1fr_.9fr]">
          <StudentToday courses={coursesState.data.courses} />
          <StudentProfileCard />
        </div>
        <div className="grid gap-5 xl:grid-cols-[.95fr_1.05fr]">
          <AttendancePanel courses={coursesState.data.courses} onMarked={() => setRefresh((v) => v + 1)} />
          <AssignmentsPanel courses={coursesState.data.courses} assignments={analyticsState.data.assignments} onUploaded={() => setRefresh((v) => v + 1)} />
        </div>
      </main>
    </AppShell>
  )
}

function StudentToday({ courses }: { courses: Course[] }) {
  return (
    <Panel title="Today in SIS">
      <div className="grid gap-3">
        {courses.map((course, index) => (
          <div key={course.id} className="grid gap-3 rounded-lg border border-neutral-950/10 bg-neutral-50 p-4 md:grid-cols-[120px_1fr_auto] md:items-center">
            <div className="font-black text-neutral-500">{index === 0 ? '09:00 AM' : '11:30 AM'}</div>
            <div>
              <p className="font-black">{course.title}</p>
              <p className="text-sm font-bold text-neutral-500">{course.code} • {course.room} • {course.facultyName}</p>
            </div>
            <span className="rounded-lg bg-white px-3 py-2 text-sm font-black text-teal-700">{index === 0 ? 'QR opens soon' : 'Scheduled'}</span>
          </div>
        ))}
      </div>
    </Panel>
  )
}

function StudentProfileCard() {
  const { user } = useAuth()
  return (
    <Panel title="Student profile">
      <div className="grid gap-4">
        <div className="rounded-lg bg-neutral-950 p-5 text-white">
          <p className="text-sm font-bold text-neutral-400">Student ID</p>
          <p className="mt-1 text-2xl font-black">ATX-{user?.id.slice(0, 6).toUpperCase()}</p>
        </div>
        {[
          ['Name', user?.name || user?.email || 'Student'],
          ['Program', user?.department || 'CSE AI'],
          ['Semester', '6th semester'],
          ['Academic standing', 'Good standing'],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between rounded-lg bg-neutral-50 p-3 text-sm">
            <span className="font-black text-neutral-500">{label}</span>
            <span className="font-black">{value}</span>
          </div>
        ))}
      </div>
    </Panel>
  )
}

function FacultyRoster({ records }: { records: AttendanceRecord[] }) {
  const rows = records.length ? records : [
    { id: 'sample-1', studentName: 'Waiting for students', status: 'No live check-ins yet', distanceMeters: 0, riskScore: 0, createdAt: new Date().toISOString(), courseId: '' },
  ]
  return (
    <Panel title="Live class roster">
      <div className="grid gap-3">
        {rows.slice(0, 6).map((record) => (
          <div key={record.id} className="grid gap-2 rounded-lg bg-neutral-50 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
            <div>
              <p className="font-black">{record.studentName}</p>
              <p className="text-sm font-bold text-neutral-500">{record.status}</p>
            </div>
            <span className="rounded-lg bg-white px-3 py-2 text-sm font-black">{record.distanceMeters}m</span>
            <span className={`rounded-lg px-3 py-2 text-sm font-black ${record.riskScore > 50 ? 'bg-red-100 text-red-700' : 'bg-teal-100 text-teal-700'}`}>Risk {record.riskScore}</span>
          </div>
        ))}
      </div>
    </Panel>
  )
}

function FacultyReviewQueue({ assignments }: { assignments: Assignment[] }) {
  const rows = assignments.length ? assignments : [
    { id: 'empty', title: 'No submissions yet', fileName: 'Waiting for student uploads', status: 'Open', createdAt: new Date().toISOString() },
  ]
  return (
    <Panel title="Review queue">
      <div className="grid gap-3">
        {rows.slice(0, 5).map((item) => (
          <div key={item.id} className="rounded-lg border border-neutral-950/10 bg-neutral-50 p-4">
            <p className="font-black">{item.title}</p>
            <p className="mt-1 text-sm font-bold text-neutral-500">{item.fileName} • {item.status}</p>
            <button className="mt-3 rounded-lg bg-neutral-950 px-3 py-2 text-sm font-black text-white">Review</button>
          </div>
        ))}
      </div>
    </Panel>
  )
}

function CourseList({ courses, faculty, onChanged }: { courses: Course[]; faculty?: boolean; onChanged: () => void }) {
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [loadingId, setLoadingId] = useState('')

  async function generate(courseId: string) {
    setLoadingId(courseId)
    const { data } = await api.post('/api/attendance/sessions', { courseId })
    setActiveSession(data.session)
    setLoadingId('')
    onChanged()
  }

  return (
    <div className="grid gap-3">
      {courses.map((course) => (
        <article key={course.id} className="rounded-lg border border-neutral-950/10 bg-neutral-50 p-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <h3 className="text-lg font-black">{course.title}</h3>
              <p className="mt-1 text-sm font-bold text-neutral-500">{course.code} • {course.room} • {course.radiusMeters}m geofence</p>
            </div>
            {faculty && <button onClick={() => generate(course.id)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#f4c430] px-4 py-2 font-black text-neutral-950">{loadingId === course.id ? <Loader2 className="animate-spin" size={17} /> : <QrCode size={17} />} Generate QR</button>}
          </div>
        </article>
      ))}
      {activeSession && (
        <div className="rounded-lg border border-neutral-950/10 bg-white p-4">
          <h3 className="font-black">Live QR token</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr] md:items-center">
            <img src={activeSession.qrDataUrl} alt="Attendance QR code" className="w-full max-w-[220px] rounded-lg border border-neutral-950/10" />
            <div>
              <p className="text-sm font-bold text-neutral-500">Students can scan this QR or paste the secure token in their attendance panel.</p>
              <textarea readOnly value={activeSession.qrToken} className="mt-3 h-28 w-full rounded-lg border border-neutral-950/10 bg-neutral-50 p-3 text-xs" />
              <p className="mt-2 text-sm font-bold text-teal-700">Expires at {new Date(activeSession.expiresAt).toLocaleTimeString()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AttendancePanel({ courses, onMarked }: { courses: Course[]; onMarked: () => void }) {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function mark(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setMessage('Getting location permission...')
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const { data } = await api.post('/api/attendance/mark', {
          qrToken: String(form.get('qrToken')),
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
        setMessage(data.insideGeofence ? `Attendance marked. Distance: ${data.record.distanceMeters}m.` : 'Rejected outside geofence.')
        onMarked()
      } catch (err) {
        setMessage(axios.isAxiosError(err) ? err.response?.data?.message || 'Could not mark attendance.' : 'Could not mark attendance.')
      } finally {
        setBusy(false)
      }
    }, () => {
      setMessage('Location permission is required for secure attendance.')
      setBusy(false)
    })
  }

  return (
    <Panel title="QR + GPS attendance">
      <form onSubmit={mark} className="grid gap-4">
        <label className="grid gap-2 text-sm font-black text-neutral-600">Secure QR token<textarea name="qrToken" required className="h-32 rounded-lg border border-neutral-950/10 p-3 text-sm outline-none focus:border-teal-500" placeholder="Paste faculty QR token here" /></label>
        <button disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-950 px-4 py-3 font-black text-white disabled:opacity-70">{busy ? <Loader2 className="animate-spin" size={18} /> : <MapPin size={18} />} Validate GPS and mark attendance</button>
        {message && <div className="rounded-lg bg-neutral-100 p-3 text-sm font-bold">{message}</div>}
      </form>
      <div className="mt-5 grid gap-2">
        {courses.map((course) => <div key={course.id} className="flex items-center justify-between rounded-lg bg-neutral-50 p-3 text-sm"><span className="font-black">{course.title}</span><span className="font-bold text-neutral-500">{course.room}</span></div>)}
      </div>
    </Panel>
  )
}

function AssignmentsPanel({ courses, assignments, onUploaded }: { courses: Course[]; assignments: Assignment[]; onUploaded: () => void }) {
  const [message, setMessage] = useState('')
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      await api.post('/api/assignments', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      setMessage('Upload submitted successfully.')
      event.currentTarget.reset()
      onUploaded()
    } catch (err) {
      setMessage(axios.isAxiosError(err) ? err.response?.data?.message || 'Upload failed.' : 'Upload failed.')
    }
  }
  return (
    <Panel title="Assignment and capstone uploads">
      <form onSubmit={upload} className="grid gap-3">
        <select name="courseId" required className="rounded-lg border border-neutral-950/10 p-3 font-bold">
          <option value="">Select course</option>
          {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
        </select>
        <Input name="title" label="Submission title" placeholder="Capstone sprint 4" />
        <input name="file" type="file" required className="rounded-lg border border-dashed border-neutral-950/20 bg-neutral-50 p-4 font-bold" />
        <button className="rounded-lg bg-[#f4c430] px-4 py-3 font-black text-neutral-950">Upload securely</button>
        {message && <p className="text-sm font-bold text-teal-700">{message}</p>}
      </form>
      <div className="mt-5 grid gap-2">
        {assignments.map((item) => <div key={item.id} className="rounded-lg bg-neutral-50 p-3"><p className="font-black">{item.title}</p><p className="text-sm font-bold text-neutral-500">{item.fileName} • {item.status}</p></div>)}
      </div>
    </Panel>
  )
}

function AttendancePage() {
  const { user } = useAuth()
  const [refresh, setRefresh] = useState(0)
  const coursesState = useApiData<{ courses: Course[] }>('/api/courses', { courses: [] }, [refresh])
  const analyticsState = useApiData<Analytics>('/api/analytics/overview', { metrics: { attendanceRate: 0, liveSessions: 0, uploadedAssignments: 0, securityFlags: 0 }, attendance: [], assignments: [], auditLogs: [] }, [refresh])
  if (user?.role === 'faculty') {
    return (
      <AppShell>
        <WorkspaceHeader eyebrow="Faculty SIS" title="Class sessions and QR attendance." subtitle="Start secure sessions, project QR codes, and monitor live verification records." />
        <main className="grid gap-5 p-4 sm:p-6">
          <CourseList courses={coursesState.data.courses} faculty onChanged={() => setRefresh((v) => v + 1)} />
          <LiveRecords records={analyticsState.data.attendance} />
        </main>
      </AppShell>
    )
  }
  return (
    <AppShell>
      <WorkspaceHeader eyebrow="Student SIS" title="My attendance." subtitle="Paste the faculty QR token, allow location access, and view your verification history." />
      <main className="grid gap-5 p-4 sm:p-6 xl:grid-cols-[.9fr_1.1fr]">
        <AttendancePanel courses={coursesState.data.courses} onMarked={() => setRefresh((v) => v + 1)} />
        <LiveRecords records={analyticsState.data.attendance} />
      </main>
    </AppShell>
  )
}

function AssignmentsPage() {
  const { user } = useAuth()
  const coursesState = useApiData<{ courses: Course[] }>('/api/courses', { courses: [] })
  const state = useApiData<Analytics>('/api/analytics/overview', { metrics: { attendanceRate: 0, liveSessions: 0, uploadedAssignments: 0, securityFlags: 0 }, attendance: [], assignments: [], auditLogs: [] })
  if (user?.role === 'student') {
    return (
      <AppShell>
        <WorkspaceHeader eyebrow="Student SIS" title="My assignments and capstone uploads." subtitle="Submit work securely and keep a clean academic submission trail." />
        <main className="p-4 sm:p-6"><AssignmentsPanel courses={coursesState.data.courses} assignments={state.data.assignments} onUploaded={() => undefined} /></main>
      </AppShell>
    )
  }
  return (
    <AppShell>
      <WorkspaceHeader eyebrow="Faculty SIS" title="Submission review center." subtitle="Review student assignments, capstone evidence, and pending academic work." />
      <main className="p-4 sm:p-6"><Panel title="Recent uploads"><div className="grid gap-3">{state.data.assignments.map((item) => <div key={item.id} className="rounded-lg bg-neutral-50 p-4"><p className="font-black">{item.title}</p><p className="text-sm font-bold text-neutral-500">{item.fileName} • {item.status}</p></div>)}</div></Panel></main>
    </AppShell>
  )
}

function AnalyticsPage() {
  const { user } = useAuth()
  const state = useApiData<Analytics>('/api/analytics/overview', { metrics: { attendanceRate: 0, liveSessions: 0, uploadedAssignments: 0, securityFlags: 0 }, attendance: [], assignments: [], auditLogs: [] })
  return (
    <AppShell>
      <WorkspaceHeader eyebrow={user?.role === 'faculty' ? 'Faculty SIS' : 'Student SIS'} title={user?.role === 'faculty' ? 'Class analytics and audit trail.' : 'Academic record and progress.'} subtitle={user?.role === 'faculty' ? 'Attendance health, security flags, uploads, and session audit history.' : 'Your attendance percentage, submission count, and academic standing snapshot.'} />
      <main className="grid gap-5 p-4 sm:p-6">
        <Metrics metrics={[
          [user?.role === 'faculty' ? 'Class attendance' : 'My attendance', `${state.data.metrics.attendanceRate}%`, BarChart3],
          [user?.role === 'faculty' ? 'Live sessions' : 'Courses', user?.role === 'faculty' ? state.data.metrics.liveSessions : 2, RadioTower],
          [user?.role === 'faculty' ? 'Uploads' : 'My uploads', state.data.metrics.uploadedAssignments, UploadCloud],
          [user?.role === 'faculty' ? 'Flags' : 'Standing', user?.role === 'faculty' ? state.data.metrics.securityFlags : 'Good', ShieldCheck],
        ]} />
        {user?.role === 'faculty' ? <LiveRecords records={state.data.attendance} /> : <StudentTranscript />}
        <Panel title="Audit log"><div className="grid gap-2">{state.data.auditLogs.map((log) => <div key={log.id} className="rounded-lg bg-neutral-50 p-3 text-sm font-bold">{log.action} • {new Date(log.createdAt).toLocaleString()}</div>)}</div></Panel>
      </main>
    </AppShell>
  )
}

function StudentTranscript() {
  return (
    <Panel title="Academic record">
      <div className="grid gap-3 md:grid-cols-2">
        {[
          ['Applied Machine Learning', 'A', '4 credits'],
          ['Advanced PostgreSQL', 'A-', '3 credits'],
          ['Cloud Systems Lab', 'B+', '2 credits'],
          ['Capstone Studio', 'In progress', '6 credits'],
        ].map(([course, grade, credits]) => (
          <div key={course} className="rounded-lg bg-neutral-50 p-4">
            <p className="font-black">{course}</p>
            <p className="mt-1 text-sm font-bold text-neutral-500">{grade} • {credits}</p>
          </div>
        ))}
      </div>
    </Panel>
  )
}

function SecurityPage() {
  const controls = [
    ['QR encryption', 'AES-GCM encrypted session payloads rotate every 90 seconds.', 'Live'],
    ['Geofence proof', 'Haversine validation rejects check-ins outside faculty radius.', 'Live'],
    ['Role access', 'Student and faculty portals are separated by JWT role claims.', 'Live'],
    ['Upload hardening', 'File size limits, MIME filtering, and protected submission routes.', 'Live'],
    ['Socket authorization', 'Live classroom events are scoped to session and course rooms.', 'Planned hardening'],
    ['Audit trail', 'Login, course, QR, attendance, and upload actions are traceable.', 'Live'],
  ]
  const [selected, setSelected] = useState(0)
  return (
    <PublicShell>
      <main>
        <section className="border-b border-neutral-950/10 bg-neutral-950 text-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[.9fr_1.1fr] lg:px-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm font-black"><ShieldCheck size={16} className="text-[#f4c430]" /> AttendX Trust Center</div>
              <h1 className="mt-5 text-4xl font-black leading-tight sm:text-6xl">Security controls for real classroom verification.</h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-neutral-300">Attendance is treated as a high-trust event: cryptographic QR proof, GPS distance checks, role-scoped access, upload controls, and audit-ready operational history.</p>
            </div>
            <div className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.06] p-5">
              {['Verification pipeline online', 'JWT role boundaries active', 'Upload gateway restricted', 'Audit log collecting events'].map((item, index) => (
                <div key={item} className="flex items-center justify-between rounded-lg bg-white/10 p-4">
                  <span className="font-black">{item}</span>
                  <span className={`rounded-lg px-3 py-1 text-xs font-black ${index < 3 ? 'bg-teal-300 text-neutral-950' : 'bg-[#f4c430] text-neutral-950'}`}>{index < 3 ? 'PASS' : 'SYNC'}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="mx-auto grid max-w-7xl gap-5 px-4 py-14 sm:px-6 lg:grid-cols-[.85fr_1.15fr] lg:px-8">
          <div className="rounded-lg border border-neutral-950/10 bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-black">Control explorer</h2>
            <div className="mt-5 grid gap-2">
              {controls.map(([name, _text, status], index) => (
                <button key={name} onClick={() => setSelected(index)} className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left font-black ${selected === index ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-950/10 bg-neutral-50 text-neutral-700'}`}>
                  {name}
                  <span className="text-xs">{status}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-neutral-950/10 bg-white p-6 shadow-sm">
            <LockKeyhole className="text-teal-600" size={34} />
            <h2 className="mt-5 text-3xl font-black">{controls[selected][0]}</h2>
            <p className="mt-4 text-lg leading-8 text-neutral-600">{controls[selected][1]}</p>
            <div className="mt-8 grid gap-3 md:grid-cols-3">
              {['Implementation', 'Monitoring', 'Incident response'].map((item) => (
                <div key={item} className="rounded-lg bg-neutral-50 p-4">
                  <p className="text-sm font-black uppercase text-neutral-500">{item}</p>
                  <p className="mt-2 font-black text-teal-700">Configured</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ['Anti-spoofing', 'Outside-radius attendance is rejected and logged with risk score.'],
              ['Compliance evidence', 'Every login, session, upload, and attendance action becomes an audit event.'],
              ['Deployment ready', 'Neon Postgres, JWT secrets, OpenRouter key, and client origin are environment-driven.'],
            ].map(([title, text]) => (
              <article key={title} className="rounded-lg border border-neutral-950/10 bg-white p-6 shadow-sm">
                <h3 className="text-xl font-black">{title}</h3>
                <p className="mt-3 leading-7 text-neutral-600">{text}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </PublicShell>
  )
}

function PricingPage() {
  const [annual, setAnnual] = useState(true)
  const [students, setStudents] = useState(1200)
  const [faculty, setFaculty] = useState(75)
  const [ai, setAi] = useState(true)
  const base = students * 18 + faculty * 120 + (ai ? 9500 : 0)
  const total = Math.round((annual ? base * 0.82 : base) / 12)
  const plans = [
    ['Pilot', 'For one department validating QR and GPS attendance.', '₹24k', ['500 students', '10 faculty', 'Core QR + GPS', 'Email support']],
    ['Institution', 'For colleges running student and faculty SIS portals.', '₹79k', ['5,000 students', 'Unlimited sessions', 'Uploads + analytics', 'Priority support']],
    ['Enterprise', 'For multi-campus rollout with advanced governance.', 'Custom', ['SSO-ready architecture', 'Dedicated onboarding', 'Custom retention', 'Security review']],
  ] as const
  return (
    <PublicShell>
      <main>
        <section className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[.9fr_1.1fr] lg:px-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-black shadow-sm"><Zap size={16} className="text-teal-600" /> Pricing calculator</div>
            <h1 className="mt-5 text-4xl font-black leading-tight sm:text-6xl">Scale AttendX by campus size, not guesswork.</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-neutral-600">Estimate monthly platform cost for students, faculty, AI insights, QR sessions, uploads, and analytics before choosing a plan.</p>
          </div>
          <div className="rounded-lg border border-neutral-950/10 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <p className="font-black">Billing</p>
              <div className="grid grid-cols-2 rounded-lg bg-neutral-100 p-1">
                <button onClick={() => setAnnual(false)} className={`rounded-lg px-4 py-2 text-sm font-black ${!annual ? 'bg-neutral-950 text-white' : 'text-neutral-500'}`}>Monthly</button>
                <button onClick={() => setAnnual(true)} className={`rounded-lg px-4 py-2 text-sm font-black ${annual ? 'bg-neutral-950 text-white' : 'text-neutral-500'}`}>Annual -18%</button>
              </div>
            </div>
            <div className="mt-6 grid gap-4">
              <label className="grid gap-2 font-black">Students: {students}<input type="range" min="100" max="10000" step="100" value={students} onChange={(e) => setStudents(Number(e.target.value))} /></label>
              <label className="grid gap-2 font-black">Faculty: {faculty}<input type="range" min="5" max="500" step="5" value={faculty} onChange={(e) => setFaculty(Number(e.target.value))} /></label>
              <label className="flex items-center justify-between rounded-lg bg-neutral-50 p-4 font-black">OpenRouter AI insights<input type="checkbox" checked={ai} onChange={(e) => setAi(e.target.checked)} className="h-5 w-5" /></label>
            </div>
            <div className="mt-6 rounded-lg bg-neutral-950 p-5 text-white">
              <p className="text-sm font-bold text-neutral-400">Estimated monthly cost</p>
              <p className="mt-1 text-4xl font-black">₹{total.toLocaleString('en-IN')}</p>
              <p className="mt-2 text-sm font-bold text-neutral-400">Includes QR attendance, SIS portals, uploads, analytics, and security audit logs.</p>
            </div>
          </div>
        </section>
        <section className="mx-auto grid max-w-7xl gap-4 px-4 pb-16 sm:px-6 md:grid-cols-3 lg:px-8">
          {plans.map(([plan, desc, price, features], index) => (
            <article key={plan} className={`rounded-lg border p-6 shadow-sm ${index === 1 ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-950/10 bg-white'}`}>
              <p className="text-sm font-black uppercase text-teal-600">{index === 1 ? 'Most popular' : 'Plan'}</p>
              <h2 className="mt-3 text-3xl font-black">{plan}</h2>
              <p className={`mt-3 leading-7 ${index === 1 ? 'text-neutral-300' : 'text-neutral-600'}`}>{desc}</p>
              <p className="mt-6 text-4xl font-black">{price}</p>
              <div className="mt-6 grid gap-3">
                {features.map((feature) => <div key={feature} className="flex items-center gap-2 font-bold"><CheckCircle2 size={17} className="text-teal-500" /> {feature}</div>)}
              </div>
              <Link to="/signup" className={`mt-7 inline-flex w-full items-center justify-center rounded-lg px-4 py-3 font-black ${index === 1 ? 'bg-[#f4c430] text-neutral-950' : 'bg-neutral-950 text-white'}`}>Choose {plan}</Link>
            </article>
          ))}
        </section>
      </main>
    </PublicShell>
  )
}

function WorkspaceHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <section className="border-b border-neutral-950/10 bg-white px-4 py-7 sm:px-6">
      <div className="inline-flex items-center gap-2 rounded-lg bg-neutral-100 px-3 py-2 text-sm font-black"><Layers3 size={16} className="text-teal-600" /> {eyebrow}</div>
      <h1 className="mt-4 max-w-4xl text-3xl font-black sm:text-5xl">{title}</h1>
      <p className="mt-3 max-w-2xl leading-7 text-neutral-600">{subtitle}</p>
    </section>
  )
}

function Metrics({ metrics }: { metrics: [string, string | number, typeof Activity][] }) {
  return <div className="grid gap-4 md:grid-cols-4">{metrics.map(([label, value, Icon]) => <div key={label} className="rounded-lg border border-neutral-950/10 bg-white p-5 shadow-sm"><Icon className="text-teal-600" /><p className="mt-5 text-sm font-black uppercase text-neutral-500">{label}</p><p className="mt-1 text-3xl font-black">{value}</p></div>)}</div>
}

function LiveRecords({ records }: { records: AttendanceRecord[] }) {
  return (
    <Panel title="Live attendance records">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead><tr className="text-neutral-500"><th className="py-3">Student</th><th>Status</th><th>Distance</th><th>Risk</th><th>Time</th></tr></thead>
          <tbody>{records.map((item) => <tr key={item.id} className="border-t border-neutral-950/10"><td className="py-4 font-black">{item.studentName}</td><td className="font-bold">{item.status}</td><td className="font-bold">{item.distanceMeters}m</td><td className="font-bold">{item.riskScore}</td><td className="font-bold">{new Date(item.createdAt).toLocaleString()}</td></tr>)}</tbody>
        </table>
        {!records.length && <p className="rounded-lg bg-neutral-50 p-4 text-sm font-bold text-neutral-500">No records yet. Generate a QR from faculty, then mark attendance from a student account.</p>}
      </div>
    </Panel>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-lg border border-neutral-950/10 bg-white p-5 shadow-sm"><h2 className="mb-4 flex items-center gap-2 text-xl font-black"><ClipboardList size={20} className="text-teal-600" /> {title}</h2>{children}</section>
}

function Input({ label, name, placeholder, type = 'text' }: { label: string; name: string; placeholder: string; type?: string }) {
  return <label className="grid gap-2 text-sm font-black text-neutral-600">{label}<input required name={name} type={type} placeholder={placeholder} className="rounded-lg border border-neutral-950/10 bg-white px-4 py-3 text-neutral-950 outline-none focus:border-teal-500" /></label>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/security" element={<SecurityPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route path="/app" element={<Protected><Dashboard /></Protected>} />
      <Route path="/app/attendance" element={<Protected><AttendancePage /></Protected>} />
      <Route path="/app/assignments" element={<Protected><AssignmentsPage /></Protected>} />
      <Route path="/app/analytics" element={<Protected><AnalyticsPage /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  useEffect(() => {
    const token = localStorage.getItem('attendx-token')
    const socket = io(API_URL, { auth: { token }, autoConnect: Boolean(token) })
    return () => {
      socket.disconnect()
    }
  }, [])

  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
