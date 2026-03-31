import { describe, expect, it, vi } from 'vitest'

import { uploadToPresignedUrl } from './upload'

describe('uploadToPresignedUrl', () => {
  it('returns an unsupported_environment error when XMLHttpRequest is unavailable', async () => {
    vi.stubGlobal('XMLHttpRequest', undefined)

    const result = await uploadToPresignedUrl(
      'https://storage.scalemule.test/upload',
      new Blob(['hello'], { type: 'text/plain' })
    )

    expect(result.data).toBeNull()
    expect(result.error?.code).toBe('unsupported_environment')
    expect(result.error?.message).toContain('XMLHttpRequest')

    vi.unstubAllGlobals()
  })
})
