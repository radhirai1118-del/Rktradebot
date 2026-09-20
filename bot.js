(() => {
  "use strict";

  // RK Signal Provider — Bookmarklet Edition
  // Educational / paper-analysis only
  // No real-money order execution

  const PAIRS = [
    "EUR/USD","GBP/USD","USD/JPY","USD/CHF",
    "AUD/USD","USD/CAD","NZD/USD",
    "EUR/GBP","EUR/JPY","EUR/CHF","EUR/AUD","EUR/CAD","EUR/NZD",
    "GBP/JPY","GBP/CHF","GBP/AUD","GBP/CAD","GBP/NZD",
    "AUD/JPY","AUD/CAD","AUD/CHF","AUD/NZD",
    "CAD/JPY","CAD/CHF","CHF/JPY",
    "NZD/JPY","NZD/CAD","NZD/CHF"
  ];

  const ID = "rk-signal-bookmarklet";

  document.getElementById(ID)?.remove();

  const panel = document.createElement("div");
  panel.id = ID;

  Object.assign(panel.style, {
    position: "fixed",
    top: "15px",
    right: "15px",
    width: "330px",
    maxWidth: "calc(100vw - 30px)",
    background: "#111827",
    color: "#fff",
    zIndex: "2147483647",
    border: "1px solid #374151",
    borderRadius: "14px",
    padding: "14px",
    fontFamily: "Arial,sans-serif",
    boxShadow: "0 10px 35px rgba(0,0,0,.45)"
  });

  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <b style="font-size:17px">RK Signal Provider</b>
      <button id="rkClose"
        style="background:#374151;color:white;border:0;border-radius:7px;padding:5px 9px">
        ×
      </button>
    </div>

    <div style="margin-top:12px">
      <select id="rkPair"
        style="width:100%;padding:9px;border-radius:8px;background:#1f2937;color:white;border:1px solid #4b5563">
        ${PAIRS.map(p => `<option>${p}</option>`).join("")}
      </select>
    </div>

    <div style="margin-top:9px">
      <select id="rkTF"
        style="width:100%;padding:9px;border-radius:8px;background:#1f2937;color:white;border:1px solid #4b5563">
        <option value="1m">1 Minute</option>
        <option value="5m">5 Minutes</option>
        <option value="15m">15 Minutes</option>
        <option value="1h">1 Hour</option>
      </select>
    </div>

    <button id="rkAnalyze"
      style="width:100%;margin-top:10px;padding:10px;border:0;border-radius:8px;background:#2563eb;color:white;font-weight:bold">
      Analyze
    </button>

    <div id="rkResult"
      style="margin-top:12px;background:#1f2937;border-radius:10px;padding:12px">
      Ready
    </div>

    <div id="rkIndicators"
      style="margin-top:10px;font-size:12px;line-height:1.7">
    </div>

    <div style="margin-top:10px;font-size:11px;color:#9ca3af">
      Educational signal analysis only
    </div>
  `;

  document.body.appendChild(panel);

  const $ = id => panel.querySelector(id);

  $("#rkClose").onclick = () => panel.remove();

  // --------------------------------------------------
  // Indicator functions
  // --------------------------------------------------

  function sma(values, period) {
    if (values.length < period) return null;

    let sum = 0;

    for (let i = values.length - period; i < values.length; i++) {
      sum += values[i];
    }

    return sum / period;
  }

  function ema(values, period) {
    if (values.length < period) return null;

    const k = 2 / (period + 1);

    let e = values
      .slice(0, period)
      .reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < values.length; i++) {
      e = values[i] * k + e * (1 - k);
    }

    return e;
  }

  function rsi(values, period = 14) {
    if (values.length <= period) return null;

    let gains = 0;
    let losses = 0;

    for (let i = values.length - period; i < values.length; i++) {
      const d = values[i] - values[i - 1];

      if (d >= 0) gains += d;
      else losses -= d;
    }

    if (losses === 0) return 100;

    const rs = gains / losses;

    return 100 - 100 / (1 + rs);
  }

  function macd(values) {
    const e12 = ema(values, 12);
    const e26 = ema(values, 26);

    if (e12 == null || e26 == null) return null;

    return e12 - e26;
  }

  function bollinger(values, period = 20) {
    if (values.length < period) return null;

    const recent = values.slice(-period);
    const mean = recent.reduce((a, b) => a + b, 0) / period;

    const variance =
      recent.reduce((s, x) => s + Math.pow(x - mean, 2), 0) /
      period;

    const sd = Math.sqrt(variance);

    return {
      middle: mean,
      upper: mean + 2 * sd,
      lower: mean - 2 * sd
    };
  }

  function stochastic(candles, period = 14) {
    if (candles.length < period) return null;

    const recent = candles.slice(-period);

    const high = Math.max(...recent.map(x => x.high));
    const low = Math.min(...recent.map(x => x.low));
    const close = recent[recent.length - 1].close;

    if (high === low) return 50;

    return ((close - low) / (high - low)) * 100;
  }

  function atr(candles, period = 14) {
    if (candles.length <= period) return null;

    const trs = [];

    for (let i = 1; i < candles.length; i++) {
      const c = candles[i];
      const p = candles[i - 1];

      const tr = Math.max(
        c.high - c.low,
        Math.abs(c.high - p.close),
        Math.abs(c.low - p.close)
      );

      trs.push(tr);
    }

    return sma(trs, period);
  }

  // --------------------------------------------------
  // Signal engine
  // --------------------------------------------------

  function analyze(candles) {

    if (!Array.isArray(candles) || candles.length < 60) {
      return {
        signal: "WAIT",
        confidence: 0,
        reason: "Not enough candle data"
      };
    }

    const closes = candles.map(c => Number(c.close));
    const price = closes.at(-1);

    const r = rsi(closes, 14);
    const e9 = ema(closes, 9);
    const e21 = ema(closes, 21);
    const e50 = ema(closes, 50);
    const s50 = sma(closes, 50);
    const m = macd(closes);
    const bb = bollinger(closes, 20);
    const st = stochastic(candles, 14);
    const a = atr(candles, 14);

    let up = 0;
    let down = 0;

    // RSI
    if (r != null) {
      if (r > 55 && r < 70) up++;
      if (r < 45 && r > 30) down++;
    }

    // EMA 9 / 21
    if (e9 != null && e21 != null) {
      if (e9 > e21) up++;
      if (e9 < e21) down++;
    }

    // EMA 50
    if (e50 != null) {
      if (price > e50) up++;
      if (price < e50) down++;
    }

    // SMA 50
    if (s50 != null) {
      if (price > s50) up++;
      if (price < s50) down++;
    }

    // MACD
    if (m != null) {
      if (m > 0) up++;
      if (m < 0) down++;
    }

    // Bollinger
    if (bb) {
      if (price > bb.middle) up++;
      if (price < bb.middle) down++;
    }

    // Stochastic
    if (st != null) {
      if (st > 50 && st < 80) up++;
      if (st < 50 && st > 20) down++;
    }

    const total = 7;

    const confidence =
      Math.round((Math.max(up, down) / total) * 100);

    let signal = "WAIT";

    if (up >= 5 && up > down) {
      signal = "UP";
    } else if (down >= 5 && down > up) {
      signal = "DOWN";
    }

    return {
      signal,
      confidence,
      price,
      up,
      down,
      rsi: r,
      ema9: e9,
      ema21: e21,
      ema50: e50,
      sma50: s50,
      macd: m,
      bollinger: bb,
      stochastic: st,
      atr: a
    };
  }

  // --------------------------------------------------
  // Market-data adapter
  // --------------------------------------------------

  async function getCandles(pair) {

    /*
      Your permitted market-data source should expose:

      window.RK_MARKET_DATA.getCandles(pair)

      Expected format:

      [
        {
          open: ...,
          high: ...,
          low: ...,
          close: ...,
          time: ...
        }
      ]
    */

    if (
      window.RK_MARKET_DATA &&
      typeof window.RK_MARKET_DATA.getCandles === "function"
    ) {
      return await window.RK_MARKET_DATA.getCandles(pair);
    }

    throw new Error(
      "No permitted market-data adapter found."
    );
  }

  // --------------------------------------------------
  // Analyze button
  // --------------------------------------------------

  $("#rkAnalyze").onclick = async () => {

    const pair = $("#rkPair").value;
    const tf = $("#rkTF").value;

    $("#rkResult").innerHTML = "Analyzing...";

    try {

      const candles = await getCandles(pair, tf);

      const result = analyze(candles);

      $("#rkResult").innerHTML = `
        <div style="font-size:22px;font-weight:bold">
          ${result.signal}
        </div>

        <div style="margin-top:5px">
          Confidence: <b>${result.confidence}%</b>
        </div>

        <div style="margin-top:5px;font-size:12px">
          UP votes: ${result.up}/7 |
          DOWN votes: ${result.down}/7
        </div>

        <div style="margin-top:5px;font-size:12px">
          Price: ${Number(result.price).toFixed(6)}
        </div>
      `;

      $("#rkIndicators").innerHTML = `
        <b>Indicators</b><br>
        RSI(14): ${result.rsi?.toFixed(2) ?? "-"}<br>
        EMA9: ${result.ema9?.toFixed(6) ?? "-"}<br>
        EMA21: ${result.ema21?.toFixed(6) ?? "-"}<br>
        EMA50: ${result.ema50?.toFixed(6) ?? "-"}<br>
        SMA50: ${result.sma50?.toFixed(6) ?? "-"}<br>
        MACD: ${result.macd?.toFixed(6) ?? "-"}<br>
        Stochastic: ${result.stochastic?.toFixed(2) ?? "-"}<br>
        ATR: ${result.atr?.toFixed(6) ?? "-"}
      `;

    } catch (err) {

      $("#rkResult").innerHTML = `
        <div style="color:#fca5a5">
          ${err.message}
        </div>
      `;

      $("#rkIndicators").innerHTML = "";
    }
  };

})();
