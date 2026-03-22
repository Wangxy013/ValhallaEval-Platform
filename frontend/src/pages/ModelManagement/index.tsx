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

const PROVIDER_OPTIONS = [
  { label: '豆包 (Doubao)', value: 'doubao' },
  { label: '星火教育 (Spark Edu)', value: 'spark_edu' },
  { label: 'OpenAI 兼容', value: 'openai' },
]

const providerLabels: Record<string, string> = {
  doubao: '豆包',
  spark_edu: '星火教育',
  openai: 'OpenAI兼容',
}

type FormValues = Omit<ModelConfig, 'id' | 'created_at' | 'updated_at' | 'extra_config'>

export default function ModelManagementPage() {
  const queryClient = useQueryClient()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<ModelConfig | null>(null)
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
    form.resetFields()
    setDrawerOpen(true)
  }

  function openEdit(record: ModelConfig) {
    setEditing(record)
    form.setFieldsValue({
      name: record.name,
      provider: record.provider,
      api_url: record.api_url,
      api_key: record.api_key,
      model_id: record.model_id,
    })
    setDrawerOpen(true)
  }

  function handleSubmit(values: FormValues) {
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: values })
    } else {
      createMutation.mutate(values)
    }
  }

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
        width={480}
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
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            label="模型名称"
            name="name"
            rules={[{ required: true, message: '请输入模型名称' }]}
          >
            <Input placeholder="如：Doubao-pro-4k" />
          </Form.Item>

          <Form.Item
            label="提供商"
            name="provider"
            rules={[{ required: true, message: '请选择提供商' }]}
          >
            <Select options={PROVIDER_OPTIONS} placeholder="请选择提供商" />
          </Form.Item>

          <Form.Item
            label="API地址"
            name="api_url"
            rules={[{ required: true, message: '请输入API地址' }]}
          >
            <Input placeholder="如：https://ark.cn-beijing.volces.com/api/v3" />
          </Form.Item>

          <Form.Item
            label="API密钥"
            name="api_key"
            rules={[{ required: true, message: '请输入API密钥' }]}
          >
            <Input.Password placeholder="请输入API密钥" />
          </Form.Item>

          <Form.Item
            label="模型ID"
            name="model_id"
            rules={[{ required: true, message: '请输入模型ID' }]}
          >
            <Input placeholder="如：ep-20241230151952-xxxxx" />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  )
}
