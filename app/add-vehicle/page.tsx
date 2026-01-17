"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Save, Truck } from 'lucide-react'

export default function AddVehiclePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [types, setTypes] = useState<any[]>([])
  
  // Form Data (Only the essentials)
  const [formData, setFormData] = useState({
    vehicle_uid: '',     // The ID / Plate Number
    tob: 'NDROMO',       // Default Location
    vehicle_type_id: '', // Dropdown
    status: 'Active'     // Default Status
  })

  // Fixed Lists
  const tobList = ['NDROMO', 'BAYOO', 'RHOO', 'DRODRO']

  // Fetch Vehicle Types on Load
  useEffect(() => {
    async function fetchTypes() {
      const { data } = await supabase.from('vehicle_types').select('*')
      setTypes(data || [])
      // Auto-select the first type if available
      if (data && data.length > 0) {
        setFormData(prev => ({ ...prev, vehicle_type_id: data[0].id }))
      }
    }
    fetchTypes()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault() // Stop page refresh
    setLoading(true)

    // Validation
    if (!formData.vehicle_uid || !formData.vehicle_type_id) {
      alert('Please fill in Vehicle ID and Type')
      setLoading(false)
      return
    }

    // Insert into Database
    const { error } = await supabase
      .from('vehicles')
      .insert({
        vehicle_uid: formData.vehicle_uid.toUpperCase(), // Auto-uppercase
        tob: formData.tob,
        vehicle_type_id: formData.vehicle_type_id,
        status: formData.status,
        mileage: 0, // Default empty
        operational_category: 'Fully Mission Capable' // Default good
      })

    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert('Vehicle Created Successfully!')
      router.push('/') // Go back to dashboard
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 flex justify-center items-start pt-10">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        
        {/* Header */}
        <div className="flex items-center mb-6 border-b pb-4">
            <button onClick={() => router.back()} className="mr-4 text-gray-600">
                <ArrowLeft />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <Truck className="w-6 h-6 mr-2 text-blue-600" />
                Add New Vehicle
            </h1>
        </div>

        {/* The Simple Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* 1. Vehicle ID */}
            <div>
                <label className="block text-sm font-bold text-gray-700 uppercase mb-1">Vehicle ID / Registration</label>
                <input 
                    type="text" 
                    placeholder="e.g. UN-12345"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold uppercase"
                    value={formData.vehicle_uid}
                    onChange={(e) => setFormData({...formData, vehicle_uid: e.target.value})}
                />
            </div>

            {/* 2. Vehicle Type */}
            <div>
                <label className="block text-sm font-bold text-gray-700 uppercase mb-1">Vehicle Type</label>
                <select 
                    className="w-full p-3 border border-gray-300 rounded-lg bg-white"
                    value={formData.vehicle_type_id}
                    onChange={(e) => setFormData({...formData, vehicle_type_id: e.target.value})}
                >
                    <option value="">-- Select Type --</option>
                    {types.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                </select>
            </div>

            {/* 3. TOB Location */}
            <div>
                <label className="block text-sm font-bold text-gray-700 uppercase mb-1">Location (TOB)</label>
                <select 
                    className="w-full p-3 border border-gray-300 rounded-lg bg-white"
                    value={formData.tob}
                    onChange={(e) => setFormData({...formData, tob: e.target.value})}
                >
                    {tobList.map(t => (
                        <option key={t} value={t}>{t}</option>
                    ))}
                </select>
            </div>

            {/* 4. Initial Status */}
            <div>
                <label className="block text-sm font-bold text-gray-700 uppercase mb-1">Initial Status</label>
                <select 
                    className="w-full p-3 border border-gray-300 rounded-lg bg-white"
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                >
                    <option value="Active">🟢 Active (Ready)</option>
                    <option value="Inactive">🔴 Inactive (Off Road)</option>
                </select>
            </div>

            {/* Submit Button */}
            <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-4 rounded-lg shadow-md flex justify-center items-center mt-6 transition-all"
            >
                {loading ? 'Creating...' : <><Save className="w-5 h-5 mr-2" /> Create Vehicle</>}
            </button>

        </form>
      </div>
    </div>
  )
}