<p align="center">
  <img src="web/public/trigger-icon.png" width="80" height="80" alt="TriggerTerminal" />
</p>
<h1 align="center">TriggerTerminal</h1>
<p align="center"><strong>Open-source portfolio management and options strategy analysis</strong><br />Local storage · Read-only IBKR sync · Windows / macOS</p>
<p align="center">
  <a href="https://github.com/eztrigger/TriggerTerminal/releases/latest"><img src="https://img.shields.io/github/v/release/eztrigger/TriggerTerminal?style=flat-square&color=167d75" alt="Latest release" /></a>
  <a href="https://github.com/eztrigger/TriggerTerminal/actions/workflows/ci.yml"><img src="https://github.com/eztrigger/TriggerTerminal/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-167d75?style=flat-square" alt="MIT license" /></a>
  <img src="https://img.shields.io/badge/desktop-macOS%20%7C%20Windows-34495e?style=flat-square" alt="macOS and Windows" />
</p>
<p align="center">
  <a href="#download">Download</a> &nbsp; · &nbsp; <a href="#features">Portfolio & strategies</a> &nbsp; · &nbsp; <a href="#ibkr">Connect IBKR</a> &nbsp; · &nbsp; <a href="#data">Data & design</a>
</p>
<p align="center"><a href="README.md">简体中文</a> &nbsp; / &nbsp; <a href="README.en.md">English</a></p>

TriggerTerminal is a desktop application for individual investors who manage multiple accounts and hold options. Sync an IBKR account or record assets from other accounts manually, then review costs, market values, P&L and expirations in a shared portfolio view.

Options analysis includes automatic strategy recognition, combined and per-leg risk metrics, probability of profit and breakeven prices based on position cost. Account records are stored locally. Brokerage access is read-only: ledger operations and analysis do not send orders to IBKR.

![Market workspace with a price chart, quotes, news and financial TV](docs/images/market-workspace-en.jpg)

*The workspace supports movable, resizable panels and separate windows. This layout combines a price chart, quotes, news and Bloomberg TV.*

<a name="download"></a>
## Quick start

### 1. Install the desktop app

| Platform | Download v0.1.0 | Requirements |
| :--- | :--- | :--- |
| Windows | [Windows x64 installer](https://github.com/eztrigger/TriggerTerminal/releases/download/v0.1.0/TriggerTerminal-0.1.0-win-x64.exe) | 64-bit Windows |
| macOS | [Apple Silicon DMG](https://github.com/eztrigger/TriggerTerminal/releases/download/v0.1.0/TriggerTerminal-0.1.0-mac-arm64.dmg) | macOS 14 or later, Apple Silicon |

Run the Windows installer, or drag the macOS app into Applications. Node.js and Python are included; no development environment is required. Install IB Gateway or TWS separately if you intend to sync IBKR.

The installers are not signed / notarized and may trigger an unverified-publisher warning. An Intel Mac installer is not available. [Release notes](https://github.com/eztrigger/TriggerTerminal/releases/tag/v0.1.0) · [SHA256 checksums](https://github.com/eztrigger/TriggerTerminal/releases/download/v0.1.0/SHA256SUMS.txt)

### 2. Add an account and positions

Open **Positions & Analysis → Accounts** and choose how to maintain your records:

- **IBKR account:** configure Gateway / TWS using the [connection guide](#ibkr), then load and sync the account.
- **Manual account:** create an account and enter existing holdings or new trades. Use this for brokers and assets without an integration.

IBKR is currently the supported broker for automatic synchronization. Additional broker integrations will be introduced over time.

### 3. Review your positions

Open portfolio analysis and filter by asset class, account or currency. Select a position to expand its details, or use the options strategy tabs to review a combination and its individual legs. Current positions and historical records have separate views. Synced brokerage positions cannot be manually closed in the app.

For detailed procedures, see the [English user guide](docs/USER_GUIDE.en.md). It also includes installation commands for running from source.

<a name="features"></a>
## Portfolio management

Stocks, ETFs, funds, futures and options use a shared account and portfolio interface. The overview displays key metrics; cost details, analysis and ratings are available on expansion so that positions can be compared without opening each one.

The options list includes contract, side, quantity, expiry, time remaining, underlying price, moneyness, probability of profit, ITM probability and position P&L.

![Options overview showing expirations, price status, probabilities and P&L](docs/images/options-overview-en.jpg)

*Option positions in a demo account. Documentation screenshots contain no real account information.*

## Options and strategy analysis

### Metrics

| Metric | Definition |
| :--- | :--- |
| Probability of profit | The modeled probability that the position or combination has positive P&L at the specified analysis horizon, using its cost basis. |
| ITM probability (IN) | The modeled probability that an individual option finishes in the money at expiry; OUT is the corresponding OTM probability. This is not a probability of touching the strike or actual assignment. |
| Breakeven | The underlying price at which the modeled position P&L is zero under the selected analysis assumptions. |
| Maximum profit / loss | Payoff bounds derived from the actual legs and their cost. The interface explains when a fixed bound cannot be determined. |
| Price and time | The underlying price relative to the strike, and the time remaining to expiry. |

Probability of profit and ITM probability measure different outcomes. For example, premium received on a short put can offset some intrinsic value at expiry, so finishing ITM does not necessarily mean the trade loses money.

![Short put analysis showing expiry, price location, profit probability and funding requirements](docs/images/option-analysis-en.jpg)

*A short put example. Price location, probability of profit and per-leg IN / OUT are shown separately, with funding and liquidity information available for further review.*

### Strategy recognition and grouping

The app identifies strategies from their legs and allows manual classification changes. Positions in the same underlying can be grouped across accounts. Grouping is for analysis: it does not alter brokerage positions or establish collateral or margin offsets between accounts.

| Strategy | Analysis basis |
| :--- | :--- |
| Single option | Expiry P&L, probability of profit and breakeven use position cost. ITM probability is shown separately. |
| Spread | Combines the legs' expiry payoffs and retains per-leg ITM probabilities. Scenarios distinguish neither leg, one leg or both legs finishing ITM. |
| Calendar | Assumes closing the entire combination at the near-term expiry. The far leg is valued using the underlying price at that time, its remaining term and current implied volatility. |

Probabilities depend on inputs including the underlying price, implied volatility, time remaining, interest rates and dividends. They are model estimates, not historical win rates. Calendar results are particularly sensitive to volatility assumptions. Missing required inputs are not treated as zero.

## Market workspace

Combine price charts, quotes, watchlists, news, option chains and financial TV in one workspace. Panels can be moved, resized or opened in separate windows for single- or multi-monitor use.

Select **Live TV** in the sidebar to add a television panel and choose a channel. Playback starts muted. Broadcasts and news retain their original language; stream availability depends on the broadcaster, region and network.

## Storage and connection security

Accounts, positions and trade records are stored on your computer. IBKR connects through a locally running Gateway / TWS session. The application reads account and market data and does not provide brokerage order execution. Manual trades, closes and cash movements are local ledger entries; they do not change your brokerage account.

Local storage does not mean offline operation. Quotes, news and television require external services, and market queries send symbols or contracts to providers. Local databases are not encrypted; device access controls and backup protection remain the user's responsibility. The app is intended for single-user local operation. See the [privacy documentation](docs/PRIVACY.md) for details.

<a name="ibkr"></a>
## Connect IBKR Gateway / TWS

**Prerequisite:** install and sign in to IB Gateway or Trader Workstation (TWS). Both are available from the [official IBKR download page](https://www.interactivebrokers.com/docs/tws-api/doc/trader-workstation-and-ib-gateway/download-tws-or-ib-gateway).

1. **Open API settings.** In Gateway, use `Configure → Settings → API → Settings`. In TWS, use `Global Configuration → API → Settings`.
2. **Enable the Socket API.** In TWS, select `Enable ActiveX and Socket Clients`. Gateway normally enables it by default. Keep `Read-Only API` checked and allow local connections only.
3. **Check the port.** Note the configured `Socket port` and save the settings. The table below lists defaults; your configured value takes precedence.
4. **Connect from TriggerTerminal.** Open **Positions & Analysis → Accounts → IBKR**, enter the same port and an unused Client ID, then load and sync the account.

| Application | Default live port | Default paper port |
| :--- | :--- | :--- |
| IB Gateway | 4001 | 4002 |
| TWS | 7496 | 7497 |

Keep Gateway / TWS signed in while using the connection. Available market data depends on account permissions and subscriptions; API access does not add data entitlements. See [IBKR's configuration guide](https://www.interactivebrokers.com/campus/trading-lessons/installing-configuring-tws-for-the-api/) for more detail.

<a name="data"></a>
## Data sources and system design

<details>
<summary><strong>Data sources and coverage</strong></summary>

| Data | Source and coverage |
| :--- | :--- |
| Accounts, positions and trades | IBKR Gateway / TWS. Manual accounts use user-entered local ledger records. |
| Quotes, historical prices and option chains | IBKR and Yahoo Finance, depending on market source and asset type. Options analysis prefers IBKR; Yahoo Finance can supplement missing fields for eligible standard USD equity options. |
| Stock fundamentals and financial statements | Yahoo Finance and SEC EDGAR. Coverage depends on reporting dates, currencies and available fields. |
| Fund NAV | Supported TD funds use official TD Asset Management pages, with checks for fund code, series currency and NAV date. Coverage is not universal. |
| Model rates and dividends | USD rates reference U.S. Treasury term rates. Dividend inputs use IBKR, Yahoo Finance or verified issuer information. |
| News | Yahoo Finance RSS, Google News aggregation and the original publishers they link to. |
| Financial TV | External feeds for the selected channel. Video connects directly to the streaming provider. |

Quotes may be live, delayed, frozen or the last available observation. Fields within an analysis may have different sources and timestamps. Use the displayed status to assess freshness.

</details>

<details>
<summary><strong>Design principles and update behavior</strong></summary>

- **Overview and detail are separate.** Lists support comparison; expanded views expose calculation inputs and risk metrics.
- **A consistent cost basis.** P&L analysis uses position cost. Strategy metrics and individual-leg probabilities are displayed separately.
- **Cached data appears first.** Analysis receives WebSocket updates and reuses cached snapshots and in-flight requests. Returning to a page shows the available snapshot until new data replaces it; a snapshot does not imply live prices.
- **The ledger is separate from the broker.** Local record changes do not submit orders. Synced positions follow brokerage data.
- **The same logic in both languages.** Chinese and English share the analysis implementation. Account names, contract identifiers and user notes retain their stored values.

</details>

## Documentation and support

| Task | Documentation |
| :--- | :--- |
| Installation, account setup and daily use | [English user guide](docs/USER_GUIDE.en.md) |
| Desktop installation and packaging | [Desktop guide](desktop/README.md) |
| Local storage and external connections | [Privacy notes](docs/PRIVACY.md) |
| Ledger and P&L implementation | [Holdings ledger design](docs/HOLDINGS_LEDGER.md) |
| Bugs and feature requests | [GitHub Issues](https://github.com/eztrigger/TriggerTerminal/issues) |

When reporting a problem, include the app version, operating system, steps to reproduce and error message. Redact account identifiers and personal information from screenshots and logs. Pull requests are currently disabled.

## License and acknowledgments

TriggerTerminal is based on [OpenTerminal](https://github.com/ErTasselli/OpenTerminal) and distributed under the [MIT license](LICENSE). Third-party code and asset licensing is documented in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
