# Using triggerterminal

For the downloadable Mac or Windows app, start with the [desktop installation guide](../desktop/README.md). You do not need the source installation steps below. Feature instructions in this guide apply to both versions.


[中文说明](USER_GUIDE.zh-CN.md) · [Project home](../README.md)

triggerterminal brings market data, option chains and a local holdings ledger into one interface. You can use it to follow prices, keep manual records, or read account snapshots from IB Gateway or Trader Workstation running on your computer.

Adding a position, recording a close, exercising an option in the ledger, and recording a cash movement are local bookkeeping actions. They do not send orders to a broker. This public edition does not include cryptocurrency features, CSP screening or portfolio analysis.

## Contents

1. [Install and start](#1-install-and-start)
2. [Your first session](#2-your-first-session)
3. [Choose a market source](#3-choose-a-market-source)
4. [Connect IBKR](#4-connect-ibkr)
5. [Arrange the workspace](#5-arrange-the-workspace)
6. [Charts, watchlists and research panels](#6-charts-watchlists-and-research-panels)
7. [Read an option chain](#7-read-an-option-chain)
8. [Add accounts and positions](#8-add-accounts-and-positions)
9. [Cash movements, closes and exercise](#9-cash-movements-closes-and-exercise)
10. [Corrections, deletion and undo](#10-corrections-deletion-and-undo)
11. [Sync IBKR positions](#11-sync-ibkr-positions)
12. [Understand the P&L figures](#12-understand-the-pl-figures)
13. [Storage, backups and moving computers](#13-storage-backups-and-moving-computers)
14. [Troubleshooting](#14-troubleshooting)
15. [Update or publish a source copy](#15-update-or-publish-a-source-copy)

## 1. Install and start

The release contains source code. Install its dependencies and build it before starting the app. Commands below use a macOS or Linux shell. The optional native wrapper is for macOS; the native Windows installation paths and startup process have not been verified for this release.

You need Node.js 22 or later and npm. Python 3.11 or later is needed for the optional IBKR bridge. You can start with Yahoo data and manual records without installing that bridge.

Extract the source, open a terminal and change to the folder containing `package.json`. Run:

```sh
node --version
npm --version
npm ci
npm run build
```

`npm ci` installs the versions in the lockfile. `npm run build` compiles the API and web app. Resolve any errors before continuing.

Open two terminals in the project root.

**Terminal one — API:**

```sh
npm run start -w server
```

**Terminal two — web app:**

```sh
npm run start -w web -- --hostname 127.0.0.1
```

Open [http://localhost:3000](http://localhost:3000). The API uses local port 4000 and the web app uses port 3000. Leave both terminals running. To stop the app, press `Ctrl+C` in each terminal.

On first startup, the API creates `data/` and a local API key. The web app reads the key automatically. You do not need to copy it into your browser.

For IBKR, also run these commands from the project root:

```sh
python3 --version
python3 -m venv bridge/.venv
bridge/.venv/bin/python -m pip install -r bridge/requirements.txt
```

Source installations use `bridge/.venv/bin/python` (`bridge/.venv/Scripts/python.exe` on Windows), or the interpreter specified by `PYTHON_EXECUTABLE`. Desktop installers automatically use their bundled Python.

See the [desktop guide](../desktop/README.md) for Mac and Windows installation and build instructions. Installers are published separately from the source ZIP.

## 2. Your first session

A fresh installation has no personal accounts, holdings, cash entries or historical trades. The initial workspace contains general market panels and example watchlist symbols, including AAPL. These are built-in defaults, not an imported portfolio. The legacy manual ledger may contain an empty `Main` container with no transactions.

Choose 中文 or English at the top. If you are not connecting IBKR yet, select Yahoo Finance and restart the services as described below.

A useful first run is:

1. Add a symbol to the watchlist and click it to change the active symbol.
2. Add an Options panel and check its source label.
3. Open Positions & Holdings and confirm that the accounts and holdings are empty.
4. Create your own account when you are ready to keep records.

The holdings page may try to read a local IBKR account snapshot when it opens. A connection error does not prevent manual bookkeeping. Reading a snapshot also does not, by itself, import that account into your saved holdings.

## 3. Choose a market source

The Market source selector controls the main quote features. It does not switch every news, calendar or research service to the same provider.

| Feature | API mode | Yahoo Finance mode |
| --- | --- | --- |
| Price charts | IBKR history | Yahoo history |
| Watchlist | IBKR streaming quotes | Periodic Yahoo requests |
| Option chains | IBKR | Yahoo |
| Automatic holdings quotes | IBKR | Supported Yahoo stocks, ETFs and standard US equity options |
| Standalone quote panel | Public market APIs and fallback providers | Yahoo |
| Top-bar search and instrument search | IBKR | Still IBKR |
| IBKR account snapshots and sync | IBKR | Still IBKR |

**Restart the API after changing the source.** A “restart required” message means the selection has been saved, but the running service still uses the previous setting.

- In a browser: stop both terminal processes with `Ctrl+C`, rerun the two startup commands, then refresh the page.
- In the native app: use Restart at the top. Save unfinished edits first; the windows will reload. If the services were started in an external terminal, restart them there.

Refreshing the browser alone does not restart the API.

Yahoo charts and option chains do not require an IBKR login. Company-name search still does. Without IBKR, enter a symbol directly in the watchlist or edit the symbol beside a panel title. Canadian Yahoo symbols generally need their market suffix, such as `RY.TO`; holdings also need the correct currency and market identity.

Request frequency is not quote freshness. Charts request an update every minute. Yahoo quotes, watchlists and holdings generally request updates about every 30 seconds, but provider delays and caching can leave the displayed price unchanged. Option chains use manual refresh.

## 4. Connect IBKR

For source installations, install the Python bridge first; desktop installers already include it. Then start and sign in to your own IB Gateway or Trader Workstation. Enter your broker password in the IBKR application, not in triggerterminal.

Allow local Socket API connections in IBKR. Read-only API access is sufficient. In triggerterminal, open:

**Positions & Holdings → IBKR account & sync → Connection settings**

Set the API port to match your IBKR application, choose a Client ID, and save the settings. The interface lists these common port values; use the actual value configured in Gateway or TWS:

| Application | Live | Paper |
| --- | --- | --- |
| IB Gateway | 4001 | 4002 |
| TWS | 7496 | 7497 |

A Client ID identifies a connection, not your account. Avoid sharing it with another running API application. Option-chain reads and some other features use separate connections.

Reload the IBKR account or refresh its details after saving. Account balances and positions confirm that the account connection works. Quotes for a particular instrument may still depend on the data IBKR supplies and your market-data permissions.

## 5. Arrange the workspace

Use the left sidebar to add panels. Drag a panel by its title to move it, or resize it from its edge or corner. Closing a panel removes it from that layout; it does not delete an account or holding.

Symbol-aware panels can follow the active symbol or stay on their own symbol:

- A linked panel follows the symbol shown in the top bar.
- Click its chain icon to unlink it.
- Click the symbol beside its title, enter another symbol and press Enter to keep that panel on a specific instrument. Escape cancels editing.

The arrow at the top right opens a panel in a separate window. Allow pop-ups from the local site if your browser blocks it. A detached panel has its own symbol field, so changing it does not replace the main workspace layout.

Use Windows in the top bar to open a blank workspace. It starts without panels and retains its layout when that same window is refreshed. For an arrangement you want to reuse later, open Layout settings at the bottom of the sidebar and save it under a name or make it the default.

Restore default layout loads your saved default, which may differ from the original installation layout. Layouts and watchlists live in browser or native-app storage, separately from the account database.

| Shortcut | Action |
| --- | --- |
| `⌘K` / `Ctrl+K` | Open symbol search |
| `↑` / `↓`, then Enter in search | Choose and open a result |
| `Shift+Enter` in search | Open the result and add it to the watchlist |
| `Alt/Option+1` | Add a chart |
| `Alt/Option+2` | Add a quote panel |
| `Alt/Option+3` | Add news |
| `Alt/Option+4` | Add the stock screener |
| `Alt/Option+7` | Add an option chain |
| `Alt/Option+8` | Open Positions & Holdings |

Some browsers and keyboard layouts reserve these combinations. Use the sidebar buttons if a shortcut does not work.

## 6. Charts, watchlists and research panels

Charts offer multiple ranges, candlestick / OHLC / line / area views, moving averages, VWAP, Bollinger bands, RSI and MACD. Select a symbol and range first, then enable the indicators you need.

The chart shows its source, candle interval, latest candle time and successful retrieval time. These describe different things: a recent request does not mean the latest candle or trade occurred at that moment.

The watchlist supports direct symbol entry, selection, column sorting and removal. Removing a watchlist symbol does not remove a holding in the same instrument. Where a table offers Restore default order, use it to clear the current sort.

| Panel | What it shows |
| --- | --- |
| Quote | Price, change, volume and available reference fields |
| News | Related stories, with links to the original articles |
| Stock screener | Stock lists with filters and sorting; this is not the removed CSP scanner |
| Macro | Index proxies, yields and other market context |
| Calendar | Economic events supplied by the source |
| Insider trades | Related filing records |
| Financial TV | Available external live streams |
| Market recap | Indexes, movers, sectors and news |

Unavailable fields remain blank or display an error. A dash means no usable value, not zero. The NYSE open/closed label uses weekdays and normal trading hours; it does not implement a complete holiday or early-close calendar.

## 7. Read an option chain

1. Choose a symbol and add an Options panel.
2. Check whether the source label says IBKR or Yahoo Finance.
3. Select the expiration. If IBKR offers multiple contract classes, choose the class you need.
4. Select a center strike or leave it following the underlying.
5. Choose 10 rows, 20 rows or All, and use Refresh prices when needed.

“10 rows” means ten strike levels, with a call and put side on each row. It does not mean ten option contracts in total. Reading all strikes through IBKR can take longer; start with ten to check the connection and quotes.

| Field | Meaning |
| --- | --- |
| Last | The latest trade price returned by the source, not a guaranteed execution price |
| Bid / Ask | The bid and ask returned by the source |
| Volume | Reported trading volume |
| OI | Open interest |
| IV | Reported implied volatility |
| Quotes | Live, delayed, frozen or unconfirmed data status |

Yahoo option responses are cached for up to five minutes. Repeated refreshes can return the same response. “Retrieved” is not a trade timestamp. “Unconfirmed” refers to the quote's timing status, not to whether the contract exists. Nonstandard adjusted contracts are excluded from the Yahoo standard chain.

If Yahoo does not return the requested expiration, the app reports an error instead of substituting contracts from another date. Reload the default chain, then select the expiration again.

## 8. Add accounts and positions

### Create a manual account

Open Positions & Holdings → Accounts → Add account. Enter a broker name and account nickname. The account number is optional. Enter your current remaining cash by currency and save.

Cash means the uninvested balance. If an account has total assets of 10,000, including positions worth 6,000 and cash of 4,000, enter 4,000 as cash.

If you do not know the cash balance yet, leave it blank and establish the tracking start later under Manage cash & history. Do not enter zero as a substitute for an unknown balance.

### Choose how the position enters the ledger

| Entry mode | When to use it | Cash effect |
| --- | --- | --- |
| Existing opening holdings | Assets already held when you begin tracking | No second cash deduction |
| New trade | An opening trade that occurred after tracking began | Updates cash for price, quantity and commission |

Finish entering opening holdings before recording subsequent trades or cash movements. Once the account has its first ledger event, opening-position entry is no longer available. This keeps the opening baseline separate from later activity.

### Fill in each asset

Set the account, position name, asset type, symbol, quantity, multiplier and currency. Positive quantities are long; negative quantities are short. Shares may be fractional. Option quantities must be whole contracts.

Options also need an expiration, call/put right and strike. Ordinary shares usually have a multiplier of 1. Use the actual option multiplier rather than assuming 100 for an adjusted contract. Price fields take a unit price, not the total trade value.

Average unit cost and valuation price may be left blank, but related P&L may then be unavailable. Selecting an IBKR search result identifies the particular market and contract. Without a connection, you can enter the symbol and valuation manually. A manual valuation is a local record, not an executable broker quote.

For opening holdings, a recorded historical commission is included in cost. Enter zero if the cost already includes it. For a new trade, enter the execution price without the new commission and record that commission separately; it affects cash and realized P&L.

### Multiple legs and notes

Add legs within one position to record a combination, entering each contract and signed quantity separately. You can also organize existing positions into strategy groups. Classifications and grouping organize records; they do not create orders.

Notes are stored per asset. They can describe an entry condition, a management plan or something to check later. Keep passwords and API keys out of them.

## 9. Cash movements, closes and exercise

### Cash movements

Under Accounts, expand Manage cash & history for the account. Manual accounts support deposits, withdrawals, dividends / interest and expenses. Choose the currency, amount, date and note, then save the entry.

Deposits and withdrawals change cash without becoming trading profit. Use a balance correction for an incorrectly recorded balance; use a cash-movement entry for money actually deposited or withdrawn. Currencies are tracked separately, without an automatic combined total after FX conversion.

### Close a position

Open the close/exercise action on the position, select Close, and enter the actual quantity, unit execution price, commission and time. Enter a positive closing quantity; the app determines whether you are selling a long position or buying back a short. Partial closes are supported.

The remaining quantity keeps its valuation data. A closing price does not become the remaining position's market price. A worthless expiry can be recorded as a zero-price close where appropriate.

### Exercise or assignment

The ledger supports confirmed physical delivery for equity / ETF options. After you confirm the contract and delivery terms, it updates the option, shares and cash. Opposite stock lots in the same account and currency are matched in insertion order, and the premium becomes part of adjusted stock cost.

It does not infer index cash settlement, adjusted deliverables or futures-option delivery. See the [ledger reference](HOLDINGS_LEDGER.md) for the supported calculation. Recording exercise here does not submit an exercise instruction to IBKR.

## 10. Corrections, deletion and undo

These operations have different effects. Choose the one that matches what you need to change.

| Operation | Cash | P&L | Position |
| --- | --- | --- | --- |
| Correct a close | Adjusts the settlement difference | Recalculates realized P&L | Quantity edits adjust the remainder, subject to later-activity checks |
| Edit a profit record | Unchanged | Updates the recorded amount and total P&L | Unchanged |
| Delete a close record | Keeps settled cash | Excludes that realized result | Does not reopen the position |
| Undo the latest entry | Reverses settlement | Removes the event's contribution | Restores affected quantity and cost |
| Delete an untransacted manual position | Unchanged | Removes its unrealized contribution | Removes the entry |

Select Closed trades in the position-status selector to find and correct records by date, asset, account or note. Changing price, quantity or commission replaces a manual profit override for that trade. A note-only edit preserves it.

Profit records lets you correct recorded realized P&L; it does not correct cash. To reverse a mistaken event, check Undo latest entry in the account's cash and trade history. Work backward from the latest event.

Deleting an account removes its local positions, cash and history, and requires its full name as confirmation. It does not close the brokerage account. Back up first: another broker sync will not restore manual notes or complete local history.

## 11. Sync IBKR positions

Choose an account in IBKR account & sync, then sync it to the holdings page. The first sync creates the corresponding local IBKR account. Enable the 30-second sync option if you want continued updates for the selected account.

Sync updates IBKR-source positions only. Independent manual positions remain unchanged. Positions that disappear from the broker snapshot move to history, but the app does not guess their closing price or create a historical trade from their disappearance.

You can create an independent manual position under an IBKR account. Avoid duplicating a position or trade already represented in the broker snapshot. Manual entries create separate local cash adjustments and are not automatically reconciled with broker executions. Local close and exercise actions are not available for broker-synced positions.

This version does not import complete broker trade and commission history. Closed trades and cumulative P&L reflect the records available locally, not a complete broker statement.

## 12. Understand the P&L figures

Figures are calculated separately by account and currency:

- Net position value sums signed position values.
- Unrealized P&L uses recorded costs and current valuations.
- Total P&L adds recorded realized P&L to current unrealized P&L.
- Cash, deposits and withdrawals are tracked separately from that total-P&L calculation.

Here is a bookkeeping example, unrelated to current market prices. Start with USD 4,000 cash and ten shares costing USD 100 each, initially valued at USD 100, with no opening commission. The valuation then rises to USD 110. Close four shares at USD 110 with a USD 1 commission:

| Item | Result |
| --- | --- |
| Cash | 4,000 + 4 × 110 − 1 = USD 4,439 |
| Shares remaining | 6 |
| Remaining value | 6 × 110 = USD 660 |
| Realized P&L on the close | 4 × (110 − 100) − 1 = USD 39 |
| Remaining unrealized P&L | 6 × (110 − 100) = USD 60 |
| Total P&L | 39 + 60 = USD 99 |

Missing costs, valuations or broker history can leave figures unknown or incomplete. Resolve the missing inputs before comparing totals. The ledger is an investment record, not a tax return.

## 13. Storage, backups and moving computers

| Location | Contents |
| --- | --- |
| Project `data/` folder | Accounts, positions, cash, trades, notes, connection settings and local API key |
| Browser / native-app storage | Layouts, watchlists, language and some interface preferences |

To back up, stop both services and copy the entire `data/` folder to a private location. Copying only a SQLite main file while the service runs can miss pending journal data. Stop the services before restoring as well, and keep a copy of the current directory before replacing it.

A different browser, computer, native wrapper, or URL hostname can have different interface preferences. Even `localhost` and `127.0.0.1` use different browser storage. Saved holdings depend on the API's data directory instead. There is no one-click migration for all browser layouts.

The public source package excludes `data/`. Do not commit the data you create later to GitHub. The [privacy document](PRIVACY.md) explains storage and external requests in more detail.

## 14. Troubleshooting

### The page does not open, or says Failed to fetch

Check that both terminal processes are still running. The page uses port 3000; the API uses 4000. `EADDRINUSE` means a port is occupied. Check whether another copy is already running before starting a second instance.

### A connection to `127.0.0.1:4001` fails

That is an IBKR connection, not a Yahoo server. Check the Gateway / TWS login, API port and local API access.

If it occurs in the option chain after selecting Yahoo, check whether a restart is still pending. If it occurs in symbol search or account sync, those features still depend on IBKR.

### Yahoo returns 429, a crumb error or no data

This can reflect request limits, session acquisition or provider availability. Wait before retrying rather than repeatedly pressing refresh. Check the symbol and expiration. A failed Yahoo option request does not silently switch to IBKR.

### Yahoo charts work, but company search fails

Search still uses IBKR. Without that connection, add the symbol directly to the watchlist and select it, or edit a panel's symbol.

### A holding's price does not update

Check its asset type, currency, contract and source. The Yahoo adapter does not automatically quote all asset types, including ordinary mutual funds, futures and nonstandard options. Failed refreshes retain the old value; that does not mean it has been verified again. Enter a valuation manually after checking it if needed.

### P&L differs from the broker

Compare quantity, cost, multiplier, currency, commissions and valuation time. Check for positions recorded both manually and through sync. Complete broker history is not imported, so the two systems may cover different records.

### A transaction time cannot be saved

Entries must be chronological within the account and cannot precede the tracking start. Later activity can also prevent edits to an earlier trade's quantity. Check the sequence rather than entering an arbitrary time to pass validation.

### Restart does not restart the services

In an ordinary browser, the button tells you to restart in the terminals. Stop and restart the API and web processes. Do not delete `data/`.

### A saved layout has disappeared

Check whether you changed browser, URL or native app, or cleared site data. Named layouts also depend on the original browser storage; they are not in the holdings database.

## 15. Update or publish a source copy

Back up `data/` and stop the services before updating. After changing the source, run `npm ci` and `npm run build`, then restart. If the build fails, resolve the reported error rather than clearing account storage.

To share a source copy, export to a new destination that does not already exist:

```sh
node scripts/public-release.mjs ../triggerterminal-public-new
```

The exporter creates a source folder, ZIP and checksum list from an explicit file manifest, without copying old Git history. Review the result, especially files and notes you add later. Use the [upload checklist](../scripts/release/RELEASE-CHECKLIST.md) before publishing.
