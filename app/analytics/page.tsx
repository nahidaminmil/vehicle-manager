"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, BarChart3, MapPin } from 'lucide-react'

export default function AnalyticsPage() {
  const router = useRouter()
  const [stats, setStats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const tobList = ['NDROMO', 'BAYOO', 'RHOO', 'DRODRO']

  useEffect(() => {
    async function fetchStats() {
      // FIX: Read from the stable View instead of trying to join tables manually
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
      // Use the View's flattened column name
      const typeName = v.vehicle_type_name || 'Unknown' 
      const tob = v.tob || 'Unknown'
      const status = v.status || 'Active'

      if (!typeGroups[typeName]) {
        typeGroups[typeName] = {
          name: typeName,
          total: 0,
          active: 0,
          inactive: 0,
          tobs: {}
        }
        tobList.forEach(t => { typeGroups[typeName].tobs[t] = { active: 0, inactive: 0, total: 0 } })
        typeGroups[typeName].tobs['Unknown'] = { active: 0, inactive: 0, total: 0 }
      }

      typeGroups[typeName].total++
      if (status === 'Active') typeGroups[typeName].active++
      else typeGroups[typeName].inactive++

      if (!typeGroups[typeName].tobs[tob]) typeGroups[typeName].tobs[tob] = { active: 0, inactive: 0, total: 0 }
      
      typeGroups[typeName].tobs[tob].total++
      if (status === 'Active') typeGroups[typeName].tobs[tob].active++
      else typeGroups[typeName].tobs[tob].inactive++
    })

    setStats(Object.values(typeGroups))
  }

  if (loading) return <div className="p-8 font-bold text-gray-800">Loading Report...</div>

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="mb-6">
        <button onClick={() => router.push('/')} className="flex items-center text-gray-800 font-bold mb-4 bg-white px-4 py-2 rounded shadow-sm border border-gray-300">
          <ArrowLeft className="w-5 h-5 mr-2" /> Back to Dashboard
        </button>
        <h1 className="text-2xl font-extrabold text-gray-900 flex items-center">
          <BarChart3 className="w-8 h-8 mr-2 text-purple-700" /> Fleet Analytics Report
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((typeStat) => (
          <div key={typeStat.name} className="bg-white rounded-lg shadow-md border-t-4 border-blue-600 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <h2 className="text-xl font-black text-gray-900 uppercase">{typeStat.name}</h2>
              <div className="flex gap-4 mt-2 text-sm">
                <span className="font-bold text-gray-800">Total: {typeStat.total}</span>
                <span className="font-bold text-green-700">Active: {typeStat.active}</span>
                <span className="font-bold text-red-700">Inactive: {typeStat.inactive}</span>
              </div>
            </div>
            <div className="p-0">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-100 text-gray-900 font-bold">
                  <tr>
                    <th className="px-4 py-2">TOB</th>
                    <th className="px-4 py-2 text-center">Active</th>
                    <th className="px-4 py-2 text-center">Inactive</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tobList.map(tob => {
                    const data = typeStat.tobs[tob]
                    return (
                      <tr key={tob} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-bold text-gray-800 flex items-center"><MapPin className="w-3 h-3 mr-1 text-gray-400" /> {tob}</td>
                        <td className="px-4 py-2 text-center font-bold text-green-700 bg-green-50/50">{data?.active || 0}</td>
                        <td className="px-4 py-2 text-center font-bold text-red-700 bg-red-50/50">{data?.inactive || 0}</td>
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