"use client"
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { 
  Car, CheckCircle, XCircle, Wrench, Activity, Plus, Search, 
  BarChart3, Grid, LogOut, Users, MapPin, Table, Settings 
} from 'lucide-react'
import Link from 'next/link'

export default function Dashboard() {
  const router = useRouter()
  const [vehicles, setVehicles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [role, setRole] = useState('') 
  const [statusList, setStatusList] = useState<string[]>([]) 
  const [statusFilter, setStatusFilter] = useState('ALL') 

  useEffect(() => { checkUserAndFetch() }, [])

  async function checkUserAndFetch() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/login')

    const { data: profile } = await supabase.from('profiles').select('role, assigned_vehicle_id').eq('id', user.id).single()
    if (profile) {
        setRole(profile.role)
        if (profile.role === 'vehicle_user' && profile.assigned_vehicle_id) {
            router.replace(`/vehicle/${profile.assigned_vehicle_id}`); return
        }
    }

    const { data: sData } = await supabase.from('vehicle_statuses').select('name').order('sort_order')
    if (sData) setStatusList(sData.map((s: any) => s.name))

    const { data } = await supabase.from('vehicle_dashboard_view').select('*').order('created_at', { ascending: false })
    if (data) setVehicles(data)
    setLoading(false)
  }

  const filteredVehicles = vehicles.filter(v => {
    const matchText = (v.vehicle_uid+v.vehicle_type_name+v.tob).toLowerCase().includes(filter.toLowerCase())
    const matchStatus = statusFilter === 'ALL' ? true : v.status === statusFilter
    return matchText && matchStatus
  })

  // --- SMART STYLES (FIXED INACTIVE COLOR BUG) ---
  const getStatusAttr = (name: string) => {
      const s = (name || '').toLowerCase()
      // Fix: Check for 'inactive' explicitly BEFORE checking 'active'
      if (s.includes('inactive')) return { badge: 'bg-red-100 text-red-800', card: 'bg-red-600', icon: <XCircle className="w-6 h-6"/> }
      if (s.includes('active')) return { badge: 'bg-green-100 text-green-800', card: 'bg-green-600', icon: <CheckCircle className="w-6 h-6"/> }
      if (s.includes('maintenance')) return { badge: 'bg-orange-100 text-orange-800', card: 'bg-orange-600', icon: <Wrench className="w-6 h-6"/> }
      return { badge: 'bg-blue-100 text-blue-800', card: 'bg-blue-600', icon: <Activity className="w-6 h-6"/> }
  }

  const getOpCatColor = (c: string) => {
      const cat = (c || '').toLowerCase()
      if (cat.includes('fully') || cat.includes('fmc')) return 'bg-blue-100 text-blue-800'
      if (cat.includes('degraded')) return 'bg-amber-100 text-amber-900'
      if (cat.includes('non') || cat.includes('nmc')) return 'bg-red-100 text-red-800'
      return 'bg-gray-100 text-gray-800'
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-100 font-bold text-xl">Loading...</div>

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 pb-24">
      <div className="flex justify-between items-center mb-6">
        <div><h1 className="text-3xl font-black">COMMAND DASHBOARD</h1><p className="text-sm font-bold text-gray-500">Fleet Overview</p></div>
        <div className="flex gap-2">
           {role === 'super_admin' && <Link href="/admin/settings" className="btn-nav bg-gray-900 px-4 py-2 rounded text-white font-bold flex items-center"><Settings className="w-4 h-4 mr-2"/> Config</Link>}
           <Link href="/analytics" className="btn-nav bg-purple-700 px-4 py-2 rounded text-white font-bold flex items-center"><BarChart3 className="w-4 h-4 mr-2"/> Analytics</Link>
           <button onClick={() => {supabase.auth.signOut(); router.push('/login')}} className="btn-nav bg-red-600 px-4 py-2 rounded text-white font-bold flex items-center"><LogOut className="w-4 h-4 mr-2"/> Logout</button>
        </div>
      </div>

      {/* DYNAMIC CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
        <StatCard title="Total Fleet" value={vehicles.length} icon={<Car className="w-6 h-6"/>} color="bg-blue-600" isActive={statusFilter === 'ALL'} onClick={() => setStatusFilter('ALL')} />
        {statusList.map((st) => {
            const attr = getStatusAttr(st)
            const count = vehicles.filter(v => v.status === st).length
            return <StatCard key={st} title={st} value={count} icon={attr.icon} color={attr.card} isActive={statusFilter === st} onClick={() => setStatusFilter(st)} />
        })}
      </div>

      <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
        <div className="p-4 border-b flex items-center"><Search className="w-5 h-5 text-gray-400 mr-2"/><input placeholder="Search..." className="outline-none font-bold w-full" onChange={e => setFilter(e.target.value)}/></div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-xs font-black uppercase text-gray-500"><tr><th className="p-4">ID</th><th className="p-4">Type</th><th className="p-4">Location</th><th className="p-4">Status</th><th className="p-4">Readiness</th><th className="p-4">Action</th></tr></thead>
            <tbody className="divide-y">
              {filteredVehicles.map(v => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="p-4 font-black">{v.vehicle_uid}</td>
                  <td className="p-4 font-bold text-gray-600">{v.vehicle_type_name}</td>
                  <td className="p-4 font-bold text-gray-600"><MapPin className="w-3 h-3 inline mr-1 opacity-50"/>{v.tob}</td>
                  <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-black uppercase ${getStatusAttr(v.status).badge}`}>{v.status}</span></td>
                  <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-black uppercase ${getOpCatColor(v.operational_category)}`}>{v.operational_category}</span></td>
                  <td className="p-4"><Link href={`/vehicle/${v.id}`} className="border px-3 py-1 rounded font-bold text-xs uppercase hover:bg-black hover:text-white transition">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Link href="/add-vehicle" className="fixed bottom-6 right-6 bg-blue-600 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center hover:scale-105 transition"><Plus className="w-8 h-8" /></Link>
    </div>
  )
}

function StatCard({ title, value, icon, color, onClick, isActive }: any) {
  return (
    <button onClick={onClick} className={`${color} ${isActive ? 'ring-4 ring-offset-2 ring-gray-400' : ''} text-white p-4 rounded-xl shadow relative overflow-hidden text-left h-24 hover:scale-[1.02] transition-all w-full`}>
      <div className="relative z-10"><p className="text-xs font-black opacity-80 uppercase">{title}</p><p className="text-3xl font-black">{value}</p></div>
      <div className="absolute -bottom-2 -right-2 bg-white/20 p-2 rounded-full rotate-12">{icon}</div>
    </button>
  )
}