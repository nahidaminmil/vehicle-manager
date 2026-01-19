"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { 
  ArrowLeft, Wrench, AlertTriangle, Activity, CheckCircle, 
  Calendar, MapPin, ArrowRight, User, ExternalLink, Clock
} from 'lucide-react'

export default function WorkshopFloor() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<any[]>([])

  // --- FETCH FROM VIEW ---
  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')

      // Fetch from the secure system view
      const { data, error } = await supabase
        .from('workshop_feed') 
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
          console.error("Error fetching logs:", error.message)
      } else {
          setLogs(data || [])
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  // --- ACTIONS ---
  async function updateStatus(logId: string, newStatus: string) {
      if(!confirm(`Move ticket to ${newStatus}?`)) return

      // Optimistic Update (Immediate UI change)
      setLogs(prev => prev.map(l => l.id === logId ? { ...l, status: newStatus } : l))

      const { error } = await supabase
        .from('maintenance_logs')
        .update({ status: newStatus, updated_at: new Date().toISOString() }) // Update timestamp too
        .eq('id', logId)
      
      if (error) {
          alert("Error updating: " + error.message)
          window.location.reload()
      }
  }

  // --- KANBAN COLUMNS ---
  const pending = logs.filter(l => l.status === 'Pending')
  const inProgress = logs.filter(l => l.status === 'In Progress')
  const resolved = logs.filter(l => l.status === 'Resolved')

  if (loading) return <div className="p-8 font-black text-xl text-gray-800">Loading Workshop Floor...</div>

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6 pb-24">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
        <div>
           <button onClick={() => router.push('/')} className="flex items-center text-gray-500 hover:text-gray-900 font-bold mb-2">
             <ArrowLeft className="w-5 h-5 mr-1" /> Back to Command
           </button>
           <h1 className="text-2xl md:text-3xl font-black text-gray-900 uppercase tracking-tight flex items-center">
             <Wrench className="w-6 h-6 md:w-8 md:h-8 mr-3 text-orange-600"/> Workshop Floor
           </h1>
        </div>
        <div className="bg-white px-4 py-2 rounded-lg shadow-sm font-bold text-gray-600 border border-gray-200 text-sm md:text-base">
           Total Issues: <span className="text-black text-lg">{logs.length}</span>
        </div>
      </div>

      {/* KANBAN BOARD */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
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
          {pending.length === 0 && <div className="text-center text-gray-400 font-bold py-8 opacity-50">No Pending Jobs</div>}
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
          {inProgress.length === 0 && <div className="text-center text-blue-300 font-bold py-8 opacity-50">Floor Clear</div>}
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
          {resolved.length === 0 && <div className="text-center text-green-600 font-bold py-8 opacity-50">No History</div>}
        </Column>

      </div>
    </div>
  )
}

// --- UI COMPONENTS ---

function Column({ title, count, children, color, icon }: any) {
  return (
    <div className="flex flex-col h-full rounded-xl shadow-sm border border-gray-200 overflow-hidden bg-white">
      <div className={`p-4 border-t-4 flex justify-between items-center ${color}`}>
         <div className="flex items-center font-black text-gray-800 uppercase tracking-wide text-sm md:text-base">
            {icon} <span className="ml-2">{title}</span>
         </div>
         <span className="bg-gray-900 text-white text-xs font-bold px-2 py-1 rounded-full">{count}</span>
      </div>
      <div className="bg-gray-100 p-3 space-y-3 min-h-[200px] md:min-h-[500px]">
         {children}
      </div>
    </div>
  )
}

function JobCard({ log, onMove, moveLabel, moveColor, isResolved }: any) {
  
  // --- CALCULATE DAYS COUNT ---
  const getDaysCount = () => {
      const start = new Date(log.logged_date).getTime()
      // If resolved, stop counting at 'updated_at' (completion time). If active, count to NOW.
      const end = (isResolved && log.updated_at) ? new Date(log.updated_at).getTime() : new Date().getTime()
      
      const diffTime = Math.abs(end - start)
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) 
      return diffDays
  }

  const days = getDaysCount()

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow flex flex-col gap-3">
       
       {/* 1. TOP ROW: ID & Priority */}
       <div className="flex justify-between items-start">
          <span className="font-black text-lg text-gray-900 bg-gray-50 border border-gray-100 px-2 rounded">
             {log.vehicle_uid}
          </span>
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${log.priority === 'Critical' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
             {log.priority}
          </span>
       </div>

       {/* 2. INFO ROW: Type & Location */}
       <div className="flex justify-between items-center text-xs font-bold text-gray-500 uppercase">
          <span className="flex items-center"><User className="w-3 h-3 mr-1"/> {log.vehicle_type_name}</span>
          <span className="flex items-center"><MapPin className="w-3 h-3 mr-1 text-gray-400"/> {log.tob}</span>
       </div>

       {/* 3. DESCRIPTION */}
       <p className="text-sm font-bold text-gray-700 line-clamp-2 border-l-2 border-gray-200 pl-2">
         {log.description}
       </p>

       {/* 4. NEW FEATURE: STATUS GRID (Days & Profile) */}
       <div className="grid grid-cols-2 gap-2 mt-1">
           {/* Days Counter */}
           <div className={`text-center py-2 rounded border flex flex-col justify-center ${isResolved ? 'bg-green-50 border-green-100 text-green-800' : 'bg-orange-50 border-orange-100 text-orange-800'}`}>
               <p className="text-[9px] uppercase font-black opacity-70 mb-0.5">Duration</p>
               <p className="text-lg font-black leading-none">{days} <span className="text-[10px]">Days</span></p>
           </div>

           {/* Vehicle Profile Button */}
           <Link href={`/vehicle/${log.vehicle_id}`} className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-center py-2 rounded border border-gray-200 flex flex-col items-center justify-center transition-colors group">
               <ExternalLink className="w-4 h-4 mb-1 group-hover:scale-110 transition-transform"/>
               <span className="text-[9px] font-black uppercase">View Profile</span>
           </Link>
       </div>

       {/* 5. FOOTER: Date */}
       <div className="flex items-center justify-end text-[10px] text-gray-400 font-medium">
          <Clock className="w-3 h-3 mr-1" />
          Reported: {new Date(log.logged_date).toLocaleDateString()}
       </div>

       {/* 6. ACTION BUTTON */}
       {!isResolved && (
         <button onClick={onMove} className={`w-full py-3 md:py-2 rounded text-white text-xs font-black uppercase flex items-center justify-center hover:opacity-90 transition-opacity ${moveColor}`}>
            {moveLabel} <ArrowRight className="w-3 h-3 ml-1" />
         </button>
       )}
    </div>
  )
}