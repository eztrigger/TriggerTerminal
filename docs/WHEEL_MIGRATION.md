# 历史迁移说明 / Migration notes

工作台页面、策略分析及订单草稿接口已移除。仍在使用的 IBKR 行情实现位于 `bridge/ibkr_market_worker.py`，供期权链、仓位报价、标的搜索和自选行情使用。它依赖 `bridge/ibkr.py` 与 `ib_async`，不导入原上游应用。

The former wheel workspace, strategy-analysis pages, and draft-order endpoints have been removed. The retained IBKR market implementation in `bridge/ibkr_market_worker.py` supports option chains, position quotes, symbol search, and watchlist quotes. It depends on `bridge/ibkr.py` and `ib_async`, with no imports from the upstream application.

原上游应用文件夹已删除，无需复制其他运行模块。改编代码的版权、来源和 Apache-2.0 许可证保留在 [第三方声明](../THIRD_PARTY_NOTICES.md) 与 [许可证](../licenses/Apache-2.0.txt) 中。

The upstream application directory has been deleted; no additional runtime modules needed to be copied. Copyright, provenance, and the Apache-2.0 license for adapted code remain in [Third-party notices](../THIRD_PARTY_NOTICES.md) and the [license file](../licenses/Apache-2.0.txt).
