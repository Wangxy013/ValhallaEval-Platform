import { Modal, Row, Col, Tag, Typography, Divider, Space, Rate } from 'antd'
import type { EvalRun } from '../../types'
import { RunStatusTag } from '../../components/StatusTag'
import ValidationAnnotations from '../../components/ValidationAnnotations'

const { Text, Title } = Typography

interface CompareModalProps {
  open: boolean
  runs: [EvalRun, EvalRun]
  onClose: () => void
}

function RunPanel({ run }: { run: EvalRun }) {
  const label = run.prompt?.name
    ? `${run.prompt.name} v${run.prompt.version}`
    : run.model?.name ?? run.id

  const allAnnotations = (run.validation_results ?? []).flatMap(vr => vr.annotations ?? [])
  const assessment = run.assessment_results?.[0]

  return (
    <div>
      <Title level={5}>{label}</Title>
      <Space style={{ marginBottom: 8 }}>
        <RunStatusTag status={run.status} />
        {run.duration_ms != null && <Text type="secondary">{run.duration_ms}ms</Text>}
        {run.tokens_used != null && <Text type="secondary">{run.tokens_used} tokens</Text>}
      </Space>

      <Divider orientation="left" plain>输入消息</Divider>
      <div style={{ background: '#fafafa', borderRadius: 4, padding: 8, marginBottom: 12, maxHeight: 200, overflow: 'auto' }}>
        {(typeof run.input_messages === 'string'
          ? (() => { try { return JSON.parse(run.input_messages as unknown as string) } catch { return [] } })()
          : (run.input_messages ?? [])
        ).map((msg: { role: string; content: string }, i: number) => (
          <div key={i} style={{ marginBottom: 6 }}>
            <Tag color={msg.role === 'system' ? 'purple' : msg.role === 'user' ? 'blue' : 'green'}>
              {msg.role}
            </Tag>
            <Text style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{msg.content}</Text>
          </div>
        ))}
      </div>

      <Divider orientation="left" plain>模型输出</Divider>
      <div style={{ background: '#fafafa', borderRadius: 4, padding: 8, marginBottom: 12, maxHeight: 300, overflow: 'auto' }}>
        {run.output_content ? (
          allAnnotations.length > 0 ? (
            <ValidationAnnotations outputContent={run.output_content} annotations={allAnnotations} />
          ) : (
            <Text style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{run.output_content}</Text>
          )
        ) : run.error_message ? (
          <Text type="danger">{run.error_message}</Text>
        ) : (
          <Text type="secondary">暂无输出</Text>
        )}
      </div>

      {run.validation_results && run.validation_results.length > 0 && (
        <>
          <Divider orientation="left" plain>校验结果</Divider>
          {run.validation_results.map((vr, i) => (
            <Row key={i} gutter={8} style={{ marginBottom: 4 }} align="middle">
              <Col>
                <Tag color={vr.result === 'pass' ? 'green' : vr.result === 'fail' ? 'red' : 'gold'}>
                  {vr.result ?? '待校验'}
                </Tag>
              </Col>
              <Col flex="auto">
                <Text style={{ fontSize: 12 }}>{vr.comment}</Text>
              </Col>
            </Row>
          ))}
        </>
      )}

      {assessment && (
        <>
          <Divider orientation="left" plain>评估结果</Divider>
          {assessment.score != null && (
            <div>
              <Text>评分：</Text>
              <Rate disabled value={assessment.score} count={10} />
              <Text strong> {assessment.score}/10</Text>
            </div>
          )}
          {assessment.comment && <Text type="secondary">{assessment.comment}</Text>}
        </>
      )}
    </div>
  )
}

export default function CompareModal({ open, runs, onClose }: CompareModalProps) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width="90vw"
      title="对比查看"
      styles={{ body: { maxHeight: '80vh', overflow: 'auto' } }}
    >
      <Row gutter={24}>
        <Col span={12} style={{ borderRight: '1px solid #f0f0f0' }}>
          <RunPanel run={runs[0]} />
        </Col>
        <Col span={12}>
          <RunPanel run={runs[1]} />
        </Col>
      </Row>
    </Modal>
  )
}
