import { useState } from 'react'
import {
  Table, Button, Space, Popconfirm, message, Select, Card, Row, Col, Typography,
} from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { listTasks, deleteTask } from '../../api/tasks'
import type { Task, TaskStatus, EvalType } from '../../types'
import { TaskStatusTag } from '../../components/StatusTag'
import EvalTypeTag from '../../components/EvalTypeTag'

const { Title } = Typography

const STATUS_OPTIONS: { label: string; value: TaskStatus }[] = [
  { label: '草稿', value: 'draft' },
  { label: '运行中', value: 'running' },
  { label: '已暂停', value: 'paused' },
  { label: '已完成', value: 'completed' },
  { label: '失败', value: 'failed' },
]

const TYPE_OPTIONS: { label: string; value: EvalType }[] = [
  { label: 'Prompt对比', value: 'prompt_comparison' },
  { label: '模型对比', value: 'model_comparison' },
]

export default function TasksPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [filterStatus, setFilterStatus] = useState<TaskStatus | undefined>()
  const [filterType, setFilterType] = useState<EvalType | undefined>()

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: listTasks,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      message.success('任务已删除')
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  const filtered = tasks.filter(task => {
    if (filterStatus && task.status !== filterStatus) return false
    if (filterType && task.eval_type !== filterType) return false
    return true
  })

  const columns = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Task) => (
        <Button type="link" onClick={() => navigate(`/tasks/${record.id}/result`)} style={{ padding: 0 }}>
          {name}
        </Button>
      ),
    },
    {
      title: '评测类型',
      dataIndex: 'eval_type',
      key: 'eval_type',
      render: (type: EvalType) => <EvalTypeTag evalType={type} />,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: TaskStatus) => <TaskStatusTag status={status} showBadge />,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (ts: number) => dayjs(ts * 1000).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: Task) => (
        <Space>
          <Button
            type="link"
            size="small"
            onClick={() => navigate(`/tasks/${record.id}/result`)}
          >
            查看结果
          </Button>
          <Popconfirm
            title="确认删除该任务？"
            description="删除后数据无法恢复"
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="link" danger size="small">删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>评测任务列表</Title>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/tasks/new')}
          >
            新建评测任务
          </Button>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space>
          <span>筛选：</span>
          <Select
            placeholder="全部状态"
            allowClear
            style={{ width: 140 }}
            options={STATUS_OPTIONS}
            value={filterStatus}
            onChange={setFilterStatus}
          />
          <Select
            placeholder="全部类型"
            allowClear
            style={{ width: 140 }}
            options={TYPE_OPTIONS}
            value={filterType}
            onChange={setFilterType}
          />
        </Space>
      </Card>

      <Card>
        <Table
          rowKey="id"
          dataSource={filtered}
          columns={columns}
          loading={isLoading}
          pagination={{ pageSize: 20 }}
        />
      </Card>
    </div>
  )
}
