'use server'

import { z } from 'zod'
import { requireUserId } from '@/server/auth'
import { getAllEntries } from '@/data/finance'
import { getMotorcycles } from '@/data/garage'
import { prisma } from '@/lib/prisma'
import { rupiah } from '@/domain/money'
import { type DealScoreResult, scoreDeal } from '@/domain/deal-score'
import { amountSchema } from '@/lib/validation'

const schema = z.object({
  brand: z.string().trim().min(1, 'Merek wajib diisi'),
  model: z.string().trim().min(1, 'Model wajib diisi'),
  year: z.coerce.number().int().min(1970).max(new Date().getFullYear() + 1),
  sellerPrice: amountSchema,
  expectedPurchase: amountSchema,
  estimatedRepair: amountSchema,
  expectedSale: amountSchema,
})

/** Plain, serialisable result — bigint never crosses to the client. */
export interface DealAnalysisView {
  error?: string
  result?: {
    score: number
    band: DealScoreResult['band']
    confidence: DealScoreResult['confidence']
    projectedCost: string
    projectedProfit: string
    projectedRoiBps: number | null
    negotiationSaving: string
    repairShareBps: number | null
    components: {
      key: string
      label: string
      score: number | null
      weight: number
      rationale: string
    }[]
    history: {
      matchingYearCount: number
      matchingModelCount: number
      averageRoiBps: number | null
      averageDaysToSell: number | null
      label: string | null
    }
    missingSignals: string[]
  }
}

export async function analyzeDeal(
  _prev: DealAnalysisView,
  formData: FormData,
): Promise<DealAnalysisView> {
  const userId = await requireUserId()

  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Isian tidak valid.' }
  }

  const input = {
    brand: parsed.data.brand,
    model: parsed.data.model,
    year: parsed.data.year,
    sellerPrice: rupiah(parsed.data.sellerPrice),
    expectedPurchase: rupiah(parsed.data.expectedPurchase),
    estimatedRepair: rupiah(parsed.data.estimatedRepair),
    expectedSale: rupiah(parsed.data.expectedSale),
  }

  const [motorcycles, entries] = await Promise.all([
    getMotorcycles(userId),
    getAllEntries(userId),
  ])

  const scored = scoreDeal(input, motorcycles, entries)

  // §26/§38 — freeze the result so a stored analysis never silently changes
  // when the scoring configuration is later tuned.
  await prisma.dealAnalysis.create({
    data: {
      userId,
      brand: input.brand,
      model: input.model,
      year: input.year,
      sellerPrice: input.sellerPrice,
      expectedPurchase: input.expectedPurchase,
      estimatedRepair: input.estimatedRepair,
      expectedSale: input.expectedSale,
      resultSnapshot: {
        score: scored.score,
        band: scored.band,
        confidence: scored.confidence,
        projectedCost: scored.projection.projectedCost.toString(),
        projectedProfit: scored.projection.projectedProfit.toString(),
        projectedRoiBps: scored.projection.projectedRoi,
        // Mapped to plain objects rather than cast: Prisma's Json input needs a
        // structurally plain value, and this keeps the stored shape explicit.
        components: scored.components.map((component) => ({
          key: component.key,
          label: component.label,
          score: component.score,
          weight: component.weight,
          rationale: component.rationale,
        })),
        missingSignals: [...scored.missingSignals],
      },
    },
  })

  return {
    result: {
      score: scored.score,
      band: scored.band,
      confidence: scored.confidence,
      projectedCost: scored.projection.projectedCost.toString(),
      projectedProfit: scored.projection.projectedProfit.toString(),
      projectedRoiBps: scored.projection.projectedRoi,
      negotiationSaving: scored.projection.negotiationSaving.toString(),
      repairShareBps: scored.projection.repairShareBps,
      components: scored.components,
      history: {
        matchingYearCount: scored.history.matchingYearCount,
        matchingModelCount: scored.history.matchingModelCount,
        averageRoiBps: scored.history.averageRoi,
        averageDaysToSell: scored.history.averageDaysToSell,
        label: scored.history.label,
      },
      missingSignals: scored.missingSignals,
    },
  }
}
