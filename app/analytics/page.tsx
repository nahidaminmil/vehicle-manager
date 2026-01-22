"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, BarChart3, MapPin, Layers, Activity } from 'lucide-react'

export default function AnalyticsPage() {
  const router = useRouter()
  const [stats, setStats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // --- DYNAMIC LISTS ---
  const [tobList, setTobList] = useState<string[]>([])
  const [statusList, setStatusList] = useState<string[]>([]) 
  const [opCatList, setOpCatList] = useState<string[]>([])   

  useEffect(() => {
    async function fetchStats() {
      // 1. Fetch Dynamic Definitions
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
      else processData(vehicles || [], sortMap, locations, statuses, opCats)
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

      if (!typeGroups[typeName]) {
        typeGroups[typeName] = {
          name: typeName,
          order: sortMap[typeName] !== undefined ? sortMap[typeName] : 99, 
          total: 0,
          status: {}, 
          opCat: {},
          tobs: {}
        }
        
        statuses.forEach(s => typeGroups[typeName].status[s] = 0)
        opCats.forEach(o => typeGroups[typeName].opCat[o] = 0)

        locations.forEach(t => { 
            typeGroups[typeName].tobs[t] = { status: {}, opCat: {} }
            statuses.forEach(s => typeGroups[typeName].tobs[t].status[s] = 0)
            opCats.forEach(o => typeGroups[typeName].tobs[t].opCat[o] = 0)
        })
      }

      const g = typeGroups[typeName]
      g.total++
      
      if (g.status[status] !== undefined) g.status[status]++
      if (g.opCat[opCat] !== undefined) g.opCat[opCat]++

      if (g.tobs[tob]) {
          if (g.tobs[tob].status[status] !== undefined) g.tobs[tob].status[status]++
          if (g.tobs[tob].opCat[opCat] !== undefined) g.tobs[tob].opCat[opCat]++
      }
    })

    const sortedStats = Object.values(typeGroups).sort((a: any, b: any) => a.order - b.order)
    setStats(sortedStats)
  }

  // --- 1. BADGE THEME (Header) ---
  const getBadgeTheme = (name: string) => {
      const n = name.toLowerCase()
      // VEHICLE STATUSES
      if (n === 'active') return 'bg-green-100 text-green-900 border-green-300' 
      if (n === 'inactive') return 'bg-red-100 text-red-900 border-red-300'
      if (n === 'maintenance') return 'bg-orange-100 text-orange-900 border-orange-300'
      
      // OPERATIONAL CATEGORIES
      if (n.includes('fully') || n.includes('fmc')) return 'bg-blue-100 text-blue-900 border-blue-300' // Blue
      if (n.includes('non') || n.includes('nmc')) return 'bg-red-100 text-red-900 border-red-300'   // Red
      if (n.includes('degraded')) return 'bg-amber-200 text-amber-900 border-amber-400'             // Brown/Amber
      
      return 'bg-gray-100 text-gray-800 border-gray-200' // Default
  }

  // --- 2. COLUMN THEME (Table) ---
  const getColumnTheme = (name: string) => {
      const n = name.toLowerCase()
      // VEHICLE STATUSES (Light Backgrounds)
      if (n === 'active') return 'bg-green-50/60 border-green-100 text-green-900'
      if (n === 'inactive') return 'bg-red-50/60 border-red-100 text-red-900'
      if (n === 'maintenance') return 'bg-orange-50/60 border-orange-100 text-orange-900'
      
      // OPERATIONAL CATEGORIES (Light Backgrounds)
      if (n.includes('fully') || n.includes('fmc')) return 'bg-blue-50/60 border-blue-100 text-blue-900'
      if (n.includes('non') || n.includes('nmc')) return 'bg-red-50/60 border-red-100 text-red-900'
      if (n.includes('degraded')) return 'bg-amber-100/60 border-amber-200 text-amber-900'
      
      return 'bg-gray-50 border-gray-100 text-gray-600'
  }

  if (loading) return <div className="p-8 font-bold text-gray-800 text-xl flex items-center"><Activity className="animate-spin mr-3 text-blue-600"/> Loading Analytics...</div>

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      
      {/* PAGE HEADER */}
      <div className="mb-8">
        <button onClick={() => router.push('/')} className="flex items-center text-slate-600 font-bold bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200 hover:bg-slate-100 mb-4 transition-all">
          <ArrowLeft className="w-5 h-5 mr-2" /> Back to Dashboard
        </button>
        <div className="flex items-center">
            <BarChart3 className="w-8 h-8 mr-3 text-indigo-700" />
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">FLEET ANALYTICS</h1>
                <p className="text-slate-500 font-bold text-sm">Real-time Operational Readiness Matrix</p>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {stats.map((typeStat) => (
          <div key={typeStat.name} className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden flex flex-col">
            
            {/* --- GRADIENT BANNER HEADER --- */}
            <div className="bg-gradient-to-r from-blue-900 to-indigo-900 p-5 text-white flex justify-between items-center relative overflow-hidden shadow-md">
                {/* Decorative glow */}
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -mr-10 -mt-10 blur-3xl"></div>
                
                <div className="z-10 flex items-center">
                    <Layers className="w-6 h-6 mr-3 text-blue-300"/>
                    <h2 className="text-2xl font-black uppercase tracking-wide">{typeStat.name}</h2>
                </div>
                <div className="z-10 text-right">
                    <span className="block text-4xl font-black tracking-tighter text-white">{typeStat.total}</span>
                    <span className="text-[10px] font-bold text-blue-200 uppercase tracking-widest">Units</span>
                </div>
            </div>

            {/* SUMMARY BADGES SECTION */}
            <div className="p-5 border-b border-gray-100 bg-white space-y-4">
                
                {/* ROW 1: STATUSES */}
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wide">Vehicle Status</p>
                    <div className="flex flex-wrap gap-2">
                        {statusList.map(s => (
                            <SummaryBadge key={s} label={s} value={typeStat.status[s]} theme={getBadgeTheme(s)} />
                        ))}
                    </div>
                </div>

                {/* ROW 2: OP CATEGORIES */}
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wide">Operational Category</p>
                    <div className="flex flex-wrap gap-2">
                        {opCatList.map(o => (
                            <SummaryBadge key={o} label={o} value={typeStat.opCat[o]} theme={getBadgeTheme(o)} />
                        ))}
                    </div>
                </div>
            </div>

            {/* DYNAMIC COLORED TABLE */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs md:text-sm text-left border-collapse">
                <thead>
                  {/* CATEGORY HEADERS */}
                  <tr className="bg-slate-50 text-slate-500 uppercase text-[9px] font-black tracking-widest border-b border-slate-200">
                    <th className="px-4 py-2 text-left border-r border-slate-200 bg-slate-100"></th>
                    <th colSpan={statusList.length} className="px-2 py-2 text-center bg-indigo-50/50 text-indigo-900 border-r border-indigo-100">Status Breakdown</th>
                    <th colSpan={opCatList.length} className="px-2 py-2 text-center bg-blue-50/50 text-blue-900">Readiness Breakdown</th>
                  </tr>
                  
                  {/* COLUMN HEADERS */}
                  <tr className="bg-white text-slate-600 font-bold border-b border-slate-200 text-[9px] md:text-[10px] uppercase">
                    <th className="px-4 py-3 border-r border-slate-200">TOB</th>
                    {statusList.map(s => <th key={s} className={`px-2 py-2 text-center border-r border-gray-100 ${getColumnTheme(s)}`}>{s}</th>)}
                    {opCatList.map(o => <th key={o} className={`px-2 py-2 text-center border-r border-gray-100 ${getColumnTheme(o)}`}>{o}</th>)}
                  </tr>
                </thead>
                
                <tbody className="divide-y divide-slate-100">
                  {tobList.map((tob, index) => {
                    const data = typeStat.tobs[tob] || { status: {}, opCat: {} }
                    return (
                      <tr key={tob} className="hover:bg-gray-50 transition-colors">
                        {/* Location Name */}
                        <td className="px-4 py-3 font-bold text-slate-700 flex items-center border-r border-slate-200 bg-white">
                            <MapPin className="w-3 h-3 mr-1.5 text-slate-400" /> {tob}
                        </td>
                        
                        {/* Status Columns (Colored) */}
                        {statusList.map(s => {
                            const val = data.status[s] || 0
                            return (
                                <td key={s} className={`px-2 py-3 text-center border-r border-white/50 font-bold ${getColumnTheme(s)}`}>
                                    {val > 0 ? <span className="scale-110 inline-block text-black">{val}</span> : <span className="opacity-20">-</span>}
                                </td>
                            )
                        })}

                        {/* OpCat Columns (Colored) */}
                        {opCatList.map(o => {
                            const val = data.opCat[o] || 0
                            return (
                                <td key={o} className={`px-2 py-3 text-center border-r border-white/50 font-bold ${getColumnTheme(o)}`}>
                                    {val > 0 ? <span className="scale-110 inline-block text-black">{val}</span> : <span className="opacity-20">-</span>}
                                </td>
                            )
                        })}
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

// Reusable Badge Component
function SummaryBadge({ label, value, theme }: any) {
    return (
        <div className={`min-w-[80px] text-center px-3 py-2 rounded-lg border flex flex-col justify-center shadow-sm ${theme}`}>
            <p className="text-[9px] font-black uppercase opacity-75 whitespace-nowrap mb-0.5">{label}</p>
            <p className="text-xl font-black leading-none">{value}</p>
        </div>
    )
}