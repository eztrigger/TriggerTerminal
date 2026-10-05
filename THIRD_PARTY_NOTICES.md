# 第三方代码声明 / Third-party notices

## AllYouNeedIsWheel

- Upstream: https://github.com/xiao81/AllYouNeedIsWheel
- Source revision: `fc176a266b8c8bb242fa2d3a03a6619eb1338a85`
- Copyright 2025 Xiao Xiao
- License: [Apache License 2.0](licenses/Apache-2.0.txt)
- Adapted source: `core/connection.py`
- Retained implementation: [bridge/ibkr_market_worker.py](bridge/ibkr_market_worker.py)

期权链读取实现改编自上述项目。当前版本使用有超时限制的异步请求、独立的只读 IBKR 连接，以及延迟或冻结行情；不会生成虚构报价，也不包含券商下单方法。自选行情通过 `bridge/watchlist_worker.py` 使用共享读取器。

The option-chain integration was adapted from the project above. Changes include bounded asynchronous requests, an isolated read-only IBKR connection, and delayed or frozen market data. The implementation does not fabricate quotes or expose broker order methods. The watchlist uses the shared reader through `bridge/watchlist_worker.py`.

原上游应用目录已移除。主程序不需要它的 Flask 服务、网页、数据库或订单执行模块。这里保留适用于改编代码的版权和许可声明；项目其余部分的许可见 [LICENSE](LICENSE)。

The original upstream application directory has been removed. Its Flask service, frontend, database, and order-execution modules are not runtime dependencies. These notices and the accompanying license apply to the adapted code; see [LICENSE](LICENSE) for the main project license.
