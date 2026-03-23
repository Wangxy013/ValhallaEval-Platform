import { Layout, Menu } from 'antd'
import {
  UnorderedListOutlined,
  ApiOutlined,
  FileTextOutlined,
  DatabaseOutlined,
} from '@ant-design/icons'
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom'
import TasksPage from './pages/Tasks'
import NewTaskPage from './pages/NewTask'
import TaskResultPage from './pages/TaskResult'
import ModelManagementPage from './pages/ModelManagement'
import PromptManagementPage from './pages/PromptManagement'
import TestDataManagementPage from './pages/TestDataManagement'

const { Header, Sider, Content } = Layout

const menuItems = [
  {
    key: '/tasks',
    icon: <UnorderedListOutlined />,
    label: '评测任务',
  },
  {
    key: '/models',
    icon: <ApiOutlined />,
    label: '模型管理',
  },
  {
    key: '/prompts',
    icon: <FileTextOutlined />,
    label: 'Prompt管理',
  },
  {
    key: '/datasets',
    icon: <DatabaseOutlined />,
    label: '测试数据',
  },
]

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()

  const selectedKey = menuItems.find(item =>
    location.pathname.startsWith(item.key)
  )?.key ?? '/tasks'

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        theme="dark"
        width={200}
        style={{ position: 'fixed', height: '100vh', left: 0, top: 0, bottom: 0 }}
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          padding: '0 12px',
        }}>
          <img src="/logo.png" alt="logo" style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
            <span style={{ color: '#fff', fontSize: 15, fontWeight: 700, letterSpacing: 1 }}>
              ValhallaEval
            </span>
            <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 400 }}>
              大模型评测平台
            </span>
          </div>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ marginTop: 8 }}
        />
      </Sider>
      <Layout style={{ marginLeft: 200 }}>
        <Header style={{
          background: '#fff',
          padding: '0 24px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: 16, fontWeight: 500, color: '#262626' }}>
            {menuItems.find(item => location.pathname.startsWith(item.key))?.label ?? '评测任务'}
          </span>
        </Header>
        <Content style={{ padding: 24, background: '#f5f5f5', minHeight: 'calc(100vh - 64px)' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/tasks" replace />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/tasks/new" element={<NewTaskPage />} />
            <Route path="/tasks/:id/result" element={<TaskResultPage />} />
            <Route path="/models" element={<ModelManagementPage />} />
            <Route path="/prompts" element={<PromptManagementPage />} />
            <Route path="/datasets" element={<TestDataManagementPage />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}
