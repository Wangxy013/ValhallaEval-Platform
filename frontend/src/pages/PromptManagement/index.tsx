import { useState } from 'react'
import {
  Table, Button, Modal, Form, Input, Space, Popconfirm, message,
  Card, Row, Col, Typography, Tag, Collapse,
} from 'antd'
import { PlusOutlined, EyeOutlined, DeleteOutlined, CopyOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { listPrompts, createPrompt, deletePrompt } from '../../api/prompts'
import type { Prompt } from '../../types'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

interface PromptGroup {
  name: string
  versions: Prompt[]
}

function groupPromptsByName(prompts: Prompt[]): PromptGroup[] {
  const map = new Map<string, Prompt[]>()
  for (const p of prompts) {
    if (!map.has(p.name)) map.set(p.name, [])
    map.get(p.name)!.push(p)
  }
  const result: PromptGroup[] = []
  map.forEach((versions, name) => {
    result.push({ name, versions: versions.sort((a, b) => b.created_at - a.created_at) })
  })
  return result.sort((a, b) => b.versions[0].created_at - a.versions[0].created_at)
}

interface FormValues {
  name: string
  version: string
  change_notes: string
  content: string
}

export default function PromptManagementPage() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [viewPrompt, setViewPrompt] = useState<Prompt | null>(null)
  const [copyFrom, setCopyFrom] = useState<Prompt | null>(null)
  const [form] = Form.useForm<FormValues>()

  const { data: prompts = [], isLoading } = useQuery({
    queryKey: ['prompts'],
    queryFn: listPrompts,
  })

  const createMutation = useMutation({
    mutationFn: createPrompt,
    onSuccess: () => {
      message.success('Prompt已保存')
      queryClient.invalidateQueries({ queryKey: ['prompts'] })
      setModalOpen(false)
      setCopyFrom(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deletePrompt,
    onSuccess: () => {
      message.success('Prompt已删除')
      queryClient.invalidateQueries({ queryKey: ['prompts'] })
    },
  })

  function openCreate() {
    setCopyFrom(null)
    form.resetFields()
    setModalOpen(true)
  }

  function openNewVersion(prompt: Prompt) {
    setCopyFrom(prompt)
    form.setFieldsValue({
      name: prompt.name,
      version: '',
      change_notes: '',
      content: prompt.content,
    })
    setModalOpen(true)
  }

  function handleSubmit(values: FormValues) {
    createMutation.mutate({
      name: values.name,
      version: values.version,
      content: values.content,
      change_notes: values.change_notes,
      parent_id: copyFrom?.id,
    })
  }

  const groups = groupPromptsByName(prompts)

  const versionColumns = [
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: '修改说明',
      dataIndex: 'change_notes',
      key: 'change_notes',
      render: (notes: string) => notes
        ? <Text ellipsis style={{ maxWidth: 300 }}>{notes}</Text>
        : <Text type="secondary">-</Text>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (v: number) => dayjs(v * 1000).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: Prompt) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setViewPrompt(record)}
          >
            查看
          </Button>
          <Button
            type="link"
            size="small"
            icon={<CopyOutlined />}
            onClick={() => openNewVersion(record)}
          >
            新建版本
          </Button>
          <Popconfirm
            title="确认删除该Prompt版本？"
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

  const collapseItems = groups.map(group => ({
    key: group.name,
    label: (
      <Space>
        <Text strong>{group.name}</Text>
        <Tag>{group.versions.length} 个版本</Tag>
        <Text type="secondary" style={{ fontSize: 12 }}>
          最新：{group.versions[0].version}
        </Text>
      </Space>
    ),
    children: (
      <Table
        rowKey="id"
        dataSource={group.versions}
        columns={versionColumns}
        size="small"
        pagination={false}
      />
    ),
  }))

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col><Title level={4} style={{ margin: 0 }}>Prompt管理</Title></Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新建Prompt
          </Button>
        </Col>
      </Row>

      <Card>
        {isLoading ? (
          <Card loading />
        ) : groups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Text type="secondary">暂无Prompt，点击"新建Prompt"开始</Text>
          </div>
        ) : (
          <Collapse items={collapseItems} />
        )}
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        title={copyFrom ? `基于 "${copyFrom.name} v${copyFrom.version}" 新建版本` : '新建Prompt'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setCopyFrom(null) }}
        onOk={() => form.submit()}
        okText="保存"
        cancelText="取消"
        confirmLoading={createMutation.isPending}
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item
                label="Prompt名称"
                name="name"
                rules={[{ required: true, message: '请输入Prompt名称' }]}
              >
                <Input
                  placeholder="如：教学评分Prompt"
                  disabled={!!copyFrom}
                />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item
                label="版本号"
                name="version"
                rules={[{ required: true, message: '请输入版本号' }]}
              >
                <Input placeholder="如：v1.0, v1.1" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="修改说明" name="change_notes">
            <Input placeholder="简述本版本改动内容（可选）" />
          </Form.Item>
          <Form.Item
            label="Prompt内容"
            name="content"
            rules={[{ required: true, message: '请输入Prompt内容' }]}
          >
            <TextArea
              placeholder="请输入Prompt内容..."
              rows={12}
              style={{ fontFamily: 'monospace', fontSize: 13 }}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* View Modal */}
      <Modal
        title={viewPrompt ? `${viewPrompt.name} - ${viewPrompt.version}` : ''}
        open={!!viewPrompt}
        onCancel={() => setViewPrompt(null)}
        footer={
          <Button onClick={() => setViewPrompt(null)}>关闭</Button>
        }
        width={700}
      >
        {viewPrompt && (
          <div>
            {viewPrompt.change_notes && (
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary">修改说明：{viewPrompt.change_notes}</Text>
              </div>
            )}
            <div
              style={{
                background: '#fafafa',
                border: '1px solid #f0f0f0',
                borderRadius: 4,
                padding: 16,
                maxHeight: 500,
                overflow: 'auto',
              }}
            >
              <Paragraph
                style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 13, margin: 0 }}
                copyable={{ text: viewPrompt.content }}
              >
                {viewPrompt.content}
              </Paragraph>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
