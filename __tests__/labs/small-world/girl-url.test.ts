import { statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GIRL_GLB_BYTES, GIRL_URL } from '@/components/labs/small-world/scene/girl-url'

describe('girl-url', () => {
  it('pins GIRL_GLB_BYTES to the shipped file so the byte arc denominator cannot drift', () => {
    // The loader's honest byte arc divides streamed bytes by this constant when
    // the (gzip-chunked) response carries no content-length. If the girl GLB is
    // ever re-exported, this test names the one number to update.
    const shipped = statSync(join(process.cwd(), 'public', GIRL_URL)).size
    expect(GIRL_GLB_BYTES).toBe(shipped)
  })
})
