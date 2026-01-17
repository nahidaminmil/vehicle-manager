"use client"
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, CheckCircle, AlertTriangle, Camera, Wrench, CheckSquare, Clock, Edit2, X, Save, Trash2, Plus, ImageIcon } from 'lucide-react'

export default function VehicleDetails() {
  const { id } = useParams()
  const router = useRouter()
  
  // Data State
  const [vehicle, setVehicle] = useState<any>(null)
  const [gallery, setGallery] = useState<any[]>([]) 
  const [logs, setLogs] = useState<any[]>([])
  const [evidence, setEvidence] = useState<any>({}) // Grouped photos by Log ID
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

  // Action State
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
    // A. Vehicle
    const { data: vehicleData } = await supabase.from('vehicle_dashboard_view').select('*').eq('id', id).single()
    // B. Types
    const { data: typesData } = await supabase.from('vehicle_types').select('*')
    // C. Vehicle Gallery
    const { data: galleryData } = await supabase.from('vehicle_gallery').select('*').eq('vehicle_id', id).order('created_at', { ascending: false })
    // D. Logs
    const { data: logData } = await supabase.from('maintenance_logs').select('*').eq('vehicle_id', id).order('created_at', { ascending: false })

    if (vehicleData) {
      setVehicle(vehicleData)
      setNewStatus(vehicleData.status)
      setTypes(typesData || [])
      setGallery(galleryData || [])
      setLogs(logData || [])
      
      // E. Log Evidence (Fetch all photos for these logs)
      if (logData && logData.length > 0) {
          const logIds = logData.map(l => l.id)
          const { data: evidenceData } = await supabase.from('log_evidence').select('*').in('log_id', logIds)
          
          // Group photos by log_id for easy display
          const grouped: any = {}
          evidenceData?.forEach((photo: any) => {
              if (!grouped[photo.log_id]) grouped[photo.log_id] = []
              grouped[photo.log_id].push(photo)
          })
          setEvidence(grouped)
      }

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

  // 2. Upload MAIN Vehicle Photo
  async function handleMainUpload(event: any) {
    if (gallery.length >= 10) return alert('Max 10 vehicle photos allowed.')
    try {
      const file = event.target.files[0]; if (!file) return; setUploading(true)
      const blob = await resizeImage(file)
      const fileName = `veh_${vehicle.id}_${Date.now()}.jpg`
      const { data } = await supabase.storage.from('vehicle-media').upload(fileName, blob, { contentType: 'image/jpeg', upsert: true })
      const { data: { publicUrl } } = supabase.storage.from('vehicle-media').getPublicUrl(fileName)
      await supabase.from('vehicle_gallery').insert({ vehicle_id: vehicle.id, image_url: publicUrl })
      await supabase.from('vehicles').update({ vehicle_image_url: publicUrl }).eq('id', vehicle.id)
      alert('Photo Added!'); fetchData()
    } catch (e: any) { alert(e.message) } finally { setUploading(false) }
  }

  // 3. Upload FAULT EVIDENCE (Log Photo)
  async function handleLogUpload(event: any, logId: string) {
    try {
      const file = event.target.files[0]; if (!file) return; setUploading(true)
      const blob = await resizeImage(file)
      const fileName = `log_${logId}_${Date.now()}.jpg`
      await supabase.storage.from('vehicle-media').upload(fileName, blob, { contentType: 'image/jpeg', upsert: true })
      const { data: { publicUrl } } = supabase.storage.from('vehicle-media').getPublicUrl(fileName)
      
      const { error } = await supabase.from('log_evidence').insert({ log_id: logId, image_url: publicUrl })
      if (error) throw error
      
      alert('Evidence Photo Uploaded!'); fetchData()
    } catch (e: any) { alert(e.message) } finally { setUploading(false) }
  }

  // Deletes
  async function deleteGalleryPhoto(pid: string) { if(confirm('Delete photo?')) { await supabase.from('vehicle_gallery').delete().eq('id', pid); fetchData() }}
  async function deleteEvidencePhoto(eid: string) { if(confirm('Delete evidence?')) { await supabase.from('log_evidence').delete().eq('id', eid); fetchData() }}

  // Profile Save
  async function saveProfile() {
    await supabase.from('vehicles').update({ ...editFormData }).eq('id', vehicle.id)
    setIsEditing(false); fetchData()
  }

  // Status Update
  async function handleUpdateStatus() {
    const d = newStatus === 'Inactive' ? (new Date(inactiveDate).toISOString()) : null
    await supabase.from('vehicles').update({ status: newStatus, inactive_since: d }).eq('id', vehicle.id)
    alert('Status Updated!'); router.refresh(); window.location.reload()
  }

  // Add Log
  async function handleAddLog() {
    if (!remark) return alert('Write a description')
    await supabase.from('maintenance_logs').insert({ vehicle_id: vehicle.id, description: remark, priority, action_required: actionReq, responsible_person: responsible, status: 'Pending' })
    alert('Log Added - Now you can add photos to it below.'); setRemark(''); setActionReq(''); setResponsible(''); fetchData()
  }

  async function resolveLog(logId: string) {
    await supabase.from('maintenance_logs').update({ status: 'Resolved' }).eq('id', logId); fetchData()
  }

  if (loading) return <div className="p-8">Loading...</div>
  if (!vehicle) return <div className="p-8">Vehicle not found</div>

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-20">
      <button onClick={() => router.push('/')} className="flex items-center text-gray-600 mb-4">
        <ArrowLeft className="w-5 h-5 mr-2" /> Back
      </button>

      {/* 1. MAIN GALLERY */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-6 p-4">
        <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-gray-800">Vehicle Profile Photos ({gallery.length}/10)</h2>
            <label className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg cursor-pointer flex items-center text-sm font-bold">
                <Camera className="w-4 h-4 mr-2" /> Add Profile Photo
                <input type="file" accept="image/*" className="hidden" onChange={handleMainUpload} disabled={uploading} />
            </label>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {gallery.map((p) => (
                <div key={p.id} className="relative aspect-square group">
                    <img src={p.image_url} className="w-full h-full object-cover rounded border" />
                    <button onClick={() => deleteGalleryPhoto(p.id)} className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full opacity-80 hover:opacity-100"><Trash2 className="w-3 h-3" /></button>
                </div>
            ))}
            {gallery.length === 0 && <div className="col-span-full text-center py-8 text-gray-400">No profile photos yet.</div>}
        </div>
      </div>

      {/* 2. IDENTITY CARD */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
            <h2 className="text-xl font-bold text-gray-800">Vehicle Identity</h2>
            {!isEditing ? <button onClick={() => setIsEditing(true)}><Edit2 className="w-5 h-5 text-blue-600"/></button> : <div className="flex gap-4"><X onClick={() => setIsEditing(false)} className="cursor-pointer"/><Save onClick={saveProfile} className="text-green-600 cursor-pointer"/></div>}
        </div>
        {/* Simplified View/Edit for brevity - reusing logic from previous step */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div><label className="text-xs font-bold text-gray-500">ID</label>{isEditing ? <input value={editFormData.vehicle_uid} onChange={e=>setEditFormData({...editFormData, vehicle_uid: e.target.value})} className="border p-2 w-full rounded"/> : <p className="font-bold">{vehicle.vehicle_uid}</p>}</div>
             <div><label className="text-xs font-bold text-gray-500">TOB</label>{isEditing ? <select value={editFormData.tob} onChange={e=>setEditFormData({...editFormData, tob: e.target.value})} className="border p-2 w-full rounded">{tobList.map(t=><option key={t}>{t}</option>)}</select> : <p className="font-bold">{vehicle.tob}</p>}</div>
             <div><label className="text-xs font-bold text-gray-500">Mileage</label>{isEditing ? <input type="number" value={editFormData.mileage} onChange={e=>setEditFormData({...editFormData, mileage: Number(e.target.value)})} className="border p-2 w-full rounded"/> : <p className="font-bold">{vehicle.mileage} km</p>}</div>
             <div><label className="text-xs font-bold text-gray-500">Type</label><p className="font-bold">{vehicle.vehicle_type_name}</p></div>
        </div>
      </div>

      {/* 3. REPORT ISSUE */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6 border-l-4 border-orange-500">
          <h2 className="text-xl font-bold mb-4 flex items-center text-orange-700"><AlertTriangle className="w-6 h-6 mr-2" /> Report New Issue</h2>
          <textarea value={remark} onChange={(e) => setRemark(e.target.value)} className="w-full p-3 border border-gray-300 rounded-md h-20 mb-3" placeholder="Describe the fault here..." />
          <div className="flex gap-2 mb-3">
             <input value={actionReq} onChange={e=>setActionReq(e.target.value)} placeholder="Required Action" className="w-1/2 p-2 border rounded"/>
             <input value={responsible} onChange={e=>setResponsible(e.target.value)} placeholder="Responsible Person" className="w-1/2 p-2 border rounded"/>
          </div>
          <div className="flex gap-4">
             <select value={priority} onChange={e=>setPriority(e.target.value)} className="p-3 border rounded font-bold"><option>Routine</option><option>Critical</option></select>
             <button onClick={handleAddLog} className="flex-1 bg-gray-900 text-white rounded font-bold hover:bg-black">Submit Log</button>
          </div>
      </div>

      {/* 4. MAINTENANCE HISTORY + EVIDENCE */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-4 bg-gray-100 border-b border-gray-200"><h3 className="font-bold text-gray-800 flex items-center"><Wrench className="mr-2"/> Maintenance History</h3></div>
        <div className="divide-y divide-gray-100">
            {logs.length === 0 && <div className="p-6 text-center text-gray-400">No records found.</div>}
            {logs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-gray-50 transition-colors">
                    {/* Log Header */}
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${log.priority==='Critical'?'bg-red-100 text-red-800':'bg-blue-100 text-blue-800'}`}>{log.priority}</span>
                            <span className="text-xs text-gray-400 font-bold">{new Date(log.created_at).toLocaleDateString()}</span>
                        </div>
                        {log.status !== 'Resolved' ? 
                            <button onClick={() => resolveLog(log.id)} className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">Mark Done</button> 
                            : <span className="text-xs font-bold text-green-600 flex items-center"><CheckCircle className="w-3 h-3 mr-1"/> Resolved</span>
                        }
                    </div>
                    
                    {/* Description */}
                    <p className="font-bold text-gray-900 mb-2">{log.description}</p>
                    {(log.action_required || log.responsible_person) && <div className="text-sm text-gray-600 mb-3 bg-white border p-2 rounded">
                        {log.action_required && <div><strong>Action:</strong> {log.action_required}</div>}
                        {log.responsible_person && <div><strong>Resp:</strong> {log.responsible_person}</div>}
                    </div>}

                    {/* EVIDENCE SECTION */}
                    <div className="mt-3 p-3 bg-gray-100 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-gray-500 uppercase flex items-center"><ImageIcon className="w-3 h-3 mr-1"/> Evidence Photos</span>
                            <label className="cursor-pointer text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center bg-white px-2 py-1 rounded shadow-sm border">
                                <Plus className="w-3 h-3 mr-1"/> Add Photo
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLogUpload(e, log.id)} disabled={uploading} />
                            </label>
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                            {evidence[log.id]?.map((pic: any) => (
                                <div key={pic.id} className="relative w-20 h-20 group">
                                    <img src={pic.image_url} className="w-full h-full object-cover rounded border border-gray-300 shadow-sm cursor-pointer hover:scale-105 transition-transform" onClick={()=>window.open(pic.image_url, '_blank')} />
                                    <button onClick={() => deleteEvidencePhoto(pic.id)} className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-0.5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3"/></button>
                                </div>
                            ))}
                            {(!evidence[log.id] || evidence[log.id].length === 0) && <div className="text-xs text-gray-400 italic py-2">No photos attached.</div>}
                        </div>
                    </div>

                </div>
            ))}
        </div>
      </div>
    </div>
  )
}