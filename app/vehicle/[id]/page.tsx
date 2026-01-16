'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'

export default function VehicleDetail() {
  const { id } = useParams() // Gets the ID from the URL
  const [vehicle, setVehicle] = useState<any>(null)

  useEffect(() => {
    if (id) getVehicleDetails()
  }, [id])

  async function getVehicleDetails() {
    const { data } = await supabase.from('vehicles').select('*').eq('id', id).single()
    setVehicle(data)
  }

  if (!vehicle) return <div className="p-5">Loading Vehicle Data...</div>

  return (
    <div className="p-6 max-w-lg mx-auto bg-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4">{vehicle.vehicle_uid}</h1>
      
      <div className="bg-gray-100 p-4 rounded mb-6">
        <p><strong>Status:</strong> {vehicle.status}</p>
        <p><strong>Location:</strong> {vehicle.tob}</p>
        <p><strong>Mileage:</strong> {vehicle.mileage} KM</p>
      </div>

      {/* Simple Form to Update Status */}
      <h2 className="text-xl font-bold mb-2">Update Status</h2>
      <button 
        className="w-full bg-blue-600 text-white p-3 rounded mb-2"
        onClick={() => alert("Here we will add the Upload Photo Logic")}
      >
        Upload Repair Photo
      </button>
      
      {/* QR Code Display for Printing */}
      <div className="mt-10 border-t pt-5 text-center">
        <p className="text-sm text-gray-500 mb-2">QR Code for this Vehicle:</p>
        <img 
          src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${typeof window !== 'undefined' ? window.location.href : ''}`} 
          className="mx-auto" 
          alt="Vehicle QR" 
        />
      </div>
    </div>
  )
}