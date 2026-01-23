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

  // --- SMART COLOR GENERATOR ---
  const generateColor = (str: string) => {
      const n = str.toLowerCase()
      
      // 1. STATUS MATCHES
      if (n === 'active') return { bg: 'bg-emerald-100', text: 'text-emerald-900', border: 'border-emerald-300', light: 'bg-emerald-50/50' }
      if (n === 'inactive') return { bg: 'bg-rose-100', text: 'text-rose-900', border: 'border-rose-300', light: 'bg-rose-50/50' }
      if (n === 'maintenance') return { bg: 'bg-orange-100', text: 'text-orange-900', border: 'border-orange-300', light: 'bg-orange-50/50' }
      
      // 2. OP CAT MATCHES
      if (n.includes('fully') || n.includes('fmc')) return { bg: 'bg-blue-100', text: 'text-blue-900', border: 'border-blue-300', light: 'bg-blue-50/50' }
      if (n.includes('non') || n.includes('nmc')) return { bg: 'bg-red-100', text: 'text-red-900', border: 'border-red-300', light: 'bg-red-50/50' }
      if (n.includes('degraded')) return { bg: 'bg-amber-100', text: 'text-amber-900', border: 'border-amber-300', light: 'bg-amber-50/50' }

      // 3. DYNAMIC FALLBACK
      const colors = [
          { bg: 'bg-violet-100', text: 'text-violet-900', border: 'border-violet-300', light: 'bg-violet-50/50' },
          { bg: 'bg-cyan-100', text: 'text-cyan-900', border: 'border-cyan-300', light: 'bg-cyan-50/50' },
          { bg: 'bg-fuchsia-100', text: 'text-fuchsia-900', border: 'border-fuchsia-300', light: 'bg-fuchsia-50/50' },
          { bg: 'bg-lime-100', text: 'text-lime-900', border: 'border-lime-300', light: 'bg-lime-50/50' },
      ]
      const index = str.length % colors.length
      return colors[index]
  }

  if (loading) return <div className="p-8 font-bold text-gray-800 text-xl flex items-center"><Activity className="animate-spin mr-3 text-blue-600"/> Loading Analytics...</div>

  return (
    <div className="min-h-screen bg-slate-50 p-3 md:p-8">
      
      {/* PAGE HEADER */}
      <div className="mb-8">
        <button onClick={() => router.push('/')} className="flex items-center text-slate-600 font-bold bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200 hover:bg-slate-100 mb-4 transition-all">
          <ArrowLeft className="w-5 h-5 mr-2" /> Back to Dashboard
        </button>
        <div className="flex items-center">
            <div className="p-3 bg-indigo-600 rounded-lg shadow-lg mr-4">
                <BarChart3 className="w-8 h-8 text-white" />
            </div>
            <div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">FLEET ANALYTICS</h1>
                <p className="text-slate-500 font-bold text-xs md:text-sm">Real-time Operational Readiness Matrix</p>
            </div>
        </div>
      </div>

      <div className="space-y-12">
        {stats.map((typeStat) => (
          <div key={typeStat.name} className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col">
            
            {/* --- CARD HEADER --- */}
            <div className="bg-slate-900 p-4 md:p-6 text-white flex flex-col md:flex-row justify-between items-start md:items-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none"></div>
                <div className="z-10 flex items-center mb-4 md:mb-0">
                    <Layers className="w-6 h-6 mr-3 text-indigo-400"/>
                    <h2 className="text-xl md:text-2xl font-black uppercase tracking-wide">{typeStat.name}</h2>
                </div>
                <div className="z-10 flex items-center bg-white/10 px-4 py-2 rounded-lg backdrop-blur-sm border border-white/10">
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mr-3">Total Fleet</span>
                    <span className="block text-2xl font-black text-white">{typeStat.total}</span>
                </div>
            </div>

            {/* --- ORGANIZED SUMMARY GRID --- */}
            <div className="p-4 md:p-6 bg-slate-50/50 border-b border-slate-200">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Status Group */}
                    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-3 flex items-center">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span> Vehicle Status Breakdown
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {statusList.map(s => {
                                const colors = generateColor(s)
                                return <SummaryBadge key={s} label={s} value={typeStat.status[s]} colors={colors} />
                            })}
                        </div>
                    </div>

                    {/* Readiness Group */}
                    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-3 flex items-center">
                            <span className="w-2 h-2 rounded-full bg-blue-500 mr-2"></span> Readiness Breakdown
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {opCatList.map(o => {
                                const colors = generateColor(o)
                                return <SummaryBadge key={o} label={o} value={typeStat.opCat[o]} colors={colors} />
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* --- STICKY TABLE --- */}
            <div className="overflow-x-auto relative">
              <table className="w-full text-xs md:text-sm text-left border-collapse">
                <thead>
                  {/* Super Header - INCREASED FONT SIZE (text-xs to text-sm) */}
                  <tr className="bg-slate-100 text-slate-600 uppercase text-xs md:text-sm font-black tracking-widest border-b border-slate-300">
                    <th className="sticky left-0 z-20 bg-slate-100 px-4 py-3 text-left border-r border-slate-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Location</th>
                    <th colSpan={statusList.length} className="px-2 py-3 text-center bg-emerald-50/50 text-emerald-900 border-r-4 border-white">Status</th>
                    <th colSpan={opCatList.length} className="px-2 py-3 text-center bg-blue-50/50 text-blue-900">Readiness</th>
                  </tr>
                  
                  {/* Column Headers */}
                  <tr className="bg-white text-slate-600 font-bold border-b border-slate-200 text-[9px] md:text-[10px] uppercase">
                    <th className="sticky left-0 z-20 bg-white px-4 py-3 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">TOB Name</th>
                    {statusList.map((s, i) => {
                        const c = generateColor(s)
                        return (
                            <th key={s} className={`px-2 py-3 text-center border-r border-slate-100 min-w-[70px] ${c.light} ${c.text} ${i === statusList.length -1 ? 'border-r-4 border-r-white' : ''}`}>
                                {s}
                            </th>
                        )
                    })}
                    {opCatList.map(o => {
                        const c = generateColor(o)
                        return (
                            <th key={o} className={`px-2 py-3 text-center border-r border-slate-100 min-w-[70px] ${c.light} ${c.text}`}>
                                {o}
                            </th>
                        )
                    })}
                  </tr>
                </thead>
                
                <tbody className="divide-y divide-slate-100">
                  {tobList.map((tob, index) => {
                    const data = typeStat.tobs[tob] || { status: {}, opCat: {} }
                    const rowClass = index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                    
                    return (
                      <tr key={tob} className={`${rowClass} hover:bg-indigo-50/10 transition-colors`}>
                        {/* Sticky Location */}
                        <td className={`sticky left-0 z-10 px-4 py-3 font-bold text-slate-700 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ${rowClass}`}>
                            <div className="flex items-center whitespace-nowrap"><MapPin className="w-3 h-3 mr-2 text-indigo-400" /> {tob}</div>
                        </td>
                        
                        {/* Status Columns */}
                        {statusList.map((s, i) => {
                            const val = data.status[s] || 0
                            const c = generateColor(s)
                            const isLast = i === statusList.length - 1
                            return (
                                <td key={s} className={`px-2 py-3 text-center font-bold ${c.light} ${c.text} ${isLast ? 'border-r-4 border-r-white' : 'border-r border-white'}`}>
                                    {val > 0 ? <span className="scale-110 inline-block">{val}</span> : <span className="opacity-10">-</span>}
                                </td>
                            )
                        })}

                        {/* OpCat Columns */}
                        {opCatList.map(o => {
                            const val = data.opCat[o] || 0
                            const c = generateColor(o)
                            return (
                                <td key={o} className={`px-2 py-3 text-center font-bold border-r border-white ${c.light} ${c.text}`}>
                                    {val > 0 ? <span className="scale-110 inline-block">{val}</span> : <span className="opacity-10">-</span>}
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

function SummaryBadge({ label, value, colors }: any) {
    return (
        <div className={`flex flex-col items-center justify-center p-2 rounded border ${colors.bg} ${colors.border} ${colors.text}`}>
            <span className="text-xl font-black leading-none mb-1">{value}</span>
            <span className="text-[8px] font-bold uppercase opacity-70 text-center leading-tight">{label}</span>
        </div>
    )
}