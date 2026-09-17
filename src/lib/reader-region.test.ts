/**
 * Run with: npx tsx src/lib/reader-region.test.ts
 */
import assert from 'node:assert/strict'
import { readerRegionFor } from './reader-region'

const nowhere = { country: null, region: null }

// Washington pages
assert.equal(readerRegionFor('/lp/seattle/5', nowhere), 'WA')
assert.equal(readerRegionFor('/lp/tacoma/5', nowhere), 'WA')
assert.equal(readerRegionFor('/fishing/us/wa/tacoma/point-defiance', nowhere), 'WA')
assert.equal(readerRegionFor('/fishing/us/wa', nowhere), 'WA')

// Readers the edge places in WA
assert.equal(readerRegionFor('/explore', { country: 'US', region: 'WA' }), 'WA')

// Everyone else is left alone
assert.equal(readerRegionFor('/explore', { country: 'CA', region: 'BC' }), null)
assert.equal(readerRegionFor('/explore', { country: 'AU', region: 'WA' }), null)
assert.equal(readerRegionFor('/lp/vancouver/5', nowhere), null)
assert.equal(readerRegionFor('/fishing/us/washington-ish', nowhere), null)
assert.equal(readerRegionFor('/fishing/us/or/newport', { country: 'US', region: 'OR' }), null)

console.log('reader-region: ok')
