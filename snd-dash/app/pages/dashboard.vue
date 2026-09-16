<script setup lang="ts">
// app/pages/dashboard.vue
//
// Beranda setelah login (layout dashboard: topbar + sidebar + footer).
definePageMeta({ layout: 'dashboard' })

interface SessionUser {
  email?: string | null
  status?: string
}

const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
const { data: session } = await useAsyncData('dashboard-session', () =>
  $fetch<{ user?: SessionUser } | null>('/api/auth/session', { headers }),
)
const user = computed(() => session.value?.user ?? null)

const shortcuts = [
  { to: '/harga', label: 'Harga & Riwayat', desc: 'Harga berjalan beli/jual dan riwayatnya' },
  { to: '/rkap', label: 'RKAP & Progress', desc: 'Kebutuhan modal per fase dan pemenuhannya' },
  { to: '/pesanan', label: 'Buat Pesanan', desc: 'Ajukan pembelian saham dengan pratinjau Strength' },
  { to: '/antrian', label: 'Antrian Beli', desc: 'Konfirmasi pesanan (COO)' },
  { to: '/kontribusi', label: 'Kontribusi', desc: 'Poin kontribusi dan cut-off' },
  { to: '/distribusi', label: 'Distribusi Laba', desc: 'Simulasi & rekap distribusi RUPS' },
]
</script>

<template>
  <div class="dash">
    <div class="dash__head">
      <h1 class="dash__title">Beranda</h1>
      <p class="dash__sub">
        Selamat datang, <strong>{{ user?.email }}</strong>
      </p>
    </div>

    <div class="cards">
      <NuxtLink v-for="s in shortcuts" :key="s.to" :to="s.to" class="scard">
        <h3 class="scard__title">{{ s.label }}</h3>
        <p class="scard__desc">{{ s.desc }}</p>
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.dash__title {
  margin: 0;
  font-size: 1.5rem;
}
.dash__sub {
  color: #64748b;
  margin-top: 0.25rem;
}
.cards {
  margin-top: 1.5rem;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
}
.scard {
  display: block;
  padding: 1.1rem;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  text-decoration: none;
  color: #0f172a;
  transition: box-shadow 0.15s ease, transform 0.15s ease;
}
.scard:hover {
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}
.scard__title {
  margin: 0 0 0.35rem;
  font-size: 1rem;
}
.scard__desc {
  margin: 0;
  color: #64748b;
  font-size: 0.85rem;
}
</style>
