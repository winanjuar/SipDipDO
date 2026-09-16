<script setup lang="ts">
// Halaman login kustom di '/session' — path default @sidebase/nuxt-auth
// (auth.pages.login). Menyediakan halaman ini mencegah "Recursion detected at
// /session" saat NuxtAuth mengarahkan pengguna belum-login ke sini.
//
// Mode dev: login memakai provider 'dev-email' (email tanpa Google). Saat Google
// OAuth aktif, tombol Google akan tersedia lewat daftar provider.
// Halaman login TIDAK boleh diproteksi auth (mencegah loop redirect ke dirinya
// sendiri → "Recursion detected at /session"). Tanpa layout (halaman berdiri
// sendiri, full-screen, kartu login rata tengah).
definePageMeta({ auth: false, layout: false })

// CATATAN: composable `signIn()`/`getProviders()` dari @sidebase/nuxt-auth pada
// versi ini menembak path relatif root ('/providers') dan menghasilkan 404.
// Untuk menghindarinya, login dev-email dilakukan dengan POST LANGSUNG ke endpoint
// next-auth (`/api/auth/csrf` → `/api/auth/callback/dev-email`) memakai $fetch —
// alur yang sama dengan halaman signin bawaan, tanpa composable yang bermasalah.

const email = ref('lerzack@gmail.com')
const errorMsg = ref<string | null>(null)
const loading = ref(false)

async function loginDev() {
  errorMsg.value = null
  loading.value = true
  try {
    // 1) Ambil CSRF token dari next-auth.
    const csrf = await $fetch<{ csrfToken: string }>('/api/auth/csrf')

    // 2) POST credentials ke callback provider 'dev-email' (form-encoded).
    const body = new URLSearchParams({
      email: email.value,
      csrfToken: csrf.csrfToken,
      json: 'true',
    })
    await $fetch('/api/auth/callback/dev-email', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    // 3) Verifikasi sesi terbentuk, lalu ke beranda dashboard.
    const session = await $fetch<{ user?: { email?: string } }>('/api/auth/session')
    if (session?.user?.email) {
      window.location.href = '/dashboard'
    } else {
      errorMsg.value = 'Email tidak terdaftar atau login gagal.'
    }
  } catch {
    errorMsg.value = 'Terjadi kesalahan saat login.'
  } finally {
    loading.value = false
  }
}

// Tombol "Login / Register with Google" saat ini DISABLED karena
// NUXT_GOOGLE_CLIENT_ID & NUXT_GOOGLE_CLIENT_SECRET belum diisi. Handler OAuth
// akan diaktifkan kembali setelah kredensial tersedia.
</script>

<template>
  <main class="wrap">
    <div class="card">
      <!-- Brand with user icon (vertical: icon on top, name below) -->
      <div class="brand">
        <svg class="brand__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <span class="brand__name">Sip &amp; Dip</span>
      </div>
      <h1 class="title">Masuk</h1>
      <p class="sub">Ownership Dashboard</p>

      <!-- Dev email login (tetap tersedia untuk dev/testing) -->
      <label class="lbl" for="email">Email</label>
      <input
        id="email"
        v-model="email"
        type="email"
        class="input"
        placeholder="email@contoh.com"
        @keyup.enter="loginDev"
      />

      <button class="btn" :disabled="loading" @click="loginDev">
        {{ loading ? 'Memproses…' : 'Masuk' }}
      </button>

      <p v-if="errorMsg" class="err">{{ errorMsg }}</p>

      <div class="divider"><span>atau</span></div>

      <!-- Google OAuth button — DISABLED sampai NUXT_GOOGLE_CLIENT_ID/SECRET diisi -->
      <button
        class="btn btn--google"
        disabled
        title="Google OAuth belum dikonfigurasi (isi NUXT_GOOGLE_CLIENT_ID & NUXT_GOOGLE_CLIENT_SECRET di .env)"
      >
        <svg class="google-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Login / Register with Google
      </button>
      <p class="note">Google OAuth belum aktif — segera tersedia.</p>
    </div>
  </main>
</template>

<style scoped>
.wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: linear-gradient(135deg, #eef2ff 0%, #f8fafc 55%, #eef2ff 100%);
  font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  color: #0f172a;
}
.card {
  width: 380px;
  max-width: 100%;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 2rem 1.9rem;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
  text-align: center;
}
.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.brand__icon {
  width: 48px;
  height: 48px;
  padding: 10px;
  border-radius: 999px;
  background: #eef2ff;
  color: #4f46e5;
}
.brand__name {
  font-weight: 700;
  font-size: 1.05rem;
}
.title {
  margin: 0;
  font-size: 1.5rem;
}
.sub {
  color: #64748b;
  margin: 0.25rem 0 1.5rem;
  font-size: 0.9rem;
}
.lbl {
  display: block;
  text-align: left;
  font-size: 0.85rem;
  color: #334155;
  margin-bottom: 0.35rem;
}
.input {
  width: 100%;
  padding: 0.65rem 0.8rem;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  margin-bottom: 1rem;
  box-sizing: border-box;
  font-size: 0.95rem;
}
.input:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
}
.btn {
  display: block;
  width: 100%;
  padding: 0.7rem 1rem;
  border: none;
  border-radius: 10px;
  background: #4f46e5;
  color: #fff;
  cursor: pointer;
  font-size: 0.95rem;
  text-decoration: none;
  box-sizing: border-box;
}
.btn:hover {
  background: #4338ca;
}
.btn:disabled {
  opacity: 0.6;
  cursor: default;
}
.btn--ghost {
  background: #f1f5f9;
  color: #0f172a;
}
.btn--ghost:hover {
  background: #e2e8f0;
}
.btn--google {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  background: #fff;
  color: #3c4043;
  border: 1px solid #dadce0;
  font-weight: 500;
}
.btn--google:hover:not(:disabled) {
  background: #f8faff;
  box-shadow: 0 1px 3px rgba(60, 64, 67, 0.15);
}
.btn--google:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.google-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}
.note {
  margin: 0.6rem 0 0;
  font-size: 0.78rem;
  color: #94a3b8;
}
.err {
  color: #dc2626;
  font-size: 0.85rem;
  margin-top: 0.75rem;
}
.divider {
  position: relative;
  margin: 1.1rem 0;
  color: #94a3b8;
  font-size: 0.8rem;
}
.divider::before,
.divider::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 40%;
  height: 1px;
  background: #e2e8f0;
}
.divider::before {
  left: 0;
}
.divider::after {
  right: 0;
}
.hint {
  color: #64748b;
  font-size: 0.8rem;
  margin-top: 1rem;
  margin-bottom: 0;
}
</style>
