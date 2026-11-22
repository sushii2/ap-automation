"use client"

import { useActionState, useState } from "react"

import { Button } from "@workspace/ui/components/ui/cubby-ui/button"
import { Input } from "@workspace/ui/components/ui/cubby-ui/input"

import { selectOrganization, type OnboardingState } from "./actions"

const NEW_ORGANIZATION = "new"

const optionClass =
  "flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm transition-colors hover:bg-muted/50 has-checked:border-primary has-checked:bg-muted/50 has-focus-visible:outline-2 has-focus-visible:outline-ring"

export function OnboardingForm({
  organizations,
}: {
  organizations: { id: string; name: string }[]
}) {
  const [state, formAction, pending] = useActionState<
    OnboardingState,
    FormData
  >(selectOrganization, {})
  const [choice, setChoice] = useState(
    organizations.length === 0 ? NEW_ORGANIZATION : ""
  )
  const creating = choice === NEW_ORGANIZATION

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Organization</legend>

        {organizations.length > 0 && (
          <div className="flex max-h-64 flex-col gap-2 overflow-y-auto p-0.5">
            {organizations.map((org) => (
              <label key={org.id} className={optionClass}>
                <input
                  type="radio"
                  name="organization"
                  value={org.id}
                  checked={choice === org.id}
                  onChange={() => setChoice(org.id)}
                  className="accent-primary"
                />
                <span className="min-w-0 truncate">{org.name}</span>
              </label>
            ))}
          </div>
        )}

        <div className="p-0.5">
          <label className={optionClass}>
            <input
              type="radio"
              name="organization"
              value={NEW_ORGANIZATION}
              checked={creating}
              onChange={() => setChoice(NEW_ORGANIZATION)}
              className="accent-primary"
            />
            <span>Create a new organization</span>
          </label>
        </div>
      </fieldset>

      {creating && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="organization-name" className="text-sm font-medium">
            Organization name
          </label>
          <Input
            id="organization-name"
            name="name"
            required
            minLength={2}
            maxLength={100}
            autoComplete="organization"
            placeholder="Acme Inc."
          />
        </div>
      )}

      {choice && (
        <p className="text-sm text-muted-foreground">
          {creating
            ? "You will be the Admin of the new organization."
            : "You will join as a Viewer. An Admin can change your role."}
        </p>
      )}

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={!choice} loading={pending}>
        Continue
      </Button>
    </form>
  )
}
