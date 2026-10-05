# Holdings Ledger / 持仓账本

## Operation Rules / 操作对照

| Operation / 操作 | Cash / 现金 | Total P&L / 累计盈亏 | Positions / 持仓 |
| --- | --- | --- | --- |
| Close / 平仓 | Actual proceeds minus fees / 实际结算扣佣金 | Realized plus remaining unrealized / 已实现加剩余浮盈亏 | Reduce quantity / 减少数量 |
| Correct trade / 更正成交 | Settlement difference / 结算差额 | Recalculate / 重算 | Quantity corrections update remainder; blocked after later activity / 数量更正调整余量，有后续变动则阻止 |
| Edit profit / 修改盈利 | Unchanged / 不变 | Update recorded profit / 更新记录金额 | Unchanged / 不变 |
| Delete close record / 删除平仓记录 | Retained and visible in cash history / 保留并在资金明细可查 | Exclude that record / 剔除该记录 | Never restored / 不回补 |
| Delete initial position / 删除期初仓位 | Unchanged / 不变 | Exclude its unrealized P&L / 剔除浮盈亏 | Removed; transaction-linked positions require undo / 移除，有成交关联需先撤销 |
| Undo / 撤销 | Reverse settlement / 反向结算 | Remove event contribution / 移除该成交贡献 | Restore quantities, retain current quotes / 恢复数量，保留最新行情 |
| Deposit or withdrawal / 入出金 | Update balance / 更新余额 | Unchanged / 不变 | Unchanged / 不变 |

Deleted close records remain in cash history with an excluded-P&L label, not in
the Closed trades list. Exercise matches compatible stock legs even within the
same multi-leg position. Opening commissions are charged once as recorded expense;
initial-position commissions are embedded in cost, not charged to cash again.

All actions are local bookkeeping, never broker orders. Cash, opening equity,
external flows and realized P&L are stored separately by account and currency.
所有操作均为本地记账，不向券商下单。现金、初始资产、净入金和已实现盈亏按账户及币种分别记录。

- Opening equity = entered remaining cash + signed market value of opening holdings.
  初始资产为剩余现金加期初持仓净市值；存量账户必须主动确认现金，缺失数据不填零。
- `INITIAL` imports existing holdings without deducting cash and adds their market
  value to opening equity. It is unavailable after the first ledger event.
  期初录入不扣现金，市值加入基准；第一笔资金或成交记录后停止期初补录。
- `TRADE` records signed quantity at entered cost, deducts fees, and updates cash.
  新增成交按录入成本及数量改变现金，手续费计入已实现盈亏。
- Closing records actual price, quantity, fees and timestamp. Partial close marks
  do not replace remaining holdings' quotes. Zero price can record a worthless expiry.
  平仓支持部分数量和零价到期，成交价格不覆盖剩余持仓估值。
- Total P&L = recorded realized P&L + current unrealized P&L, based on recorded
  costs. Cash, opening equity and deposits do not affect this metric. Missing
  costs/prices remain unknown, not zero. Broker history may be incomplete.
  累计盈亏为已记录的已实现盈亏加当前持仓未实现盈亏，按录入成本计算，不受现金基准影响。

## Exercise / 行权

Only confirmed physical equity/ETF options with shares per contract equal to the
premium multiplier are supported. Adjusted deliverables, index cash settlement and
futures options are not inferred. Standard index symbols are rejected explicitly.
仅处理经确认的股票实物交割，股数必须等于合约乘数；不推断非标准交割、指数现金结算或期货期权。

For signed exercised option quantity `q`, multiplier `m`, premium cost `p`, strike
`K`, and `d = +1` for Calls / `-1` for Puts:

- Delivered shares: `q * m * d`.
- Cash: `-deliveredShares * K - fees`.
- Adjusted stock cost/proceeds: `K + d * p`.

Opposite stock lots in the same manual account and currency are matched FIFO by
insertion order. Remaining shares become a separate long/short stock lot. Premium
is transferred to adjusted cost, not realized a second time. Previous realized P&L
remains in history. Matching and cash updates run in one SQLite transaction.
同账户同币种的反向股票按录入顺序先进先出抵扣，余额生成多头或空头股票。权利金转入调整成本，
不重复计收益，先前已实现盈亏保留。股票变更和现金变更在同一数据库事务中完成。

This is investment tracking, not jurisdiction-specific tax accounting.
这是投资追踪口径，不是税务核算。

## Corrections / 更正

The Positions view includes a cross-account Closed trades list, with account,
asset, dates, quantities, cost, execution price, fees, realized P&L and notes.
Trade corrections use a revision check and atomically adjust cash by the settlement
difference and recalculate realized profit. Quantity changes update the remaining
position and undo snapshot, but are rejected after subsequent position activity.
Dates cannot reorder account transactions or precede tracking inception. Changing
price, quantity or fees replaces manual profit overrides; note-only edits retain them.
Legacy display-only corrections remain unposted until explicitly saved again.
平仓成交更正按差额同步现金和已实现盈亏；数量更正同步剩余持仓，有后续变动则拒绝。
修改价格、数量或佣金会覆盖该笔手动盈利更正，单独修改备注则保留。

Deleting from Closed trades hides the entry and removes its current reported realized
profit or loss. It retains settled cash and never reopens a position. The settlement
and local audit record remain in the database; a deleted close cannot be undone or
have profit reassigned through the ledger. Add a new manual position if needed.
删除平仓记录会从列表移除并剔除该笔当前记录的已实现盈亏，不改变结算现金、不恢复持仓。
底层结算和本地更正记录保留，已删除记录不可再撤销或修改盈利，需要时新增手动仓位。

Profit corrections and deletion update total P&L through recorded realized P&L.
Deleting an untransacted position removes its unrealized contribution, without
inventing a closing trade. External flows and initial cash do not change total P&L.
盈利记录更正及删除同步累计盈亏；删除无关联成交的仓位移除其浮动盈亏，不虚构平仓。
入出金和初始现金不参与累计盈亏计算。

Untransacted manual records can be deleted without creating P&L events; their
opening-equity contribution is removed. Positions linked to trade history must
first have related events undone, latest first, to prevent orphaned cash entries.
Undo reverses cash, restores affected quantities/costs and removes derived lots.
未发生交易的录入可直接删除，不生成平仓记录。有成交关联时须由近及远撤销，恢复现金与持仓，
再删除录入，避免孤立现金记录。历史旧归档不被自动视为已平仓成交。

Execution timestamps must be chronological within each account and no earlier
than tracking inception. Request UUIDs prevent duplicate submissions; economic
position state checks reject stale quantity/cost changes while tolerating quote updates.
每个账户按时间顺序记账，不能早于追踪起点。请求标识防止重复记账；数量及成本变更会触发过期校验，
单纯行情更新不会阻止记账。

## IBKR

An IBKR account can also contain independent MANUAL positions. Broker sync only
updates IBKR-source positions. Local opening/closing/exercise entries affect a
separate per-currency manual cash adjustment; displayed combined cash equals
the latest broker CashBalance plus that adjustment. Broker snapshots are never
rewritten by manual entries. Do not manually duplicate a trade or position already
included in broker snapshots; these independent local adjustments are not automatically
reconciled with broker executions.
IBKR 账户允许独立手动仓位，同步不覆盖。手动成交产生分币种现金调整，合计现金为券商快照
加手动调整，不改写券商快照。请勿重复录入快照已有仓位或成交；手动调整不会自动与券商成交对账。

Current cash comes from per-currency `CashBalance` snapshot fields, excluding BASE
to avoid double counting. Missing cash remains unknown. Users establish opening
equity and record actual external flows. Broker position disappearance never
generates an inferred close. Local close/exercise is disabled for IBKR records.
IBKR 现金采用分币种 CashBalance，不重复加总 BASE。缺失现金保持未知，用户确认初始资产并补录
实际入出金。持仓消失不推断成交价，不能对券商同步仓位执行本地平仓或行权。

Full broker trade/commission history (including coverage reconciliation) is not
imported in this version. IBKR realized P&L is therefore displayed as unavailable,
not zero. Displayed total P&L covers recorded realized P&L and available unrealized
P&L; it does not fill in missing broker executions.
当前未导入完整券商成交及佣金历史，因此 IBKR 已实现盈亏显示不可用而不是零。显示的累计盈亏
仅覆盖已记录的已实现盈亏及可计算的未实现盈亏，不会补算缺失的券商成交。
