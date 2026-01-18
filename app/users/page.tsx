"use client"
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, UserPlus, Shield, Trash2, User, Truck, MapPin, 
  Edit, X, Loader2, Save, LogOut 
} from 'lucide-react'

export default function UserManagementPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  
  // --- STATE ---
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ role: '', tob: '', vehicle_id: '' })

  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState('vehicle_user')
  const [newTob, setNewTob] = useState('NDROMO')
  const [newVehicleId, setNewVehicleId] = useState('')
  const [creating, setCreating] = useState(false)

  const tobList = ['NDROMO', 'BAYOO', 'RHOO', 'DRODRO']
  const roles = [
    { val: 'super_admin', label: '👑 Super Admin' },
    { val: 'admin', label: '👮‍♂️ Admin Officer' },
    { val: 'tob_admin', label: '🏰 TOB Commander' },
    { val: 'vehicle_user', label: '🚙 Vehicle User' }
  ]

  // 1. FETCH DATA
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role !== 'super_admin') return router.push('/login')

      fetchUsers()
      fetchVehicles()
      setLoading(false)
    }
    init()
  }, [])

  async function fetchUsers() {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    setUsers(data || [])
  }

  async function fetchVehicles() {
    const { data } = await supabase.from('vehicles').select('id, vehicle_uid').order('vehicle_uid')
    setVehicles(data || [])
  }

  // 2. CREATE USER (SAFE METHOD)
  async function handleCreateUser() {
    if (!newEmail || !newPassword) return alert('Email and Password required')
    setCreating(true)

    // A. Create Auth User (Switch Session)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: newEmail,
      password: newPassword,
      options: { emailRedirectTo: undefined } // Prevent email sending
    })

    if (authError) {
        alert('Error creating auth: ' + authError.message)
        setCreating(false)
        return
    }

    if (authData.user) {
        // B. WAIT for Trigger
        // We wait 1 second to let the Database Trigger create the profile row automatically.
        // This PREVENTS the 'foreign key' error you were seeing.
        await new Promise(resolve => setTimeout(resolve, 1000))

        // C. UPDATE the auto-created profile
        const updates: any = { 
            role: newRole,
            assigned_tob: newRole === 'tob_admin' ? newTob : null,
            assigned_vehicle_id: newRole === 'vehicle_user' ? newVehicleId : null
        }

        const { error: profileError } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', authData.user.id)
        
        if (profileError) {
            console.error(profileError)
            alert('User created, but role update failed. They are set to default "Vehicle User".')
        } else {
            alert(`User '${newEmail}' created successfully!\n\nSYSTEM NOTICE: You are now signed in as this new user.\nYou will be logged out automatically.`)
            await supabase.auth.signOut()
            router.push('/login')
        }
    }
    setCreating(false)
  }

  // 3. EDIT & SAVE & DELETE
  function startEditing(user: any) {
    setEditingId(user.id)
    setEditForm({
      role: user.role || 'vehicle_user',
      tob: user.assigned_tob || 'NDROMO',
      vehicle_id: user.assigned_vehicle_id || ''
    })
  }

  async function saveChanges() {
    if (!editingId) return
    const updates: any = { 
        role: editForm.role,
        assigned_tob: editForm.role === 'tob_admin' ? editForm.tob : null,
        assigned_vehicle_id: editForm.role === 'vehicle_user' ? editForm.vehicle_id : null
    }
    const { error } = await supabase.from('profiles').update(updates).eq('id', editingId)
    if (error) alert(error.message)
    else { setEditingId(null); fetchUsers() }
  }

  async function handleDelete(id: string) {
      if(!confirm('Are you sure? This deletes the user profile permissions.')) return
      const { error } = await supabase.from('profiles').delete().eq('id', id)
      if (error) alert(error.message)
      else fetchUsers()
  }

  if (loading) return <div className="p-8 font-bold text-xl">Loading User Database...</div>

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <button onClick={() => router.push('/')} className="flex items-center text-gray-700 font-bold mb-6 bg-white px-4 py-2 rounded shadow-sm w-fit">
        <ArrowLeft className="w-5 h-5 mr-2" /> Back to Command
      </button>

      <div className="flex justify-between items-center mb-8">
        <div>
            <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight">User Management</h1>
            <p className="text-gray-500 font-bold">Manage Roles & Permissions</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* CREATE FORM */}
        <div className="bg-white p-6 rounded-xl shadow-md h-fit border-t-4 border-blue-600">
            <h2 className="text-xl font-black text-gray-800 mb-4 flex items-center"><UserPlus className="w-5 h-5 mr-2 text-blue-600"/> Create New User</h2>
            <div className="space-y-4">
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Email / ID</label>
                    <input type="email" value={newEmail} onChange={e=>setNewEmail(e.target.value)} className="w-full p-3 border rounded font-bold" placeholder="user@system.local" />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Password</label>
                    <input type="text" value={newPassword} onChange={e=>setNewPassword(e.target.value)} className="w-full p-3 border rounded font-bold" placeholder="Password123" />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Role</label>
                    <select value={newRole} onChange={e=>setNewRole(e.target.value)} className="w-full p-3 border rounded font-bold bg-white">
                        {roles.map(r => <option key={r.val} value={r.val}>{r.label}</option>)}
                    </select>
                </div>
                {newRole === 'tob_admin' && (
                    <div className="bg-blue-50 p-3 rounded border border-blue-100">
                        <label className="text-xs font-bold text-blue-600 uppercase">Assign TOB</label>
                        <select value={newTob} onChange={e=>setNewTob(e.target.value)} className="w-full p-2 border rounded font-bold mt-1">
                            {tobList.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                )}
                {newRole === 'vehicle_user' && (
                    <div className="bg-orange-50 p-3 rounded border border-orange-100">
                        <label className="text-xs font-bold text-orange-600 uppercase">Link Vehicle</label>
                        <select value={newVehicleId} onChange={e=>setNewVehicleId(e.target.value)} className="w-full p-2 border rounded font-bold mt-1">
                            <option value="">Select Vehicle...</option>
                            {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_uid}</option>)}
                        </select>
                    </div>
                )}
                <button onClick={handleCreateUser} disabled={creating} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded shadow mt-4 flex justify-center">
                    {creating ? <Loader2 className="animate-spin"/> : 'Create User'}
                </button>
            </div>
        </div>

        {/* LIST */}
        <div className="lg:col-span-2 space-y-4">
            {users.map((u) => (
                <div key={u.id} className={`bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center transition-all ${editingId === u.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}>
                    <div className="flex items-center gap-4 mb-4 md:mb-0 w-full">
                        <div className={`p-3 rounded-full flex-shrink-0 ${u.role === 'super_admin' ? 'bg-purple-100 text-purple-700' : u.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                            {u.role === 'super_admin' ? <Shield className="w-6 h-6"/> : u.role === 'vehicle_user' ? <Truck className="w-6 h-6"/> : <User className="w-6 h-6"/>}
                        </div>
                        <div className="w-full">
                            <p className="font-bold text-gray-900 text-lg">{u.email}</p>
                            {editingId === u.id ? (
                                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2">
                                    <select value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value})} className="p-1 border rounded text-sm font-bold">
                                        {roles.map(r => <option key={r.val} value={r.val}>{r.label}</option>)}
                                    </select>
                                    {editForm.role === 'tob_admin' && (
                                        <select value={editForm.tob} onChange={e => setEditForm({...editForm, tob: e.target.value})} className="p-1 border rounded text-sm font-bold text-blue-700">
                                            {tobList.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    )}
                                    {editForm.role === 'vehicle_user' && (
                                        <select value={editForm.vehicle_id} onChange={e => setEditForm({...editForm, vehicle_id: e.target.value})} className="p-1 border rounded text-sm font-bold text-orange-700">
                                            <option value="">Select Vehicle...</option>
                                            {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_uid}</option>)}
                                        </select>
                                    )}
                                </div>
                            ) : (
                                <p className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2 mt-1">
                                    <span className="bg-gray-100 px-2 py-0.5 rounded">{u.role.replace('_', ' ')}</span>
                                    {u.assigned_tob && <span className="text-blue-600 flex items-center bg-blue-50 px-2 py-0.5 rounded"><MapPin className="w-3 h-3 mr-1"/> {u.assigned_tob}</span>}
                                    {u.assigned_vehicle_id && <span className="text-orange-600 flex items-center bg-orange-50 px-2 py-0.5 rounded"><Truck className="w-3 h-3 mr-1"/> {vehicles.find(v=>v.id===u.assigned_vehicle_id)?.vehicle_uid || 'Linked'}</span>}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-2 min-w-fit">
                        {editingId === u.id ? (
                            <>
                                <button onClick={() => setEditingId(null)} className="flex items-center px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded font-bold text-sm text-gray-700"><X className="w-4 h-4 mr-1"/> Cancel</button>
                                <button onClick={saveChanges} className="flex items-center px-3 py-2 bg-green-600 hover:bg-green-700 rounded font-bold text-sm text-white"><Save className="w-4 h-4 mr-1"/> Save</button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => startEditing(u)} className="flex items-center px-3 py-2 bg-blue-50 hover:bg-blue-100 rounded font-bold text-sm text-blue-700 border border-blue-200"><Edit className="w-4 h-4 mr-1"/> Edit Role</button>
                                {u.role !== 'super_admin' && (
                                    <button onClick={() => handleDelete(u.id)} className="flex items-center px-3 py-2 bg-red-50 hover:bg-red-100 rounded font-bold text-sm text-red-600 border border-red-200"><Trash2 className="w-4 h-4 mr-1"/> Delete</button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  )
}