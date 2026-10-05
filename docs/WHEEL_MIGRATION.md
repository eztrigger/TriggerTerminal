# 历史迁移说明

工作台页面、策略分析及订单草稿接口已移除。共享 IBKR 行情实现保留在 bridge/ibkr_market_worker.py 和 server/src/ibkr-options.ts，供期权链、仓位报价、标的搜索与自选行情使用。

third_party/AllYouNeedIsWheel 保留上游源码与 Apache-2.0 许可证，作为仍使用的改编代码的来源记录。既有本地草稿文件未删除。
