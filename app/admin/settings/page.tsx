"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Trash2, Plus, MapPin, Car, AlertCircle, Settings } from 'lucide-react'

export default function SystemSettings() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [types, setTypes] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  
  // Inputs
  const [newType, setNewType] = useState('')
  const [newLocation, setNewLocation] = useState('')

  useEffect(() => {
    checkUserAndFetch()
  }, [])

  async function checkUserAndFetch() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/login')

    // Verify Super Admin
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'super_admin') {
        alert('Access Denied: Super Admin Only')
        return router.push('/')
    }

    await fetchData()
    setLoading(false)
  }

  async function fetchData() {
    const { data: tData } = await supabase.from('vehicle_types').select('*').order('sort_order', { ascending: true })
    const { data: lData } = await supabase.from('locations').select('*').order('sort_order', { ascending: true })
    if (tData) setTypes(tData)
    if (lData) setLocations(lData)
  }

  // --- HANDLERS ---

  async function addType() {
    if (!newType.trim()) return
    // Auto-calculate next sort order
    const maxOrder = types.length > 0 ? Math.max(...types.map(t => t.sort_order || 0)) : 0
    
    const { error } = await supabase.from('vehicle_types').insert({ name: newType, sort_order: maxOrder + 1 })
    if (error) alert(error.message)
    else { setNewType(''); fetchData() }
  }

  async function deleteType(id: number) {
    if (!confirm('Are you sure? This cannot be undone.')) return
    const { error } = await supabase.from('vehicle_types').delete().eq('id', id)
    
    if (error) {
        // Handle Foreign Key Constraint Error (Item in use)
        if (error.code === '23503') alert("Cannot delete: This Type is currently assigned to existing vehicles.")
        else alert(error.message)
    } else {
        fetchData()
    }
  }

  async function addLocation() {
    if (!newLocation.trim()) return
    const maxOrder = locations.length > 0 ? Math.max(...locations.map(l => l.sort_order || 0)) : 0
    
    const { error } = await supabase.from('locations').insert({ name: newLocation, sort_order: maxOrder + 1 })
    if (error) alert(error.message)
    else { setNewLocation(''); fetchData() }
  }

  async function deleteLocation(id: number) {
    if (!confirm('Are you sure? This cannot be undone.')) return
    const { error } = await supabase.from('locations').delete().eq('id', id)
    
    if (error) {
        if (error.code === '23503') alert("Cannot delete: This Location is currently assigned to existing vehicles.")
        else alert(error.message)
    } else {
        fetchData()
    }
  }

  if (loading) return <div className="p-8 text-xl font-bold">Verifying Access...</div>

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      {/* HEADER */}
      <div className="flex items-center mb-8">
        <button onClick={() => router.push('/')} className="bg-white p-2 rounded-lg shadow-sm border border-gray-300 mr-4 hover:bg-gray-50 text-gray-700">
            <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
            <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight flex items-center">
                <Settings className="w-8 h-8 mr-3 text-purple-700"/> System Configuration
            </h1>
            <p className="text-gray-500 font-bold text-sm">Manage Global Lists & Settings</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* 1. VEHICLE TYPES MANAGER */}
        <div className="bg-white p-6 rounded-xl shadow-lg border-t-8 border-blue-600">
            <h2 className="text-xl font-black text-gray-900 mb-4 flex items-center"><Car className="w-6 h-6 mr-2 text-blue-600"/> Vehicle Types</h2>
            
            {/* Add Input */}
            <div className="flex gap-2 mb-6">
                <input 
                    type="text" 
                    placeholder="New Vehicle Type..." 
                    className="flex-1 p-2 border-2 border-gray-200 rounded font-bold outline-none focus:border-blue-500"
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                />
                <button onClick={addType} className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded shadow flex items-center justify-center font-bold">
                    <Plus className="w-5 h-5"/>
                </button>
            </div>

            {/* List */}
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                {types.map((t) => (
                    <div key={t.id} className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-100 group hover:bg-white hover:shadow-sm transition-all">
                        <span className="font-bold text-gray-700">{t.name}</span>
                        <button onClick={() => deleteType(t.id)} className="text-gray-400 hover:text-red-600 transition-colors p-1">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </div>

        {/* 2. LOCATIONS MANAGER */}
        <div className="bg-white p-6 rounded-xl shadow-lg border-t-8 border-green-600">
            <h2 className="text-xl font-black text-gray-900 mb-4 flex items-center"><MapPin className="w-6 h-6 mr-2 text-green-600"/> Locations (TOBs)</h2>
            
            {/* Add Input */}
            <div className="flex gap-2 mb-6">
                <input 
                    type="text" 
                    placeholder="New Location Name..." 
                    className="flex-1 p-2 border-2 border-gray-200 rounded font-bold outline-none focus:border-green-500"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                />
                <button onClick={addLocation} className="bg-green-600 hover:bg-green-700 text-white p-2 rounded shadow flex items-center justify-center font-bold">
                    <Plus className="w-5 h-5"/>
                </button>
            </div>

            {/* List */}
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                {locations.map((l) => (
                    <div key={l.id} className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-100 group hover:bg-white hover:shadow-sm transition-all">
                        <span className="font-bold text-gray-700">{l.name}</span>
                        <button onClick={() => deleteLocation(l.id)} className="text-gray-400 hover:text-red-600 transition-colors p-1">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </div>

      </div>
    </div>
  )
}