import React, { useEffect, useState } from 'react';
import {
  Card, Button, Modal, Input, DatePicker, Tag, Space, Popconfirm, Empty, List, Divider, Select,
} from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, FileTextOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import dayjs from 'dayjs';
import { useProjectStore } from '../store/useProjectStore';
import { useReportStore } from '../store/useReportStore';
import { WeeklyReport } from '../types';
import { formatDate, getWeekRange } from '../utils/storage';

const WeeklyReportPage: React.FC = () => {
  const { currentProjectId } = useProjectStore();
  const { reports, load, add, update, remove } = useReportStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<WeeklyReport | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState('');

  const { start: thisWeekStart, end: thisWeekEnd } = getWeekRange();

  const [form, setForm] = useState({
    weekStart: thisWeekStart,
    weekEnd: thisWeekEnd,
    summary: '',
    tasksCompleted: [] as string[],
    tasksPlanned: [] as string[],
    risks: [] as string[],
    issues: [] as string[],
  });

  useEffect(() => {
    load();
  }, []);

  const projectReports = reports.filter((r) => r.projectId === currentProjectId);

  const handleSave = () => {
    if (!currentProjectId) return;
    if (editingReport) {
      update(editingReport.id, form);
    } else {
      add({ ...form, projectId: currentProjectId });
    }
    setModalOpen(false);
    setEditingReport(null);
  };

  const openEdit = (report: WeeklyReport) => {
    setEditingReport(report);
    setForm({
      weekStart: report.weekStart,
      weekEnd: report.weekEnd,
      summary: report.summary,
      tasksCompleted: report.tasksCompleted,
      tasksPlanned: report.tasksPlanned,
      risks: report.risks,
      issues: report.issues,
    });
    setModalOpen(true);
  };

  const generatePreview = (report: WeeklyReport) => {
    const content = `# ${report.weekStart} ~ ${report.weekEnd} 周报

## 本周概要

${report.summary || '暂无'}

## 本周完成任务

${report.tasksCompleted.length > 0 ? report.tasksCompleted.map((t) => `- ${t}`).join('\n') : '- 暂无'}

## 下周计划

${report.tasksPlanned.length > 0 ? report.tasksPlanned.map((t) => `- ${t}`).join('\n') : '- 暂无'}

## 风险与问题

### 风险
${report.risks.length > 0 ? report.risks.map((r) => `- ${r}`).join('\n') : '- 暂无'}

### 问题
${report.issues.length > 0 ? report.issues.map((i) => `- ${i}`).join('\n') : '- 暂无'}
`;
    setPreviewContent(content);
    setPreviewOpen(true);
  };

  const generateForCurrentWeek = () => {
    setEditingReport(null);
    setForm({
      weekStart: thisWeekStart,
      weekEnd: thisWeekEnd,
      summary: '',
      tasksCompleted: [],
      tasksPlanned: [],
      risks: [],
      issues: [],
    });
    setModalOpen(true);
  };

  const renderTags = (items: string[], color: string, setter: (items: string[]) => void) => (
    <Select
      mode="tags"
      style={{ width: '100%' }}
      placeholder="输入内容后回车"
      value={items}
      onChange={setter}
      tokenSeparators={[',']}
    />
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>项目周报</h2>
        <Space>
          <Button onClick={generateForCurrentWeek} icon={<PlusOutlined />}>
            生成本周周报
          </Button>
        </Space>
      </div>

      {projectReports.length === 0 ? (
        <Empty description="暂无周报">
          <Button type="primary" onClick={generateForCurrentWeek}>
            创建第一篇周报
          </Button>
        </Empty>
      ) : (
        <List
          dataSource={projectReports}
          renderItem={(report) => (
            <Card
              size="small"
              style={{ marginBottom: 12 }}
              title={
                <Space>
                  <FileTextOutlined />
                  <span>{report.weekStart} ~ {report.weekEnd}</span>
                </Space>
              }
              extra={
                <Space>
                  <Button size="small" onClick={() => generatePreview(report)}>预览</Button>
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(report)}>编辑</Button>
                  <Popconfirm title="确定删除？" onConfirm={() => remove(report.id)}>
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              }
            >
              <div style={{ fontSize: 13 }}>
                {report.summary && <p style={{ color: '#666' }}><strong>概要：</strong>{report.summary}</p>}
                {report.tasksCompleted.length > 0 && (
                  <p>
                    <Tag color="green">完成 {report.tasksCompleted.length} 项</Tag>
                    {report.tasksCompleted.slice(0, 5).join('、')}
                    {report.tasksCompleted.length > 5 && '...'}
                  </p>
                )}
                {report.tasksPlanned.length > 0 && (
                  <p>
                    <Tag color="blue">计划 {report.tasksPlanned.length} 项</Tag>
                    {report.tasksPlanned.slice(0, 5).join('、')}
                    {report.tasksPlanned.length > 5 && '...'}
                  </p>
                )}
                {(report.risks.length > 0 || report.issues.length > 0) && (
                  <Space size={4}>
                    {report.risks.length > 0 && <Tag color="orange">{report.risks.length} 项风险</Tag>}
                    {report.issues.length > 0 && <Tag color="red">{report.issues.length} 项问题</Tag>}
                  </Space>
                )}
              </div>
            </Card>
          )}
        />
      )}

      {/* Edit Modal */}
      <Modal
        title={editingReport ? '编辑周报' : '新建周报'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => { setModalOpen(false); setEditingReport(null); }}
        okText="保存"
        cancelText="取消"
        width={700}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 16 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <DatePicker
              value={dayjs(form.weekStart)}
              onChange={(d) => d && setForm({ ...form, weekStart: d.format('YYYY-MM-DD') })}
              style={{ flex: 1 }}
              placeholder="周一开始"
            />
            <DatePicker
              value={dayjs(form.weekEnd)}
              onChange={(d) => d && setForm({ ...form, weekEnd: d.format('YYYY-MM-DD') })}
              style={{ flex: 1 }}
              placeholder="周日结束"
            />
          </div>
          <Input.TextArea
            placeholder="本周概要"
            rows={3}
            value={form.summary}
            onChange={(e) => setForm({ ...form, summary: e.target.value })}
          />
          <div>
            <span style={{ fontSize: 13, color: '#666' }}>本周完成任务</span>
            {renderTags(form.tasksCompleted, 'green', (items) => setForm({ ...form, tasksCompleted: items }))}
          </div>
          <div>
            <span style={{ fontSize: 13, color: '#666' }}>下周计划</span>
            {renderTags(form.tasksPlanned, 'blue', (items) => setForm({ ...form, tasksPlanned: items }))}
          </div>
          <div>
            <span style={{ fontSize: 13, color: '#666' }}>风险项</span>
            {renderTags(form.risks, 'orange', (items) => setForm({ ...form, risks: items }))}
          </div>
          <div>
            <span style={{ fontSize: 13, color: '#666' }}>问题项</span>
            {renderTags(form.issues, 'red', (items) => setForm({ ...form, issues: items }))}
          </div>
        </div>
      </Modal>

      {/* Preview Modal */}
      <Modal
        title="周报预览"
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        footer={<Button onClick={() => setPreviewOpen(false)}>关闭</Button>}
        width={700}
      >
        <div style={{ fontSize: 14, lineHeight: 1.8, maxHeight: '60vh', overflow: 'auto' }}>
          <ReactMarkdown>{previewContent}</ReactMarkdown>
        </div>
      </Modal>
    </div>
  );
};

export default WeeklyReportPage;
