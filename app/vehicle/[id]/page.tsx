"use client"
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { deleteVehicle } from '@/app/actions' 
import QRCode from "react-qr-code" 
import { 
  ArrowLeft, Camera, Wrench, Clock, Edit2, X, Save, Trash2, Plus, 
  ImageIcon, User, AlertOctagon, Minus, ArrowDown, LogOut, QrCode, 
  AlertTriangle, CheckCircle, Maximize2, FileBadge
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
  const [userRole, setUserRole] = useState('') 
  
  // --- MODALS ---
  const [showQr, setShowQr] = useState(false)
  const [viewImage, setViewImage] = useState<string | null>(null) // For enlarging photos

  // --- EDIT PROFILE STATE ---
  const [isEditing, setIsEditing] = useState(false)
  const [editFormData, setEditFormData] = useState({
    vehicle_uid: '', tob: '', vehicle_type_id: '', mileage: 0, 
    operational_category: '', status: '', description: '',
    // New Field for Last Update
    updater_un_id: '', 
  })
  const [updaterPhotoFile, setUpdaterPhotoFile] = useState<File | null>(null)

  // --- LOG EDITING STATE (WORKSHOP ADMIN) ---
  const [editingLogId, setEditingLogId] = useState<string | null>(null)
  const [editLogData, setEditLogData] = useState<any>({})

  // --- NEW REPORT STATE ---
  const [uploading, setUploading] = useState(false)
  const [remark, setRemark] = useState('')
  const [priority, setPriority] = useState('Routine')
  const [logFile, setLogFile] = useState<File | null>(null)
  const [actionReq, setActionReq] = useState('')
  const [responsible, setResponsible] = useState('')
  const [estDays, setEstDays] = useState('')
  const [officerRemarks, setOfficerRemarks] = useState('')
  const [genNotes, setGenNotes] = useState('')
  const [maintStatus, setMaintStatus] = useState('Pending')
  
  // New Reporter Fields
  const [reporterUnId, setReporterUnId] = useState('')
  const [reporterPhotoFile, setReporterPhotoFile] = useState<File | null>(null)

  // --- LISTS ---
  const tobList = ['NDROMO', 'BAYOO', 'RHOO', 'DRODRO']
  const opCats = ['Fully Mission Capable', 'Degraded', 'Non-Mission Capable']
  const vehicleStatuses = ['Active', 'Inactive', 'Maintenance']
  
  // --- FETCH DATA ---
  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        if(profile) setUserRole(profile.role)
    }

    const { data: vehicleRaw } = await supabase.from('vehicles').select('*').eq('id', id).single()
    const { data: vehicleView } = await supabase.from('vehicle_dashboard_view').select('*').eq('id', id).single()
    const vehicleData = { ...vehicleView, ...vehicleRaw }

    const { data: typesData } = await supabase.from('vehicle_types').select('*')
    const { data: galleryData } = await supabase.from('vehicle_gallery').select('*').eq('vehicle_id', id).order('created_at', { ascending: false })
    const { data: logData } = await supabase.from('maintenance_logs').select('*').eq('vehicle_id', id).order('logged_date', { ascending: false })

    if (vehicleData) {
      setVehicle(vehicleData)
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
        status: vehicleData.status || 'Active',
        description: vehicleData.description || '',
        updater_un_id: vehicleData.last_updated_by_un_id || ''
      })
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

  // --- SAVE PROFILE (UPDATED SECTION 2) ---
  async function saveProfile() {
    // Validate UN ID Format
    const unIdRegex = /^M-\d{8}$/
    if (editFormData.updater_un_id && !unIdRegex.test(editFormData.updater_un_id)) {
        return alert("Updater UN ID must match format M-12345678")
    }

    setUploading(true)
    let updaterPhotoUrl = vehicle.last_updated_by_photo // Keep old photo by default

    // Upload new ID photo if selected
    if (updaterPhotoFile) {
        const blob = await resizeImage(updaterPhotoFile)
        const fileName = `updater_id_${vehicle.id}_${Date.now()}.jpg`
        const { error } = await supabase.storage.from('vehicle-media').upload(fileName, blob, { contentType: 'image/jpeg', upsert: true })
        if (!error) {
            const { data } = supabase.storage.from('vehicle-media').getPublicUrl(fileName)
            updaterPhotoUrl = data.publicUrl
        }
    }

    const { error } = await supabase.from('vehicles').update({
        vehicle_uid: editFormData.vehicle_uid,
        tob: editFormData.tob,
        vehicle_type_id: editFormData.vehicle_type_id,
        mileage: editFormData.mileage,
        operational_category: editFormData.operational_category,
        status: editFormData.status,
        description: editFormData.description,
        // Update Info
        last_updated_by_un_id: editFormData.updater_un_id,
        last_updated_by_photo: updaterPhotoUrl,
        updated_at: new Date().toISOString()
      }).eq('id', vehicle.id)

    setUploading(false)
    if(error) alert("Error saving: " + error.message)
    else { setIsEditing(false); fetchData() }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleDeleteVehicle() {
      const confirmText = prompt("WARNING: Type 'DELETE' to confirm:")
      if (confirmText !== 'DELETE') return 
      setLoading(true)
      const result = await deleteVehicle(vehicle.id)
      if (result.success) { alert('Vehicle Destroyed.'); router.push('/') } 
      else { alert('Error: ' + result.error); setLoading(false) }
  }

  // --- SUBMIT NEW LOG (UPDATED SECTION 3) ---
  async function handleSubmitLog() {
    if (!remark) return alert('Please write a fault description.')
    
    // Validate Reporter UN ID
    const unIdRegex = /^M-\d{8}$/
    if (!reporterUnId || !unIdRegex.test(reporterUnId)) {
        return alert("Reporter UN ID is required and must match format M-12345678")
    }

    setUploading(true)
    try {
        let reporterPhotoUrl = null

        // 1. Upload Reporter ID Photo
        if (reporterPhotoFile) {
            const blob = await resizeImage(reporterPhotoFile)
            const fileName = `reporter_id_${Date.now()}.jpg`
            const { error: upErr } = await supabase.storage.from('vehicle-media').upload(fileName, blob, { contentType: 'image/jpeg', upsert: true })
            if (!upErr) {
                const { data } = supabase.storage.from('vehicle-media').getPublicUrl(fileName)
                reporterPhotoUrl = data.publicUrl
            }
        }

        // 2. Create Log Entry
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
            logged_date: new Date().toISOString(),
            // New Fields
            reported_by_un_id: reporterUnId,
            reported_by_photo: reporterPhotoUrl
        }).select().single()

        if(error) throw error

        // 3. Upload Evidence Photo
        if (logFile && newLog) {
            const blob = await resizeImage(logFile)
            const fileName = `log_${newLog.id}_${Date.now()}.jpg`
            const { error: uploadErr } = await supabase.storage.from('vehicle-media').upload(fileName, blob, { contentType: 'image/jpeg', upsert: true })
            if (uploadErr) throw uploadErr
            const { data: { publicUrl } } = supabase.storage.from('vehicle-media').getPublicUrl(fileName)
            await supabase.from('log_evidence').insert({ log_id: newLog.id, image_url: publicUrl })
        }

        alert('Issue Reported Successfully!')
        // Reset Form
        setRemark(''); setActionReq(''); setResponsible(''); setLogFile(null); 
        setPriority('Routine'); setEstDays(''); setOfficerRemarks(''); setGenNotes(''); setMaintStatus('Pending');
        setReporterUnId(''); setReporterPhotoFile(null);
        await fetchData() 
    } catch (err: any) { alert("Error: " + err.message) } finally { setUploading(false) }
  }

  // --- EDIT EXISTING LOG (Workshop Admin Only) ---
  function startEditingLog(log: any) {
      setEditingLogId(log.id)
      setEditLogData({
          description: log.description,
          priority: log.priority,
          status: log.status,
          action_required: log.action_required || '',
          responsible_person: log.responsible_person || '',
          estimated_repair_days: log.estimated_repair_days || 0,
          remarks: log.remarks || '',
          notes: log.notes || ''
      })
  }

  async function saveLogChanges(logId: string) {
      const { error } = await supabase.from('maintenance_logs').update({
          ...editLogData,
          updated_at: new Date().toISOString()
      }).eq('id', logId)

      if (error) alert("Failed to update: " + error.message)
      else {
          alert("Log Updated Successfully!")
          setEditingLogId(null)
          fetchData()
      }
  }

  // --- UI HELPERS ---
  const getPriorityBadge = (p: string) => {
      if (p === 'Critical') return <span className="flex items-center bg-red-600 text-white px-3 py-1 rounded-full text-xs font-black uppercase"><AlertOctagon className="w-4 h-4 mr-1"/> Critical</span>
      if (p === 'Low') return <span className="flex items-center bg-green-600 text-white px-3 py-1 rounded-full text-xs font-black uppercase"><ArrowDown className="w-4 h-4 mr-1"/> Low</span>
      return <span className="flex items-center bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-black uppercase"><Minus className="w-4 h-4 mr-1"/> Routine</span>
  }

  const getLoginUrl = (v: any) => `${window.location.origin}/login?auto_email=${encodeURIComponent(v.auto_email)}&auto_pass=${encodeURIComponent(v.auto_password)}`

  if (loading) return <div className="p-8 font-bold text-xl">Loading...</div>
  if (!vehicle) return <div className="p-8 font-bold text-xl text-red-600">Vehicle not found</div>

  const isWorkshopAdmin = (userRole === 'workshop_admin' || userRole === 'super_admin')

  return (
    <div className="min-h-screen bg-gray-100 p-4 pb-24">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <button onClick={() => router.push('/')} className="flex items-center text-gray-700 font-bold bg-white px-3 py-2 rounded shadow-sm w-fit border border-gray-200 hover:bg-gray-50">
           <ArrowLeft className="w-5 h-5 mr-2" /> Back to Dashboard
        </button>
        <button onClick={handleLogout} className="flex items-center text-red-600 bg-white px-3 py-2 rounded shadow-sm font-bold border border-red-100 hover:bg-red-50">
           <LogOut className="w-5 h-5 mr-2" /> Sign Out
        </button>
      </div>

      {/* 1. PROFILE PHOTOS (WITH ENLARGE) */}
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
                <div key={p.id} className="relative aspect-square group rounded-lg overflow-hidden shadow-sm border border-gray-200 cursor-pointer" onClick={() => setViewImage(p.image_url)}>
                    <img src={p.image_url} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" alt="Profile" />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Maximize2 className="text-white w-6 h-6 drop-shadow-md"/>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); deleteGalleryPhoto(p.id); }} className="absolute top-1 right-1 bg-red-600/80 hover:bg-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"><Trash2 className="w-3 h-3" /></button>
                </div>
            ))}
        </div>
      </div>

      {/* 2. IDENTITY & STATS (WITH LAST UPDATE SECTION) */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
            <h2 className="text-xl font-black text-gray-900">Vehicle Identity & Stats</h2>
            <div className="flex gap-2">
                {vehicle.auto_email && (
                    <button onClick={() => setShowQr(true)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-2 rounded shadow-sm border border-gray-300"><QrCode className="w-4 h-4" /></button>
                )}
                {!isEditing ? (
                    <button onClick={() => setIsEditing(true)} className="text-blue-700 flex items-center text-sm font-bold bg-blue-50 px-3 py-1 rounded hover:bg-blue-100"><Edit2 className="w-4 h-4 mr-1" /> Edit Profile</button>
                ) : (
                    <div className="flex gap-2">
                        <button onClick={() => setIsEditing(false)} className="text-gray-600 bg-gray-100 px-3 py-1 rounded font-bold flex items-center"><X className="w-4 h-4 mr-1" /> Cancel</button>
                        <button onClick={saveProfile} disabled={uploading} className="text-white bg-green-600 px-3 py-1 rounded font-bold flex items-center hover:bg-green-700">{uploading ? 'Saving...' : <><Save className="w-4 h-4 mr-1" /> Save</>}</button>
                    </div>
                )}
            </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div><label className="block text-xs font-extrabold text-gray-500 uppercase mb-1">Vehicle ID</label>{isEditing ? <input type="text" value={editFormData.vehicle_uid} onChange={(e) => setEditFormData({...editFormData, vehicle_uid: e.target.value})} className="w-full p-2 border-2 border-blue-200 rounded font-bold"/> : <p className="text-lg font-black text-gray-900">{vehicle.vehicle_uid}</p>}</div>
            <div><label className="block text-xs font-extrabold text-gray-500 uppercase mb-1">Location (TOB)</label>{isEditing ? <select value={editFormData.tob} onChange={(e) => setEditFormData({...editFormData, tob: e.target.value})} className="w-full p-2 border-2 border-blue-200 rounded font-bold">{tobList.map(t => <option key={t} value={t}>{t}</option>)}</select> : <p className="text-lg font-bold text-gray-900">{vehicle.tob}</p>}</div>
            <div className="md:col-span-2">
                <label className="block text-xs font-extrabold text-gray-500 uppercase mb-1">Description</label>
                {isEditing ? <input type="text" value={editFormData.description} onChange={(e) => setEditFormData({...editFormData, description: e.target.value})} className="w-full p-2 border-2 border-blue-200 rounded font-bold" /> : <p className="text-lg font-bold text-gray-900">{vehicle.description || '---'}</p>}
            </div>
            <div><label className="block text-xs font-extrabold text-gray-500 uppercase mb-1">Type</label>{isEditing ? <select value={editFormData.vehicle_type_id} onChange={(e) => setEditFormData({...editFormData, vehicle_type_id: e.target.value})} className="w-full p-2 border-2 border-blue-200 rounded font-bold">{types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select> : <p className="text-lg font-bold text-gray-900">{vehicle.vehicle_type_name}</p>}</div>
            <div><label className="block text-xs font-extrabold text-gray-500 uppercase mb-1">Mileage</label>{isEditing ? <input type="number" value={editFormData.mileage} onChange={(e) => setEditFormData({...editFormData, mileage: Number(e.target.value)})} className="w-full p-2 border-2 border-blue-200 rounded font-bold"/> : <p className="text-lg font-bold text-gray-900">{vehicle.mileage} km</p>}</div>
            <div><label className="block text-xs font-extrabold text-gray-500 uppercase mb-1">Status</label>{isEditing ? <select value={editFormData.status} onChange={(e) => setEditFormData({...editFormData, status: e.target.value})} className="w-full p-2 border-2 border-blue-200 rounded font-bold">{vehicleStatuses.map(s => <option key={s} value={s}>{s}</option>)}</select> : <span className={`px-3 py-1 text-sm font-black rounded-full inline-block ${vehicle.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{vehicle.status}</span>}</div>
            <div className="md:col-span-2"><label className="block text-xs font-extrabold text-gray-500 uppercase mb-1">Op. Category</label>{isEditing ? <select value={editFormData.operational_category} onChange={(e) => setEditFormData({...editFormData, operational_category: e.target.value})} className="w-full p-2 border-2 border-blue-200 rounded font-bold">{opCats.map(c => <option key={c} value={c}>{c}</option>)}</select> : <span className={`px-3 py-1 text-sm font-black rounded-full inline-block ${vehicle.operational_category === 'Fully Mission Capable' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{vehicle.operational_category}</span>}</div>
        
            {/* SUB-SECTION: LAST UPDATE */}
            <div className="md:col-span-2 mt-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h3 className="text-sm font-black uppercase text-gray-500 mb-3 flex items-center"><Clock className="w-4 h-4 mr-2"/> Last Update</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Updated On</p>
                        <p className="text-sm font-black text-gray-900">
                            {vehicle.updated_at ? new Date(vehicle.updated_at).toLocaleString() : '---'}
                        </p>
                    </div>
                    
                    {isEditing ? (
                        <div className="space-y-2">
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase">Updated By (UN ID)</p>
                                <input type="text" value={editFormData.updater_un_id} onChange={e => setEditFormData({...editFormData, updater_un_id: e.target.value})} placeholder="M-12345678" className="w-full p-2 border rounded font-bold text-sm"/>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase">Photo of UN ID</p>
                                <input type="file" accept="image/*" capture="environment" onChange={e => setUpdaterPhotoFile(e.target.files ? e.target.files[0] : null)} className="w-full text-xs" />
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase">Updated By</p>
                                <p className="text-sm font-black text-gray-900">{vehicle.last_updated_by_un_id || '---'}</p>
                            </div>
                            {vehicle.last_updated_by_photo && (
                                <img src={vehicle.last_updated_by_photo} className="w-10 h-10 rounded border object-cover cursor-pointer" onClick={() => setViewImage(vehicle.last_updated_by_photo)} />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>

      {/* 3. REPORT NEW ISSUE (WITH REPORETER SECTION) */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8 border-t-4 border-orange-500">
          <h2 className="text-xl font-black mb-4 flex items-center text-orange-700"><AlertTriangle className="w-6 h-6 mr-2" /> Report New Issue</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                  <div>
                      <p className="text-xs font-bold text-gray-500 uppercase mb-1">1. Fault Description (Required)</p>
                      <textarea value={remark} onChange={(e) => setRemark(e.target.value)} className="w-full p-3 border-2 border-gray-300 rounded-md h-24 font-bold focus:border-orange-500 text-gray-900" placeholder="Describe fault..." />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                        <div><p className="text-xs font-bold text-gray-500 uppercase mb-1">Priority</p><select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full p-2 border-2 border-gray-300 rounded font-bold text-gray-900"><option value="Low">Low</option><option value="Routine">Routine</option><option value="Critical">Critical</option></select></div>
                        <div><p className="text-xs font-bold text-gray-500 uppercase mb-1">Photo Evidence</p><label className="cursor-pointer w-full flex items-center justify-center p-2 border-2 border-dashed border-gray-400 rounded hover:bg-gray-50 bg-white"><Camera className="w-4 h-4 mr-2 text-gray-600"/><span className="text-xs font-bold text-gray-700 truncate">{logFile ? "Photo Selected" : "Take Photo"}</span><input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setLogFile(e.target.files ? e.target.files[0] : null)} /></label></div>
                  </div>
              </div>
              <div className="space-y-3">
                  {/* Maintenance Details */}
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                      <h3 className="text-sm font-black uppercase text-gray-400 flex items-center"><User className="w-4 h-4 mr-1"/> Maintenance Details</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <input type="text" value={actionReq} onChange={(e) => setActionReq(e.target.value)} className="w-full p-2 border rounded font-bold text-sm text-gray-900" placeholder="Action Required" />
                          <input type="text" value={responsible} onChange={(e) => setResponsible(e.target.value)} className="w-full p-2 border rounded font-bold text-sm text-gray-900" placeholder="Resp. Person" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <input type="number" value={estDays} onChange={(e) => setEstDays(e.target.value)} className="w-full p-2 border rounded font-bold text-sm text-gray-900" placeholder="Est. Repair Days" />
                          <select value={maintStatus} onChange={(e) => setMaintStatus(e.target.value)} className="w-full p-2 border rounded font-bold text-sm text-gray-900"><option value="Pending">Status: Pending</option><option value="In Progress">Status: In Progress</option><option value="Resolved">Status: Resolved</option></select>
                      </div>
                      <input type="text" value={officerRemarks} onChange={(e) => setOfficerRemarks(e.target.value)} className="w-full p-2 border rounded font-bold text-sm text-gray-900" placeholder="Workshop Remarks" />
                      <input type="text" value={genNotes} onChange={(e) => setGenNotes(e.target.value)} className="w-full p-2 border rounded font-bold text-sm text-gray-900" placeholder="Other Notes" />
                  </div>

                  {/* REPORTED BY SECTION */}
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 space-y-3">
                      <h3 className="text-sm font-black uppercase text-blue-600 flex items-center"><FileBadge className="w-4 h-4 mr-1"/> Reported By (Mandatory)</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                              <label className="text-[10px] font-bold text-gray-500 uppercase">UN ID Number</label>
                              <input type="text" value={reporterUnId} onChange={(e) => setReporterUnId(e.target.value)} className="w-full p-2 border rounded font-bold text-sm text-gray-900 border-blue-300" placeholder="M-12345678" />
                          </div>
                          <div>
                              <label className="text-[10px] font-bold text-gray-500 uppercase">Photo of UN ID</label>
                              <input type="file" accept="image/*" capture="environment" onChange={(e) => setReporterPhotoFile(e.target.files ? e.target.files[0] : null)} className="w-full text-xs" />
                          </div>
                      </div>
                  </div>
              </div>
          </div>
          <button onClick={handleSubmitLog} disabled={uploading} className="w-full mt-4 bg-orange-600 text-white py-3 rounded-lg font-black text-lg hover:bg-orange-700 shadow-md">{uploading ? 'Uploading & Saving...' : 'Submit Full Report'}</button>
      </div>

      {/* 4. MAINTENANCE HISTORY (UPDATED WITH REPORTER INFO) */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200 mb-8">
        <div className="p-4 bg-gray-800 border-b border-gray-900 flex items-center justify-between">
            <h3 className="text-lg font-black text-white uppercase tracking-wider flex items-center"><Wrench className="w-5 h-5 mr-2" /> Maintenance History</h3>
        </div>
        <div className="divide-y divide-gray-200 bg-gray-50">
            {logs.length === 0 && <div className="p-8 text-center text-gray-500 font-bold">No maintenance records found.</div>}
            
            {logs.map((log) => {
                const isEditingThis = editingLogId === log.id
                return (
                <div key={log.id} className={`p-5 transition-colors border-l-4 ${isEditingThis ? 'bg-blue-50 border-blue-500' : 'hover:bg-white border-transparent hover:border-gray-300'}`}>
                    
                    {/* Header Row: Priority & Status */}
                    <div className="flex flex-col md:flex-row justify-between items-start mb-4">
                        <div className="flex flex-wrap items-center gap-3">
                            {isEditingThis ? (
                                <select value={editLogData.priority} onChange={e => setEditLogData({...editLogData, priority: e.target.value})} className="border p-1 rounded font-bold text-sm">
                                    <option value="Routine">Routine</option><option value="Low">Low</option><option value="Critical">Critical</option>
                                </select>
                            ) : getPriorityBadge(log.priority)}
                            
                            <span className="text-xs text-gray-500 font-bold flex items-center bg-gray-100 px-2 py-1 rounded">
                                <Clock className="w-3 h-3 mr-1"/> {new Date(log.logged_date).toLocaleString()}
                            </span>
                        </div>
                        
                        <div className="flex items-center gap-2 mt-2 md:mt-0">
                            {isEditingThis ? (
                                <select value={editLogData.status} onChange={e => setEditLogData({...editLogData, status: e.target.value})} className="border p-1 rounded font-bold text-sm bg-white">
                                    <option value="Pending">Pending</option><option value="In Progress">In Progress</option><option value="Resolved">Resolved</option>
                                </select>
                            ) : (
                                <span className={`px-3 py-1 text-xs font-black uppercase rounded-full ${log.status === 'Resolved' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                                    {log.status}
                                </span>
                            )}
                            
                            {/* WORKSHOP ADMIN EDIT BUTTON */}
                            {isWorkshopAdmin && !isEditingThis && (
                                <button onClick={() => startEditingLog(log)} className="text-blue-600 hover:bg-blue-100 p-1.5 rounded"><Edit2 className="w-4 h-4"/></button>
                            )}
                        </div>
                    </div>
                    
                    {/* Description */}
                    <div className="mb-4">
                        <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Fault Description</p>
                        {isEditingThis ? (
                            <textarea value={editLogData.description} onChange={e => setEditLogData({...editLogData, description: e.target.value})} className="w-full p-2 border rounded font-bold text-gray-900" rows={2}/>
                        ) : (
                            <p className="text-xl font-black text-gray-900 pl-1 border-l-2 border-gray-300">{log.description}</p>
                        )}
                    </div>

                    {/* Detailed Fields Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                          {/* Action Required */}
                          <div>
                              <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Action Required</p>
                              {isEditingThis ? <input type="text" value={editLogData.action_required} onChange={e => setEditLogData({...editLogData, action_required: e.target.value})} className="w-full p-1 border rounded text-sm font-bold"/> 
                              : <p className="font-bold text-sm text-gray-800">{log.action_required || '---'}</p>}
                          </div>
                          {/* Responsible Person */}
                          <div>
                              <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Responsible Person</p>
                              {isEditingThis ? <input type="text" value={editLogData.responsible_person} onChange={e => setEditLogData({...editLogData, responsible_person: e.target.value})} className="w-full p-1 border rounded text-sm font-bold"/> 
                              : <p className="font-bold text-sm text-gray-800">{log.responsible_person || '---'}</p>}
                          </div>
                          {/* Est Days */}
                          <div>
                              <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Est. Repair Days</p>
                              {isEditingThis ? <input type="number" value={editLogData.estimated_repair_days} onChange={e => setEditLogData({...editLogData, estimated_repair_days: e.target.value})} className="w-full p-1 border rounded text-sm font-bold"/> 
                              : <p className="font-bold text-sm text-gray-800">{log.estimated_repair_days || '0'} Days</p>}
                          </div>
                          {/* Workshop Remarks */}
                          <div>
                              <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Workshop Remarks</p>
                              {isEditingThis ? <input type="text" value={editLogData.remarks} onChange={e => setEditLogData({...editLogData, remarks: e.target.value})} className="w-full p-1 border rounded text-sm font-bold"/> 
                              : <p className="font-bold text-sm text-gray-800">{log.remarks || '---'}</p>}
                          </div>
                          {/* Other Notes */}
                          <div className="md:col-span-2">
                              <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Other Notes</p>
                              {isEditingThis ? <input type="text" value={editLogData.notes} onChange={e => setEditLogData({...editLogData, notes: e.target.value})} className="w-full p-1 border rounded text-sm font-bold"/> 
                              : <p className="font-bold text-sm text-gray-800">{log.notes || '---'}</p>}
                          </div>
                    </div>

                    {/* REPORTER INFO (READ ONLY) */}
                    <div className="mb-4 bg-blue-50 p-3 rounded border border-blue-100 flex items-center justify-between">
                        <div>
                            <p className="text-[9px] font-black uppercase text-blue-400">Reported By</p>
                            <p className="text-sm font-bold text-blue-900">{log.reported_by_un_id || 'Unknown'}</p>
                        </div>
                        {log.reported_by_photo && (
                            <img src={log.reported_by_photo} className="w-10 h-10 rounded border border-blue-200 cursor-pointer object-cover" onClick={() => setViewImage(log.reported_by_photo)} alt="Reporter ID" />
                        )}
                    </div>

                    {/* EDIT ACTIONS */}
                    {isEditingThis && (
                        <div className="flex justify-end gap-3 mb-4">
                            <button onClick={() => setEditingLogId(null)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded font-bold text-sm">Cancel</button>
                            <button onClick={() => saveLogChanges(log.id)} className="px-4 py-2 bg-green-600 text-white rounded font-bold text-sm flex items-center"><CheckCircle className="w-4 h-4 mr-2"/> Save Changes</button>
                        </div>
                    )}
                    
                    {/* Photos */}
                    <div className="mt-2 p-3 bg-white rounded-lg border border-gray-200">
                        <h4 className="text-xs font-black text-gray-400 uppercase flex items-center mb-2"><ImageIcon className="w-3 h-3 mr-1"/> Evidence</h4>
                        <div className="flex flex-wrap gap-2">
                            {(!evidence[log.id] || evidence[log.id].length === 0) ? <span className="text-xs italic text-gray-400">No photos.</span> : 
                                evidence[log.id].map((pic: any) => (
                                    <img key={pic.id} src={pic.image_url} className="w-16 h-16 object-cover rounded border cursor-pointer hover:scale-110 transition-transform" onClick={()=>setViewImage(pic.image_url)} />
                                ))
                            }
                            <label className="cursor-pointer w-16 h-16 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded hover:bg-blue-50 text-blue-500">
                                <Plus className="w-4 h-4"/>
                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleLogUpload(e, log.id)} />
                            </label>
                        </div>
                    </div>
                </div>
            )})}
        </div>
      </div>

      {/* DANGER ZONE (Delete) */}
      {userRole === 'super_admin' && (
          <div className="mt-12 p-8 bg-red-50 border-2 border-red-200 rounded-xl text-center">
              <h3 className="text-2xl font-black text-red-700 uppercase mb-2">Danger Zone</h3>
              <button onClick={handleDeleteVehicle} className="bg-red-600 hover:bg-red-700 text-white font-black py-4 px-8 rounded-lg shadow-lg uppercase flex items-center justify-center mx-auto"><Trash2 className="w-6 h-6 mr-2" /> DELETE VEHICLE</button>
          </div>
      )}

      {/* QR MODAL */}
      {showQr && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowQr(false)}>
              <div className="bg-white p-6 rounded-2xl max-w-sm w-full text-center shadow-2xl" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-black text-gray-900">Vehicle Access Key</h3><button onClick={() => setShowQr(false)} className="p-1 hover:bg-gray-100 rounded-full"><X className="w-6 h-6 text-gray-500"/></button></div>
                  <div className="bg-white p-4 border-4 border-black rounded-xl inline-block mb-4"><QRCode value={getLoginUrl(vehicle)} size={200} style={{ height: "auto", maxWidth: "100%", width: "100%" }} viewBox={`0 0 256 256`}/></div>
                  <div className="bg-gray-100 p-2 rounded text-left border border-gray-200"><p className="text-[10px] uppercase font-bold text-gray-400">Manual Login</p><p className="text-xs font-mono text-gray-800">User: {vehicle.auto_email}</p><p className="text-xs font-mono text-gray-800">Pass: {vehicle.auto_password}</p></div>
              </div>
          </div>
      )}

      {/* IMAGE ENLARGE MODAL */}
      {viewImage && (
          <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[100] p-4 cursor-zoom-out" onClick={() => setViewImage(null)}>
              <button onClick={() => setViewImage(null)} className="absolute top-6 right-6 bg-white/10 hover:bg-white/20 text-white p-2 rounded-full"><X className="w-8 h-8"/></button>
              <img src={viewImage} className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
          </div>
      )}
    </div>
  )
}