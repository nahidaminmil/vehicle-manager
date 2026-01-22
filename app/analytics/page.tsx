"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, BarChart3, MapPin } from 'lucide-react'

export default function AnalyticsPage() {
  const router = useRouter()
  const [stats, setStats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // --- DYNAMIC LISTS ---
  const [tobList, setTobList] = useState<string[]>([])
  const [statusList, setStatusList] = useState<string[]>([]) // <--- NEW
  const [opCatList, setOpCatList] = useState<string[]>([])   // <--- NEW

  useEffect(() => {
    async function fetchStats() {
      // 1. Fetch ALL Dynamic Definitions
      const { data: locData } = await supabase.from('locations').select('name').order('sort_order')
      const { data: statData } = await supabase.from('vehicle_statuses').select('name').order('sort_order')
      const { data: opData } = await supabase.from('operational_categories').select('name').order('sort_order')
      
      const locations = locData ? locData.map((l: any) => l.name) : []
      const statuses = statData ? statData.map((s: any) => s.name) : []
      const opCats = opData ? opData.map((o: any) => o.name) : []

      setTobList(locations)
      setStatusList(statuses)
      setOpCatList(opCats)

      // 2. Fetch Types (for sorting)
      const { data: typeData } = await supabase.from('vehicle_types').select('name, sort_order')
      const sortMap: any = {}
      if (typeData) {
          typeData.forEach((t: any) => { sortMap[t.name] = t.sort_order })
      }

      // 3. Fetch Vehicle Data
      const { data: vehicles, error } = await supabase.from('vehicle_dashboard_view').select('*')

      if (error) console.error(error)
      else processData(vehicles || [], sortMap, locations, statuses, opCats) // Pass all dynamic lists
      setLoading(false)
    }
    fetchStats()
  }, [])

  function processData(vehicles: any[], sortMap: any, locations: string[], statuses: string[], opCats: string[]) {
    const typeGroups: any = {}

    vehicles.forEach(v => {
      const typeName = v.vehicle_type_name || 'Unknown'
      const tob = v.tob || 'Unknown'
      const status = v.status || 'Unknown'
      const opCat = v.operational_category || 'Unknown'

      // Initialize Type Group if missing
      if (!typeGroups[typeName]) {
        typeGroups[typeName] = {
          name: typeName,
          order: sortMap[typeName] !== undefined ? sortMap[typeName] : 99, 
          total: 0,
          // Initialize counters for dynamic columns
          status: {}, 
          opCat: {},
          tobs: {}
        }
        
        // Zero fill global counters
        statuses.forEach(s => typeGroups[typeName].status[s] = 0)
        opCats.forEach(o => typeGroups[typeName].opCat[o] = 0)

        // Initialize specific TOBs
        locations.forEach(t => { 
            typeGroups[typeName].tobs[t] = { status: {}, opCat: {} }
            statuses.forEach(s => typeGroups[typeName].tobs[t].status[s] = 0)
            opCats.forEach(o => typeGroups[typeName].tobs[t].opCat[o] = 0)
        })
      }

      const g = typeGroups[typeName]
      g.total++
      
      // Global Counts (safely handle unknown statuses by ignoring or defaulting)
      if (g.status[status] !== undefined) g.status[status]++
      if (g.opCat[opCat] !== undefined) g.opCat[opCat]++

      // TOB Counts
      if (g.tobs[tob]) {
          if (g.tobs[tob].status[status] !== undefined) g.tobs[tob].status[status]++
          if (g.tobs[tob].opCat[opCat] !== undefined) g.tobs[tob].opCat[opCat]++
      }
    })

    // Sort by database order
    const sortedStats = Object.values(typeGroups).sort((a: any, b: any) => a.order - b.order)
    setStats(sortedStats)
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
            <div className="p-5 bg-gray-50 border-b border-gray-200 flex flex-col justify-between items-start gap-4">
              <div>
                  <h2 className="text-2xl font-black text-gray-900 uppercase">{typeStat.name}</h2>
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Fleet: {typeStat.total} units</span>
              </div>
              
              {/* DYNAMIC SUMMARY BADGES */}
              <div className="flex flex-wrap gap-2 w-full">
                  {statusList.map(s => (
                      <SummaryBadge key={s} label={s} value={typeStat.status[s]} color="bg-gray-100 text-gray-800 border-gray-200" />
                  ))}
              </div>
            </div>

            {/* DYNAMIC TABLE */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs md:text-sm text-left">
                <thead>
                  <tr className="bg-gray-100 text-gray-500 uppercase text-[10px] font-extrabold tracking-wider border-b border-gray-200">
                    <th className="px-4 py-3 text-left bg-gray-50 border-r border-gray-200">Location</th>
                    <th colSpan={statusList.length} className="px-2 py-3 text-center bg-blue-50/50 text-blue-800 border-r border-gray-200">Vehicle Status</th>
                    <th colSpan={opCatList.length} className="px-2 py-3 text-center bg-purple-50/50 text-purple-800">Op Category</th>
                  </tr>
                  <tr className="bg-gray-50 text-gray-700 font-bold border-b border-gray-200 text-[10px] uppercase">
                    <th className="px-4 py-2 border-r border-gray-200">TOB</th>
                    {/* Dynamic Status Headers */}
                    {statusList.map(s => <th key={s} className="px-2 py-2 text-center border-r border-gray-100">{s}</th>)}
                    {/* Dynamic OpCat Headers */}
                    {opCatList.map(o => <th key={o} className="px-2 py-2 text-center border-r border-gray-100">{o}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tobList.map(tob => {
                    const data = typeStat.tobs[tob] || { status: {}, opCat: {} }
                    return (
                      <tr key={tob} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-4 py-3 font-bold text-gray-800 flex items-center border-r border-gray-100 bg-gray-50">
                            <MapPin className="w-3 h-3 mr-1.5 text-gray-400" /> {tob}
                        </td>
                        
                        {/* Dynamic Status Cells */}
                        {statusList.map(s => (
                            <td key={s} className="px-2 py-3 text-center font-bold text-gray-600 border-r border-gray-100">
                                {data.status[s] > 0 ? data.status[s] : '-'}
                            </td>
                        ))}

                        {/* Dynamic OpCat Cells */}
                        {opCatList.map(o => (
                            <td key={o} className="px-2 py-3 text-center font-bold text-gray-600 border-r border-gray-100">
                                {data.opCat[o] > 0 ? data.opCat[o] : '-'}
                            </td>
                        ))}
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

function SummaryBadge({ label, value, color }: any) {
    return (
        <div className={`min-w-[60px] text-center px-2 py-1 rounded border ${color} flex flex-col justify-center`}>
            <p className="text-[9px] font-black uppercase opacity-80 whitespace-nowrap">{label}</p>
            <p className="text-sm font-black leading-none">{value}</p>
        </div>
    )
}