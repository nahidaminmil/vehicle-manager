"use client"
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { createVehicleWithAutoUser } from '@/app/actions' // <--- This is the magic link to your Server Action
import { ArrowLeft, Save, Truck, Loader2 } from 'lucide-react'

export default function AddVehicle() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [types, setTypes] = useState<any[]>([])

  // Form State
  const [formData, setFormData] = useState({
    vehicle_uid: '',
    tob: 'NDROMO',
    vehicle_type_id: '',
    operational_category: 'Fully Mission Capable',
    mileage: 0,
    status: 'Active' // Default to Active for new vehicles
  })

  // Fixed Lists
  const tobList = ['NDROMO', 'BAYOO', 'RHOO', 'DRODRO']

  useEffect(() => {
    async function getTypes() {
      const { data } = await supabase.from('vehicle_types').select('*')
      if (data) {
          setTypes(data)
          // Auto-select first type if available
          if(data.length > 0) setFormData(prev => ({...prev, vehicle_type_id: data[0].id}))
      }
    }
    getTypes()
  }, [])

  async function handleSubmit() {
    if (!formData.vehicle_uid || !formData.vehicle_type_id) return alert('Please fill in Vehicle ID and Type')
    
    setLoading(true)
    
    // CALL THE SERVER ACTION (This creates Vehicle + User + QR Data)
    const result = await createVehicleWithAutoUser(formData)

    if (result.success) {
        alert('Vehicle AND User Account Created Successfully!')
        router.push('/all-vehicles') // Go to list to see the new QR code
    } else {
        alert('Error: ' + result.error)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 flex justify-center items-start pt-10">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        
        {/* Header */}
        <div className="flex items-center mb-6 border-b pb-4">
            <button onClick={() => router.back()} className="mr-4 text-gray-600 hover:text-gray-900">
                <ArrowLeft />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <Truck className="w-6 h-6 mr-2 text-blue-600" />
                Add New Vehicle
            </h1>
        </div>

        <div className="space-y-5">
            {/* 1. Vehicle ID */}
            <div>
                <label className="block text-sm font-bold text-gray-700 uppercase mb-1">Vehicle ID / Registration</label>
                <input 
                    type="text" 
                    value={formData.vehicle_uid} 
                    onChange={e => setFormData({...formData, vehicle_uid: e.target.value.toUpperCase()})} 
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold uppercase" 
                    placeholder="UN-12345" 
                />
            </div>

            {/* 2. Type & TOB */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-bold text-gray-700 uppercase mb-1">Type</label>
                    <select 
                        value={formData.vehicle_type_id} 
                        onChange={e => setFormData({...formData, vehicle_type_id: e.target.value})} 
                        className="w-full p-3 border border-gray-300 rounded-lg bg-white"
                    >
                        <option value="">Select...</option>
                        {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 uppercase mb-1">Location</label>
                    <select 
                        value={formData.tob} 
                        onChange={e => setFormData({...formData, tob: e.target.value})} 
                        className="w-full p-3 border border-gray-300 rounded-lg bg-white"
                    >
                        {tobList.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
            </div>

            {/* 3. Mileage */}
            <div>
                <label className="block text-sm font-bold text-gray-700 uppercase mb-1">Initial Mileage (km)</label>
                <input 
                    type="number" 
                    value={formData.mileage} 
                    onChange={e => setFormData({...formData, mileage: parseInt(e.target.value) || 0})} 
                    className="w-full p-3 border border-gray-300 rounded-lg font-bold" 
                />
            </div>

            {/* AUTOMATION NOTICE */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <p className="text-xs font-bold text-blue-600 uppercase mb-1">AUTOMATION ACTIVE</p>
                <p className="text-sm text-blue-800 font-medium leading-relaxed">
                    A <strong>Vehicle User Account</strong> and <strong>QR Code</strong> will be automatically generated when you click save.
                </p>
            </div>

            {/* Submit Button */}
            <button 
                onClick={handleSubmit} 
                disabled={loading} 
                className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-4 rounded-lg shadow-md flex justify-center items-center mt-6 transition-all active:scale-95"
            >
                {loading ? <Loader2 className="animate-spin"/> : <><Save className="w-5 h-5 mr-2"/> Save & Create Auto-User</>}
            </button>
        </div>
      </div>
    </div>
  )
}