"use client"
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, CheckCircle, AlertTriangle, Camera } from 'lucide-react'

export default function VehicleDetails() {
  const { id } = useParams()
  const router = useRouter()
  const [vehicle, setVehicle] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [newStatus, setNewStatus] = useState('')
  const [remark, setRemark] = useState('')
  const [priority, setPriority] = useState('Routine')

  // 1. Fetch Vehicle Data
  useEffect(() => {
    async function fetchVehicle() {
      const { data, error } = await supabase
        .from('vehicles')
        .select(`*, vehicle_types (name)`)
        .eq('id', id)
        .single()

      if (error) console.error(error)
      else {
        setVehicle(data)
        setNewStatus(data.status)
      }
      setLoading(false)
    }
    if (id) fetchVehicle()
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
        // Only resize if image is massive
        const newWidth = (img.width > MAX_WIDTH) ? MAX_WIDTH : img.width
        const newHeight = (img.width > MAX_WIDTH) ? (img.height * scaleSize) : img.height
        
        canvas.width = newWidth
        canvas.height = newHeight
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, newWidth, newHeight)
        
        // Compress to JPEG at 70% quality
        canvas.toBlob((blob) => {
          resolve(blob as Blob)
        }, 'image/jpeg', 0.7)
      }
    })
  }

  // 2. Handle Image Upload (With Resizing)
  async function handleImageUpload(event: any) {
    try {
      const file = event.target.files[0]
      if (!file) return
      
      setUploading(true)

      // A. Resize the image first
      const resizedBlob = await resizeImage(file)
      
      // Create filename
      const fileName = `${vehicle.id}_${Date.now()}.jpg`

      // B. Upload to 'vehicle-media'
      const { error: uploadError } = await supabase.storage
        .from('vehicle-media') 
        .upload(fileName, resizedBlob, {
           contentType: 'image/jpeg',
           upsert: true
        })

      if (uploadError) throw uploadError

      // C. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('vehicle-media')
        .getPublicUrl(fileName)

      // D. Save to Database
      const { error: dbError } = await supabase
        .from('vehicles')
        .update({ vehicle_image_url: publicUrl })
        .eq('id', vehicle.id)

      if (dbError) throw dbError

      alert('Photo Resized & Uploaded!')
      window.location.reload()

    } catch (error) {
      alert('Error uploading image. Check your internet or permissions.')
      console.error(error)
    } finally {
      setUploading(false)
    }
  }

  // 3. Update Status Function
  async function handleUpdateStatus() {
    if (!vehicle) return
    const inactiveDate = newStatus === 'Inactive' ? new Date().toISOString() : null
    const { error } = await supabase
      .from('vehicles')
      .update({ status: newStatus, inactive_since: inactiveDate })
      .eq('id', vehicle.id)

    if (error) alert('Error updating status')
    else {
      alert('Status Updated!')
      router.refresh()
      window.location.reload()
    }
  }

  // 4. Add Log Function
  async function handleAddLog() {
    if (!remark) return alert('Please write a remark first')
    const { error } = await supabase
      .from('maintenance_logs')
      .insert({
        vehicle_id: vehicle.id,
        description: remark,
        priority: priority,
        status: 'Pending'
      })

    if (error) alert('Error adding log')
    else {
      alert('Maintenance Request Logged')
      setRemark('')
    }
  }

  if (loading) return <div className="p-8">Loading...</div>
  if (!vehicle) return <div className="p-8">Vehicle not found</div>

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-20">
      <button onClick={() => router.push('/')} className="flex items-center text-gray-600 mb-4">
        <ArrowLeft className="w-5 h-5 mr-2" /> Back to Dashboard
      </button>

      {/* Image Banner */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-6">
        <div className="relative h-64 bg-gray-200">
           {/* Force refresh image by adding timestamp query param */}
           <img 
              src={vehicle.vehicle_image_url ? `${vehicle.vehicle_image_url}?t=${Date.now()}` : 'https://placehold.co/600x400?text=No+Image'} 
              className="w-full h-full object-cover"
              alt="Vehicle"
           />
           <label className="absolute bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full cursor-pointer shadow-lg flex items-center">
             <Camera className="w-6 h-6" />
             <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
             <span className="ml-2 font-bold text-sm">{uploading ? 'Processing...' : 'Update Photo'}</span>
           </label>
        </div>
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-3xl font-bold text-gray-900">{vehicle.vehicle_uid}</h1>
          <p className="text-gray-500 mt-1">{vehicle.tob} • {vehicle.status}</p>
        </div>
      </div>

      {/* Control Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4 flex items-center"><CheckCircle className="w-6 h-6 mr-2 text-green-600" /> Update Status</h2>
          <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="block w-full p-3 border border-gray-300 rounded-md mb-4">
            <option value="Active">🟢 Active</option>
            <option value="Inactive">🔴 Inactive</option>
            <option value="Maintenance">🟠 Maintenance</option>
          </select>
          <button onClick={handleUpdateStatus} className="w-full py-3 bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700">Save Status</button>
        </div>

        {/* Faults */}
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
    </div>
  )
}