'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Car, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'

export default function Dashboard() {
  const [vehicles, setVehicles] = useState<any[]>([])
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, critical: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    // 1. Fetch data from the SQL View we created
    const { data, error } = await supabase
      .from('vehicle_dashboard_view')
      .select('*')
    
    if (error) console.error('Error:', error)
    else {
      setVehicles(data)
      calculateStats(data)
    }
    setLoading(false)
  }

  function calculateStats(data: any[]) {
    const total = data.length
    const active = data.filter(v => v.status === 'Active').length
    const inactive = data.filter(v => v.status === 'Inactive').length
    // Count critical issues (using the logic from our SQL view)
    const critical = data.filter(v => v.has_critical_fault).length
    setStats({ total, active, inactive, critical })
  }

  if (loading) return <div className="p-10">Loading Dashboard...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Vehicle Management System</h1>
        <p className="text-gray-500">BANRDB, MONUSCO</p>
      </header>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Vehicles" value={stats.total} icon={<Car />} color="bg-blue-500" />
        <StatCard title="Active" value={stats.active} icon={<CheckCircle />} color="bg-green-500" />
        <StatCard title="Inactive" value={stats.inactive} icon={<XCircle />} color="bg-red-500" />
        <StatCard title="Critical Attention" value={stats.critical} icon={<AlertTriangle />} color="bg-orange-500" />
      </div>

      {/* VEHICLE LIST TABLE */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location (TOB)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days Inactive</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {vehicles.map((vehicle: any[]) => (
              <tr key={vehicle.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap font-medium">{vehicle.vehicle_uid}</td>
                <td className="px-6 py-4 whitespace-nowrap">{vehicle.vehicle_type_name}</td>
                <td className="px-6 py-4 whitespace-nowrap">{vehicle.tob}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                    ${vehicle.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {vehicle.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                  {vehicle.days_inactive > 0 ? `${vehicle.days_inactive} days` : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-blue-600 hover:text-blue-900 cursor-pointer">
                  <a href={`/vehicle/${vehicle.id}`}>View / Edit</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon, color }: any[]) {
  return (
    <div className={`${color} rounded-lg p-5 text-white flex items-center shadow-lg`}>
      <div className="mr-4 opacity-80">{icon}</div>
      <div>
        <h3 className="text-lg font-bold">{value}</h3>
        <p className="text-sm opacity-90">{title}</p>
      </div>
    </div>
  )
}