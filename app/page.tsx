"use client"
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { 
  Car, CheckCircle, XCircle, Wrench, Activity, Plus, Search, 
  BarChart3, Grid, LogOut, Users, MapPin, Table, Settings, ClipboardList, Bell,
  MessageSquare, X, Send 
} from 'lucide-react'
import Link from 'next/link'

export default function Dashboard() {
  const router = useRouter()
  const [vehicles, setVehicles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('') 
  const [filter, setFilter] = useState('')
  const [role, setRole] = useState('') 

  // --- DYNAMIC STATUS LIST (From DB) ---
  const [statusList, setStatusList] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState('ALL') 

  // --- NOTIFICATIONS STATE ---
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const unreadCount = notifications.filter(n => !n.is_read).length

  // --- SECURE COMMAND CHAT STATE (NEW) ---
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [adminUsers, setAdminUsers] = useState<any[]>([])
  const [selectedChatUser, setSelectedChatUser] = useState<any>(null)
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [chatInput, setChatInput] = useState('')
  const [allUnreadMessages, setAllUnreadMessages] = useState<any[]>([]) // NEW: Holds all unread messages

  // --- FETCH HELPERS FOR CHAT (NEW) ---
  const fetchUnreadMessages = async (uid: string) => {
      const { data } = await supabase.from('admin_messages').select('*').eq('receiver_id', uid).eq('is_read', false);
      if (data) setAllUnreadMessages(data);
  }

  const fetchActiveChatMessages = async (uid: string, contactId: string) => {
      const { data } = await supabase
          .from('admin_messages')
          .select('*')
          .or(`and(sender_id.eq.${uid},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${uid})`)
          .order('created_at', { ascending: true });
      if (data) setChatMessages(data);
      
      // Instantly mark as read in DB and remove from local unread state
      await supabase.from('admin_messages').update({ is_read: true }).eq('receiver_id', uid).eq('sender_id', contactId).eq('is_read', false);
      setAllUnreadMessages(prev => prev.filter(m => m.sender_id !== contactId));
  }

  useEffect(() => {
    checkUserAndFetch()
  }, [])

  // --- REALTIME CHAT LISTENER (UPDATED FOR BADGES) ---
  useEffect(() => {
      if (!currentUserId) return;

      // Fetch initial unread messages
      fetchUnreadMessages(currentUserId);

      // If a specific chat is selected, load it
      if (selectedChatUser) {
          fetchActiveChatMessages(currentUserId, selectedChatUser.id);
      }
      
      // Listen globally for any new incoming messages
      const channel = supabase.channel('chat_updates')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_messages' }, () => {
              fetchUnreadMessages(currentUserId); 
              if (selectedChatUser) {
                  fetchActiveChatMessages(currentUserId, selectedChatUser.id);
              }
          }).subscribe();
          
      return () => { supabase.removeChannel(channel) };
  }, [selectedChatUser, currentUserId]);

  async function checkUserAndFetch() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/login')

    // 1. Fetch Profile & Check for Redirect
    const { data: profile } = await supabase
        .from('profiles')
        .select('role, assigned_vehicle_id, email, assigned_tob') 
        .eq('id', user.id)
        .single()
    
    if (profile) {
        setRole(profile.role)
        setCurrentUserId(user.id)

        // --- FETCH SECURE ADMIN DIRECTORY (NEW) ---
        if (['super_admin', 'admin', 'tob_admin', 'workshop_admin'].includes(profile.role)) {
            const { data: admins } = await supabase
                .from('profiles')
                .select('id, email, role, assigned_tob')
                .in('role', ['super_admin', 'admin', 'tob_admin', 'workshop_admin'])
                .neq('id', user.id);
            if (admins) setAdminUsers(admins);
        }

        // --- CRITICAL FIX: REDIRECT VEHICLE USERS ---
        if (profile.role === 'vehicle_user' && profile.assigned_vehicle_id) {
            router.replace(`/vehicle/${profile.assigned_vehicle_id}`)
            return // Stop execution here so dashboard doesn't flash
        }
    }

    // --- FETCH NOTIFICATIONS ---
    const { data: notifData } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
    if (notifData) setNotifications(notifData)

    // 2. Fetch Dynamic Statuses (This ensures new DB rows appear as Cards)
    const { data: sData } = await supabase.from('vehicle_statuses').select('name').order('sort_order')
    if (sData) setStatusList(sData.map((s: any) => s.name))

    // 3. Fetch Vehicles
    const { data, error } = await supabase
      .from('vehicle_dashboard_view')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) setErrorMsg(error.message)
    else setVehicles(data || [])
    
    setLoading(false)
  }

  // --- SEND CHAT MESSAGE (NEW) ---
  async function sendMessage() {
      if (!chatInput.trim() || !selectedChatUser) return;
      const msg = chatInput.trim();
      setChatInput(''); 
      await supabase.from('admin_messages').insert([{ sender_id: currentUserId, receiver_id: selectedChatUser.id, message: msg }]);
  }

  // --- MARK NOTIFICATIONS AS READ ---
  async function markAllAsRead() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    
    // Update Database
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)
    
    // Update Local UI instantly
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  // --- UPDATED LOGOUT FUNCTION ---
  async function handleLogout() {
    // 1. Grab the user's information before they sign out
    const { data: { user } } = await supabase.auth.getUser()
    
    // 2. Write the logout event directly to the activity log
    if (user && user.email) {
        await supabase.from('activity_logs').insert([{
            user_email: user.email,
            action_type: 'USER_LOGOUT',
            description: 'User securely signed out of the system.'
        }])
    }

    // 3. Complete the sign-out process and redirect
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // --- DYNAMIC FILTERING ---
  const filteredVehicles = vehicles.filter(v => {
    // Text Search
    const matchesText = (v.vehicle_uid || '').toLowerCase().includes(filter.toLowerCase()) ||
                        (v.vehicle_type_name || '').toLowerCase().includes(filter.toLowerCase()) ||
                        (v.tob || '').toLowerCase().includes(filter.toLowerCase())

    // Dynamic Status Filter
    const matchesStatus = statusFilter === 'ALL' ? true : v.status === statusFilter

    return matchesText && matchesStatus
  })

  // --- SMART ATTRIBUTES GENERATOR (FIXED) ---
  // This logic automatically styles new statuses based on their name keywords
  const getStatusAttributes = (name: string) => {
      const s = (name || '').toLowerCase()
      
      // 1. INACTIVE Variants (Red) - CHECK THIS FIRST!
      // This prevents "Inactive" from being caught by the "Active" check below
      if (s.includes('inactive') || s.includes('off road')) return { 
          badge: 'bg-red-100 text-red-800', 
          card: 'bg-red-600', 
          icon: <XCircle className="w-6 h-6"/> 
      }

      // 2. SHORT RANGE (Teal) - Specific Check for new category
      if (s.includes('active short range')) return { 
          badge: 'bg-teal-100 text-teal-800', 
          card: 'bg-teal-600', 
          icon: <CheckCircle className="w-6 h-6"/> 
      }
      
      // 3. ACTIVE Variants (Green)
      // "Active Long Range" will be caught here because it contains "active"
      if (s.includes('active')) return { 
          badge: 'bg-green-200 text-green-900', 
          card: 'bg-green-600', 
          icon: <CheckCircle className="w-6 h-6"/> 
      }
      
      // 4. MAINTENANCE Variants (Orange)
      if (s.includes('maintenance') || s.includes('workshop')) return { 
          badge: 'bg-orange-100 text-orange-800', 
          card: 'bg-orange-600', 
          icon: <Wrench className="w-6 h-6"/> 
      }
      
      // 5. DEFAULT/UNKNOWN Variants (Blue)
      return { 
          badge: 'bg-blue-100 text-blue-800', 
          card: 'bg-blue-600', 
          icon: <Activity className="w-6 h-6"/> 
      }
  }

  // --- OP CATEGORY COLOR HELPER ---
  const getOpCatColor = (c: string) => {
      const cat = (c || '').toLowerCase()
      if (cat.includes('fully') || cat.includes('fmc')) return 'bg-blue-100 text-blue-800'
      if (cat.includes('degraded')) return 'bg-amber-200 text-amber-900' 
      if (cat.includes('non') || cat.includes('nmc')) return 'bg-red-100 text-red-800'
      return 'bg-gray-100 text-gray-800'
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-100"><div className="text-xl font-black text-gray-900">Loading Command Dashboard...</div></div>

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 pb-24">
      
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div className="w-full md:w-auto">
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">COMMAND DASHBOARD</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-gray-600 font-bold text-xs md:text-sm">Military Vehicle Accountability System</p>
            {role && (
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${role === 'super_admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-600'}`}>
                    {role.replace('_', ' ')}
                </span>
            )}
          </div>
        </div>
        
        {/* Navigation Buttons - RESTORED FULL LIST & GUEST ADDED TO WORKSHOP */}
        <div className="flex flex-wrap gap-2 w-full md:w-auto items-center justify-start md:justify-end">
           
           {/* SECURE CHAT TOGGLE BUTTON (NEW) */}
           {['super_admin', 'admin', 'tob_admin', 'workshop_admin'].includes(role) && (
               <div className="relative z-40">
                   <button 
                       onClick={() => setIsChatOpen(true)}
                       className="flex items-center justify-center p-2 md:p-3 bg-white hover:bg-gray-50 text-gray-700 rounded-lg font-bold shadow-sm border border-gray-200 transition-colors"
                   >
                       <MessageSquare className="w-5 h-5 md:w-5 md:h-5" />
                       {allUnreadMessages.length > 0 && (
                           <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-black text-white shadow-sm ring-2 ring-white">
                               {allUnreadMessages.length}
                           </span>
                       )}
                   </button>
               </div>
           )}

           {/* BELL ICON & NOTIFICATION DROPDOWN */}
           <div className="relative z-50">
               <button 
                   onClick={() => setShowNotifications(!showNotifications)}
                   className="flex items-center justify-center p-2 md:p-3 bg-white hover:bg-gray-50 text-gray-700 rounded-lg font-bold shadow-sm border border-gray-200 transition-colors"
               >
                   <Bell className="w-5 h-5 md:w-5 md:h-5" />
                   {unreadCount > 0 && (
                       <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-black text-white shadow-sm ring-2 ring-white">
                           {unreadCount}
                       </span>
                   )}
               </button>

               {showNotifications && (
                   <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden transform opacity-100 scale-100 transition-all origin-top-right">
                       <div className="bg-gray-50 border-b border-gray-100 p-3 flex justify-between items-center">
                           <span className="font-black text-gray-800 text-sm uppercase">Notifications</span>
                           {unreadCount > 0 && (
                               <button onClick={markAllAsRead} className="text-[10px] font-black text-blue-600 uppercase hover:text-blue-800 tracking-wider">
                                   Mark all as read
                               </button>
                           )}
                       </div>
                       <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                           {notifications.length === 0 ? (
                               <div className="p-6 text-center text-sm font-bold text-gray-400">No new notifications</div>
                           ) : (
                               notifications.map(n => (
                                   <div key={n.id} className={`p-4 hover:bg-gray-50 transition-colors ${!n.is_read ? 'bg-blue-50/40' : 'bg-white'}`}>
                                       <div className="flex items-start justify-between">
                                           <p className={`text-xs font-black uppercase mb-1 ${!n.is_read ? 'text-indigo-700' : 'text-gray-500'}`}>{n.title}</p>
                                           {!n.is_read && <span className="h-2 w-2 rounded-full bg-indigo-600 mt-0.5 flex-shrink-0"></span>}
                                       </div>
                                       <p className="text-sm font-bold text-gray-800 leading-snug">{n.message}</p>
                                       <p className="text-[9px] font-bold text-gray-400 uppercase mt-2">{new Date(n.created_at).toLocaleString()}</p>
                                   </div>
                               ))
                           )}
                       </div>
                   </div>
               )}
           </div>

           {(role === 'super_admin' || role === 'admin' || role === 'tob_admin' || role === 'workshop_admin' || role === 'guest') && (
               <Link href="/workshop" className="flex-1 md:flex-none flex items-center justify-center bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 md:px-4 md:py-3 rounded-lg font-bold shadow-sm text-sm transition-colors">
                  <Wrench className="w-4 h-4 md:w-5 md:h-5 mr-2" /> Workshop
               </Link>
           )}
           {role === 'super_admin' && (
                <>
                    <Link href="/users" className="flex-1 md:flex-none flex items-center justify-center bg-purple-900 hover:bg-black text-white px-3 py-2 md:px-4 md:py-3 rounded-lg font-bold shadow-sm text-sm transition-colors">
                        <Users className="w-4 h-4 md:w-5 md:h-5 mr-2" /> Users
                    </Link>
                    {/* NEW ACTIVITY LOG BUTTON */}
                    <Link href="/activity-log" className="flex-1 md:flex-none flex items-center justify-center bg-indigo-700 hover:bg-indigo-800 text-white px-3 py-2 md:px-4 md:py-3 rounded-lg font-bold shadow-sm text-sm transition-colors">
                        <ClipboardList className="w-4 h-4 md:w-5 md:h-5 mr-2" /> Activity
                    </Link>
                    <Link href="/admin/settings" className="flex-1 md:flex-none flex items-center justify-center bg-gray-900 hover:bg-black text-white px-3 py-2 md:px-4 md:py-3 rounded-lg font-bold shadow-sm text-sm transition-colors">
                        <Settings className="w-4 h-4 md:w-5 md:h-5 mr-2" /> Config
                    </Link>
                </>
           )}
           <Link href="/all-vehicles" className="flex-1 md:flex-none flex items-center justify-center bg-gray-800 hover:bg-black text-white px-3 py-2 md:px-4 md:py-3 rounded-lg font-bold shadow-sm text-sm transition-colors">
             <Grid className="w-4 h-4 md:w-5 md:h-5 mr-2" /> All Vehicles
           </Link>
           <Link href="/vehicle-statistics" className="flex-1 md:flex-none flex items-center justify-center bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 md:px-4 md:py-3 rounded-lg font-bold shadow-sm text-sm transition-colors">
             <Table className="w-4 h-4 md:w-5 md:h-5 mr-2" /> Statistics
           </Link>
           <Link href="/analytics" className="flex-1 md:flex-none flex items-center justify-center bg-purple-700 hover:bg-purple-800 text-white px-3 py-2 md:px-4 md:py-3 rounded-lg font-bold shadow-sm text-sm transition-colors">
             <BarChart3 className="w-4 h-4 md:w-5 md:h-5 mr-2" /> Analytics
           </Link>
           <button onClick={handleLogout} className="flex-1 md:flex-none flex items-center justify-center bg-red-600 hover:bg-red-700 text-white px-3 py-2 md:px-4 md:py-3 rounded-lg font-bold shadow-sm text-sm transition-colors">
             <LogOut className="w-4 h-4 md:w-5 md:h-5 mr-2" /> Sign Out
           </button>
        </div>
      </div>

      {/* DYNAMIC STATS CARDS GRID */}
      {/* Automatically creates a card for EVERY status found in the database */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4 mb-6 md:mb-8">
        {/* 1. Total Fleet (Static First Card) */}
        <StatCard 
            title="Total Fleet" 
            value={vehicles.length} 
            icon={<Car className="w-6 h-6"/>} 
            color="bg-blue-600" 
            isActive={statusFilter === 'ALL'}
            onClick={() => setStatusFilter('ALL')}
        />
        
        {/* 2. Dynamic Cards from DB */}
        {statusList.map(statusName => {
            const count = vehicles.filter(v => v.status === statusName).length
            const styles = getStatusAttributes(statusName)

            return (
                <StatCard 
                    key={statusName}
                    title={statusName} 
                    value={count} 
                    icon={styles.icon} 
                    color={styles.card} 
                    isActive={statusFilter === statusName}
                    onClick={() => setStatusFilter(statusName)}
                />
            )
        })}
      </div>

      {/* SEARCH & TABLE SECTION */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-4 md:mb-0">
        <div className="p-4 md:p-5 flex items-center">
          <Search className="w-5 h-5 text-gray-500 mr-3" />
          <input 
            type="text" 
            placeholder="Search Vehicle ID..." 
            className="w-full bg-transparent outline-none text-gray-900 font-bold placeholder-gray-400 text-base" 
            onChange={(e) => setFilter(e.target.value)}
          />
          {statusFilter !== 'ALL' && (
              <span className="ml-2 text-xs font-black uppercase px-3 py-1 bg-gray-900 text-white rounded-full whitespace-nowrap animate-pulse">
                  Filter: {statusFilter}
              </span>
          )}
        </div>
      </div>

      <div className="hidden md:block bg-white rounded-b-xl shadow-lg border-t-0 border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-100 text-green-900 uppercase text-sm font-extrabold tracking-wider">
              <tr>
                <th className="px-6 py-4 border-b border-gray-100">Vehicle ID</th>
                <th className="px-6 py-4 border-b border-gray-100">Type</th>
                <th className="px-6 py-4 border-b border-gray-100">Location</th>
                <th className="px-6 py-4 border-b border-gray-100">Status</th>
                <th className="px-6 py-4 border-b border-gray-100">Operational Category</th>
                <th className="px-6 py-4 border-b border-gray-100 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filteredVehicles.map((vehicle: any) => (
                <tr key={vehicle.id} className="hover:bg-blue-50 transition-colors group">
                  <td className="px-6 py-4 font-black text-gray-900 whitespace-nowrap text-lg">{vehicle.vehicle_uid}</td>
                  <td className="px-6 py-4 font-bold text-gray-600 whitespace-nowrap">{vehicle.vehicle_type_name || '---'}</td>
                  <td className="px-6 py-4 font-bold text-gray-600 whitespace-nowrap"><span className="flex items-center"><MapPin className="w-3 h-3 mr-1 opacity-50"/> {vehicle.tob || '---'}</span></td>
                  
                  {/* DYNAMIC STATUS BADGE - Uses smart attributes for automatic coloring */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${getStatusAttributes(vehicle.status).badge}`}>
                        {vehicle.status}
                    </span>
                  </td>

                  {/* DYNAMIC OP CAT BADGE - Uses smart coloring */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${getOpCatColor(vehicle.operational_category)}`}>
                        {vehicle.operational_category}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-right whitespace-nowrap"><Link href={`/vehicle/${vehicle.id}`} className="inline-block bg-white border-2 border-gray-200 group-hover:border-black text-black px-4 py-1.5 rounded-md font-bold text-xs uppercase tracking-wide transition-all">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MOBILE LIST */}
      <div className="md:hidden mt-4 space-y-3">
         {filteredVehicles.map((vehicle: any) => (
            <div key={vehicle.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                    <div>
                        <span className="text-xl font-black text-gray-900 block">{vehicle.vehicle_uid}</span>
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{vehicle.vehicle_type_name}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        {/* Status Badge */}
                        <span className={`px-2 py-1 rounded text-sm font-black uppercase ${getStatusAttributes(vehicle.status).badge}`}>{vehicle.status}</span>
                        {/* Op Cat Badge */}
                        <span className={`px-2 py-1 rounded text-sm font-black uppercase ${getOpCatColor(vehicle.operational_category)}`}>{vehicle.operational_category}</span>
                    </div>
                </div>
                <div className="flex items-center justify-between text-sm font-bold text-gray-600 bg-gray-50 p-2 rounded"><span className="flex items-center"><MapPin className="w-4 h-4 mr-1 text-gray-400"/> {vehicle.tob}</span></div>
                <Link href={`/vehicle/${vehicle.id}`} className="w-full bg-black text-white text-center py-3 rounded-lg font-bold text-sm uppercase tracking-wide active:bg-gray-800">View Profile</Link>
            </div>
         ))}
      </div>
      
      {/* HIDDEN FOR GUEST ROLE */}
      {role !== 'guest' && (
        <Link href="/add-vehicle" className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white w-14 h-14 rounded-full shadow-2xl transition-transform active:scale-95 flex items-center justify-center z-50">
            <Plus className="w-8 h-8" />
        </Link>
      )}

      {/* --- SECURE SLIDING CHAT WINDOW (NEW) --- */}
      {/* Uses z-[100] to hover entirely over the existing layout without shifting it */}
      <div className={`fixed top-0 right-0 h-full w-full md:w-[400px] bg-white shadow-2xl border-l border-gray-200 transform transition-transform duration-300 z-[100] flex flex-col ${isChatOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          
          {/* Chat Header */}
          <div className="bg-gray-900 p-4 flex justify-between items-center text-white">
              <div>
                  <h2 className="font-black tracking-widest uppercase">Secure Comms</h2>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">End-to-End Encrypted</p>
              </div>
              <button onClick={() => setIsChatOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-5 h-5"/></button>
          </div>

          {/* User Directory / Chat Area */}
          {!selectedChatUser ? (
              <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
                  <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-3">Admin Directory</p>
                  <div className="space-y-2">
                      {adminUsers.map(admin => {
                          // Extract the specific unread count for this individual admin card
                          const userUnreadCount = allUnreadMessages.filter(m => m.sender_id === admin.id).length;
                          
                          return (
                              <button key={admin.id} onClick={() => setSelectedChatUser(admin)} className="w-full bg-white p-3 rounded-xl shadow-sm border border-gray-200 hover:border-blue-500 text-left transition-all group">
                                  <div className="flex justify-between items-start">
                                      <div className="flex-1 truncate pr-2">
                                          <p className="font-black text-gray-900 group-hover:text-blue-700 truncate">{admin.email}</p>
                                          <div className="flex gap-2 mt-1">
                                              <span className="text-[9px] font-black uppercase tracking-widest bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{admin.role.replace('_', ' ')}</span>
                                              {admin.assigned_tob && <span className="text-[9px] font-black uppercase tracking-widest bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{admin.assigned_tob}</span>}
                                          </div>
                                      </div>
                                      {/* Per-User Badge */}
                                      {userUnreadCount > 0 && (
                                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-black text-white shadow-sm flex-shrink-0 mt-1">
                                              {userUnreadCount}
                                          </span>
                                      )}
                                  </div>
                              </button>
                          );
                      })}
                  </div>
              </div>
          ) : (
              <div className="flex-1 flex flex-col bg-gray-50">
                  {/* Active Chat Header */}
                  <div className="bg-white border-b border-gray-200 p-3 flex items-center shadow-sm z-10">
                      <button onClick={() => setSelectedChatUser(null)} className="mr-3 text-xs font-black text-gray-400 hover:text-black uppercase tracking-wider">← Back</button>
                      <div className="truncate">
                          <p className="text-xs font-black text-gray-900 truncate">{selectedChatUser.email}</p>
                          <p className="text-[9px] font-bold text-gray-500 uppercase">{selectedChatUser.role.replace('_', ' ')}</p>
                      </div>
                  </div>

                  {/* Message History */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col">
                      {chatMessages.map(msg => {
                          const isMe = msg.sender_id === currentUserId;
                          return (
                              <div key={msg.id} className={`max-w-[85%] rounded-2xl p-3 shadow-sm text-sm font-bold ${isMe ? 'bg-blue-600 text-white self-end rounded-br-sm' : 'bg-white border border-gray-200 text-gray-800 self-start rounded-bl-sm'}`}>
                                  {msg.message}
                                  <p className={`text-[9px] mt-1 text-right ${isMe ? 'text-blue-200' : 'text-gray-400'}`}>{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                              </div>
                          )
                      })}
                  </div>

                  {/* Input Box */}
                  <div className="bg-white border-t border-gray-200 p-3">
                      <div className="flex items-center bg-gray-100 rounded-xl border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                          <input 
                              type="text" 
                              value={chatInput} 
                              onChange={(e) => setChatInput(e.target.value)} 
                              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                              placeholder="Type highly secure message..." 
                              className="flex-1 bg-transparent p-3 text-sm font-bold text-gray-900 outline-none placeholder-gray-400"
                          />
                          <button onClick={sendMessage} disabled={!chatInput.trim()} className="p-3 text-blue-600 hover:text-blue-800 disabled:text-gray-300 disabled:bg-transparent transition-colors">
                              <Send className="w-5 h-5"/>
                          </button>
                      </div>
                  </div>
              </div>
          )}
      </div>

    </div>
  )
}

function StatCard({ title, value, icon, color, onClick, isActive }: any) {
  return (
    <button onClick={onClick} className={`${color} ${isActive ? 'ring-4 ring-offset-2 ring-gray-400 scale-[1.02]' : 'hover:scale-[1.02]'} transition-all duration-200 rounded-xl shadow-sm p-4 text-white flex flex-col justify-between h-24 relative overflow-hidden text-left w-full group`}>
      <div className="z-10"><p className="text-[10px] md:text-xs font-black opacity-80 uppercase tracking-wider">{title}</p><p className="text-2xl md:text-3xl font-black mt-0.5">{value}</p></div>
      <div className="absolute -bottom-2 -right-2 p-3 bg-white/10 rounded-full z-0 transform rotate-12 group-hover:scale-110 transition-transform">{icon}</div>
    </button>
  )
}