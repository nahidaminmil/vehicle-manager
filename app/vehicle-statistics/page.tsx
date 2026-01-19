"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Table, Lock } from 'lucide-react'

export default function StatisticsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  
  // Data State
  const [matrix, setMatrix] = useState<any[]>([]) 
  const [types, setTypes] = useState<any[]>([])   
  const [remarks, setRemarks] = useState<any>({}) 
  const [isAdmin, setIsAdmin] = useState(false)   
  
  // Hardcoded TOB list to ensure order and existence
  const tobList = ['NDROMO', 'BAYOO', 'RHOO', 'DRODRO'] 

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    // 1. Check User Role
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        if (profile && (profile.role === 'admin' || profile.role === 'super_admin')) {
            setIsAdmin(true)
        }
    }

    // 2. Fetch Vehicle Types (Columns)
    const { data: typeData } = await supabase.from('vehicle_types').select('*').order('name')
    setTypes(typeData || [])

    // 3. Fetch All Vehicles (To Count)
    const { data: vehicleData } = await supabase.from('vehicles').select('tob, vehicle_type_id')

    // 4. Fetch Remarks
    const { data: remarkData } = await supabase.from('tob_reports').select('*')
    const remarkMap: any = {}
    if (remarkData) {
        remarkData.forEach((r: any) => remarkMap[r.tob_name] = r.remark)
    }
    setRemarks(remarkMap)

    // 5. CALCULATE THE MATRIX
    const stats = tobList.map(tob => {
        const row: any = { tob_name: tob, total: 0 }
        
        typeData?.forEach((t: any) => {
            // Count matching vehicles
            const count = vehicleData?.filter(v => v.tob === tob && v.vehicle_type_id === t.id).length || 0
            row[t.id] = count
            row.total += count
        })
        return row
    })
    
    setMatrix(stats)
    setLoading(false)
  }

  // --- SAVE REMARK ON BLUR ---
  async function handleRemarkBlur(tob: string, value: string) {
    if (!isAdmin) return

    // Optimistic Update
    setRemarks((prev: any) => ({ ...prev, [tob]: value }))

    const { error } = await supabase
        .from('tob_reports')
        .upsert({ tob_name: tob, remark: value, updated_at: new Date() })
    
    if (error) console.error("Failed to save remark", error)
  }

  if (loading) return <div className="p-8 font-bold text-gray-800">Calculating Statistics...</div>

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      
      {/* HEADER */}
      <div className="mb-8">
        <button onClick={() => router.push('/')} className="flex items-center text-gray-700 font-bold mb-4 bg-white px-4 py-2 rounded shadow-sm border border-gray-300 hover:bg-gray-50">
          <ArrowLeft className="w-5 h-5 mr-2" /> Back to Dashboard
        </button>
        <h1 className="text-3xl font-black text-gray-900 flex items-center tracking-tight">
          <Table className="w-8 h-8 mr-3 text-blue-700" /> STATISTICS
        </h1>
        <p className="text-gray-500 font-bold mt-1 ml-11">Total Count by Location & Type</p>
      </div>

      {/* STATISTICS TABLE */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                {/* TABLE HEAD */}
                <thead className="bg-gray-800 text-white uppercase text-xs font-extrabold tracking-wider">
                    <tr>
                        <th className="px-6 py-4 border-r border-gray-700 min-w-[150px]">Location (TOB)</th>
                        {/* Dynamic Columns for Vehicle Types */}
                        {types.map(t => (
                            <th key={t.id} className="px-4 py-4 text-center border-r border-gray-700">{t.name}</th>
                        ))}
                        <th className="px-4 py-4 text-center bg-blue-900 border-r border-gray-700">TOTAL</th>
                        <th className="px-6 py-4 min-w-[200px]">Remarks (Admin Only)</th>
                    </tr>
                </thead>

                {/* TABLE BODY */}
                <tbody className="divide-y divide-gray-100">
                    {matrix.map((row) => (
                        <tr key={row.tob_name} className="hover:bg-blue-50 transition-colors font-bold text-gray-700">
                            
                            {/* TOB NAME */}
                            <td className="px-6 py-4 text-gray-900 font-black border-r border-gray-100 bg-gray-50">
                                {row.tob_name}
                            </td>

                            {/* COUNTS per TYPE */}
                            {types.map(t => (
                                <td key={t.id} className="px-4 py-4 text-center border-r border-gray-100">
                                    {row[t.id] > 0 ? (
                                        <span className="bg-blue-100 text-blue-800 py-1 px-3 rounded-full text-xs font-bold">
                                            {row[t.id]}
                                        </span>
                                    ) : (
                                        <span className="text-gray-300">-</span>
                                    )}
                                </td>
                            ))}

                            {/* ROW TOTAL */}
                            <td className="px-4 py-4 text-center bg-blue-50/50 border-r border-gray-100 text-blue-900 font-black text-base">
                                {row.total}
                            </td>

                            {/* REMARKS FIELD */}
                            <td className="px-4 py-3 relative">
                                {isAdmin ? (
                                    <input 
                                        type="text" 
                                        defaultValue={remarks[row.tob_name] || ''}
                                        onBlur={(e) => handleRemarkBlur(row.tob_name, e.target.value)}
                                        placeholder="Add remark..."
                                        className="w-full bg-yellow-50 border border-yellow-200 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-yellow-400 outline-none text-gray-800 font-bold"
                                    />
                                ) : (
                                    <div className="flex items-center text-xs text-gray-500 italic">
                                        {remarks[row.tob_name] ? (
                                            <span className="text-gray-800 not-italic">{remarks[row.tob_name]}</span>
                                        ) : (
                                            <><Lock className="w-3 h-3 mr-1"/> Locked</>
                                        )}
                                    </div>
                                )}
                            </td>
                        </tr>
                    ))}
                    
                    {/* GRAND TOTAL ROW */}
                    <tr className="bg-gray-100 border-t-2 border-gray-300">
                        <td className="px-6 py-4 font-black text-gray-900 uppercase">GRAND TOTAL</td>
                        {types.map(t => {
                            const colTotal = matrix.reduce((sum, row) => sum + (row[t.id] || 0), 0)
                            return (
                                <td key={t.id} className="px-4 py-4 text-center font-black text-gray-800">
                                    {colTotal}
                                </td>
                            )
                        })}
                        <td className="px-4 py-4 text-center font-black text-blue-900 text-lg bg-blue-200">
                             {matrix.reduce((sum, row) => sum + row.total, 0)}
                        </td>
                        <td></td>
                    </tr>
                </tbody>
            </table>
        </div>
      </div>
    </div>
  )
}