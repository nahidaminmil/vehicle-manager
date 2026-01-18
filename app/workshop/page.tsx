"use client"
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, Wrench, Clock, CheckCircle, AlertTriangle, 
  MoreHorizontal, Calendar, User, ArrowRight, Activity 
} from 'lucide-react'

export default function WorkshopBoard() {
  const router = useRouter()
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLogs()
  }, [])

  async function fetchLogs() {
    // We fetch logs AND the related vehicle details (UID, TOB)
    const { data, error } = await supabase
      .from('maintenance_logs')
      .select('*, vehicles(vehicle_uid, tob)')
      .order('created_at', { ascending: false })
    
    if (error) alert('Error fetching logs: ' + error.message)
    else setLogs(data || [])
    setLoading(false)
  }

  async function updateStatus(logId: string, newStatus: string) {
    // Optimistic Update (Update UI immediately)
    setLogs(prev => prev.map(l => l.id === logId ? { ...l, status: newStatus } : l))

    const { error } = await supabase
      .from('maintenance_logs')
      .update({ status: newStatus })
      .eq('id', logId)

    if (error) {
      alert("Failed to update: " + error.message)
      fetchLogs() // Revert on error
    }
  }

  // Filter logs into columns
  const pending = logs.filter(l => l.status === 'Pending')
  const inProgress = logs.filter(l => l.status === 'In Progress')
  const resolved = logs.filter(l => l.status === 'Resolved')

  if (loading) return <div className="p-8 font-black text-xl">Loading Workshop...</div>

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6 overflow-x-auto">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-8">
        <div>
           <button onClick={() => router.push('/')} className="flex items-center text-gray-500 hover:text-gray-900 font-bold mb-2">
             <ArrowLeft className="w-5 h-5 mr-1" /> Back to Command
           </button>
           <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight flex items-center">
             <Wrench className="w-8 h-8 mr-3 text-orange-600"/> Workshop Floor
           </h1>
        </div>
        <div className="bg-white px-4 py-2 rounded-lg shadow-sm font-bold text-gray-600 border border-gray-200">
           Total Issues: <span className="text-black text-lg">{logs.length}</span>
        </div>
      </div>

      {/* KANBAN BOARD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full min-w-[1000px] md:min-w-0">
        
        {/* COLUMN 1: PENDING */}
        <Column 
          title="PENDING / NEW" 
          count={pending.length} 
          color="border-red-500 bg-red-50" 
          icon={<AlertTriangle className="w-5 h-5 text-red-600"/>}
        >
          {pending.map(log => (
            <JobCard key={log.id} log={log} onMove={() => updateStatus(log.id, 'In Progress')} moveLabel="Start Job" moveColor="bg-blue-600" />
          ))}
        </Column>

        {/* COLUMN 2: IN PROGRESS */}
        <Column 
          title="WORK IN PROGRESS" 
          count={inProgress.length} 
          color="border-blue-500 bg-blue-50" 
          icon={<Activity className="w-5 h-5 text-blue-600"/>}
        >
          {inProgress.map(log => (
            <JobCard key={log.id} log={log} onMove={() => updateStatus(log.id, 'Resolved')} moveLabel="Mark Complete" moveColor="bg-green-600" />
          ))}
        </Column>

        {/* COLUMN 3: RESOLVED */}
        <Column 
          title="RESOLVED / CLOSED" 
          count={resolved.length} 
          color="border-green-500 bg-green-50" 
          icon={<CheckCircle className="w-5 h-5 text-green-600"/>}
        >
          {resolved.map(log => (
            <JobCard key={log.id} log={log} isResolved />
          ))}
        </Column>

      </div>
    </div>
  )
}

// --- UI COMPONENTS ---

function Column({ title, count, children, color, icon }: any) {
  return (
    <div className="flex flex-col h-full">
      <div className={`p-4 rounded-t-xl border-t-4 bg-white shadow-sm flex justify-between items-center ${color}`}>
         <div className="flex items-center font-black text-gray-800 uppercase tracking-wide">
            {icon} <span className="ml-2">{title}</span>
         </div>
         <span className="bg-gray-800 text-white text-xs font-bold px-2 py-1 rounded-full">{count}</span>
      </div>
      <div className="bg-gray-200/50 p-3 rounded-b-xl flex-1 space-y-3 min-h-[500px]">
         {children}
      </div>
    </div>
  )
}

function JobCard({ log, onMove, moveLabel, moveColor, isResolved }: any) {
  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
       {/* Vehicle ID & Priority */}
       <div className="flex justify-between items-start mb-2">
          <span className="font-black text-lg text-gray-900 bg-gray-100 px-2 rounded">
             {log.vehicles?.vehicle_uid || 'Unknown'}
          </span>
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${log.priority === 'Critical' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
             {log.priority}
          </span>
       </div>

       {/* TOB Location */}
       <div className="mb-3">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center">
             <MapPinIcon /> {log.vehicles?.tob || '---'}
          </span>
       </div>

       {/* Description */}
       <p className="text-sm font-bold text-gray-700 mb-4 line-clamp-2">
         {log.description}
       </p>

       {/* Footer Info */}
       <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs text-gray-500 font-medium">
          <div className="flex items-center" title="Date Reported">
             <Calendar className="w-3 h-3 mr-1" />
             {new Date(log.logged_date).toLocaleDateString()}
          </div>
          {log.responsible_person && (
             <div className="flex items-center" title="Assigned To">
                <User className="w-3 h-3 mr-1" />
                {log.responsible_person}
             </div>
          )}
       </div>

       {/* ACTION BUTTON */}
       {!isResolved && (
         <button onClick={onMove} className={`w-full mt-3 py-2 rounded text-white text-xs font-black uppercase flex items-center justify-center hover:opacity-90 transition-opacity ${moveColor}`}>
            {moveLabel} <ArrowRight className="w-3 h-3 ml-1" />
         </button>
       )}
    </div>
  )
}

function MapPinIcon() {
  return <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
}