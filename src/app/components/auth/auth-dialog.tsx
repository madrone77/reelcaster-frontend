'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Fish } from 'lucide-react'
import { AuthForm } from './auth-form'

interface AuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultMode?: 'signin' | 'signup'
}

export function AuthDialog({ open, onOpenChange, defaultMode = 'signin' }: AuthDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />
          <div className="relative p-6">
            <DialogHeader className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Fish className="h-5 w-5 text-primary" />
                </div>
                <DialogTitle className="text-xl">
                  {defaultMode === 'signin' ? 'Welcome Back' : 'Start Your Journey'}
                </DialogTitle>
              </div>
              <DialogDescription className="text-muted-foreground">
                {defaultMode === 'signin'
                  ? 'Sign in to access the complete 14-day fishing forecast and historical data'
                  : 'Create your free account to unlock premium fishing insights'}
              </DialogDescription>
            </DialogHeader>

            <AuthForm
              defaultMode={defaultMode}
              onSuccess={() => onOpenChange(false)}
              source="auth-dialog"
              className="mt-6"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
