import test from 'node:test'
import assert from 'node:assert/strict'

import { validateStageModelSelection } from './helpers.ts'

test('validateStageModelSelection requires dedicated validation and assessment models', () => {
  const errors = validateStageModelSelection({
    evalType: 'prompt_comparison',
    inferenceModelIds: ['model-1'],
    assessmentMode: 'auto',
  })

  assert.deepEqual(errors, [
    '请选择校验阶段模型',
    '自动评估模式下必须选择评估阶段模型',
  ])
})

test('validateStageModelSelection accepts valid multi-stage model config', () => {
  const errors = validateStageModelSelection({
    evalType: 'model_comparison',
    inferenceModelIds: ['model-1', 'model-2'],
    validationModelId: 'judge-model',
    assessmentMode: 'auto',
    assessmentModelId: 'assess-model',
  })

  assert.deepEqual(errors, [])
})

test('validateStageModelSelection still requires assessment model outside auto mode', () => {
  const errors = validateStageModelSelection({
    evalType: 'prompt_comparison',
    inferenceModelIds: ['model-1'],
    validationModelId: 'judge-model',
    assessmentMode: 'manual',
  })

  assert.deepEqual(errors, ['请选择评估阶段模型'])
})
