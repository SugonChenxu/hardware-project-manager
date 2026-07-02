import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppLayout from './components/AppLayout';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import Gantt from './pages/Gantt';
import BOM from './pages/BOM';
import MeetingNotes from './pages/MeetingNotes';
import WeeklyReport from './pages/WeeklyReport';
import CostEstimate from './pages/CostEstimate';
import BugTracker from './pages/BugTracker';
import PlanSchedule from './pages/PlanSchedule';

const App: React.FC = () => {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
        },
      }}
    >
      <AntApp>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="gantt" element={<Gantt />} />
              <Route path="bom" element={<BOM />} />
              <Route path="meetings" element={<MeetingNotes />} />
              <Route path="reports" element={<WeeklyReport />} />
              <Route path="costs" element={<CostEstimate />} />
              <Route path="bugs" element={<BugTracker />} />
              <Route path="plan" element={<PlanSchedule />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
};

export default App;
