"use client"
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { 
  Car, CheckCircle, XCircle, AlertTriangle, Plus, Search, 
  BarChart3, Grid, LogOut, Users, Wrench, MapPin, Table, Settings, Activity 
} from 'lucide-react'
import Link from 'next/link'

export default function Dashboard() {
  const router = useRouter()
  const [vehicles, setVehicles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('') 
  const [filter, setFilter] = useState('')
  const [role, setRole] = useState('') 

  // --- DYNAMIC STATUS LIST ---
  const [statusList, setStatusList] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState('ALL') 

  useEffect(() => {
    checkUserAndFetch()
  }, [])

  async function checkUserAndFetch() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/login')

    // 1. Fetch Profile
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile) setRole(profile.role)

    // 2. Fetch Dynamic Statuses
    const { data: sData } = await supabase.from('vehicle_statuses').select('name').order('sort_order')
    if (sData) setStatusList(sData.map((s: any) => s.name))

    // 3. Fetch Vehicles
    const { data, error } = await supabase
      .from('vehicle_dashboard_view')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) setErrorMsg(error.message)
    else setVehicles(data || [])
    
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // --- DYNAMIC FILTERING ---
  const filteredVehicles = vehicles.filter(v => {
    // Text Search
    const matchesText = (v.vehicle_uid || '').toLowerCase().includes(filter.toLowerCase()) ||
                        (v.vehicle_type_name || '').toLowerCase().includes(filter.toLowerCase()) ||
                        (v.tob || '').toLowerCase().includes(filter.toLowerCase())

    // Dynamic Status Filter
    const matchesStatus = statusFilter === 'ALL' ? true : v.status === statusFilter

    return matchesText && matchesStatus
  })

  // --- 1. HELPER FOR STATUS COLORS ---
  const getStatusColor = (s: string) => {
      if (s === 'Active') return 'bg-green-100 text-green-800'
      if (s === 'Maintenance') return 'bg-orange-100 text-orange-800'
      if (s === 'Inactive') return 'bg-red-100 text-red-800'
      return 'bg-gray-100 text-gray-800' 
  }

  // --- 2. HELPER FOR OP CAT COLORS (NEW) ---
  const getOpCatColor = (c: string) => {
      const cat = (c || '').toLowerCase()
      // Blue for Ready/FMC
      if (cat.includes('fully') || cat.includes('fmc')) return 'bg-blue-100 text-blue-800'
      // Brown/Amber for Degraded
      if (cat.includes('degraded')) return 'bg-amber-200 text-amber-900' 
      // Red for NMC
      if (cat.includes('non') || cat.includes('nmc')) return 'bg-red-100 text-red-800'
      
      return 'bg-gray-100 text-gray-800'
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-100"><div className="text-xl font-black text-gray-900">Loading Command Dashboard...</div></div>

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 pb-24">
      
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div className="w-full md:w-auto">
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">COMMAND DASHBOARD</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-gray-600 font-bold text-xs md:text-sm">Military Vehicle Accountability System</p>
            {role && (
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${role === 'super_admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-600'}`}>
                    {role.replace('_', ' ')}
                </span>
            )}
          </div>
        </div>
        
        {/* Navigation Buttons */}
        <div className="flex flex-wrap gap-2 w-full md:w-auto items-center justify-start md:justify-end">
           {(role === 'super_admin' || role === 'admin' || role === 'tob_admin' || role === 'workshop_admin') && (
               <Link href="/workshop" className="flex-1 md:flex-none flex items-center justify-center bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 md:px-4 md:py-3 rounded-lg font-bold shadow-sm text-sm transition-colors">
                  <Wrench className="w-4 h-4 md:w-5 md:h-5 mr-2" /> Workshop
               </Link>
           )}
           {role === 'super_admin' && (
                <>
                    <Link href="/users" className="flex-1 md:flex-none flex items-center justify-center bg-purple-900 hover:bg-black text-white px-3 py-2 md:px-4 md:py-3 rounded-lg font-bold shadow-sm text-sm transition-colors">
                        <Users className="w-4 h-4 md:w-5 md:h-5 mr-2" /> Users
                    </Link>
                    <Link href="/admin/settings" className="flex-1 md:flex-none flex items-center justify-center bg-gray-900 hover:bg-black text-white px-3 py-2 md:px-4 md:py-3 rounded-lg font-bold shadow-sm text-sm transition-colors">
                        <Settings className="w-4 h-4 md:w-5 md:h-5 mr-2" /> Config
                    </Link>
                </>
           )}
           <Link href="/all-vehicles" className="flex-1 md:flex-none flex items-center justify-center bg-gray-800 hover:bg-black text-white px-3 py-2 md:px-4 md:py-3 rounded-lg font-bold shadow-sm text-sm transition-colors">
             <Grid className="w-4 h-4 md:w-5 md:h-5 mr-2" /> All Vehicles
           </Link>
           <Link href="/vehicle-statistics" className="flex-1 md:flex-none flex items-center justify-center bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 md:px-4 md:py-3 rounded-lg font-bold shadow-sm text-sm transition-colors">
             <Table className="w-4 h-4 md:w-5 md:h-5 mr-2" /> Statistics
           </Link>
           <Link href="/analytics" className="flex-1 md:flex-none flex items-center justify-center bg-purple-700 hover:bg-purple-800 text-white px-3 py-2 md:px-4 md:py-3 rounded-lg font-bold shadow-sm text-sm transition-colors">
             <BarChart3 className="w-4 h-4 md:w-5 md:h-5 mr-2" /> Analytics
           </Link>
           <button onClick={handleLogout} className="flex-1 md:flex-none flex items-center justify-center bg-red-600 hover:bg-red-700 text-white px-3 py-2 md:px-4 md:py-3 rounded-lg font-bold shadow-sm text-sm transition-colors">
             <LogOut className="w-4 h-4 md:w-5 md:h-5 mr-2" /> Sign Out
           </button>
        </div>
      </div>

      {/* DYNAMIC STATS CARDS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4 mb-6 md:mb-8">
        {/* Always show TOTAL first */}
        <StatCard 
            title="Total Fleet" 
            value={vehicles.length} 
            icon={<Car className="w-6 h-6"/>} 
            color="bg-blue-600" 
            isActive={statusFilter === 'ALL'}
            onClick={() => setStatusFilter('ALL')}
        />
        
        {/* Render a card for each Status found in DB */}
        {statusList.map(statusName => {
            const count = vehicles.filter(v => v.status === statusName).length
            // Determine color dynamically or default to gray
            let color = 'bg-gray-600'
            if (statusName === 'Active') color = 'bg-green-600'
            else if (statusName === 'Maintenance') color = 'bg-orange-600'
            else if (statusName === 'Inactive') color = 'bg-red-600'

            return (
                <StatCard 
                    key={statusName}
                    title={statusName} 
                    value={count} 
                    icon={<Activity className="w-6 h-6"/>} 
                    color={color} 
                    isActive={statusFilter === statusName}
                    onClick={() => setStatusFilter(statusName)}
                />
            )
        })}
      </div>

      {/* SEARCH & TABLE SECTION */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-4 md:mb-0">
        <div className="p-4 md:p-5 flex items-center">
          <Search className="w-5 h-5 text-gray-500 mr-3" />
          <input 
            type="text" 
            placeholder="Search Vehicle ID..." 
            className="w-full bg-transparent outline-none text-gray-900 font-bold placeholder-gray-400 text-base" 
            onChange={(e) => setFilter(e.target.value)}
          />
          {statusFilter !== 'ALL' && (
              <span className="ml-2 text-xs font-black uppercase px-3 py-1 bg-gray-900 text-white rounded-full whitespace-nowrap animate-pulse">
                  Filter: {statusFilter}
              </span>
          )}
        </div>
      </div>

      <div className="hidden md:block bg-white rounded-b-xl shadow-lg border-t-0 border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-extrabold tracking-wider">
              <tr>
                <th className="px-6 py-4 border-b border-gray-100">Vehicle ID</th>
                <th className="px-6 py-4 border-b border-gray-100">Type</th>
                <th className="px-6 py-4 border-b border-gray-100">Location</th>
                <th className="px-6 py-4 border-b border-gray-100">Status</th>
                <th className="px-6 py-4 border-b border-gray-100">Operational Category</th>
                <th className="px-6 py-4 border-b border-gray-100 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filteredVehicles.map((vehicle: any) => (
                <tr key={vehicle.id} className="hover:bg-blue-50 transition-colors group">
                  <td className="px-6 py-4 font-black text-gray-900 whitespace-nowrap text-lg">{vehicle.vehicle_uid}</td>
                  <td className="px-6 py-4 font-bold text-gray-600 whitespace-nowrap">{vehicle.vehicle_type_name || '---'}</td>
                  <td className="px-6 py-4 font-bold text-gray-600 whitespace-nowrap"><span className="flex items-center"><MapPin className="w-3 h-3 mr-1 opacity-50"/> {vehicle.tob || '---'}</span></td>
                  
                  {/* DYNAMIC STATUS BADGE */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${getStatusColor(vehicle.status)}`}>
                        {vehicle.status}
                    </span>
                  </td>

                  {/* DYNAMIC OP CAT BADGE (UPDATED COLORS) */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${getOpCatColor(vehicle.operational_category)}`}>
                        {vehicle.operational_category}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-right whitespace-nowrap"><Link href={`/vehicle/${vehicle.id}`} className="inline-block bg-white border-2 border-gray-200 group-hover:border-black text-black px-4 py-1.5 rounded-md font-bold text-xs uppercase tracking-wide transition-all">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MOBILE LIST */}
      <div className="md:hidden mt-4 space-y-3">
         {filteredVehicles.map((vehicle: any) => (
            <div key={vehicle.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                    <div>
                        <span className="text-xl font-black text-gray-900 block">{vehicle.vehicle_uid}</span>
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{vehicle.vehicle_type_name}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        {/* Status Badge */}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${getStatusColor(vehicle.status)}`}>{vehicle.status}</span>
                        {/* Op Cat Badge */}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${getOpCatColor(vehicle.operational_category)}`}>{vehicle.operational_category}</span>
                    </div>
                </div>
                <div className="flex items-center justify-between text-sm font-bold text-gray-600 bg-gray-50 p-2 rounded"><span className="flex items-center"><MapPin className="w-4 h-4 mr-1 text-gray-400"/> {vehicle.tob}</span></div>
                <Link href={`/vehicle/${vehicle.id}`} className="w-full bg-black text-white text-center py-3 rounded-lg font-bold text-sm uppercase tracking-wide active:bg-gray-800">View Profile</Link>
            </div>
         ))}
      </div>
      
      <Link href="/add-vehicle" className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white w-14 h-14 rounded-full shadow-2xl transition-transform active:scale-95 flex items-center justify-center z-50"><Plus className="w-8 h-8" /></Link>
    </div>
  )
}

function StatCard({ title, value, icon, color, onClick, isActive }: any) {
  return (
    <button onClick={onClick} className={`${color} ${isActive ? 'ring-4 ring-offset-2 ring-gray-400 scale-[1.02]' : 'hover:scale-[1.02]'} transition-all duration-200 rounded-xl shadow-sm p-4 text-white flex flex-col justify-between h-24 relative overflow-hidden text-left w-full group`}>
      <div className="z-10"><p className="text-[10px] md:text-xs font-black opacity-80 uppercase tracking-wider">{title}</p><p className="text-2xl md:text-3xl font-black mt-0.5">{value}</p></div>
      <div className="absolute -bottom-2 -right-2 p-3 bg-white/10 rounded-full z-0 transform rotate-12 group-hover:scale-110 transition-transform">{icon}</div>
    </button>
  )
}