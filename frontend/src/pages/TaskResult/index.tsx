import { useState, useMemo, useEffect } from 'react'
import {
  Tabs, Card, Button, Space, Table, Typography, Row, Col, Statistic,
  message, Tag, Select, Descriptions, Divider, Progress, Collapse, Alert, Tooltip, Empty, Steps,
} from 'antd'
import type { ColumnType } from 'antd/es/table'
import {
  PlayCircleOutlined, PauseCircleOutlined, CheckCircleOutlined,
  RobotOutlined, CaretRightOutlined, ArrowUpOutlined, ArrowDownOutlined,
  QuestionCircleOutlined, LoadingOutlined, SyncOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  getTask, getTaskResults, listEvalRuns, listCheckpoints, getTaskProgress,
  executeTask, pauseTask, resumeTask, validateRuns, autoAssessRuns,
} from '../../api/tasks'
import type { EvalRun, RunStatus, InputMessage, CheckpointGroupStat, TaskProgress } from '../../types'
import { TaskStatusTag, RunStatusTag } from '../../components/StatusTag'
import EvalTypeTag from '../../components/EvalTypeTag'
import ValidationAnnotations from '../../components/ValidationAnnotations'
import CompareModal from './CompareModal'

const { Text } = Typography

// ── CheckpointDiffSummary: shows improved / regressed checkpoints per test item ─
interface DiffEntry {
  cp_id: string
  cp_name: string
  runs: Array<{ group: string; result?: 'pass' | 'fail' | 'partial' }>
  allPass: boolean
  allFail: boolean
  changed: boolean
}

function CheckpointDiffSummary({ runs }: { runs: EvalRun[] }) {
  if (runs.length < 2) return null

  const allVrByRun = runs.map(r => r.validation_results ?? [])
  const anyValidated = allVrByRun.some(vrs => vrs.length > 0)
  if (!anyValidated) return null

  // Collect unique checkpoints (union of all runs' validation results)
  const cpIndex = new Map<string, { name: string; order: number }>()
  allVrByRun.forEach(vrs =>
    vrs.forEach(vr => {
      if (!cpIndex.has(vr.checkpoint_id)) {
        cpIndex.set(vr.checkpoint_id, { name: vr.checkpoint_name ?? vr.checkpoint_id.slice(0, 6), order: cpIndex.size })
      }
    })
  )

  const diffs: DiffEntry[] = [...cpIndex.entries()].map(([cpId, meta]) => {
    const runResults = runs.map(run => {
      const vr = run.validation_results?.find(v => v.checkpoint_id === cpId)
      return {
        group: run.prompt_label ?? run.model_label ?? `版本${runs.indexOf(run) + 1}`,
        result: vr?.result,
      }
    })
    const results = runResults.map(r => r.result).filter(Boolean)
    const unique = new Set(results)
    return {
      cp_id: cpId,
      cp_name: meta.name,
      runs: runResults,
      allPass: results.length > 0 && results.every(r => r === 'pass'),
      allFail: results.length > 0 && results.every(r => r === 'fail'),
      changed: unique.size > 1,
    }
  })

  const changedAll = diffs.filter(d => d.changed)
  const unchanged = diffs.filter(d => !d.changed)

  if (changedAll.length === 0) {
    const allPass = unchanged.every(d => d.allPass)
    const allFail = unchanged.every(d => d.allFail)
    return (
      <Alert
        style={{ marginTop: 8 }}
        type={allPass ? 'success' : allFail ? 'error' : 'info'}
        message={allPass ? '所有验证点两版本均通过' : allFail ? '所有验证点两版本均未通过' : '所有验证点结果一致，无差异'}
        showIcon
      />
    )
  }

  const resultLabel = (r?: string) => r === 'pass' ? '通过' : r === 'fail' ? '未通过' : '-'

  return (
    <Card size="small" style={{ marginTop: 10, background: '#f6f8fa', border: '1px solid #e8ecf0' }}>
      <Text strong style={{ fontSize: 13 }}>对比差异</Text>
      <div style={{ marginTop: 8 }}>
        {changedAll.map(d => {
          const hasImproved = d.runs.some(r => r.result === 'pass')
          const hasRegressed = d.runs.some(r => r.result === 'fail')
          const type = hasImproved && !hasRegressed ? 'improved' : hasRegressed && !hasImproved ? 'regressed' : 'mixed'
          return (
            <div key={d.cp_id} style={{ marginBottom: 8 }}>
              <Space size={6} wrap>
                {type === 'improved' && <Tag color="green" icon={<ArrowUpOutlined />}>改善</Tag>}
                {type === 'regressed' && <Tag color="red" icon={<ArrowDownOutlined />}>退步</Tag>}
                {type === 'mixed' && <Tag color="orange">变化</Tag>}
                <Text strong style={{ fontSize: 12 }}>{d.cp_name}</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {d.runs.map(r => `${r.group}: ${resultLabel(r.result)}`).join(' → ')}
                </Text>
              </Space>
            </div>
          )
        })}
        {unchanged.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              一致：{unchanged.map(d => `${d.cp_name}(${d.allPass ? '均通过' : d.allFail ? '均未通过' : '-'})`).join('、')}
            </Text>
          </div>
        )}
      </div>
    </Card>
  )
}

// ── RunCard: one model-output card inside the grouped expansion ───────────────
function RunCard({ run }: { run: EvalRun }) {
  const annotations = (run.validation_results ?? []).flatMap(vr => vr.annotations ?? [])
  const inputMessages: InputMessage[] = typeof run.input_messages === 'string'
    ? (() => { try { return JSON.parse(run.input_messages as unknown as string) } catch { return [] } })()
    : (run.input_messages ?? [])

  const modeBadge = (mode: string) => {
    if (mode === 'manual') return { label: '人工', color: 'orange' }
    if (mode === 'auto') return { label: '自动', color: 'cyan' }
    return { label: '自定义', color: 'geekblue' }
  }

  return (
    <Card
      size="small"
      style={{ height: '100%' }}
      title={
        <Space wrap size={4}>
          {run.prompt_label && <Tag color="blue" style={{ marginRight: 0 }}>{run.prompt_label}</Tag>}
          {run.model_label && <Tag color="purple" style={{ marginRight: 0 }}>{run.model_label}</Tag>}
          {run.repeat_index > 0 && <Tag style={{ marginRight: 0 }}>第{run.repeat_index + 1}次</Tag>}
          <RunStatusTag status={run.status} />
          {run.duration_ms != null && (
            <Text type="secondary" style={{ fontSize: 11 }}>{run.duration_ms}ms</Text>
          )}
        </Space>
      }
    >
      {/* Input (collapsible) */}
      {inputMessages.length > 0 && (
        <Collapse size="small" ghost style={{ marginBottom: 8 }} items={[{
          key: 'in',
          label: <Text type="secondary" style={{ fontSize: 12 }}>输入消息</Text>,
          children: (
            <div style={{ background: '#fafafa', borderRadius: 4, padding: 8 }}>
              {inputMessages.map((msg, i) => (
                <div key={i} style={{ marginBottom: 4 }}>
                  <Tag color={msg.role === 'system' ? 'purple' : msg.role === 'user' ? 'blue' : 'green'}>{msg.role}</Tag>
                  <Text style={{ fontSize: 11, whiteSpace: 'pre-wrap' }}>{msg.content}</Text>
                </div>
              ))}
            </div>
          ),
        }]} />
      )}

      {/* Output */}
      <div style={{ marginBottom: 8 }}>
        <Text type="secondary" style={{ fontSize: 11 }}>模型输出</Text>
        <div style={{ background: '#fafafa', borderRadius: 4, padding: 8, marginTop: 4, maxHeight: 220, overflow: 'auto' }}>
          {run.output_content ? (
            annotations.length > 0
              ? <ValidationAnnotations outputContent={run.output_content} annotations={annotations} />
              : <Text style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{run.output_content}</Text>
          ) : run.error_message ? (
            <Text type="danger" style={{ fontSize: 12 }}>{run.error_message}</Text>
          ) : (
            <Text type="secondary" style={{ fontSize: 12 }}>暂无输出</Text>
          )}
        </div>
      </div>

      {/* Validation results — checkpoint name + criterion + result + LLM comment */}
      {run.validation_results && run.validation_results.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <Divider style={{ margin: '6px 0' }} />
          <Text type="secondary" style={{ fontSize: 11 }}>校验结果</Text>
          <div style={{ marginTop: 4 }}>
            {run.validation_results.map((vr, i) => (
              <div key={i} style={{
                marginBottom: 8,
                padding: '6px 8px',
                borderRadius: 4,
                background: vr.result === 'pass' ? '#f6ffed' : vr.result === 'fail' ? '#fff2f0' : '#fffbe6',
                border: `1px solid ${vr.result === 'pass' ? '#b7eb8f' : vr.result === 'fail' ? '#ffccc7' : '#ffe58f'}`,
              }}>
                <Space size={6} align="start">
                  <Tag
                    color={vr.result === 'pass' ? 'success' : vr.result === 'fail' ? 'error' : 'warning'}
                    style={{ marginRight: 0, marginTop: 1 }}
                  >
                    {vr.result === 'pass' ? '通过' : vr.result === 'fail' ? '未通过' : '待校验'}
                  </Tag>
                  <div>
                    <Text strong style={{ fontSize: 12 }}>{vr.checkpoint_name ?? `验证点 ${i + 1}`}</Text>
                    {vr.checkpoint_criterion && (
                      <div>
                        <Text type="secondary" style={{ fontSize: 10 }}>
                          标准：{vr.checkpoint_criterion.length > 60
                            ? vr.checkpoint_criterion.slice(0, 60) + '…'
                            : vr.checkpoint_criterion}
                        </Text>
                      </div>
                    )}
                    {vr.comment && (
                      <div style={{ marginTop: 2 }}>
                        <Text style={{ fontSize: 11, color: '#444' }}>{vr.comment}</Text>
                      </div>
                    )}
                  </div>
                </Space>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assessment results — show all, with per-checkpoint breakdown if available */}
      {run.assessment_results && run.assessment_results.length > 0 && (
        <div>
          <Divider style={{ margin: '6px 0' }} />
          <Text type="secondary" style={{ fontSize: 11 }}>评估结果</Text>
          {run.assessment_results.map((ar, i) => {
            const { label, color } = modeBadge(ar.mode)
            const cpScores = (ar.details as { checkpoint_scores?: Array<{ name: string; passed: boolean; score?: number; comment?: string }> } | null)?.checkpoint_scores
            return (
              <div key={i} style={{ marginTop: 6 }}>
                <Space size={6} wrap>
                  <Tag color={color} style={{ marginRight: 0 }}>{label}</Tag>
                  {ar.score != null && (
                    <Text strong style={{ fontSize: 14 }}>
                      {ar.score.toFixed(1)}<Text type="secondary" style={{ fontSize: 11 }}>/10</Text>
                    </Text>
                  )}
                </Space>
                {ar.comment && (
                  <div style={{ marginTop: 2 }}>
                    <Text style={{ fontSize: 12, color: '#444' }}>{ar.comment}</Text>
                  </div>
                )}
                {/* Per-checkpoint scores from checkpoint-aware auto-assessment */}
                {cpScores && cpScores.length > 0 && (
                  <div style={{ marginTop: 4, paddingLeft: 8 }}>
                    {cpScores.map((cs, j) => (
                      <div key={j} style={{ marginBottom: 3 }}>
                        <Space size={4}>
                          <Tag
                            color={cs.passed ? 'success' : 'error'}
                            style={{ fontSize: 10, padding: '0 4px', marginRight: 0 }}
                          >
                            {cs.passed ? '通过' : '未通过'}
                          </Tag>
                          <Text style={{ fontSize: 11 }}>{cs.name}</Text>
                          {cs.score != null && (
                            <Text type="secondary" style={{ fontSize: 10 }}>({cs.score}/10)</Text>
                          )}
                        </Space>
                        {cs.comment && (
                          <div style={{ paddingLeft: 44, marginTop: 1 }}>
                            <Text style={{ fontSize: 10, color: '#888' }}>{cs.comment}</Text>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// ── WorkflowProgress: 3-step progress panel ──────────────────────────────────
interface WorkflowProgressProps {
  task: { status: string }
  overview: { total_runs: number; completed_runs: number; failed_runs: number }
  progress: TaskProgress
  checkpointCount: number
}

function WorkflowProgress({ task, overview, progress, checkpointCount }: WorkflowProgressProps) {
  const { inference, validation, assessment } = progress

  // Step statuses
  const inferenceStatus = task.status === 'completed'
    ? 'finish'
    : task.status === 'running'
      ? 'process'
      : task.status === 'paused' ? 'wait' : 'finish'

  const hasCheckpoints = checkpointCount > 0
  const validationRunning = validation.pending > 0
  const validationDone = validation.done > 0 && validation.pending === 0
  const validationPct = validation.expected > 0
    ? Math.round((validation.done / validation.expected) * 100)
    : 0
  const validationStatus = !hasCheckpoints
    ? 'wait'
    : validationRunning
      ? 'process'
      : validationDone
        ? 'finish'
        : 'wait'

  const assessmentRunning = assessment.done > 0 && assessment.done < assessment.expected
  const assessmentDone = assessment.expected > 0 && assessment.done >= assessment.expected
  const assessmentPct = assessment.expected > 0
    ? Math.round((assessment.done / assessment.expected) * 100)
    : 0
  const assessmentStatus = assessmentRunning ? 'process' : assessmentDone ? 'finish' : 'wait'

  // Determine which step is current (0-indexed)
  const current =
    inferenceStatus !== 'finish' ? 0
    : validationStatus === 'finish' && assessmentStatus !== 'finish' ? 2
    : validationStatus === 'finish' && assessmentStatus === 'finish' ? 3
    : validationStatus === 'process' ? 1
    : 1

  const isPolling = validationRunning || assessmentRunning

  return (
    <Card
      style={{ marginBottom: 16 }}
      styles={{ body: { padding: '16px 24px' } }}
      title={
        <Space size={8}>
          <Text strong>执行进度</Text>
          {isPolling && (
            <Tag icon={<SyncOutlined spin />} color="processing" style={{ marginRight: 0 }}>
              更新中
            </Tag>
          )}
        </Space>
      }
    >
      <Steps
        current={current}
        size="small"
        items={[
          {
            title: '推理执行',
            status: inferenceStatus as 'finish' | 'process' | 'wait' | 'error',
            description: (
              <div style={{ minWidth: 140 }}>
                {task.status === 'running' ? (
                  <>
                    <div>
                      <Progress
                        percent={overview.total_runs > 0 ? Math.round((inference.completed / inference.total) * 100) : 0}
                        size="small"
                        strokeColor="#1677ff"
                        style={{ margin: 0 }}
                      />
                    </div>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {inference.completed} / {inference.total} 条完成
                    </Text>
                  </>
                ) : task.status === 'completed' ? (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {overview.completed_runs} 条全部完成
                    {overview.failed_runs > 0 && (
                      <Text type="danger" style={{ fontSize: 11 }}> ({overview.failed_runs} 失败)</Text>
                    )}
                  </Text>
                ) : (
                  <Text type="secondary" style={{ fontSize: 11 }}>尚未开始</Text>
                )}
              </div>
            ),
          },
          {
            title: '验证校验',
            status: validationStatus as 'finish' | 'process' | 'wait' | 'error',
            description: (
              <div style={{ minWidth: 160 }}>
                {!hasCheckpoints ? (
                  <Text type="secondary" style={{ fontSize: 11 }}>未配置检查点</Text>
                ) : validationRunning ? (
                  <>
                    <Progress
                      percent={validationPct}
                      size="small"
                      strokeColor="#722ed1"
                      style={{ margin: 0 }}
                    />
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {validation.done} / {validation.expected} 条完成
                      {validation.pending > 0 && (
                        <> · <LoadingOutlined style={{ fontSize: 10 }} /> {validation.pending} 待处理</>
                      )}
                    </Text>
                  </>
                ) : validationDone ? (
                  <Space size={4} style={{ flexWrap: 'wrap' as const }}>
                    <Text style={{ fontSize: 11, color: '#52c41a' }}>✓ {validation.pass} 通过</Text>
                    {validation.fail > 0 && (
                      <Text style={{ fontSize: 11, color: '#ff4d4f' }}>✗ {validation.fail} 未通过</Text>
                    )}
                  </Space>
                ) : (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {checkpointCount} 个检查点，待运行
                  </Text>
                )}
              </div>
            ),
          },
          {
            title: '评估打分',
            status: assessmentStatus as 'finish' | 'process' | 'wait' | 'error',
            description: (
              <div style={{ minWidth: 140 }}>
                {assessmentRunning ? (
                  <>
                    <Progress
                      percent={assessmentPct}
                      size="small"
                      strokeColor="#fa8c16"
                      style={{ margin: 0 }}
                    />
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {assessment.done} / {assessment.expected} 条完成
                    </Text>
                  </>
                ) : assessmentDone ? (
                  <Text style={{ fontSize: 11, color: '#52c41a' }}>✓ {assessment.done} 条已评分</Text>
                ) : (
                  <Text type="secondary" style={{ fontSize: 11 }}>待运行</Text>
                )}
              </div>
            ),
          },
        ]}
      />
    </Card>
  )
}

// ── PivotTable: checkpoint × prompt/model comparison matrix ──────────────────
type PivotCell = { pass_count: number; eval_count: number; pass_rate: number | null }
type PivotRow = { key: string; checkpoint_name: string; criterion: string } & Record<string, PivotCell | string>

function PivotTable({ data, title }: { data: CheckpointGroupStat[]; title: string }) {
  const { groups, rows } = useMemo(() => {
    if (data.length === 0) return { groups: [] as string[], rows: [] as PivotRow[] }

    const groupSet = new Map<string, number>()
    data.forEach(r => { if (!groupSet.has(r.group_label)) groupSet.set(r.group_label, groupSet.size) })
    const groups = [...groupSet.keys()]

    const cpMap = new Map<string, { criterion: string; order: number }>()
    data.forEach(r => { if (!cpMap.has(r.checkpoint_name)) cpMap.set(r.checkpoint_name, { criterion: r.criterion, order: r.order_index }) })
    const checkpoints = [...cpMap.entries()].sort(([, a], [, b]) => a.order - b.order)

    const rows: PivotRow[] = checkpoints.map(([cpName, meta]) => {
      const row: PivotRow = { key: cpName, checkpoint_name: cpName, criterion: meta.criterion }
      for (const g of groups) {
        const cell = data.find(d => d.checkpoint_name === cpName && d.group_label === g)
        row[`_g_${g}`] = cell
          ? { pass_count: cell.pass_count, eval_count: cell.eval_count, pass_rate: cell.pass_rate ?? null }
          : { pass_count: 0, eval_count: 0, pass_rate: null }
      }
      return row
    })

    return { groups, rows }
  }, [data])

  if (groups.length === 0) return null

  const hasAnyData = rows.some(r =>
    groups.some(g => (r[`_g_${g}`] as PivotCell)?.eval_count > 0)
  )
  if (!hasAnyData) return null

  const baseGroup = groups[0]

  const columns: ColumnType<PivotRow>[] = [
    {
      title: '验证点 / 校验标准',
      dataIndex: 'checkpoint_name',
      key: 'cp',
      width: 200,
      render: (name: string, row: PivotRow) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>{name}</Text>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2, lineHeight: 1.4 }}>
            {(row.criterion as string).length > 80
              ? (row.criterion as string).slice(0, 80) + '…'
              : (row.criterion as string)}
          </div>
        </div>
      ),
    },
    ...groups.map((g, idx) => ({
      title: (
        <div>
          <Text strong>{g}</Text>
          {idx > 0 && <div style={{ fontSize: 10, color: '#888' }}>对比 {baseGroup}</div>}
        </div>
      ),
      key: `_g_${g}`,
      width: 200,
      render: (_: unknown, record: PivotRow) => {
        const cell = record[`_g_${g}`] as PivotCell
        if (!cell || cell.eval_count === 0) {
          return <Text type="secondary" style={{ fontSize: 12 }}>未校验</Text>
        }
        const pct = Math.round((cell.pass_rate ?? 0) * 100)
        const color = pct >= 80 ? '#52c41a' : pct >= 50 ? '#faad14' : '#ff4d4f'

        let delta: number | null = null
        if (idx > 0) {
          const base = record[`_g_${baseGroup}`] as PivotCell
          if (base && base.pass_rate != null && cell.pass_rate != null) {
            delta = Math.round((cell.pass_rate - base.pass_rate) * 100)
          }
        }

        return (
          <Space direction="vertical" size={3}>
            <Space size={6}>
              <Progress
                percent={pct}
                size="small"
                style={{ width: 80, margin: 0 }}
                strokeColor={color}
                format={() => ''}
              />
              <Text style={{ color, fontWeight: 600 }}>{pct}%</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                ({cell.pass_count}/{cell.eval_count})
              </Text>
            </Space>
            {delta !== null && (
              <Tag
                color={delta > 0 ? 'success' : delta < 0 ? 'error' : 'default'}
                style={{ fontSize: 11, marginTop: 0 }}
                icon={delta > 0 ? <ArrowUpOutlined /> : delta < 0 ? <ArrowDownOutlined /> : undefined}
              >
                {delta > 0 ? `+${delta}%` : delta < 0 ? `${delta}%` : '持平'}
              </Tag>
            )}
          </Space>
        )
      },
    } as ColumnType<PivotRow>)),
  ]

  return (
    <Card title={title} style={{ marginBottom: 16 }}>
      <Table<PivotRow>
        rowKey="key"
        dataSource={rows}
        columns={columns}
        size="small"
        pagination={false}
        scroll={{ x: 'max-content' }}
      />
    </Card>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function TaskResultPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const taskId = id!

  const [filterPrompt, setFilterPrompt] = useState<string | undefined>()
  const [filterModel, setFilterModel] = useState<string | undefined>()
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([])
  const [compareOpen, setCompareOpen] = useState(false)

  const { data: task, isLoading: taskLoading } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => getTask(taskId),
    refetchInterval: (q) => q.state.data?.status === 'running' ? 3000 : false,
  })

  const { data: overview } = useQuery({
    queryKey: ['task-results', taskId],
    queryFn: () => getTaskResults(taskId),
    refetchInterval: task?.status === 'running' ? 3000 : false,
  })

  const { data: runs = [], isLoading: runsLoading } = useQuery({
    queryKey: ['eval-runs', taskId],
    queryFn: () => listEvalRuns(taskId),
    refetchInterval: task?.status === 'running' ? 3000 : false,
  })

  const { data: checkpoints = [] } = useQuery({
    queryKey: ['checkpoints', taskId],
    queryFn: () => listCheckpoints(taskId),
  })

  // Progress polling — determines whether validation/assessment is in-flight
  const [progressPolling, setProgressPolling] = useState(false)
  const { data: progress, dataUpdatedAt: progressUpdatedAt } = useQuery({
    queryKey: ['task-progress', taskId],
    queryFn: () => getTaskProgress(taskId),
    refetchInterval: progressPolling ? 2000 : false,
  })

  // Auto-detect in-flight work on mount and data refresh
  useEffect(() => {
    if (!progress) return
    const validationRunning = progress.validation.pending > 0
    const assessmentRunning =
      progress.assessment.expected > 0 &&
      progress.assessment.done > 0 &&
      progress.assessment.done < progress.assessment.expected
    const inferenceRunning = task?.status === 'running' || task?.status === 'paused'
    setProgressPolling(validationRunning || assessmentRunning || !!inferenceRunning)
  }, [progress, task?.status])

  // When polling detects completion, refresh main data
  const prevProgressRef = { val: progress }
  useEffect(() => {
    if (!progress) return
    // Validation just finished (had pending, now 0)
    if (prevProgressRef.val?.validation.pending === 0 && progress.validation.pending === 0) return
    if (progress.validation.pending === 0 && progress.validation.done > 0) {
      invalidate()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressUpdatedAt])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['task', taskId] })
    queryClient.invalidateQueries({ queryKey: ['task-results', taskId] })
    queryClient.invalidateQueries({ queryKey: ['eval-runs', taskId] })
    queryClient.invalidateQueries({ queryKey: ['task-progress', taskId] })
  }

  const executeMutation = useMutation({ mutationFn: () => executeTask(taskId), onSuccess: () => { message.success('任务已开始执行'); setProgressPolling(true); invalidate() } })
  const pauseMutation = useMutation({ mutationFn: () => pauseTask(taskId), onSuccess: () => { message.success('任务已暂停'); invalidate() } })
  const resumeMutation = useMutation({ mutationFn: () => resumeTask(taskId), onSuccess: () => { message.success('任务已恢复'); setProgressPolling(true); invalidate() } })
  const validateMutation = useMutation({ mutationFn: () => validateRuns(taskId), onSuccess: () => { message.success('校验任务已启动'); setProgressPolling(true); invalidate() } })
  const assessMutation = useMutation({ mutationFn: () => autoAssessRuns(taskId), onSuccess: () => { message.success('自动评估已启动'); setProgressPolling(true); invalidate() } })

  // Client-side filter (backend ignores query params)
  const filteredRuns = useMemo(() => {
    if (!filterPrompt && !filterModel) return runs
    return runs.filter(run => {
      if (filterPrompt) {
        const tp = task?.prompts?.find(p => p.prompt_id === filterPrompt)
        if (!tp || run.task_prompt_id !== tp.id) return false
      }
      if (filterModel) {
        const tm = task?.models?.find(m => m.model_config_id === filterModel)
        if (!tm || run.task_model_id !== tm.id) return false
      }
      return true
    })
  }, [runs, filterPrompt, filterModel, task])

  // Group by test item for the detail comparison view
  const groupedItems = useMemo(() => {
    const map = new Map<string, { test_item_id: string; content: string; runs: EvalRun[]; completed: number }>()
    for (const run of filteredRuns) {
      const key = run.task_test_item_id
      if (!map.has(key)) map.set(key, { test_item_id: key, content: run.test_item_content ?? key, runs: [], completed: 0 })
      const g = map.get(key)!
      g.runs.push(run)
      if (run.status === 'completed') g.completed++
    }
    return Array.from(map.values())
  }, [filteredRuns])

  const selectedRuns = runs.filter(r => selectedRunIds.includes(r.id))

  const promptOptions = task?.prompts?.map(tp => ({
    label: tp.label ?? tp.prompt?.name ?? tp.prompt_id,
    value: tp.prompt_id,
  })) ?? []
  const modelOptions = task?.models?.map(tm => ({
    label: tm.label ?? tm.model?.name ?? tm.model_config_id,
    value: tm.model_config_id,
  })) ?? []

  const hasMultipleVariants = (task?.prompts?.length ?? 0) > 1 || (task?.models?.length ?? 0) > 1

  // ── Overview tab ─────────────────────────────────────────────────────────────
  const overviewTab = (
    <div>
      {task && (
        <Card style={{ marginBottom: 16 }}>
          <Descriptions column={{ xs: 1, sm: 2, md: 3 }}>
            <Descriptions.Item label="任务名称">{task.name}</Descriptions.Item>
            <Descriptions.Item label="评测类型"><EvalTypeTag evalType={task.eval_type} /></Descriptions.Item>
            <Descriptions.Item label="状态"><TaskStatusTag status={task.status} showBadge /></Descriptions.Item>
            {task.description && <Descriptions.Item label="描述" span={3}>{task.description}</Descriptions.Item>}
            <Descriptions.Item label="创建时间">{dayjs(task.created_at * 1000).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
            {task.started_at && <Descriptions.Item label="开始时间">{dayjs(task.started_at * 1000).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>}
            {task.completed_at && <Descriptions.Item label="完成时间">{dayjs(task.completed_at * 1000).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>}
            <Descriptions.Item label="执行并发数">
              <Tooltip title="推理执行、验证校验、自动评估三个阶段均以此并发数同时发起 LLM 请求">
                <Tag color="blue">{task.concurrency ?? 3} 个并发</Tag>
              </Tooltip>
            </Descriptions.Item>
          </Descriptions>

          {/* Configured validation checkpoints — shown so users know what will be validated */}
          {checkpoints.length > 0 && (
            <>
              <Divider style={{ margin: '8px 0' }} />
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  校验检查点（{checkpoints.length} 个）
                  <Tooltip title="执行【运行校验】后，系统将调用大模型逐条判断推理结果是否符合以下每个标准">
                    <QuestionCircleOutlined style={{ marginLeft: 4, cursor: 'help' }} />
                  </Tooltip>
                </Text>
                <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {checkpoints.map((cp, i) => (
                    <Tooltip key={cp.id} title={cp.criterion} placement="bottom">
                      <Tag color="geekblue" style={{ cursor: 'help', marginRight: 0 }}>
                        {i + 1}. {cp.name}
                      </Tag>
                    </Tooltip>
                  ))}
                </div>
              </div>
            </>
          )}
          {checkpoints.length === 0 && (task.status === 'completed' || task.status === 'paused') && (
            <>
              <Divider style={{ margin: '8px 0' }} />
              <Alert
                type="warning"
                showIcon
                message="未配置校验检查点"
                description="该任务没有设置校验检查点，无法运行校验功能。需要在新建任务第 5 步配置【检查点】（校验标准），执行完成后才能自动校验每条输出是否符合标准。"
                style={{ marginBottom: 0 }}
              />
            </>
          )}

          <Divider style={{ margin: '12px 0' }} />
          <Space wrap>
            {(task.status === 'draft' || task.status === 'failed') && (
              <Button type="primary" icon={<PlayCircleOutlined />} loading={executeMutation.isPending} onClick={() => executeMutation.mutate()}>开始执行</Button>
            )}
            {task.status === 'running' && (
              <Button icon={<PauseCircleOutlined />} loading={pauseMutation.isPending} onClick={() => pauseMutation.mutate()}>暂停</Button>
            )}
            {task.status === 'paused' && (
              <Button type="primary" icon={<CaretRightOutlined />} loading={resumeMutation.isPending} onClick={() => resumeMutation.mutate()}>继续执行</Button>
            )}
            {(task.status === 'completed' || task.status === 'paused') && (
              <>
                <Tooltip title={
                  checkpoints.length === 0
                    ? '该任务未配置校验检查点，无法运行校验'
                    : `调用大模型逐条检查推理结果是否满足 ${checkpoints.length} 个校验标准，输出通过/未通过判断`
                }>
                  <Button
                    icon={<CheckCircleOutlined />}
                    loading={validateMutation.isPending}
                    disabled={checkpoints.length === 0}
                    onClick={() => validateMutation.mutate()}
                  >
                    运行校验
                    {checkpoints.length === 0 && <Text type="danger" style={{ marginLeft: 4, fontSize: 11 }}>（未配置检查点）</Text>}
                  </Button>
                </Tooltip>
                <Tooltip title="使用大模型对推理结果进行 0-10 分的综合评分，若已配置校验点则按验证标准逐项评价">
                  <Button icon={<RobotOutlined />} loading={assessMutation.isPending} onClick={() => assessMutation.mutate()}>自动评估</Button>
                </Tooltip>
              </>
            )}
          </Space>
        </Card>
      )}

      {overview && (
        <>
          {/* ── Workflow progress steps ───────────────────────────── */}
          {(task?.status === 'completed' || task?.status === 'paused' || task?.status === 'running') && progress && (
            <WorkflowProgress task={task} overview={overview} progress={progress} checkpointCount={checkpoints.length} />
          )}

          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col xs={12} sm={6}><Card><Statistic title="总运行数" value={overview.total_runs} /></Card></Col>
            <Col xs={12} sm={6}>
              <Card><Statistic title="已完成" value={overview.completed_runs} valueStyle={{ color: '#3f8600' }} /></Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card>
                <Statistic
                  title={
                    <Space size={4}>
                      整体通过率
                      {overview.validation_pass_rate == null && (
                        <Tooltip title={checkpoints.length === 0 ? '该任务未配置校验检查点' : '尚未运行校验。推理完成后点击【运行校验】按钮'}>
                          <QuestionCircleOutlined style={{ color: '#bbb', fontSize: 12 }} />
                        </Tooltip>
                      )}
                    </Space>
                  }
                  value={overview.validation_pass_rate != null ? `${(overview.validation_pass_rate * 100).toFixed(1)}%` : '-'}
                  valueStyle={{ color: overview.validation_pass_rate != null ? (overview.validation_pass_rate >= 0.8 ? '#3f8600' : overview.validation_pass_rate >= 0.5 ? '#d46b08' : '#cf1322') : '#bbb' }}
                />
                {overview.validation_pass_rate == null && (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {checkpoints.length === 0 ? '未配置校验检查点' : '推理后点击【运行校验】'}
                  </Text>
                )}
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card>
                <Statistic
                  title={
                    <Space size={4}>
                      平均评分
                      {overview.avg_assessment_score == null && (
                        <Tooltip title="推理完成后点击【自动评估】，由大模型对每条输出进行 0-10 分综合评分">
                          <QuestionCircleOutlined style={{ color: '#bbb', fontSize: 12 }} />
                        </Tooltip>
                      )}
                    </Space>
                  }
                  value={overview.avg_assessment_score != null ? overview.avg_assessment_score.toFixed(1) : '-'}
                  suffix={overview.avg_assessment_score != null ? '/10' : ''}
                  valueStyle={{ color: overview.avg_assessment_score == null ? '#bbb' : undefined }}
                />
                {overview.avg_assessment_score == null && (
                  <Text type="secondary" style={{ fontSize: 11 }}>推理后点击【自动评估】</Text>
                )}
              </Card>
            </Col>
          </Row>

          {/* ★ Core: Checkpoint × Prompt/Model comparison pivot */}
          {task?.eval_type === 'prompt_comparison' && overview.by_checkpoint_prompt?.length > 0 && (
            <PivotTable
              data={overview.by_checkpoint_prompt}
              title="验证点对比（Prompt 版本横向比较）"
            />
          )}
          {task?.eval_type === 'model_comparison' && overview.by_checkpoint_model?.length > 0 && (
            <PivotTable
              data={overview.by_checkpoint_model}
              title="验证点对比（模型横向比较）"
            />
          )}

          {/* Prompt/model summary tables */}
          {overview.by_prompt?.length > 1 && (
            <Card title="Prompt 汇总" style={{ marginBottom: 16 }}>
              <Table
                rowKey="label"
                dataSource={overview.by_prompt}
                size="small"
                pagination={false}
                columns={[
                  { title: '名称', dataIndex: 'label', key: 'label' },
                  { title: '总数', dataIndex: 'total', key: 'total', width: 70 },
                  { title: '完成', dataIndex: 'completed', key: 'completed', width: 70 },
                  { title: '通过率', dataIndex: 'pass_rate', key: 'pr', width: 80, render: (v?: number) => v != null ? `${(v * 100).toFixed(1)}%` : <Text type="secondary">-</Text> },
                  { title: '平均分', dataIndex: 'avg_score', key: 'as', width: 80, render: (v?: number) => v != null ? v.toFixed(1) : <Text type="secondary">-</Text> },
                ]}
              />
            </Card>
          )}
          {overview.by_model?.length > 1 && (
            <Card title="模型汇总">
              <Table
                rowKey="label"
                dataSource={overview.by_model}
                size="small"
                pagination={false}
                columns={[
                  { title: '名称', dataIndex: 'label', key: 'label' },
                  { title: '总数', dataIndex: 'total', key: 'total', width: 70 },
                  { title: '完成', dataIndex: 'completed', key: 'completed', width: 70 },
                  { title: '通过率', dataIndex: 'pass_rate', key: 'pr', width: 80, render: (v?: number) => v != null ? `${(v * 100).toFixed(1)}%` : <Text type="secondary">-</Text> },
                  { title: '平均分', dataIndex: 'avg_score', key: 'as', width: 80, render: (v?: number) => v != null ? v.toFixed(1) : <Text type="secondary">-</Text> },
                ]}
              />
            </Card>
          )}

          {/* No validation run yet — show empty state */}
          {checkpoints.length > 0 && overview.validation_pass_rate == null && (task?.status === 'completed' || task?.status === 'paused') && (
            <Card style={{ textAlign: 'center', marginTop: 16 }}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div>
                    <Text>校验尚未运行</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      已配置 {checkpoints.length} 个校验点（{checkpoints.map(c => c.name).join('、')}），
                      点击上方【运行校验】按钮开始自动校验，完成后此处将显示各验证点的对比分析
                    </Text>
                  </div>
                }
              />
            </Card>
          )}
        </>
      )}
    </div>
  )

  // ── Detail tab ───────────────────────────────────────────────────────────────
  const colSpanForRuns = (n: number) => n <= 1 ? 24 : n === 2 ? 12 : n === 3 ? 8 : 6

  const groupedTableColumns: ColumnType<typeof groupedItems[0]>[] = [
    {
      title: '测试数据',
      dataIndex: 'content',
      key: 'content',
      render: (c: string) => <Text ellipsis style={{ maxWidth: 320 }} title={c}>{c}</Text>,
    },
    {
      title: '版本数',
      key: 'rc',
      width: 80,
      render: (_: unknown, rec: typeof groupedItems[0]) => <Tag>{rec.runs.length} 个</Tag>,
    },
    {
      title: '完成状态',
      key: 'st',
      width: 130,
      render: (_: unknown, rec: typeof groupedItems[0]) => {
        const done = rec.completed; const total = rec.runs.length
        if (done === total && total > 0) return <Tag color="green">全部完成</Tag>
        if (done === 0) return <Tag>待执行</Tag>
        return <Tag color="blue">{done}/{total} 完成</Tag>
      },
    },
    {
      title: '校验概况',
      key: 'vsum',
      width: 200,
      render: (_: unknown, rec: typeof groupedItems[0]) => {
        const allVr = rec.runs.flatMap(r => r.validation_results ?? [])
        if (allVr.length === 0) return <Text type="secondary">未校验</Text>
        const pass = allVr.filter(v => v.result === 'pass').length
        const fail = allVr.filter(v => v.result === 'fail').length
        const changed = rec.runs.length >= 2 && (() => {
          const cpIds = new Set(allVr.map(v => v.checkpoint_id))
          return [...cpIds].some(cpId => {
            const results = new Set(rec.runs.map(r => r.validation_results?.find(v => v.checkpoint_id === cpId)?.result).filter(Boolean))
            return results.size > 1
          })
        })()
        return (
          <Space size={4}>
            {pass > 0 && <Tag color="success">{pass} 通过</Tag>}
            {fail > 0 && <Tag color="error">{fail} 未通过</Tag>}
            {changed && <Tag color="processing">有差异</Tag>}
          </Space>
        )
      },
    },
  ]

  const flatRunColumns: ColumnType<EvalRun>[] = [
    { title: '测试数据', dataIndex: 'test_item_content', key: 'tic', render: (c: string) => <Text ellipsis style={{ maxWidth: 180 }}>{c}</Text> },
    { title: 'Prompt', dataIndex: 'prompt_label', key: 'pl', render: (v?: string) => v ? <Tag color="blue">{v}</Tag> : <Text type="secondary">-</Text> },
    { title: '模型', dataIndex: 'model_label', key: 'ml', render: (v?: string) => v ? <Tag color="purple">{v}</Tag> : <Text type="secondary">-</Text> },
    { title: '状态', dataIndex: 'status', key: 'st', width: 90, render: (s: RunStatus) => <RunStatusTag status={s} /> },
    { title: '第几次', dataIndex: 'repeat_index', key: 'ri', width: 70, render: (v: number) => `第 ${v + 1} 次` },
    { title: '用时', dataIndex: 'duration_ms', key: 'dur', width: 90, render: (v: number) => v != null ? `${v}ms` : '-' },
  ]

  const detailTab = (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <span>筛选：</span>
          {promptOptions.length > 0 && (
            <Select placeholder="全部 Prompt" allowClear style={{ width: 180 }} options={promptOptions}
              value={filterPrompt} onChange={v => { setFilterPrompt(v); setSelectedRunIds([]) }} />
          )}
          {modelOptions.length > 0 && (
            <Select placeholder="全部模型" allowClear style={{ width: 180 }} options={modelOptions}
              value={filterModel} onChange={v => { setFilterModel(v); setSelectedRunIds([]) }} />
          )}
          {selectedRunIds.length === 2 && <Button type="primary" onClick={() => setCompareOpen(true)}>对比查看</Button>}
          {selectedRunIds.length > 0 && (
            <>
              <Text type="secondary">已选 {selectedRunIds.length} 条</Text>
              <Button size="small" onClick={() => setSelectedRunIds([])}>清除</Button>
            </>
          )}
        </Space>
      </Card>

      {hasMultipleVariants ? (
        // Grouped by test item — shows side-by-side comparison
        <Table
          rowKey="test_item_id"
          dataSource={groupedItems}
          columns={groupedTableColumns}
          loading={runsLoading}
          pagination={{ pageSize: 20 }}
          expandable={{
            defaultExpandAllRows: groupedItems.length <= 5,
            expandedRowRender: (record) => (
              <div style={{ padding: '8px 0' }}>
                <Row gutter={12} align="stretch">
                  {record.runs.map(run => (
                    <Col key={run.id} span={colSpanForRuns(record.runs.length)} style={{ marginBottom: 8 }}>
                      <RunCard run={run} />
                    </Col>
                  ))}
                </Row>
                {/* Diff summary below the run cards */}
                <CheckpointDiffSummary runs={record.runs} />
              </div>
            ),
          }}
        />
      ) : (
        // Flat view for single-variant tasks
        <Table
          rowKey="id"
          dataSource={filteredRuns}
          columns={flatRunColumns}
          loading={runsLoading}
          rowSelection={{
            selectedRowKeys: selectedRunIds,
            onChange: keys => { if (keys.length <= 2) setSelectedRunIds(keys as string[]) },
            getCheckboxProps: (record: EvalRun) => ({
              disabled: selectedRunIds.length >= 2 && !selectedRunIds.includes(record.id),
            }),
          }}
          expandable={{
            expandedRowRender: (record: EvalRun) => (
              <div style={{ padding: 12 }}><RunCard run={record} /></div>
            ),
          }}
          pagination={{ pageSize: 20 }}
        />
      )}
    </div>
  )

  if (taskLoading) return <Card loading />

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Button type="link" onClick={() => navigate('/tasks')} style={{ padding: 0 }}>
            ← 返回任务列表
          </Button>
        </Col>
      </Row>
      <Tabs items={[
        { key: 'overview', label: '总览', children: overviewTab },
        { key: 'detail', label: '明细', children: detailTab },
      ]} />
      {compareOpen && selectedRuns.length === 2 && (
        <CompareModal open={compareOpen} runs={[selectedRuns[0], selectedRuns[1]]} onClose={() => setCompareOpen(false)} />
      )}
    </div>
  )
}
