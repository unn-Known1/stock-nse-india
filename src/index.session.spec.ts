import { NseIndia } from './index.js'

describe('NseIndia session cookies', () => {
    test('ensureNseSession bootstraps from homepage and merges multiple cookies', async () => {
        // Cast to any is required because ensureNseSession() and invalidateNseSession()
        // are internal/private methods not exposed on the NseIndia public type.
        // Runtime type assertion: verify the method exists before using it.
        const nseIndia = new NseIndia() as any
        const { ensureNseSession } = nseIndia as { ensureNseSession: () => Promise<string> }
        expect(typeof ensureNseSession).toBe('function')
        const mockGet = jest.fn().mockResolvedValue({ headers: {} })
        nseIndia.nseClient = { get: mockGet }
        nseIndia.nseJar = {
            getCookieString: jest.fn().mockResolvedValue('nsit=abc; ak_bmsc=xyz; bm_sz=def')
        }

        const cookies = await nseIndia.ensureNseSession()

        expect(mockGet).toHaveBeenCalledWith(
            'https://www.nseindia.com/',
            expect.objectContaining({
                headers: expect.objectContaining({
                    'User-Agent': expect.any(String),
                    Accept: expect.stringContaining('text/html')
                })
            })
        )
        expect(cookies).toContain('nsit=abc')
        expect(cookies).toContain('ak_bmsc=xyz')
    })

    test('ensureNseSession reuses session within TTL without re-fetching homepage', async () => {
        const nseIndia = new NseIndia() as any
        expect(typeof (nseIndia as { ensureNseSession: () => Promise<string> }).ensureNseSession).toBe('function')
        const mockGet = jest.fn().mockResolvedValue({ headers: {} })
        nseIndia.nseClient = { get: mockGet }
        nseIndia.nseJar = {
            getCookieString: jest.fn().mockResolvedValue('nsit=abc')
        }

        await nseIndia.ensureNseSession()
        nseIndia.cookies = 'nsit=abc'
        nseIndia.cookieExpiry = Date.now() + 60_000
        nseIndia.cookieUsedCount = 1

        await nseIndia.ensureNseSession()

        expect(mockGet).toHaveBeenCalledTimes(1)
    })

    test('invalidateNseSession resets jar and forces homepage on next call', async () => {
        const nseIndia = new NseIndia() as any
        expect(typeof (nseIndia as { ensureNseSession: () => Promise<string>; invalidateNseSession: () => void }).ensureNseSession).toBe('function')
        expect(typeof (nseIndia as { ensureNseSession: () => Promise<string>; invalidateNseSession: () => void }).invalidateNseSession).toBe('function')
        const mockGet = jest.fn().mockResolvedValue({ headers: {} })
        nseIndia.nseClient = { get: mockGet, defaults: {} }
        nseIndia.nseJar = {
            getCookieString: jest.fn().mockResolvedValue('nsit=abc')
        }

        await nseIndia.ensureNseSession()
        nseIndia.invalidateNseSession()
        nseIndia.nseClient = { get: mockGet, defaults: {} }
        nseIndia.nseJar = {
            getCookieString: jest.fn().mockResolvedValue('nsit=new')
        }

        const cookies = await nseIndia.ensureNseSession(true)

        expect(mockGet).toHaveBeenCalledTimes(2)
        expect(cookies).toBe('nsit=new')
    })
})
