"use client"
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, CheckCircle, AlertTriangle, Camera, Wrench, CheckSquare, Clock, Edit2, X, Save, Trash2, Plus, ImageIcon } from 'lucide-react'

export default function VehicleDetails() {
  const { id } = useParams()
  const router = useRouter()
  
  // --- DATA STATE ---
  const [vehicle, setVehicle] = useState<any>(null)
  const [gallery, setGallery] = useState<any[]>([]) // Main Vehicle Profile Photos
  const [logs, setLogs] = useState<any[]>([])       // Maintenance Logs
  const [evidence, setEvidence] = useState<any>({}) // Fault Photos (Grouped by log id)
  const [types, setTypes] = useState<any[]>([])     // For dropdown
  const [loading, setLoading] = useState(true)
  
  // --- EDIT PROFILE STATE ---
  const [isEditing, setIsEditing] = useState(false)
  const [editFormData, setEditFormData] = useState({
    vehicle_uid: '',
    tob: '',
    vehicle_type_id: '',
    mileage: 0,
    operational_category: ''
  })

  // --- ACTION STATE (Logs & Status) ---
  const [uploading, setUploading] = useState(false)
  const [newStatus, setNewStatus] = useState('')
  const [inactiveDate, setInactiveDate] = useState('')
  const [remark, setRemark] = useState('')
  const [actionReq, setActionReq] = useState('')
  const [responsible, setResponsible] = useState('')
  const [priority, setPriority] = useState('Routine')

  // --- LISTS ---
  const tobList = ['NDROMO', 'BAYOO', 'RHOO', 'DRODRO']
  const opCats = ['Fully Mission Capable', 'Degraded', 'Non-Mission Capable']

  // --- 1. FETCH ALL DATA ---
  async function fetchData() {
    // A. Vehicle Details (From the VIEW so we get the type name)
    const { data: vehicleData } = await supabase.from('vehicle_dashboard_view').select('*').eq('id', id).single()
    // B. Vehicle Types (For editing dropdown)
    const { data: typesData } = await supabase.from('vehicle_types').select('*')
    // C. Main Profile Gallery
    const { data: galleryData } = await supabase.from('vehicle_gallery').select('*').eq('vehicle_id', id).order('created_at', { ascending: false })
    // D. Maintenance Logs
    const { data: logData } = await supabase.from('maintenance_logs').select('*').eq('vehicle_id', id).order('created_at', { ascending: false })

    if (vehicleData) {
      setVehicle(vehicleData)
      setNewStatus(vehicleData.status)
      setTypes(typesData || [])
      setGallery(galleryData || [])
      setLogs(logData || [])
      
      // E. Fetch Evidence Photos for these logs
      if (logData && logData.length > 0) {
          const logIds = logData.map(l => l.id)
          const { data: evidenceData } = await supabase.from('log_evidence').select('*').in('log_id', logIds)
          
          // Group photos by log_id for easy display later
          const grouped: any = {}
          evidenceData?.forEach((photo: any) => {
              if (!grouped[photo.log_id]) grouped[photo.log_id] = []
              grouped[photo.log_id].push(photo)
          })
          setEvidence(grouped)
      }

      // Initialize Edit Form Data
      setEditFormData({
        vehicle_uid: vehicleData.vehicle_uid || '',
        tob: vehicleData.tob || 'NDROMO',
        vehicle_type_id: vehicleData.vehicle_type_id || '', 
        mileage: vehicleData.mileage || 0,
        operational_category: vehicleData.operational_category || 'Fully Mission Capable'
      })

      // Initialize Date Picker
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

  // --- 2. UPLOAD: Main Profile Photo ---
  async function handleMainUpload(event: any) {
    if (gallery.length >= 10) return alert('Max 10 profile photos allowed.')
    try {
      const file = event.target.files[0]; if (!file) return; setUploading(true)
      const blob = await resizeImage(file)
      const fileName = `veh_${vehicle.id}_${Date.now()}.jpg`
      // Upload to Bucket
      await supabase.storage.from('vehicle-media').upload(fileName, blob, { contentType: 'image/jpeg', upsert: true })
      const { data: { publicUrl } } = supabase.storage.from('vehicle-media').getPublicUrl(fileName)
      // Add to Gallery Table
      await supabase.from('vehicle_gallery').insert({ vehicle_id: vehicle.id, image_url: publicUrl })
      // Update main thumbnail icon
      await supabase.from('vehicles').update({ vehicle_image_url: publicUrl }).eq('id', vehicle.id)
      alert('Profile Photo Added!'); fetchData()
    } catch (e: any) { alert(e.message) } finally { setUploading(false) }
  }

  // --- 3. UPLOAD: Fault Evidence Photo ---
  async function handleLogUpload(event: any, logId: string) {
    try {
      const file = event.target.files[0]; if (!file) return; setUploading(true)
      // Force user to select the log first if they haven't
      if(!logId) { alert("Error: No log selected."); return;}

      const blob = await resizeImage(file)
      const fileName = `log_${logId}_${Date.now()}.jpg`
      // Upload to Bucket
      await supabase.storage.from('vehicle-media').upload(fileName, blob, { contentType: 'image/jpeg', upsert: true })
      const { data: { publicUrl } } = supabase.storage.from('vehicle-media').getPublicUrl(fileName)
      
      // Insert into Evidence Table
      const { error } = await supabase.from('log_evidence').insert({ log_id: logId, image_url: publicUrl })
      if (error) throw error
      
      alert('Evidence Photo Uploaded!'); fetchData()
    } catch (e: any) { alert(e.message) } finally { setUploading(false) }
  }

  // --- DELETE Functions ---
  async function deleteGalleryPhoto(pid: string) { if(confirm('Delete profile photo?')) { await supabase.from('vehicle_gallery').delete().eq('id', pid); fetchData() }}
  async function deleteEvidencePhoto(eid: string) { if(confirm('Delete evidence photo?')) { await supabase.from('log_evidence').delete().eq('id', eid); fetchData() }}

  // --- SAVE Profile Edits ---
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

  // --- UPDATE Status ---
  async function handleUpdateStatus() {
    const d = newStatus === 'Inactive' ? (new Date(inactiveDate).toISOString()) : null
    await supabase.from('vehicles').update({ status: newStatus, inactive_since: d }).eq('id', vehicle.id)
    alert('Status Updated!'); router.refresh(); window.location.reload()
  }

  // --- ADD New Log ---
  async function handleAddLog() {
    if (!remark) return alert('Please write a fault description first.')
    // Create the log entry
    const { error } = await supabase.from('maintenance_logs').insert({ vehicle_id: vehicle.id, description: remark, priority, action_required: actionReq, responsible_person: responsible, status: 'Pending' })
    if(error) alert("Error adding log: " + error.message)
    else { 
        alert('Log Text Added. Scroll down to "Maintenance History" to add photos to this log.'); 
        setRemark(''); setActionReq(''); setResponsible(''); fetchData() 
    }
  }

  // --- RESOLVE Log ---
  async function resolveLog(logId: string) {
    await supabase.from('maintenance_logs').update({ status: 'Resolved' }).eq('id', logId); fetchData()
  }

  if (loading) return <div className="p-8 font-bold text-xl">Loading Vehicle Data...</div>
  if (!vehicle) return <div className="p-8 font-bold text-xl text-red-600">Vehicle not found (ID: {id})</div>

  return (
    <div className="min-h-screen bg-gray-100 p-4 pb-20">
      <button onClick={() => router.push('/')} className="flex items-center text-gray-700 font-bold mb-4 bg-white p-2 rounded shadow-sm w-fit">
        <ArrowLeft className="w-5 h-5 mr-2" /> Back to Dashboard
      </button>

      {/* ================= SECTION 1: MAIN PROFILE GALLERY ================= */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6 p-4 border-t-4 border-blue-600">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-black text-gray-800 flex items-center"><Camera className="w-5 h-5 mr-2"/> Vehicle Profile Photos ({gallery.length}/10)</h2>
            <label className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md cursor-pointer flex items-center text-sm font-bold shadow-sm transition-colors">
                <Plus className="w-4 h-4 mr-1" /> Add Profile Photo
                <input type="file" accept="image/*" className="hidden" onChange={handleMainUpload} disabled={uploading || gallery.length >= 10} />
            </label>
        </div>
        
        {/* Photo Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {gallery.length === 0 && (
                <div className="col-span-full h-32 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 font-bold">
                    No profile photos added yet.
                </div>
            )}
            {gallery.map((p) => (
                <div key={p.id} className="relative aspect-square group rounded-lg overflow-hidden shadow-sm border border-gray-200">
                    <img src={p.image_url} className="w-full h-full object-cover" alt="Profile" />
                    <button onClick={() => deleteGalleryPhoto(p.id)} className="absolute top-1 right-1 bg-red-600/80 hover:bg-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3 h-3" /></button>
                </div>
            ))}
        </div>
      </div>


      {/* ================= SECTION 2: VEHICLE IDENTITY & STATS (ALL FIELDS RESTORED) ================= */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
            <h2 className="text-xl font-black text-gray-900">Vehicle Identity & Stats</h2>
            {!isEditing ? (
                <button onClick={() => setIsEditing(true)} className="text-blue-700 flex items-center text-sm font-bold bg-blue-50 px-3 py-1 rounded hover:bg-blue-100">
                    <Edit2 className="w-4 h-4 mr-1" /> Edit Profile
                </button>
            ) : (
                <div className="flex gap-2">
                    <button onClick={() => setIsEditing(false)} className="text-gray-600 bg-gray-100 px-3 py-1 rounded font-bold flex items-center"><X className="w-4 h-4 mr-1" /> Cancel</button>
                    <button onClick={saveProfile} className="text-white bg-green-600 px-3 py-1 rounded font-bold flex items-center hover:bg-green-700"><Save className="w-4 h-4 mr-1" /> Save Changes</button>
                </div>
            )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Field 1: ID */}
            <div>
                <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1">Vehicle ID</label>
                {isEditing ? <input type="text" value={editFormData.vehicle_uid} onChange={(e) => setEditFormData({...editFormData, vehicle_uid: e.target.value})} className="w-full p-2 border-2 border-blue-200 rounded font-bold text-gray-900 focus:border-blue-500 outline-none"/> 
                : <p className="text-lg font-black text-gray-900">{vehicle.vehicle_uid || '---'}</p>}
            </div>

            {/* Field 2: Location */}
            <div>
                <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1">Location (TOB)</label>
                {isEditing ? <select value={editFormData.tob} onChange={(e) => setEditFormData({...editFormData, tob: e.target.value})} className="w-full p-2 border-2 border-blue-200 rounded font-bold text-gray-900">{tobList.map(t => <option key={t} value={t}>{t}</option>)}</select> 
                : <p className="text-lg font-bold text-gray-900">{vehicle.tob || '---'}</p>}
            </div>

             {/* Field 3: Type */}
             <div>
                <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1">Vehicle Type</label>
                {isEditing ? <select value={editFormData.vehicle_type_id} onChange={(e) => setEditFormData({...editFormData, vehicle_type_id: e.target.value})} className="w-full p-2 border-2 border-blue-200 rounded font-bold text-gray-900">{types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select> 
                : <p className="text-lg font-bold text-gray-900">{vehicle.vehicle_type_name || '---'}</p>}
            </div>

            {/* Field 4: Mileage */}
            <div>
                <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1">Mileage (KM)</label>
                {isEditing ? <input type="number" value={editFormData.mileage} onChange={(e) => setEditFormData({...editFormData, mileage: Number(e.target.value)})} className="w-full p-2 border-2 border-blue-200 rounded font-bold text-gray-900 focus:border-blue-500 outline-none"/> 
                : <p className="text-lg font-bold text-gray-900">{vehicle.mileage ? `${vehicle.mileage.toLocaleString()}` : '0'} km</p>}
            </div>

            {/* Field 5: Op Category (RESTORED) */}
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


      {/* ================= SECTION 3: STATUS MANAGER ================= */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6 border-t-4 border-gray-800">
          <h2 className="text-xl font-black mb-4 flex items-center text-gray-900"><CheckCircle className="w-6 h-6 mr-2 text-green-600" /> Update Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Current Status</label>
                <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="block w-full p-3 border-2 border-gray-300 rounded-md font-bold text-gray-900 text-lg focus:border-blue-500">
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


      {/* ================= SECTION 4: REPORT NEW ISSUE ================= */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8 border-t-4 border-orange-500">
          <h2 className="text-xl font-black mb-4 flex items-center text-orange-700"><AlertTriangle className="w-6 h-6 mr-2" /> Report New Issue</h2>
          <p className="text-sm text-gray-600 mb-2 font-bold">1. Describe the fault in text first:</p>
          <textarea value={remark} onChange={(e) => setRemark(e.target.value)} className="w-full p-3 border-2 border-gray-300 rounded-md h-24 mb-3 font-bold text-gray-900 focus:border-orange-500 placeholder-gray-400" placeholder="E.g., Flat tire on front left, engine overheating..." />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
             <input type="text" value={actionReq} onChange={(e) => setActionReq(e.target.value)} className="p-3 border-2 border-gray-300 rounded-md font-bold" placeholder="Required Action (Optional)" />
             <input type="text" value={responsible} onChange={(e) => setResponsible(e.target.value)} className="p-3 border-2 border-gray-300 rounded-md font-bold" placeholder="Person Responsible (Optional)" />
          </div>

          <div className="flex gap-4 items-center">
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="p-3 border-2 border-gray-300 rounded-md font-bold text-gray-900 bg-white">
                <option value="Routine">Routine Priority</option>
                <option value="Critical">🔥 Critical Priority</option>
            </select>
            <button onClick={handleAddLog} className="flex-1 bg-orange-600 text-white py-3 rounded-lg font-black hover:bg-orange-700 shadow-md transition-colors">
                Submit Log Text
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2 italic text-center">(*You can add photos to this log after submitting the text below)</p>
      </div>


      {/* ================= SECTION 5: MAINTENANCE HISTORY & EVIDENCE PHOTOS ================= */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
        <div className="p-4 bg-gray-800 border-b border-gray-900 flex items-center">
            <Wrench className="w-5 h-5 mr-2 text-white" />
            <h3 className="text-lg font-black text-white uppercase tracking-wider">Maintenance History & Evidence</h3>
        </div>
        <div className="divide-y divide-gray-200 bg-gray-50">
            {logs.length === 0 && <div className="p-8 text-center text-gray-500 font-bold text-lg">No maintenance records found.</div>}
            
            {logs.map((log) => (
                <div key={log.id} className="p-5 hover:bg-white transition-colors border-l-4 border-transparent hover:border-blue-500">
                    
                    {/* Log Header Row */}
                    <div className="flex flex-col md:flex-row justify-between items-start mb-3">
                        <div className="flex items-center gap-3 mb-2 md:mb-0">
                            <span className={`px-3 py-1 text-xs font-black uppercase tracking-wider rounded-full ${log.priority==='Critical'?'bg-red-600 text-white':'bg-blue-100 text-blue-800'}`}>{log.priority}</span>
                            <span className="text-sm text-gray-500 font-bold flex items-center"><Clock className="w-4 h-4 mr-1"/>{new Date(log.created_at).toLocaleDateString()}</span>
                        </div>
                        {log.status !== 'Resolved' ? 
                            <button onClick={() => resolveLog(log.id)} className="flex items-center text-xs bg-green-600 text-white px-3 py-1.5 rounded font-bold hover:bg-green-700 shadow-sm"><CheckSquare className="w-4 h-4 mr-1"/> Mark as Resolved</button> 
                            : <span className="px-3 py-1.5 text-xs font-black uppercase tracking-wider text-green-800 bg-green-100 rounded-full flex items-center"><CheckCircle className="w-4 h-4 mr-1"/> Resolved</span>
                        }
                    </div>
                    
                    {/* Log Description */}
                    <p className="text-lg font-black text-gray-900 mb-3">{log.description}</p>
                    
                    {/* Action/Resp Details */}
                    {(log.action_required || log.responsible_person) && (
                        <div className="text-sm text-gray-700 mb-4 bg-white border-2 border-gray-200 p-3 rounded-lg grid grid-cols-1 md:grid-cols-2 gap-2">
                            {log.action_required && <div className="flex"><span className="font-bold uppercase text-gray-500 w-20">Action:</span> <span className="font-bold">{log.action_required}</span></div>}
                            {log.responsible_person && <div className="flex"><span className="font-bold uppercase text-gray-500 w-20">Resp:</span> <span className="font-bold">{log.responsible_person}</span></div>}
                        </div>
                    )}

                    {/* ----- EVIDENCE SECTION (Photos for this specific log) ----- */}
                    <div className="mt-4 p-4 bg-gray-200/50 rounded-xl border-2 border-gray-300/50">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="text-sm font-black text-gray-700 uppercase flex items-center"><ImageIcon className="w-4 h-4 mr-2"/> Evidence Photos</h4>
                            
                            {/* THE ADD FAULT PHOTO BUTTON (MADE VERY OBVIOUS NOW) */}
                            <label className="cursor-pointer text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 flex items-center px-4 py-2 rounded-md shadow-md transition-all">
                                <Plus className="w-5 h-5 mr-2"/> Add Photo to this Log
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLogUpload(e, log.id)} disabled={uploading} />
                            </label>
                        </div>
                        
                        {/* Photo Thumbnail Grid */}
                        <div className="flex flex-wrap gap-3">
                            {(!evidence[log.id] || evidence[log.id].length === 0) ? (
                                <div className="text-sm text-gray-500 font-bold italic py-4 w-full text-center bg-white rounded border-2 border-dashed border-gray-300">No photos attached to this report yet. Click the blue button above to add one.</div>
                            ) : (
                                evidence[log.id].map((pic: any) => (
                                    <div key={pic.id} className="relative w-24 h-24 group rounded-lg overflow-hidden shadow-sm border-2 border-white">
                                        <img src={pic.image_url} className="w-full h-full object-cover cursor-pointer hover:scale-110 transition-transform" onClick={()=>window.open(pic.image_url, '_blank')} alt="Evidence" />
                                        <button onClick={() => deleteEvidencePhoto(pic.id)} className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"><X className="w-3 h-3"/></button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                    {/* --------------------------------------------------------- */}

                </div>
            ))}
        </div>
      </div>
    </div>
  )
}