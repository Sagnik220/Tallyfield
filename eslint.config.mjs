import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

// Layer rules: lower layers must not import from higher ones. See docs/ARCHITECTURE.md.
const layerRule = (files, forbidden, message) => ({
  files,
  rules: {
    'no-restricted-imports': ['error', { patterns: [{ group: forbidden, message }] }],
  },
})

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'node_modules/**', 'next-env.d.ts', 'coverage/**']),
  layerRule(['src/domain/**', 'src/blocks/**'], ['@/data/*', '@/services/*', '@/server/*', '@/lib/supabase/*', '@/integrations/*', 'next/*'],
    'domain and blocks are pure: no database, network or framework imports.'),
  layerRule(['src/data/**'], ['@/services/*', '@/server/*', '@/app/*'],
    'data must not depend on services or the web layer.'),
  layerRule(['src/services/**', 'src/integrations/**'], ['@/server/*', '@/app/*'],
    'services must not depend on the web layer.'),
])
