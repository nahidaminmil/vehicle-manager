'use server'

import { createClient } from '@supabase/supabase-js'

// 1. Initialize the Admin Client
// We use the SERVICE_ROLE_KEY to bypass security and act as God-Mode Admin
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

// 2. SERVER ACTION: Create User (Without Logging Out)
export async function adminCreateUser(formData: any) {
  const { email, password, role, assigned_tob, assigned_vehicle_id } = formData

  // A. Create the Auth User
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true // Auto-confirm email
  })

  if (authError) return { success: false, error: authError.message }

  if (authData.user) {
    // B. Create the Profile Entry
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authData.user.id,
        email: email,
        role: role,
        assigned_tob: assigned_tob,
        assigned_vehicle_id: assigned_vehicle_id
      })

    if (profileError) return { success: false, error: "Auth created, but Profile failed: " + profileError.message }
  }

  return { success: true }
}

// 3. SERVER ACTION: Reset Password
export async function adminResetPassword(userId: string, newPassword: string) {
  const { error } = await supabaseAdmin.auth.admin.updateUserById(
    userId,
    { password: newPassword }
  )

  if (error) return { success: false, error: error.message }
  return { success: true }
}