"use client"
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Save, AlertTriangle, CheckCircle, XCircle, Camera } from 'lucide-react'

export default function VehicleDetails() {
  const { id } = useParams()
  const router = useRouter()
  const [vehicle, setVehicle] = useState<any>(null)
  const [loading, setLoading] = useState(true)
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

  // 2. Function to Update Status
  async function handleUpdateStatus() {
    if (!vehicle) return

    // If changing to Inactive, set the date. If Active, clear the date.
    const inactiveDate = newStatus === 'Inactive' ? new Date().toISOString() : null

    const { error } = await supabase
      .from('vehicles')
      .update({ status: newStatus, inactive_since: inactiveDate })
      .eq('id', vehicle.id)

    if (error) alert('Error updating status')
    else {
      alert('Status Updated!')
      router.refresh() // Refresh page to show new data
      window.location.reload()
    }
  }

  // 3. Function to Add Maintenance Log
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
      setRemark('') // Clear text box
    }
  }

  if (loading) return <div className="p-8">Loading Control Room...</div>
  if (!vehicle) return <div className="p-8">Vehicle not found</div>

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Header */}
      <button onClick={() => router.push('/')} className="flex items-center text-gray-600 mb-6">
        <ArrowLeft className="w-5 h-5 mr-2" /> Back to Dashboard
      </button>

      <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border-l-4 border-blue-600">
        <h1 className="text-3xl font-bold text-gray-900">{vehicle.vehicle_uid}</h1>
        <p className="text-gray-500 mt-1">
          {vehicle.vehicle_types?.name || 'Unknown Type'} • {vehicle.tob}
        </p>
      </div>

      {/* Control Panel Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Card 1: Status Changer */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <CheckCircle className="w-6 h-6 mr-2 text-green-600" />
            Update Status
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Current Condition</label>
              <select 
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="mt-1 block w-full p-3 border border-gray-300 rounded-md"
              >
                <option value="Active">🟢 Active (Mission Ready)</option>
                <option value="Inactive">🔴 Inactive (Off Road)</option>
                <option value="Maintenance">🟠 In Maintenance</option>
              </select>
            </div>

            <button 
              onClick={handleUpdateStatus}
              className="w-full flex justify-center items-center py-3 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-bold"
            >
              <Save className="w-5 h-5 mr-2" />
              Save Status Change
            </button>
          </div>
        </div>

        {/* Card 2: Report Fault */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <AlertTriangle className="w-6 h-6 mr-2 text-orange-500" />
            Report Fault / Log
          </h2>

          <div className="space-y-4">
            <textarea
              placeholder="Describe the issue (e.g., Brake pad failure, Flat tyre)..."
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md h-32"
            />
            
            <div className="flex gap-4">
              <select 
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="block w-1/2 p-3 border border-gray-300 rounded-md"
              >
                <option value="Routine">Routine</option>
                <option value="Critical">🔥 Critical</option>
              </select>

              <button 
                onClick={handleAddLog}
                className="w-1/2 bg-gray-800 text-white rounded-md hover:bg-gray-900 font-bold"
              >
                Submit Log
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}