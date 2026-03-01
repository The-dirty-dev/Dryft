import { useState } from 'react';
import type { ReactNode } from 'react';
import { classNames } from '@/utils';

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  defaultTabId?: string;
  onChange?: (id: string) => void;
  className?: string;
}

export default function Tabs({ tabs, defaultTabId, onChange, className }: TabsProps) {
  const initialTab = defaultTabId || tabs[0]?.id;
  const [activeTab, setActiveTab] = useState(initialTab);

  const handleSelect = (id: string) => {
    setActiveTab(id);
    onChange?.(id);
  };

  const active = tabs.find((tab) => tab.id === activeTab) || tabs[0];

  return (
    <div className={classNames('space-y-4', className)}>
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            disabled={tab.disabled}
            onClick={() => handleSelect(tab.id)}
            className={classNames(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-primary text-white'
                : 'bg-surface border border-border text-muted hover:text-white',
              tab.disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div>{active?.content}</div>
    </div>
  );
}
