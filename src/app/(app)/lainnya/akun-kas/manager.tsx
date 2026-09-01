'use client'

import { archiveCashAccount, saveCashAccount } from '@/app/actions/settings'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { MoneyInput } from '@/components/motoflip/money-input'
import { RecordManager } from '@/components/motoflip/record-manager'

export const ACCOUNT_KIND_LABELS: Record<string, string> = {
  CASH: 'Tunai',
  BANK: 'Bank',
  EWALLET: 'E-Wallet',
}

export interface AccountRecord {
  id: string
  name: string
  kind: string
  openingBalance: string
  balance: string
  archived: boolean
}

export function AccountManager({ accounts }: { accounts: AccountRecord[] }) {
  const byId = new Map(accounts.map((a) => [a.id, a]))

  return (
    <RecordManager
      idField="accountId"
      addLabel="Tambah Akun Kas"
      emptyText="Belum ada akun kas."
      saveAction={saveCashAccount}
      archiveAction={archiveCashAccount}
      records={accounts.map((a) => ({
        id: a.id,
        title: a.name,
        subtitle: `${ACCOUNT_KIND_LABELS[a.kind] ?? a.kind} · saldo ${a.balance}`,
        archived: a.archived,
      }))}
      renderFields={(record) => {
        const account = record ? byId.get(record.id) : null
        return (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="account-name">Nama</Label>
              <Input
                id="account-name"
                name="name"
                required
                defaultValue={account?.name ?? ''}
                placeholder="Kas Tunai"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="account-kind">Jenis</Label>
              <Select
                id="account-kind"
                name="kind"
                defaultValue={account?.kind ?? 'CASH'}
              >
                {Object.entries(ACCOUNT_KIND_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="account-opening">Saldo Awal</Label>
              <MoneyInput
                id="account-opening"
                name="openingBalance"
                defaultValue={account?.openingBalance ?? ''}
                quickAdd={false}
              />
              <p className="text-xs text-fg-subtle">
                Saldo sebelum motoflip mulai mencatat. Mengubahnya menggeser
                seluruh riwayat saldo akun ini.
              </p>
            </div>
          </>
        )
      }}
    />
  )
}
