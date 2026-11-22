"use client"

import { useActionState, useState } from "react"

import { Button } from "@workspace/ui/components/ui/cubby-ui/button"
import { Input } from "@workspace/ui/components/ui/cubby-ui/input"

import { deleteAccount, type DeleteAccountState } from "./actions"

export function DeleteAccount({ email }: { email: string }) {
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState("")
  const [state, formAction, pending] = useActionState<
    DeleteAccountState,
    FormData
  >(deleteAccount, {})

  if (!open) {
    return (
      <Button variant="destructive-soft" onClick={() => setOpen(true)}>
        Delete account
      </Button>
    )
  }

  const matches = confirmation.trim().toLowerCase() === email.toLowerCase()

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label htmlFor="delete-confirmation" className="text-sm">
        Type <span className="font-medium">{email}</span> to confirm.
      </label>
      <Input
        id="delete-confirmation"
        name="confirmation"
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
        autoComplete="off"
        autoFocus
        aria-invalid={state.error ? true : undefined}
      />
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          type="submit"
          variant="destructive"
          disabled={!matches}
          loading={pending}
        >
          Permanently delete account
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => {
            setOpen(false)
            setConfirmation("")
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
