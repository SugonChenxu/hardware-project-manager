import React, { useEffect, useState } from 'react';
import { Layout, Menu, Select, Button, Modal, Input, DatePicker, theme } from 'antd';
import {
  DashboardOutlined,
  ProjectOutlined,
  BarChartOutlined,
  CheckSquareOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  EditOutlined,
  DollarOutlined,
  BugOutlined,
  ScheduleOutlined,
  PlusOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useProjectStore } from '../store/useProjectStore';
import { Project } from '../types';
import dayjs from 'dayjs';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '项目概览' },
  { key: '/tasks', icon: <CheckSquareOutlined />, label: '每日待办' },
  { key: '/gantt', icon: <BarChartOutlined />, label: '甘特图' },
  { key: '/bom', icon: <DatabaseOutlined />, label: '物料管理' },
  { key: '/meetings', icon: <FileTextOutlined />, label: '会议纪要' },
  { key: '/reports', icon: <EditOutlined />, label: '周报' },
  { key: '/costs', icon: <DollarOutlined />, label: '费用估算' },
  { key: '/bugs', icon: <BugOutlined />, label: '故障管理' },
  { key: '/plan', icon: <ScheduleOutlined />, label: '项目计划' },
];

const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '', startDate: '', endDate: '' });

  const {
    projects,
    currentProjectId,
    load: loadProjects,
    add: addProject,
    setCurrent,
  } = useProjectStore();

  const currentProjectName = projects.find(p => p.id === currentProjectId)?.name || '未选择项目';

  useEffect(() => {
    loadProjects();
  }, []);

  // 自动创建默认项目（如果没有任何项目）
  useEffect(() => {
    if (projects.length === 0 && !createModalOpen) {
      addProject({
        name: '默认项目',
        description: '欢迎使用硬件项目管理工具',
        startDate: dayjs().format('YYYY-MM-DD'),
        endDate: '',
        status: 'active',
      });
    }
  }, [projects.length, createModalOpen]);

  const handleCreateProject = () => {
    if (!newProject.name) return;
    addProject({
      name: newProject.name,
      description: newProject.description,
      startDate: newProject.startDate,
      endDate: newProject.endDate,
      status: 'planning',
    });
    setNewProject({ name: '', description: '', startDate: '', endDate: '' });
    setCreateModalOpen(false);
  };

  const currentProject = projects.find((p) => p.id === currentProjectId);

  const { token } = theme.useToken();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={220}
        style={{
          background: token.colorBgContainer,
          borderRight: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            fontWeight: 700,
            fontSize: collapsed ? 14 : 16,
            color: token.colorPrimary,
          }}
        >
          {collapsed ? 'HPM' : '硬件项目管理'}
        </div>

        <div style={{ padding: '12px 16px' }}>
          <Select
            style={{ width: '100%' }}
            placeholder="选择项目"
            value={currentProjectId}
            onChange={(val) => setCurrent(val)}
            options={projects.map((p) => ({ label: p.name, value: p.id }))}
            notFoundContent={
              <Button type="link" onClick={() => setCreateModalOpen(true)}>
                创建第一个项目
              </Button>
            }
          />
        </div>

        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderInlineEnd: 'none' }}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: token.colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            height: 64,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
            />
            <span style={{ fontSize: 16, fontWeight: 500 }}>
              {currentProject ? currentProject.name : '未选择项目'}
            </span>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
          >
            新建项目
          </Button>
        </Header>

        <Content
          style={{
            margin: 16,
            padding: 24,
            background: token.colorBgContainer,
            borderRadius: token.borderRadiusLG,
            minHeight: 280,
            overflow: 'auto',
          }}
        >
          {!currentProjectId && location.pathname !== '/' ? (
            <div style={{ textAlign: 'center', padding: 80, color: token.colorTextSecondary }}>
              <ProjectOutlined style={{ fontSize: 48, marginBottom: 16 }} />
              <h3>请先选择或创建一个项目</h3>
              <Button type="primary" onClick={() => setCreateModalOpen(true)}>
                创建项目
              </Button>
            </div>
          ) : (
            <Outlet />
          )}
        </Content>
      </Layout>

      <Modal
        title="新建项目"
        open={createModalOpen}
        onOk={handleCreateProject}
        onCancel={() => setCreateModalOpen(false)}
        okText="创建"
        cancelText="取消"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 16 }}>
          <Input
            placeholder="项目名称"
            value={newProject.name}
            onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
          />
          <Input.TextArea
            placeholder="项目描述"
            rows={3}
            value={newProject.description}
            onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
          />
          <DatePicker.RangePicker
            style={{ width: '100%' }}
            placeholder={['开始日期', '结束日期']}
            onChange={(dates) => {
              if (dates) {
                setNewProject({
                  ...newProject,
                  startDate: dates[0]?.format('YYYY-MM-DD') || '',
                  endDate: dates[1]?.format('YYYY-MM-DD') || '',
                });
              }
            }}
          />
        </div>
      </Modal>
    </Layout>
  );
};

export default AppLayout;
