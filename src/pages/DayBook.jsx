import { useState } from 'react';
import SubTabs from '../components/SubTabs.jsx';
import DaySummary from './DaySummary.jsx';
import Expenses from './Expenses.jsx';
import ExpenseCategories from './ExpenseCategories.jsx';

/**
 * "Roznamcha" — the day book.
 *
 * Groups the three screens that belong to running the day, so the top bar does
 * not grow another two tabs. Adding an expense and closing the day are the same
 * activity a few minutes apart.
 */
export default function DayBook({ readOnly = false }) {
  const [tab, setTab] = useState('day');
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="page">
      <div className="page__head">
        <h1 className="page__title">Day book</h1>
      </div>

      <SubTabs
        tabs={[
          { id: 'day', label: 'End of day' },
          { id: 'expenses', label: 'Expenses' },
          { id: 'categories', label: 'Categories' }
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'day' && <DaySummary readOnly={readOnly} />}
      {tab === 'expenses' && <Expenses key={refreshKey} readOnly={readOnly} />}
      {tab === 'categories' && (
        <ExpenseCategories onChanged={() => setRefreshKey((k) => k + 1)} readOnly={readOnly} />
      )}
    </div>
  );
}
