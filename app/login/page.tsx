"use client"
import { useState, useEffect, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { ShieldCheck, Lock, Mail, Loader2 } from 'lucide-react'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [autoLogging, setAutoLogging] = useState(false)

  // --- QR CODE LISTENER ---
  useEffect(() => {
    const autoEmail = searchParams.get('auto_email')
    const autoPass = searchParams.get('auto_pass')

    if (autoEmail && autoPass) {
        handleAutoLogin(autoEmail, autoPass)
    }
  }, [searchParams])

  async function handleAutoLogin(e: string, p: string) {
      setAutoLogging(true)
      await new Promise(r => setTimeout(r, 500)) 
      
      const { error } = await supabase.auth.signInWithPassword({ email: e, password: p })
      
      if (!error) {
          router.push('/')
          router.refresh()
      } else {
          alert('QR Code Expired or Invalid')
          setAutoLogging(false)
      }
  }

  async function handleAuth() {
    setLoading(true)
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) alert(error.message)
      else alert('Account created! You can now log in.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) alert(error.message)
      else {
        router.push('/')
        router.refresh()
      }
    }
    setLoading(false)
  }

  if (autoLogging) return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white">
          <Loader2 className="w-16 h-16 animate-spin text-blue-500 mb-6" />
          <h1 className="text-2xl font-black uppercase tracking-widest">Verifying Vehicle ID...</h1>
          <p className="text-blue-400 font-bold mt-2">Accessing Secure Network</p>
      </div>
  )

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        
        <div className="bg-blue-900 p-8 text-center">
          <div className="mx-auto bg-blue-800 w-16 h-16 rounded-full flex items-center justify-center mb-4 shadow-lg">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white uppercase tracking-wider">Secure Access</h1>
          <p className="text-blue-200 text-sm font-bold mt-1">Military Vehicle Accountability System</p>
        </div>

        <div className="p-8">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email / ID</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 p-3 border-2 border-gray-200 rounded-lg font-bold outline-none focus:border-blue-900" placeholder="user@system.local" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 p-3 border-2 border-gray-200 rounded-lg font-bold outline-none focus:border-blue-900" placeholder="••••••••" />
              </div>
            </div>
            <button onClick={handleAuth} disabled={loading} className="w-full bg-blue-900 hover:bg-black text-white font-black py-4 rounded-lg shadow-md transition-all flex justify-center items-center">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isSignUp ? 'Create Account' : 'Authenticate')}
            </button>
            <div className="text-center mt-4">
              <button onClick={() => setIsSignUp(!isSignUp)} className="text-xs font-bold text-gray-500 hover:text-blue-900 uppercase">
                {isSignUp ? 'Already have an ID? Log In' : 'Need Access? Register New ID'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-900 flex items-center justify-center text-white font-bold">Initializing Secure Gateway...</div>}>
      <LoginContent />
    </Suspense>
  )
}