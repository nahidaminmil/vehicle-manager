"use client"
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ClipboardList, Clock, User, Search } from 'lucide-react'

export default function ActivityLogPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [profileMap, setProfileMap] = useState<Record<string, string>>({}) // NEW: Dictionary to hold email -> profile_name

  useEffect(() => {
    async function fetchLogs() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')

      // Strictly verify Super Admin
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role !== 'super_admin') return router.push('/')

      // NEW SAFEGURAD: Fetch the profiles to create an email-to-name dictionary locally.
      // This prevents us from having to alter the actual activity_logs database table.
      const { data: profilesData } = await supabase.from('profiles').select('email, profile_name')
      if (profilesData) {
          const dict: Record<string, string> = {}
          profilesData.forEach((p: any) => {
              if (p.profile_name) dict[p.email] = p.profile_name
          })
          setProfileMap(dict)
      }

      const { data } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)

      setLogs(data || [])
      setLoading(false)
    }
    fetchLogs()
  }, [])

  // UPDATED: Search filter now checks against the mapped profile name as well as the email
  const filteredLogs = logs.filter(log => {
    const mappedName = profileMap[log.user_email] || log.user_email
    return mappedName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           log.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
           log.action_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
           log.description.toLowerCase().includes(searchTerm.toLowerCase())
  })

  if (loading) return <div className="p-8 font-bold text-xl text-gray-800">Loading System Logs...</div>

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <button onClick={() => router.push('/')} className="flex items-center text-gray-700 font-bold mb-6 bg-white px-4 py-2 rounded shadow-sm w-fit border border-gray-200">
        <ArrowLeft className="w-5 h-5 mr-2" /> Back to Command
      </button>

      <div className="flex items-center mb-6">
        <ClipboardList className="w-8 h-8 mr-3 text-indigo-700"/>
        <div>
            <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight">System Activity Log</h1>
            <p className="text-gray-500 font-bold">Audit trail for accountability</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center mb-6">
          <Search className="w-5 h-5 text-gray-400 mr-3" />
          <input 
              type="text" 
              placeholder="Search logs by name, email, action, or description..." 
              className="w-full outline-none font-bold text-gray-700"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
          />
      </div>

      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-extrabold tracking-wider border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Action Category</th>
                <th className="px-6 py-4">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-gray-400 font-bold">No logs found.</td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-500">
                        <div className="flex items-center">
                            <Clock className="w-4 h-4 mr-2 opacity-50"/> 
                            {new Date(log.created_at).toLocaleString()}
                        </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                            <User className="w-4 h-4 mr-2 opacity-50 text-indigo-700"/> 
                            <div className="flex flex-col">
                                {/* DISPLAY LOGIC: Shows Profile Name primarily, falls back to email */}
                                <span className="text-sm font-black text-indigo-700 uppercase tracking-tight">
                                    {profileMap[log.user_email] || log.user_email}
                                </span>
                                {/* Secondary Email display if a Profile Name is active */}
                                {profileMap[log.user_email] && (
                                    <span className="text-[10px] font-bold text-gray-500">
                                        {log.user_email}
                                    </span>
                                )}
                            </div>
                        </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-black uppercase tracking-wider">
                            {log.action_type.replace(/_/g, ' ')}
                        </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-800">
                        {log.description}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}