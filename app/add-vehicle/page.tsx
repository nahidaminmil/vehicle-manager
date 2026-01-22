"use client"
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { createVehicleWithAutoUser } from '@/app/actions' 
import { ArrowLeft, Save, Truck, Loader2 } from 'lucide-react'

export default function AddVehicle() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [types, setTypes] = useState<any[]>([])

  // --- DYNAMIC LISTS STATE ---
  const [tobList, setTobList] = useState<string[]>([]) 
  const [statusList, setStatusList] = useState<string[]>([]) // <--- NEW
  const [opCatList, setOpCatList] = useState<string[]>([])   // <--- NEW

  // Form State
  const [formData, setFormData] = useState({
    vehicle_uid: '',
    tob: '', 
    vehicle_type_id: '',
    operational_category: '', 
    mileage: 0,
    status: '' 
  })

  // --- FETCH DATA ---
  useEffect(() => {
    async function fetchSetupData() {
      // 1. Fetch Types
      const { data: tData } = await supabase.from('vehicle_types').select('*').order('sort_order', { ascending: true })
      if (tData) {
          setTypes(tData)
          if(tData.length > 0) setFormData(prev => ({...prev, vehicle_type_id: tData[0].id}))
      }

      // 2. Fetch Locations
      const { data: lData } = await supabase.from('locations').select('name').order('sort_order')
      if (lData && lData.length > 0) {
          const locs = lData.map((l: any) => l.name)
          setTobList(locs)
          setFormData(prev => ({ ...prev, tob: locs[0] }))
      }

      // 3. Fetch Statuses (Dynamic)
      const { data: sData } = await supabase.from('vehicle_statuses').select('name').order('sort_order')
      if (sData && sData.length > 0) {
          const stats = sData.map((s: any) => s.name)
          setStatusList(stats)
          setFormData(prev => ({ ...prev, status: stats[0] })) // Default to first (e.g. Active)
      }

      // 4. Fetch Op Categories (Dynamic)
      const { data: oData } = await supabase.from('operational_categories').select('name').order('sort_order')
      if (oData && oData.length > 0) {
          const ops = oData.map((o: any) => o.name)
          setOpCatList(ops)
          setFormData(prev => ({ ...prev, operational_category: ops[0] })) // Default to first (e.g. FMC)
      }
    }
    fetchSetupData()
  }, [])

  async function handleSubmit() {
    if (!formData.vehicle_uid || !formData.vehicle_type_id || !formData.tob) return alert('Please fill in Vehicle ID, Type and Location')
    
    setLoading(true)
    
    const result = await createVehicleWithAutoUser(formData)

    if (result.success) {
        alert('Vehicle AND User Account Created Successfully!')
        router.push('/all-vehicles') 
    } else {
        alert('Error: ' + result.error)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 flex justify-center items-start pt-10">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md border-t-8 border-blue-600">
        
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
                    className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none font-bold uppercase" 
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
                        className="w-full p-3 border-2 border-gray-200 rounded-lg bg-white font-bold text-gray-800 outline-none focus:border-blue-500"
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
                        className="w-full p-3 border-2 border-gray-200 rounded-lg bg-white font-bold text-gray-800 outline-none focus:border-blue-500"
                    >
                        {tobList.length === 0 && <option>Loading...</option>}
                        {tobList.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
            </div>

            {/* 3. Status & Op Category (NEW DYNAMIC DROPDOWNS) */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-bold text-gray-700 uppercase mb-1">Status</label>
                    <select 
                        value={formData.status} 
                        onChange={e => setFormData({...formData, status: e.target.value})} 
                        className="w-full p-3 border-2 border-gray-200 rounded-lg bg-white font-bold text-gray-800 outline-none focus:border-blue-500"
                    >
                        {statusList.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                
                <div>
                    <label className="block text-sm font-bold text-gray-700 uppercase mb-1">Op. Category</label>
                    <select 
                        value={formData.operational_category} 
                        onChange={e => setFormData({...formData, operational_category: e.target.value})} 
                        className="w-full p-3 border-2 border-gray-200 rounded-lg bg-white font-bold text-gray-800 outline-none focus:border-blue-500"
                    >
                        {opCatList.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                </div>
            </div>

            {/* 4. Mileage */}
            <div>
                <label className="block text-sm font-bold text-gray-700 uppercase mb-1">Initial Mileage (km)</label>
                <input 
                    type="number" 
                    value={formData.mileage} 
                    onChange={e => setFormData({...formData, mileage: parseInt(e.target.value) || 0})} 
                    className="w-full p-3 border-2 border-gray-200 rounded-lg font-bold text-gray-800 outline-none focus:border-blue-500" 
                />
            </div>

            {/* AUTOMATION NOTICE */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex items-start">
                <div className="mr-3 mt-1 text-blue-600"><Save className="w-5 h-5" /></div>
                <div>
                    <p className="text-xs font-bold text-blue-600 uppercase mb-1">AUTOMATION ACTIVE</p>
                    <p className="text-sm text-blue-800 font-medium leading-relaxed">
                        A <strong>Vehicle User Account</strong> and <strong>QR Code</strong> will be automatically generated upon saving.
                    </p>
                </div>
            </div>

            {/* Submit Button */}
            <button 
                onClick={handleSubmit} 
                disabled={loading} 
                className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-4 rounded-lg shadow-lg flex justify-center items-center mt-6 transition-all active:scale-95"
            >
                {loading ? <Loader2 className="animate-spin"/> : "Save & Create Auto-User"}
            </button>
        </div>
      </div>
    </div>
  )
}