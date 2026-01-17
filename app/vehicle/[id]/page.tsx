"use client"
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, CheckCircle, AlertTriangle, Camera, Wrench, CheckSquare, Clock, Edit2, X, Save, Trash2, Plus, ImageIcon, UploadCloud } from 'lucide-react'

export default function VehicleDetails() {
  const { id } = useParams()
  const router = useRouter()
  
  // --- STATE ---
  const [vehicle, setVehicle] = useState<any>(null)
  const [gallery, setGallery] = useState<any[]>([]) 
  const [logs, setLogs] = useState<any[]>([])       
  const [evidence, setEvidence] = useState<any>({}) 
  const [types, setTypes] = useState<any[]>([])     
  const [loading, setLoading] = useState(true)
  
  // --- EDIT STATE ---
  const [isEditing, setIsEditing] = useState(false)
  const [editFormData, setEditFormData] = useState({
    vehicle_uid: '', tob: '', vehicle_type_id: '', mileage: 0, operational_category: ''
  })

  // --- LOG FORM STATE ---
  const [uploading, setUploading] = useState(false)
  const [newStatus, setNewStatus] = useState('')
  const [inactiveDate, setInactiveDate] = useState('')
  
  // New Log Form Data
  const [remark, setRemark] = useState('')
  const [actionReq, setActionReq] = useState('')
  const [responsible, setResponsible] = useState('')
  const [priority, setPriority] = useState('Routine')
  const [logFile, setLogFile] = useState<File | null>(null) // Store file before submit

  // --- LISTS ---
  const tobList = ['NDROMO', 'BAYOO', 'RHOO', 'DRODRO']
  const opCats = ['Fully Mission Capable', 'Degraded', 'Non-Mission Capable']
  const priorityList = ['Low', 'Routine', 'Critical'] // The 3 options you wanted

  // --- FETCH DATA ---
  async function fetchData() {
    const { data: vehicleData } = await supabase.from('vehicle_dashboard_view').select('*').eq('id', id).single()
    const { data: typesData } = await supabase.from('vehicle_types').select('*')
    const { data: galleryData } = await supabase.from('vehicle_gallery').select('*').eq('vehicle_id', id).order('created_at', { ascending: false })
    const { data: logData } = await supabase.from('maintenance_logs').select('*').eq('vehicle_id', id).order('created_at', { ascending: false })

    if (vehicleData) {
      setVehicle(vehicleData)
      setNewStatus(vehicleData.status)
      setTypes(typesData || [])
      setGallery(galleryData || [])
      setLogs(logData || [])
      
      if (logData && logData.length > 0) {
          const logIds = logData.map(l => l.id)
          const { data: evidenceData } = await supabase.from('log_evidence').select('*').in('log_id', logIds)
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

  // --- UPLOAD HANDLERS ---
  async function handleMainUpload(event: any) {
    if (gallery.length >= 10) return alert('Max 10 profile photos allowed.')
    try {
      const file = event.target.files[0]; if (!file) return; setUploading(true)
      const blob = await resizeImage(file)
      const fileName = `veh_${vehicle.id}_${Date.now()}.jpg`
      await supabase.storage.from('vehicle-media').upload(fileName, blob, { contentType: 'image/jpeg', upsert: true })
      const { data: { publicUrl } } = supabase.storage.from('vehicle-media').getPublicUrl(fileName)
      await supabase.from('vehicle_gallery').insert({ vehicle_id: vehicle.id, image_url: publicUrl })
      await supabase.from('vehicles').update({ vehicle_image_url: publicUrl }).eq('id', vehicle.id)
      alert('Profile Photo Added!'); fetchData()
    } catch (e: any) { alert(e.message) } finally { setUploading(false) }
  }

  // Used for adding photos to OLD logs in the history list
  async function handleLogUpload(event: any, logId: string) {
    try {
      const file = event.target.files[0]; if (!file) return; setUploading(true)
      const blob = await resizeImage(file)
      const fileName = `log_${logId}_${Date.now()}.jpg`
      await supabase.storage.from('vehicle-media').upload(fileName, blob, { contentType: 'image/jpeg', upsert: true })
      const { data: { publicUrl } } = supabase.storage.from('vehicle-media').getPublicUrl(fileName)
      await supabase.from('log_evidence').insert({ log_id: logId, image_url: publicUrl })
      alert('Photo attached to log!'); fetchData()
    } catch (e: any) { alert(e.message) } finally { setUploading(false) }
  }

  async function deleteGalleryPhoto(pid: string) { if(confirm('Delete photo?')) { await supabase.from('vehicle_gallery').delete().eq('id', pid); fetchData() }}
  async function deleteEvidencePhoto(eid: string) { if(confirm('Delete photo?')) { await supabase.from('log_evidence').delete().eq('id', eid); fetchData() }}

  async function saveProfile() {
    const { error } = await supabase.from('vehicles').update({
        vehicle_uid: editFormData.vehicle_uid,
        tob: editFormData.tob,
        vehicle_type_id: editFormData.vehicle_type_id,
        mileage: editFormData.mileage,
        operational_category: editFormData.operational_category
      }).eq('id', vehicle.id)
    if(error) alert("Error saving: " + error.message)
    else { setIsEditing(false); fetchData() }
  }

  async function handleUpdateStatus() {
    const d = newStatus === 'Inactive' ? (new Date(inactiveDate).toISOString()) : null
    await supabase.from('vehicles').update({ status: newStatus, inactive_since: d }).eq('id', vehicle.id)
    alert('Status Updated!'); router.refresh(); window.location.reload()
  }

  // --- THE NEW SINGLE-STEP SUBMIT FUNCTION ---
  async function handleSubmitLog() {
    if (!remark) return alert('Please write a fault description.')
    
    setUploading(true)
    try {
        // 1. Create the Log entry first
        const { data: newLog, error } = await supabase.from('maintenance_logs').insert({ 
            vehicle_id: vehicle.id, 
            description: remark, 
            priority, 
            action_required: actionReq, 
            responsible_person: responsible, 
            status: 'Pending' 
        }).select().single()

        if(error) throw error

        // 2. If a file was selected, upload it immediately and attach to the new log
        if (logFile && newLog) {
            const blob = await resizeImage(logFile)
            const fileName = `log_${newLog.id}_${Date.now()}.jpg`
            const { error: uploadErr } = await supabase.storage.from('vehicle-media').upload(fileName, blob, { contentType: 'image/jpeg', upsert: true })
            if (uploadErr) throw uploadErr

            const { data: { publicUrl } } = supabase.storage.from('vehicle-media').getPublicUrl(fileName)
            await supabase.from('log_evidence').insert({ log_id: newLog.id, image_url: publicUrl })
        }

        // 3. Reset Form
        alert('Report Submitted Successfully!')
        setRemark('')
        setActionReq('')
        setResponsible('')
        setLogFile(null)
        fetchData() // Refresh list

    } catch (err: any) {
        alert("Error submitting log: " + err.message)
    } finally {
        setUploading(false)
    }
  }

  if (loading) return <div className="p-8 font-bold text-xl">Loading...</div>
  if (!vehicle) return <div className="p-8 font-bold text-xl text-red-600">Vehicle not found (ID: {id})</div>

  return (
    <div className="min-h-screen bg-gray-100 p-4 pb-20">
      <button onClick={() => router.push('/')} className="flex items-center text-gray-700 font-bold mb-4 bg-white p-2 rounded shadow-sm w-fit">
        <ArrowLeft className="w-5 h-5 mr-2" /> Back to Dashboard
      </button>

      {/* 1. MAIN PROFILE GALLERY */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6 p-4 border-t-4 border-blue-600">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-black text-gray-800 flex items-center"><Camera className="w-5 h-5 mr-2"/> Vehicle Profile Photos ({gallery.length}/10)</h2>
            <label className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md cursor-pointer flex items-center text-sm font-bold shadow-sm transition-colors">
                <Plus className="w-4 h-4 mr-1" /> Add Profile Photo
                <input type="file" accept="image/*" className="hidden" onChange={handleMainUpload} disabled={uploading || gallery.length >= 10} />
            </label>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {gallery.length === 0 && <div className="col-span-full h-32 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 font-bold">No profile photos added yet.</div>}
            {gallery.map((p) => (
                <div key={p.id} className="relative aspect-square group rounded-lg overflow-hidden shadow-sm border border-gray-200">
                    <img src={p.image_url} className="w-full h-full object-cover" alt="Profile" />
                    <button onClick={() => deleteGalleryPhoto(p.id)} className="absolute top-1 right-1 bg-red-600/80 hover:bg-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3 h-3" /></button>
                </div>
            ))}
        </div>
      </div>

      {/* 2. IDENTITY & STATS */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
            <h2 className="text-xl font-black text-gray-900">Vehicle Identity & Stats</h2>
            {!isEditing ? (
                <button onClick={() => setIsEditing(true)} className="text-blue-700 flex items-center text-sm font-bold bg-blue-50 px-3 py-1 rounded hover:bg-blue-100"><Edit2 className="w-4 h-4 mr-1" /> Edit Profile</button>
            ) : (
                <div className="flex gap-2">
                    <button onClick={() => setIsEditing(false)} className="text-gray-600 bg-gray-100 px-3 py-1 rounded font-bold flex items-center"><X className="w-4 h-4 mr-1" /> Cancel</button>
                    <button onClick={saveProfile} className="text-white bg-green-600 px-3 py-1 rounded font-bold flex items-center hover:bg-green-700"><Save className="w-4 h-4 mr-1" /> Save Changes</button>
                </div>
            )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1">Vehicle ID</label>
                {isEditing ? <input type="text" value={editFormData.vehicle_uid} onChange={(e) => setEditFormData({...editFormData, vehicle_uid: e.target.value})} className="w-full p-2 border-2 border-blue-200 rounded font-bold text-gray-900 outline-none"/> 
                : <p className="text-lg font-black text-gray-900">{vehicle.vehicle_uid || '---'}</p>}
            </div>
            <div>
                <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1">Location (TOB)</label>
                {isEditing ? <select value={editFormData.tob} onChange={(e) => setEditFormData({...editFormData, tob: e.target.value})} className="w-full p-2 border-2 border-blue-200 rounded font-bold text-gray-900">{tobList.map(t => <option key={t} value={t}>{t}</option>)}</select> 
                : <p className="text-lg font-bold text-gray-900">{vehicle.tob || '---'}</p>}
            </div>
             <div>
                <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1">Vehicle Type</label>
                {isEditing ? <select value={editFormData.vehicle_type_id} onChange={(e) => setEditFormData({...editFormData, vehicle_type_id: e.target.value})} className="w-full p-2 border-2 border-blue-200 rounded font-bold text-gray-900">{types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select> 
                : <p className="text-lg font-bold text-gray-900">{vehicle.vehicle_type_name || '---'}</p>}
            </div>
            <div>
                <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1">Mileage (KM)</label>
                {isEditing ? <input type="number" value={editFormData.mileage} onChange={(e) => setEditFormData({...editFormData, mileage: Number(e.target.value)})} className="w-full p-2 border-2 border-blue-200 rounded font-bold text-gray-900 outline-none"/> 
                : <p className="text-lg font-bold text-gray-900">{vehicle.mileage ? `${vehicle.mileage.toLocaleString()}` : '0'} km</p>}
            </div>
            <div className="md:col-span-2">
                <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1">Operational Category</label>
                {isEditing ? (
                    <select value={editFormData.operational_category} onChange={(e) => setEditFormData({...editFormData, operational_category: e.target.value})} className="w-full p-2 border-2 border-blue-200 rounded font-bold text-gray-900">
                        {opCats.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                ) : (
                    <span className={`px-3 py-1 text-sm font-black rounded-full inline-block ${vehicle.operational_category === 'Fully Mission Capable' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                        {vehicle.operational_category || 'Fully Mission Capable'}
                    </span>
                )}
            </div>
        </div>
      </div>

      {/* 3. STATUS MANAGER */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6 border-t-4 border-gray-800">
          <h2 className="text-xl font-black mb-4 flex items-center text-gray-900"><CheckCircle className="w-6 h-6 mr-2 text-green-600" /> Update Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Current Status</label>
                <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="block w-full p-3 border-2 border-gray-300 rounded-md font-bold text-gray-900 text-lg">
                    <option value="Active">🟢 Active (Ready)</option>
                    <option value="Inactive">🔴 Inactive (Off Road)</option>
                    <option value="Maintenance">🟠 Maintenance</option>
                </select>
             </div>
             {newStatus === 'Inactive' && (
                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Inactive Since Date:</label>
                    <input type="date" value={inactiveDate} onChange={(e) => setInactiveDate(e.target.value)} className="w-full p-3 border-2 border-gray-300 rounded-md font-bold text-gray-900" />
                 </div>
             )}
          </div>
          <button onClick={handleUpdateStatus} className="w-full py-4 bg-gray-900 text-white rounded-lg font-black text-lg hover:bg-black transition-colors shadow-md">Save Status Change</button>
      </div>

      {/* 4. REPORT NEW ISSUE (UPDATED WORKFLOW) */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8 border-t-4 border-orange-500">
          <h2 className="text-xl font-black mb-4 flex items-center text-orange-700"><AlertTriangle className="w-6 h-6 mr-2" /> Report New Issue</h2>
          
          {/* Description */}
          <p className="text-sm text-gray-600 mb-2 font-bold uppercase">1. Fault Description:</p>
          <textarea value={remark} onChange={(e) => setRemark(e.target.value)} className="w-full p-3 border-2 border-gray-300 rounded-md h-24 mb-4 font-bold text-gray-900 focus:border-orange-500 placeholder-gray-400" placeholder="E.g., Flat tire on front left, engine overheating..." />
          
          {/* Extra Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
             <div>
                 <p className="text-xs font-bold text-gray-500 uppercase mb-1">Required Action (Optional)</p>
                 <input type="text" value={actionReq} onChange={(e) => setActionReq(e.target.value)} className="w-full p-3 border-2 border-gray-300 rounded-md font-bold" />
             </div>
             <div>
                 <p className="text-xs font-bold text-gray-500 uppercase mb-1">Person Responsible (Optional)</p>
                 <input type="text" value={responsible} onChange={(e) => setResponsible(e.target.value)} className="w-full p-3 border-2 border-gray-300 rounded-md font-bold" />
             </div>
          </div>

          {/* Priority & Photo Attachment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
             <div>
                <p className="text-xs font-bold text-gray-500 uppercase mb-1">Priority Level</p>
                <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full p-3 border-2 border-gray-300 rounded-md font-bold text-gray-900 bg-white">
                    {priorityList.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
             </div>
             
             {/* THE NEW ATTACHMENT FIELD */}
             <div>
                <p className="text-xs font-bold text-gray-500 uppercase mb-1">Attach Photo (Optional)</p>
                <div className="flex items-center">
                    <label className="cursor-pointer w-full flex items-center justify-center p-3 border-2 border-dashed border-gray-400 rounded-md hover:bg-gray-50 transition-colors">
                        <UploadCloud className="w-5 h-5 mr-2 text-gray-600"/>
                        <span className="text-sm font-bold text-gray-700 truncate">
                            {logFile ? logFile.name : "Tap to select photo..."}
                        </span>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => setLogFile(e.target.files ? e.target.files[0] : null)} />
                    </label>
                    {logFile && <button onClick={() => setLogFile(null)} className="ml-2 text-red-600 font-bold"><X/></button>}
                </div>
             </div>
          </div>

          {/* Submit Button */}
          <button onClick={handleSubmitLog} disabled={uploading} className="w-full bg-orange-600 text-white py-4 rounded-lg font-black text-lg hover:bg-orange-700 shadow-md transition-colors flex justify-center items-center">
             {uploading ? 'Submitting & Uploading...' : 'Submit Log & Photo'}
          </button>
      </div>

      {/* 5. MAINTENANCE HISTORY */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
        <div className="p-4 bg-gray-800 border-b border-gray-900 flex items-center">
            <Wrench className="w-5 h-5 mr-2 text-white" />
            <h3 className="text-lg font-black text-white uppercase tracking-wider">Maintenance History & Evidence</h3>
        </div>
        <div className="divide-y divide-gray-200 bg-gray-50">
            {logs.length === 0 && <div className="p-8 text-center text-gray-500 font-bold text-lg">No maintenance records found.</div>}
            
            {logs.map((log) => (
                <div key={log.id} className="p-5 hover:bg-white transition-colors border-l-4 border-transparent hover:border-blue-500">
                    <div className="flex flex-col md:flex-row justify-between items-start mb-3">
                        <div className="flex items-center gap-3 mb-2 md:mb-0">
                            <span className={`px-3 py-1 text-xs font-black uppercase tracking-wider rounded-full ${log.priority==='Critical'?'bg-red-600 text-white': log.priority==='Routine'?'bg-blue-100 text-blue-800':'bg-gray-200 text-gray-800'}`}>{log.priority}</span>
                            <span className="text-sm text-gray-500 font-bold flex items-center"><Clock className="w-4 h-4 mr-1"/>{new Date(log.created_at).toLocaleDateString()}</span>
                        </div>
                        {/* Resolve Button Logic */}
                        {log.status !== 'Resolved' ? 
                           // Only show Resolve button if you want Admins to see it. Keeping it open for now.
                           <button onClick={() => alert('Only admins should resolve (or add resolve logic)')} className="flex items-center text-xs bg-green-600 text-white px-3 py-1.5 rounded font-bold hover:bg-green-700 shadow-sm opacity-50 cursor-not-allowed"><CheckSquare className="w-4 h-4 mr-1"/> Pending</button> 
                           : <span className="px-3 py-1.5 text-xs font-black uppercase tracking-wider text-green-800 bg-green-100 rounded-full flex items-center"><CheckCircle className="w-4 h-4 mr-1"/> Resolved</span>
                        }
                    </div>
                    <p className="text-lg font-black text-gray-900 mb-3">{log.description}</p>
                    
                    {/* Evidence Section */}
                    <div className="mt-4 p-4 bg-gray-200/50 rounded-xl border-2 border-gray-300/50">
                        <h4 className="text-sm font-black text-gray-700 uppercase flex items-center mb-3"><ImageIcon className="w-4 h-4 mr-2"/> Evidence Photos</h4>
                        
                        <div className="flex flex-wrap gap-3">
                            {(!evidence[log.id] || evidence[log.id].length === 0) ? (
                                <div className="text-sm text-gray-500 font-bold italic py-2">No photos attached.</div>
                            ) : (
                                evidence[log.id].map((pic: any) => (
                                    <div key={pic.id} className="relative w-24 h-24 group rounded-lg overflow-hidden shadow-sm border-2 border-white">
                                        <img src={pic.image_url} className="w-full h-full object-cover cursor-pointer hover:scale-110 transition-transform" onClick={()=>window.open(pic.image_url, '_blank')} alt="Evidence" />
                                        <button onClick={() => deleteEvidencePhoto(pic.id)} className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"><X className="w-3 h-3"/></button>
                                    </div>
                                ))
                            )}
                            
                            {/* Option to add MORE photos later if needed */}
                            <label className="cursor-pointer w-24 h-24 flex flex-col items-center justify-center bg-white border-2 border-dashed border-gray-400 rounded-lg hover:bg-blue-50 transition-colors text-blue-600">
                                <Plus className="w-6 h-6 mb-1"/>
                                <span className="text-[10px] font-bold uppercase">Add More</span>
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLogUpload(e, log.id)} disabled={uploading} />
                            </label>
                        </div>
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  )
}