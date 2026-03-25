import type { EvalRun, TaskModel, TaskPrompt, ValidationCheckpoint, ValidationResult } from '../../types'

export function getTaskPromptOptionLabel(prompt: TaskPrompt): string {
  if (prompt.label) return prompt.label
  if (prompt.prompt?.name && prompt.prompt.version) return `${prompt.prompt.name} (${prompt.prompt.version})`
  return prompt.prompt?.name ?? prompt.prompt_id
}

export function getTaskModelOptionLabel(model: TaskModel): string {
  return model.label ?? model.model?.name ?? model.model_config_id
}

function compareVersionStrings(left?: string, right?: string): number {
  if (!left && !right) return 0
  if (!left) return 1
  if (!right) return -1
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
}

export function sortRunsForDetail(runs: EvalRun[], taskPrompts: TaskPrompt[] = [], taskModels: TaskModel[] = []): EvalRun[] {
  const promptMeta = new Map(taskPrompts.map((prompt, index) => [prompt.id, { prompt, index }]))
  const modelMeta = new Map(taskModels.map((model, index) => [model.id, { model, index }]))

  return [...runs].sort((a, b) => {
    if (a.prompt_is_baseline && !b.prompt_is_baseline) return -1
    if (!a.prompt_is_baseline && b.prompt_is_baseline) return 1

    const leftPrompt = a.task_prompt_id ? promptMeta.get(a.task_prompt_id)?.prompt : undefined
    const rightPrompt = b.task_prompt_id ? promptMeta.get(b.task_prompt_id)?.prompt : undefined
    const versionCompare = compareVersionStrings(leftPrompt?.prompt?.version, rightPrompt?.prompt?.version)
    if (versionCompare !== 0) return versionCompare

    const leftUpdatedAt = leftPrompt?.prompt?.updated_at ?? Number.MAX_SAFE_INTEGER
    const rightUpdatedAt = rightPrompt?.prompt?.updated_at ?? Number.MAX_SAFE_INTEGER
    if (leftUpdatedAt !== rightUpdatedAt) return leftUpdatedAt - rightUpdatedAt

    const leftPromptOrder = a.task_prompt_id ? promptMeta.get(a.task_prompt_id)?.index : undefined
    const rightPromptOrder = b.task_prompt_id ? promptMeta.get(b.task_prompt_id)?.index : undefined
    if (leftPromptOrder != null && rightPromptOrder != null && leftPromptOrder !== rightPromptOrder) {
      return leftPromptOrder - rightPromptOrder
    }

    const leftModelOrder = modelMeta.get(a.task_model_id)?.index
    const rightModelOrder = modelMeta.get(b.task_model_id)?.index
    if (leftModelOrder != null && rightModelOrder != null && leftModelOrder !== rightModelOrder) {
      return leftModelOrder - rightModelOrder
    }

    const leftLabel = a.prompt_label ?? a.model_label ?? a.id
    const rightLabel = b.prompt_label ?? b.model_label ?? b.id
    const labelCompare = leftLabel.localeCompare(rightLabel, undefined, { numeric: true, sensitivity: 'base' })
    if (labelCompare !== 0) return labelCompare

    if (a.repeat_index !== b.repeat_index) return a.repeat_index - b.repeat_index
    return a.created_at - b.created_at
  })
}

export function sortValidationResults(
  results: ValidationResult[],
  checkpoints: ValidationCheckpoint[] = []
): ValidationResult[] {
  const checkpointOrder = new Map(checkpoints.map((checkpoint, index) => [checkpoint.id, checkpoint.order_index ?? index]))

  return [...results].sort((a, b) => {
    const leftOrder = checkpointOrder.get(a.checkpoint_id) ?? Number.MAX_SAFE_INTEGER
    const rightOrder = checkpointOrder.get(b.checkpoint_id) ?? Number.MAX_SAFE_INTEGER
    if (leftOrder !== rightOrder) return leftOrder - rightOrder
    return a.created_at - b.created_at
  })
}
