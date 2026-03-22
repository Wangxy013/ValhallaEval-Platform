import { Tag } from 'antd'
import type { EvalType } from '../types'

const evalTypeConfig: Record<EvalType, { color: string; label: string }> = {
  prompt_comparison: { color: 'purple', label: 'Prompt对比' },
  model_comparison: { color: 'cyan', label: '模型对比' },
}

interface EvalTypeTagProps {
  evalType: EvalType;
}

export default function EvalTypeTag({ evalType }: EvalTypeTagProps) {
  const config = evalTypeConfig[evalType] ?? { color: 'default', label: evalType }
  return <Tag color={config.color}>{config.label}</Tag>
}
