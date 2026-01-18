"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, BarChart3, MapPin } from 'lucide-react' // <--- FIXED: Added MapPin

export default function AnalyticsPage() {
  const router = useRouter()
  const [stats, setStats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const tobList = ['NDROMO', 'BAYOO', 'RHOO', 'DRODRO']

  useEffect(() => {
    async function fetchStats() {
      const { data: vehicles, error } = await supabase
        .from('vehicle_dashboard_view')
        .select('*')

      if (error) console.error(error)
      else processData(vehicles || [])
      setLoading(false)
    }
    fetchStats()
  }, [])

  function processData(vehicles: any[]) {
    const typeGroups: any = {}

    vehicles.forEach(v => {
      const typeName = v.vehicle_type_name || 'Unknown'
      const tob = v.tob || 'Unknown'
      const status = v.status || 'Active'
      const opCat = v.operational_category || 'Fully Mission Capable'

      // Initialize Type Group if missing
      if (!typeGroups[typeName]) {
        typeGroups[typeName] = {
          name: typeName,
          total: 0,
          // Global Counts
          status: { active: 0, inactive: 0, maintenance: 0 },
          opCat: { fmc: 0, degraded: 0, nmc: 0 },
          // TOB Breakdown
          tobs: {}
        }
        // Initialize specific TOBs
        tobList.forEach(t => { 
            typeGroups[typeName].tobs[t] = { 
                status: { active: 0, inactive: 0, maintenance: 0 },
                opCat: { fmc: 0, degraded: 0, nmc: 0 }
            } 
        })
      }

      // --- GLOBAL AGGREGATION ---
      const g = typeGroups[typeName]
      g.total++
      
      // Count Status
      if (status === 'Active') g.status.active++
      else if (status === 'Inactive') g.status.inactive++
      else if (status === 'Maintenance') g.status.maintenance++

      // Count Op Category
      if (opCat === 'Fully Mission Capable') g.opCat.fmc++
      else if (opCat === 'Degraded') g.opCat.degraded++
      else if (opCat === 'Non-Mission Capable') g.opCat.nmc++

      // --- TOB AGGREGATION ---
      if (!g.tobs[tob]) {
          g.tobs[tob] = { 
            status: { active: 0, inactive: 0, maintenance: 0 },
            opCat: { fmc: 0, degraded: 0, nmc: 0 }
        }
      }
      
      const t = g.tobs[tob]
      
      // TOB Status
      if (status === 'Active') t.status.active++
      else if (status === 'Inactive') t.status.inactive++
      else if (status === 'Maintenance') t.status.maintenance++

      // TOB Op Category
      if (opCat === 'Fully Mission Capable') t.opCat.fmc++
      else if (opCat === 'Degraded') t.opCat.degraded++
      else if (opCat === 'Non-Mission Capable') t.opCat.nmc++
    })

    // Sort alphabetically by type name
    setStats(Object.values(typeGroups).sort((a: any, b: any) => a.name.localeCompare(b.name)))
  }

  if (loading) return <div className="p-8 font-bold text-gray-800">Loading Fleet Intelligence...</div>

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mb-8">
        <button onClick={() => router.push('/')} className="flex items-center text-gray-700 font-bold mb-4 bg-white px-4 py-2 rounded shadow-sm border border-gray-300 hover:bg-gray-50">
          <ArrowLeft className="w-5 h-5 mr-2" /> Back to Dashboard
        </button>
        <h1 className="text-3xl font-black text-gray-900 flex items-center tracking-tight">
          <BarChart3 className="w-8 h-8 mr-3 text-purple-700" /> FLEET ANALYTICS REPORT
        </h1>
        <p className="text-gray-500 font-bold mt-1 ml-11">Real-time breakdown by Status & Operational Readiness</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {stats.map((typeStat) => (
          <div key={typeStat.name} className="bg-white rounded-xl shadow-lg border-t-8 border-blue-600 overflow-hidden">
            
            {/* CARD HEADER */}
            <div className="p-5 bg-gray-50 border-b border-gray-200 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              
              {/* Title Section */}
              <div>
                  <h2 className="text-2xl font-black text-gray-900 uppercase">{typeStat.name}</h2>
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Fleet: {typeStat.total} units</span>
              </div>
              
              {/* 2-ROW SUMMARY BUTTONS */}
              <div className="flex flex-col gap-2 items-start lg:items-end w-full lg:w-auto">
                  
                  {/* ROW 1: STATUS (Active, Inactive, Maint) */}
                  <div className="flex gap-2 w-full lg:w-auto">
                      <SummaryBadge label="ACTIVE" value={typeStat.status.active} color="bg-green-100 text-green-800 border-green-200" />
                      <SummaryBadge label="INACTIVE" value={typeStat.status.inactive} color="bg-red-100 text-red-800 border-red-200" />
                      <SummaryBadge label="MAINT" value={typeStat.status.maintenance} color="bg-orange-100 text-orange-800 border-orange-200" />
                  </div>

                  {/* ROW 2: READINESS (FMC, Degrad, NMC) */}
                  <div className="flex gap-2 w-full lg:w-auto">
                      <SummaryBadge label="FMC" value={typeStat.opCat.fmc} color="bg-green-100 text-green-800 border-green-200" />
                      <SummaryBadge label="DEGRAD" value={typeStat.opCat.degraded} color="bg-yellow-100 text-yellow-800 border-yellow-200" />
                      <SummaryBadge label="NMC" value={typeStat.opCat.nmc} color="bg-red-100 text-red-800 border-red-200" />
                  </div>

              </div>
            </div>

            {/* TABLE */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs md:text-sm text-left">
                <thead>
                  <tr className="bg-gray-100 text-gray-500 uppercase text-[10px] font-extrabold tracking-wider border-b border-gray-200">
                    <th className="px-4 py-3 text-left">Location</th>
                    {/* GROUP HEADER: STATUS */}
                    <th colSpan={3} className="px-2 py-3 text-center bg-blue-50/50 border-l border-r border-gray-200 text-blue-800">
                        Vehicle Status
                    </th>
                    {/* GROUP HEADER: READINESS */}
                    <th colSpan={3} className="px-2 py-3 text-center bg-purple-50/50 text-purple-800">
                        Operational Category
                    </th>
                  </tr>
                  <tr className="bg-gray-50 text-gray-700 font-bold border-b border-gray-200 text-[10px] uppercase">
                    <th className="px-4 py-2">TOB</th>
                    {/* Status Sub-headers */}
                    <th className="px-2 py-2 text-center text-green-700 border-l border-gray-200">Active</th>
                    <th className="px-2 py-2 text-center text-red-700">Inactive</th>
                    <th className="px-2 py-2 text-center text-orange-700 border-r border-gray-200">Maint</th>
                    {/* Readiness Sub-headers */}
                    <th className="px-2 py-2 text-center text-green-700">FMC</th>
                    <th className="px-2 py-2 text-center text-yellow-700">Degrad</th>
                    <th className="px-2 py-2 text-center text-red-700">NMC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tobList.map(tob => {
                    const data = typeStat.tobs[tob] || { status: {}, opCat: {} }
                    return (
                      <tr key={tob} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-4 py-3 font-bold text-gray-800 flex items-center">
                            <MapPin className="w-3 h-3 mr-1.5 text-gray-400" /> {tob}
                        </td>
                        
                        {/* STATUS COLUMNS */}
                        <td className="px-2 py-3 text-center font-bold text-green-700 border-l border-gray-100 bg-green-50/30">
                            {data.status.active || '-'}
                        </td>
                        <td className="px-2 py-3 text-center font-bold text-red-700 bg-red-50/30">
                            {data.status.inactive || '-'}
                        </td>
                        <td className="px-2 py-3 text-center font-bold text-orange-600 bg-orange-50/30 border-r border-gray-100">
                            {data.status.maintenance || '-'}
                        </td>

                        {/* READINESS COLUMNS */}
                        <td className="px-2 py-3 text-center font-bold text-green-700">
                            {data.opCat.fmc || '-'}
                        </td>
                        <td className="px-2 py-3 text-center font-bold text-yellow-600">
                            {data.opCat.degraded || '-'}
                        </td>
                        <td className="px-2 py-3 text-center font-bold text-red-700">
                            {data.opCat.nmc || '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Helper Component for the Header Badges
function SummaryBadge({ label, value, color }: any) {
    return (
        <div className={`flex-1 min-w-[60px] text-center px-2 py-1 rounded border ${color} flex flex-col justify-center`}>
            <p className="text-[9px] font-black uppercase opacity-80">{label}</p>
            <p className="text-sm font-black leading-none">{value}</p>
        </div>
    )
}