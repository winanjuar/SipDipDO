/**
 * Unit tests for role-guard utilities (AD-8).
 * Tests the enforceCOO function with various principal types.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Principal } from '#shared/domain/identity'
import type { H3Event } from 'h3'

// Mock the api-error module before importing role-guard
const mockSendApiError = vi.fn()
vi.mock('./api-error', () => ({
  HTTP_STATUS: {
    ok: 200,
    created: 201,
    badRequest: 400,
    unauthorized: 401,
    forbidden: 403,
    notFound: 404,
  },
  sendApiError: (event: H3Event, status: number, envelope: unknown) => {
    mockSendApiError(event, status, envelope)
    // Simulate setting status code on the event
    event.node.res.statusCode = status
    return envelope
  },
}))

// Import after mocks are set up
import { enforceCOO, isCOO } from './role-guard'

// Mock H3Event with minimal required properties
function createMockEvent(): H3Event {
  return {
    node: { res: { statusCode: 200 } },
  } as unknown as H3Event
}

beforeEach(() => {
  mockSendApiError.mockClear()
})

describe('enforceCOO', () => {
  it('returns null when principal is COO', () => {
    const event = createMockEvent()
    const principal: Principal = {
      unlinked: false,
      role: 'coo',
      owner: {
        email: 'coo@example.com',
        status: 'terverifikasi',
        rejectionReason: null,
        firstEffectiveAt: '2026-01-01T00:00:00Z',
        profilLengkap: true,
      },
    }

    const result = enforceCOO(event, principal)
    expect(result).toBeNull()
  })

  it('returns 403 error envelope when principal is pemegang_saham', () => {
    const event = createMockEvent()
    const principal: Principal = {
      unlinked: false,
      role: 'pemegang_saham',
      owner: {
        email: 'owner@example.com',
        status: 'terverifikasi',
        rejectionReason: null,
        firstEffectiveAt: '2026-01-01T00:00:00Z',
        profilLengkap: true,
      },
    }

    const result = enforceCOO(event, principal)
    expect(result).not.toBeNull()
    expect(result?.code).toBe('FORBIDDEN')
    expect(event.node.res.statusCode).toBe(403)
  })

  it('returns 403 error envelope when principal is tanpa_saham', () => {
    const event = createMockEvent()
    const principal: Principal = {
      unlinked: false,
      role: 'tanpa_saham',
      owner: {
        email: 'owner@example.com',
        status: 'terverifikasi',
        rejectionReason: null,
        firstEffectiveAt: null,
        profilLengkap: true,
      },
    }

    const result = enforceCOO(event, principal)
    expect(result).not.toBeNull()
    expect(result?.code).toBe('FORBIDDEN')
  })

  it('returns 403 error envelope when principal is calon_owner', () => {
    const event = createMockEvent()
    const principal: Principal = {
      unlinked: false,
      role: 'calon_owner',
      owner: {
        email: 'calon@example.com',
        status: 'diajukan',
        rejectionReason: null,
        firstEffectiveAt: null,
        profilLengkap: false,
      },
    }

    const result = enforceCOO(event, principal)
    expect(result).not.toBeNull()
    expect(result?.code).toBe('FORBIDDEN')
  })

  it('returns 403 error envelope when principal is unlinked', () => {
    const event = createMockEvent()
    const principal: Principal = { unlinked: true }

    const result = enforceCOO(event, principal)
    expect(result).not.toBeNull()
    expect(result?.code).toBe('FORBIDDEN')
    expect(result?.message).toContain('tidak terhubung')
  })

  it('uses custom message when provided', () => {
    const event = createMockEvent()
    const principal: Principal = {
      unlinked: false,
      role: 'pemegang_saham',
      owner: {
        email: 'owner@example.com',
        status: 'terverifikasi',
        rejectionReason: null,
        firstEffectiveAt: '2026-01-01T00:00:00Z',
        profilLengkap: true,
      },
    }

    const customMessage = 'Hanya COO yang dapat menetapkan harga.'
    const result = enforceCOO(event, principal, customMessage)
    expect(result).not.toBeNull()
    expect(result?.message).toBe(customMessage)
  })
})

describe('isCOO', () => {
  it('returns true when principal is COO', () => {
    const principal: Principal = {
      unlinked: false,
      role: 'coo',
      owner: {
        email: 'coo@example.com',
        status: 'terverifikasi',
        rejectionReason: null,
        firstEffectiveAt: '2026-01-01T00:00:00Z',
        profilLengkap: true,
      },
    }

    expect(isCOO(principal)).toBe(true)
  })

  it('returns false when principal is pemegang_saham', () => {
    const principal: Principal = {
      unlinked: false,
      role: 'pemegang_saham',
      owner: {
        email: 'owner@example.com',
        status: 'terverifikasi',
        rejectionReason: null,
        firstEffectiveAt: '2026-01-01T00:00:00Z',
        profilLengkap: true,
      },
    }

    expect(isCOO(principal)).toBe(false)
  })

  it('returns false when principal is unlinked', () => {
    const principal: Principal = { unlinked: true }
    expect(isCOO(principal)).toBe(false)
  })
})
