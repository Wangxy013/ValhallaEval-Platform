import { useState } from 'react'
import {
  Steps, Card, Button, Form, Input, Radio, Space, Table, Checkbox, InputNumber,
  Select, Typography, Divider, message, Tag, Row, Col, Alert, Tooltip,
} from 'antd'
import { PlusOutlined, DeleteOutlined, QuestionCircleOutlined } from '@ant-design/icons'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { listModels } from '../../api/models'
import { listPrompts } from '../../api/prompts'
import { listDatasets, listTestItems } from '../../api/datasets'
import { createTask } from '../../api/tasks'
import type { ModelConfig, Prompt, TestItem, EvalType, AssessmentMode } from '../../types'
import { validateStageModelSelection } from './helpers'

const { Title, Text } = Typography
const { TextArea } = Input

interface FormState {
  name: string
  description: string
  eval_type: EvalType
  model_config_ids: string[]
  validation_model_id: string
  assessment_model_id: string
  prompt_ids: string[]
  baseline_prompt_id: string   // empty string = auto (first selected)
  dataset_id: string
  test_item_ids: string[]
  repeat_count: number
  concurrency: number
  assessment_mode: AssessmentMode
  custom_rules: string
  checkpoints: Array<{ name: string; criterion: string }>
}

const initialState: FormState = {
  name: '',
  description: '',
  eval_type: 'prompt_comparison',
  model_config_ids: [],
  validation_model_id: '',
  assessment_model_id: '',
  prompt_ids: [],
  baseline_prompt_id: '',
  dataset_id: '',
  test_item_ids: [],
  repeat_count: 1,
  concurrency: 3,
  assessment_mode: 'manual',
  custom_rules: '',
  checkpoints: [],
}

const STEP_TITLES = ['基本信息', '选择模型', '选择Prompt', '测试数据', '校验与评估']

export default function NewTaskPage() {
  const navigate = useNavigate()
  const [current, setCurrent] = useState(0)
  const [form, setForm] = useState<FormState>(initialState)

  const { data: models = [] } = useQuery({ queryKey: ['models'], queryFn: listModels })
  const { data: prompts = [] } = useQuery({ queryKey: ['prompts'], queryFn: listPrompts })
  const { data: datasets = [] } = useQuery({ queryKey: ['datasets'], queryFn: listDatasets })
  const { data: testItems = [] } = useQuery({
    queryKey: ['test-items', form.dataset_id],
    queryFn: () => listTestItems(form.dataset_id),
    enabled: !!form.dataset_id,
  })

  const createMutation = useMutation({
    mutationFn: createTask,
    onSuccess: (task) => {
      message.success('任务创建成功')
      navigate(`/tasks/${task.id}/result`)
    },
  })

  function updateForm(patch: Partial<FormState>) {
    setForm(prev => ({ ...prev, ...patch }))
  }

  function validateStep(): boolean {
    if (current === 0) {
      if (!form.name.trim()) { message.warning('请输入任务名称'); return false }
    }
    if (current === 1) {
      if (form.eval_type === 'prompt_comparison' && form.model_config_ids.length !== 1) {
        message.warning('Prompt对比模式需选择恰好1个模型'); return false
      }
      if (form.eval_type === 'model_comparison' && form.model_config_ids.length < 2) {
        message.warning('模型对比模式需选择至少2个模型'); return false
      }
    }
    if (current === 2) {
      if (form.eval_type === 'prompt_comparison' && form.prompt_ids.length < 2) {
        message.warning('Prompt对比模式需选择至少2个Prompt'); return false
      }
      if (form.eval_type === 'model_comparison' && form.prompt_ids.length !== 1) {
        message.warning('模型对比模式需选择恰好1个Prompt'); return false
      }
    }
    if (current === 3) {
      if (!form.dataset_id) { message.warning('请选择测试数据集'); return false }
      if (form.test_item_ids.length === 0) { message.warning('请至少选择1条测试数据'); return false }
    }
    return true
  }

  function handleNext() {
    if (validateStep()) setCurrent(c => c + 1)
  }

  function handleSubmit() {
    if (!validateStep()) return
    const stageModelErrors = validateStageModelSelection({
      evalType: form.eval_type,
      inferenceModelIds: form.model_config_ids,
      validationModelId: form.validation_model_id || undefined,
      assessmentMode: form.assessment_mode,
      assessmentModelId: form.assessment_model_id || undefined,
    })
    if (stageModelErrors.length > 0) {
      message.warning(stageModelErrors[0])
      return
    }
    createMutation.mutate({
      name: form.name,
      description: form.description,
      eval_type: form.eval_type,
      model_config_ids: form.model_config_ids,
      validation_model_id: form.validation_model_id,
      assessment_model_id: form.assessment_model_id,
      prompt_ids: form.prompt_ids,
      baseline_prompt_id: form.baseline_prompt_id || form.prompt_ids[0] || undefined,
      dataset_id: form.dataset_id,
      test_item_ids: form.test_item_ids,
      repeat_count: form.repeat_count,
      concurrency: form.concurrency,
      assessment_mode: form.assessment_mode,
      assessment_config: form.custom_rules ? { custom_rules: form.custom_rules } : undefined,
      validation_checkpoints: form.checkpoints,
    })
  }

  function addCheckpoint() {
    updateForm({ checkpoints: [...form.checkpoints, { name: '', criterion: '' }] })
  }

  function removeCheckpoint(idx: number) {
    updateForm({ checkpoints: form.checkpoints.filter((_, i) => i !== idx) })
  }

  function updateCheckpoint(idx: number, field: 'name' | 'criterion', value: string) {
    const next = form.checkpoints.map((cp, i) => i === idx ? { ...cp, [field]: value } : cp)
    updateForm({ checkpoints: next })
  }

  // Model columns
  const modelColumns = [
    {
      title: '',
      key: 'select',
      width: 48,
      render: (_: unknown, record: ModelConfig) => (
        <Checkbox
          checked={form.model_config_ids.includes(record.id)}
          onChange={e => {
            if (form.eval_type === 'prompt_comparison') {
              updateForm({ model_config_ids: e.target.checked ? [record.id] : [] })
            } else {
              updateForm({
                model_config_ids: e.target.checked
                  ? [...form.model_config_ids, record.id]
                  : form.model_config_ids.filter(id => id !== record.id)
              })
            }
          }}
        />
      ),
    },
    { title: '模型名称', dataIndex: 'name', key: 'name' },
    {
      title: '提供商',
      dataIndex: 'provider',
      key: 'provider',
      render: (p: string) => <Tag>{p}</Tag>,
    },
    { title: '模型ID', dataIndex: 'model_id', key: 'model_id' },
  ]

  // Prompt columns
  const promptColumns = [
    {
      title: '',
      key: 'select',
      width: 48,
      render: (_: unknown, record: Prompt) => (
        <Checkbox
          checked={form.prompt_ids.includes(record.id)}
          onChange={e => {
            if (form.eval_type === 'model_comparison') {
              updateForm({ prompt_ids: e.target.checked ? [record.id] : [] })
            } else {
              const newIds = e.target.checked
                ? [...form.prompt_ids, record.id]
                : form.prompt_ids.filter(id => id !== record.id)
              // If the deselected prompt was the baseline, clear it
              const newBaseline = (!e.target.checked && form.baseline_prompt_id === record.id)
                ? '' : form.baseline_prompt_id
              updateForm({ prompt_ids: newIds, baseline_prompt_id: newBaseline })
            }
          }}
        />
      ),
    },
    // Baseline radio — only for prompt_comparison and only for selected prompts
    ...(form.eval_type === 'prompt_comparison' ? [{
      title: (
        <span>
          基准
          <Tooltip title="作为对比基准的 Prompt，其他版本的评测结果将与此版本进行差异对比">
            <QuestionCircleOutlined style={{ marginLeft: 4, color: '#999' }} />
          </Tooltip>
        </span>
      ),
      key: 'baseline',
      width: 70,
      render: (_: unknown, record: Prompt) => {
        if (!form.prompt_ids.includes(record.id)) return null
        const effectiveBaseline = form.baseline_prompt_id || form.prompt_ids[0]
        return (
          <Radio
            checked={effectiveBaseline === record.id}
            onChange={() => updateForm({ baseline_prompt_id: record.id })}
          />
        )
      },
    }] : []),
    { title: 'Prompt名称', dataIndex: 'name', key: 'name' },
    { title: '版本', dataIndex: 'version', key: 'version', render: (v: string) => <Tag>{v}</Tag> },
    {
      title: '修改说明',
      dataIndex: 'change_notes',
      key: 'change_notes',
      render: (notes: string) => notes ? <Text type="secondary" ellipsis style={{ maxWidth: 200 }}>{notes}</Text> : '-',
    },
  ]

  // Test item columns
  const itemColumns = [
    {
      title: '',
      key: 'select',
      width: 48,
      render: (_: unknown, record: TestItem) => (
        <Checkbox
          checked={form.test_item_ids.includes(record.id)}
          onChange={e => {
            updateForm({
              test_item_ids: e.target.checked
                ? [...form.test_item_ids, record.id]
                : form.test_item_ids.filter(id => id !== record.id)
            })
          }}
        />
      ),
    },
    {
      title: '序号',
      dataIndex: 'order_index',
      key: 'order_index',
      width: 60,
      render: (v: number) => v + 1,
    },
    {
      title: '内容',
      dataIndex: 'content',
      key: 'content',
      render: (c: string) => (
        <Text ellipsis style={{ maxWidth: 400 }}>{c}</Text>
      ),
    },
  ]

  const steps = [
    // Step 0: Basic Info
    <div key="step0">
      <Title level={5}>基本信息</Title>
      <Form layout="vertical" style={{ maxWidth: 600 }}>
        <Form.Item label="任务名称" required>
          <Input
            value={form.name}
            onChange={e => updateForm({ name: e.target.value })}
            placeholder="请输入任务名称"
            maxLength={100}
          />
        </Form.Item>
        <Form.Item label="任务描述">
          <TextArea
            value={form.description}
            onChange={e => updateForm({ description: e.target.value })}
            placeholder="可选，描述此评测任务的目的"
            rows={3}
          />
        </Form.Item>
        <Form.Item label="评测类型" required>
          <Radio.Group
            value={form.eval_type}
            onChange={e => updateForm({ eval_type: e.target.value, model_config_ids: [], prompt_ids: [] })}
          >
            <Space direction="vertical">
              <Radio value="prompt_comparison">
                <strong>Prompt对比测试</strong>
                <div><Text type="secondary">使用同一个模型，对比不同Prompt的效果（需选择2+个Prompt，1个模型）</Text></div>
              </Radio>
              <Radio value="model_comparison">
                <strong>模型横向对比</strong>
                <div><Text type="secondary">使用同一个Prompt，对比不同模型的效果（需选择1个Prompt，2+个模型）</Text></div>
              </Radio>
            </Space>
          </Radio.Group>
        </Form.Item>
      </Form>
    </div>,

    // Step 1: Select Models
    <div key="step1">
      <Title level={5}>选择模型</Title>
      <Alert
        message={form.eval_type === 'prompt_comparison'
          ? 'Prompt对比模式：请选择 1 个模型'
          : '模型对比模式：请选择 2 个或以上模型'}
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />
      <Table
        rowKey="id"
        dataSource={models}
        columns={modelColumns}
        size="small"
        pagination={false}
      />
    </div>,

    // Step 2: Select Prompts
    <div key="step2">
      <Title level={5}>选择Prompt</Title>
      <Alert
        message={form.eval_type === 'prompt_comparison'
          ? 'Prompt对比模式：请选择 2 个或以上 Prompt'
          : '模型对比模式：请选择 1 个 Prompt'}
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />
      <Table
        rowKey="id"
        dataSource={prompts}
        columns={promptColumns}
        size="small"
        pagination={false}
      />
    </div>,

    // Step 3: Test Data
    <div key="step3">
      <Title level={5}>测试数据</Title>
      <Form layout="vertical" style={{ maxWidth: 600, marginBottom: 16 }}>
        <Form.Item label="选择数据集" required>
          <Select
            placeholder="请选择测试数据集"
            value={form.dataset_id || undefined}
            onChange={v => updateForm({ dataset_id: v, test_item_ids: [] })}
            options={datasets.map(d => ({ label: d.name, value: d.id }))}
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item label="重复执行次数">
          <InputNumber
            min={1}
            max={5}
            value={form.repeat_count}
            onChange={v => updateForm({ repeat_count: v ?? 1 })}
          />
          <Text type="secondary" style={{ marginLeft: 8 }}>每条数据重复执行的次数（1-5次）</Text>
        </Form.Item>
        <Form.Item
          label="并发数"
          tooltip="三个阶段（推理执行、验证校验、自动评估）同时发起的最大 LLM 请求数，建议 3-5，过高可能触发 API 限流"
        >
          <InputNumber
            min={1}
            max={20}
            value={form.concurrency}
            onChange={v => updateForm({ concurrency: v ?? 3 })}
          />
          <Text type="secondary" style={{ marginLeft: 8 }}>并发调用数（1-20，默认 3）</Text>
        </Form.Item>
      </Form>
      {form.dataset_id && (
        <>
          <Space style={{ marginBottom: 8 }}>
            <Button
              size="small"
              onClick={() => updateForm({ test_item_ids: testItems.map(i => i.id) })}
            >
              全选
            </Button>
            <Button size="small" onClick={() => updateForm({ test_item_ids: [] })}>
              取消全选
            </Button>
            <Text type="secondary">已选 {form.test_item_ids.length} / {testItems.length} 条</Text>
          </Space>
          <Table
            rowKey="id"
            dataSource={testItems}
            columns={itemColumns}
            size="small"
            pagination={{ pageSize: 20 }}
          />
        </>
      )}
    </div>,

    // Step 4: Validation & Assessment
    <div key="step4">
      <Title level={5}>校验与评估</Title>
      <Divider orientation="left">校验检查点</Divider>
      <Form layout="vertical" style={{ maxWidth: 600, marginBottom: 24 }}>
        <Form.Item label="校验阶段模型" required extra="用于逐条执行校验点判断，只能选择 1 个模型">
          <Select
            placeholder="请选择校验阶段模型"
            value={form.validation_model_id || undefined}
            onChange={value => updateForm({ validation_model_id: value })}
            options={models.map(model => ({ label: `${model.name} (${model.model_id})`, value: model.id }))}
          />
        </Form.Item>
      </Form>
      {form.checkpoints.map((cp, idx) => (
        <Card
          key={idx}
          size="small"
          style={{ marginBottom: 8 }}
          extra={
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => removeCheckpoint(idx)}
            >
              删除
            </Button>
          }
        >
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="检查点名称" style={{ marginBottom: 0 }}>
                <Input
                  value={cp.name}
                  onChange={e => updateCheckpoint(idx, 'name', e.target.value)}
                  placeholder="如：格式正确"
                />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item label="校验标准" style={{ marginBottom: 0 }}>
                <Input
                  value={cp.criterion}
                  onChange={e => updateCheckpoint(idx, 'criterion', e.target.value)}
                  placeholder="如：输出应包含JSON格式，且包含score字段"
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>
      ))}
      <Button icon={<PlusOutlined />} onClick={addCheckpoint} style={{ marginBottom: 24 }}>
        添加检查点
      </Button>

      <Divider orientation="left">评估方式</Divider>
      <Form layout="vertical" style={{ maxWidth: 600 }}>
        <Form.Item label="评估模式" required>
          <Radio.Group
            value={form.assessment_mode}
            onChange={e => updateForm({ assessment_mode: e.target.value })}
          >
            <Space direction="vertical">
              <Radio value="manual">人工评估（手动为每条结果打分）</Radio>
              <Radio value="auto">自动评估（使用LLM自动评分）</Radio>
              <Radio value="custom">自定义规则评估</Radio>
            </Space>
          </Radio.Group>
        </Form.Item>
        {form.assessment_mode === 'custom' && (
          <Form.Item label="自定义评估规则">
            <TextArea
              value={form.custom_rules}
              onChange={e => updateForm({ custom_rules: e.target.value })}
              placeholder="请输入自定义评估规则..."
              rows={4}
            />
          </Form.Item>
        )}
        <Form.Item
          label="评估阶段模型"
          required
          extra={form.assessment_mode === 'manual'
            ? '当前为人工评估模式，暂不会调用该模型；保存后可切换到自动评估继续使用'
            : '用于自动评估阶段，只能选择 1 个模型'}
        >
          <Select
            placeholder="请选择评估阶段模型"
            value={form.assessment_model_id || undefined}
            onChange={value => updateForm({ assessment_model_id: value })}
            options={models.map(model => ({ label: `${model.name} (${model.model_id})`, value: model.id }))}
          />
        </Form.Item>
      </Form>

      <Divider orientation="left">配置预览</Divider>
      <Card size="small" style={{ background: '#fafafa' }}>
        <p><strong>任务名称：</strong>{form.name}</p>
        <p><strong>评测类型：</strong>{form.eval_type === 'prompt_comparison' ? 'Prompt对比测试' : '模型横向对比'}</p>
        <p><strong>已选模型：</strong>{form.model_config_ids.length} 个</p>
        <p><strong>校验模型：</strong>{models.find(model => model.id === form.validation_model_id)?.name ?? '-'}</p>
        <p><strong>评估模型：</strong>{models.find(model => model.id === form.assessment_model_id)?.name ?? '-'}</p>
        <p><strong>已选Prompt：</strong>{form.prompt_ids.length} 个
          {form.eval_type === 'prompt_comparison' && form.prompt_ids.length > 0 && (
            <span style={{ marginLeft: 8, color: '#999', fontSize: 12 }}>
              （基准：{(() => {
                const baseId = form.baseline_prompt_id || form.prompt_ids[0]
                const p = prompts.find(x => x.id === baseId)
                return p ? `${p.name} (${p.version})` : '-'
              })()}）
            </span>
          )}
        </p>
        <p><strong>测试数据：</strong>{form.test_item_ids.length} 条，重复 {form.repeat_count} 次</p>
        <p><strong>并发数：</strong>{form.concurrency} 个同时调用</p>
        <p><strong>校验检查点：</strong>{form.checkpoints.length} 个</p>
        <p><strong>评估模式：</strong>
          {form.assessment_mode === 'manual' ? '人工评估' :
           form.assessment_mode === 'auto' ? '自动评估' : '自定义规则'}
        </p>
        <p><strong>预计运行数：</strong>
          {form.model_config_ids.length * form.prompt_ids.length * form.test_item_ids.length * form.repeat_count} 次
        </p>
      </Card>
    </div>,
  ]

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Card>
        <Steps current={current} items={STEP_TITLES.map(title => ({ title }))} style={{ marginBottom: 32 }} />
        <div style={{ minHeight: 400 }}>
          {steps[current]}
        </div>
        <Divider />
        <Row justify="space-between">
          <Col>
            {current > 0 && (
              <Button onClick={() => setCurrent(c => c - 1)}>上一步</Button>
            )}
          </Col>
          <Col>
            <Space>
              <Button onClick={() => navigate('/tasks')}>取消</Button>
              {current < STEP_TITLES.length - 1 ? (
                <Button type="primary" onClick={handleNext}>下一步</Button>
              ) : (
                <Button
                  type="primary"
                  loading={createMutation.isPending}
                  onClick={handleSubmit}
                >
                  创建任务
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </Card>
    </div>
  )
}
