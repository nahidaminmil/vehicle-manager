"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, BarChart3, MapPin, Activity, Layers } from 'lucide-react'

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

      // Initialize Type Group if missing
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
      
      // Global Counts
      if (g.status[status] !== undefined) g.status[status]++
      if (g.opCat[opCat] !== undefined) g.opCat[opCat]++

      // TOB Counts
      if (g.tobs[tob]) {
          if (g.tobs[tob].status[status] !== undefined) g.tobs[tob].status[status]++
          if (g.tobs[tob].opCat[opCat] !== undefined) g.tobs[tob].opCat[opCat]++
      }
    })

    const sortedStats = Object.values(typeGroups).sort((a: any, b: any) => a.order - b.order)
    setStats(sortedStats)
  }

  // --- SPECIFIC COLOR THEMES ---
  const getColorTheme = (name: string) => {
      const n = name.toLowerCase()
      // Statuses
      if (n === 'active') return 'bg-green-100 text-green-900 border-green-300'
      if (n === 'inactive') return 'bg-red-100 text-red-900 border-red-300'
      if (n === 'maintenance') return 'bg-orange-100 text-orange-900 border-orange-300'
      
      // Op Categories
      if (n.includes('fully') || n.includes('fmc')) return 'bg-blue-100 text-blue-900 border-blue-300'
      if (n.includes('non') || n.includes('nmc')) return 'bg-red-100 text-red-900 border-red-300'
      if (n.includes('degraded')) return 'bg-amber-100 text-amber-900 border-amber-300' // Brown-ish/Amber
      
      // Default
      return 'bg-gray-100 text-gray-800 border-gray-200' 
  }

  if (loading) return <div className="p-8 font-bold text-gray-800 text-xl flex items-center"><Activity className="animate-spin mr-3 text-blue-600"/> Loading Analytics...</div>

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      
      {/* PAGE HEADER */}
      <div className="mb-8">
        <button onClick={() => router.push('/')} className="flex items-center text-slate-600 font-bold bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200 hover:bg-slate-100 mb-4 transition-all">
          <ArrowLeft className="w-5 h-5 mr-2" /> Back to Dashboard
        </button>
        <div className="flex items-center">
            <BarChart3 className="w-8 h-8 mr-3 text-indigo-600" />
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">FLEET ANALYTICS</h1>
                <p className="text-slate-500 font-bold text-sm">Real-time Operational Readiness Matrix</p>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {stats.map((typeStat) => (
          <div key={typeStat.name} className="bg-white rounded-xl shadow-lg border-t-8 border-indigo-600 overflow-hidden flex flex-col">
            
            {/* HEADER SECTION */}
            <div className="p-5 border-b border-gray-100">
                {/* Title & Total */}
                <div className="flex justify-between items-start mb-4">
                    <h2 className="text-2xl font-black text-slate-900 uppercase flex items-center">
                        <Layers className="w-6 h-6 mr-2 text-indigo-500"/> {typeStat.name}
                    </h2>
                    <div className="text-right">
                        <span className="block text-3xl font-black text-indigo-900">{typeStat.total}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Units</span>
                    </div>
                </div>

                {/* ROW 1: STATUSES */}
                <div className="mb-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Vehicle Status</p>
                    <div className="flex flex-wrap gap-2">
                        {statusList.map(s => (
                            <SummaryBadge key={s} label={s} value={typeStat.status[s]} theme={getColorTheme(s)} />
                        ))}
                    </div>
                </div>

                {/* ROW 2: OP CATEGORIES */}
                <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Operational Category</p>
                    <div className="flex flex-wrap gap-2">
                        {opCatList.map(o => (
                            <SummaryBadge key={o} label={o} value={typeStat.opCat[o]} theme={getColorTheme(o)} />
                        ))}
                    </div>
                </div>
            </div>

            {/* DYNAMIC TABLE */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs md:text-sm text-left">
                <thead>
                  {/* CATEGORY HEADERS */}
                  <tr className="bg-slate-50 text-slate-500 uppercase text-[9px] font-black tracking-widest border-b border-slate-200">
                    <th className="px-4 py-2 text-left border-r border-slate-200 bg-slate-100"></th>
                    <th colSpan={statusList.length} className="px-2 py-2 text-center bg-indigo-50/50 text-indigo-900 border-r border-indigo-100">Status</th>
                    <th colSpan={opCatList.length} className="px-2 py-2 text-center bg-blue-50/50 text-blue-900">Op Category</th>
                  </tr>
                  
                  {/* COLUMN HEADERS */}
                  <tr className="bg-white text-slate-600 font-bold border-b border-slate-200 text-[9px] md:text-[10px] uppercase">
                    <th className="px-4 py-2 border-r border-slate-100">TOB</th>
                    {statusList.map(s => <th key={s} className="px-2 py-2 text-center border-r border-slate-100 min-w-[50px]">{s}</th>)}
                    {opCatList.map(o => <th key={o} className="px-2 py-2 text-center border-r border-slate-100 min-w-[50px]">{o}</th>)}
                  </tr>
                </thead>
                
                <tbody className="divide-y divide-slate-50">
                  {tobList.map((tob, index) => {
                    const data = typeStat.tobs[tob] || { status: {}, opCat: {} }
                    const isEven = index % 2 === 0
                    return (
                      <tr key={tob} className={`${isEven ? 'bg-white' : 'bg-slate-50/30'} hover:bg-indigo-50/30 transition-colors`}>
                        {/* Location Name */}
                        <td className="px-4 py-3 font-bold text-slate-700 flex items-center border-r border-slate-100">
                            <MapPin className="w-3 h-3 mr-1.5 text-slate-400" /> {tob}
                        </td>
                        
                        {/* Status Columns */}
                        {statusList.map(s => {
                            const val = data.status[s] || 0
                            return (
                                <td key={s} className="px-2 py-3 text-center border-r border-slate-100 font-bold text-slate-600">
                                    {val > 0 ? <span className="text-slate-900 font-black">{val}</span> : <span className="text-slate-300">-</span>}
                                </td>
                            )
                        })}

                        {/* OpCat Columns */}
                        {opCatList.map(o => {
                            const val = data.opCat[o] || 0
                            return (
                                <td key={o} className="px-2 py-3 text-center border-r border-slate-100 font-bold text-slate-600">
                                    {val > 0 ? <span className="text-slate-900 font-black">{val}</span> : <span className="text-slate-300">-</span>}
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

function SummaryBadge({ label, value, theme }: any) {
    return (
        <div className={`min-w-[80px] text-center px-3 py-1.5 rounded-lg border flex flex-col justify-center shadow-sm ${theme}`}>
            <p className="text-[9px] font-black uppercase opacity-75 whitespace-nowrap mb-0.5">{label}</p>
            <p className="text-xl font-black leading-none">{value}</p>
        </div>
    )
}