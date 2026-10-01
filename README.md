# Shopkeeper Web Portal

A responsive, role-based shop management portal for sales, stock, purchases, customer and supplier credit, expenses, reporting, and daily cash closing.

The application runs as a React web frontend backed by an Express server and a persistent SQLite database. It is designed for a shop computer or a trusted local network.

## Features

- Owner setup, secure password hashing, recovery key, and sign-in
- Separate administrator, read-only owner, and team-member permissions
- Product catalogue, companies, prices, opening stock, and stock adjustments
- Customer and supplier management
- Sales billing with cash, bank, and credit payments
- Purchases and damaged-stock recording
- Customer and supplier credit ledger with due-date alerts
- Payment allocation against the oldest open bills
- Expenses and expense categories
- Day book, cash reconciliation, and day closing
- Sales, profit, stock, credit, and business reports
- Excel report downloads and printable browser reports
- Attachments for bills, purchases, payments, and expenses
- Database and attachment backup/restore
- Responsive desktop, tablet, and mobile portal interface

## Requirements

- Windows, macOS, or Linux
- Node.js 22 or newer
- npm 10 or newer

The backend currently uses the SQLite module included with Node.js 22. Node may display an `ExperimentalWarning` when the server starts; this does not prevent the portal from working.

## Quick start

Open PowerShell or a terminal in the project directory:

```powershell
cd C:\Users\User\Desktop\shopkeeper-web
npm run setup
npm start
```

Then open:

```text
http://localhost:4000
```

On first launch, create the administrator account and write down the recovery key shown by the portal.

## Normal startup

After initial setup, start the production portal with:

```powershell
npm start
```

The production server serves both the API and the compiled frontend at `http://localhost:4000`.

## Development

Run the API server and Vite frontend together:

```powershell
npm run dev
```

Development URLs:

- Frontend: `http://localhost:5173`
- API and production server: `http://localhost:4000`

The Vite development server proxies `/api` requests to port 4000.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run setup` | Install root and frontend dependencies, then build the frontend |
| `npm start` | Start the production web portal on port 4000 |
| `npm run dev` | Start the backend and live-reloading frontend |
| `npm run build` | Create the optimized frontend bundle in `frontend/dist` |
| `npm test` | Run the isolated end-to-end business workflow test |
| `npm audit --omit=dev` | Check production dependencies for known vulnerabilities |

## Data storage

By default, persistent shop data is stored under:

```text
backend/data/shop-data/
```

Important contents:

```text
shop.db                 SQLite database
attachments/            Uploaded bills and payment evidence
backups/                Safety copies created during restoration
.shopkeeper-pos         Data-folder marker
```

Server configuration is stored in:

```text
backend/data/settings.json
```

Do not manually edit or remove these files while the server is running.

### Custom data directory

Set `SHOPKEEPER_DATA_DIR` before starting the server to use another persistent location:

```powershell
$env:SHOPKEEPER_DATA_DIR = "D:\ShopkeeperData"
npm start
```

Use an absolute path on a reliable disk. The application creates the required directory structure automatically.

## Backups

Administrators can download a complete ZIP backup from **Settings → Backup**. A backup contains:

- The SQLite database
- Uploaded attachments
- A backup manifest containing the shop name, application version, and creation time

Create backups regularly and keep at least one copy on a different disk or secure cloud drive. The restore workflow validates an uploaded archive and creates a safety copy of the current data before replacing it.

## Roles

### Administrator

Full access to business data, pricing, stock, transactions, reports, settings, users, backups, and destructive actions.

### Owner

Read-only access to management information and reports. This role cannot create, edit, or remove business records.

### Team member

Access to the overview and sales/billing workflow. Cost prices, management reports, and administration remain hidden.

Authorization is enforced by the backend as well as the interface.

## Architecture

```text
shopkeeper-web/
├── backend/
│   ├── auth/             Password and browser-session handling
│   ├── config/           Server data-directory configuration
│   ├── db/               SQLite driver, schema, connection, and units
│   ├── lib/              Date and ZIP helpers
│   ├── services/         Business rules and reporting
│   ├── tests/            Isolated end-to-end smoke test
│   ├── ipc.js            Browser API channel registration
│   └── server.js         Express server and upload/download endpoints
├── frontend/
│   ├── src/components/   Shared portal interface components
│   ├── src/pages/        Business screens
│   ├── src/lib/          API client and formatting helpers
│   └── dist/             Generated production frontend
├── package.json
└── README.md
```

The frontend keeps the original domain-based API shape, such as `sales.create()` and `products.list()`. The browser client sends these calls to `POST /api/invoke`, where the server dispatches them to the relevant service. Business validation and permission checks remain on the server.

## Testing

Run:

```powershell
npm test
```

The test creates an isolated temporary data directory and verifies:

- Database creation and integrity
- Administrator creation
- Settings, company, customer, supplier, and product creation
- Opening stock and purchase stock movement
- Cash and credit sales
- Customer payment allocation
- Expense recording
- Warehouse calculation and reports
- Day closing
- Complete ZIP backup generation

The temporary database is removed after the test. The real shop database is not modified.

## Production notes

For use on one shop computer, run `npm start` and access the portal through `localhost`.

For access from other computers or deployment on the internet, place the application behind a production reverse proxy with HTTPS, firewall the database host, restrict access to trusted users, and run the Node process with a service manager. Do not expose port 4000 directly to the public internet.

Browser login sessions are stored in server memory and therefore require users to sign in again after a server restart. Business records remain safely stored in SQLite.

## Troubleshooting

### Blank page or connection errors

Use the production URL after running `npm start`:

```text
http://localhost:4000
```

If using `http://localhost:5173`, both parts must be running through `npm run dev`.

### Port already in use

Close the previous server process or choose another backend port:

```powershell
$env:PORT = "4100"
npm start
```

### Database does not open

- Confirm the configured data directory exists and is writable.
- Confirm another process is not locking `shop.db`.
- Check free disk space.
- Restore a known-good backup through the portal if database integrity fails.

### Reinstall dependencies

```powershell
Remove-Item -Recurse -Force node_modules, frontend\node_modules
npm run setup
```

Only remove dependency folders with that command. Do not remove `backend/data`, because it contains the shop database.

## Security guidance

- Use a strong administrator password.
- Store the recovery key securely and separately from the shop computer.
- Give daily workers team-member accounts rather than administrator access.
- Keep Node.js and npm dependencies updated.
- Run `npm audit --omit=dev` periodically.
- Keep regular offline backups.
- Use HTTPS before allowing any non-local access.

## License

No license has been specified. Add a license file before distributing the application outside your organization.
