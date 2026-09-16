import GoogleProvider from 'next-auth/providers/google'
import { NuxtAuthHandler } from '#auth'

/**
 * NuxtAuth (sidebase 1.3.1, Auth.js provider Google) — smoke R-005.
 * Kredensial via runtimeConfig env (NUXT_GOOGLE_CLIENT_ID/SECRET,
 * NUXT_AUTH_SECRET) — tidak pernah di repo. Penegakan role/matriks keterbukaan
 * di middleware server + route handler adalah Story 1.2/1.7 (AD-8).
 */
export default NuxtAuthHandler({
  secret: useRuntimeConfig().authSecret,
  providers: [
    // @ts-expect-error interop CJS .default saat SSR (pola terdokumentasi sidebase)
    GoogleProvider.default({
      clientId: useRuntimeConfig().googleClientId,
      clientSecret: useRuntimeConfig().googleClientSecret,
    }),
  ],
})
