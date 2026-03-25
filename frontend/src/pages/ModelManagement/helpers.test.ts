import test from 'node:test'
import assert from 'node:assert/strict'

import { buildModelPayload, maskApiKey } from './helpers.ts'

test('maskApiKey hides the middle part of long keys', () => {
  assert.equal(maskApiKey('sk-abcdefghijklmnopqrstuvwxyz'), 'sk-a****wxyz')
})

test('maskApiKey also masks short keys', () => {
  assert.equal(maskApiKey('abcd1234'), 'ab****34')
})

test('buildModelPayload omits blank api key when editing', () => {
  assert.deepEqual(
    buildModelPayload(
      {
        name: '测试模型',
        provider: 'openai',
        api_url: 'https://api.example.com/v1',
        api_key: '   ',
        model_id: 'gpt-4o-mini',
      },
      true
    ),
    {
      name: '测试模型',
      provider: 'openai',
      api_url: 'https://api.example.com/v1',
      model_id: 'gpt-4o-mini',
    }
  )
})

test('buildModelPayload keeps api key when creating', () => {
  assert.deepEqual(
    buildModelPayload(
      {
        name: '测试模型',
        provider: 'openai',
        api_url: 'https://api.example.com/v1',
        api_key: 'sk-abcdef',
        model_id: 'gpt-4o-mini',
      },
      false
    ),
    {
      name: '测试模型',
      provider: 'openai',
      api_url: 'https://api.example.com/v1',
      api_key: 'sk-abcdef',
      model_id: 'gpt-4o-mini',
    }
  )
})
