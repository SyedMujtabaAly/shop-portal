import { useState } from 'react';
import SubTabs from '../components/SubTabs.jsx';
import Products from './Products.jsx';
import Companies from './Companies.jsx';

/**
 * Groups Products and Companies under one top-level tab, so the header does not
 * grow a tab for every table in the database.
 *
 * `refreshKey` forces the Products page to reload its company dropdown after a
 * company is added or switched off on the neighbouring tab.
 */
export default function Catalog({ readOnly = false }) {
  const [tab, setTab] = useState('products');
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="page">
      <div className="page__head">
        <h1 className="page__title">Stock &amp; prices</h1>
      </div>

      <SubTabs
        tabs={[
          { id: 'products', label: 'Products' },
          { id: 'companies', label: 'Companies' }
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'products' && <Products key={refreshKey} readOnly={readOnly} />}
      {tab === 'companies' && <Companies onChanged={() => setRefreshKey((k) => k + 1)} readOnly={readOnly} />}
    </div>
  );
}
