'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { resetFavorites } from '@/app/explore/lib/use-favorite'
import { resetCachedUser } from '@/lib/user-preferences'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  isPasswordRecovery: boolean
  signUp: (
    email: string,
    password: string,
    firstName?: string,
  ) => Promise<{ error: any; session: Session | null }>
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signInWithGoogle: () => Promise<{ error: any }>
  signInWithFacebook: () => Promise<{ error: any }>
  signInWithMagicLink: (email: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  resetPasswordForEmail: (email: string) => Promise<{ error: any }>
  updatePassword: (newPassword: string) => Promise<{ error: any }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true)
      }
      // Saved spots are cached at module scope, so they outlive a sign-out and
      // would otherwise be shown to whoever signs in next on the same tab. The
      // cached auth user is module-scope for the same reason and goes stale in
      // the same cases — USER_UPDATED included, since that IS a metadata write.
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        resetFavorites()
        resetCachedUser()
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email: string, password: string, firstName?: string) => {
    const redirectUrl = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`
      : `${window.location.origin}/auth/callback`

    const trimmedName = firstName?.trim()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        // Persisted on the auth user; the whole app reads the display name
        // from user_metadata.first_name (never from the email).
        ...(trimmedName ? { data: { first_name: trimmedName } } : {}),
      }
    })
    // `session` is non-null only when email confirmation is disabled — the
    // user is already logged in and can be sent straight into the app. When
    // it's null, a confirmation email was sent and we show the check-email
    // screen instead.
    return { error, session: data.session }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const signInWithGoogle = async () => {
    // Always honor the actual origin we're running on (handles localhost,
    // Vercel previews, and prod without needing per-env NEXT_PUBLIC_APP_URL).
    const redirectUrl = `${window.location.origin}/auth/callback`

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })
    return { error }
  }

  const signInWithFacebook = async () => {
    // Same origin-honoring redirect as Google, but currently unused: the
    // Facebook button is hidden in auth-form because the provider is not
    // enabled in the Supabase dashboard (needs a Facebook app ID + secret).
    // Note there is no client-side error to catch if it stays disabled.
    // signInWithOAuth always returns { error: null } and navigates the browser
    // to /auth/v1/authorize, which 400s with "provider is not enabled".
    const redirectUrl = `${window.location.origin}/auth/callback`

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: {
        redirectTo: redirectUrl,
      },
    })
    return { error }
  }

  const signInWithMagicLink = async (email: string) => {
    // Passwordless email sign-in / sign-up. Supabase sends a magic link that
    // lands on /auth/callback; `shouldCreateUser` defaults to true, so this
    // doubles as sign-up for new anglers.
    const redirectUrl = `${window.location.origin}/auth/callback`

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl,
      },
    })
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const resetPasswordForEmail = async (email: string) => {
    const redirectUrl = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`
      : `${window.location.origin}/auth/reset-password`

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    })
    return { error }
  }

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (!error) {
      setIsPasswordRecovery(false)
    }
    return { error }
  }

  const value = {
    user,
    session,
    loading,
    isPasswordRecovery,
    signUp,
    signIn,
    signInWithGoogle,
    signInWithFacebook,
    signInWithMagicLink,
    signOut,
    resetPasswordForEmail,
    updatePassword,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}