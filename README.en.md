# TriggerTerminal

[简体中文](README.md)

**Manage assets locally. Understand your options and the strategies behind them.**

TriggerTerminal is an open-source portfolio manager built with options holders in mind. Bring accounts, currencies and asset types into one view to track costs, P&L, expiry dates and strategy relationships. Use it for everyday portfolio management or a closer look at single options, spreads and multi-leg positions.

## Local records, read-only brokerage access

Account, position and trade records stay on your computer. IBKR connects through a local Gateway / TWS session. The app reads account and market data; it does not place orders. Local bookkeeping does not change your brokerage account, and synced positions cannot be manually closed in the app.

Market queries still require internet access and send symbols or contracts to data providers. The app is intended for single-user local operation. Local databases are not encrypted, so protect your device and backups. See the [privacy notes](https://github.com/eztrigger/TriggerTerminal/blob/main/docs/PRIVACY.md).

IBKR is currently supported. Support for more brokers will be added over time.

## One place for your holdings

Stocks, ETFs, funds, futures and options share a portfolio view, organized by asset class, account and currency. Add records manually or sync from your broker, with current positions and historical trades kept in separate views.

The list shows the essentials first; click a position to expand its analysis. For options, contracts, quantities, time to expiry, moneyness, probability of profit and P&L appear side by side.

![Options overview showing contracts, expiry, probability of profit, IN / OUT and P&L](docs/images/options-overview.jpg)

*Options overview in the Chinese interface. Screenshots use a separate demo account, not real account data.*

## Options analysis: price, probability and risk together

**Profit probability and ITM probability are distinct.** Probability of profit uses your position's cost basis. IN / OUT describes the modeled probability of finishing in or out of the money. A short option can finish ITM and still make money because of the premium received.

**See where the price stands.** Spot and strike share a visual price axis, alongside an expiry countdown. Probability of profit has its own chart; ITM / OTM colors account for whether the option is bought or sold.

**Open the details when you need them.** Review cost, valuation, market value, maximum profit and loss, and breakeven prices. Assignment funding, remaining time value, bid–ask spreads and estimated closing P&L provide further context.

![Option detail showing expiry countdown, price position, profit probability and assignment funding](docs/images/option-analysis.jpg)

*A short put example in the Chinese interface, with profit probability and expiry IN / OUT shown separately.*

### From individual legs to strategies

Strategies are recognized automatically and can be adjusted manually. Positions in the same underlying can be grouped across accounts. Grouping does not change the actual holdings or imply that a broker permits collateral or margin offsets across accounts.

- **Single options:** probability of profit and breakeven use the position's actual cost basis.
- **Spreads:** analyze the combined payoff, retain each leg's ITM probability, and distinguish expiry scenarios where neither, one or both legs finish ITM.
- **Calendars:** estimates assume closing the entire position at the near-term expiry. The far leg retains time value and is valued using current implied volatility.

Probabilities use spot, strike, remaining time, implied volatility, interest rates and dividend assumptions. They are model estimates, not historical win rates or predictions of early assignment. Calendar estimates are particularly sensitive to volatility assumptions. Missing market data or required inputs should never be read as zero.

## Market workspace

Keep charts, quotes, watchlists and news in the same workspace, arranged around how you read the market. Review price action alongside quotes and related news with fewer window changes.

![Market workspace with price charts, quotes, a watchlist and financial content](docs/images/market-workspace.jpg)

*A view of the running workspace, shown in Chinese.*

## Where the data comes from

| Data | Sources and use |
| --- | --- |
| Brokerage accounts, positions and trades | Local IBKR Gateway / TWS. Manual accounts use user-entered ledger records. |
| Quotes, price history and option chains | IBKR and Yahoo Finance, depending on the selected source and asset type. Options analysis prefers IBKR; Yahoo Finance can fill missing fields for eligible standard USD equity options. |
| Stock fundamentals and financial statements | Yahoo Finance and SEC EDGAR. Reporting dates, currencies and available fields affect analysis coverage. |
| Fund NAV | Supported TD funds use TD Asset Management's official pages, with checks for fund code, series currency and NAV date. Not all funds are supported. |
| Model interest rates and dividends | USD rates reference U.S. Treasury term rates. Dividend inputs use IBKR, Yahoo Finance or verified issuer information. |
| News | Yahoo Finance RSS, Google News aggregation and the original publishers they link to. |

Quotes may be live, delayed, frozen or the last available observation, depending on market hours, subscriptions and provider access. Fields can have different sources and timestamps. Use the displayed provenance, timestamps and missing-data status to check them; do not assume every number is live.

## Design approach

- **Overview first, detail on demand.** Compact lists keep positions readable. Diagrams make price location and probabilities easier to compare; deeper analysis opens when needed.
- **Keep the basis clear.** P&L uses position cost. Strategy-level metrics stay distinct from individual-leg probabilities, and missing inputs remain visible.
- **Show cached data while updates arrive.** Analysis uses WebSocket updates, cached snapshots and shared in-flight requests. Returning to the page keeps the previous snapshot visible until fresh data arrives.
- **Separate management from execution.** Analysis helps explain a position; local bookkeeping does not replace a broker fill. Chinese and English interfaces share the same features and calculation logic.

## Download and connect IBKR

Download the Windows x64 installer or macOS 14+ Apple Silicon DMG from the [v0.1.0 release](https://github.com/eztrigger/TriggerTerminal/releases/tag/v0.1.0). Node.js and Python are included. On macOS, drag the app into Applications; on Windows, follow the installer.

1. Download **IB Gateway** from the [official IBKR download page](https://www.interactivebrokers.com/docs/tws-api/doc/trader-workstation-and-ib-gateway/download-tws-or-ib-gateway) and sign in. **Trader Workstation (TWS)** is also supported through the same Socket API.
2. In Gateway, open **Configure → Settings → API → Settings**. In TWS, open **Global Configuration → API → Settings** and enable **Enable ActiveX and Socket Clients**. Gateway normally enables the Socket API by default.
3. Keep **Read-Only API** checked and allow local connections only. Check **Socket port**, then click Apply / OK.
4. In TriggerTerminal, open **Positions & analysis → Account management → IBKR**, enter that port and an unused Client ID, then load and sync the account. Keep Gateway / TWS signed in while using the connection.

| Application | Default live port | Default paper port |
| --- | --- | --- |
| IB Gateway | 4001 | 4002 |
| TWS | 7496 | 7497 |

Your configured Socket port takes precedence. Market data permissions depend on your IBKR subscriptions. Read-only access does not grant additional subscriptions. See [IBKR’s API configuration guide](https://www.interactivebrokers.com/campus/trading-lessons/installing-configuring-tws-for-the-api/).


## Get started and contribute

Read the [English user guide](https://github.com/eztrigger/TriggerTerminal/blob/main/docs/USER_GUIDE.en.md). Issues, fixes and practical feedback are welcome, especially around brokerage connections, data coverage and options analysis.

Based on [OpenTerminal](https://github.com/ErTasselli/OpenTerminal) and licensed under MIT. Third-party code retains its own licenses and attribution.
