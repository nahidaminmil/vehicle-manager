"use client"
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { ArrowLeft, UserPlus, Shield, Trash2, User, Truck, MapPin } from 'lucide-react'

export default function UserManagementPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  
  // Form State
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('vehicle_user')
  const [tob, setTob] = useState('NDROMO')
  const [vehicleId, setVehicleId] = useState('')
  const [creating, setCreating] = useState(false)

  const tobList = ['NDROMO', 'BAYOO', 'RHOO', 'DRODRO']
  const roles = [
    { val: 'admin', label: 'Admin Officer (Full Access)' },
    { val: 'tob_admin', label: 'TOB Commander (TOB Access)' },
    { val: 'vehicle_user', label: 'Vehicle Account (Single Vehicle)' }
  ]

  // 1. FETCH DATA
  useEffect(() => {
    async function init() {
      // Security Check: Only Super Admin allowed
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role !== 'super_admin') {
        alert('Access Denied: Super Admin Only')
        return router.push('/')
      }

      fetchUsers()
      fetchVehicles()
      setLoading(false)
    }
    init()
  }, [])

  async function fetchUsers() {
    // We fetch profiles to show the list
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    setUsers(data || [])
  }

  async function fetchVehicles() {
    const { data } = await supabase.from('vehicles').select('id, vehicle_uid').order('vehicle_uid')
    setVehicles(data || [])
  }

  // 2. CREATE USER
  async function handleCreateUser() {
    if (!email || !password) return alert('Email and Password required')
    setCreating(true)

    // A. Create Auth User (This usually requires a backend function, but for simplicity we assume Super Admin can do it or use a workaround)
    // NOTE: Client-side creation signs you in as the new user immediately. 
    // TRICK: We will call a Supabase Edge Function or just use a specialized SQL query if available.
    // For this specific template, we will use the standard signUp, which might sign you out.
    // BETTER APPROACH for this simplified app: Alert the user about this limitation.
    
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
            role_claim: role // Just metadata
        }
      }
    })

    if (authError) {
        alert('Error creating auth: ' + authError.message)
        setCreating(false)
        return
    }

    if (authData.user) {
        // B. Update the Profile Row that was auto-created by our Trigger
        const updates: any = { role }
        if (role === 'tob_admin') updates.assigned_tob = tob
        if (role === 'vehicle_user') updates.assigned_vehicle_id = vehicleId

        const { error: profileError } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', authData.user.id)
        
        if (profileError) alert('Error updating profile: ' + profileError.message)
        else {
            alert('User Created Successfully! (Note: You may need to re-login if the system switched sessions)')
            fetchUsers()
            setEmail('')
            setPassword('')
        }
    }
    setCreating(false)
  }

  // 3. DELETE USER
  async function handleDelete(id: string) {
      if(!confirm('Are you sure? This effectively bans the user.')) return
      // We can only delete the profile row from client. Auth deletion requires Admin API (Backend).
      // Deleting profile row effectively removes their access permissions due to our RLS policies.
      const { error } = await supabase.from('profiles').delete().eq('id', id)
      if (error) alert(error.message)
      else fetchUsers()
  }

  if (loading) return <div className="p-8 font-bold">Verifying Clearance...</div>

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <button onClick={() => router.push('/')} className="flex items-center text-gray-700 font-bold mb-6">
        <ArrowLeft className="w-5 h-5 mr-2" /> Back to Command
      </button>

      <h1 className="text-3xl font-black text-gray-900 mb-8 uppercase tracking-tight">User Management</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* CREATE USER FORM */}
        <div className="bg-white p-6 rounded-xl shadow-md h-fit border-t-4 border-blue-600">
            <h2 className="text-xl font-black text-gray-800 mb-4 flex items-center"><UserPlus className="w-5 h-5 mr-2"/> Create New User</h2>
            
            <div className="space-y-4">
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Email / ID</label>
                    <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full p-3 border rounded font-bold" placeholder="user@system.local" />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Password</label>
                    <input type="text" value={password} onChange={e=>setPassword(e.target.value)} className="w-full p-3 border rounded font-bold" placeholder="Password123" />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Role</label>
                    <select value={role} onChange={e=>setRole(e.target.value)} className="w-full p-3 border rounded font-bold">
                        {roles.map(r => <option key={r.val} value={r.val}>{r.label}</option>)}
                    </select>
                </div>

                {/* Conditional Fields */}
                {role === 'tob_admin' && (
                    <div className="bg-blue-50 p-3 rounded border border-blue-100">
                        <label className="text-xs font-bold text-blue-600 uppercase">Assign TOB</label>
                        <select value={tob} onChange={e=>setTob(e.target.value)} className="w-full p-2 border rounded font-bold mt-1">
                            {tobList.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                )}

                {role === 'vehicle_user' && (
                    <div className="bg-orange-50 p-3 rounded border border-orange-100">
                        <label className="text-xs font-bold text-orange-600 uppercase">Link Vehicle</label>
                        <select value={vehicleId} onChange={e=>setVehicleId(e.target.value)} className="w-full p-2 border rounded font-bold mt-1">
                            <option value="">Select Vehicle...</option>
                            {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_uid}</option>)}
                        </select>
                    </div>
                )}

                <button onClick={handleCreateUser} disabled={creating} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded shadow mt-4">
                    {creating ? 'Creating...' : 'Create User'}
                </button>
            </div>
        </div>

        {/* USER LIST */}
        <div className="lg:col-span-2 space-y-4">
            {users.map((u) => (
                <div key={u.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center">
                    <div className="flex items-center gap-4 mb-4 md:mb-0">
                        <div className={`p-3 rounded-full ${u.role === 'super_admin' ? 'bg-purple-100 text-purple-700' : u.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                            {u.role === 'super_admin' ? <Shield className="w-6 h-6"/> : <User className="w-6 h-6"/>}
                        </div>
                        <div>
                            <p className="font-bold text-gray-900">{u.email}</p>
                            <p className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                                {u.role.replace('_', ' ')}
                                {u.assigned_tob && <span className="text-blue-600 flex items-center bg-blue-50 px-2 rounded"><MapPin className="w-3 h-3 mr-1"/> {u.assigned_tob}</span>}
                                {u.assigned_vehicle_id && <span className="text-orange-600 flex items-center bg-orange-50 px-2 rounded"><Truck className="w-3 h-3 mr-1"/> Linked</span>}
                            </p>
                        </div>
                    </div>
                    
                    {u.role !== 'super_admin' && (
                        <button onClick={() => handleDelete(u.id)} className="text-red-500 hover:bg-red-50 p-2 rounded transition-colors" title="Revoke Access">
                            <Trash2 className="w-5 h-5" />
                        </button>
                    )}
                </div>
            ))}
        </div>

      </div>
    </div>
  )
}