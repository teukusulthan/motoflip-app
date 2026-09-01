import { requireUser } from '@/server/auth'
import { getSettings } from '@/data/garage'
import { DEFAULT_THRESHOLDS } from '@/domain/attention'
import { PageHeader } from '@/components/motoflip/page-header'
import { SettingsForm } from './form'

export const metadata = { title: 'Pengaturan · motoflip' }
export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const user = await requireUser()
  const settings = await getSettings(user.id)

  return (
    <>
      <PageHeader
        title="Pengaturan"
        subtitle="Ambang batas peringatan di beranda"
        backHref="/lainnya"
      />
      <SettingsForm
        defaults={{
          agingWarnDays: settings?.agingWarnDays ?? DEFAULT_THRESHOLDS.agingWarnDays,
          agingCriticalDays:
            settings?.agingCriticalDays ?? DEFAULT_THRESHOLDS.agingCriticalDays,
          repairOverrunPercent: Math.round(
            (settings?.repairOverrunWarnBps ??
              DEFAULT_THRESHOLDS.repairOverrunWarnBps) / 100,
          ),
          lowMarginPercent: Math.round(
            (settings?.lowMarginWarnBps ?? DEFAULT_THRESHOLDS.lowMarginWarnBps) / 100,
          ),
        }}
      />
    </>
  )
}
