"use client"
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, CheckCircle, AlertTriangle, Camera, Wrench, CheckSquare, Clock, Edit2, X, Save, Trash2, Plus } from 'lucide-react'

export default function VehicleDetails() {
  const { id } = useParams()
  const router = useRouter()
  
  // Data State
  const [vehicle, setVehicle] = useState<any>(null)
  const [gallery, setGallery] = useState<any[]>([]) // Stores the list of 10 photos
  const [logs, setLogs] = useState<any[]>([])
  const [types, setTypes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Edit Profile State
  const [isEditing, setIsEditing] = useState(false)
  const [editFormData, setEditFormData] = useState({
    vehicle_uid: '',
    tob: '',
    vehicle_type_id: '',
    mileage: 0,
    operational_category: ''
  })

  // Status & Logs State
  const [uploading, setUploading] = useState(false)
  const [newStatus, setNewStatus] = useState('')
  const [inactiveDate, setInactiveDate] = useState('')
  const [remark, setRemark] = useState('')
  const [actionReq, setActionReq] = useState('')
  const [responsible, setResponsible] = useState('')
  const [priority, setPriority] = useState('Routine')

  const tobList = ['NDROMO', 'BAYOO', 'RHOO', 'DRODRO']
  const opCats = ['Fully Mission Capable', 'Degraded', 'Non-Mission Capable']

  // 1. Fetch Data
  async function fetchData() {
    // A. Vehicle Details (From View)
    const { data: vehicleData } = await supabase
      .from('vehicle_dashboard_view')
      .select('*')
      .eq('id', id)
      .single()

    // B. Vehicle Types
    const { data: typesData } = await supabase.from('vehicle_types').select('*')

    // C. Gallery Photos (New!)
    const { data: galleryData } = await supabase
      .from('vehicle_gallery')
      .select('*')
      .eq('vehicle_id', id)
      .order('created_at', { ascending: false })

    // D. Logs
    const { data: logData } = await supabase
      .from('maintenance_logs')
      .select('*')
      .eq('vehicle_id', id)
      .order('created_at', { ascending: false })

    if (vehicleData) {
      setVehicle(vehicleData)
      setNewStatus(vehicleData.status)
      setTypes(typesData || [])
      setGallery(galleryData || [])
      setLogs(logData || [])
      
      setEditFormData({
        vehicle_uid: vehicleData.vehicle_uid || '',
        tob: vehicleData.tob || 'NDROMO',
        vehicle_type_id: vehicleData.vehicle_type_id || '',
        mileage: vehicleData.mileage || 0,
        operational_category: vehicleData.operational_category || 'Fully Mission Capable'
      })

      if (vehicleData.inactive_since) {
        setInactiveDate(new Date(vehicleData.inactive_since).toISOString().split('T')[0])
      } else {
        setInactiveDate(new Date().toISOString().split('T')[0])
      }
    }
    setLoading(false)
  }

  useEffect(() => { if (id) fetchData() }, [id])

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

  // 2. Upload Image (Multi-Slot Logic)
  async function handleImageUpload(event: any) {
    if (gallery.length >= 10) {
        alert('Maximum 10 photos allowed. Please delete some first.')
        return
    }

    try {
      const file = event.target.files[0]
      if (!file) return
      setUploading(true)
      
      const resizedBlob = await resizeImage(file)
      const fileName = `${vehicle.id}_${Date.now()}.jpg`
      
      // A. Upload to Storage
      const { error: uploadError } = await supabase.storage.from('vehicle-media').upload(fileName, resizedBlob, { contentType: 'image/jpeg', upsert: true })
      if (uploadError) throw uploadError
      
      const { data: { publicUrl } } = supabase.storage.from('vehicle-media').getPublicUrl(fileName)

      // B. Add to Gallery Table
      const { error: galleryError } = await supabase.from('vehicle_gallery').insert({
          vehicle_id: vehicle.id,
          image_url: publicUrl
      })
      if (galleryError) throw galleryError

      // C. Update Main Thumbnail (Always show the latest one on dashboard)
      await supabase.from('vehicles').update({ vehicle_image_url: publicUrl }).eq('id', vehicle.id)

      alert('Photo Added!')
      fetchData() // Refresh gallery
    } catch (error: any) { 
        alert('Error uploading: ' + error.message) 
    } finally { 
        setUploading(false) 
    }
  }

  // 3. Delete Photo
  async function deletePhoto(photoId: string) {
    if (!confirm('Are you sure you want to delete this photo?')) return

    const { error } = await supabase.from('vehicle_gallery').delete().eq('id', photoId)
    if (error) alert('Error deleting photo')
    else fetchData()
  }

  // 4. Save Profile
  async function saveProfile() {
    const { error } = await supabase
      .from('vehicles')
      .update({
        vehicle_uid: editFormData.vehicle_uid,
        tob: editFormData.tob,
        vehicle_type_id: editFormData.vehicle_type_id,
        mileage: editFormData.mileage,
        operational_category: editFormData.operational_category
      })
      .eq('id', vehicle.id)

    if (error) alert('Error saving details')
    else { setIsEditing(false); fetchData() }
  }

  // 5. Update Status
  async function handleUpdateStatus() {
    if (!vehicle) return
    const dateToSave = newStatus === 'Inactive' ? (new Date(inactiveDate).toISOString()) : null
    const { error } = await supabase.from('vehicles').update({ status: newStatus, inactive_since: dateToSave }).eq('id', vehicle.id)
    if (error) alert('Error updating status')
    else { alert('Status Updated!'); router.refresh(); window.location.reload() }
  }

  // 6. Add Log
  async function handleAddLog() {
    if (!remark) return alert('Please write a fault description')
    const { error } = await supabase.from('maintenance_logs').insert({
      vehicle_id: vehicle.id,
      description: remark,
      priority: priority,
      action_required: actionReq,
      responsible_person: responsible,
      status: 'Pending'
    })
    if (error) alert('Error adding log')
    else { alert('Log Added'); setRemark(''); setActionReq(''); setResponsible(''); fetchData() }
  }

  // 7. Resolve Log
  async function resolveLog(logId: string) {
    const { error } = await supabase.from('maintenance_logs').update({ status: 'Resolved' }).eq('id', logId)
    if (error) alert('Error updating log'); else fetchData()
  }

  if (loading) return <div className="p-8">Loading Vehicle Data...</div>
  if (!vehicle) return <div className="p-8">Vehicle not found (ID: {id})</div>

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-20">
      <button onClick={() => router.push('/')} className="flex items-center text-gray-600 mb-4">
        <ArrowLeft className="w-5 h-5 mr-2" /> Back
      </button>

      {/* 1. PHOTO GALLERY SECTION (Updated) */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-6 p-4">
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex justify-between items-center">
            <span>Vehicle Photos ({gallery.length}/10)</span>
            <label className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg cursor-pointer flex items-center text-sm">
                <Plus className="w-4 h-4 mr-2" /> Add Photo
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading || gallery.length >= 10} />
            </label>
        </h2>

        {/* The Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* If empty, show placeholder */}
            {gallery.length === 0 && (
                <div className="col-span-full h-40 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                    No photos added yet.
                </div>
            )}

            {/* Photo List */}
            {gallery.map((photo) => (
                <div key={photo.id} className="relative aspect-square group">
                    <img 
                        src={photo.image_url} 
                        className="w-full h-full object-cover rounded-lg border border-gray-200 shadow-sm" 
                        alt="Evidence" 
                    />
                    {/* Delete Button (Visible on Hover/Tap) */}
                    <button 
                        onClick={() => deletePhoto(photo.id)}
                        className="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded-full shadow-md opacity-90 hover:opacity-100 transition-opacity"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>
      </div>

      {/* 2. Vehicle Identity Card */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
            <h2 className="text-xl font-bold text-gray-800">Vehicle Identity & Stats</h2>
            {!isEditing ? (
                <button onClick={() => setIsEditing(true)} className="text-blue-600 flex items-center text-sm font-bold">
                    <Edit2 className="w-4 h-4 mr-1" /> Edit Profile
                </button>
            ) : (
                <div className="flex gap-2">
                    <button onClick={() => setIsEditing(false)} className="text-gray-500"><X className="w-5 h-5" /></button>
                    <button onClick={saveProfile} className="text-green-600"><Save className="w-5 h-5" /></button>
                </div>
            )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase">Vehicle ID</label>
                {isEditing ? (
                    <input type="text" value={editFormData.vehicle_uid} onChange={(e) => setEditFormData({...editFormData, vehicle_uid: e.target.value})} className="w-full mt-1 p-2 border rounded font-bold"/>
                ) : <p className="font-bold text-lg">{vehicle.vehicle_uid || '---'}</p>}
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase">Location (TOB)</label>
                {isEditing ? (
                    <select value={editFormData.tob} onChange={(e) => setEditFormData({...editFormData, tob: e.target.value})} className="w-full mt-1 p-2 border rounded">
                        {tobList.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                ) : <p className="font-bold text-lg">{vehicle.tob || '---'}</p>}
            </div>
             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase">Vehicle Type</label>
                {isEditing ? (
                    <select value={editFormData.vehicle_type_id} onChange={(e) => setEditFormData({...editFormData, vehicle_type_id: e.target.value})} className="w-full mt-1 p-2 border rounded">
                        {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                ) : <p className="font-bold text-lg">{vehicle.vehicle_type_name || '---'}</p>}
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase">Mileage (KM)</label>
                {isEditing ? (
                    <input type="number" value={editFormData.mileage} onChange={(e) => setEditFormData({...editFormData, mileage: Number(e.target.value)})} className="w-full mt-1 p-2 border rounded font-bold"/>
                ) : <p className="font-bold text-lg">{vehicle.mileage ? `${vehicle.mileage.toLocaleString()} km` : '0 km'}</p>}
            </div>
            <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase">Op. Category</label>
                {isEditing ? (
                    <select value={editFormData.operational_category} onChange={(e) => setEditFormData({...editFormData, operational_category: e.target.value})} className="w-full mt-1 p-2 border rounded">
                        {opCats.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                ) : <span className={`px-2 py-1 text-sm font-bold rounded ${vehicle.operational_category === 'Fully Mission Capable' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {vehicle.operational_category || 'Fully Mission Capable'}
                </span>}
            </div>
        </div>
      </div>

      {/* 3. Status Manager */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center"><CheckCircle className="w-6 h-6 mr-2 text-green-600" /> Update Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
             <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="block w-full p-3 border border-gray-300 rounded-md font-bold">
                <option value="Active">🟢 Active</option>
                <option value="Inactive">🔴 Inactive</option>
                <option value="Maintenance">🟠 Maintenance</option>
             </select>
             {newStatus === 'Inactive' && (
                 <div>
                    <label className="text-xs font-bold text-gray-500">Inactive Since:</label>
                    <input type="date" value={inactiveDate} onChange={(e) => setInactiveDate(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md" />
                 </div>
             )}
          </div>
          <button onClick={handleUpdateStatus} className="w-full py-3 bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700">Save Status Change</button>
      </div>

      {/* 4. Fault Reporting */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center"><AlertTriangle className="w-6 h-6 mr-2 text-orange-500" /> Report Issue</h2>
          <textarea value={remark} onChange={(e) => setRemark(e.target.value)} className="w-full p-3 border border-gray-300 rounded-md h-24 mb-3 font-medium" placeholder="Fault Description..." />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
             <input type="text" value={actionReq} onChange={(e) => setActionReq(e.target.value)} className="p-3 border rounded-md" placeholder="Required Action" />
             <input type="text" value={responsible} onChange={(e) => setResponsible(e.target.value)} className="p-3 border rounded-md" placeholder="Person Responsible" />
          </div>
          <div className="flex gap-4">
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-1/3 p-3 border rounded-md font-bold">
              <option value="Routine">Routine</option>
              <option value="Critical">🔥 Critical</option>
            </select>
            <button onClick={handleAddLog} className="w-2/3 bg-gray-800 text-white rounded-md font-bold hover:bg-gray-900">Submit Log</button>
          </div>
      </div>

      {/* 5. Logs */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-4 bg-gray-100 border-b border-gray-200 flex items-center">
            <Wrench className="w-5 h-5 mr-2 text-gray-600" />
            <h3 className="text-lg font-bold text-gray-800">Maintenance History</h3>
        </div>
        <div className="divide-y divide-gray-100">
            {logs.length === 0 ? (
                <div className="p-6 text-center text-gray-500 font-bold">No maintenance records found.</div>
            ) : (
                logs.map((log) => (
                    <div key={log.id} className="p-4 hover:bg-gray-50">
                        <div className="flex flex-col md:flex-row justify-between items-start mb-2">
                             <div className="flex items-center gap-2 mb-1">
                                <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${log.priority === 'Critical' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>{log.priority}</span>
                                <span className="text-xs text-gray-400 flex items-center font-bold"><Clock className="w-3 h-3 mr-1" />{new Date(log.created_at).toLocaleDateString()}</span>
                            </div>
                            {log.status !== 'Resolved' && (
                                <button onClick={() => resolveLog(log.id)} className="flex items-center px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors font-bold"><CheckSquare className="w-3 h-3 mr-1" /> Mark Done</button>
                            )}
                        </div>
                        <p className="text-gray-900 font-bold">{log.description}</p>
                        {(log.action_required || log.responsible_person) && (
                            <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
                                {log.action_required && <p><span className="font-bold">Action:</span> {log.action_required}</p>}
                                {log.responsible_person && <p><span className="font-bold">Resp:</span> {log.responsible_person}</p>}
                            </div>
                        )}
                    </div>
                ))
            )}
        </div>
      </div>
    </div>
  )
}