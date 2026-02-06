import type { AppState, TabId } from '../types';

interface TabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  appState: AppState;
  demoPhase?: string;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'webcam', label: 'Draw' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'odyssey', label: 'Odyssey' },
  { id: 'edit', label: 'Edit' },
];

export function TabBar({ activeTab, onTabChange, appState, demoPhase }: TabBarProps) {
  return (
    <div className="tab-bar">
      {TABS.map((tab) => {
        const showActivity =
          (tab.id === 'pipeline' && appState === 'GENERATING') ||
          (tab.id === 'odyssey' && appState === 'STREAMING') ||
          (tab.id === 'demo' && (demoPhase === 'generating' || demoPhase === 'streaming'));

        return (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'tab-active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
            {showActivity && <span className="tab-activity" />}
          </button>
        );
      })}
    </div>
  );
}
