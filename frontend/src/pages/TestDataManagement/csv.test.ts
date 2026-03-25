import test from 'node:test'
import assert from 'node:assert/strict'

import { parseCsvFirstColumn, SAMPLE_DATASET_CSV_CONTENT } from './csv.ts'

test('parseCsvFirstColumn skips header rows and keeps quoted commas', () => {
  const rows = parseCsvFirstColumn([
    'content',
    '"第一题，包含逗号",meta',
    '第二题,extra',
    '',
  ].join('\n'))

  assert.deepEqual(rows, ['第一题，包含逗号', '第二题'])
})

test('sample csv content can be parsed into multiple dataset rows', () => {
  const rows = parseCsvFirstColumn(SAMPLE_DATASET_CSV_CONTENT)

  assert.equal(rows.length, 3)
  assert.ok(rows.every(row => row.length > 0))
})
