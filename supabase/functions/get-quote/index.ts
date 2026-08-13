// Supabase Edge Function: get-quote
//
// Fetches a current price for a JSE ticker via Yahoo Finance's unofficial
// chart endpoint. This is the ONE place price-fetch logic lives — see
// portfolio-tracker-architecture.md §3: "isolate the price-fetch call behind
// a single module/interface ... so swapping to Twelve Data or another paid
// vendor later is a contained change, not a rearchitecture."
//
// CRITICAL: Yahoo returns price in ZAc (cents). We divide by 100 here, once,
// and nowhere else. Do not re-divide downstream.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

interface YahooChartResponse {
  chart: {
    result: Array<{
      meta: {
        regularMarketPrice: number; // ZAc
        previousClose: number; // ZAc
        exchangeName: string;
      };
    }> | null;
    error: unknown;
  };
}

async function fetchQuoteZac(baseTicker: string): Promise<{ priceZac: number; exchange: string }> {
  const jseTicker = `${baseTicker}.JO`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${jseTicker}`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" }, // Yahoo's unofficial endpoint expects a browser-like UA
  });

  if (!res.ok) {
    throw new Error(`Yahoo quote fetch failed for ${jseTicker}: ${res.status}`);
  }

  const data = (await res.json()) as YahooChartResponse;
  const result = data.chart.result?.[0];
  if (!result) {
    throw new Error(`No quote data returned for ${jseTicker}`);
  }

  return {
    priceZac: result.meta.regularMarketPrice,
    exchange: result.meta.exchangeName,
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const { ticker } = await req.json();
    if (!ticker || typeof ticker !== "string") {
      return new Response(JSON.stringify({ error: "ticker is required" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const { priceZac, exchange } = await fetchQuoteZac(ticker.toUpperCase());

    // The one, explicit ZAc -> ZAR conversion for the whole system.
    const priceZar = priceZac / 100;

    const body = {
      ticker: ticker.toUpperCase(),
      price_zar: priceZar,
      exchange,
      fetched_at: new Date().toISOString(),
    };

    return new Response(JSON.stringify(body), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 502,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
