import { useState } from 'react';

interface TabContainerProps {
  tabs: { label: string; content: React.ReactNode }[];
}

export default function TabContainer({ tabs }: TabContainerProps) {
  const [active, setActive] = useState(0);

  return (
    <div>
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex -mb-px">
          {tabs.map((tab, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                active === i
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="p-6">{tabs[active].content}</div>
    </div>
  );
}
