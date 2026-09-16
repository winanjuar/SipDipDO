/**
 * Konfigurasi burn-in — seleksi test pintar berbasis git diff
 * (burn-in.md). Dua tahap: skip file tak relevan, lalu kendali volume
 * persentase. CI lebih hemat (20%, 2 repetisi, tanpa retry); lokal
 * lebih agresif (30%, 3 repetisi, 1 retry).
 */
import type { BurnInConfig } from '@seontechnologies/playwright-utils/burn-in'

const config: BurnInConfig = {
  skipBurnInPatterns: [
    '**/config/**',
    '**/*types*',
    '**/*.md',
    '**/README*',
    '_bmad/**',
    '_bmad-output/**',
  ],
  burnInTestPercentage: process.env.CI ? 0.2 : 0.3,
  burnIn: {
    repeatEach: process.env.CI ? 2 : 3,
    retries: process.env.CI ? 0 : 1,
  },
}

export default config
