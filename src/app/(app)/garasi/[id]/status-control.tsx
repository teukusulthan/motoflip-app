'use client'

import { useEffect, useRef } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import type { MotorcycleStatus } from '@prisma/client'
import { updateStatus } from '@/app/actions/motorcycles'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { STATUS_LABELS, STATUS_ORDER } from '@/components/motorflip/status-badge'
import type { ActionState } from '@/lib/validation'

const initialState: ActionState = {}

/** §5 — the lifecycle is user-editable; every change is recorded as an event. */
export function StatusControl({
  motorcycleId,
  current,
}: {
  motorcycleId: string
  current: MotorcycleStatus
}) {
  const [state, formAction] = useFormState(updateStatus, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.error) toast.error(state.error)
  }, [state])

  return (
    <form ref={formRef} action={formAction}>
      <input type="hidden" name="motorcycleId" value={motorcycleId} />
      <Label htmlFor="status-select" className="mb-1.5">
        Status
      </Label>
      <StatusSelect
        current={current}
        onChange={() => formRef.current?.requestSubmit()}
      />
    </form>
  )
}

function StatusSelect({
  current,
  onChange,
}: {
  current: MotorcycleStatus
  onChange: () => void
}) {
  const { pending } = useFormStatus()
  return (
    <Select
      id="status-select"
      name="status"
      defaultValue={current}
      disabled={pending}
      onChange={onChange}
    >
      {STATUS_ORDER.map((status) => (
        <option key={status} value={status}>
          {STATUS_LABELS[status]}
        </option>
      ))}
    </Select>
  )
}
