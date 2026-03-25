import test from 'node:test'
import assert from 'node:assert/strict'

import type { EvalRun, TaskModel, TaskPrompt, ValidationCheckpoint, ValidationResult } from '../../types'
import {
  getTaskModelOptionLabel,
  getTaskPromptOptionLabel,
  sortRunsForDetail,
  sortValidationResults,
} from './helpers.ts'

function makePrompt(overrides: Partial<TaskPrompt>): TaskPrompt {
  return {
    id: overrides.id ?? 'tp-1',
    task_id: overrides.task_id ?? 'task-1',
    prompt_id: overrides.prompt_id ?? 'prompt-1',
    label: overrides.label,
    is_baseline: overrides.is_baseline ?? false,
    prompt: overrides.prompt,
  }
}

function makeModel(overrides: Partial<TaskModel>): TaskModel {
  return {
    id: overrides.id ?? 'tm-1',
    task_id: overrides.task_id ?? 'task-1',
    model_config_id: overrides.model_config_id ?? 'model-1',
    label: overrides.label,
    model: overrides.model,
  }
}

function makeRun(overrides: Partial<EvalRun>): EvalRun {
  return {
    id: overrides.id ?? 'run-1',
    task_id: overrides.task_id ?? 'task-1',
    task_prompt_id: overrides.task_prompt_id,
    task_model_id: overrides.task_model_id ?? 'tm-1',
    task_test_item_id: overrides.task_test_item_id ?? 'tti-1',
    repeat_index: overrides.repeat_index ?? 0,
    status: overrides.status ?? 'completed',
    input_messages: overrides.input_messages ?? [],
    output_content: overrides.output_content,
    error_message: overrides.error_message,
    tokens_used: overrides.tokens_used,
    duration_ms: overrides.duration_ms,
    created_at: overrides.created_at ?? 1,
    completed_at: overrides.completed_at,
    prompt: overrides.prompt,
    model: overrides.model,
    prompt_label: overrides.prompt_label,
    prompt_is_baseline: overrides.prompt_is_baseline ?? false,
    model_label: overrides.model_label,
    test_item_content: overrides.test_item_content,
    validation_results: overrides.validation_results,
    assessment_results: overrides.assessment_results,
  }
}

function makeCheckpoint(overrides: Partial<ValidationCheckpoint>): ValidationCheckpoint {
  return {
    id: overrides.id ?? 'cp-1',
    task_id: overrides.task_id ?? 'task-1',
    name: overrides.name ?? '检查点',
    criterion: overrides.criterion ?? '标准',
    order_index: overrides.order_index ?? 0,
  }
}

function makeValidationResult(overrides: Partial<ValidationResult>): ValidationResult {
  return {
    id: overrides.id ?? 'vr-1',
    eval_run_id: overrides.eval_run_id ?? 'run-1',
    checkpoint_id: overrides.checkpoint_id ?? 'cp-1',
    checkpoint_name: overrides.checkpoint_name,
    checkpoint_criterion: overrides.checkpoint_criterion,
    status: overrides.status ?? 'pass',
    result: overrides.result ?? 'pass',
    annotations: overrides.annotations,
    comment: overrides.comment,
    created_at: overrides.created_at ?? 1,
  }
}

test('prompt/model filter options use associated names instead of raw ids', () => {
  const prompt = makePrompt({
    prompt_id: 'prompt-id',
    prompt: {
      id: 'prompt-id',
      name: '阅读理解基线',
      version: 'v1.2',
      content: '...',
      created_at: 1,
      updated_at: 2,
    },
  })
  const model = makeModel({
    model_config_id: 'model-id',
    model: {
      id: 'model-id',
      name: '推理模型A',
      provider: 'openai',
      api_key: 'x',
      api_url: 'http://localhost',
      model_id: 'model-a',
      created_at: 1,
      updated_at: 2,
    },
  })

  assert.equal(getTaskPromptOptionLabel(prompt), '阅读理解基线 (v1.2)')
  assert.equal(getTaskModelOptionLabel(model), '推理模型A')
})

test('sortRunsForDetail keeps baseline first and sorts other prompts by version', () => {
  const taskPrompts = [
    makePrompt({
      id: 'tp-baseline',
      is_baseline: true,
      prompt: { id: 'p1', name: '阅读理解', version: 'v1.0', content: '', created_at: 1, updated_at: 10 },
    }),
    makePrompt({
      id: 'tp-v2',
      prompt: { id: 'p2', name: '阅读理解', version: 'v2.0', content: '', created_at: 1, updated_at: 30 },
    }),
    makePrompt({
      id: 'tp-v1-1',
      prompt: { id: 'p3', name: '阅读理解', version: 'v1.1', content: '', created_at: 1, updated_at: 20 },
    }),
  ]

  const sorted = sortRunsForDetail([
    makeRun({ id: 'run-v2', task_prompt_id: 'tp-v2', prompt_label: '阅读理解 (v2.0)' }),
    makeRun({ id: 'run-baseline', task_prompt_id: 'tp-baseline', prompt_is_baseline: true, prompt_label: '阅读理解 (v1.0)' }),
    makeRun({ id: 'run-v1-1', task_prompt_id: 'tp-v1-1', prompt_label: '阅读理解 (v1.1)' }),
  ], taskPrompts)

  assert.deepEqual(sorted.map(run => run.id), ['run-baseline', 'run-v1-1', 'run-v2'])
})

test('sortValidationResults follows checkpoint order from the task definition', () => {
  const checkpoints = [
    makeCheckpoint({ id: 'cp-summary', name: '概括主旨', order_index: 0 }),
    makeCheckpoint({ id: 'cp-fact', name: '事实定位', order_index: 1 }),
    makeCheckpoint({ id: 'cp-reason', name: '因果推断', order_index: 2 }),
  ]

  const sorted = sortValidationResults([
    makeValidationResult({ id: 'vr-2', checkpoint_id: 'cp-fact', checkpoint_name: '事实定位' }),
    makeValidationResult({ id: 'vr-3', checkpoint_id: 'cp-reason', checkpoint_name: '因果推断' }),
    makeValidationResult({ id: 'vr-1', checkpoint_id: 'cp-summary', checkpoint_name: '概括主旨' }),
  ], checkpoints)

  assert.deepEqual(sorted.map(result => result.id), ['vr-1', 'vr-2', 'vr-3'])
})
