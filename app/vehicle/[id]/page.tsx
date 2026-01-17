"use client"
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  ArrowLeft, CheckCircle, AlertTriangle, Camera, Wrench, 
  CheckSquare, Clock, Edit2, X, Save, Trash2, Plus, 
  ImageIcon, User, AlertOctagon, Minus, ArrowDown, Calendar
} from 'lucide-react'

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
  
  // --- EDIT PROFILE STATE ---
  const [isEditing, setIsEditing] = useState(false)
  const [editFormData, setEditFormData] = useState({
    vehicle_uid: '', tob: '', vehicle_type_id: '', mileage: 0, operational_category: '', status: ''
  })

  // --- LOG FORM STATE ---
  const [uploading, setUploading] = useState(false)
  const [newStatus, setNewStatus] = useState('')
  const [inactiveDate, setInactiveDate] = useState('')
  
  // --- NEW ISSUE REPORT DATA ---
  const [remark, setRemark] = useState('')
  const [priority, setPriority] = useState('Routine')
  const [logFile, setLogFile] = useState<File | null>(null)
  
  // Officer / Workshop Fields
  const [actionReq, setActionReq] = useState('')
  const [responsible, setResponsible] = useState('')
  const [estDays, setEstDays] = useState('')
  const [officerRemarks, setOfficerRemarks] = useState('')
  const [genNotes, setGenNotes] = useState('')
  const [maintStatus, setMaintStatus] = useState('Pending')

  // --- LISTS ---
  const tobList = ['NDROMO', 'BAYOO', 'RHOO', 'DRODRO']
  const opCats = ['Fully Mission Capable', 'Degraded', 'Non-Mission Capable']
  const vehicleStatuses = ['Active', 'Inactive', 'Maintenance']
  
  // --- FETCH DATA ---
  async function fetchData() {
    const { data: vehicleData } = await supabase.from('vehicle_dashboard_view').select('*').eq('id', id).single()
    const { data: typesData } = await supabase.from('vehicle_types').select('*')
    const { data: galleryData } = await supabase.from('vehicle_gallery').select('*').eq('vehicle_id', id).order('created_at', { ascending: false })
    const { data: logData } = await supabase.from('maintenance_logs').select('*').eq('vehicle_id', id).order('logged_date', { ascending: false })

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
        operational_category: vehicleData.operational_category || 'Fully Mission Capable',
        status: vehicleData.status || 'Active'
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

  // --- IMAGE RESIZER ---
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

  // --- ACTIONS ---
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
        operational_category: editFormData.operational_category,
        status: editFormData.status
      }).eq('id', vehicle.id)
    if(error) alert("Error saving: " + error.message)
    else { setIsEditing(false); fetchData() }
  }

  async function handleUpdateStatus() {
    const d = newStatus === 'Inactive' ? (new Date(inactiveDate).toISOString()) : null
    await supabase.from('vehicles').update({ status: newStatus, inactive_since: d }).eq('id', vehicle.id)
    alert('Status Updated!'); router.refresh(); window.location.reload()
  }

  // --- SUBMIT FULL LOG ---
  async function handleSubmitLog() {
    if (!remark) return alert('Please write a fault description.')
    setUploading(true)
    try {
        const { data: newLog, error } = await supabase.from('maintenance_logs').insert({ 
            vehicle_id: vehicle.id, 
            description: remark, 
            priority, 
            status: maintStatus,
            action_required: actionReq, 
            responsible_person: responsible, 
            estimated_repair_days: estDays ? parseInt(estDays) : 0,
            remarks: officerRemarks,
            notes: genNotes,
            logged_date: new Date().toISOString()
        }).select().single()

        if(error) throw error

        if (logFile && newLog) {
            const blob = await resizeImage(logFile)
            const fileName = `log_${newLog.id}_${Date.now()}.jpg`
            const { error: uploadErr } = await supabase.storage.from('vehicle-media').upload(fileName, blob, { contentType: 'image/jpeg', upsert: true })
            if (uploadErr) throw uploadErr
            const { data: { publicUrl } } = supabase.storage.from('vehicle-media').getPublicUrl(fileName)
            await supabase.from('log_evidence').insert({ log_id: newLog.id, image_url: publicUrl })
        }

        alert('Issue Reported Successfully!')
        setRemark(''); setActionReq(''); setResponsible(''); setLogFile(null); 
        setPriority('Routine'); setEstDays(''); setOfficerRemarks(''); setGenNotes(''); setMaintStatus('Pending');
        await fetchData() 
    } catch (err: any) {
        alert("Error submitting: " + err.message)
    } finally {
        setUploading(false)
    }
  }

  // --- PRIORITY UI HELPERS ---
  const getPriorityBadge = (p: string) => {
      if (p === 'Critical') return <span className="flex items-center bg-red-600 text-white px-3 py-1 rounded-full text-xs font-black uppercase"><AlertOctagon className="w-4 h-4 mr-1"/> Critical</span>
      if (p === 'Low') return <span className="flex items-center bg-green-600 text-white px-3 py-1 rounded-full text-xs font-black uppercase"><ArrowDown className="w-4 h-4 mr-1"/> Low</span>
      return <span className="flex items-center bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-black uppercase"><Minus className="w-4 h-4 mr-1"/> Routine</span>
  }

  const getPriorityColor = (p: string) => {
    if (p === 'Critical') return 'bg-red-100 text-red-800 border-red-200'
    if (p === 'Low') return 'bg-green-100 text-green-800 border-green-200'
    return 'bg-blue-100 text-blue-800 border-blue-200'
  }

  if (loading) return <div className="p-8 font-bold text-xl">Loading...</div>
  if (!vehicle) return <div className="p-8 font-bold text-xl text-red-600">Vehicle not found (ID: {id})</div>

  return (
    <div className="min-h-screen bg-gray-100 p-4 pb-20">
      <button onClick={() => router.push('/')} className="flex items-center text-gray-700 font-bold mb-4 bg-white p-2 rounded shadow-sm w-fit">
        <ArrowLeft className="w-5 h-5 mr-2" /> Back to Dashboard
      </button>

      {/* 1. PROFILE PHOTOS */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6 p-4 border-t-4 border-blue-600">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-black text-gray-800 flex items-center"><Camera className="w-5 h-5 mr-2"/> Profile Photos ({gallery.length}/10)</h2>
            <label className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md cursor-pointer flex items-center text-sm font-bold shadow-sm transition-colors">
                <Plus className="w-4 h-4 mr-1" /> Add Photo
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleMainUpload} disabled={uploading || gallery.length >= 10} />
            </label>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {gallery.length === 0 && <div className="col-span-full h-32 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 font-bold">No profile photos yet.</div>}
            {gallery.map((p) => (
                <div key={p.id} className="relative aspect-square group rounded-lg overflow-hidden shadow-sm border border-gray-200">
                    <img src={p.image_url} className="w-full h-full object-cover" alt="Profile" />
                    <button onClick={() => deleteGalleryPhoto(p.id)} className="absolute top-1 right-1 bg-red-600/80 hover:bg-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3 h-3" /></button>
                </div>
            ))}
        </div>
      </div>

      {/* 2. IDENTITY & STATS (UPDATED WITH STATUS FIELD) */}
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
            <div><label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1">Vehicle ID</label>{isEditing ? <input type="text" value={editFormData.vehicle_uid} onChange={(e) => setEditFormData({...editFormData, vehicle_uid: e.target.value})} className="w-full p-2 border-2 border-blue-200 rounded font-bold"/> : <p className="text-lg font-black text-gray-900">{vehicle.vehicle_uid}</p>}</div>
            <div><label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1">Location (TOB)</label>{isEditing ? <select value={editFormData.tob} onChange={(e) => setEditFormData({...editFormData, tob: e.target.value})} className="w-full p-2 border-2 border-blue-200 rounded font-bold">{tobList.map(t => <option key={t} value={t}>{t}</option>)}</select> : <p className="text-lg font-bold text-gray-900">{vehicle.tob}</p>}</div>
            <div><label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1">Type</label>{isEditing ? <select value={editFormData.vehicle_type_id} onChange={(e) => setEditFormData({...editFormData, vehicle_type_id: e.target.value})} className="w-full p-2 border-2 border-blue-200 rounded font-bold">{types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select> : <p className="text-lg font-bold text-gray-900">{vehicle.vehicle_type_name}</p>}</div>
            <div><label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1">Mileage</label>{isEditing ? <input type="number" value={editFormData.mileage} onChange={(e) => setEditFormData({...editFormData, mileage: Number(e.target.value)})} className="w-full p-2 border-2 border-blue-200 rounded font-bold"/> : <p className="text-lg font-bold text-gray-900">{vehicle.mileage} km</p>}</div>
            
            {/* NEW FIELD: VEHICLE STATUS */}
            <div>
               <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1">Vehicle Status</label>
               {isEditing ? (
                  <select value={editFormData.status} onChange={(e) => setEditFormData({...editFormData, status: e.target.value})} className="w-full p-2 border-2 border-blue-200 rounded font-bold">
                      {vehicleStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
               ) : (
                  <span className={`px-3 py-1 text-sm font-black rounded-full inline-block ${vehicle.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {vehicle.status}
                  </span>
               )}
            </div>

            <div className="md:col-span-2"><label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1">Op. Category</label>{isEditing ? <select value={editFormData.operational_category} onChange={(e) => setEditFormData({...editFormData, operational_category: e.target.value})} className="w-full p-2 border-2 border-blue-200 rounded font-bold">{opCats.map(c => <option key={c} value={c}>{c}</option>)}</select> : <span className={`px-3 py-1 text-sm font-black rounded-full inline-block ${vehicle.operational_category === 'Fully Mission Capable' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{vehicle.operational_category}</span>}</div>
        </div>
      </div>

      {/* 3. REPORT NEW ISSUE */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8 border-t-4 border-orange-500">
          <h2 className="text-xl font-black mb-4 flex items-center text-orange-700"><AlertTriangle className="w-6 h-6 mr-2" /> Report New Issue</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                  <div>
                      <p className="text-xs font-bold text-gray-500 uppercase mb-1">1. Fault Description (Required)</p>
                      <textarea value={remark} onChange={(e) => setRemark(e.target.value)} className="w-full p-3 border-2 border-gray-300 rounded-md h-24 font-bold focus:border-orange-500" placeholder="Describe fault..." />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                       <div>
                            <p className="text-xs font-bold text-gray-500 uppercase mb-1">Priority</p>
                            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full p-2 border-2 border-gray-300 rounded font-bold">
                                <option value="Low">Low</option>
                                <option value="Routine">Routine</option>
                                <option value="Critical">Critical</option>
                            </select>
                       </div>
                       <div>
                            <p className="text-xs font-bold text-gray-500 uppercase mb-1">Photo Evidence</p>
                            <label className="cursor-pointer w-full flex items-center justify-center p-2 border-2 border-dashed border-gray-400 rounded hover:bg-gray-50 bg-white">
                                <Camera className="w-4 h-4 mr-2 text-gray-600"/>
                                <span className="text-xs font-bold text-gray-700 truncate">{logFile ? "Photo Selected" : "Take Photo"}</span>
                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setLogFile(e.target.files ? e.target.files[0] : null)} />
                            </label>
                       </div>
                  </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                  <h3 className="text-sm font-black uppercase text-gray-400 flex items-center"><User className="w-4 h-4 mr-1"/> Workshop / Officer Section</h3>
                  <div className="grid grid-cols-2 gap-3">
                      <input type="text" value={actionReq} onChange={(e) => setActionReq(e.target.value)} className="w-full p-2 border rounded font-bold text-sm" placeholder="Action Required" />
                      <input type="text" value={responsible} onChange={(e) => setResponsible(e.target.value)} className="w-full p-2 border rounded font-bold text-sm" placeholder="Resp. Person" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                      <input type="number" value={estDays} onChange={(e) => setEstDays(e.target.value)} className="w-full p-2 border rounded font-bold text-sm" placeholder="Est. Repair Days" />
                      <select value={maintStatus} onChange={(e) => setMaintStatus(e.target.value)} className="w-full p-2 border rounded font-bold text-sm">
                          <option value="Pending">Status: Pending</option>
                          <option value="In Progress">Status: In Progress</option>
                          <option value="Resolved">Status: Resolved</option>
                      </select>
                  </div>
                  <input type="text" value={officerRemarks} onChange={(e) => setOfficerRemarks(e.target.value)} className="w-full p-2 border rounded font-bold text-sm" placeholder="Workshop Officer Remarks" />
                  <input type="text" value={genNotes} onChange={(e) => setGenNotes(e.target.value)} className="w-full p-2 border rounded font-bold text-sm" placeholder="Any Other Notes" />
              </div>
          </div>
          <button onClick={handleSubmitLog} disabled={uploading} className="w-full mt-4 bg-orange-600 text-white py-3 rounded-lg font-black text-lg hover:bg-orange-700 shadow-md">
             {uploading ? 'Uploading...' : 'Submit Full Report'}
          </button>
      </div>

      {/* 4. MAINTENANCE HISTORY */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
        <div className="p-4 bg-gray-800 border-b border-gray-900 flex items-center justify-between">
            <h3 className="text-lg font-black text-white uppercase tracking-wider flex items-center"><Wrench className="w-5 h-5 mr-2" /> Maintenance History</h3>
        </div>
        <div className="divide-y divide-gray-200 bg-gray-50">
            {logs.length === 0 && <div className="p-8 text-center text-gray-500 font-bold">No maintenance records found.</div>}
            
            {logs.map((log) => (
                <div key={log.id} className="p-5 hover:bg-white transition-colors border-l-4 border-transparent hover:border-blue-500">
                    <div className="flex flex-col md:flex-row justify-between items-start mb-4">
                        <div className="flex flex-wrap items-center gap-3">
                            {getPriorityBadge(log.priority)}
                            <span className="text-xs text-gray-500 font-bold flex items-center bg-gray-100 px-2 py-1 rounded">
                                <Clock className="w-3 h-3 mr-1"/> Updated: {log.logged_date ? new Date(log.logged_date).toLocaleString() : '---'}
                            </span>
                             <span className="text-xs text-gray-500 font-bold flex items-center bg-gray-100 px-2 py-1 rounded">
                                <Calendar className="w-3 h-3 mr-1"/> Est. Days: {log.estimated_repair_days || 0}
                            </span>
                        </div>
                        <span className={`px-3 py-1 text-xs font-black uppercase rounded-full ${log.status === 'Resolved' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                            {log.status}
                        </span>
                    </div>
                    
                    <p className="text-xl font-black text-gray-900 mb-4 pl-1 border-l-2 border-gray-300">{log.description}</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 bg-gray-100/50 p-4 rounded-lg border border-gray-200">
                         <div><p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Action Required</p><p className="font-bold text-sm text-gray-800">{log.action_required || '---'}</p></div>
                         <div><p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Responsible Person</p><p className="font-bold text-sm text-gray-800">{log.responsible_person || '---'}</p></div>
                         <div><p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Officer Remarks</p><p className="font-bold text-sm text-gray-800">{log.remarks || '---'}</p></div>
                         <div><p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Notes</p><p className="font-bold text-sm text-gray-800">{log.notes || '---'}</p></div>
                    </div>
                    
                    <div className="mt-2 p-3 bg-white rounded-lg border border-gray-200">
                        <h4 className="text-xs font-black text-gray-400 uppercase flex items-center mb-2"><ImageIcon className="w-3 h-3 mr-1"/> Evidence</h4>
                        <div className="flex flex-wrap gap-2">
                            {(!evidence[log.id] || evidence[log.id].length === 0) ? <span className="text-xs italic text-gray-400">No photos.</span> : 
                                evidence[log.id].map((pic: any) => (
                                    <img key={pic.id} src={pic.image_url} className="w-16 h-16 object-cover rounded border cursor-pointer hover:scale-110 transition-transform" onClick={()=>window.open(pic.image_url, '_blank')} />
                                ))
                            }
                            <label className="cursor-pointer w-16 h-16 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded hover:bg-blue-50 text-blue-500">
                                <Plus className="w-4 h-4"/>
                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleLogUpload(e, log.id)} />
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