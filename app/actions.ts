'use server'

import { createClient } from '@supabase/supabase-js'

// 1. Initialize the Admin Client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// 2. SERVER ACTION: Create User
export async function adminCreateUser(formData: any) {
  console.log("1. Starting Admin User Creation...")
  
  // Check if Key exists
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("ERROR: Service Role Key is MISSING from .env.local")
      return { success: false, error: "Server Configuration Error: Missing Service Key" }
  }

  const { email, password, role, assigned_tob, assigned_vehicle_id } = formData

  try {
      console.log(`2. Attempting to create Auth User: ${email}`)
      
      // A. Create the Auth User
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true 
      })

      if (authError) {
          console.error("Auth Creation Failed:", authError.message)
          return { success: false, error: authError.message }
      }

      console.log("3. Auth User Created. ID:", authData.user?.id)

      if (authData.user) {
        // B. Create the Profile Entry
        console.log("4. Creating Profile Entry...")
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .upsert({
            id: authData.user.id,
            email: email,
            role: role,
            assigned_tob: assigned_tob,
            assigned_vehicle_id: assigned_vehicle_id
          })

        if (profileError) {
            console.error("Profile Creation Failed:", profileError.message)
            return { success: false, error: "Auth created, but Profile failed: " + profileError.message }
        }
      }

      console.log("5. Success!")
      return { success: true }

  } catch (err: any) {
      console.error("UNEXPECTED ERROR:", err)
      return { success: false, error: "Unexpected Server Error: " + err.message }
  }
}

// 3. SERVER ACTION: Reset Password
export async function adminResetPassword(userId: string, newPassword: string) {
  try {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { password: newPassword }
      )

      if (error) return { success: false, error: error.message }
      return { success: true }
  } catch (err: any) {
      return { success: false, error: err.message }
  }
}