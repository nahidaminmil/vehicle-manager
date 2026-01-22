"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  ArrowLeft, Trash2, Plus, MapPin, Car, Settings, 
  Activity, AlertTriangle, Edit2, Check, X 
} from 'lucide-react'

export default function SystemSettings() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  
  // Lists Data
  const [types, setTypes] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [statuses, setStatuses] = useState<any[]>([]) 
  const [opCats, setOpCats] = useState<any[]>([])     

  useEffect(() => {
    checkUserAndFetch()
  }, [])

  async function checkUserAndFetch() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/login')

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    
    // STRICT UI CHECK: Only Super Admin passes
    if (profile?.role !== 'super_admin') {
        alert('Access Denied: Super Admin Only')
        return router.push('/')
    }

    await fetchData()
    setLoading(false)
  }

  async function fetchData() {
    // Sorting by sort_order ensures consistent display
    const { data: tData } = await supabase.from('vehicle_types').select('*').order('sort_order', { ascending: true })
    const { data: lData } = await supabase.from('locations').select('*').order('sort_order', { ascending: true })
    const { data: sData } = await supabase.from('vehicle_statuses').select('*').order('sort_order', { ascending: true })
    const { data: oData } = await supabase.from('operational_categories').select('*').order('sort_order', { ascending: true })

    if (tData) setTypes(tData)
    if (lData) setLocations(lData)
    if (sData) setStatuses(sData)
    if (oData) setOpCats(oData)
  }

  // --- GENERIC DATABASE HANDLERS ---

  async function handleAdd(table: string, value: string, list: any[]) {
    if (!value.trim()) return
    const maxOrder = list.length > 0 ? Math.max(...list.map(i => i.sort_order || 0)) : 0
    
    const { error } = await supabase.from(table).insert({ name: value, sort_order: maxOrder + 1 })
    
    if (error) alert("Error Adding: " + error.message)
    else fetchData()
  }

  async function handleDelete(table: string, id: number) {
    if (!confirm('Are you sure? This cannot be undone.')) return
    
    const { error } = await supabase.from(table).delete().eq('id', id)
    
    if (error) {
        // Handle Foreign Key constraint (if item is in use)
        if (error.code === '23503') alert("Cannot delete: This item is currently assigned to existing vehicles.")
        else alert("Error Deleting: " + error.message)
    } else {
        fetchData()
    }
  }

  async function handleEdit(table: string, id: number, newName: string) {
      if(!newName.trim()) return
      
      const { error } = await supabase.from(table).update({ name: newName }).eq('id', id)
      
      if(error) alert("Error Updating: " + error.message)
      else fetchData()
  }

  if (loading) return <div className="p-8 text-xl font-bold">Verifying Super Admin Access...</div>

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 pb-24">
      {/* HEADER */}
      <div className="flex items-center mb-8">
        <button onClick={() => router.push('/')} className="bg-white p-2 rounded-lg shadow-sm border border-gray-300 mr-4 hover:bg-gray-50 text-gray-700">
            <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
            <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight flex items-center">
                <Settings className="w-8 h-8 mr-3 text-purple-700"/> System Configuration
            </h1>
            <p className="text-gray-500 font-bold text-sm">Manage Global Lists (Super Admin Only)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* 1. VEHICLE TYPES */}
        <ConfigSection 
            title="Vehicle Types" 
            icon={<Car className="w-6 h-6 mr-2 text-blue-600"/>}
            color="blue"
            data={types}
            onAdd={(val: string) => handleAdd('vehicle_types', val, types)}
            onDelete={(id: number) => handleDelete('vehicle_types', id)}
            onEdit={(id: number, val: string) => handleEdit('vehicle_types', id, val)}
        />

        {/* 2. LOCATIONS */}
        <ConfigSection 
            title="Locations (TOBs)" 
            icon={<MapPin className="w-6 h-6 mr-2 text-green-600"/>}
            color="green"
            data={locations}
            onAdd={(val: string) => handleAdd('locations', val, locations)}
            onDelete={(id: number) => handleDelete('locations', id)}
            onEdit={(id: number, val: string) => handleEdit('locations', id, val)}
        />

        {/* 3. VEHICLE STATUSES */}
        <ConfigSection 
            title="Vehicle Statuses" 
            icon={<Activity className="w-6 h-6 mr-2 text-orange-600"/>}
            color="orange"
            data={statuses}
            onAdd={(val: string) => handleAdd('vehicle_statuses', val, statuses)}
            onDelete={(id: number) => handleDelete('vehicle_statuses', id)}
            onEdit={(id: number, val: string) => handleEdit('vehicle_statuses', id, val)}
        />

        {/* 4. OPERATIONAL CATEGORIES */}
        <ConfigSection 
            title="Operational Categories" 
            icon={<AlertTriangle className="w-6 h-6 mr-2 text-red-600"/>}
            color="red"
            data={opCats}
            onAdd={(val: string) => handleAdd('operational_categories', val, opCats)}
            onDelete={(id: number) => handleDelete('operational_categories', id)}
            onEdit={(id: number, val: string) => handleEdit('operational_categories', id, val)}
        />

      </div>
    </div>
  )
}

// --- REUSABLE COMPONENT (Handles Add, List, and Inline Edit) ---
function ConfigSection({ title, icon, color, data, onAdd, onDelete, onEdit }: any) {
    const [newItem, setNewItem] = useState('')
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editValue, setEditValue] = useState('')

    // Styling Maps
    const borderMap: any = { blue: 'border-blue-600', green: 'border-green-600', orange: 'border-orange-600', red: 'border-red-600' }
    const btnMap: any = { blue: 'bg-blue-600 hover:bg-blue-700', green: 'bg-green-600 hover:bg-green-700', orange: 'bg-orange-600 hover:bg-orange-700', red: 'bg-red-600 hover:bg-red-700' }
    const focusMap: any = { blue: 'focus:border-blue-500', green: 'focus:border-green-500', orange: 'focus:border-orange-500', red: 'focus:border-red-500' }

    const startEdit = (item: any) => {
        setEditingId(item.id)
        setEditValue(item.name)
    }

    const saveEdit = () => {
        if (editingId) {
            onEdit(editingId, editValue)
            setEditingId(null)
        }
    }

    return (
        <div className={`bg-white p-6 rounded-xl shadow-lg border-t-8 ${borderMap[color]}`}>
            <h2 className="text-xl font-black text-gray-900 mb-4 flex items-center">{icon} {title}</h2>
            
            {/* Add Input */}
            <div className="flex gap-2 mb-6">
                <input 
                    type="text" 
                    placeholder="Add New..." 
                    className={`flex-1 p-2 border-2 border-gray-200 rounded font-bold outline-none ${focusMap[color]}`}
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                />
                <button 
                    onClick={() => { onAdd(newItem); setNewItem('') }} 
                    className={`${btnMap[color]} text-white p-2 rounded shadow flex items-center justify-center font-bold`}
                >
                    <Plus className="w-5 h-5"/>
                </button>
            </div>

            {/* List with Inline Editing */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                {data.map((item: any) => (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-100 group hover:bg-white hover:shadow-sm transition-all">
                        
                        {/* If this item is being edited */}
                        {editingId === item.id ? (
                            <div className="flex flex-1 gap-2">
                                <input 
                                    className="flex-1 p-1 border border-blue-300 rounded text-sm font-bold outline-none"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    autoFocus
                                />
                                <button onClick={saveEdit} className="text-green-600 hover:bg-green-100 p-1 rounded transition-colors"><Check className="w-5 h-5"/></button>
                                <button onClick={() => setEditingId(null)} className="text-red-500 hover:bg-red-100 p-1 rounded transition-colors"><X className="w-5 h-5"/></button>
                            </div>
                        ) : (
                            /* Normal View */
                            <>
                                <span className="font-bold text-gray-700">{item.name}</span>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => startEdit(item)} className="text-blue-400 hover:text-blue-600 p-1 transition-colors">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => onDelete(item.id)} className="text-gray-300 hover:text-red-600 p-1 transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}