"use client"
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Car, CheckCircle, XCircle, AlertTriangle, Plus, Search, BarChart3, Grid, LogOut, Users, Shield } from 'lucide-react'
import Link from 'next/link'

export default function Dashboard() {
  const router = useRouter()
  const [vehicles, setVehicles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('') 
  const [filter, setFilter] = useState('')
  const [role, setRole] = useState('') 

  useEffect(() => {
    async function checkUserAndFetch() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')

      // Fetch Profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profile) {
          console.log("User Role Found:", profile.role) // Check Console if issues persist
          setRole(profile.role)
      } else {
          console.error("Profile Fetch Error:", profileError)
      }

      // Redirect Vehicle Users
      if (profile?.role === 'vehicle_user' && profile?.assigned_vehicle_id) {
        router.replace(`/vehicle/${profile.assigned_vehicle_id}`)
        return
      }

      // Fetch Vehicles
      const { data, error } = await supabase
        .from('vehicle_dashboard_view')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) setErrorMsg(error.message)
      else setVehicles(data || [])
      
      setLoading(false)
    }
    checkUserAndFetch()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function calculateStats(data: any[]) {
    const total = data.length
    const active = data.filter(v => v.status === 'Active').length
    const inactive = data.filter(v => v.status === 'Inactive').length
    const critical = data.filter(v => v.operational_category === 'Non-Mission Capable' || v.status === 'Inactive').length
    return { total, active, inactive, critical }
  }

  const stats = calculateStats(vehicles)
  const filteredVehicles = vehicles.filter(v => 
    (v.vehicle_uid || '').toLowerCase().includes(filter.toLowerCase()) ||
    (v.vehicle_type_name || '').toLowerCase().includes(filter.toLowerCase()) ||
    (v.tob || '').toLowerCase().includes(filter.toLowerCase())
  )

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-100"><div className="text-xl font-black text-gray-900">Verifying Security Clearance...</div></div>

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">COMMAND DASHBOARD</h1>
          <div className="flex items-center gap-2">
            <p className="text-gray-800 font-medium">Military Vehicle Accountability System</p>
            {/* DEBUG BADGE: Shows your current role */}
            {role && (
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${role === 'super_admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-600'}`}>
                    {role.replace('_', ' ')}
                </span>
            )}
          </div>
        </div>
        
        <div className="flex flex-wrap gap-3 w-full md:w-auto items-center">
           <button onClick={handleLogout} className="flex-1 md:flex-none flex items-center justify-center bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg font-bold shadow-md transition-colors mr-2">
             <LogOut className="w-5 h-5 mr-2" /> Sign Out
           </button>

           <div className="w-px h-10 bg-gray-300 hidden md:block mx-2"></div>

           {/* USERS BUTTON - Strictly checks for 'super_admin' */}
           {role === 'super_admin' && (
                <Link href="/users" className="flex-1 md:flex-none flex items-center justify-center bg-purple-900 hover:bg-black text-white px-4 py-3 rounded-lg font-bold shadow-md transition-colors mr-2">
                    <Users className="w-5 h-5 mr-2" /> Users
                </Link>
           )}

           <Link href="/all-vehicles" className="flex-1 md:flex-none flex items-center justify-center bg-gray-800 hover:bg-black text-white px-4 py-3 rounded-lg font-bold shadow-md transition-colors">
             <Grid className="w-5 h-5 mr-2" /> All Vehicles
           </Link>
           <Link href="/analytics" className="flex-1 md:flex-none flex items-center justify-center bg-purple-700 hover:bg-purple-800 text-white px-4 py-3 rounded-lg font-bold shadow-md transition-colors">
             <BarChart3 className="w-5 h-5 mr-2" /> Analytics
           </Link>
           <Link href="/add-vehicle" className="flex-1 md:flex-none flex items-center justify-center bg-blue-700 hover:bg-blue-800 text-white px-4 py-3 rounded-lg font-bold shadow-md transition-colors">
             <Plus className="w-5 h-5 mr-2" /> Add Vehicle
           </Link>
        </div>
      </div>

      {/* ERROR MESSAGE */}
      {errorMsg && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 font-bold">
          System Error: {errorMsg}
        </div>
      )}

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Fleet" value={stats.total} icon={<Car />} color="bg-blue-600" />
        <StatCard title="Mission Ready" value={stats.active} icon={<CheckCircle />} color="bg-green-600" />
        <StatCard title="Off Road" value={stats.inactive} icon={<XCircle />} color="bg-red-600" />
        <StatCard title="Critical Attention" value={stats.critical} icon={<AlertTriangle />} color="bg-orange-600" />
      </div>

      {/* Main List */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-200 bg-gray-50 flex items-center">
          <Search className="w-5 h-5 text-gray-600 mr-3" />
          <input 
            type="text" 
            placeholder="Search by Vehicle ID, Type, or TOB..." 
            className="w-full bg-transparent outline-none text-gray-900 font-bold placeholder-gray-500"
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-100 text-gray-900 uppercase text-sm font-extrabold tracking-wider">
              <tr>
                <th className="px-6 py-4 border-b border-gray-200">Vehicle ID</th>
                <th className="px-6 py-4 border-b border-gray-200">Type</th>
                <th className="px-6 py-4 border-b border-gray-200">Location (TOB)</th>
                <th className="px-6 py-4 border-b border-gray-200">Status</th>
                <th className="px-6 py-4 border-b border-gray-200 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredVehicles.map((vehicle: any) => (
                <tr key={vehicle.id} className="hover:bg-blue-50 transition-colors">
                  <td className="px-6 py-4 font-black text-gray-900 whitespace-nowrap">{vehicle.vehicle_uid}</td>
                  <td className="px-6 py-4 font-bold text-gray-800 whitespace-nowrap">{vehicle.vehicle_type_name || '---'}</td>
                  <td className="px-6 py-4 font-bold text-gray-800 whitespace-nowrap">{vehicle.tob || '---'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${vehicle.status === 'Active' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                      {vehicle.status === 'Active' ? '● Ready' : '● Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <Link href={`/vehicle/${vehicle.id}`} className="inline-block bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-md font-bold text-sm shadow">View / Edit</Link>
                  </td>
                </tr>
              ))}
              {filteredVehicles.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500 font-bold">No vehicles found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <Link href="/add-vehicle" className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-2xl transition-transform hover:scale-110 flex items-center justify-center z-50">
        <Plus className="w-8 h-8" />
      </Link>
    </div>
  )
}

function StatCard({ title, value, icon, color }: any) {
  return (
    <div className={`${color} rounded-lg shadow-lg p-5 text-white flex items-center justify-between`}>
      <div>
        <p className="text-sm font-medium opacity-90 uppercase">{title}</p>
        <p className="text-3xl font-black mt-1">{value}</p>
      </div>
      <div className="p-3 bg-white/20 rounded-full">{icon}</div>
    </div>
  )
}