<p align="center">
  <img src="web/public/trigger-icon.png" width="80" height="80" alt="TriggerTerminal" />
</p>
<h1 align="center">TriggerTerminal</h1>
<p align="center"><strong>开源持仓管理与期权策略分析工具</strong><br />本地存储 · IBKR 只读同步 · Windows / macOS</p>
<p align="center">
  <a href="https://github.com/eztrigger/TriggerTerminal/releases/latest"><img src="https://img.shields.io/github/v/release/eztrigger/TriggerTerminal?style=flat-square&color=167d75" alt="Latest release" /></a>
  <a href="https://github.com/eztrigger/TriggerTerminal/actions/workflows/ci.yml"><img src="https://github.com/eztrigger/TriggerTerminal/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-167d75?style=flat-square" alt="MIT license" /></a>
  <img src="https://img.shields.io/badge/desktop-macOS%20%7C%20Windows-34495e?style=flat-square" alt="macOS and Windows" />
</p>
<p align="center">
  <a href="#download">下载</a> &nbsp; · &nbsp; <a href="#features">持仓与策略</a> &nbsp; · &nbsp; <a href="#ibkr">连接 IBKR</a> &nbsp; · &nbsp; <a href="#data">数据与设计</a>
</p>
<p align="center"><a href="README.md">简体中文</a> &nbsp; / &nbsp; <a href="README.en.md">English</a></p>

TriggerTerminal 是面向个人投资者的桌面应用，用于集中管理多个账户的持仓，并分析期权合约及组合策略。你可以同步 IBKR 账户，也可以手动记录其他账户中的资产，在同一界面查看成本、市值、盈亏和到期安排。

应用重点支持期权持仓管理：自动识别策略，区分组合与单腿风险，按持仓成本计算盈利概率和盈亏平衡价。账户记录保存在本机；券商连接只读，本地记账和分析操作不会向券商发送订单。

![交易台：价格图表、行情报价、新闻和财经电视](docs/images/market-workspace.jpg)

*行情工作区支持调整面板位置、大小及独立窗口。图中展示价格图表、报价、新闻和 Bloomberg TV。*

<a name="download"></a>
## 快速开始

### 1. 安装桌面应用

| 平台 | 下载 v0.1.0 | 系统要求 |
| :--- | :--- | :--- |
| Windows | [Windows x64 安装程序](https://github.com/eztrigger/TriggerTerminal/releases/download/v0.1.0/TriggerTerminal-0.1.0-win-x64.exe) | 64 位 Windows |
| macOS | [Apple Silicon DMG](https://github.com/eztrigger/TriggerTerminal/releases/download/v0.1.0/TriggerTerminal-0.1.0-mac-arm64.dmg) | macOS 14 或更高版本，Apple Silicon 芯片 |

Windows 运行安装向导；macOS 将应用拖入「应用程序」。安装包包含 Node.js 和 Python，无需单独配置开发环境。IB Gateway 或 TWS 需另外安装。

当前安装包未签名／公证，系统可能提示来源未验证；暂不提供 Intel Mac 安装包。[发布说明](https://github.com/eztrigger/TriggerTerminal/releases/tag/v0.1.0) · [SHA256 校验值](https://github.com/eztrigger/TriggerTerminal/releases/download/v0.1.0/SHA256SUMS.txt)

### 2. 添加账户与持仓

打开「仓位与分析 → 账户管理」，选择一种录入方式：

- **IBKR 账户**：按[连接指南](#ibkr)配置 Gateway / TWS，再读取账户并同步。
- **手动账户**：建立账户后录入已有持仓或新增成交，用于管理尚未接入的券商及其他资产。

IBKR 是当前支持自动同步的券商。后续将陆续增加对其他券商的支持。

### 3. 查看分析

进入持仓分析，按资产类别、账户或币种查看仓位。点击一条仓位可展开详情；期权也可以按策略查看组合及各合约腿。当前持仓与历史记录分别管理，API 同步的仓位不支持手动平仓。

完整操作步骤见[中文使用指南](docs/USER_GUIDE.zh-CN.md)。需要从源码运行时，请使用指南中的安装命令。

<a name="features"></a>
## 持仓管理

股票、ETF、基金、期货和期权使用统一的账户与持仓入口。总览展示主要指标，成本明细、分析和评级在展开后显示，便于比较仓位而不必逐一打开详情。

期权总览集中显示合约、买卖方向、数量、到期日、剩余时间、标的现价、价内／价外状态、盈利概率、价内概率及持仓盈亏。

![期权持仓总览：到期安排、价格状态、概率与盈亏](docs/images/options-overview.jpg)

*示例账户中的期权仓位。文档截图不包含真实账户资料。*

## 期权与策略分析

### 分析指标

| 指标 | 含义 |
| :--- | :--- |
| 盈利概率 | 按持仓成本计算，在指定分析时点组合盈亏大于零的模型概率。 |
| 价内概率（IN） | 单条期权腿在到期时处于价内的模型概率；OUT 为价外概率。它不表示到期前触及行权价或实际被指派的概率。 |
| 盈亏平衡价 | 在指定分析口径下，使组合盈亏为零的标的价格。 |
| 最大盈利／最大损失 | 根据实际合约腿与成本计算的策略盈亏边界；无法确定固定边界时，界面说明原因。 |
| 价格与期限 | 标的现价相对于行权价的位置，以及距离到期的剩余时间。 |

盈利概率与价内概率回答不同的问题。例如，卖出看跌期权收到的权利金可能抵消部分到期内在价值，因此到期价内并不必然意味着整笔交易亏损。

![单腿期权分析：到期时间、价格位置、盈利概率与资金需求](docs/images/option-analysis.jpg)

*卖出看跌期权示例。价格位置、盈利概率与逐腿 IN / OUT 分别展示；资金需求和流动性信息用于补充判断。*

### 策略识别与组合

应用根据合约腿自动识别策略，允许手动调整分类。同一标的的持仓可以跨账户组合分析；分析归组不会改变券商中的实际仓位，也不建立跨账户抵押或保证金抵扣关系。

| 策略类型 | 分析口径 |
| :--- | :--- |
| 单腿期权 | 以持仓成本计算到期盈亏、盈利概率和盈亏平衡价，同时显示该腿的价内概率。 |
| 价差组合（Spread） | 合并各腿到期盈亏，并保留逐腿价内概率。区分两腿价外、仅一腿价内、两腿价内等情形。 |
| 日历价差（Calendar） | 假设在近月到期时平掉整个组合。远月腿根据届时标的价格、剩余期限及当前隐含波动率估算价值。 |

概率由标的现价、隐含波动率、剩余期限、利率与股息等输入计算。它是模型估计，不是历史胜率。Calendar 的结果尤其受隐含波动率假设影响；缺少必要输入时，不将缺失值视为零。

## 行情工作区

价格图表、报价、自选列表、新闻、期权链和财经电视可以组合在同一工作区。面板支持移动、缩放和独立成窗，适合单屏或多屏使用。

从左侧选择「财经直播」可添加电视面板并切换频道，默认静音播放。直播和新闻保留原始语言；频道可用性取决于播出方、地区及网络。

## 数据存储与连接安全

账户、持仓和交易记录存储在本机。IBKR 通过本机运行的 Gateway / TWS 接入，应用读取账户和市场数据，不提供券商下单功能。手动成交、平仓与资金变动属于本地账本操作，不会改变券商账户。

本地存储不等于离线运行：行情、新闻和直播需要连接外部服务，行情查询会发送标的或合约信息。本地数据库未加密；设备访问控制和备份保护由使用者负责。应用面向单用户本地运行，详细说明见[隐私文档](docs/PRIVACY.md)。

<a name="ibkr"></a>
## 连接 IBKR Gateway / TWS

**准备条件：** 已安装并登录 IB Gateway 或 Trader Workstation（TWS）。可从 [IBKR 官方下载页](https://www.interactivebrokers.com/docs/tws-api/doc/trader-workstation-and-ib-gateway/download-tws-or-ib-gateway)下载安装。

1. **打开 API 设置。** Gateway：`Configure → Settings → API → Settings`；TWS：`Global Configuration → API → Settings`。
2. **启用 Socket API。** TWS 勾选 `Enable ActiveX and Socket Clients`；Gateway 通常默认启用。保持 `Read-Only API` 勾选，并仅允许本机连接。
3. **核对端口。** 记录 `Socket port`，保存设置。下表为默认值，实际以软件中配置的端口为准。
4. **在 TriggerTerminal 中连接。** 打开「仓位与分析 → 账户管理 → IBKR」，填写相同端口和未被其他程序占用的 Client ID，然后读取账户并同步。

| 程序 | 实盘默认端口 | 模拟默认端口 |
| :--- | :--- | :--- |
| IB Gateway | 4001 | 4002 |
| TWS | 7496 | 7497 |

使用期间需保持 Gateway / TWS 登录。可获取的行情由账户权限及订阅决定，API 连接不会增加行情权限。更多配置细节见 [IBKR 官方说明](https://www.interactivebrokers.com/campus/trading-lessons/installing-configuring-tws-for-the-api/)。

<a name="data"></a>
## 数据来源与系统设计

<details>
<summary><strong>数据来源与覆盖范围</strong></summary>

| 数据 | 来源及说明 |
| :--- | :--- |
| 账户、持仓、成交 | IBKR Gateway / TWS；手动账户采用用户录入的本地账本记录。 |
| 报价、历史价格、期权链 | IBKR 与 Yahoo Finance，取决于行情源和资产类型。期权分析优先使用 IBKR；符合条件的标准美元股票期权可使用 Yahoo Finance 补充缺失字段。 |
| 股票基本面、财务数据 | Yahoo Finance 与 SEC EDGAR。覆盖范围受财报日期、币种和可用字段影响。 |
| 基金净值 | 已适配的 TD 基金使用 TD Asset Management 官方页面，并校验基金代码、系列币种和净值日期；不覆盖全部基金。 |
| 模型利率、股息 | 美元利率参考美国财政部期限利率；股息参考 IBKR、Yahoo Finance 或已核对的发行人资料。 |
| 新闻 | Yahoo Finance RSS、Google News 聚合及其链接的原始媒体。 |
| 财经电视 | 所选频道的外部直播流，视频直接连接对应的流媒体服务。 |

行情可能为实时、延迟、冻结或最近一次可用值。同一分析中的字段可能具有不同来源和时间戳，需结合界面标识判断数据时效。

</details>

<details>
<summary><strong>设计原则与更新机制</strong></summary>

- **总览与详情分层。** 列表用于比较仓位，展开视图用于检查计算依据和风险指标。
- **统一成本口径。** 盈亏分析使用持仓成本；策略级指标与单腿概率分别显示。
- **缓存优先展示。** 分析通过 WebSocket 接收更新，并复用缓存与正在进行的请求。重新打开页面时先展示可用快照，再由新数据替换；快照不代表实时行情。
- **账本与券商分离。** 本地记录操作不发送订单，API 持仓以券商同步为准。
- **中英文功能一致。** 两种界面共用分析逻辑，账户名称、合约代码和用户备注保留原值。

</details>

## 文档与支持

| 需求 | 文档 |
| :--- | :--- |
| 安装、账户设置与日常操作 | [中文使用指南](docs/USER_GUIDE.zh-CN.md) |
| 桌面安装与打包 | [桌面版说明](desktop/README.md) |
| 本地存储与外部连接 | [隐私说明](docs/PRIVACY.md) |
| 账本与盈亏计算实现 | [持仓账本设计](docs/HOLDINGS_LEDGER.md) |
| 问题与功能建议 | [GitHub Issues](https://github.com/eztrigger/TriggerTerminal/issues) |

提交问题时，请注明应用版本、系统、操作步骤与错误提示。截图或日志中的账号及个人资料应先遮盖。当前仓库不接受 PR。

## 许可证与致谢

TriggerTerminal 基于 [OpenTerminal](https://github.com/ErTasselli/OpenTerminal)，使用 [MIT 许可证](LICENSE)。第三方代码及资源的许可信息见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
