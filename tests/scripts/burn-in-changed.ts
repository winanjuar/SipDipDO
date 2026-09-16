/**
 * Runner burn-in untuk test yang terdampak diff terhadap branch dasar
 * (git flow: develop). Jalankan via `npm run test:e2e:burn-in`.
 * (Bukan file spec — console di sini di luar larangan mandate.)
 */
import { runBurnIn } from '@seontechnologies/playwright-utils/burn-in'

async function main(): Promise<void> {
  await runBurnIn({
    configPath: 'tests/config/burn-in.config.ts',
    baseBranch: 'develop',
  })
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
