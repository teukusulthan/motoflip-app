import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
})

export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'next-env.d.ts'],
  },
  {
    /**
     * Domain purity, enforced rather than merely intended.
     *
     * src/domain holds the financial engine. If it could reach Prisma, React or
     * the data layer, the §37 test suite would need a database and the
     * calculations would stop being independently verifiable. This rule is what
     * keeps that boundary real.
     */
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@prisma/client',
                '@/data/*',
                '@/app/*',
                '@/server/*',
                '@/components/*',
                '@/lib/prisma',
                'react',
                'next/*',
                'server-only',
              ],
              message:
                'src/domain must stay pure: no Prisma, React, Next or data-layer imports. Map at the src/data boundary instead.',
            },
          ],
        },
      ],
    },
  },
]
