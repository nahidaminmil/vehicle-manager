"use client"
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { adminCreateUser, adminResetPassword, adminDeleteUser } from '@/app/actions'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, UserPlus, Shield, Trash2, User, Truck, MapPin, 
  Edit, X, Loader2, Save, Key, Search 
} from 'lucide-react'

export default function UserManagementPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [navigating, setNavigating] = useState(false) // ADDED: Tracks routing state for the back button
  const [users, setUsers] = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  
  // --- STATE ---
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ role: '', tob: '', vehicle_id: '', profile_name: '' }) 

  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState('vehicle_user')
  const [newTob, setNewTob] = useState('NDROMO')
  const [newVehicleId, setNewVehicleId] = useState('')
  const [newProfileName, setNewProfileName] = useState('') 
  const [creating, setCreating] = useState(false)

  // --- SEARCH STATE ---
  const [searchTerm, setSearchTerm] = useState('')

  // --- LISTS ---
  const tobList = ['NDROMO', 'BAYOO', 'RHOO', 'DRODRO']
  const roles = [
    { val: 'super_admin', label: '👑 Super Admin' },
    { val: 'admin', label: '👮‍♂️ Admin Officer' },
    { val: 'workshop_admin', label: '🔧 Workshop Admin' },
    { val: 'tob_admin', label: '🏰 TOB Commander' },
    { val: 'vehicle_user', label: '🚙 Vehicle User' },
    { val: 'guest', label: '👁️ Guest / Auditor' }
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

  // 2. CREATE USER
  async function handleCreateUser() {
    if (!newEmail || !newPassword) return alert('Email and Password required')
    setCreating(true)

    // Determine if role requires a profile name
    const isAdminRole = ['super_admin', 'admin', 'workshop_admin', 'tob_admin'].includes(newRole)

    const formData = {
        email: newEmail,
        password: newPassword,
        role: newRole,
        assigned_tob: newRole === 'tob_admin' ? newTob : null,
        assigned_vehicle_id: newRole === 'vehicle_user' ? newVehicleId : null,
        profile_name: isAdminRole ? newProfileName.trim() : null
    }

    const result = await adminCreateUser(formData)

    if (!result.success) {
        alert('Error: ' + result.error)
    } else {
        // SAFEGUARD: Directly update the profile table to ensure profile_name is saved safely
        // without altering the existing server action configuration
        if (isAdminRole && newProfileName) {
            const { data: newUserProfile } = await supabase.from('profiles').select('id').eq('email', newEmail).single()
            if (newUserProfile) {
                await supabase.from('profiles').update({ profile_name: newProfileName.trim() }).eq('id', newUserProfile.id)
            }
        }

        alert('User Created Successfully!')
        setNewEmail('')
        setNewPassword('')
        setNewProfileName('')
        fetchUsers()
    }
    setCreating(false)
  }

  // 3. RESET PASSWORD
  async function handleResetPassword(userId: string, userEmail: string) {
      const newPass = prompt(`Enter new password for ${userEmail}:`)
      if (!newPass) return 

      if (newPass.length < 6) return alert("Password must be at least 6 characters")

      const result = await adminResetPassword(userId, newPass)
      
      if (result.success) {
          alert("Password updated successfully!")
      } else {
          alert("Error updating password: " + result.error)
      }
  }

  // 4. EDIT ROLE
  function startEditing(user: any) {
    setEditingId(user.id)
    setEditForm({
      role: user.role || 'vehicle_user',
      tob: user.assigned_tob || 'NDROMO',
      vehicle_id: user.assigned_vehicle_id || '',
      profile_name: user.profile_name || ''
    })
  }

  async function saveChanges() {
    if (!editingId) return
    const isAdminRole = ['super_admin', 'admin', 'workshop_admin', 'tob_admin'].includes(editForm.role)

    const updates: any = { 
        role: editForm.role,
        assigned_tob: editForm.role === 'tob_admin' ? editForm.tob : null,
        assigned_vehicle_id: editForm.role === 'vehicle_user' ? editForm.vehicle_id : null,
        profile_name: isAdminRole ? editForm.profile_name.trim() : null
    }
    const { error } = await supabase.from('profiles').update(updates).eq('id', editingId)
    if (error) alert(error.message)
    else { setEditingId(null); fetchUsers() }
  }

  async function handleDelete(id: string) {
      if(!confirm('Are you sure? This completely deletes the user and removes their login access.')) return
      
      const result = await adminDeleteUser(id)
      
      if (!result.success) {
          alert("Error deleting user: " + result.error)
      } else {
          fetchUsers()
      }
  }

  // --- FILTERING LOGIC ---
  const filteredUsers = users.filter(user => {
    const search = searchTerm.toLowerCase()
    const vehicleUid = vehicles.find(v => v.id === user.assigned_vehicle_id)?.vehicle_uid || ''
    
    return (
        user.email?.toLowerCase().includes(search) ||
        user.role?.toLowerCase().includes(search) ||
        user.assigned_tob?.toLowerCase().includes(search) ||
        vehicleUid.toLowerCase().includes(search) ||
        user.profile_name?.toLowerCase().includes(search) 
    )
  })

  if (loading) return <div className="p-8 font-bold text-xl">Loading User Database...</div>

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      {/* MODIFIED: Enhanced tactile feedback and loading state for Back Button */}
      <button 
        onClick={() => {
          setNavigating(true)
          router.push('/')
        }} 
        disabled={navigating}
        className="flex items-center text-gray-700 font-bold mb-6 bg-white hover:bg-gray-50 active:bg-gray-100 active:scale-95 transition-all duration-150 ease-in-out px-4 py-2 rounded-lg shadow-sm border border-gray-200 w-fit focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-75 disabled:cursor-not-allowed"
      >
        {navigating ? (
          <Loader2 className="w-5 h-5 mr-2 animate-spin text-blue-600" />
        ) : (
          <ArrowLeft className="w-5 h-5 mr-2" />
        )}
        {navigating ? 'Returning to Command...' : 'Back to Command'}
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

                {/* DYNAMIC PROFILE NAME FIELD FOR ADMIN ROLES */}
                {['super_admin', 'admin', 'workshop_admin', 'tob_admin'].includes(newRole) && (
                    <div className="bg-purple-50 p-3 rounded border border-purple-100">
                        <label className="text-xs font-bold text-purple-600 uppercase">Profile Name</label>
                        <input 
                            type="text" 
                            maxLength={50}
                            value={newProfileName} 
                            onChange={e=>setNewProfileName(e.target.value)} 
                            className="w-full p-2 border rounded font-bold mt-1 text-purple-900" 
                            placeholder="e.g. Maj Tariq - Ops" 
                        />
                    </div>
                )}

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

        {/* LIST SECTION */}
        <div className="lg:col-span-2 space-y-4">
            
            {/* SEARCH BAR */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center mb-4">
                <Search className="w-5 h-5 text-gray-400 mr-3" />
                <input 
                    type="text" 
                    placeholder="Search by Email, Name, Role, TOB, or Vehicle ID..." 
                    className="w-full outline-none font-bold text-gray-700"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="text-gray-400 hover:text-red-500">
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* USER LIST */}
            {filteredUsers.length === 0 ? (
                <div className="text-center p-8 text-gray-400 font-bold bg-white rounded-xl border border-gray-200">
                    No users found matching "{searchTerm}"
                </div>
            ) : (
                filteredUsers.map((u) => (
                    <div key={u.id} className={`bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center transition-all ${editingId === u.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}>
                        <div className="flex items-center gap-4 mb-4 md:mb-0 w-full">
                            {/* DYNAMIC ICON STYLING FOR GUEST */}
                            <div className={`p-3 rounded-full flex-shrink-0 ${u.role === 'super_admin' ? 'bg-purple-100 text-purple-700' : u.role === 'admin' ? 'bg-blue-100 text-blue-700' : u.role === 'guest' ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-600'}`}>
                                {u.role === 'super_admin' ? <Shield className="w-6 h-6"/> : u.role === 'vehicle_user' ? <Truck className="w-6 h-6"/> : u.role === 'guest' ? <Search className="w-6 h-6"/> : <User className="w-6 h-6"/>}
                            </div>
                            <div className="w-full">
                                
                                {/* DISPLAY PROFILE NAME (IF ADMIN) OR EMAIL */}
                                {u.profile_name ? (
                                    <>
                                        <p className="font-black text-gray-900 text-lg uppercase tracking-tight">{u.profile_name}</p>
                                        <p className="font-bold text-gray-500 text-xs">{u.email}</p>
                                    </>
                                ) : (
                                    <p className="font-bold text-gray-900 text-lg">{u.email}</p>
                                )}
                                
                                {editingId === u.id ? (
                                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2">
                                        <select value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value})} className="p-1 border rounded text-sm font-bold">
                                            {roles.map(r => <option key={r.val} value={r.val}>{r.label}</option>)}
                                        </select>
                                        
                                        {/* EDIT PROFILE NAME FOR ADMIN ROLES */}
                                        {['super_admin', 'admin', 'workshop_admin', 'tob_admin'].includes(editForm.role) && (
                                            <input 
                                                type="text" 
                                                maxLength={50}
                                                value={editForm.profile_name} 
                                                onChange={e => setEditForm({...editForm, profile_name: e.target.value})} 
                                                placeholder="Profile Name" 
                                                className="p-1 border rounded text-sm font-bold text-purple-700" 
                                            />
                                        )}

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
                                    <button onClick={() => handleResetPassword(u.id, u.email)} className="flex items-center px-3 py-2 bg-yellow-50 hover:bg-yellow-100 rounded font-bold text-sm text-yellow-700 border border-yellow-200" title="Change Password">
                                        <Key className="w-4 h-4 mr-1"/> Reset Pass
                                    </button>
                                    <button onClick={() => startEditing(u)} className="flex items-center px-3 py-2 bg-blue-50 hover:bg-blue-100 rounded font-bold text-sm text-blue-700 border border-blue-200">
                                        <Edit className="w-4 h-4 mr-1"/> Edit Role
                                    </button>
                                    {u.role !== 'super_admin' && (
                                        <button onClick={() => handleDelete(u.id)} className="flex items-center px-3 py-2 bg-red-50 hover:bg-red-100 rounded font-bold text-sm text-red-600 border border-red-200">
                                            <Trash2 className="w-4 h-4 mr-1"/> Delete
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                ))
            )}
        </div>
      </div>
    </div>
  )
}