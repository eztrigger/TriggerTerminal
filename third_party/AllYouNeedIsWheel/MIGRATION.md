# Integration in triggerterminal
Upstream: https://github.com/xiao81/AllYouNeedIsWheel
Pinned commit: fc176a266b8c8bb242fa2d3a03a6619eb1338a85
License: Apache-2.0 (see LICENSE). Original source retained here for attribution and review.

Adapted from core/connection.py (option-chain discovery) and api/services/options_service.py
(_process_options_chain: premium and collateral calculations).
Runtime adaptations: bridge/wheel_worker.py and web/lib/wheel.ts.
Original Flask application is not started. Its order-execution and database migrations are not imported.
Changes: bounded asynchronous IB requests, isolated read-only client, no fabricated prices,
actual contract multipliers, account-scoped collateral and share coverage, local draft orders only.
UI rewritten in Chinese for the existing React application.
