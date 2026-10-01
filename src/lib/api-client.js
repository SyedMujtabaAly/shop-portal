/* Browser transport for the legacy IPC-shaped frontend.
 *
 * When the Node API is available calls are forwarded unchanged. The source
 * snapshot does not include its database/IPC layer, so development falls back
 * to a small read-only workspace instead of leaving users with a blank page.
 */
let backendUnavailable = false;

const emptySummary = {
  count: 0, totalPaisa: 0, paidPaisa: 0, outstandingPaisa: 0, profitPaisa: 0,
  cashPaisa: 0, bankPaisa: 0, creditPaisa: 0
};

const demoUser = { id: 'local-owner', username: 'owner', fullName: 'Store Owner', role: 'admin' };

function localResult(domain, method, args) {
  const key = `${domain}:${method}`;
  const staticResults = {
    'dataFolder:status': { ok: true, data: { ready: true, folder: 'Browser workspace' } },
    'db:open': { ok: true },
    'db:info': { ok: true, data: { open: true, driver: 'browser', path: 'Local preview workspace' } },
    'db:selfTest': { ok: true, data: [] },
    'auth:status': { ok: true, data: { adminCreated: true, shopName: 'Shopkeeper', user: demoUser } },
    'auth:hasRecoveryKey': { ok: true, data: false },
    'auth:logout': { ok: true },
    'settings:get': { ok: true, data: {} },
    'settings:set': { ok: true },
    'sales:today': { ok: true, data: emptySummary },
    'sales:summary': { ok: true, data: emptySummary },
    'purchases:summary': { ok: true, data: emptySummary },
    'expenses:summary': { ok: true, data: emptySummary },
    'reports:warehouse': { ok: true, data: { items: [], totals: { grandCostPaisa: 0, grandSaleValuePaisa: 0, grandDamageMl: 0 } } },
    'udhaar:alerts': { ok: true, data: { needsAttention:0, dueSoonDays:3, customers:{total:0,count:0,overdueTotal:0,overdueCount:0,urgent:[]}, suppliers:{total:0,count:0,overdueTotal:0,overdueCount:0,urgent:[]} } },
    'udhaar:owing': { ok: true, data: [] },
    'activity:recent': { ok: true, data: [] },
    'backup:preview': { ok: true, data: {} }
  };
  if (staticResults[key]) return staticResults[key];
  if (method === 'list' || method === 'recent' || method === 'compare') return { ok: true, data: [] };
  if (method === 'summary') return { ok: true, data: emptySummary };
  if (method === 'nextNo') return { ok: true, data: 'PREVIEW-001' };
  if (method === 'get' && domain === 'settings') return { ok: true, data: {} };
  if (['create', 'update', 'remove', 'restore', 'close', 'setActive', 'resetPassword', 'changePassword'].includes(method)) {
    return { ok: false, error: 'PREVIEW_MODE', message: 'Saving requires the server database. The portal is currently using its local preview workspace.' };
  }
  return { ok: true, data: null, args };
}

async function invoke(domain, method, ...args) {
  if (backendUnavailable) return localResult(domain, method, args);
  try {
    const response = await fetch('/api/invoke', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: `${domain}:${method}`, args })
    });
    const type = response.headers.get('content-type') || '';
    if (!type.includes('application/json')) throw new Error('API unavailable');
    const payload = await response.json();
    return payload;
  } catch {
    backendUnavailable = true;
    window.dispatchEvent(new CustomEvent('portal:offline'));
    return localResult(domain, method, args);
  }
}

const eventNoop = () => () => {};
function chooseFiles() {
  return new Promise((resolve) => {
    const input=document.createElement('input'); input.type='file'; input.multiple=true; input.accept='image/*,.pdf';
    input.onchange=async()=>{ if(!input.files?.length) return resolve({ok:true,data:[]}); const body=new FormData(); [...input.files].forEach(file=>body.append('files',file));
      try { const response=await fetch('/api/attachments/upload',{method:'POST',body}); const result=await response.json(); resolve(result.ok?{ok:true,data:result.files||[]} : result); }
      catch { resolve({ok:false,message:'The upload could not reach the server.'}); }
    }; input.click();
  });
}
function chooseBackup() {
  return new Promise((resolve)=>{ const input=document.createElement('input'); input.type='file'; input.accept='.zip,application/zip'; input.onchange=async()=>{ if(!input.files?.[0])return resolve({ok:true,data:{chosen:false}}); const body=new FormData(); body.append('file',input.files[0]); try{const response=await fetch('/api/backup/restore-upload',{method:'POST',body});resolve(await response.json());}catch{resolve({ok:false,message:'The backup could not be uploaded.'});}}; input.click(); });
}
function downloadBase64(result){ if(!result?.ok||!result.data?.base64)return result; const bytes=Uint8Array.from(atob(result.data.base64),c=>c.charCodeAt(0)); const url=URL.createObjectURL(new Blob([bytes],{type:result.data.mimeType})); const link=document.createElement('a'); link.href=url; link.download=result.data.filename; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); return {...result,data:{...result.data,saved:true,filePath:`Downloads/${result.data.filename}`}}; }
const special = {
  updater: { getStatus: async () => ({ status: null, logs: [] }), onStatus: eventNoop, onLog: eventNoop, install: async () => ({ ok: false }) },
  attachments: {
    pick: chooseFiles,
    open: (id) => window.open(`/api/attachments/${id}/file`, '_blank', 'noopener'),
    read: (id) => `/api/attachments/${id}/file`
  },
  backup: {
    now: async()=>{ window.location.assign('/api/backup/download'); return {ok:true,data:{saved:true,filePath:'Downloads'}}; },
    choose: chooseBackup,
    preview: (...args)=>invoke('backup','preview',...args), restore: (...args)=>invoke('backup','restore',...args), openFolder: (...args)=>invoke('backup','openFolder',...args)
  },
  exports: {
    reportExcel: async(...args)=>downloadBase64(await invoke('exports','reportExcel',...args)),
    reportPdf: (...args)=>invoke('exports','reportPdf',...args), dayPdf: (...args)=>invoke('exports','dayPdf',...args), statementPdf: (...args)=>invoke('exports','statementPdf',...args)
  }
};

window.api = new Proxy(special, {
  get(target, domain) {
    if (domain in target) return target[domain];
    return new Proxy({}, { get(_inner, method) { return (...args) => invoke(domain, method, ...args); } });
  }
});
