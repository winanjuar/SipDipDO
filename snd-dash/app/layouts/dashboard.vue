<script setup lang="ts">
// Layout dashboard: top bar + sidebar kiri + content + footer.
// Membaca sesi langsung dari /api/auth/session (meneruskan cookie saat SSR)
// agar konsisten dengan halaman lain.
interface SessionUser {
  name?: string | null
  email?: string | null
  status?: string
}

const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
const { data: session } = await useAsyncData('dash-session', () =>
  $fetch<{ user?: SessionUser } | null>('/api/auth/session', { headers }),
)
const user = computed(() => session.value?.user ?? null)

const year = new Date().getFullYear()
const sidebarOpen = ref(false)
const route = useRoute()

const nav = [
  { to: '/dashboard', label: 'Beranda', icon: '🏠' },
  { to: '/harga', label: 'Harga & Riwayat', icon: '🏷️' },
  { to: '/rkap', label: 'RKAP & Progress', icon: '📊' },
  { to: '/pesanan', label: 'Buat Pesanan', icon: '🧾' },
  { to: '/antrian', label: 'Antrian Beli', icon: '📥' },
  { to: '/kontribusi', label: 'Kontribusi', icon: '⭐' },
  { to: '/distribusi', label: 'Distribusi Laba', icon: '💰' },
  { to: '/mom', label: 'MoM', icon: '📝' },
  { to: '/pendaftaran', label: 'Pendaftaran', icon: '👥' },
  { to: '/audit', label: 'Audit Trail', icon: '🔍' },
  { to: '/personal', label: 'Halaman Personal', icon: '👤' },
]

// Breadcrumb: Beranda › <label halaman aktif>. Label diambil dari nav.
const currentLabel = computed(() => {
  const match = nav.find((n) => n.to === route.path)
  return match?.label ?? route.path
})
const isHome = computed(() => route.path === '/dashboard')

async function doLogout() {
  try {
    const csrf = await $fetch<{ csrfToken: string }>('/api/auth/csrf')
    const body = new URLSearchParams({ csrfToken: csrf.csrfToken, json: 'true' })
    await $fetch('/api/auth/signout', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
  } finally {
    window.location.href = '/session'
  }
}
</script>

<template>
  <div class="layout">
    <!-- Top bar -->
    <header class="topbar">
      <button class="burger" aria-label="Menu" @click="sidebarOpen = !sidebarOpen">☰</button>
      <NuxtLink to="/dashboard" class="brand">
        <span class="brand__dot" />
        Sip &amp; Dip Dashboard
      </NuxtLink>
      <div class="topbar__right">
        <span v-if="user" class="who">
          {{ user.email }}
          <span v-if="user.status" class="badge">{{ user.status }}</span>
        </span>
        <button class="logout" @click="doLogout">Keluar</button>
      </div>
    </header>

    <div class="body">
      <!-- Sidebar -->
      <aside class="sidebar" :class="{ 'sidebar--open': sidebarOpen }">
        <nav class="menu">
          <NuxtLink
            v-for="item in nav"
            :key="item.to"
            :to="item.to"
            class="menu__item"
            active-class="menu__item--active"
            @click="sidebarOpen = false"
          >
            <span class="menu__icon">{{ item.icon }}</span>
            <span>{{ item.label }}</span>
          </NuxtLink>
        </nav>
      </aside>

      <!-- Content -->
      <main class="main">
        <!-- Breadcrumb -->
        <nav class="crumbs" aria-label="Breadcrumb">
          <NuxtLink to="/dashboard" class="crumbs__link">Beranda</NuxtLink>
          <template v-if="!isHome">
            <span class="crumbs__sep">›</span>
            <span class="crumbs__current">{{ currentLabel }}</span>
          </template>
        </nav>

        <div class="content-card">
          <slot />
        </div>
      </main>
    </div>

    <!-- Footer -->
    <footer class="footer">
      <span>© {{ year }} Sip &amp; Dip Ownership Dashboard</span>
      <span class="footer__muted">Phase 1</span>
    </footer>
  </div>
</template>

<style scoped>
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f1f5f9;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  color: #0f172a;
}
/* Top bar */
.topbar {
  height: 56px;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0 1rem;
  position: sticky;
  top: 0;
  z-index: 20;
}
.burger {
  display: none;
  border: none;
  background: transparent;
  font-size: 1.25rem;
  cursor: pointer;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 700;
  color: #0f172a;
  text-decoration: none;
}
.brand__dot {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: #4f46e5;
}
.topbar__right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.who {
  color: #475569;
  font-size: 0.85rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}
.badge {
  background: #eef2ff;
  color: #4338ca;
  border-radius: 999px;
  padding: 0.1rem 0.5rem;
  font-size: 0.72rem;
  text-transform: capitalize;
}
.logout {
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  border-radius: 8px;
  padding: 0.4rem 0.8rem;
  cursor: pointer;
  font-size: 0.85rem;
}
.logout:hover {
  background: #f1f5f9;
}
/* Body: sidebar + content */
.body {
  flex: 1;
  display: flex;
  align-items: stretch;
}
.sidebar {
  width: 240px;
  background: #fff;
  border-right: 1px solid #e2e8f0;
  padding: 1rem 0.75rem;
  flex-shrink: 0;
}
.menu {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.menu__item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0.75rem;
  border-radius: 8px;
  color: #334155;
  text-decoration: none;
  font-size: 0.9rem;
}
.menu__item:hover {
  background: #f1f5f9;
}
.menu__item--active {
  background: #eef2ff;
  color: #4338ca;
  font-weight: 600;
}
.menu__icon {
  width: 1.2rem;
  text-align: center;
}
.main {
  flex: 1;
  padding: 1.5rem;
  min-width: 0;
}
.crumbs {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  margin-bottom: 1rem;
  color: #64748b;
}
.crumbs__link {
  color: #4f46e5;
  text-decoration: none;
}
.crumbs__link:hover {
  text-decoration: underline;
}
.crumbs__sep {
  color: #cbd5e1;
}
.crumbs__current {
  color: #334155;
  font-weight: 600;
}
.content-card {
  background: transparent;
}
/* Footer */
.footer {
  background: #fff;
  border-top: 1px solid #e2e8f0;
  padding: 0.85rem 1.5rem;
  display: flex;
  justify-content: space-between;
  color: #64748b;
  font-size: 0.85rem;
}
.footer__muted {
  color: #94a3b8;
}
/* Responsive: sidebar jadi drawer */
@media (max-width: 860px) {
  .burger {
    display: inline-block;
  }
  .sidebar {
    position: fixed;
    top: 56px;
    bottom: 0;
    left: 0;
    transform: translateX(-100%);
    transition: transform 0.2s ease;
    z-index: 15;
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.08);
  }
  .sidebar--open {
    transform: translateX(0);
  }
}
</style>
