import type { AssessmentMode, EvalType } from '../../types'

export interface TaskStageModelSelection {
  evalType: EvalType
  inferenceModelIds: string[]
  validationModelId?: string
  assessmentMode: AssessmentMode
  assessmentModelId?: string
}

export function validateStageModelSelection(selection: TaskStageModelSelection): string[] {
  const errors: string[] = []

  if (selection.evalType === 'prompt_comparison' && selection.inferenceModelIds.length !== 1) {
    errors.push('Prompt对比模式需选择恰好1个推理模型')
  }

  if (selection.evalType === 'model_comparison' && selection.inferenceModelIds.length < 2) {
    errors.push('模型对比模式需选择至少2个推理模型')
  }

  if (!selection.validationModelId) {
    errors.push('请选择校验阶段模型')
  }

  if (!selection.assessmentModelId) {
    errors.push(selection.assessmentMode === 'auto' ? '自动评估模式下必须选择评估阶段模型' : '请选择评估阶段模型')
  }

  return errors
}
