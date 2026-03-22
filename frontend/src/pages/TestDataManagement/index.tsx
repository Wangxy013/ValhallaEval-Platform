import { useState, useRef } from 'react'
import {
  Table, Button, Modal, Form, Input, Space, Popconfirm, message,
  Card, Row, Col, Typography, List, Divider, Upload,
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, InboxOutlined, UploadOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  listDatasets, createDataset, deleteDataset,
  listTestItems, createTestItem, createTestItemsBatch, deleteTestItem,
} from '../../api/datasets'
import type { TestDataset, TestItem } from '../../types'

const { Title, Text } = Typography
const { TextArea } = Input

export default function TestDataManagementPage() {
  const queryClient = useQueryClient()
  const [selectedDataset, setSelectedDataset] = useState<TestDataset | null>(null)
  const [datasetModalOpen, setDatasetModalOpen] = useState(false)
  const [addItemModalOpen, setAddItemModalOpen] = useState(false)
  const [batchText, setBatchText] = useState('')
  const [singleContent, setSingleContent] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [datasetForm] = Form.useForm<{ name: string; description: string }>()

  const { data: datasets = [], isLoading: datasetsLoading } = useQuery({
    queryKey: ['datasets'],
    queryFn: listDatasets,
  })

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['test-items', selectedDataset?.id],
    queryFn: () => listTestItems(selectedDataset!.id),
    enabled: !!selectedDataset,
  })

  const invalidateItems = () => {
    queryClient.invalidateQueries({ queryKey: ['test-items', selectedDataset?.id] })
  }

  const createDatasetMutation = useMutation({
    mutationFn: createDataset,
    onSuccess: () => {
      message.success('数据集已创建')
      queryClient.invalidateQueries({ queryKey: ['datasets'] })
      setDatasetModalOpen(false)
      datasetForm.resetFields()
    },
  })

  const deleteDatasetMutation = useMutation({
    mutationFn: deleteDataset,
    onSuccess: () => {
      message.success('数据集已删除')
      queryClient.invalidateQueries({ queryKey: ['datasets'] })
      if (selectedDataset) setSelectedDataset(null)
    },
  })

  const createItemMutation = useMutation({
    mutationFn: ({ content }: { content: string }) =>
      createTestItem(selectedDataset!.id, { content }),
    onSuccess: () => {
      message.success('数据已添加')
      setSingleContent('')
      invalidateItems()
    },
  })

  const createBatchMutation = useMutation({
    mutationFn: (contents: string[]) => createTestItemsBatch(selectedDataset!.id, contents),
    onSuccess: (created) => {
      message.success(`成功导入 ${created.length} 条数据`)
      setBatchText('')
      setAddItemModalOpen(false)
      invalidateItems()
    },
  })

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => deleteTestItem(selectedDataset!.id, itemId),
    onSuccess: () => {
      message.success('数据已删除')
      invalidateItems()
    },
  })

  function handleBatchAdd() {
    const lines = batchText.split('\n').map(l => l.trim()).filter(l => l.length > 0)
    if (lines.length === 0) { message.warning('请输入数据内容'); return }
    createBatchMutation.mutate(lines)
  }

  function handleCSVImport(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const lines = text.split('\n')
        .map(l => l.split(',')[0].trim().replace(/^["']|["']$/g, ''))
        .filter(l => l.length > 0)
      if (lines.length === 0) { message.warning('CSV文件为空或格式不正确'); return }
      createBatchMutation.mutate(lines)
    }
    reader.readAsText(file)
    return false
  }

  const itemColumns = [
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
        <Text style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{c}</Text>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 140,
      render: (v: number) => dayjs(v * 1000).format('MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: TestItem) => (
        <Popconfirm
          title="确认删除该条数据？"
          onConfirm={() => deleteItemMutation.mutate(record.id)}
          okText="确认"
          cancelText="取消"
        >
          <Button type="link" danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col><Title level={4} style={{ margin: 0 }}>测试数据管理</Title></Col>
      </Row>

      <Row gutter={16}>
        {/* Left: Dataset list */}
        <Col span={8}>
          <Card
            title="数据集"
            extra={
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => setDatasetModalOpen(true)}
              >
                新建
              </Button>
            }
          >
            <List
              loading={datasetsLoading}
              dataSource={datasets}
              renderItem={(ds) => (
                <List.Item
                  style={{
                    cursor: 'pointer',
                    background: selectedDataset?.id === ds.id ? '#e6f4ff' : undefined,
                    borderRadius: 4,
                    padding: '8px 12px',
                  }}
                  onClick={() => setSelectedDataset(ds)}
                  actions={[
                    <Popconfirm
                      key="del"
                      title="确认删除该数据集及其所有数据？"
                      onConfirm={e => {
                        e?.stopPropagation()
                        deleteDatasetMutation.mutate(ds.id)
                      }}
                      okText="确认"
                      cancelText="取消"
                    >
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={e => e.stopPropagation()}
                      />
                    </Popconfirm>,
                  ]}
                >
                  <List.Item.Meta
                    title={ds.name}
                    description={ds.description || `创建于 ${dayjs(ds.created_at * 1000).format('MM-DD')}`}
                  />
                </List.Item>
              )}
              locale={{ emptyText: '暂无数据集' }}
            />
          </Card>
        </Col>

        {/* Right: Items panel */}
        <Col span={16}>
          {selectedDataset ? (
            <Card
              title={
                <Space>
                  <Text strong>{selectedDataset.name}</Text>
                  <Text type="secondary">共 {items.length} 条</Text>
                </Space>
              }
              extra={
                <Space>
                  <Button icon={<PlusOutlined />} onClick={() => setAddItemModalOpen(true)}>
                    批量添加
                  </Button>
                  <Upload
                    accept=".csv"
                    showUploadList={false}
                    beforeUpload={handleCSVImport}
                  >
                    <Button icon={<UploadOutlined />}>导入CSV</Button>
                  </Upload>
                </Space>
              }
            >
              <div style={{ marginBottom: 16 }}>
                <Space.Compact style={{ width: '100%' }}>
                  <Input
                    placeholder="输入单条数据内容，回车添加"
                    value={singleContent}
                    onChange={e => setSingleContent(e.target.value)}
                    onPressEnter={() => {
                      if (singleContent.trim()) createItemMutation.mutate({ content: singleContent.trim() })
                    }}
                  />
                  <Button
                    type="primary"
                    loading={createItemMutation.isPending}
                    onClick={() => {
                      if (singleContent.trim()) createItemMutation.mutate({ content: singleContent.trim() })
                    }}
                  >
                    添加
                  </Button>
                </Space.Compact>
              </div>

              <Table
                rowKey="id"
                dataSource={items}
                columns={itemColumns}
                loading={itemsLoading}
                size="small"
                pagination={{ pageSize: 20 }}
              />
            </Card>
          ) : (
            <Card style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', padding: 40 }}>
                <InboxOutlined style={{ fontSize: 48, color: '#bfbfbf' }} />
                <div style={{ marginTop: 16 }}>
                  <Text type="secondary">请从左侧选择一个数据集</Text>
                </div>
              </div>
            </Card>
          )}
        </Col>
      </Row>

      {/* Create Dataset Modal */}
      <Modal
        title="新建数据集"
        open={datasetModalOpen}
        onCancel={() => setDatasetModalOpen(false)}
        onOk={() => datasetForm.submit()}
        okText="创建"
        cancelText="取消"
        confirmLoading={createDatasetMutation.isPending}
      >
        <Form
          form={datasetForm}
          layout="vertical"
          onFinish={values => createDatasetMutation.mutate(values)}
        >
          <Form.Item
            label="数据集名称"
            name="name"
            rules={[{ required: true, message: '请输入数据集名称' }]}
          >
            <Input placeholder="如：小学数学测试集" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input placeholder="可选，描述该数据集的用途" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Batch Add Modal */}
      <Modal
        title="批量添加数据"
        open={addItemModalOpen}
        onCancel={() => { setAddItemModalOpen(false); setBatchText('') }}
        onOk={handleBatchAdd}
        okText="批量添加"
        cancelText="取消"
        confirmLoading={createBatchMutation.isPending}
        width={600}
      >
        <div>
          <Text type="secondary">每行一条数据，空行将被忽略</Text>
          <Divider style={{ margin: '8px 0' }} />
          <TextArea
            value={batchText}
            onChange={e => setBatchText(e.target.value)}
            placeholder={'请输入测试数据，每行一条，例如：\n小明有5个苹果，给了小红2个，还剩几个？\n一个三角形的三个角分别是60°、60°、60°，这是什么三角形？'}
            rows={12}
            style={{ fontFamily: 'monospace', fontSize: 13 }}
          />
          <Text type="secondary">
            已输入 {batchText.split('\n').filter(l => l.trim().length > 0).length} 条
          </Text>
        </div>
      </Modal>

      {/* hidden file input for CSV */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) handleCSVImport(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
