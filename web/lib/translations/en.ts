// Chinese source copy is the stable key. Keep placeholders in the same numbered form.
import {strategies} from '../../../server/src/strategy-catalog';
export const english:Record<string,string>=Object.fromEntries(`
重新读取 Yahoo Finance	Retry Yahoo Finance
正在读取 Yahoo Finance 期权链	Loading Yahoo Finance option chain
可能延迟 · 缓存最长 5 分钟	May be delayed · Cached for up to 5 minutes
Yahoo 暂无标准期权合约	Yahoo has no standard option contracts available
Yahoo 暂无标的参考价，请选择全部行权价	Yahoo has no underlying reference price; select all strikes
语言	Language
请选择一个仓位	Select one position
选择要移出的仓位	Select a position to remove
多窗口	Windows
仓位不属于此策略组	Position does not belong to this strategy group
成员仓位	Positions
移出策略	Remove from strategy
仅解除分组，不删除仓位或改变账目	Ungroup only; positions and accounting remain unchanged
请选择有效的当前仓位	Select valid open positions
组合不存在	Group not found
请选择仓位，组合最多包含 64 项	Select positions; a group can contain up to 64 positions
加入已有组	Add to existing group
选择已有组合	Select an existing group
策略组	Strategy group
关闭	Close
个标的	underlyings
分组方式	Group by
按仓位 / 策略	Position / strategy
按标的分组	Underlying
标的资产	Underlying assets
编辑原仓位	Edit original position
原仓位平仓 / 行权	Close / exercise original position
删除此仓位会移除其浮动盈亏，不改变现金，也不生成平仓记录。确认删除？	Deleting this position removes its unrealized P&L, leaves cash unchanged and creates no closing trade. Confirm deletion?
撤销会反向调整现金和盈亏，并恢复成交前的持仓数量。	Undo reverses cash and P&L changes and restores pre-trade position quantities.
更正初始现金只调整本地期初记录，不改变券商现金余额或累计盈亏。	Correcting opening cash only changes local opening records, not broker cash or total P&L.
平仓记录已删除，现金结算保留，盈亏已剔除	Closed trade deleted; cash settlement retained, P&L excluded
暂无持仓或盈亏记录	No positions or profit records
累计盈亏包含已记录的已实现盈亏和当前持仓未实现盈亏，不包含入出金。	Total P&L includes recorded realized P&L and unrealized P&L on current positions, excluding deposits and withdrawals.
仅含已记录盈亏，券商历史未补全	Recorded P&L only; broker history is incomplete
累计盈亏 = 已记录的已实现盈亏 + 当前持仓未实现盈亏。删除仓位或平仓记录会移除对应盈亏贡献。入出金不计入盈亏，各币种独立计算。	Total P&L = recorded realized P&L + unrealized P&L on current positions. Deleting a position or closed trade removes its P&L contribution. Deposits and withdrawals are excluded. Currencies are calculated separately.
修改已实现盈亏会同步更新累计盈亏，不改变现金和持仓。现金请通过存款和取款调整。	Editing realized P&L also updates total P&L, without changing cash or positions. Adjust cash through deposits and withdrawals.
删除账户	Delete account
请输入完整账户名称以确认删除	Enter the full account name to confirm deletion.
将永久删除该账户及其全部本地持仓、现金、平仓和盈亏记录，无法撤销。不会关闭券商账户，也不会向券商下单。	This permanently deletes the account and all its local positions, cash, closed trades and profit records. This cannot be undone. It does not close your brokerage account or place orders.
再次同步此 IBKR 账户会重新导入当前持仓，但无法恢复已删除的手动记录。	Syncing this IBKR account again will reimport current positions, but cannot restore deleted manual records.
输入账户名称确认删除	Enter the account name to confirm deletion
确认删除账户	Confirm account deletion
删除中…	Deleting…
账户及关联本地记录已删除。	The account and its associated local records have been deleted.
修改成交会按差额更新现金和已实现盈亏；修改数量会同步调整剩余持仓。修改价格、数量或佣金会覆盖该笔手动盈利更正。已有后续持仓变动时不能修改数量。	Trade corrections adjust cash and realized P&L by the difference; quantity changes also adjust the remaining position. Changing price, quantity or fees replaces any manual profit override for this trade. Quantity cannot change after subsequent position activity.
更正时间不能改变账户成交顺序或早于追踪起点	The corrected time cannot reorder account transactions or precede the tracking start.
关联持仓已有后续变动，不能修改此笔平仓数量	The linked position has changed since this trade; its closing quantity cannot be edited.
平仓数量不能超过当时持仓数量	Closing quantity cannot exceed the position held at that time.
请输入有效的非零股数，支持小数	Enter a valid nonzero share quantity; fractional shares are supported.
期权数量必须为非零整数	Option quantity must be a nonzero whole number.
这些修改不会影响现金和盈利记录，也不会把持仓回补到账户中	These changes do not affect cash or profit records and do not restore positions to the account.
删除会剔除该笔已实现盈亏，不改变现金，也不恢复持仓。需要恢复持仓时请手动添加。	Deleting removes this trade's recorded realized P&L, without changing cash or restoring positions. Add a position manually if needed.
盈利记录	Profit records
已记录盈亏	Recorded P&L
修改已实现盈亏	Edit realized P&L
仅修改已实现盈亏记录，不改变现金、持仓或按总资产计算的累计盈亏。现金请通过存款和取款调整。	Only recorded realized P&L changes. Cash, positions and equity-based cumulative P&L remain unchanged. Adjust cash through deposits and withdrawals.
更正备注	Correction note
暂无盈利记录	No profit records
仅汇总本平台已记录的收益与亏损，不代表券商完整成交历史。	Only gains and losses recorded in this app are included, not complete broker trade history.
盈利记录不存在	Profit record not found
盈利记录已变更，请刷新后重试	The profit record has changed. Refresh and try again.
盈利记录币种无效	Invalid profit record currency
盈利更正信息无效	Invalid profit correction
平仓记录已删除，其盈亏已剔除	The closed trade was deleted and its reported P&L removed.
手动现金调整	Manual cash adjustments
已平仓记录	Closed trades
搜索平仓记录	Search closed trades
搜索资产、账户或备注	Search assets, accounts or notes
开始日期	From date
结束日期	To date
更正平仓记录	Edit closed trade
该持仓已有后续成交，数量不可单独更正。	Later trades depend on this position; its closed quantity cannot be changed independently.
删除平仓记录	Delete closed trade
删除后不恢复持仓，已结算现金和盈亏保留。需要恢复持仓时请手动添加。	Deleting this record does not reopen the position. Settled cash and P&L are retained. Add a position manually if needed.
平仓时间	Closed at
成本单价	Unit cost
平仓单价	Close price
卖出平仓	Sell to close
买入平仓	Buy to close
暂无符合条件的平仓记录	No matching closed trades
仅包含本平台已记录的平仓；券商快照不会自动生成历史成交。	Includes closes recorded in this app. Broker snapshots do not provide historical trades.
券商现金来自同步，手动成交现金调整单独累计。请勿重复录入已被券商同步的成交；券商完整已实现盈亏仍不估算。	Broker cash comes from sync; manual trade cash adjustments are tracked separately. Do not duplicate trades included in broker sync. Full broker realized P&L remains unavailable.
这是独立手动仓位，IBKR 同步不会覆盖；请勿重复录入已有券商仓位。	This is a separate manual position, preserved during IBKR sync. Do not duplicate an existing broker position.
该平仓记录已删除，恢复持仓请手动添加	This closed trade was deleted. Add a position manually to reopen it.
平仓记录不存在或已删除	Closed trade not found or already deleted
平仓记录已变更，请刷新后重试	The closed trade has changed. Refresh and try again.
关联手动仓位不存在，不能更正平仓	The linked manual position is missing; this close cannot be corrected.
更正日期必须位于追踪起点和相邻记录之间	The corrected date must respect the tracking start and adjacent records.
该持仓已有后续成交，不能单独修改早期平仓数量	Later trades depend on this position; the earlier close quantity cannot be changed independently.
平仓更正信息无效	Invalid closed trade correction
账户汇总	Account summary
展开或收起资金明细	Expand or collapse balance details
起算日期	Since
尚未设置追踪起点	Tracking start not set
数据不足	Insufficient data
仓位与持仓	Positions & Holdings
交易台	Terminal
triggerterminal	triggerterminal
面板	Panel
· triggerterminal	· triggerterminal
正在打开面板…	Opening panel…
窗口标的代码	Window symbol
切换标的	Change symbol
独立窗口 · 可拖到其他屏幕	Detached window · Move to another display
IBKR 搜索代码、公司或指数…（Enter 打开 · Shift+Enter 同时加入自选）	Search IBKR symbols, companies or indices… (Enter to open; Shift+Enter to add to watchlist)
IBKR 合约搜索 · ↑↓ 选择，Enter 打开 · 期权在选中标的后查看期权链	IBKR contract search · Select with ↑↓, open with Enter · View options in the option chain
该市场暂未接入交易台行情面板	This market is not supported by the quote panel
指数	Index
股票/ETF	Stocks / ETFs
暂不支持此市场	Market not supported
可查期权	Options available
正在搜索 IBKR…	Searching IBKR…
重试	Retry
未找到结果：“	No results for: “
证券资格	Security eligibility
财务与行业	Financials & industry
接股估值	Assignment valuation
事件与财报	Events & earnings
波动率	Volatility
行业基准	Industry benchmark
全部	All
可研究交易	Trade research eligible
等待入场	Awaiting entry
仅适合股票研究	Equity research only
事件待核查	Event review required
数据不足	Insufficient data
排除	Excluded
通过	Passed
未通过	Failed
缺失	Missing
股票	Stocks
机会池	Opportunity pool
状态	Status
到期日	Expiration
行权价	Strike
有效接股成本	Effective assignment cost
30日权利金%	30-day premium %
现金义务USD	Cash obligation USD
-20%情景USD	−20% scenario USD
评分	Score
证据完整度%	Evidence completeness %
报价时间	Quote time
执行状态	Execution status
未通过原因	Failed checks
参数已保存	Parameters saved
配置未加载	Configuration not loaded
已用原始行情快照重算，报价时间未更新	Recalculated using the original snapshot; quote times are unchanged
返回交易台	Back to terminal
CSP 综合筛选	CSP Screener
V1.1 · 半自动研究工作台	V1.1 · Semi-automated research
筛选结果	Results
复核卡	Review
账户与预算	Account & budget
数据与规则	Data & rules
扫描股票	Scan stocks
扫描 Put	Scan puts
取消扫描	Cancel scan
重算规则	Recalculate
扫描历史	Scan history
导出候选 CSV	Export candidates as CSV
导出完整参数与证据快照	Export parameters and evidence snapshot
导出完整快照	Export full snapshot
筛选参数	Parameters
保存参数	Save parameters
正在读取配置…	Loading configuration…
股票池	Stock universe
最多30只	Up to 30 symbols
载入自选列表	Import watchlist
排名偏好	Ranking preference
均衡	Balanced
接股价值优先	Assignment value first
权利金优先	Premium first
要求已确认形态与技术行权价上限	Require confirmed patterns and a technical strike ceiling
资格与合约范围	Eligibility & contracts
合约范围与各机会池固定条件取交集。	Contract limits are intersected with each pool's fixed rules.
组合上限	Portfolio limits
SEC 数据连接	SEC connection
联系邮箱	Contact email
真实联系邮箱	Valid contact email
仅用于 SEC 自动访问 User-Agent。	Used only in the SEC request User-Agent.
保存参数更改	Save changes
股票研究	Equity research
Put 候选	Put candidates
搜索筛选结果	Search results
搜索代码	Search symbol
结果状态	Result status
机会池筛选	Filter opportunity pools
全部机会池	All pools
市场数据缺口 ·	Market data gaps ·
尚无扫描记录	No scans yet
未设置	Not configured
收盘	Close
60日回撤	60-day drawdown
20日均成交额	20-day avg. turnover
确认形态	Confirmed patterns
Put样本	Put samples
IBKR 未返回资料	No details from IBKR
部分覆盖	Partial coverage
当前筛选无结果	No matching results
股票 / 池	Stock / pool
接股成本	Assignment cost
折价	Discount
30日权利金	30-day premium
现金义务	Cash obligation
−20%情景	−20% scenario
完整度	Completeness
研究分	Research score
天	days
不完整，不计总分	Incomplete; not scored
暂无 Put 合约样本	No put contract samples
复核卡已保存。当前扫描记录保留原证据，重算可应用新结论。	Review saved. Existing scans retain their evidence; recalculate to apply the new review.
日线截至	Daily bars through
根 · IBKR TRADES（拆股调整，未除息调整）	bars · IBKR TRADES (split-adjusted, not dividend-adjusted)
编辑复核卡	Edit review
规则与原因	Rules & reasons
合约与压力	Contracts & stress tests
价格结构	Price structure
公开来源	Public sources
数据缺口 / 读取信息 ·	Data gaps / diagnostics ·
共同资格	Common eligibility
机会路径	Opportunity paths
保守价值	Conservative value
市场新开预算系数	New-position budget factor
尚无合约样本。股票扫描不读取 Put 行情。	No contract samples. Stock scans do not request put quotes.
每只股票最多3个候选；它们是替代方案，不能当作分散投资。压力金额为到期损益，非期中平仓报价。扫描时刻：	Up to 3 alternatives per stock, not diversification. Stress values are expiration P&L, not interim exit quotes. Scanned:
完成日线收盘	Completed daily close
无日线数据	No daily bars
支撑 / 阻力	Support / resistance
周线冲突	Weekly conflict
样本或结构不足	Insufficient history or structure
存在	Present
未发现	Not found
形态	Pattern
可识别日	Identifiable date
确认日	Confirmation date
支撑	Support
失效位	Invalidation level
有效期	Valid until
· 日线	· Daily
已确认	Confirmed
候选	Candidate
弱确认	Weak confirmation
失效	Invalidated
过期	Expired
没有有效形态候选	No valid pattern candidates
SEC 原始申报	Raw SEC filings
原始概念	Raw concept
金额 / 单位	Amount / unit
期间	Period
公开日	Publication date
版本 / 来源	Version / source
以上为原始年度 XBRL 概念，尚未完成公司口径核对，不自动等同于可用 FCF、TTM 或行业质量结论。	These raw annual XBRL concepts have not been reconciled and are not automatically usable FCF, TTM or industry-quality conclusions.
已审核	Reviewed
待审核	Pending review
原文	Source
推断：	Inference:
公开	Published
· 报告期	· Reporting period
· 版本	· Version
账户预算已检查	Account budget checked
未个性化研究	Non-personalized research
每股净权利金	Net premium per share
成交量 / 买盘张数	Volume / bid size
到期标的下跌	Underlying decline at expiration
下一验证节点：	Next verification:
。OI通常为前一日口径，IBKR未提供独立OI更新时间。	. OI generally reflects the prior day; IBKR supplies no separate OI timestamp.
公司与事件复核卡	Company & event review
· 上次复核	· Last reviewed
复核股票	Review symbol
保存复核卡	Save review
已保存	Saved
行业模型	Industry model
普通非金融企业	Non-financial company
银行	Bank
医疗保险	Health insurance
其他保险	Other insurance
半导体/工业周期	Semiconductor / industrial cycle
商品周期	Commodity cycle
行业名称	Industry name
行业比较 ETF	Industry benchmark ETF
例如 XLK	e.g. XLK
ADR 独立标记	Flag as ADR
未知 / 未复核	Unknown / not reviewed
已核实：通过	Verified: pass
已核实：不通过	Verified: fail
下一财报日期	Next earnings date
公司IR已确认（非预计日期）	Confirmed by company IR (not estimated)
冲击事件发生日	Shock event date
重大节点与案件	Major milestones & cases
添加节点	Add milestone
案件 / 项目标识	Case / project ID
节点标题	Milestone title
原文 URL	Source URL
二元节点	Binary event
已解决	Resolved
删除事件	Delete event
证据	Evidence
添加证据	Add evidence
报告期末	Period end
版本 / 申报号	Version / accession number
证据类型	Evidence type
公司申报	Company filing
监管 / 司法文件	Regulatory / court document
管理层说法	Management statement
研究与估值	Research & valuation
已人工核对原文	Source manually verified
关键事实	Key facts
推断 / 假设（与事实分开）	Inferences / assumptions (separate from facts)
删除证据	Delete evidence
此模块暂无证据。未审核或缺少来源的数值不会通过规则。	No evidence in this section. Unreviewed or unsourced values cannot pass checks.
研究备注	Research notes
账户与现金预算	Account & cash budget
USD 口径 · 未确认账户时仅输出非个性化研究排名	USD basis · Rankings remain non-personalized until the account is confirmed
读取 IBKR	Load IBKR
人工录入 / USD	Manual entry / USD
手动账户	Manual account
账户预算已保存	Account budget saved
净资产 NAV / USD	Net asset value / USD
可交割现金总额 / USD	Total eligible settlement cash / USD
已核对券商现金资格（总额未扣已有Put义务）	Cash eligibility checked (before existing put obligations)
持仓、币种换算、行业与风险分类完整	Positions, FX conversions, sectors and risk classifications are complete
已有股票与 Put 义务	Existing stocks & put obligations
添加	Add
行业	Industry
股票市值	Equity market value
Put全额义务	Full put obligation
D/E风险	D/E risk
删除持仓行	Delete position row
保存账户预算	Save account budget
尚未关联研究账户	No research account linked
数据能力与规则口径	Data capabilities & methodology
· 初始研究映射，未经回测校准；分数不代表胜率	· Initial research mapping, not backtest-calibrated; scores are not win probabilities
数据	Data
来源	Source
当前处理	Current handling
日线 / 合约 / Bid Ask / Greeks / OI	Daily bars / contracts / bid-ask / Greeks / OI
按实际权限读取；缺失不补零。独立CSP连接，最多20张同时订阅。	Uses actual entitlements; missing values are not zero-filled. Dedicated CSP connection, up to 20 concurrent contracts.
财务与申报	Financials & filings
SEC EDGAR / 公司IR	SEC EDGAR / company IR
可拉取年度XBRL原始概念与近期申报；口径、TTM、重述和行业模型需人工复核。	Annual XBRL concepts and recent filings are available; definitions, TTM, restatements and industry models require review.
财报与重大事件	Earnings & major events
公司IR / 司法及监管原文	Company IR / court and regulatory sources
人工确认日期、项目标识、事实与推断；未知事件不视为无事件。	Manually verify dates, IDs, facts and inferences. Unknown events are not treated as absent.
F12M EPS 90日修正	90-day F12M EPS revision
尚无可靠免费历史快照源	No reliable free historical snapshot source
人工输入有来源的值；C/F缺失时不通过。	Enter sourced values manually; missing C/F data fails the check.
ATM IV30 Rank / Percentile / 偏斜	ATM IV30 rank / percentile / skew
同口径授权数据或人工证据	Consistent licensed data or manual evidence
未自动连接历史IV服务，不能拿OTM合约IV冒充ATM IV30。	No historical IV service connected. OTM contract IV is not a substitute for ATM IV30.
历史8次财报跳空 / 期限结构	Last 8 earnings gaps / term structure
尚未自动接入	Not yet automated
人工录入已核实统计；不宣称历史最差是损失上限。	Enter verified statistics manually. Historical worst cases are not loss limits.
账户 / 现金 / 已有义务	Account / cash / existing obligations
IBKR + 人工确认	IBKR + manual confirmation
不把购买力当现金；缺少NAV或可交割现金时不做个性化适配。	Buying power is not cash. No personalized assessment without NAV and eligible cash.
回测 / 期中IV情景重估	Backtesting / interim IV scenarios
未实现	Not implemented
仅到期−10/−20/−30%压力测试；未声称策略收益已验证。	Expiration −10/−20/−30% stress tests only; strategy returns are not validated.
已冻结的初始分项映射	Fixed initial score mapping
质量25：路径的质量约束全通过；估值20：保守价值折价百分点，上限20；技术15：路径通过5、匹配确认形态5、无周线冲突且结构可核实5；经济性15：门槛归一化权利金最多5、OI通过5、相对价差通过5；事件15：审核通过；组合10：完整账户且预算全通过。关键模块缺失时不输出总分，风险否决优先。价值模式将估值权重调至30、经济性调至5；权利金模式为15/20，其余不变。	Quality 25: all path quality checks pass. Valuation 20: conservative-value discount points, capped at 20. Technicals 15: path 5, confirmed pattern 5, verified structure without weekly conflict 5. Economics 15: normalized premium up to 5, OI 5, spread 5. Events 15: review passed. Portfolio 10: complete account and budget checks passed. Missing key modules suppress the total; risk vetoes take priority. Value mode weights valuation/economics at 30/5; premium mode at 15/20.
日线信号仅使用完成K线；周线不足104根时不判定周期一致。复核卡有效期30天；已确认财报日过期后需更新。候选数量上限与到期日上限会明确标记部分扫描，未找到合格合约不等于完整市场不存在机会。图表的当前S/Z仅作显示，形态表使用各自事前锁定水平。	Daily signals use completed bars only. Fewer than 104 weekly bars cannot confirm timeframe alignment. Reviews expire after 30 days; past earnings dates require updates. Contract and expiry caps mark scans as partial. No qualifying sample does not mean no market opportunity. Chart S/Z levels are display-only; patterns use their previously fixed levels.
IBKR API 文档	IBKR API documentation
Cboe 历史期权数据	Cboe historical options data
IBKR 标的搜索	IBKR instrument search
输入基金完整代码（FUNDSERV）	Enter the full fund symbol (FUNDSERV)
输入代码或名称，例如 AAPL、RY、VFV	Enter a symbol or name, e.g. AAPL, RY, VFV
基金	Fund
股票 / ETF	Stocks / ETFs
IBKR 未找到匹配合约，请检查代码、币种或资产类型。	No matching IBKR contract. Check the symbol, currency and asset type.
选择搜索结果可锁定具体市场与合约	Select a result to identify the exact market and contract
读取报价…	Loading quote…
获取价格	Get price
；保留原报价。	; the previous quote is retained.
· 估值	· Valuation
普通基金按 IBKR 实际提供的报价读取，可能无盘中 Bid / Ask；未开放给 API 的基金仍可手动记录。	Fund quotes depend on IBKR availability and may lack intraday bid/ask. Funds unavailable through the API can be recorded manually.
归档仓位	Archived positions
持仓明细	Position details
项仓位 / 策略	positions / strategies
项七天内到期	expiring within 7 days
搜索仓位与策略	Search positions and strategies
搜索标的或策略名称…	Search symbol or strategy…
期权	Options
多腿策略	Multi-leg strategies
仓位排序	Position order
最近更新	Recently updated
最先到期	Earliest expiration
已选	Selected
项	items
新组合名称	New strategy name
给策略起个名字	Name this strategy
建立策略分组	Create strategy group
取消选择	Clear selection
仓位 / 策略	Position / strategy
账户	Account
数量	Quantity
到期	Expiry
净成本	Net cost
净市值	Net market value
未实现盈亏	Unrealized P&L
选择	Select
· 分组不完整	· Incomplete group
IBKR 同步	IBKR sync
手动	Manual
混合来源	Mixed sources
买	Long
卖	Short
已过期	Expired
· 多到期日	· Multiple expirations
获取于	Retrieved
逐腿查看	View legs
查看资产备注	View asset notes
添加备注	Add note
展开仓位	Expand position
收起	Collapse
详情	Details
· 旧策略备注（未分配到资产）	· Legacy strategy note (not assigned to an asset)
方向 / 数量	Side / quantity
标的与合约	Symbol & contract
乘数	Multiplier
币种	Currency
单位成本	Unit cost
Bid 买价	Bid
Ask 卖价	Ask
估值价	Mark
市值	Market value
资产备注	Asset notes
空头	Short
多头	Long
编辑	Edit
仓位	Position
归档	Archive
恢复	Restore
删除此手动记录？	Delete this manual record?
确认删除	Confirm deletion
取消	Cancel
删除仓位	Delete position
解除策略分组	Ungroup strategy
没有符合条件的仓位	No matching positions
让每一笔策略都有清晰的全貌	No positions yet
试试其他关键词或切回全部仓位。	Try another search or show all positions.
同步 IBKR 或添加手动仓位，即可在这里查看组合盈亏与到期时间。	Sync IBKR or add a manual position to view P&L and expirations.
计算口径	Methodology
按原币种汇总，空头市值为负。净成本不含历史已实现盈亏；DTE 按纽约日期计算。策略分组与归档不改变券商持仓。	Totals are by original currency; short market values are negative. Net cost excludes historical realized P&L. DTE uses New York dates. Grouping and archiving do not alter broker positions.
查看备注	View note
＋ 添加笔记	+ Add note
暂无笔记	No notes
资产笔记 ·	Asset note ·
记录开仓逻辑、调整计划或提醒…	Entry rationale, adjustment plan or reminders…
保存中…	Saving…
保存笔记	Save note
旧报价	Stale
冻结	Frozen
延迟	Delayed
延迟冻结	Delayed frozen
时效未知	Freshness unknown
市场	Markets
图表	Charts
行情	Quotes
自选	Watchlist
新闻	News
期权链	Options
加密资产	Crypto
研究	Research
股票筛选	Stock screener
CSP 筛选	CSP screener
宏观指数	Macro indices
财经日历	Calendar
内部人交易	Insider trades
资产	Assets
更多	More
财经直播	Live TV
市场综述	Market recap
交易工具	Trading tools
打开	Open
布局设置	Layout settings
恢复默认面板布局？	Reset this workspace layout?
确认重置	Reset
重置布局	Reset layout
降序	Descending
默认顺序	Default order
升序	Ascending
恢复默认顺序	Restore default order
NYSE 交易中	NYSE open
NYSE 已休市	NYSE closed
纽约	New York
米兰	Milan
伦敦	London
东京	Tokyo
— 搜索代码…	— Search symbol…
行情源	Market source
当前：Yahoo Finance	Active: Yahoo Finance
当前：API	Active: API
重启后生效	Restart to apply
重启交易台	Restart terminal
请在桌面版交易台中重启；浏览器刷新不会重启行情服务。	Restart in the desktop app; refreshing the browser does not restart market services.
重启	Restart
配置读取或保存失败	Could not load or save settings
多窗口 ↗	Windows ↗
空白交易台	blank terminal
点击设置此面板的代码	Click to set this panel's symbol
行情报价	Quotes
价格图表	Price chart
自选列表	Watchlist
新闻资讯	News
宏观与指数	Macro & indices
账户与持仓	Accounts & holdings
在独立窗口打开，可拖到其他屏幕	Open in a separate window
独立窗口打开	Open separate window:
跟随当前代码（点击取消联动）	Following active symbol (click to unlink)
独立代码（点击开启联动）	Independent symbol (click to link)
本地	Local
芝加哥	Chicago
法兰克福	Frankfurt
悉尼	Sydney
加载失败：	Failed to load:
正在加载日历…	Loading calendar…
中高影响	Medium / high impact
日期	Date
事件	Event
预期	Forecast
前值	Previous
实际	Actual
当前时间范围内暂无事件。	No events in this time range.
正在加载历史：	Loading history:
暂无财报历史：	No earnings history:
季度	Quarter
公布日期	Release date
超预期幅度	Surprise
次日涨跌	Next-day change
正在加载财报…	Loading earnings…
代码	Symbol
上次财报	Last earnings
下次财报	Next earnings
预期 EPS	Expected EPS
点击查看历史财报	View earnings history
自选列表暂无即将公布的财报。	No upcoming earnings in your watchlist.
经济日历	Economic calendar
财报日历	Earnings calendar
K线	Candles
折线	Line
面积	Area
刷新中…	Refreshing…
刷新	Refresh
来源：	Source:
· 周期：	· Interval:
· 最新 K 线：	· Latest bar:
UTC · 请求成功：	UTC · Retrieved:
· 每分钟刷新	· Updates every minute
行情更新失败：	Market update failed:
下方保留上次数据，请核对最新 K 线时间。	Previous data is retained. Check the latest bar time.
当前周期暂无可用数据，请稍后刷新或切换周期。	No data for this range. Refresh later or select another range.
成交量	Volume
总市值	Market cap
价格	Price
24小时成交量	24h volume
等待更新	Awaiting update
净资产	Net liquidation
总现金	Total cash
可用资金	Available funds
剩余流动性	Excess liquidity
购买力	Buying power
初始保证金	Initial margin
维持保证金	Maintenance margin
IBKR 资金与账户明细	IBKR funds & account details
Gateway 已连接	Gateway connected
连接 / 同步中…	Connecting / syncing…
未连接	Disconnected
IBKR 账户	IBKR account
隐藏账户号	Hide account number
显示账户号	Show account number
同步中…	Syncing…
连接设置	Connection settings
API 端口	API port
保存并重连	Save & reconnect
Gateway 常用端口：实盘 4001 / 模拟 4002；TWS：实盘 7496 / 模拟 7497。以 Gateway 设置为准。	Gateway defaults: live 4001 / paper 4002. TWS: live 7496 / paper 7497. Use your configured port.
在 Gateway 中完成登录，允许本机 Socket API 连接；可以保持 Read-Only API 开启。无需提供账户密码。	Sign in to Gateway and allow local Socket API connections. Read-Only API may remain enabled. No password is required here.
同步失败：	Sync failed:
下方保留上次数据，已过期，不代表当前账户状态。	Previous data is retained and stale; it does not represent the current account state.
请检查 Gateway 登录和 API 设置，然后点击刷新。	Check Gateway login and API settings, then refresh.
正在从 IB Gateway 读取账户资金和持仓…	Loading account funds and positions from IB Gateway…
账户汇总币种：	Account reporting currency:
BASE（Gateway 未提供币种代码）	BASE (Gateway supplied no currency code)
最近读取	Last retrieved
· 资金更新	· Funds updated
分币种现金	Cash by currency
现金余额	Cash balance
已结算现金	Settled cash
Gateway 未提供分币种现金明细。	Gateway supplied no currency cash breakdown.
账户持仓 ·	Account positions ·
持仓类型	Asset filter
全部资产	All assets
期货	Futures
期货期权	Futures options
外汇	Forex
合约	Contract
类型	Type
到期 / 方向 / 行权价	Expiry / right / strike
IB 估值价	IB mark
此分类下没有持仓。	No positions in this category.
已完成持仓同步：此账户当前没有未平仓合约。可切换上方账户查看。	Sync complete: this account has no open positions. Select another account above.
持仓同步中…	Syncing positions…
金额按原币种显示 · 估值仅供参考	Amounts in original currency · Indicative valuations
公开市场买入	Open-market purchase
公开市场卖出	Open-market sale
授予／奖励	Grant / award
期权行权	Option exercise
赠与	Gift
代扣税款	Tax withholding
转换	Conversion
转让给发行人	Disposition to issuer
正在加载内部人交易：	Loading insider trades:
内部人	Insider
职务	Role
股数	Shares
金额	Value
交易后持股	Shares after trade
暂无近期公开市场内部人交易：	No recent open-market insider trades:
交易记录	Transactions
已实现	Realized
买入	Buy
卖出	Sell
平均成本	Average cost
最新价	Last
已实现盈亏	Realized P&L
方向	Side
正在加载宏观数据…	Loading macro data…
欧元区 AAA 收益率曲线	Euro area AAA yield curve
美国国债收益率曲线	US Treasury yield curve
ECB 存款利率	ECB deposit rate
指数 / 商品	Index / commodity
涨跌幅	Change %
基金（非 ETF）	Fund (not ETF)
现金 / 外汇	Cash / forex
其他资产	Other asset
仓位已保存到本地，没有向券商下单。	Position saved locally. No order was sent to the broker.
IBKR 同步完成：	IBKR sync complete:
个持仓；手动仓位保持不变。	positions; manual positions are unchanged.
全部账户当前持仓汇总	Current positions across all accounts
全部账户 · 当前持仓	All accounts · Open positions
净持仓市值	Net position value
部分仓位缺少估值	Some positions lack valuations
仓位管理导航	Position navigation
持仓	Positions
IBKR 账户与同步	IBKR account & sync
账户管理	Accounts
自动同步已开启	Auto-sync enabled
＋ 添加仓位	+ Add position
同步失败，本地仓位未改动：	Sync failed; local positions unchanged:
正在获取报价…	Loading quotes…
↻ 刷新价格	↻ Refresh prices
筛选券商账户	Filter broker accounts
全部券商 / 账户	All brokers / accounts
仓位状态	Position status
当前持仓	Open positions
归档 / 已平仓	Archived / closed
新增	Add
券商账户	Broker account
券商名称	Broker
账户昵称	Account nickname
账户号（可选）	Account number (optional)
账户号	Account number
保存账户	Save account
编辑仓位	Edit position
新增仓位 / 多腿组合	Add position / multi-leg strategy
归属账户	Account
仓位归属账户	Position account
仓位 / 策略名称	Position / strategy name
仓位名称	Position name
第	Leg
腿	leg
移除此腿	Remove leg
资产类型	Asset type
代码 / 标的	Symbol / underlying
标的	Underlying
数量（负数为空头）	Quantity (negative for short)
期权方向	Option right
单位平均成本（可选）	Average unit cost (optional)
成本	Cost
单位估值价（可选）	Unit mark (optional)
资产备注 ·	Asset notes ·
未选择资产	No asset selected
＋ 添加组合腿	+ Add leg
旧策略备注（未分配到资产）	Legacy strategy note (not assigned to an asset)
保存仓位	Save position
选择账户，将 Gateway 持仓更新到你的策略工作区。	Select an account to sync Gateway positions to your workspace.
IBKR 持仓同步	IBKR position sync
同步 IBKR 账户	IBKR account to sync
Gateway 默认账户	Gateway default account
同步到仓位页	Sync positions
重读 IB 账户	Reload IB accounts
每 30 秒同步所选 IB 账户	Sync selected IB account every 30 seconds
首次同步自动建立 IBKR 账户；只更新该账户的 IBKR 来源仓位。已经平仓的同步记录进入归档，手动仓位和组合不被覆盖。同步为独立合约腿，可在“仓位与策略”中勾选并建立策略分组。	The first sync creates an IBKR account. Only its IBKR positions are updated; closed positions are archived. Manual positions and groups are preserved. Synced contract legs can be grouped into strategies.
Gateway 暂不可用，仍可管理手动仓位。	Gateway unavailable. Manual positions remain editable.
券商与账户	Brokers & accounts
管理账户信息与历史记录。	Manage account details and history.
＋ 添加账户	+ Add account
显示完整账户号	Show full account numbers
未填账户号	No account number
上次同步	Last synced
编辑账户	Edit account
添加券商账户，或在“IBKR 同步”中导入已有账户。	Add a broker account or import one through IBKR sync.
历史手动账本	Legacy manual ledger
原有交易记录保留在此，不重复计入仓位汇总。	Historical transactions are retained here and excluded from position totals.
全球	Global
新闻排序	News order
时间升序	Oldest first
时间降序	Newest first
正在加载新闻…	Loading news…
实时	Live
未确认	Unconfirmed
读取中…	Loading…
显示数量	Rows
10 条	10 rows
20 条	20 rows
无法获取期权链：	Cannot load option chain:
重新读取 IBKR	Reload IBKR
正在读取 IBKR 期权链	Loading IBKR option chain
（全部合约分批读取中）	(all contracts, in batches)
（可能需要约 20 秒）	(may take about 20 seconds)
标的价格	Underlying price
合约系列	Contract class
暂无报价	No quote
读取于	Retrieved
· 手动刷新	· Manual refresh
行权价中心	Center strike
跟随标的	Follow underlying
全部行权价	All strikes
· 当前	· Current
条；读取时间不是成交时间。	rows; retrieval time is not trade time.
· 部分合约无买卖报价，缺失项以 — 显示。	· Some contracts lack bid/ask; missing values appear as —.
看涨 Call	Calls
看跌 Put	Puts
买价	Bid
卖价	Ask
开盘	Open
最高	High
最低	Low
昨收	Previous close
3个月均量	3-month avg. volume
卖空成交占比	Short volume %
股息率	Dividend yield
52周最高	52-week high
52周最低	52-week low
流通股数	Shares outstanding
正在加载市场综述…	Loading market recap…
更新于	Updated
领涨榜	Gainers
领跌榜	Losers
板块表现	Sector performance
板块	Sector
新闻头条	Headlines
美股	US stocks
欧股	European stocks
全部板块	All sectors
最低涨跌幅%	Min. change %
最低市值（十亿美元）	Min. market cap (USD bn)
最低成交量（百万）	Min. volume (millions)
名称	Name
播放超时	Playback timed out
视频加载失败	Video failed to load
你的浏览器不支持 HLS 播放。	Your browser does not support HLS playback.
CNBC · 线路	CNBC · Feed
· 故障自动切换	· Automatic failover
切换线路	Switch feed
重新连接	Reconnect
CNBC 官方直播 ↗	CNBC official live ↗
添加代码…	Add symbol…
行情未连接	Quotes disconnected
报价受限	Quote unavailable
加载中	Loading
自定义组合	Custom strategy
跨式 Straddle	Straddle
宽跨式 Strangle	Strangle
日历价差 Calendar	Calendar spread
对角价差 Diagonal	Diagonal spread
铁鹰 Iron Condor	Iron condor
正在连接…	Connecting…
添加代码以订阅 IBKR 行情	Add symbols to subscribe
Yahoo Finance 暂无报价	No Yahoo Finance quote
连接中断，正在重连…	Disconnected; reconnecting…
正在连接 IBKR 推送…	Connecting to IBKR stream…
连接中断，显示上次报价，正在重连…	Disconnected; showing previous quotes while reconnecting…
窗口未能打开，请允许此网站弹出窗口，或使用桌面版交易台。	Could not open window. Allow pop-ups or use the desktop app.
`.trim().split('\n').map(line=>line.split('\t')));
Object.assign(english,Object.fromEntries(`
服务重启中断了扫描，请重新启动	Service restart interrupted the scan; start it again
请检查账户数字、时间及持仓格式	Check account numbers, timestamps and position formats
含非USD持仓，须换算并补齐。	Non-USD positions require conversion and completion.
账户读取失败	Account load failed
已有扫描运行中	A scan is already running
扫描参数无效	Invalid scan parameters
请先设置股票池	Configure the stock universe first
准备市场数据	Preparing market data
扫描记录不存在	Scan record not found
该扫描已结束	This scan has ended
扫描中，请完成或取消后重算	Finish or cancel the active scan before recalculating
扫描不存在	Scan not found
使用原行情快照重新评估	Re-evaluating the original market snapshot
仅重算：行情时间未更新；F池行业数据需重新扫描	Recalculation only: quote times unchanged; pool F industry data requires a new scan
读取失败	Load failed
读取真实 Put 合约	Loading actual put contracts
读取日线和公开申报	Loading daily bars and public filings
IBKR读取失败	IBKR load failed
扫描失败	Scan failed
扫描完成	Scan complete
扫描已取消	Scan cancelled
缺少已审核、带报告期和版本的来源	Missing reviewed sources with reporting period and version
数据缺失	Missing data
IBKR 股票日线	IBKR daily equity bars
美国上市普通股资格	US-listed common stock eligibility
无合约主数据	No contract reference data
市值门槛	Market-cap threshold
20日平均成交额	20-day average turnover
财务与经营可信度	Financial and operating reliability
事件日历复核	Event calendar review
下一财报日期已确认	Next earnings date confirmed
缺少公司IR确认日期	No date confirmed by company IR
公司行为已复核	Corporate actions reviewed
已审核保守估值	Reviewed conservative valuation
SPY/VIX 市场数据	SPY / VIX market data
未取得时不判定普通风险环境	An ordinary-risk regime is not assumed without this data
排除 OTC	Exclude OTC
排除非普通股	Exclude non-common shares
日线新鲜度	Daily-bar freshness
三财年 FCF > 0	FCF > 0 for three fiscal years
前一财年 FCF > 0	Prior fiscal-year FCF > 0
前二财年 FCF > 0	FCF two fiscal years ago > 0
TTM 净利润 > 0	TTM net income > 0
净负债/EBITDA ≤ 2.5	Net debt / EBITDA ≤ 2.5
利息保障 ≥ 5	Interest coverage ≥ 5
特殊行业审核模型	Reviewed industry-specific model
压力资金覆盖 ≥ 1.5	Stressed funding coverage ≥ 1.5
资金覆盖 ≥ 24个月	Funding runway ≥ 24 months
特殊行业资金模型	Industry-specific funding model
A 趋势/回撤/RSI	A trend / drawdown / RSI
12季度营业利润率标准差 ≤ 3pp	12-quarter operating margin standard deviation ≤ 3 pp
商业模式稳定	Stable business model
B 区间/ADX/均线	B range / ADX / moving averages
三年收入 CAGR ≥ 10%	3-year revenue CAGR ≥ 10%
EPS 90日下修不超5%	90-day EPS downgrade ≤ 5%
无重大融资缺口	No material funding gap
SBC与稀释计入估值	Valuation includes SBC and dilution
行业相对质量已复核	Industry-relative quality reviewed
C 趋势/RSI/ATR	C trend / RSI / ATR
事件发生于90日内	Event within 90 days
事件跌幅与行业相对跌幅	Event drawdown and industry-relative drawdown
事件损害可界定	Event damage can be bounded
修复证据 ≥ 2	Recovery evidence ≥ 2
已兑现证据 ≥ 1	Realized recovery evidence ≥ 1
D 五日不破低且三日>MA10	D no new low in 5 days and 3 days above MA10
两季度改善指标 ≥ 2	Improving indicators across 2 quarters ≥ 2
改善指标独立性	Independence of improvement indicators
E 20日不创新低且MA20上升	E no new low in 20 days and rising MA20
行业20日跌幅 ≥ 10%	Industry 20-day decline ≥ 10%
需设置可核实行业基准	A verifiable industry benchmark is required
相对行业不落后超过5pp	Underperformance versus industry ≤ 5 pp
行业基准选择已审核	Industry benchmark selection reviewed
无公司独立恶化	No company-specific deterioration
F 三日无新低	F no new low in 3 days
无日线风险否决	No daily risk veto
无周线结构冲突	No weekly structure conflict
104周样本/结构不足：不加周期确认分	Insufficient 104-week history / structure: no timeframe confirmation points
完成周线	Completed weekly bars
匹配且有效的已确认形态	Matching valid confirmed pattern
形态不能替代机会池的独立趋势条件	Patterns do not replace the pool's independent trend requirements
高风险市场人工复核	Manual review of high-risk market
市场风险	Market risk
SPY弱势叠加VIX压力；新开预算减半	Weak SPY and elevated VIX: new-position budget halved
标准股票 Put / 乘数100	Standard equity put / multiplier 100
交割条款需复核	Review settlement terms
有效 Bid/Ask	Valid bid / ask
OI 门槛	OI threshold
相对价差门槛	Relative spread threshold
实时行情确认	Live quote confirmation
冻结报价，仅供研究，交易前需刷新实时行情	Frozen quote; research only. Refresh live data before trading.
延迟报价，仅供研究	Delayed quote; research only
延迟冻结报价，仅供研究	Delayed frozen quote; research only
行情类型未确认	Market data type unconfirmed
买盘数量覆盖计划张数	Bid size covers planned contracts
显示深度不是成交保证	Displayed depth does not guarantee execution
报价接收时间可用	Quote timestamp available
财报日期缓冲	Earnings-date buffer
未知	Unknown
无跨期重大二元节点	No major binary event before expiration
30日净权利金门槛	30-day net premium threshold
正净权利金	Positive net premium
现金100%覆盖（扣除已有Put义务）	100% cash coverage after existing put obligations
单股持仓与义务上限	Single-stock exposure and obligation limit
行业暴露上限	Industry exposure limit
CSP总预算 / 风险状态新开预算	CSP total budget / risk-adjusted new-position budget
同到期周预算	Same-expiry-week budget
D/E合计预算	Combined D/E budget
机会池DTE与可调范围	Pool DTE and adjustable range
机会池Delta与可调范围	Pool delta and adjustable range
接股成本≤保守价值折扣上限	Assignment cost ≤ discounted conservative value
缺少估值	Missing valuation
行权价≤形态技术上限	Strike ≤ pattern technical ceiling
无事前确认支撑	No previously confirmed support
行权价≤此前60日区间下界	Strike ≤ prior 60-day range floor
IV>60%尾部风险复核	Tail-risk review for IV > 60%
高IV	High IV
趋势	Trend
周线	Weekly
日线	Daily
高风险研究	High-risk research
常规研究	Standard research
扫描时实时研究报价 · 非成交承诺	Live research quote at scan time · No execution guarantee
仅研究 · 延迟/冻结/时间不同步或过期	Research only · Delayed, frozen, unsynchronized or stale
限价、交割条款、账户现金及最新事件复核	Review limit price, settlement terms, cash and latest events
优质回调	Quality pullback
稳定区间	Stable range
稳健成长	Steady growth
事件修复	Event recovery
周期转型	Cyclical turnaround
行业普跌	Industry-wide decline
最低市值 / 十亿美元	Min. market cap / USD bn
20日均成交额 / 百万美元	20-day avg. turnover / USD m
最短 DTE	Min. DTE
最长 DTE	Max. DTE
最小 |Delta|	Min. |Delta|
最大 |Delta|	Max. |Delta|
最低 OI	Min. OI
最大相对价差 / %	Max. relative spread / %
最低30日权利金 / %	Min. 30-day premium / %
每张预计费用 / USD	Est. fees per contract / USD
计划张数	Planned contracts
财报前缓冲 / 天	Pre-earnings buffer / days
每股合约扫描上限	Contract scan limit per stock
每股到期日上限	Expiry limit per stock
CSP 总义务上限 / NAV %	Max. CSP obligations / NAV %
普通股票上限 / NAV %	Standard stock limit / NAV %
高风险股票上限 / NAV %	High-risk stock limit / NAV %
行业上限 / NAV %	Industry limit / NAV %
D/E 合计上限 / NAV %	Combined D/E limit / NAV %
同到期周 / CSP预算 %	Same expiry week / CSP budget %
最小值不能超过最大值	Minimum cannot exceed maximum
市值 / 十亿美元	Market cap / USD bn
保守价值下限 / 股 USD	Conservative value floor / USD per share
保守价值上限 / 股 USD	Conservative value ceiling / USD per share
最近财年 FCF / 百万美元	Latest fiscal-year FCF / USD m
前一财年 FCF / 百万美元	Prior fiscal-year FCF / USD m
前二财年 FCF / 百万美元	FCF two fiscal years ago / USD m
最近财年净利润 / 百万美元	Latest fiscal-year net income / USD m
前一财年净利润 / 百万美元	Prior fiscal-year net income / USD m
前二财年净利润 / 百万美元	Net income two fiscal years ago / USD m
TTM 净利润 / 百万美元	TTM net income / USD m
TTM FCF / 百万美元	TTM FCF / USD m
净负债 / EBITDA	Net debt / EBITDA
EBIT / 利息费用	EBIT / interest expense
12季度营业利润率标准差 / 百分点	12-quarter operating margin std. dev. / pp
3年收入 CAGR / %	3-year revenue CAGR / %
90日 F12M EPS 修正 / %	90-day F12M EPS revision / %
压力资金覆盖倍数	Stressed funding coverage ratio
压力资金覆盖月数	Stressed funding runway / months
独立修复证据数	Independent recovery evidence count
已兑现修复证据数	Realized recovery evidence count
连续2个可比季度改善的独立指标数	Independent improving indicators over 2 comparable quarters
事件后5交易日收益 / %	5-trading-day post-event return / %
事件后20交易日收益 / %	20-trading-day post-event return / %
事件期相对行业收益 / 百分点	Event-period industry-relative return / pp
同口径 ATM IV30 / %	Consistent-basis ATM IV30 / %
同口径 IV Rank / %	Consistent-basis IV rank / %
同口径 IV Percentile / %	Consistent-basis IV percentile / %
同期限25Delta Put IV减ATM / 百分点	Same-expiry 25-delta put IV minus ATM / pp
最近8次财报最差隔夜收益 / %	Worst overnight return over last 8 earnings / %
美国交易所普通股资格（ETF/OTC等不通过）	US-exchange common stock eligibility (excludes ETFs / OTC)
无破产、持续经营或未解决重大重述	No bankruptcy, going-concern issue or unresolved material restatement
特殊行业模型已审核通过	Industry-specific model reviewed and passed
无商业模式突变	No abrupt business-model change
估值已包含 SBC 和完全摊薄股数	Valuation includes SBC and fully diluted shares
行业相对质量指标已复核	Industry-relative quality metrics reviewed
财报及重大节点已完整复核	Earnings and major milestones fully reviewed
无公司独立重大恶化	No material company-specific deterioration
事件损害机制和持续/一次性损失可界定	Event damage and recurring / one-off losses can be bounded
改善指标相互独立且覆盖2个可比季度	Improvement indicators are independent and cover 2 comparable quarters
已核对拆股、除息和其他公司行为	Splits, dividends and other corporate actions checked
本次扫描系列为标准100股交割	Scanned series has standard 100-share delivery
日期无效	Invalid date
仅支持 HTTP/HTTPS 来源	Only HTTP/HTTPS sources are supported
SEC 联系邮箱无效	Invalid SEC contact email
已取消	Cancelled
IBKR 扫描超时	IBKR scan timed out
IBKR 响应过大	IBKR response too large
IBKR 返回格式无效	Invalid IBKR response format
IBKR 未返回有效数据	IBKR returned no valid data
SEC 自动读取未启用：在数据设置填写真实联系邮箱，或手动添加 SEC/IR 原文证据。	SEC auto-fetch is disabled. Enter a valid contact email or add SEC/IR evidence manually.
SEC 未找到该股票的 CIK	No SEC CIK found for this symbol
经营现金流	Operating cash flow
资本支出	Capital expenditure
净利润	Net income
收入	Revenue
合同收入	Contract revenue
营业利润	Operating income
利息费用	Interest expense
普通股股数	Common shares
SEC读取失败	SEC load failed
支撑锤头	Hammer at support
看涨吞没	Bullish engulfing
早晨之星近似	Approximate morning star
假跌破收回	Reclaimed false breakdown
双底突破	Double-bottom breakout
突破后回踩	Breakout retest
缩量回调	Low-volume pullback
失守支撑后反弹失败	Failed rebound after support break
跳空大阴线：公司行为/事件待核查	Large bearish gap: review corporate actions / events
阻力附近看跌吞没已确认	Confirmed bearish engulfing near resistance
放量支撑失守，尚未价量收复	High-volume support break without price-volume recovery
连续更低高低点且 ADX > 25	Successive lower highs and lows with ADX > 25
箱体下沿企稳	Stabilization at range floor
Yahoo 暂不支持此资产自动报价	Yahoo does not support automatic quotes for this asset
请确认此资产的 Yahoo 市场代码	Verify this asset's Yahoo market symbol
Yahoo 仅支持标准美股期权；此合约需人工确认	Yahoo supports standard US equity options only; verify this contract manually
Yahoo 未返回指定到期日	Yahoo did not return the requested expiration
Yahoo 未找到匹配期权合约	Yahoo found no matching option contract
Yahoo 返回币种与资产不符，未更新	Yahoo currency does not match the asset; not updated
Yahoo 暂无可用报价	No usable Yahoo quote
无效到期日	Invalid expiration date
数量不能为零	Quantity cannot be zero
期权需要有效到期日、Call/Put、行权价和整数张数	Options require a valid expiration, right, strike and whole contract quantity
请选择同一账户的当前仓位	Select open positions in the same account
部分仓位已属于其他组合，请先解除分组	Some positions belong to another strategy; ungroup them first
账户不存在	Account not found
只能编辑手动仓位，IBKR 仓位请通过同步更新	Only manual positions are editable; update IBKR positions through sync
请先解除策略分组，再更改所属账户	Ungroup the strategy before changing its account
仓位不存在	Position not found
IBKR 同步仓位不能删除，请通过 IBKR 同步更新	Synced IBKR positions cannot be deleted; update them through sync
请输入券商、账户名称和有效账户标识	Enter a broker, account name and valid account identifier
账户信息无效	Invalid account details
无效状态	Invalid status
只能归档或恢复手动仓位	Only manual positions can be archived or restored
账户不匹配，未更新本地仓位	Account mismatch; local positions unchanged
IBKR 同步失败，本地数据未修改	IBKR sync failed; local data unchanged
请输入组合名称并选择至少两项不同仓位	Enter a strategy name and select at least two distinct positions
账户筛选无效	Invalid account filter
正在刷新报价，请稍候	Quotes are refreshing; please wait
报价失败	Quote failed
刷新失败	Refresh failed
资产或笔记无效	Invalid asset or note
资产已变更，请刷新后编辑	Asset changed; refresh before editing
笔记最多 2000 字	Notes are limited to 2,000 characters
无效仓位	Invalid position
请填写有效合约信息	Enter valid contract details
IBKR 期权连接已中断，请重新刷新	IBKR options connection lost; refresh again
请输入有效代码、到期日和 OTM 百分比	Enter a valid symbol, expiration and OTM percentage
期权读取繁忙，请稍后刷新	Options service is busy; refresh later
期权读取失败	Options load failed
IBKR 报价连接已中断，请重试	IBKR quote connection lost; retry
报价请求较多，请稍后重试	Too many quote requests; retry shortly
IBKR 搜索连接已中断，请重试	IBKR search connection lost; retry
搜索请求较多，请稍后重试	Too many search requests; retry shortly
IBKR 连接已重置，请重试	IBKR connection reset; retry
请输入有效端口和 Client ID	Enter a valid port and Client ID
无法读取 IBKR 账户	Cannot load IBKR account
无效代码或图表周期	Invalid symbol or chart range
IBKR 历史行情读取失败	IBKR historical data load failed
搜索内容无效	Invalid search
IBKR 搜索失败	IBKR search failed
无效行情源	Invalid market source
行情源保存失败	Could not save market source
按所选周期	Selected interval
Nasdaq（历史日线）	Nasdaq (historical daily bars)
标普 500 指数 · SPX / SPXW 期权	S&P 500 index · SPX / SPXW options
^GSPC SPXW 标普	^GSPC SPXW S&P
纳斯达克 100 指数	Nasdaq 100 index
^NDX 纳斯达克	^NDX Nasdaq
罗素 2000 指数	Russell 2000 index
^RUT 罗素	^RUT Russell
波动率指数	Volatility index
^VIX 波动率	^VIX volatility
Yahoo Finance 模式使用 HTTP 行情	Yahoo Finance mode uses HTTP quotes
连接请求过多	Too many connection requests
客户端处理过慢	Client processing too slow
IBKR 推送服务重连	Reconnecting IBKR stream
无法读取 IBKR 连接配置	Cannot read IBKR connection settings
正在订阅 IBKR 行情…	Subscribing to IBKR quotes…
订阅超过 60 个不同标的	Subscription exceeds 60 distinct instruments
订阅无效或超过总计 60 个合约上限	Invalid subscription or total contract limit of 60 exceeded
`.trim().split('\n').map(line=>line.split('\t'))));
Object.assign(english,{
 "打开 {0}":"Open {0}",
 "复核 {0}":"Review {0}",
 "事件{0}标识":"Event {0} ID",
 "事件{0}标题":"Event {0} title",
 "事件{0}日期":"Event {0} date",
 "事件{0}来源":"Event {0} source",
 "删除事件{0}":"Delete event {0}",
 "删除证据{0}":"Delete evidence {0}",
 "持仓{0} {1}":"Position {0} {1}",
 "删除持仓{0}":"Delete position {0}",
 "{0} · {1} · {2} · 合约 {3}":"{0} · {1} · {2} · Contract {3}",
 "{0} 条腿":"{0} legs",
 "{0} 条备注":"{0} notes",
 "IB 原始每合约成本：{0}":"IB original cost per contract: {0}",
 "已更新 {0} 个资产{1}。{2}":"Updated {0} assets{1}. {2}",
 "，{0} 个未更新（保留原值）":", {0} unchanged (previous values retained)",
 "中心附近 {0} 档行权价":"{0} strikes near center",
 "正在加载 {0}…":"Loading {0}…",
 "{0} 暂无报价":"No quote for {0}",
 "{0} 条结果":"{0} results",
 "直播线路暂不可用 ({0})，请重新连接或切换频道。":"Live feed unavailable ({0}); reconnect or change channel.",
 "{0} 垂直价差":"{0} vertical spread",
 "{0} 个资产报价未更新：{1}":"{0} asset quotes not updated: {1}",
 "IBKR；USD研究。{0}":"IBKR; USD research. {0}",
 "市场状态 · {0}":"Market status · {0}",
 "行业基准：{0}":"Industry benchmark: {0}",
 "{0} 根有效完成日线；不足252日进入观察":"{0} valid completed daily bars; fewer than 252 means watch only",
 "余 {0} 个交易日":"{0} trading days remaining",
});

Object.assign(english,Object.fromEntries(strategies.map(s=>[s.zh,s.en])),{
 '主导航':'Primary navigation',
 '持仓研究':'PORTFOLIO RESEARCH',
 '自定义':'Custom',
 '账户覆盖检查':'Account coverage check','总额检查，不代表券商保证金':'Gross coverage, not broker margin',
 'Put 全额接股':'Gross put obligation','可用现金快照':'Cash snapshot','资金缺口':'Cash shortfall',
 'Call 交股':'Call share obligation','净股票数':'Net stock shares','未覆盖股数':'Uncovered shares',
 '暂无卖出股票期权':'No short equity options',
 '全部到期日合计；不抵扣买入期权、不认可跨账户担保，也未预留其他资金用途。':'All expiries combined. No long-option offsets or cross-account coverage; other cash commitments are not reserved.',
 '确认这些是实物股票期权，无现金结算或特殊交割':'Confirm physical equity options, with no cash settlement or adjusted deliverables',
 '持仓分析':'Portfolio analysis','重新读取本地持仓':'Reload local holdings','分析视图':'Analysis views',
 '组合总览':'Portfolio overview','标的研究':'Underlying research','策略生命周期':'Strategy lifecycle',
 '各币种独立':'Separate currencies','本地持仓读取失败':'Could not read local holdings',
 '本地快照 · 行情暂不可用':'Local snapshot · Quotes unavailable','IBKR / 本地持仓快照':'IBKR / Local holdings snapshot',
 '项资产':'assets','不向券商下单':'No orders sent','正在读取持仓…':'Reading holdings…',
 '暂无可分析持仓':'No holdings to analyze','添加或同步仓位':'Add or sync holdings','分析标的':'Select underlying',
 '情景结果为模型估算，不是券商保证金、成交报价或税务报表。':'Scenarios are model estimates, not broker margin, executable quotes or tax reports.',
 '标的集中度':'Underlying concentration','按绝对市值 · 非风险权重':'Absolute market value · Not risk weights',
 '资产数':'Assets','币种内占比':'Currency weight','已记录实现盈亏':'Recorded realized P&L',
 '尚无此币种的已实现盈亏记录':'No realized P&L recorded in this currency',
 '仅本地已记录成交，不代表完整历史净值。':'Local recorded transactions only, not a complete equity history.',
 '到期与交割资金':'Expiry & delivery funding','短仓按全部交割计算，不抵扣价差':'Gross short delivery obligations, before spread offsets',
 '剩余天数':'Days remaining','期权张数':'Contracts','卖出 Put 接股金额':'Short put purchase obligation',
 '卖出 Call 交股数量':'Short call share obligation','暂无期权持仓':'No option holdings',
 '目标日期':'Target date','波动率假设':'Volatility assumption','利率假设':'Rate assumption','分红率假设':'Dividend yield assumption',
 '长期情景':'Long-term scenarios','等待 IBKR，或手动填写':'Awaiting IBKR, or enter manually',
 '手动情景价':'Manual scenario price','IBKR / 本地股票快照':'IBKR / Local stock snapshot','最早到期日':'First expiry',
 'Black–Scholes 欧式近似；全部期权共用上述假设。美式提前行权、离散股息及交割后的价格路径不在模型内。超过某腿到期日时，组合结果不计算。':'European Black–Scholes approximation; common assumptions for all options. Excludes early exercise, discrete dividends and post-delivery price paths. No combined result beyond any leg’s expiry.',
 '价格情景与累计持仓盈亏':'Price scenarios & position P&L','情景持仓价值':'Scenario value','情景持仓盈亏':'Scenario P&L',
 'Delta · 等效股数':'Delta · Share equivalent','填写标的价格，并确保成本、乘数和到期数据完整。':'Enter an underlying price; cost, multiplier and expiry data must be complete.',
 'Vega · 波动率 +1%':'Vega · IV +1%','Theta · 下一天':'Theta · Next day','无法建模的资产数':'Assets not modeled',
 '情景压力测试':'Scenario stress test','基于原始成本，不含未来手续费':'From recorded cost, excluding future fees',
 '标的全部资产':'All underlying assets','分析策略':'Select strategy','个账户':'accounts','采用名称匹配分类':'Apply matching classification',
 '策略分类是标签，不保证覆盖成立。担保和交割按账户分别检查，不能跨账户抵扣。':'Classification is a label, not proof of coverage. Collateral and delivery are assessed per account, never offset across accounts.',
 '继续持有':'Continue holding','按快照平仓':'Snapshot liquidation','总手续费':'Total fees','预计现金变化':'Estimated cash change',
 '多头使用 Bid，空头使用 Ask；报价缺失则不估算。仅快照比较，不执行平仓。':'Longs use Bid, shorts use Ask. Missing quotes are not estimated. Snapshot comparison only, no trade execution.',
 '混合币种无法合计，请先选择单一币种。':'Mixed currencies cannot be combined. Select one currency first.',
 '到期交割情景':'Expiry delivery scenario','到期标的价':'Underlying at expiry',
 '多个标的需分别填写价格，请在标的研究中单独分析。':'Multiple underlyings need separate prices. Analyze each in Underlying research.',
 '仅适用于标准实物股票期权，假设价内全额交割。不预测提前行权或临界价行权，不自动改账。':'Standard physically settled equity options only; assumes all ITM contracts deliver. No early or pin exercise prediction, no ledger changes.',
 '展期比较':'Roll comparison','展期合约':'Contract to roll','旧合约平仓单价':'Old contract close price','新到期日':'New expiry',
 '新行权价':'New strike','新权利金单价':'New premium','展期总手续费':'Total roll fees','展期净现金变化':'Roll cash change',
 '旧合约盈亏减总手续费':'Old contract P&L less all fees','新合约交割名义金额':'New delivery notional',
 '同标的、同方向、同张数与乘数的假设展期；新合约需在 IBKR 确认。输入仅用于比较，不修改持仓、现金或盈亏。':'Hypothetical roll with the same underlying, side, size and multiplier. Confirm the new contract in IBKR. Comparison only; no position, cash or P&L changes.',
 '策略资产明细':'Strategy assets','策略分类':'Strategy classification',
 '股票与单腿':'Equity & single legs','收息与保护':'Income & protection','垂直价差':'Vertical spreads','波动率策略':'Volatility',
 '蝶式与秃鹰':'Butterfly & condor','日历与对角':'Calendar & diagonal','比例策略':'Ratio spreads','合成与套利':'Synthetic & arbitrage',
});
Object.assign(english,Object.fromEntries(`
中文	Chinese
最近成交	Last trade
最近成交价	Last trade
买卖中间价	Bid-ask midpoint
收盘价	Close
IBKR 上游连接中断，正在重连	IBKR upstream disconnected; reconnecting
此资产不支持 IBKR 推送	This asset does not support IBKR streaming
此资产需要明确的 IBKR 合约编号	This asset requires an exact IBKR contract ID
IBKR 无法识别此代码	IBKR cannot identify this symbol
合约识别超时	Contract identification timed out
IBKR 行情推送已连接	IBKR stream connected
Gateway 连接失败	Gateway connection failed
无法唯一识别美国上市标的	Cannot uniquely identify the US-listed instrument
未找到匹配的标准100股合约系列	No matching standard 100-share contract class
标的参考价缺失	Underlying reference price missing
超时	Timed out
{0} · 合约验证失败：{1}	{0} · Contract validation failed: {1}
{0} {1} · 邻近合约不足：有效 {2}/20，已限次补选	{0} {1} · Too few nearby contracts: {2}/20 valid after bounded retries
{0}/{1} 张合约缺少完整买卖报价（已尝试冻结报价）；具体合约保存在完整快照中	{0}/{1} contracts lack complete bid/ask (frozen quotes attempted); details are retained in the full snapshot
行情连接未就绪：	Market data connection not ready:
CSP IBKR读取超时	CSP IBKR request timed out
无效端口或 Client ID	Invalid port or Client ID
Gateway 与 IB 服务器断开，请检查 Gateway 登录及网络状态	Gateway disconnected from IB; check login and network
Gateway 尚未返回可访问账户，请完成登录	Gateway has not returned accessible accounts; finish signing in
所选账户不在 Gateway 授权账户列表中	Selected account is not authorized in Gateway
账户资金尚未完成同步，请稍后重试	Account funds have not finished syncing; retry shortly
IBKR 图表目前支持美股、ETF 和常用美股指数	IBKR charts support US stocks, ETFs and common US indices
IBKR 无法唯一识别该合约，请检查代码	IBKR cannot uniquely identify the contract; check the symbol
IBKR 返回了缺少时区的时间	IBKR returned a timestamp without a timezone
IBKR 未返回历史 K 线；请检查合约、历史行情权限或稍后重试	IBKR returned no historical bars; check the contract and historical data permissions or retry later
已允许延迟行情；历史数据权限由 IBKR 决定，实际更新时间以最新 K 线为准。	Delayed data is allowed. IBKR controls historical data access; use the latest bar for freshness.
连接或账户同步超时，请检查 Gateway 的 API 设置和登录状态	Connection or account sync timed out; check Gateway API settings and login
Gateway 与 IB 服务器断开，请检查登录及网络状态	Gateway disconnected from IB; check login and network
请输入有效美股代码和 0–50% 的 OTM 距离	Enter a valid US symbol and an OTM distance of 0–50%
IBKR 无法识别该股票、ETF 或指数	IBKR cannot identify this stock, ETF or index
未找到标准美股期权链；调整合约暂不自动推断	No standard US option chain found; adjusted contracts are not inferred
所选合约系列不属于当前期权链	Selected contract class is not in this chain
IBKR 未提供有效到期日	IBKR supplied no valid expiration
所选到期日不属于当前期权链	Selected expiration is not in this chain
IBKR 报价（可延迟／冻结）	IBKR quote (may be delayed / frozen)
IBKR 日线收盘（{0}）	IBKR daily close ({0})
无法获取标的参考价；请检查 IBKR 行情权限	Cannot get the underlying reference price; check IBKR data permissions
显示数量必须为 10、20 或全部	Row count must be 10, 20 or all
目标行权价附近没有可用合约	No contracts available near the target strike
每批最多读取 20 个合约	Maximum 20 contracts per batch
合约无法识别或不支持自动报价	Contract unidentified or automatic quotes unsupported
IBKR 未返回可用报价	IBKR returned no usable quote
请输入 1–80 个字符	Enter 1–80 characters
IBKR 搜索超时，请检查 Gateway 连接后重试	IBKR search timed out; check Gateway and retry
IBKR 期权读取超时，请检查 Gateway 的服务器连接后重试	IBKR options request timed out; check Gateway server connectivity and retry
`.trim().split('\n').map(line=>line.split('\t'))));
Object.assign(english, {
  '恢复默认布局': 'Restore default layout',
  '将当前布局设为默认': 'Set current layout as default',
  '已设为默认布局': 'Default layout updated',
  '保存当前布局': 'Save current layout',
  '布局名称': 'Layout name',
  '保存布局': 'Save layout',
  '已保存的布局': 'Saved layouts',
  '暂无保存的布局': 'No saved layouts',
  '删除布局': 'Delete layout',
  '确认删除': 'Confirm deletion',
  '布局已保存': 'Layout saved',
  '布局已删除': 'Layout deleted',
  '布局读取失败，请检查浏览器存储': 'Could not load layouts. Check browser storage.',
  '布局保存失败，请检查浏览器存储': 'Could not save layout. Check browser storage.',
});
Object.assign(english, {
 '开仓':'Open position','平仓':'Close position','行权 / 被行权':'Exercise / Assignment','入金':'Deposit','出金':'Withdrawal','股息 / 利息收入':'Dividend / Interest','费用支出':'Expense','剩余现金':'Remaining cash','现金币种':'Cash currency','移除':'Remove','添加币种':'Add currency','总资产':'Total equity','累计盈亏':'Total P&L','全部账户':'All accounts',
 '部分账户尚未设置初始资产或缺少现金数据':'Some accounts lack an opening balance or cash data',
 'IBKR 已实现盈亏需成交历史，当前不估算':'IBKR realized P&L requires trade history; not estimated',
 '记录平仓或行权':'Record Close or Exercise','操作':'Action','行权':'Exercise','被行权':'Assignment','成交单价':'Execution price','交割时股票估值价':'Stock price at delivery','手续费':'Fees','成交时间':'Execution time',
 '确认实物交割：每张股数等于合约乘数，不含现金或其他资产':'Confirm physical delivery: shares per contract equal the multiplier, with no cash or other deliverables',
 '股票数量变化':'Share quantity change','含权利金的调整成本':'Premium-adjusted cost','现金变化':'Cash change','预计已实现盈亏':'Estimated realized P&L',
 '仅记录已发生的成交，不向券商下单。':'Records completed transactions only. No orders are sent.',
 '确认记账':'Record transaction','现金与长期盈亏':'Cash & Lifetime P&L','账本账户':'Ledger account','选择账户':'Select account','请先添加账户':'Add an account first','设置追踪起点':'Set Opening Balance',
 '初始资产 = 剩余现金 + 当前持仓市值':'Opening equity = remaining cash + current position value',
 '确认初始资产':'Confirm opening balance','追踪开始':'Tracking started','初始资产':'Opening equity','净入金':'Net deposits','资金变动':'Cash Transactions','备注':'Notes',
 'IBKR 现金以最近同步为准。入出金需补录；成交历史尚未导入，已实现盈亏不估算。':'IBKR cash comes from the latest sync. Record deposits and withdrawals separately. Trade history is not imported, so realized P&L is not estimated.',
 '成交与资金记录':'Trade & Cash History','时间':'Time','调整成本':'Adjusted cost','确认撤销':'Confirm undo','撤销最近记录':'Undo latest entry',
 '累计盈亏 = 当前现金 + 净持仓市值 − 初始资产 − 净入金。已实现盈亏按录入成本计算，可能包含追踪前的持仓收益；两者口径不同。各币种独立，不作汇率换算。':'P&L since inception = current cash + net position value - opening equity - net deposits. Realized P&L uses recorded costs and may include gains from before tracking began. Currencies are tracked separately without FX conversion.',
 '行权按先进先出抵扣反向股票，权利金并入股票调整成本。此为投资跟踪账本，不是税务报表。':'Exercise offsets opposite stock lots FIFO, carrying premiums into adjusted stock cost. This investment ledger is not a tax statement.',
 '历史持仓（含旧归档）':'Historical positions (including legacy archives)','平仓 / 行权':'Close / Exercise','删除录入记录，不生成平仓盈亏？':'Delete this entry without recording a closing gain or loss?',
 '按原币种汇总，空头市值为负。净成本不含历史已实现盈亏；DTE 按纽约日期计算。历史持仓不是成交记录；已实现盈亏请查看现金与盈亏账本。':'Totals use original currencies; short market values are negative. Net cost excludes past realized P&L. DTE uses New York dates. Historical positions are not executions; see Cash & P&L for realized results.',
 '现金与盈亏':'Cash & P&L','录入方式':'Entry type','期初已有持仓（不扣现金）':'Opening holding (no cash deduction)','新增成交（更新现金）':'New trade (updates cash)',
 '首次同步自动建立 IBKR 账户；只更新该账户的 IBKR 来源仓位。不再持有的同步记录进入历史列表，但不据此估算已实现盈亏，手动仓位和组合不被覆盖。同步为独立合约腿，可在“仓位与策略”中勾选并建立策略分组。':'The first sync creates an IBKR account. Only IBKR positions are updated; missing positions move to history without estimating realized P&L. Manual positions and groups are preserved. Imported legs can be grouped into strategies.',
 '金额超出有效范围':'Amount is outside the supported range','请先为该币种设置现金和初始资产':'Set cash and opening equity for this currency first','初始持仓缺少估值，请先补充价格和乘数':'Opening holdings need valid prices and multipliers',
 '账户已开始追踪，现金变动请记录入出金':'Tracking has started; record deposits or withdrawals to change cash','请填写所有持仓币种的剩余现金':'Enter remaining cash for every holding currency','追踪开始后请通过成交记录改变数量和成本':'Use trade entries to change quantities and costs after tracking starts',
 '请先设置账户剩余现金并开始追踪':'Set account cash and start tracking first','成交时间不能早于追踪起点或最近一笔记录':'Execution time must not precede inception or the latest entry, or be in the future','重复请求无效':'Invalid duplicate request','IBKR 收支以券商记录为准':'IBKR income and expenses must come from broker records',
 '券商持仓请以实际成交同步为准，不能本地平仓或行权':'Broker positions require actual executions; local close or exercise is unavailable','IBKR 账户不接受本地成交记账，请使用独立手动账户':'IBKR accounts do not accept local trade entries; use a separate manual account','持仓已更新，请刷新后重新确认':'The position changed. Refresh and confirm again.',
 '平仓数量、成本或乘数无效':'Invalid closing quantity, cost, or multiplier','该资产暂不支持自动现金记账':'Automatic cash accounting is unavailable for this asset','期权数量必须为整数':'Option quantities must be whole contracts',
 '仅支持已确认交割股数等于合约乘数的实物交割股票期权':'Only confirmed physical equity options with shares per contract equal to the multiplier are supported','被交割股票缺少成本，不能计算盈亏':'Delivered stock lacks a cost basis; P&L cannot be calculated','新增成交请按币种分别录入':'Enter new trades separately for each currency','新增成交需要有效成本、乘数和支持的资产类型':'New trades require a valid cost, multiplier, and supported asset type',
 '只能撤销账户最近一笔记录':'Only the latest account entry can be undone','关联持仓已改变，无法撤销':'Related positions changed; cannot undo','已有成交记录，数量和成本不能直接编辑；请先撤销相关记录':'Trade history exists. Undo related entries before editing quantities or costs.','此仓位有关联成交，请先撤销相关记录再删除':'This position has related trades. Undo them before deleting.',
 '追踪账户的仓位不能直接转移，请分别记录转出和转入':'Tracked positions cannot be moved directly between accounts; record each side separately','新增成交需要时间和请求标识':'New trades require a timestamp and request ID','请填写有效的分币种剩余现金':'Enter valid remaining cash balances by currency','资金记录无效':'Invalid cash entry','请填写有效数量、价格、费用和成交时间':'Enter a valid quantity, price, fee, and execution time','记录无效':'Invalid entry','请输入账户信息及各币种剩余现金':'Enter account details and remaining cash by currency','归档已停用，请填写实际成交进行平仓':'Archiving is disabled. Enter an actual execution to close a position.',
});
Object.assign(english, {
 '佣金（本次总额）':'Commission (total)',
 '填写期初佣金时，请按币种分别录入并填写成本和乘数':'Opening commissions require a single currency, valid costs and multipliers.',
 '历史佣金计入成本，不再扣现金；成本已含佣金时填 0。':'Historical commissions adjust cost without deducting cash again. Enter 0 if already included in cost.',
 '本次佣金从现金扣除并计入已实现盈亏；成交单价不含佣金。':'Commission is deducted from cash and realized P&L. Execution prices exclude commission.',
});
Object.assign(english, {
 '初始现金':'Opening cash', '修改初始现金':'Edit opening cash', '保存更正':'Save correction',
 '当前现金':'Current cash', '更正余额':'Correct balance', '券商同步':'Broker synced',
 '新闻语言':'News language','中英':'ZH + EN','中文新闻':'Chinese','英文新闻':'English','暂无相关新闻':'No related news',
 '美股 股市':'US equities stock market','美联储 经济':'Federal Reserve economy','股票':'Stocks','新闻暂不可用':'News temporarily unavailable',
 '更正当前余额不改变累计盈亏或持仓。实际存款、取款请使用资金变动。':'Balance corrections do not change total P&L or positions. Record actual deposits and withdrawals under cash movements.',
 '填写当前剩余现金，无需追溯开户存款。':'Enter cash available now. Original account deposits are not required.',
 '开始追踪':'Start tracking',
 '当前现金已变更，请刷新后重试':'Current cash changed. Refresh and try again.',
 '请填写有效的当前现金':'Enter a valid current cash balance.',
 '券商现金以同步为准，不能直接更正':'Broker cash is supplied by sync and cannot be corrected locally.',
 '存入现金':'Deposit cash', '取出现金':'Withdraw cash', '账户资金':'Account funds',
 '管理现金与记录':'Manage cash & history','收起资金管理':'Collapse cash management',
 '初始现金已变更，请刷新后重试':'Opening cash changed. Refresh and try again.',
 '请填写有效的初始现金':'Enter a valid opening cash balance.',
 '更正初始现金会调整盈亏基准，不改变券商现金余额。':'Correcting opening cash adjusts the P&L baseline without changing broker cash.',
 '更正初始现金会同步修正当前现金和初始资产，不计为入金或盈利。':'This corrects current cash and opening equity together, not deposits or profit.',
 '虚拟货币的持仓':'Crypto Holdings','虚拟货币导航':'Crypto navigation','只读 · 本地记录':'Read-only · Local records',
 '现货':'Spot','永续合约':'Perpetual','交割合约':'Dated future','现有持仓':'Existing holdings','存款':'Deposit','取款':'Withdrawal','资金费':'Funding','现金更正':'Cash correction','盈亏调整':'P&L adjustment',
 '钱包数据已更新':'Wallet data refreshed','已更新 {0} 个资产，{1} 个保留原估值':'Updated {0} assets; retained previous valuations for {1}',
 '仓位已删除，现金不变':'Position removed; cash unchanged','钱包已从本地移除':'Wallet removed locally','资金与成交记录':'Cash & trade records',
 '钱包估值':'Wallet valuation','账户总资产':'Account equity','资产来源':'Asset source','链上钱包':'On-chain wallets','筛选账户':'Filter accounts','估值币种':'Valuation currency',
 '添加钱包':'Add wallet','添加仓位':'Add position','添加账户':'Add account','读取失败：':'Read failed: ','操作失败：':'Operation failed: ','保存失败：':'Save failed: ','记录已保存在本地':'Record saved locally',
 '搜索资产':'Search assets','隐藏小额资产':'Hide small balances','删除只移除本地仓位与浮动盈亏，不改变现金或生成成交。确认删除？':'Remove this local position and its unrealized P&L? Cash stays unchanged; no trade is created.',
 '读取失败，保留上次数据':'Read failed; previous data retained','尚未读取钱包':'Wallet not yet read','钱包 / 网络':'Wallet / Network','产品':'Product','估值':'Value','风险信息':'Risk',
 '原生资产':'Native asset','旧数据':'Previous data','已计入保证金账户权益':'Included in margin account equity','成本未知':'Cost unknown','清算价':'Liquidation price',
 '暂无符合条件的资产':'No matching assets','暂无钱包':'No wallets','链上余额不包含完整成本或已实现盈亏；未定价资产不按零估值。Hyperliquid 仅读取原生永续，不含 Spot、Vault 或 HIP-3。':'On-chain balances do not include complete cost basis or realized P&L. Unpriced assets are not valued at zero. Hyperliquid covers native perpetuals only, excluding spot, vaults and HIP-3.',
 '手动估值':'Manual valuation','暂无手动仓位':'No manual positions','合约数量按标的币数量录入，仅支持 USDT／USDC 结算的线性合约；币本位反向合约不在此计算。':'Enter contract size in underlying coin units. Only USDT/USDC-settled linear contracts are supported; inverse coin-margined contracts are excluded.',
 '上次读取':'Last read','账户权益':'Account equity','读取':'Read','区块浏览器':'Block explorer','移除钱包':'Remove wallet','只删除本地钱包记录，不影响链上资产。确认移除？':'Remove this local wallet record? On-chain assets are unaffected.',
 '当前可用余额':'Available balance','资金与盈亏':'Cash & P&L','钱包读取为余额快照，不自动生成成交或资金记录。':'Wallet reads are balance snapshots; they do not create trade or cash records.',
 '添加记录':'Add record','记录类型':'Record type','成交价':'Trade price','现金变动':'Cash change','入出金不计入盈亏；手续费和资金费计入已实现盈亏。更正通过追加记录保留审计轨迹。':'Deposits and withdrawals are excluded from P&L. Fees and funding enter realized P&L. Corrections append records to preserve the audit trail.',
 '添加只读钱包':'Add read-only wallet','添加手动账户':'Add manual account','添加虚拟货币仓位':'Add crypto position','记录平仓':'Record closing trade','资金与盈亏记录':'Cash & P&L record',
 '网络':'Network','公开钱包地址':'Public wallet address','钱包名称（可选）':'Wallet name (optional)','钱包名称':'Wallet name','账户名称':'Account name','存储位置':'Location',
 '当前可用 USDT':'Available USDT','当前可用 USDC':'Available USDC','资产代码':'Asset symbol','结算币种':'Settlement currency','记录方式':'Entry type','新成交':'New trade','标的币数量':'Underlying coin quantity','占用保证金':'Allocated margin',
 '平仓数量':'Close quantity','更正后的可用余额':'Corrected available balance','盈亏调整金额':'P&L adjustment amount','记录时间':'Record date',
 '仅提供公开地址；读取时会将地址发送给对应链的公开数据服务。不需要私钥、助记词或签名。':'Use a public address only. Reading sends it to the chain’s public data provider. No private key, seed phrase or signature is needed.',
 '填写当前可用余额，不含已占用保证金；手动账户与链上钱包独立，避免重复录入同一份资产。':'Enter the available balance now, excluding allocated margin. Manual accounts and on-chain wallets are separate; do not record the same assets twice.',
 '现有持仓不扣现金；合约保证金需单独录入，不包含在可用余额内。':'Existing holdings do not deduct cash. Enter derivative collateral separately; it is not included in available cash.',
 '新成交会扣除现货买入金额或合约保证金及手续费，只记录账目，不下单。':'A new trade deducts the spot purchase or derivative collateral plus fees. This records bookkeeping only; no order is placed.',
 '平仓将更新数量、现金和已实现盈亏，支持部分平仓。这里只记账，不执行交易。':'Closing updates size, cash and realized P&L, including partial closes. This records bookkeeping only; no trade is executed.',
 '盈亏调整只更改累计盈亏，不改变现金和持仓；正数增加，负数减少。':'A P&L adjustment changes cumulative P&L only, not cash or holdings. Positive adds; negative subtracts.',
 '现金更正为当前余额，不改变盈亏和持仓。':'Set the available cash balance without changing P&L or holdings.',
 '资金费正数为收入、负数为支出；存款、取款和手续费填写正数。':'Funding: positive is income, negative is a charge. Enter positive amounts for deposits, withdrawals and fees.',
 '保存':'Save',
 '修改估值与备注':'Edit valuation & notes','成交记账（可选）':'Trade bookkeeping (optional)',
 '已定价资产估值':'Priced asset value','{0} 项未定价':'{0} unpriced assets','含上次读取数据':'Includes previous readings',
 '正在读取钱包…':'Reading wallet…',
 '部分资产估值':'Partial asset value','代币索引暂不可用':'Token index unavailable','代币索引暂不可用，目前仅显示原生币与官方 USDC，不代表该地址的完整资产。':'Token index unavailable. Only the native coin and canonical USDC are shown; this is not the address’s complete portfolio.',
 '保证金账户权益':'Margin account equity','可提取余额':'Withdrawable balance','账户权益已包含未实现盈亏':'Equity already includes unrealized P&L',
 '请检查数量、日期和必填项':'Check quantities, dates and required fields','这个地址已在该网络中添加':'This address is already tracked on this network',
 '可用余额不足':'Insufficient available balance','账户已变更，请刷新后重试':'Account changed; refresh and try again','平仓数量超过持仓':'Close quantity exceeds the position',
 '平仓时间不能早于持仓记录':'Close date cannot precede the position','请先记录合约平仓，再移除保证金':'Record the derivative close before removing collateral',
 '仓位不存在':'Position not found','账户不存在':'Account not found','钱包不存在':'Wallet not found','请输入大于零的金额':'Enter a positive amount','现金余额不能为负数':'Cash cannot be negative',
 '记录可能已保存，请刷新后检查':'The record may already be saved; refresh to check','代币索引暂不可用，保留上次完整数据':'Token index unavailable; previous complete data retained','数据服务暂不可用，请稍后重试':'Data service temporarily unavailable; retry later',
});
