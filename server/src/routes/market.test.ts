import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { marketRouter } from "./market.js";

function fakeRes(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

function getHandler(path: string) {
  const layer = (marketRouter as any).stack.find((l: any) => l.route?.path === path);
  if (!layer) throw new Error(`no route registered for ${path}`);
  return layer.route.stack[0].handle as (req: Request, res: Response, next: () => void) => unknown;
}

describe("screener sorting", () => {
  it("sorts the full result before the limit and keeps missing values last", async () => {
    const tradingview = await import("../providers/tradingview.js");
    const rows = Array.from({ length: 501 }, (_, i) => ({ symbol: `SORT${i}`, name: `Stock ${i}`, sector: "sort-test", price: i, changePercent: i - 250, volume: i, marketCap: 1000 - i }));
    const scan = vi.spyOn(tradingview, "marketScan").mockResolvedValue([...rows, { ...rows[0], symbol: "MISSING", changePercent: null }] as Awaited<ReturnType<typeof tradingview.marketScan>>);
    try {
      for (const dir of ["asc", "desc"]) {
        const res = fakeRes();
        await getHandler("/screener")({ query: { sort: "changePercent", dir, sector: "sort-test" } } as unknown as Request, res, () => {});
        const result = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(result).toHaveLength(500);
        expect(result[0].symbol).toBe(dir === "asc" ? "SORT0" : "SORT500");
        expect(result.some((row: { symbol: string }) => row.symbol === "MISSING")).toBe(false);
      }
    } finally { scan.mockRestore(); }
  });
});

describe("history freshness and resolution", () => {
  it("does not serve cached history after expiry when providers fail", async () => {
    const yahoo = await import("../providers/yahoo.js");
    const nasdaq = await import("../providers/nasdaq.js");
    const y = vi.spyOn(yahoo, "history").mockResolvedValue([{ time: 100, open: 1, high: 2, low: 1, close: 2, volume: 3 }]);
    const n = vi.spyOn(nasdaq, "history").mockRejectedValue(new Error("offline"));
    const req = { params: { symbol: "TESTFRESH" }, query: { range: "6M", meta: "1" } } as unknown as Request;
    const res = fakeRes();
    (res as any).set = vi.fn().mockReturnThis();
    const handler = getHandler("/history/:symbol");
    try {
      await handler(req, res, () => {});
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ source: "Yahoo", interval: "1d" }));
      y.mockRejectedValue(new Error("offline"));
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now + 21_000);
      const failed = fakeRes();
      await handler(req, failed, () => {});
      expect(failed.status).toHaveBeenCalledWith(502);
    } finally { vi.restoreAllMocks(); }
  });

  it("never substitutes daily bars for an unavailable intraday source", async () => {
    const yahoo = await import("../providers/yahoo.js");
    const nasdaq = await import("../providers/nasdaq.js");
    vi.spyOn(yahoo, "history").mockResolvedValue([]);
    const n = vi.spyOn(nasdaq, "history");
    try {
      const res = fakeRes();
      await getHandler("/history/:symbol")({ params: { symbol: "TESTINTRA" }, query: { range: "1D" } } as unknown as Request, res, () => {});
      expect(res.status).toHaveBeenCalledWith(502);
      expect(n).not.toHaveBeenCalled();
    } finally { vi.restoreAllMocks(); }
  });
});
