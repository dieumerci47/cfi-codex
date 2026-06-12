import { createContext, useCallback, useContext, useRef, useState } from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const ConfirmContext = createContext(null)

/**
 * Confirmation impérative : `const confirm = useConfirm()` puis
 * `if (await confirm({ title, description, confirmLabel, destructive })) { … }`.
 * Une seule boîte de dialogue montée à la racine de l'app.
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null)
  const resolver = useRef(null)

  const confirm = useCallback((opts = {}) => {
    return new Promise((resolve) => {
      resolver.current = resolve
      setState({
        title: opts.title ?? 'Confirmer',
        description: opts.description ?? '',
        confirmLabel: opts.confirmLabel ?? 'Confirmer',
        cancelLabel: opts.cancelLabel ?? 'Annuler',
        destructive: opts.destructive ?? true,
      })
    })
  }, [])

  const settle = (value) => {
    resolver.current?.(value)
    resolver.current = null
    setState(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog
        open={!!state}
        onOpenChange={(o) => {
          if (!o) settle(false)
        }}
      >
        {state && (
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>{state.title}</AlertDialogTitle>
              <AlertDialogDescription
                className={state.description ? undefined : 'sr-only'}
              >
                {state.description || state.title}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => settle(false)}>
                {state.cancelLabel}
              </AlertDialogCancel>
              <AlertDialogAction
                variant={state.destructive ? 'destructive' : 'default'}
                onClick={() => settle(true)}
              >
                {state.confirmLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm doit être utilisé dans <ConfirmProvider>')
  return ctx
}
