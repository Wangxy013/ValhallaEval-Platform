import { useState } from 'react'
import {
  Table, Button, Drawer, Form, Input, Select, Space, Popconfirm, message,
  Card, Row, Col, Typography, Tag,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { listModels, createModel, updateModel, deleteModel } from '../../api/models'
import type { ModelConfig } from '../../types'

const { Title } = Typography

// 每项含官方 OpenAI-compatible API 接入地址，选中后自动填入表单
const PROVIDERS: {
  label: string
  value: string
  apiUrl: string
  note: string
  link?: string
  linkText?: string
}[] = [
  // ── 国内厂商 ──────────────────────────────────────────────────────────────
  {
    label: '豆包 (Doubao) · 字节跳动',
    value: 'doubao',
    apiUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    note: '需在火山引擎控制台创建推理接入点，Model ID 填接入点 ID（ep-xxx）',
    link: 'https://console.volcengine.com/ark',
    linkText: '火山引擎控制台',
  },
  {
    label: '星火 (Spark) · 科大讯飞',
    value: 'spark',
    apiUrl: 'https://spark-api-open.xf-yun.com/v1',
    note: '讯飞开放平台 → 大模型 → API Key 管理，Model ID 填模型版本名',
    link: 'https://console.xfyun.cn/app/myapp',
    linkText: '讯飞开放平台',
  },
  {
    label: '通义千问 (Qwen) · 阿里云',
    value: 'qwen',
    apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    note: 'DashScope 平台 OpenAI 兼容模式，Model ID 填如 qwen-turbo / qwen-plus',
    link: 'https://dashscope.console.aliyun.com/apiKey',
    linkText: 'DashScope 平台',
  },
  {
    label: '文心一言 (ERNIE) · 百度',
    value: 'ernie',
    apiUrl: 'https://qianfan.baidubce.com/v2',
    note: '百度千帆平台 OpenAI 兼容接口，Model ID 填如 ernie-4.0-8k',
    link: 'https://console.bce.baidu.com/qianfan/ais/console/applicationConsole/application',
    linkText: '百度千帆平台',
  },
  {
    label: '智谱AI (GLM) · 智谱华章',
    value: 'zhipu',
    apiUrl: 'https://open.bigmodel.cn/api/paas/v4',
    note: '智谱开放平台，Model ID 填如 glm-4-flash / glm-4-air',
    link: 'https://open.bigmodel.cn/usercenter/apikeys',
    linkText: '智谱开放平台',
  },
  {
    label: 'Kimi · 月之暗面',
    value: 'kimi',
    apiUrl: 'https://api.moonshot.cn/v1',
    note: 'Moonshot AI 开放平台，Model ID 填如 moonshot-v1-8k',
    link: 'https://platform.moonshot.cn/console/api-keys',
    linkText: 'Moonshot 开放平台',
  },
  {
    label: '混元 (Hunyuan) · 腾讯',
    value: 'hunyuan',
    apiUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
    note: '腾讯混元大模型，Model ID 填如 hunyuan-pro / hunyuan-turbo',
    link: 'https://console.cloud.tencent.com/hunyuan/api-key',
    linkText: '腾讯云混元控制台',
  },
  {
    label: 'DeepSeek · 深度求索',
    value: 'deepseek',
    apiUrl: 'https://api.deepseek.com/v1',
    note: '原生 OpenAI 兼容格式，Model ID 填如 deepseek-chat / deepseek-reasoner',
    link: 'https://platform.deepseek.com/api_keys',
    linkText: 'DeepSeek 开放平台',
  },
  {
    label: '零一 (Yi) · 零一万物',
    value: 'yi',
    apiUrl: 'https://api.lingyiwanwu.com/v1',
    note: '零一万物开放平台，Model ID 填如 yi-lightning / yi-medium',
    link: 'https://platform.lingyiwanwu.com/apikeys',
    linkText: '零一万物开放平台',
  },
  // ── 国际厂商 ──────────────────────────────────────────────────────────────
  {
    label: 'OpenAI · GPT 系列',
    value: 'openai',
    apiUrl: 'https://api.openai.com/v1',
    note: 'OpenAI 官方接口，Model ID 填如 gpt-4o / gpt-4o-mini',
    link: 'https://platform.openai.com/api-keys',
    linkText: 'OpenAI Platform',
  },
  // ── 其他 ─────────────────────────────────────────────────────────────────
  {
    label: '其他 (OpenAI 兼容)',
    value: 'openai_compatible',
    apiUrl: '',
    note: '任何兼容 OpenAI Chat Completions 格式的自建或第三方服务，手动填写 API 地址',
  },
]

const providerLabels: Record<string, string> = Object.fromEntries(
  PROVIDERS.map(p => [p.value, p.label.split(' · ')[0]])
)

type FormValues = Omit<ModelConfig, 'id' | 'created_at' | 'updated_at' | 'extra_config'>

export default function ModelManagementPage() {
  const queryClient = useQueryClient()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<ModelConfig | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null)
  const [form] = Form.useForm<FormValues>()

  const { data: models = [], isLoading } = useQuery({
    queryKey: ['models'],
    queryFn: listModels,
  })

  const createMutation = useMutation({
    mutationFn: createModel,
    onSuccess: () => {
      message.success('模型已添加')
      queryClient.invalidateQueries({ queryKey: ['models'] })
      setDrawerOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<FormValues> }) => updateModel(id, data),
    onSuccess: () => {
      message.success('模型已更新')
      queryClient.invalidateQueries({ queryKey: ['models'] })
      setDrawerOpen(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteModel,
    onSuccess: () => {
      message.success('模型已删除')
      queryClient.invalidateQueries({ queryKey: ['models'] })
    },
  })

  function openCreate() {
    setEditing(null)
    setSelectedProvider(null)
    form.resetFields()
    setDrawerOpen(true)
  }

  function openEdit(record: ModelConfig) {
    setEditing(record)
    setSelectedProvider(record.provider)
    form.setFieldsValue({
      name: record.name,
      provider: record.provider,
      api_url: record.api_url,
      api_key: record.api_key,
      model_id: record.model_id,
    })
    setDrawerOpen(true)
  }

  function handleProviderChange(val: string) {
    setSelectedProvider(val)
    const provider = PROVIDERS.find(p => p.value === val)
    if (provider?.apiUrl) {
      form.setFieldValue('api_url', provider.apiUrl)
    } else {
      form.setFieldValue('api_url', '')
    }
  }

  function handleSubmit(values: FormValues) {
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: values })
    } else {
      createMutation.mutate(values)
    }
  }

  const currentProvider = PROVIDERS.find(p => p.value === selectedProvider)

  const columns = [
    { title: '模型名称', dataIndex: 'name', key: 'name' },
    {
      title: '提供商',
      dataIndex: 'provider',
      key: 'provider',
      render: (p: string) => <Tag>{providerLabels[p] ?? p}</Tag>,
    },
    { title: 'API地址', dataIndex: 'api_url', key: 'api_url', ellipsis: true },
    { title: '模型ID', dataIndex: 'model_id', key: 'model_id' },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      render: (v: number) => dayjs(v * 1000).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: ModelConfig) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除该模型配置？"
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="link" danger size="small" icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col><Title level={4} style={{ margin: 0 }}>模型管理</Title></Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            添加模型
          </Button>
        </Col>
      </Row>

      <Card>
        <Table
          rowKey="id"
          dataSource={models}
          columns={columns}
          loading={isLoading}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <Drawer
        title={editing ? '编辑模型' : '添加模型'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={500}
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={() => setDrawerOpen(false)}>取消</Button>
            <Button
              type="primary"
              loading={createMutation.isPending || updateMutation.isPending}
              onClick={() => form.submit()}
            >
              {editing ? '保存' : '添加'}
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="模型名称"
            name="name"
            rules={[{ required: true, message: '请输入模型名称' }]}
          >
            <Input placeholder="如：豆包 Pro 32k" />
          </Form.Item>

          <Form.Item
            label="提供商"
            name="provider"
            rules={[{ required: true, message: '请选择提供商' }]}
          >
            <Select
              placeholder="请选择提供商"
              onChange={handleProviderChange}
              optionRender={(option) => {
                const p = PROVIDERS.find(x => x.value === option.value)
                return (
                  <div style={{ padding: '2px 0' }}>
                    <div>{option.label}</div>
                    {p?.apiUrl && (
                      <div style={{ fontSize: 11, color: '#999', marginTop: 1 }}>
                        {p.apiUrl}
                      </div>
                    )}
                  </div>
                )
              }}
              options={PROVIDERS.map(p => ({ label: p.label, value: p.value }))}
            />
          </Form.Item>

          <Form.Item
            label="API 接入地址"
            name="api_url"
            rules={[{ required: true, message: '请输入 API 地址' }]}
            extra={currentProvider && (
              <span style={{ fontSize: 12, color: '#888' }}>
                💡 {currentProvider.note}
                {currentProvider.link && (
                  <>
                    {' — '}
                    <a href={currentProvider.link} target="_blank" rel="noopener noreferrer">
                      前往 {currentProvider.linkText} →
                    </a>
                  </>
                )}
              </span>
            )}
          >
            <Input placeholder="选择提供商后自动填入，或手动输入" />
          </Form.Item>

          <Form.Item
            label="API 密钥"
            name="api_key"
            rules={[{ required: true, message: '请输入 API 密钥' }]}
          >
            <Input.Password placeholder="请输入 API 密钥" />
          </Form.Item>

          <Form.Item
            label="模型 ID"
            name="model_id"
            rules={[{ required: true, message: '请输入模型 ID' }]}
          >
            <Input placeholder="如：ep-20241230151952-xxxxx" />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  )
}
