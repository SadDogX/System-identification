import type { ReactNode } from 'react';
import { PageHeader } from '@app/shared/ui';

interface ScheduleControlPanelProps {
  title: string;
  subtitle?: string;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function ScheduleControlPanel({ title, subtitle, collapsed, onToggle, children }: ScheduleControlPanelProps) {
  return (
    <div className={`schedule-control-panel${collapsed ? ' collapsed' : ''}`}>
      <div className="schedule-control-head">
        <PageHeader title={title} subtitle={collapsed ? undefined : subtitle} />
        <button type="button" className="btn btn-outline" onClick={onToggle}>
          {collapsed ? 'Развернуть' : 'Свернуть'}
        </button>
      </div>
      {!collapsed && children}
    </div>
  );
}
