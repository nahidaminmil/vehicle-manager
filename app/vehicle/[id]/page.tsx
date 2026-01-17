"use client"
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, CheckCircle, AlertTriangle, Camera, Wrench, CheckSquare, Clock, Edit2, X, Save, QrCode } from 'lucide-react'

export default function VehicleDetails() {
  const { id } = useParams()
  const router = useRouter()
  
  // Data State
  const [vehicle, setVehicle] = useState<any>(null)
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
  const [inactiveDate, setInactiveDate] = useState('') // YYYY-MM-DD
  const [remark, setRemark] = useState('')
  const [actionReq, setActionReq] = useState('')
  const [responsible, setResponsible] = useState('')
  const [priority, setPriority] = useState('Routine')

  // Lists
  const tobList = ['NDROMO', 'BAYOO', 'RHOO', 'DRODRO']
  const opCats = ['Fully Mission Capable', 'Degraded', 'Non-Mission Capable']

  // 1. Fetch Data
  async function fetchData() {
    const { data: vehicleData, error: vError } = await supabase
      .from('vehicles')
      .select(`*, vehicle_types (id, name)`)
      .eq('id', id)
      .single()

    const { data: typesData } = await supabase.from('vehicle_types').select('*')
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
      
      // Init Edit Form
      setEditFormData({
        vehicle_uid: vehicleData.vehicle_uid || '',
        tob: vehicleData.tob || 'NDROMO',
        vehicle_type_id: vehicleData.vehicle_type_id || '',
        mileage: vehicleData.mileage || 0,
        operational_category: vehicleData.operational_category || 'Fully Mission Capable'
      })

      // Format Inactive Date for DatePicker (YYYY-MM-DD)
      if (vehicleData.inactive_since) {
        setInactiveDate(new Date(vehicleData.inactive_since).toISOString().split('T')[0])
      } else {
        setInactiveDate(new Date().toISOString().split('T')[0])
      }
    }
    setLoading(false)
  }

  useEffect(() => { if (id) fetchData() }, [id])

  // --- CALCULATOR: Days Inactive ---
  function getDaysInactive() {
    if (newStatus === 'Active' || !vehicle?.inactive_since) return 0
    const start = new Date(vehicle.inactive_since).getTime()
    const now = new Date().getTime()
    const diff = now - start
    return Math.floor(diff / (1000 * 3600 * 24))
  }

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

  // 2. Upload Image
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

  // 3. Save Profile
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

  // 4. Update Status (With Date Picker Support)
  async function handleUpdateStatus() {
    if (!vehicle) return
    // If Active -> Clear date. If Inactive -> Use picked date or today
    const dateToSave = newStatus === 'Inactive' ? (new Date(inactiveDate).toISOString()) : null
    
    const { error } = await supabase.from('vehicles').update({ status: newStatus, inactive_since: dateToSave }).eq('id', vehicle.id)
    if (error) alert('Error updating status')
    else { alert('Status Updated!'); router.refresh(); window.location.reload() }
  }

  // 5. Add Detailed Log
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
           
           {/* QR Code Button (Placeholder for Phase 6) */}
           <button className="absolute top-4 right-4 bg-white/90 text-gray-800 p-2 rounded shadow-md flex items-center text-xs font-bold" onClick={() => alert('QR Code Generation coming in Phase 6!')}>
              <QrCode className="w-4 h-4 mr-1" /> QR ID
           </button>
        </div>
      </div>

      {/* 2. Vehicle Identity Card (EDITABLE) */}
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
            {/* Registration */}
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase">Vehicle ID</label>
                {isEditing ? (
                    <input type="text" value={editFormData.vehicle_uid} onChange={(e) => setEditFormData({...editFormData, vehicle_uid: e.target.value})} className="w-full mt-1 p-2 border rounded"/>
                ) : <p className="font-medium">{vehicle.vehicle_uid || '---'}</p>}
            </div>

            {/* TOB (Specific Dropdown) */}
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase">TOB Location</label>
                {isEditing ? (
                    <select value={editFormData.tob} onChange={(e) => setEditFormData({...editFormData, tob: e.target.value})} className="w-full mt-1 p-2 border rounded">
                        {tobList.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                ) : <p className="font-medium">{vehicle.tob || '---'}</p>}
            </div>

            {/* Mileage (New Field) */}
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase">Mileage (KM)</label>
                {isEditing ? (
                    <input type="number" value={editFormData.mileage} onChange={(e) => setEditFormData({...editFormData, mileage: Number(e.target.value)})} className="w-full mt-1 p-2 border rounded"/>
                ) : <p className="font-medium">{vehicle.mileage ? `${vehicle.mileage.toLocaleString()} km` : '0 km'}</p>}
            </div>

            {/* Op Category (New Field) */}
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase">Op. Category</label>
                {isEditing ? (
                    <select value={editFormData.operational_category} onChange={(e) => setEditFormData({...editFormData, operational_category: e.target.value})} className="w-full mt-1 p-2 border rounded">
                        {opCats.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                ) : <span className={`px-2 py-1 text-xs font-bold rounded ${vehicle.operational_category === 'Fully Mission Capable' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {vehicle.operational_category || 'Fully Mission Capable'}
                </span>}
            </div>
        </div>
      </div>

      {/* 3. Status Manager (Days Inactive Calc) */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center"><CheckCircle className="w-6 h-6 mr-2 text-green-600" /> Update Status</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
             <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="block w-full p-3 border border-gray-300 rounded-md">
                <option value="Active">🟢 Active</option>
                <option value="Inactive">🔴 Inactive</option>
                <option value="Maintenance">🟠 Maintenance</option>
             </select>
             
             {/* Date Picker (Only shows if Inactive) */}
             {newStatus === 'Inactive' && (
                 <div>
                    <label className="text-xs font-bold text-gray-500">Inactive Since:</label>
                    <input type="date" value={inactiveDate} onChange={(e) => setInactiveDate(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md" />
                 </div>
             )}
          </div>
          
          {/* Days Inactive Display */}
          {newStatus === 'Inactive' && (
             <div className="bg-red-50 text-red-700 p-3 rounded mb-4 text-center font-bold border border-red-200">
                ⚠️ Vehicle Inactive for {getDaysInactive()} Days
             </div>
          )}

          <button onClick={handleUpdateStatus} className="w-full py-3 bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700">Save Status Change</button>
      </div>

      {/* 4. Detailed Fault Reporting */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center"><AlertTriangle className="w-6 h-6 mr-2 text-orange-500" /> Report Issue</h2>
          
          <textarea value={remark} onChange={(e) => setRemark(e.target.value)} className="w-full p-3 border border-gray-300 rounded-md h-24 mb-3" placeholder="Fault Description..." />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
             <input type="text" value={actionReq} onChange={(e) => setActionReq(e.target.value)} className="p-3 border rounded-md" placeholder="Required Action" />
             <input type="text" value={responsible} onChange={(e) => setResponsible(e.target.value)} className="p-3 border rounded-md" placeholder="Person Responsible" />
          </div>

          <div className="flex gap-4">
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-1/3 p-3 border rounded-md">
              <option value="Routine">Routine</option>
              <option value="Critical">🔥 Critical</option>
            </select>
            <button onClick={handleAddLog} className="w-2/3 bg-gray-800 text-white rounded-md font-bold hover:bg-gray-900">Submit Log</button>
          </div>
      </div>

      {/* 5. Maintenance History */}
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
                    <div key={log.id} className="p-4 hover:bg-gray-50">
                        <div className="flex flex-col md:flex-row justify-between items-start mb-2">
                             <div className="flex items-center gap-2 mb-1">
                                <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${log.priority === 'Critical' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>{log.priority}</span>
                                <span className="text-xs text-gray-400 flex items-center"><Clock className="w-3 h-3 mr-1" />{new Date(log.created_at).toLocaleDateString()}</span>
                            </div>
                            {log.status !== 'Resolved' && (
                                <button onClick={() => resolveLog(log.id)} className="flex items-center px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"><CheckSquare className="w-3 h-3 mr-1" /> Mark Done</button>
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