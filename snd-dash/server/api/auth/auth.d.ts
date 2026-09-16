// server/api/auth/auth.d.ts
//
// Augmentasi tipe next-auth (v4) untuk membawa identitas domain pada sesi/JWT.
//
// Sesi NuxtAuth (authjs) membawa `ownerId` (tautan email→owner, AD-8/§22.11) dan
// `status` siklus hidup (OwnerLifecycle) agar guard akses server (server/utils/
// access) dapat membangun `Principal` tanpa lookup email ulang di klien.

import type { OwnerLifecycle, Uuid } from '../../../shared/domain/types'

declare module 'next-auth' {
  interface Session {
    user?: {
      name?: string | null
      email?: string | null
      image?: string | null
      /** Tautan identitas domain (AD-8): `owners.id` hasil match email Google. */
      ownerId?: Uuid
      /** Status siklus hidup Owner (dipakai guard akses §4.8). */
      status?: OwnerLifecycle
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    email?: string | null
    /** Tautan identitas domain (AD-8): `owners.id` hasil match email Google. */
    ownerId?: Uuid
    /** Status siklus hidup Owner. */
    status?: OwnerLifecycle
  }
}

export {}
