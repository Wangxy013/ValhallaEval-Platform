import { Badge, Tag } from 'antd'
import type { TaskStatus, RunStatus } from '../types'

const taskStatusConfig: Record<TaskStatus, { color: string; label: string; status?: 'default' | 'processing' | 'success' | 'error' | 'warning' }> = {
  draft: { color: 'default', label: '草稿', status: 'default' },
  running: { color: 'processing', label: '运行中', status: 'processing' },
  paused: { color: 'warning', label: '已暂停', status: 'warning' },
  completed: { color: 'success', label: '已完成', status: 'success' },
  failed: { color: 'error', label: '失败', status: 'error' },
}

const runStatusConfig: Record<RunStatus, { color: string; label: string }> = {
  pending: { color: 'default', label: '待执行' },
  running: { color: 'blue', label: '执行中' },
  completed: { color: 'green', label: '已完成' },
  failed: { color: 'red', label: '失败' },
}

interface TaskStatusTagProps {
  status: TaskStatus;
  showBadge?: boolean;
}

export function TaskStatusTag({ status, showBadge = false }: TaskStatusTagProps) {
  const config = taskStatusConfig[status] ?? { color: 'default', label: status }
  if (showBadge && config.status) {
    return <Badge status={config.status} text={config.label} />
  }
  return <Tag color={config.color}>{config.label}</Tag>
}

interface RunStatusTagProps {
  status: RunStatus;
}

export function RunStatusTag({ status }: RunStatusTagProps) {
  const config = runStatusConfig[status] ?? { color: 'default', label: status }
  return <Tag color={config.color}>{config.label}</Tag>
}
