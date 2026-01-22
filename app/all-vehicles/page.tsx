"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Search, Car, MapPin, Activity, QrCode, X } from 'lucide-react'
import Link from 'next/link'
import QRCode from "react-qr-code"

export default function AllVehiclesPage() {
  const router = useRouter()
  
  // --- STATE ---
  const [vehicles, setVehicles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [types, setTypes] = useState<any[]>([])
  const [typeSortOrder, setTypeSortOrder] = useState<any>({}) // Map for sorting vehicles

  // QR Modal State
  const [showQr, setShowQr] = useState<any>(null)

  // --- FILTERS STATE ---
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('All')
  const [filterTob, setFilterTob] = useState('All')
  const [filterStatus, setFilterStatus] = useState('All')

  // --- LISTS ---
  const tobList = ['NDROMO', 'BAYOO', 'RHOO', 'DRODRO']
  const statusList = ['Fully Mission Capable', 'Degraded', 'Non-Mission Capable']

  // --- FETCH DATA ---
  useEffect(() => {
    async function fetchData() {
      // 1. Get Visual Data (Images, etc. from your View)
      const { data: viewData } = await supabase
        .from('vehicle_dashboard_view')
        .select('*')
        .order('vehicle_uid', { ascending: true })
      
      // 2. Get Secret Data (Auto-Email/Pass from Raw Table)
      const { data: secretData } = await supabase
        .from('vehicles')
        .select('id, auto_email, auto_password')

      // 3. Get Types for Filter (SORTED BY CUSTOM ORDER)
      const { data: tData } = await supabase
        .from('vehicle_types')
        .select('*')
        .order('sort_order', { ascending: true }) // <--- UPDATED: Uses sort_order

      if (viewData && secretData) {
          // Merge the visual data with the secret data
          const merged = viewData.map(v => {
              const secret = secretData.find(s => s.id === v.id)
              return { ...v, ...secret } 
          })
          setVehicles(merged)
      }
      
      if (tData) {
          setTypes(tData)
          // Create a map for sorting vehicles later: { 'APC': 1, 'LAV': 5 }
          const orderMap: any = {}
          tData.forEach((t: any) => { orderMap[t.name] = t.sort_order })
          setTypeSortOrder(orderMap)
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  // --- FILTER & SORT LOGIC ---
  const filteredVehicles = vehicles
    .filter(v => {
        const matchesSearch = (v.vehicle_uid || '').toLowerCase().includes(search.toLowerCase())
        const matchesType = filterType === 'All' || v.vehicle_type_name === filterType
        const matchesTob = filterTob === 'All' || v.tob === filterTob
        const matchesStatus = filterStatus === 'All' || v.operational_category === filterStatus
        return matchesSearch && matchesType && matchesTob && matchesStatus
    })
    .sort((a, b) => {
        // PRIMARY SORT: By Vehicle Type Chronology
        const orderA = typeSortOrder[a.vehicle_type_name] || 99
        const orderB = typeSortOrder[b.vehicle_type_name] || 99
        if (orderA !== orderB) return orderA - orderB

        // SECONDARY SORT: By Vehicle ID
        return a.vehicle_uid.localeCompare(b.vehicle_uid)
    })

  // --- HELPER FOR STATUS COLORS ---
  const getStatusColor = (status: string) => {
    if (status === 'Fully Mission Capable') return 'bg-green-100 text-green-800 border-green-200'
    if (status === 'Non-Mission Capable') return 'bg-red-100 text-red-800 border-red-200'
    return 'bg-orange-100 text-orange-800 border-orange-200'
  }

  // --- AUTO LOGIN URL GENERATOR ---
  const getLoginUrl = (v: any) => {
    const baseUrl = window.location.origin
    return `${baseUrl}/login?auto_email=${encodeURIComponent(v.auto_email)}&auto_pass=${encodeURIComponent(v.auto_password)}`
  }

  if (loading) return <div className="p-8 text-xl font-bold text-gray-800">Loading Fleet Gallery...</div>

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div className="flex items-center w-full md:w-auto">
            <button onClick={() => router.push('/')} className="bg-white p-2 rounded-lg shadow-sm border border-gray-300 mr-4 hover:bg-gray-50 text-gray-700">
                <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
                <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight">All Vehicles</h1>
                <p className="text-gray-500 font-bold text-sm">{filteredVehicles.length} vehicles found</p>
            </div>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-4 rounded-xl shadow-md mb-8 border border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Search */}
        <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input 
                type="text" 
                placeholder="Search ID..." 
                className="w-full pl-10 p-2.5 border-2 border-gray-200 rounded-lg font-bold text-gray-700 outline-none focus:border-blue-500 transition-colors"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />
        </div>

        {/* Filter: Type (SORTED) */}
        <div className="relative">
             <Car className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
             <select 
                value={filterType} 
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full pl-10 p-2.5 border-2 border-gray-200 rounded-lg font-bold text-gray-700 outline-none focus:border-blue-500 cursor-pointer appearance-none bg-white"
             >
                <option value="All">All Types</option>
                {types.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
             </select>
        </div>

        {/* Filter: TOB */}
        <div className="relative">
             <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
             <select 
                value={filterTob} 
                onChange={(e) => setFilterTob(e.target.value)}
                className="w-full pl-10 p-2.5 border-2 border-gray-200 rounded-lg font-bold text-gray-700 outline-none focus:border-blue-500 cursor-pointer appearance-none bg-white"
             >
                <option value="All">All Locations</option>
                {tobList.map(t => <option key={t} value={t}>{t}</option>)}
             </select>
        </div>

        {/* Filter: Status */}
        <div className="relative">
             <Activity className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
             <select 
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full pl-10 p-2.5 border-2 border-gray-200 rounded-lg font-bold text-gray-700 outline-none focus:border-blue-500 cursor-pointer appearance-none bg-white"
             >
                <option value="All">All Op Status</option>
                {statusList.map(s => <option key={s} value={s}>{s}</option>)}
             </select>
        </div>
      </div>

      {/* GRID VIEW */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {filteredVehicles.map((vehicle) => (
            <div key={vehicle.id} className="group bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-200 overflow-hidden flex flex-col relative">
                
                {/* 1. IMAGE BOX */}
                <Link href={`/vehicle/${vehicle.id}`} className="block w-full aspect-[4/3] bg-gray-100 relative overflow-hidden border-b border-gray-100">
                    <img 
                        src={vehicle.vehicle_image_url || 'https://placehold.co/600x400?text=No+Image'} 
                        alt="Vehicle"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-2 right-2">
                        <span className={`text-[10px] uppercase font-black px-2 py-1 rounded shadow-sm border ${vehicle.status === 'Active' ? 'bg-green-500 text-white border-green-600' : 'bg-red-600 text-white border-red-700'}`}>
                            {vehicle.status === 'Active' ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                </Link>

                {/* 2. INFO SECTION */}
                <div className="p-4 flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                        <Link href={`/vehicle/${vehicle.id}`}>
                            <h2 className="text-xl font-black text-gray-900 group-hover:text-blue-700 transition-colors">{vehicle.vehicle_uid}</h2>
                        </Link>
                        {/* QR CODE BUTTON (Only if auto-user exists) */}
                        {vehicle.auto_email && (
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setShowQr(vehicle);
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white p-1.5 rounded shadow flex items-center justify-center transition-colors"
                                title="Show Login QR"
                            >
                                <QrCode className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center justify-between">
                         <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded uppercase tracking-wide">{vehicle.vehicle_type_name}</span>
                         <div className="flex items-center text-gray-500 font-bold text-sm">
                            <MapPin className="w-4 h-4 mr-1 text-gray-400" /> {vehicle.tob}
                         </div>
                    </div>

                    <div className="mt-auto pt-2 border-t border-gray-100">
                          <span className={`block text-center text-xs font-black uppercase tracking-wide px-2 py-1.5 rounded ${getStatusColor(vehicle.operational_category)}`}>
                            {vehicle.operational_category || 'Unknown Status'}
                          </span>
                    </div>
                </div>
            </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredVehicles.length === 0 && (
          <div className="text-center py-20">
              <div className="bg-gray-200 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Car className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-600">No vehicles match your filters.</h3>
          </div>
      )}

      {/* QR CODE MODAL */}
      {showQr && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowQr(null)}>
              <div className="bg-white p-6 rounded-2xl max-w-sm w-full text-center shadow-2xl" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-black text-gray-900">QR Key: {showQr.vehicle_uid}</h3>
                      <button onClick={() => setShowQr(null)} className="p-1 hover:bg-gray-100 rounded-full"><X className="w-6 h-6 text-gray-500"/></button>
                  </div>
                  
                  <div className="bg-white p-4 border-4 border-black rounded-xl inline-block mb-4">
                      <QRCode 
                        value={getLoginUrl(showQr)} 
                        size={200}
                        style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                        viewBox={`0 0 256 256`}
                      />
                  </div>

                  <p className="text-xs font-bold text-gray-500 mb-4">
                      Scan this with any phone to instantly log in as {showQr.vehicle_uid}.
                  </p>
                  
                  <div className="bg-gray-100 p-3 rounded text-left mb-4 border border-gray-200">
                      <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Backup Login Details</p>
                      <div className="flex justify-between">
                         <span className="text-xs font-bold text-gray-500">User:</span>
                         <span className="text-xs font-mono text-gray-900 select-all">{showQr.auto_email}</span>
                      </div>
                      <div className="flex justify-between">
                         <span className="text-xs font-bold text-gray-500">Pass:</span>
                         <span className="text-xs font-mono text-gray-900 select-all">{showQr.auto_password}</span>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  )
}