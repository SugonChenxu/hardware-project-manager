import React, { useEffect } from 'react';
import { Card, Row, Col, Statistic, Progress, List, Tag, Empty } from 'antd';
import {
  ProjectOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  BugOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import { useProjectStore } from '../store/useProjectStore';
import { useTaskStore } from '../store/useTaskStore';
import { useBugStore } from '../store/useBugStore';
import { useCostStore } from '../store/useCostStore';
import { useTodoStore } from '../store/useTodoStore';
import { formatDate } from '../utils/storage';

const Dashboard: React.FC = () => {
  const { projects, currentProjectId, load: loadProjects } = useProjectStore();
  const { tasks, load: loadTasks } = useTaskStore();
  const { items: bugs, load: loadBugs } = useBugStore();
  const { items: costs, load: loadCosts } = useCostStore();
  const { todos, load: loadTodos } = useTodoStore();

  useEffect(() => {
    loadProjects();
    loadTasks();
    loadBugs();
    loadCosts();
    loadTodos();
  }, []);

  const projectTasks = tasks.filter((t) => t.projectId === currentProjectId);
  const projectBugs = bugs.filter((b) => b.projectId === currentProjectId);
  const projectCosts = costs.filter((c) => c.projectId === currentProjectId);
  const today = formatDate(new Date().toISOString());
  const todayTodos = todos.filter((t) => t.date === today);

  const taskStats = {
    total: projectTasks.length,
    done: projectTasks.filter((t) => t.status === 'done').length,
    inProgress: projectTasks.filter((t) => t.status === 'in_progress').length,
    todo: projectTasks.filter((t) => t.status === 'todo').length,
  };

  const bugStats = {
    total: projectBugs.length,
    open: projectBugs.filter((b) => b.status === 'open').length,
    resolved: projectBugs.filter((b) => b.status === 'resolved' || b.status === 'closed').length,
    critical: projectBugs.filter((b) => b.severity === 'critical').length,
  };

  const costSummary = projectCosts.reduce(
    (acc, c) => ({
      estimated: acc.estimated + c.estimatedCost,
      actual: acc.actual + c.actualCost,
      manHours: acc.manHours + c.manHours,
    }),
    { estimated: 0, actual: 0, manHours: 0 }
  );

  const taskProgress = taskStats.total > 0 ? Math.round((taskStats.done / taskStats.total) * 100) : 0;
  const bugProgress = bugStats.total > 0 ? Math.round((bugStats.resolved / bugStats.total) * 100) : 0;

  const statusColors: Record<string, string> = {
    planning: '#faad14',
    active: '#1677ff',
    paused: '#999',
    completed: '#52c41a',
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>项目概览</h2>

      {/* 项目列表 */}
      {projects.length === 0 ? (
        <Empty description="暂无项目，请先创建一个项目" />
      ) : (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {projects.map((p) => (
              <Col key={p.id} xs={24} sm={12} lg={8}>
                <Card
                  size="small"
                  title={p.name}
                  style={{
                    borderColor: p.id === currentProjectId ? '#1677ff' : undefined,
                    borderWidth: p.id === currentProjectId ? 2 : 1,
                  }}
                  extra={<Tag color={statusColors[p.status]}>{p.status === 'planning' ? '规划中' : p.status === 'active' ? '进行中' : p.status === 'paused' ? '已暂停' : '已完成'}</Tag>}
                >
                  <p style={{ color: '#666', marginBottom: 8 }}>
                    {formatDate(p.startDate)} ~ {formatDate(p.endDate)}
                  </p>
                  {p.description && <p style={{ color: '#999', fontSize: 13 }}>{p.description}</p>}
                </Card>
              </Col>
            ))}
          </Row>

          {currentProjectId && (
            <>
              {/* 统计卡片 */}
              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={12} sm={6}>
                  <Card>
                    <Statistic
                      title="任务进度"
                      value={taskProgress}
                      suffix="%"
                      prefix={<ProjectOutlined />}
                    />
                    <Progress percent={taskProgress} size="small" style={{ marginTop: 8 }} />
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card>
                    <Statistic
                      title="Bug修复率"
                      value={bugProgress}
                      suffix="%"
                      prefix={<BugOutlined />}
                    />
                    <Progress percent={bugProgress} size="small" strokeColor="#52c41a" style={{ marginTop: 8 }} />
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card>
                    <Statistic
                      title="今日待办"
                      value={todayTodos.filter((t) => !t.completed).length}
                      prefix={<CheckCircleOutlined />}
                    />
                    <span style={{ fontSize: 12, color: '#999' }}>
                      共 {todayTodos.length} 项，已完成 {todayTodos.filter((t) => t.completed).length} 项
                    </span>
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card>
                    <Statistic
                      title="预算合计"
                      value={costSummary.estimated}
                      precision={0}
                      prefix="¥"
                      suffix={<DollarOutlined />}
                    />
                    <span style={{ fontSize: 12, color: '#999' }}>
                      实际 ¥{costSummary.actual.toLocaleString()} | {costSummary.manHours}人时
                    </span>
                  </Card>
                </Col>
              </Row>

              {/* 近期任务 & Bug */}
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={12}>
                  <Card title="待处理任务" size="small">
                    <List
                      size="small"
                      dataSource={projectTasks.filter((t) => t.status !== 'done').slice(0, 8)}
                      renderItem={(t) => (
                        <List.Item>
                          <div>
                            <Tag
                              color={
                                t.status === 'todo' ? 'default' : t.status === 'in_progress' ? 'processing' : 'warning'
                              }
                            >
                              {t.status === 'todo' ? '待办' : t.status === 'in_progress' ? '进行中' : '审核中'}
                            </Tag>
                            {t.title}
                          </div>
                        </List.Item>
                      )}
                      locale={{ emptyText: '暂无待处理任务' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card title="未解决Bug" size="small">
                    <List
                      size="small"
                      dataSource={projectBugs.filter((b) => b.status !== 'resolved' && b.status !== 'closed').slice(0, 8)}
                      renderItem={(b) => (
                        <List.Item>
                          <div>
                            <Tag
                              color={
                                b.severity === 'critical'
                                  ? 'red'
                                  : b.severity === 'major'
                                  ? 'orange'
                                  : b.severity === 'minor'
                                  ? 'blue'
                                  : 'default'
                              }
                            >
                              {b.severity}
                            </Tag>
                            {b.title}
                            <span style={{ marginLeft: 8, color: '#999', fontSize: 12 }}>
                              DI: {b.diValue}
                            </span>
                          </div>
                        </List.Item>
                      )}
                      locale={{ emptyText: '暂无未解决Bug' }}
                    />
                  </Card>
                </Col>
              </Row>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default Dashboard;
