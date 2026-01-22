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

  // --- SMART COLOR LOGIC ---
  const getColorTheme = (name: string) => {
      const n = name.toLowerCase()
      if (n.includes('active') || n.includes('fully') || n.includes('fmc')) return 'bg-emerald-100 text-emerald-800 border-emerald-200'
      if (n.includes('inactive') || n.includes('non') || n.includes('nmc')) return 'bg-rose-100 text-rose-800 border-rose-200'
      if (n.includes('maint') || n.includes('repair')) return 'bg-amber-100 text-amber-800 border-amber-200'
      if (n.includes('degrad')) return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      return 'bg-indigo-50 text-indigo-700 border-indigo-100' // Default cool blue
  }

  const getPillColor = (name: string, count: number) => {
      if (count === 0) return 'text-gray-300 font-normal' // Fade out zeros
      
      const n = name.toLowerCase()
      if (n.includes('active') || n.includes('fully') || n.includes('fmc')) return 'bg-emerald-500 text-white shadow-sm'
      if (n.includes('inactive') || n.includes('non') || n.includes('nmc')) return 'bg-rose-500 text-white shadow-sm'
      if (n.includes('maint') || n.includes('repair')) return 'bg-amber-500 text-white shadow-sm'
      if (n.includes('degrad')) return 'bg-yellow-400 text-yellow-900 shadow-sm'
      return 'bg-indigo-500 text-white shadow-sm'
  }

  if (loading) return <div className="p-8 font-bold text-gray-800 text-xl flex items-center"><Activity className="animate-spin mr-3 text-blue-600"/> Analysing Fleet Data...</div>

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      
      {/* PAGE HEADER */}
      <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-4xl font-black text-slate-900 flex items-center tracking-tight">
            <BarChart3 className="w-10 h-10 mr-3 text-indigo-600" /> FLEET ANALYTICS
            </h1>
            <p className="text-slate-500 font-bold mt-2 ml-14 text-lg">Real-time Operational Readiness Matrix</p>
        </div>
        <button onClick={() => router.push('/')} className="flex items-center text-slate-600 font-bold bg-white px-5 py-3 rounded-xl shadow-sm border border-slate-200 hover:bg-slate-100 transition-all">
          <ArrowLeft className="w-5 h-5 mr-2" /> Dashboard
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
        {stats.map((typeStat) => (
          <div key={typeStat.name} className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 flex flex-col">
            
            {/* GRADIENT CARD HEADER */}
            <div className="p-6 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                  <h2 className="text-2xl font-black uppercase tracking-wide flex items-center">
                      <Layers className="w-6 h-6 mr-3 text-indigo-400"/> {typeStat.name}
                  </h2>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-9 bg-slate-800 px-2 py-1 rounded-full">
                      Total Fleet: {typeStat.total} units
                  </span>
              </div>
              
              {/* SUMMARY BADGES */}
              <div className="flex flex-wrap gap-2">
                  {statusList.map(s => (
                      <SummaryBadge key={s} label={s} value={typeStat.status[s]} theme={getColorTheme(s)} />
                  ))}
              </div>
            </div>

            {/* DYNAMIC TABLE */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  {/* CATEGORY HEADERS */}
                  <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black tracking-widest border-b border-slate-200">
                    <th className="px-6 py-3 text-left border-r border-slate-200 bg-slate-100">Location</th>
                    <th colSpan={statusList.length} className="px-2 py-3 text-center bg-indigo-50/50 text-indigo-900 border-r border-indigo-100">Vehicle Status</th>
                    <th colSpan={opCatList.length} className="px-2 py-3 text-center bg-emerald-50/50 text-emerald-900">Operational Category</th>
                  </tr>
                  
                  {/* COLUMN HEADERS */}
                  <tr className="bg-white text-slate-600 font-bold border-b border-slate-200 text-[10px] uppercase">
                    <th className="px-6 py-3 border-r border-slate-100">TOB Name</th>
                    {statusList.map(s => <th key={s} className="px-2 py-3 text-center border-r border-slate-100 min-w-[60px]">{s}</th>)}
                    {opCatList.map(o => <th key={o} className="px-2 py-3 text-center border-r border-slate-100 min-w-[60px]">{o}</th>)}
                  </tr>
                </thead>
                
                <tbody className="divide-y divide-slate-50">
                  {tobList.map((tob, index) => {
                    const data = typeStat.tobs[tob] || { status: {}, opCat: {} }
                    const isEven = index % 2 === 0
                    return (
                      <tr key={tob} className={`${isEven ? 'bg-white' : 'bg-slate-50/50'} hover:bg-indigo-50/30 transition-colors`}>
                        {/* Location Name */}
                        <td className="px-6 py-4 font-black text-slate-700 flex items-center border-r border-slate-100">
                            <MapPin className="w-4 h-4 mr-2 text-slate-400" /> {tob}
                        </td>
                        
                        {/* Status Pills */}
                        {statusList.map(s => {
                            const val = data.status[s] || 0
                            return (
                                <td key={s} className="px-2 py-3 text-center border-r border-slate-100">
                                    <span className={`inline-flex items-center justify-center w-8 h-6 rounded-md text-xs font-black ${getPillColor(s, val)}`}>
                                        {val > 0 ? val : '-'}
                                    </span>
                                </td>
                            )
                        })}

                        {/* OpCat Pills */}
                        {opCatList.map(o => {
                            const val = data.opCat[o] || 0
                            return (
                                <td key={o} className="px-2 py-3 text-center border-r border-slate-100">
                                    <span className={`inline-flex items-center justify-center w-8 h-6 rounded-md text-xs font-black ${getPillColor(o, val)}`}>
                                        {val > 0 ? val : '-'}
                                    </span>
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
        <div className={`min-w-[70px] text-center px-3 py-1.5 rounded-lg border flex flex-col justify-center shadow-sm ${theme}`}>
            <p className="text-[10px] font-black uppercase opacity-75 whitespace-nowrap mb-0.5">{label}</p>
            <p className="text-lg font-black leading-none">{value}</p>
        </div>
    )
}