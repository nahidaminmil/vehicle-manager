"use client"
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, CheckCircle, AlertTriangle, Camera, Wrench, CheckSquare, Clock, Edit2, X, Save } from 'lucide-react'

export default function VehicleDetails() {
  const { id } = useParams()
  const router = useRouter()
  
  // Data State
  const [vehicle, setVehicle] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [types, setTypes] = useState<any[]>([]) // List of all vehicle types for the dropdown
  const [loading, setLoading] = useState(true)
  
  // Edit Mode State (For Vehicle Profile)
  const [isEditing, setIsEditing] = useState(false)
  const [editFormData, setEditFormData] = useState({
    vehicle_uid: '',
    tob: '',
    vehicle_type_id: ''
  })

  // Action State
  const [uploading, setUploading] = useState(false)
  const [newStatus, setNewStatus] = useState('')
  const [remark, setRemark] = useState('')
  const [priority, setPriority] = useState('Routine')

  // 1. Fetch Data (Vehicle, Logs, and Types)
  async function fetchData() {
    // A. Get Vehicle Details
    const { data: vehicleData, error: vError } = await supabase
      .from('vehicles')
      .select(`*, vehicle_types (id, name)`)
      .eq('id', id)
      .single()

    // B. Get All Vehicle Types (for the dropdown)
    const { data: typesData } = await supabase.from('vehicle_types').select('*')

    // C. Get Maintenance Logs
    const { data: logData } = await supabase
      .from('maintenance_logs')
      .select('*')
      .eq('vehicle_id', id)
      .order('created_at', { ascending: false })

    if (vError) console.error(vError)
    else {
      setVehicle(vehicleData)
      setNewStatus(vehicleData.status)
      setTypes(typesData || [])
      setLogs(logData || [])
      
      // Initialize Edit Form
      setEditFormData({
        vehicle_uid: vehicleData.vehicle_uid || '',
        tob: vehicleData.tob || '',
        vehicle_type_id: vehicleData.vehicle_type_id || ''
      })
    }
    setLoading(false)
  }

  useEffect(() => {
    if (id) fetchData()
  }, [id])

  // --- HELPER: Image Resizer ---
  const resizeImage = (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
      const img = document.createElement('img')
      img.src = URL.createObjectURL(file)
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_WIDTH = 1200
        const scaleSize = MAX_WIDTH / img.width
        const newWidth = (img.width > MAX_WIDTH) ? MAX_WIDTH : img.width
        const newHeight = (img.width > MAX_WIDTH) ? (img.height * scaleSize) : img.height
        canvas.width = newWidth
        canvas.height = newHeight
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, newWidth, newHeight)
        canvas.toBlob((blob) => resolve(blob as Blob), 'image/jpeg', 0.7)
      }
    })
  }

  // 2. Handle Image Upload
  async function handleImageUpload(event: any) {
    try {
      const file = event.target.files[0]
      if (!file) return
      setUploading(true)
      const resizedBlob = await resizeImage(file)
      const fileName = `${vehicle.id}_${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage.from('vehicle-media').upload(fileName, resizedBlob, { contentType: 'image/jpeg', upsert: true })
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('vehicle-media').getPublicUrl(fileName)
      const { error: dbError } = await supabase.from('vehicles').update({ vehicle_image_url: publicUrl }).eq('id', vehicle.id)
      if (dbError) throw dbError
      alert('Photo Updated!')
      window.location.reload()
    } catch (error) { alert('Error uploading image.') } finally { setUploading(false) }
  }

  // 3. Save Profile Edits (Name, TOB, Type)
  async function saveProfile() {
    const { error } = await supabase
      .from('vehicles')
      .update({
        vehicle_uid: editFormData.vehicle_uid,
        tob: editFormData.tob,
        vehicle_type_id: editFormData.vehicle_type_id
      })
      .eq('id', vehicle.id)

    if (error) alert('Error saving details')
    else {
      setIsEditing(false)
      fetchData() // Refresh data
    }
  }

  // 4. Update Status
  async function handleUpdateStatus() {
    if (!vehicle) return
    const inactiveDate = newStatus === 'Inactive' ? new Date().toISOString() : null
    const { error } = await supabase.from('vehicles').update({ status: newStatus, inactive_since: inactiveDate }).eq('id', vehicle.id)
    if (error) alert('Error updating status')
    else { alert('Status Updated!'); router.refresh(); window.location.reload() }
  }

  // 5. Add Log
  async function handleAddLog() {
    if (!remark) return alert('Please write a remark')
    const { error } = await supabase.from('maintenance_logs').insert({ vehicle_id: vehicle.id, description: remark, priority: priority, status: 'Pending' })
    if (error) alert('Error adding log')
    else { alert('Log Added'); setRemark(''); fetchData() }
  }

  // 6. Resolve Log
  async function resolveLog(logId: string) {
    const { error } = await supabase.from('maintenance_logs').update({ status: 'Resolved' }).eq('id', logId)
    if (error) alert('Error updating log'); else fetchData()
  }

  if (loading) return <div className="p-8">Loading...</div>
  if (!vehicle) return <div className="p-8">Vehicle not found</div>

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-20">
      <button onClick={() => router.push('/')} className="flex items-center text-gray-600 mb-4">
        <ArrowLeft className="w-5 h-5 mr-2" /> Back
      </button>

      {/* 1. Image Banner */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-6">
        <div className="relative w-full aspect-[4/3] md:aspect-video bg-black rounded-t-lg overflow-hidden">
           <img 
              src={vehicle.vehicle_image_url ? `${vehicle.vehicle_image_url}?t=${Date.now()}` : 'https://placehold.co/600x400?text=No+Image'} 
              className="w-full h-full object-contain"
              alt="Vehicle"
           />
           <label className="absolute bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full cursor-pointer shadow-lg flex items-center">
             <Camera className="w-6 h-6" />
             <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
             <span className="ml-2 font-bold text-sm">{uploading ? 'Processing...' : 'Update Photo'}</span>
           </label>
        </div>
      </div>

      {/* 2. Vehicle Identity Card (EDITABLE) */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
            <h2 className="text-xl font-bold text-gray-800">Vehicle Identity</h2>
            {!isEditing ? (
                <button onClick={() => setIsEditing(true)} className="text-blue-600 flex items-center text-sm font-bold">
                    <Edit2 className="w-4 h-4 mr-1" /> Edit Info
                </button>
            ) : (
                <div className="flex gap-2">
                    <button onClick={() => setIsEditing(false)} className="text-gray-500"><X className="w-5 h-5" /></button>
                    <button onClick={saveProfile} className="text-green-600"><Save className="w-5 h-5" /></button>
                </div>
            )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Field 1: Registration / UID */}
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">Registration Number</label>
                {isEditing ? (
                    <input 
                        type="text" 
                        value={editFormData.vehicle_uid}
                        onChange={(e) => setEditFormData({...editFormData, vehicle_uid: e.target.value})}
                        className="w-full mt-1 p-2 border rounded"
                    />
                ) : (
                    <p className="text-lg font-medium text-gray-900">{vehicle.vehicle_uid || '---'}</p>
                )}
            </div>

            {/* Field 2: Location / TOB */}
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">Location (TOB)</label>
                {isEditing ? (
                    <input 
                        type="text" 
                        value={editFormData.tob}
                        onChange={(e) => setEditFormData({...editFormData, tob: e.target.value})}
                        className="w-full mt-1 p-2 border rounded"
                    />
                ) : (
                    <p className="text-lg font-medium text-gray-900">{vehicle.tob || <span className="text-red-400 italic">Not set</span>}</p>
                )}
            </div>

            {/* Field 3: Vehicle Type */}
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">Vehicle Type</label>
                {isEditing ? (
                    <select 
                        value={editFormData.vehicle_type_id}
                        onChange={(e) => setEditFormData({...editFormData, vehicle_type_id: e.target.value})}
                        className="w-full mt-1 p-2 border rounded"
                    >
                        {types.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                ) : (
                    <p className="text-lg font-medium text-gray-900">{vehicle.vehicle_types?.name || '---'}</p>
                )}
            </div>
        </div>
      </div>

      {/* 3. Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4 flex items-center"><CheckCircle className="w-6 h-6 mr-2 text-green-600" /> Update Status</h2>
          <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="block w-full p-3 border border-gray-300 rounded-md mb-4">
            <option value="Active">🟢 Active</option>
            <option value="Inactive">🔴 Inactive</option>
            <option value="Maintenance">🟠 Maintenance</option>
          </select>
          <button onClick={handleUpdateStatus} className="w-full py-3 bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700">Save Status</button>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4 flex items-center"><AlertTriangle className="w-6 h-6 mr-2 text-orange-500" /> Report Issue</h2>
          <textarea value={remark} onChange={(e) => setRemark(e.target.value)} className="w-full p-3 border border-gray-300 rounded-md h-32 mb-4" placeholder="Describe issue..." />
          <div className="flex gap-4">
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-1/2 p-3 border rounded-md">
              <option value="Routine">Routine</option>
              <option value="Critical">🔥 Critical</option>
            </select>
            <button onClick={handleAddLog} className="w-1/2 bg-gray-800 text-white rounded-md font-bold hover:bg-gray-900">Submit Log</button>
          </div>
        </div>
      </div>

      {/* 4. Maintenance History */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-4 bg-gray-100 border-b border-gray-200 flex items-center">
            <Wrench className="w-5 h-5 mr-2 text-gray-600" />
            <h3 className="text-lg font-bold text-gray-800">Maintenance History</h3>
        </div>
        <div className="divide-y divide-gray-100">
            {logs.length === 0 ? (
                <div className="p-6 text-center text-gray-500">No maintenance records found.</div>
            ) : (
                logs.map((log) => (
                    <div key={log.id} className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center hover:bg-gray-50">
                        <div className="mb-2 md:mb-0">
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${log.priority === 'Critical' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>{log.priority}</span>
                                <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${log.status === 'Resolved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{log.status}</span>
                                <span className="text-xs text-gray-400 flex items-center"><Clock className="w-3 h-3 mr-1" />{new Date(log.created_at).toLocaleDateString()}</span>
                            </div>
                            <p className="text-gray-800 font-medium">{log.description}</p>
                        </div>
                        {log.status !== 'Resolved' && (
                            <button onClick={() => resolveLog(log.id)} className="flex items-center px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"><CheckSquare className="w-4 h-4 mr-1" /> Mark Done</button>
                        )}
                    </div>
                ))
            )}
        </div>
      </div>
    </div>
  )
}