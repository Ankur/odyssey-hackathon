import type { AppState, TabId } from '../types';

interface TabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  appState: AppState;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'webcam', label: 'Draw' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'odyssey', label: 'Odyssey' },
];

export function TabBar({ activeTab, onTabChange, appState }: TabBarProps) {
  return (
    <div className="tab-bar">
      {TABS.map((tab) => {
        const showActivity =
          (tab.id === 'pipeline' && appState === 'GENERATING') ||
          (tab.id === 'odyssey' && appState === 'STREAMING');

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
