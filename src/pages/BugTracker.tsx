import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Card, Button, Table, Modal, Input, Select, Space, Popconfirm, Tag,
  Typography, Statistic, Row, Col, message, Alert,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, BugOutlined,
  ReloadOutlined, LinkOutlined, SettingOutlined, CopyOutlined,
} from '@ant-design/icons';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
  LineChart, Line,
} from 'recharts';
import dayjs from 'dayjs';
import { useProjectStore } from '../store/useProjectStore';
import { useBugStore } from '../store/useBugStore';
import { useMantisStore, MantisProject } from '../store/useMantisStore';
import { BugItem, BugSeverity, BugStatus } from '../types';
import { fetchDefectSummary, fetchBasicStats, fetchProjectList, DefectSummary, BasicStats } from '../utils/mantis';

const SEVERITY_CONFIG: Record<BugSeverity, { label: string; color: string; diBase: number }> = {
  critical: { label: '致命', color: '#f5222d', diBase: 10 },
  major: { label: '严重', color: '#fa8c16', diBase: 5 },
  minor: { label: '一般', color: '#1677ff', diBase: 2 },
  trivial: { label: '轻微', color: '#8c8c8c', diBase: 1 },
};

const STATUS_CONFIG: Record<BugStatus, { label: string; color: string }> = {
  open: { label: '未处理', color: '#f5222d' },
  confirmed: { label: '已确认', color: '#fa8c16' },
  fixing: { label: '修复中', color: '#1677ff' },
  resolved: { label: '已解决', color: '#52c41a' },
  closed: { label: '已关闭', color: '#8c8c8c' },
  reopened: { label: '重新打开', color: '#eb2f96' },
};

const calculateDI = (bugs: BugItem[]): number => bugs.reduce((sum, b) => sum + b.diValue, 0);

const BAR_COLORS = ['#f5222d', '#fa8c16', '#1677ff', '#52c41a', '#722ed1', '#13c2c2', '#eb2f96', '#faad14', '#2f54eb', '#a0d911'];

const BugTracker: React.FC = () => {
  const { currentProjectId } = useProjectStore();
  const { items: bugs, load: loadBugs, add, update, remove } = useBugStore();
  const mantis = useMantisStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBug, setEditingBug] = useState<BugItem | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [newProjectId, setNewProjectId] = useState('');
  const [newProjectName, setNewProjectName] = useState('');

  const [summary, setSummary] = useState<DefectSummary | null>(null);
  const [basicStats, setBasicStats] = useState<BasicStats | null>(null);
  const [mantisFetching, setMantisFetching] = useState(false);
  const [mantisError, setMantisError] = useState<string | null>(null);
  const [projectListLoading, setProjectListLoading] = useState(false);

  const [form, setForm] = useState({
    bugId: '', title: '', description: '',
    severity: 'major' as BugSeverity, status: 'open' as BugStatus,
    module: '', assignedTo: '',
    foundDate: dayjs().format('YYYY-MM-DD'), resolvedDate: '',
    diValue: 5,
  });

  useEffect(() => {
    loadBugs();
    mantis.load();
  }, []);

  const projectBugs = bugs.filter((b) => b.projectId === currentProjectId);

  const handleSave = () => {
    if (!form.title || !currentProjectId) return;
    if (editingBug) {
      update(editingBug.id, { ...form, bugId: editingBug.bugId });
    } else {
      add({ ...form, projectId: currentProjectId });
    }
    setModalOpen(false); setEditingBug(null);
    setForm({ bugId: '', title: '', description: '', severity: 'major', status: 'open', module: '', assignedTo: '', foundDate: dayjs().format('YYYY-MM-DD'), resolvedDate: '', diValue: 5 });
  };

  const openEdit = (bug: BugItem) => {
    setEditingBug(bug);
    setForm({ bugId: bug.bugId, title: bug.title, description: bug.description, severity: bug.severity, status: bug.status, module: bug.module, assignedTo: bug.assignedTo, foundDate: bug.foundDate, resolvedDate: bug.resolvedDate || '', diValue: bug.diValue });
    setModalOpen(true);
  };

  const handleFetchMantis = useCallback(async () => {
    if (!mantis.cookie || !mantis.projectId) {
      message.warning('请先填写 Mantis Cookie 和项目 ID');
      return;
    }
    setMantisFetching(true);
    setMantisError(null);
    try {
      const [defectResult, basicResult] = await Promise.all([
        fetchDefectSummary({
          cookie: mantis.cookie,
          projectId: mantis.projectId,
        }),
        fetchBasicStats({
          cookie: mantis.cookie,
          projectId: mantis.projectId,
        }),
      ]);
      setSummary(defectResult);
      setBasicStats(basicResult);
      message.success(`已拉取：基本统计 ${basicResult.totalBugs}个Bug | DI=${defectResult.diValue}，解决率=${basicResult.resolutionRate}%`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '请求失败';
      setMantisError(msg);
      message.error(msg);
    } finally {
      setMantisFetching(false);
    }
  }, [mantis.cookie, mantis.projectId, mantis.dateFrom, mantis.dateTo]);

  /** 从 Mantis 自动拉取项目列表 */
  const handleLoadProjects = useCallback(async () => {
    if (!mantis.cookie) {
      message.warning('请先填写 Mantis Cookie');
      return;
    }
    setProjectListLoading(true);
    try {
      const remoteProjects = await fetchProjectList(mantis.cookie);
      if (remoteProjects.length === 0) {
        message.warning('未获取到任何项目，请检查 Cookie 是否有效');
        return;
      }
      mantis.mergeRemoteProjects(remoteProjects);
      message.success(`已加载 ${remoteProjects.length} 个项目`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '加载失败';
      message.error(msg);
    } finally {
      setProjectListLoading(false);
    }
  }, [mantis.cookie]);

  const columns: ColumnsType<BugItem> = [
    { title: '故障编号', dataIndex: 'bugId', key: 'bugId', width: 100, render: (v) => v || '-' },
    { title: '标题', dataIndex: 'title', key: 'title', width: 250, ellipsis: true },
    { title: '严重度', dataIndex: 'severity', key: 'severity', width: 80, render: (v: BugSeverity) => <Tag color={SEVERITY_CONFIG[v].color}>{SEVERITY_CONFIG[v].label}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: (v: BugStatus) => <Tag color={STATUS_CONFIG[v].color}>{STATUS_CONFIG[v].label}</Tag> },
    { title: '模块', dataIndex: 'module', key: 'module', width: 100, render: (v) => v || '-' },
    { title: '负责人', dataIndex: 'assignedTo', key: 'assignedTo', width: 90, render: (v) => v || '-' },
    { title: '发现日期', dataIndex: 'foundDate', key: 'foundDate', width: 100 },
    { title: 'DI值', dataIndex: 'diValue', key: 'diValue', width: 70, align: 'right' },
    {
      title: '操作', key: 'actions', width: 100,
      render: (_, r) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="确定删除？" onConfirm={() => remove(r.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const totalDI = calculateDI(projectBugs);
  const openBugs = projectBugs.filter((b) => b.status !== 'resolved' && b.status !== 'closed');
  const resolvedBugs = projectBugs.filter((b) => b.status === 'resolved' || b.status === 'closed');

  const severityData = Object.entries(SEVERITY_CONFIG).map(([key, { label }]) => ({
    name: label, 未解决: openBugs.filter((b) => b.severity === key).length,
    已解决: resolvedBugs.filter((b) => b.severity === key).length,
  }));

  const moduleStats = useMemo(() => {
    const m = new Map<string, { module: string; di: number }>();
    projectBugs.forEach((b) => {
      if (b.status !== 'resolved' && b.status !== 'closed') {
        const name = b.module || '未分类';
        const e = m.get(name) || { module: name, di: 0 };
        e.di += b.diValue; m.set(name, e);
      }
    });
    return Array.from(m.values()).sort((a, b) => b.di - a.di);
  }, [projectBugs]);

  // Mantis 分类分布图表数据
  const categoryChartData = useMemo(() => {
    if (!summary?.categories) return [];
    return summary.categories.map((c) => ({
      name: c.name, 未解决: c.unresolved, 已解决: c.resolved,
    }));
  }, [summary]);

  // 周报文本
  const weeklyReportText = useMemo(() => {
    if (!summary || !basicStats) return '';
    const diValue = summary.diValue != null ? summary.diValue.toFixed(1) : '0';
    const activeModules = summary.categories.filter((c) => c.di > 0);
    const moduleText = activeModules.length > 0
      ? activeModules.map((c) => `${c.name}-${c.di.toFixed(1)}`).join('、')
      : '暂无模块DI数据';
    return `整体bug ${basicStats.totalBugs}个，遗留bug ${basicStats.unresolvedBugs}个，DI值 ${diValue}，解决率 ${basicStats.resolutionRate}%。\n各模块DI分布情况：${moduleText}`;
  }, [summary, basicStats]);

  const handleCopyReport = useCallback(async () => {
    if (!weeklyReportText) return;
    try {
      await navigator.clipboard.writeText(weeklyReportText);
      message.success('已复制到剪贴板');
    } catch {
      message.error('复制失败，请手动复制');
    }
  }, [weeklyReportText]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>故障管理</h2>
        <Space>
          <Button icon={<SettingOutlined />} onClick={() => setSettingsOpen(!settingsOpen)}>
            {settingsOpen ? '收起' : 'Mantis 设置'}
          </Button>
          <Button
            type="primary"
            icon={<ReloadOutlined spin={mantisFetching} />}
            loading={mantisFetching}
            onClick={handleFetchMantis}
            disabled={!mantis.cookie || !mantis.projectId}
          >
            拉取 Mantis 数据
          </Button>
        </Space>
      </div>

      {/* Mantis 设置 */}
      {settingsOpen && (
        <Card size="small" title={<><LinkOutlined /> Mantis 连接配置</>} style={{ marginBottom: 16 }}>
          <Row gutter={[12, 12]}>
            <Col xs={24} md={14}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
                Cookie (<code>s_issue_mgmt_v3</code>) — 粘贴 Value 列的值即可，系统会自动补全名称
              </div>
              <Input.Password
                placeholder="F12→Application→Cookies 中找到 s_issue_mgmt_v3，复制 Value"
                value={mantis.cookie}
                onChange={(e) => mantis.setCookie(e.target.value)}
                visibilityToggle
              />
            </Col>
            <Col xs={24} md={10}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>项目</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Select
                  style={{ flex: 1 }}
                  placeholder="选择项目"
                  value={mantis.projectId || undefined}
                  onChange={(id) => {
                    mantis.setProjectId(id);
                  }}
                  dropdownRender={(menu) => (
                    <>
                      {menu}
                      <div style={{ borderTop: '1px solid #f0f0f0', padding: '8px 12px' }}>
                        <Button
                          type="link"
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={() => {
                            setNewProjectId('');
                            setNewProjectName('');
                            setAddProjectOpen(true);
                          }}
                          block
                        >
                          手动添加项目
                        </Button>
                      </div>
                    </>
                  )}
                  optionRender={(opt) => (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{opt.label}</span>
                      <Popconfirm
                        title="确定删除该项目？"
                        onConfirm={(e) => {
                          e?.stopPropagation();
                          mantis.removeProject(opt.value as string);
                        }}
                        onCancel={(e) => e?.stopPropagation()}
                      >
                        <Button
                          type="link"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={(e) => e.stopPropagation()}
                          style={{ padding: 0 }}
                        />
                      </Popconfirm>
                    </div>
                  )}
                  options={mantis.projects.map((p) => ({
                    label: `${p.name} (${p.id.slice(0, 8)}…)`,
                    value: p.id,
                  }))}
                />
                <Button
                  icon={<ReloadOutlined spin={projectListLoading} />}
                  loading={projectListLoading}
                  onClick={handleLoadProjects}
                  disabled={!mantis.cookie}
                  title="从 Mantis 自动加载项目列表"
                >
                  加载
                </Button>
              </div>
            </Col>
          </Row>
          <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
            Cookie 存于本地，过期后需到 F12 → Application → Cookies → mantis.sugon.com 重新获取
          </div>
        </Card>
      )}

      {/* 添加项目弹窗 */}
      <Modal
        title="添加 Mantis 项目"
        open={addProjectOpen}
        onCancel={() => setAddProjectOpen(false)}
        onOk={() => {
          if (!newProjectId.trim() || !newProjectName.trim()) {
            message.warning('请填写项目 ID 和项目名称');
            return;
          }
          mantis.addProject(newProjectId.trim(), newProjectName.trim());
          setAddProjectOpen(false);
          message.success('项目已添加');
        }}
        okText="添加"
        cancelText="取消"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
          <div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>项目名称</div>
            <Input
              placeholder="例如：海南岛_星载计算机项目"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onPressEnter={() => {
                if (newProjectId.trim() && newProjectName.trim()) {
                  mantis.addProject(newProjectId.trim(), newProjectName.trim());
                  setAddProjectOpen(false);
                  message.success('项目已添加');
                }
              }}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
              项目 ID — 从 Mantis 页面 URL 或 Network 请求中的 <code>proj_id_arr</code> 参数获取
            </div>
            <Input
              placeholder="69d88cca1ddd155f42600ef0"
              value={newProjectId}
              onChange={(e) => setNewProjectId(e.target.value)}
              onPressEnter={() => {
                if (newProjectId.trim() && newProjectName.trim()) {
                  mantis.addProject(newProjectId.trim(), newProjectName.trim());
                  setAddProjectOpen(false);
                  message.success('项目已添加');
                }
              }}
            />
          </div>
        </div>
      </Modal>

      {mantisError && (
        <Alert
          type="error"
          message="Mantis 连接失败"
          description={mantisError}
          showIcon closable
          style={{ marginBottom: 16 }}
          onClose={() => setMantisError(null)}
        />
      )}

      {/* ==== Mantis 项目概览（合并卡片） ==== */}
      {(summary || basicStats) && (
        <Card
          size="small"
          title={<><LinkOutlined /> Mantis 项目概览</>}
          style={{ marginBottom: 16 }}
        >
          {/* 基本统计 */}
          {basicStats && (
            <Row gutter={[24, 12]} style={{ marginBottom: 20 }}>
              <Col xs={24} sm={8}>
                <Statistic
                  title="Bug 总个数"
                  value={basicStats.totalBugs}
                  valueStyle={{ color: '#1677ff', fontSize: 28 }}
                />
              </Col>
              <Col xs={24} sm={8}>
                <Statistic
                  title="遗留 Bug"
                  value={basicStats.unresolvedBugs}
                  valueStyle={{ color: basicStats.unresolvedBugs > 0 ? '#f5222d' : '#52c41a', fontSize: 28 }}
                />
              </Col>
              <Col xs={24} sm={8}>
                <Statistic
                  title="Bug 解决率"
                  value={basicStats.resolutionRate}
                  suffix="%"
                  valueStyle={{
                    color: basicStats.resolutionRate >= 80 ? '#52c41a'
                      : basicStats.resolutionRate >= 50 ? '#faad14' : '#f5222d',
                    fontSize: 28,
                  }}
                />
              </Col>
            </Row>
          )}

          {/* DI 总览 */}
          {summary && (
            <>
              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
                <Row gutter={[24, 12]} style={{ marginBottom: 16 }}>
                  <Col xs={24} md={8}>
                    <Statistic
                      title="总 DI 值"
                      value={summary.totalDi}
                      precision={1}
                      valueStyle={{ color: summary.totalDi > 0 ? '#f5222d' : '#52c41a', fontSize: 28 }}
                    />
                  </Col>
                  {summary.categories.length > 0 && (
                    <Col xs={24} md={16}>
                      <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>各模块 DI</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', minHeight: 60 }}>
                        {summary.categories.map((c, idx) => (
                          <Tag
                            key={c.name}
                            color={BAR_COLORS[idx % BAR_COLORS.length]}
                            style={{ fontSize: 14, padding: '4px 12px', margin: 0 }}
                          >
                            {c.name}: <b>{c.di.toFixed(1)}</b>
                          </Tag>
                        ))}
                      </div>
                    </Col>
                  )}
                </Row>

                {/* 各模块 DI 柱状图 */}
                {summary.categories.length > 0 && (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 8 }}>各模块 DI 值</div>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={summary.categories.map((c) => ({ name: c.name, di: c.di }))}>
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis />
                        <Tooltip formatter={(v: number) => [v.toFixed(1), 'DI']} />
                        <Bar dataKey="di" radius={[4, 4, 0, 0]}>
                          {summary.categories.map((_, idx) => (
                            <Cell key={idx} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* 缺陷指数趋势折线图 */}
                {summary.trend.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 8 }}>缺陷指数趋势</div>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={summary.trend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis />
                        <Tooltip formatter={(v: number) => [v.toFixed(1), 'DI']} />
                        <Line
                          type="monotone"
                          dataKey="value"
                          name="DI"
                          stroke="#f5222d"
                          strokeWidth={2}
                          dot={{ r: 3, fill: '#f5222d' }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </>
          )}
        </Card>
      )}

      {/* ==== 周报摘要 ==== */}
      {(summary && basicStats) && (
        <Card
          size="small"
          title="周报摘要"
          style={{ marginBottom: 16 }}
          extra={
            <Button
              size="small"
              icon={<CopyOutlined />}
              onClick={handleCopyReport}
            >
              一键复制
            </Button>
          }
        >
          <Typography.Paragraph
            style={{
              margin: 0,
              fontSize: 15,
              lineHeight: 2,
              whiteSpace: 'pre-wrap',
              background: '#fafafa',
              padding: '12px 16px',
              borderRadius: 6,
              fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
            }}
          >
            {weeklyReportText}
          </Typography.Paragraph>
        </Card>
      )}

      {/* 无数据提示 */}
      {!summary && !basicStats && !mantisFetching && (
        <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
          <BugOutlined style={{ fontSize: 48, marginBottom: 12 }} />
          <div>请配置 Mantis 连接后拉取项目数据</div>
        </div>
      )}
    </div>
  );
};

export default BugTracker;
