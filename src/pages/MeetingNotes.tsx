import React, { useEffect, useState } from 'react';
import {
  Card, Button, Input, Modal, Space, message, Empty, Tag, Typography, Tooltip,
} from 'antd';
import {
  PlusOutlined, LinkOutlined, FileTextOutlined, FileSearchOutlined, 
  DeleteOutlined, FileTextTwoTone, ExportOutlined,
} from '@ant-design/icons';
import useMeetingNoteStore from '../store/useMeetingNoteStore';
import { useProjectStore } from '../store/useProjectStore';
import { MeetingNote } from '../types';

const { TextArea } = Input;
const { Paragraph, Title } = Typography;

const MeetingNotes: React.FC = () => {
  const { currentProjectId } = useProjectStore();
  const {
    notes, load, getByProject, addNote, updateNote, deleteNote,
    importFromTencentMeeting, generateWeeklyReport,
  } = useMeetingNoteStore();

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [meetingIdInput, setMeetingIdInput] = useState('');
  const [viewTranscriptOpen, setViewTranscriptOpen] = useState(false);
  const [viewSummaryOpen, setViewSummaryOpen] = useState(false);
  const [viewReportOpen, setViewReportOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<MeetingNote | null>(null);
  const [weeklyReport, setWeeklyReport] = useState('');

  useEffect(() => {
    load();
  }, []);

  const projectNotes = currentProjectId ? getByProject(currentProjectId) : [];

  // 导入腾讯会议
  const handleImport = async () => {
    if (!meetingIdInput.trim()) {
      message.warning('请输入会议 ID');
      return;
    }
    if (!currentProjectId) {
      message.warning('请先选择项目');
      return;
    }

    try {
      await importFromTencentMeeting(currentProjectId, meetingIdInput.trim());
      message.success('导入成功');
      setImportModalOpen(false);
      setMeetingIdInput('');
    } catch (e) {
      message.error('导入失败');
    }
  };

  // 查看原始记录
  const handleViewTranscript = (note: MeetingNote) => {
    setSelectedNote(note);
    setViewTranscriptOpen(true);
  };

  // 查看 AI 总结
  const handleViewSummary = (note: MeetingNote) => {
    setSelectedNote(note);
    setViewSummaryOpen(true);
  };

  // 生成周报
  const handleGenerateReport = () => {
    if (!currentProjectId) {
      message.warning('请先选择项目');
      return;
    }

    // 计算本周日期范围
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay() + 1); // 本周一
    const end = new Date(start);
    end.setDate(start.getDate() + 6); // 本周日

    const report = generateWeeklyReport(
      currentProjectId,
      start.toISOString().split('T')[0],
      end.toISOString().split('T')[0]
    );

    setWeeklyReport(report);
    setViewReportOpen(true);
  };

  return (
    <div>
      {/* 工具栏 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space>
          <Button
            type="primary"
            icon={<LinkOutlined />}
            onClick={() => setImportModalOpen(true)}
          >
            导入会议链接
          </Button>
          <Button
            icon={<FileTextOutlined />}
            onClick={handleGenerateReport}
            disabled={projectNotes.length === 0}
          >
            生成周报
          </Button>
        </Space>
      </Card>

      {/* 会议卡片列表 */}
      {projectNotes.length === 0 ? (
        <Empty description="暂无会议记录，点击「导入会议链接」开始" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 16 }}>
          {projectNotes.map((note: MeetingNote) => (
            <Card
              key={note.id}
              size="small"
              title={
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    📅 {note.title}
                  </div>
                  <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                    {note.date}
                  </div>
                </div>
              }
              extra={
                <Tooltip title="删除">
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => {
                      deleteNote(note.id);
                      message.success('已删除');
                    }}
                  />
                </Tooltip>
              }
            >
              {/* 会议链接 */}
              <div style={{ marginBottom: 8 }}>
                <LinkOutlined style={{ marginRight: 4 }} />
                <a href={note.meetingUrl} target="_blank" rel="noopener noreferrer">
                  腾讯会议链接
                </a>
              </div>

              {/* 参会人员 */}
              <div style={{ marginBottom: 8 }}>
                <strong>参会人员：</strong>
                {note.attendees.join('、')}
              </div>

              {/* 状态标签 */}
              <div style={{ marginBottom: 12 }}>
                {note.aiTranscript && (
                  <Tag color="blue" icon={<FileTextTwoTone />}>
                    AI 记录已生成
                  </Tag>
                )}
                {note.aiSummary && (
                  <Tag color="green">
                    AI 总结已生成
                  </Tag>
                )}
                {note.weeklyReportGenerated && (
                  <Tag color="purple">
                    已生成周报
                  </Tag>
                )}
              </div>

              {/* 操作按钮 */}
              <Space>
                {note.aiTranscript && (
                  <Button
                    size="small"
                    icon={<FileTextOutlined />}
                    onClick={() => handleViewTranscript(note)}
                  >
                    查看记录
                  </Button>
                )}
                {note.aiSummary && (
                  <Button
                    size="small"
                    icon={<FileSearchOutlined />}
                    onClick={() => handleViewSummary(note)}
                  >
                    查看总结
                  </Button>
                )}
                <Button
                  size="small"
                  type="primary"
                  icon={<ExportOutlined />}
                  onClick={() => {
                    const report = generateWeeklyReport(
                      note.projectId,
                      note.date,
                      note.date
                    );
                    setWeeklyReport(report);
                    setViewReportOpen(true);
                  }}
                >
                  生成周报
                </Button>
              </Space>
            </Card>
          ))}
        </div>
      )}

      {/* 导入会议链接弹窗 */}
      <Modal
        title="导入腾讯会议链接"
        open={importModalOpen}
        onOk={handleImport}
        onCancel={() => {
          setImportModalOpen(false);
          setMeetingIdInput('');
        }}
        okText="导入"
        cancelText="取消"
      >
        <div style={{ padding: '16px 0' }}>
          <div style={{ marginBottom: 8 }}>会议 ID 或链接：</div>
          <Input
            value={meetingIdInput}
            onChange={(e) => setMeetingIdInput(e.target.value)}
            placeholder="输入腾讯会议 ID 或完整链接"
            onPressEnter={handleImport}
          />
          <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
            示例：123-456-789 或 https://meeting.tencent.com/dm/...
          </div>
        </div>
      </Modal>

      {/* 查看 AI 原始记录弹窗 */}
      <Modal
        title="AI 会议原始记录"
        open={viewTranscriptOpen}
        onCancel={() => setViewTranscriptOpen(false)}
        footer={null}
        width={800}
      >
        {selectedNote && (
          <div style={{ maxHeight: 600, overflow: 'auto' }}>
            <Typography>
              <Paragraph style={{ whiteSpace: 'pre-wrap' }}>
                {selectedNote.aiTranscript}
              </Paragraph>
            </Typography>
          </div>
        )}
      </Modal>

      {/* 查看 AI 总结弹窗 */}
      <Modal
        title="AI 会议总结"
        open={viewSummaryOpen}
        onCancel={() => setViewSummaryOpen(false)}
        footer={null}
        width={600}
      >
        {selectedNote && selectedNote.aiSummary && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Title level={5}>本周进展</Title>
              <ul>
                {selectedNote.aiSummary.progress.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
            <div style={{ marginBottom: 16 }}>
              <Title level={5}>风险与问题</Title>
              <ul>
                {selectedNote.aiSummary.issues.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
            <div>
              <Title level={5}>下周计划</Title>
              <ul>
                {selectedNote.aiSummary.plans.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Modal>

      {/* 周报预览弹窗 */}
      <Modal
        title="项目周报"
        open={viewReportOpen}
        onCancel={() => setViewReportOpen(false)}
        footer={null}
        width={800}
      >
        <div style={{ maxHeight: 600, overflow: 'auto' }}>
          <Typography>
            <Paragraph style={{ whiteSpace: 'pre-wrap' }}>
              {weeklyReport}
            </Paragraph>
          </Typography>
        </div>
      </Modal>
    </div>
  );
};

export default MeetingNotes;
