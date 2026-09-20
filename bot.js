/*
=========================================================
 RK FX EDUCATIONAL ANALYZER
 Live 1-Minute FX Data
 Data provider: Twelve Data
=========================================================

 IMPORTANT:
 Replace ONLY the API key below.

 Do NOT publish a real API key in a public GitHub repository.
 A public GitHub Pages site exposes client-side JavaScript
 and therefore exposes any key placed in this file.

 Analysis:
 1. RSI 14
 2. EMA 9 / 21
 3. MACD 12 / 26 / 9
 4. Bollinger Bands 20 / 2
 5. Stochastic 14 / 3 / 3
 6. SMA 50
 7. ATR 14

 Timeframe:
 1 minute

 Output:
 - Market state
 - Trend
 - Momentum
 - Volatility
 - Indicator agreement
 - Current price
 - Indicator values
 - Candle timestamp

 No trade execution.
=========================================================
*/

(() => {
  "use strict";

  /* =====================================================
     1. API KEY
     ===================================================== */

  const TWELVE_DATA_API_KEY = "5929c79abd494e69ba9db26fa76d615a";

  /* =====================================================
     2. SETTINGS
     ===================================================== */

  const INTERVAL = "1min";
  const CANDLE_COUNT = 150;
  const REFRESH_MS = 60 * 1000;

  let selectedPair = "EUR/USD";
  let refreshTimer = null;
  let loading = false;

  /* =====================================================
     3. FX PAIRS
     ===================================================== */

  const PAIRS = [
    "EUR/USD",
    "GBP/USD",
    "USD/JPY",
    "USD/CHF",
    "AUD/USD",
    "USD/CAD",
    "NZD/USD",

    "EUR/GBP",
    "EUR/JPY",
    "EUR/CHF",
    "EUR/AUD",
    "EUR/CAD",
    "EUR/NZD",

    "GBP/JPY",
    "GBP/CHF",
    "GBP/AUD",
    "GBP/CAD",
    "GBP/NZD",

    "AUD/JPY",
    "AUD/CHF",
    "AUD/CAD",
    "AUD/NZD",

    "CAD/JPY",
    "CAD/CHF",

    "NZD/JPY",
    "NZD/CHF",

    "CHF/JPY"
  ];

  /* =====================================================
     4. REMOVE PREVIOUS UI
     ===================================================== */

  const old = document.getElementById("rk-fx-analyzer");

  if (old) {
    old.remove();
  }

  if (window.RK_FX_ANALYZER_TIMER) {
    clearInterval(window.RK_FX_ANALYZER_TIMER);
  }

  /* =====================================================
     5. STYLES
     ===================================================== */

  const style = document.createElement("style");

  style.textContent = `
    #rk-fx-analyzer {
      position: fixed;
      top: 15px;
      right: 15px;
      width: 390px;
      max-width: calc(100vw - 30px);
      max-height: calc(100vh - 30px);
      overflow-y: auto;
      z-index: 2147483647;

      background: #101318;
      color: #f4f4f4;

      font-family:
        Arial,
        Helvetica,
        sans-serif;

      border: 1px solid #303640;
      border-radius: 14px;

      box-shadow:
        0 15px 50px rgba(0,0,0,.55);

      padding: 14px;

      box-sizing: border-box;
    }

    #rk-fx-analyzer * {
      box-sizing: border-box;
    }

    .rk-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .rk-title {
      font-size: 17px;
      font-weight: 800;
    }

    .rk-subtitle {
      color: #9ca3af;
      font-size: 11px;
      margin-top: 3px;
    }

    .rk-close {
      border: 0;
      background: #272c34;
      color: white;
      width: 30px;
      height: 30px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 16px;
    }

    .rk-row {
      display: flex;
      gap: 8px;
      margin-bottom: 10px;
    }

    .rk-select,
    .rk-button {
      border: 1px solid #353b46;
      background: #181c22;
      color: white;
      border-radius: 8px;
      padding: 9px;
      font-size: 12px;
    }

    .rk-select {
      flex: 1;
      min-width: 0;
    }

    .rk-button {
      cursor: pointer;
    }

    .rk-button:hover {
      background: #242a32;
    }

    .rk-main {
      background: #181c22;
      border: 1px solid #303640;
      border-radius: 12px;
      padding: 14px;
      margin-bottom: 10px;
    }

    .rk-state {
      text-align: center;
      font-size: 25px;
      font-weight: 900;
      margin: 5px 0;
    }

    .rk-neutral {
      color: #d1d5db;
    }

    .rk-bull {
      color: #54d68c;
    }

    .rk-bear {
      color: #ff7373;
    }

    .rk-price {
      text-align: center;
      font-size: 20px;
      font-weight: 800;
      margin-top: 5px;
    }

    .rk-time {
      text-align: center;
      color: #8f98a6;
      font-size: 10px;
      margin-top: 5px;
    }

    .rk-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 7px;
      margin-bottom: 10px;
    }

    .rk-card {
      background: #181c22;
      border: 1px solid #303640;
      border-radius: 9px;
      padding: 9px;
    }

    .rk-label {
      color: #929aa8;
      font-size: 10px;
      margin-bottom: 4px;
    }

    .rk-value {
      font-size: 13px;
      font-weight: 700;
    }

    .rk-indicators {
      background: #181c22;
      border: 1px solid #303640;
      border-radius: 10px;
      padding: 10px;
      margin-bottom: 10px;
    }

    .rk-indicator {
      display: flex;
      justify-content: space-between;
      padding: 7px 0;
      border-bottom: 1px solid #292e36;
      font-size: 11px;
    }

    .rk-indicator:last-child {
      border-bottom: 0;
    }

    .rk-status {
      background: #15191f;
      border-radius: 8px;
      padding: 9px;
      color: #aab2bf;
      font-size: 10px;
      line-height: 1.5;
      margin-top: 8px;
    }

    .rk-footer {
      color: #69717d;
      font-size: 9px;
      text-align: center;
      margin-top: 10px;
    }

    @media(max-width:600px) {
      #rk-fx-analyzer {
        top: 8px;
        right: 8px;
        width: calc(100vw - 16px);
        max-height: calc(100vh - 16px);
      }
    }
  `;

  document.head.appendChild(style);

  /* =====================================================
     6. CREATE UI
     ===================================================== */

  const panel = document.createElement("div");

  panel.id = "rk-fx-analyzer";

  panel.innerHTML = `
    <div class="rk-head">
      <div>
        <div class="rk-title">RK FX Analyzer</div>
        <div class="rk-subtitle">
          Live educational 1-minute market analysis
        </div>
      </div>

      <button class="rk-close" id="rk-close">
        ×
      </button>
    </div>

    <div class="rk-row">

      <select id="rk-pair" class="rk-select">
        ${PAIRS.map(pair =>
          `<option value="${pair}">
            ${pair}
          </option>`
        ).join("")}
      </select>

      <button id="rk-refresh" class="rk-button">
        Refresh
      </button>

    </div>

    <div class="rk-main">

      <div class="rk-label" style="text-align:center">
        MARKET STATE
      </div>

      <div id="rk-state" class="rk-state rk-neutral">
        Loading...
      </div>

      <div id="rk-price" class="rk-price">
        --
      </div>

      <div id="rk-time" class="rk-time">
        --
      </div>

    </div>

    <div class="rk-grid">

      <div class="rk-card">
        <div class="rk-label">Trend</div>
        <div id="rk-trend" class="rk-value">
          --
        </div>
      </div>

      <div class="rk-card">
        <div class="rk-label">Momentum</div>
        <div id="rk-momentum" class="rk-value">
          --
        </div>
      </div>

      <div class="rk-card">
        <div class="rk-label">Volatility</div>
        <div id="rk-volatility" class="rk-value">
          --
        </div>
      </div>

      <div class="rk-card">
        <div class="rk-label">Agreement</div>
        <div id="rk-agreement" class="rk-value">
          --
        </div>
      </div>

    </div>

    <div class="rk-indicators">

      <div class="rk-label">
        INDICATOR ANALYSIS
      </div>

      <div class="rk-indicator">
        <span>RSI 14</span>
        <strong id="rk-rsi">--</strong>
      </div>

      <div class="rk-indicator">
        <span>EMA 9 / 21</span>
        <strong id="rk-ema">--</strong>
      </div>

      <div class="rk-indicator">
        <span>MACD 12/26/9</span>
        <strong id="rk-macd">--</strong>
      </div>

      <div class="rk-indicator">
        <span>Bollinger 20/2</span>
        <strong id="rk-bb">--</strong>
      </div>

      <div class="rk-indicator">
        <span>Stochastic 14</span>
        <strong id="rk-stoch">--</strong>
      </div>

      <div class="rk-indicator">
        <span>SMA 50</span>
        <strong id="rk-sma">--</strong>
      </div>

      <div class="rk-indicator">
        <span>ATR 14</span>
        <strong id="rk-atr">--</strong>
      </div>

    </div>

    <div id="rk-status" class="rk-status">
      Connecting to market-data API...
    </div>

    <div class="rk-footer">
      Educational market analysis • 1-minute candles
    </div>
  `;

  document.body.appendChild(panel);

  /* =====================================================
     7. ELEMENTS
     ===================================================== */

  const $ = id => document.getElementById(id);

  $("rk-pair").value = selectedPair;

  $("rk-close").onclick = () => {
    if (refreshTimer) {
      clearInterval(refreshTimer);
    }

    panel.remove();
    style.remove();
  };

  $("rk-pair").onchange = () => {
    selectedPair = $("rk-pair").value;
    analyze();
  };

  $("rk-refresh").onclick = () => {
    analyze();
  };

  /* =====================================================
     8. API REQUEST
     ===================================================== */

  async function fetchCandles(pair) {

    if (
      !TWELVE_DATA_API_KEY ||
      TWELVE_DATA_API_KEY === "PASTE_YOUR_API_KEY_HERE"
    ) {
      throw new Error(
        "Add your Twelve Data API key at the top of bot.js."
      );
    }

    const url =
      "https://api.twelvedata.com/time_series" +
      "?symbol=" + encodeURIComponent(pair) +
      "&interval=1min" +
      "&outputsize=" + CANDLE_COUNT +
      "&timezone=UTC" +
      "&order=asc" +
      "&apikey=" + encodeURIComponent(TWELVE_DATA_API_KEY);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        "HTTP error " + response.status
      );
    }

    const data = await response.json();

    if (data.status !== "ok") {
      throw new Error(
        data.message ||
        "Twelve Data returned an error."
      );
    }

    if (!Array.isArray(data.values)) {
      throw new Error(
        "No candle data returned."
      );
    }

    return data.values
      .map(c => ({
        time: c.datetime,
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close)
      }))
      .filter(c =>
        Number.isFinite(c.open) &&
        Number.isFinite(c.high) &&
        Number.isFinite(c.low) &&
        Number.isFinite(c.close)
      );
  }

  /* =====================================================
     9. BASIC MATH
     ===================================================== */

  function sma(values, period) {

    if (values.length < period) {
      return null;
    }

    const slice =
      values.slice(values.length - period);

    return (
      slice.reduce((a, b) => a + b, 0) /
      period
    );
  }

  function emaSeries(values, period) {

    if (values.length < period) {
      return [];
    }

    const result = [];

    const multiplier =
      2 / (period + 1);

    let ema =
      values
        .slice(0, period)
        .reduce((a, b) => a + b, 0) /
      period;

    result.push(ema);

    for (
      let i = period;
      i < values.length;
      i++
    ) {

      ema =
        (values[i] - ema) *
        multiplier +
        ema;

      result.push(ema);
    }

    return result;
  }

  function ema(values, period) {

    const series =
      emaSeries(values, period);

    return series.length
      ? series[series.length - 1]
      : null;
  }

  /* =====================================================
     10. RSI
     ===================================================== */

  function rsi(values, period = 14) {

    if (values.length <= period) {
      return null;
    }

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {

      const change =
        values[i] - values[i - 1];

      if (change >= 0) {
        gains += change;
      } else {
        losses -= change;
      }
    }

    let avgGain =
      gains / period;

    let avgLoss =
      losses / period;

    for (
      let i = period + 1;
      i < values.length;
      i++
    ) {

      const change =
        values[i] - values[i - 1];

      const gain =
        Math.max(change, 0);

      const loss =
        Math.max(-change, 0);

      avgGain =
        ((avgGain * (period - 1)) + gain) /
        period;

      avgLoss =
        ((avgLoss * (period - 1)) + loss) /
        period;
    }

    if (avgLoss === 0) {
      return 100;
    }

    const rs =
      avgGain / avgLoss;

    return 100 - (100 / (1 + rs));
  }

  /* =====================================================
     11. MACD
     ===================================================== */

  function macd(values) {

    const fast = emaSeries(values, 12);
    const slow = emaSeries(values, 26);

    if (!fast.length || !slow.length) {
      return null;
    }

    /*
      Align EMA 12 with EMA 26.
    */

    const offset =
      fast.length - slow.length;

    const macdLine = [];

    for (
      let i = 0;
      i < slow.length;
      i++
    ) {

      macdLine.push(
        fast[i + offset] - slow[i]
      );
    }

    const signalSeries =
      emaSeries(macdLine, 9);

    if (!signalSeries.length) {
      return null;
    }

    const macdValue =
      macdLine[macdLine.length - 1];

    const signal =
      signalSeries[signalSeries.length - 1];

    return {
      macd: macdValue,
      signal: signal,
      histogram: macdValue - signal
    };
  }

  /* =====================================================
     12. BOLLINGER BANDS
     ===================================================== */

  function bollinger(values, period = 20, multiplier = 2) {

    if (values.length < period) {
      return null;
    }

    const slice =
      values.slice(values.length - period);

    const middle =
      slice.reduce((a, b) => a + b, 0) /
      period;

    const variance =
      slice.reduce(
        (sum, value) =>
          sum + Math.pow(value - middle, 2),
        0
      ) / period;

    const deviation =
      Math.sqrt(variance);

    return {
      upper:
        middle + multiplier * deviation,

      middle,

      lower:
        middle - multiplier * deviation
    };
  }

  /* =====================================================
     13. STOCHASTIC
     ===================================================== */

  function stochastic(
    candles,
    period = 14
  ) {

    if (candles.length < period) {
      return null;
    }

    const recent =
      candles.slice(candles.length - period);

    const highest =
      Math.max(
        ...recent.map(c => c.high)
      );

    const lowest =
      Math.min(
        ...recent.map(c => c.low)
      );

    const close =
      candles[candles.length - 1].close;

    if (highest === lowest) {
      return 50;
    }

    return (
      ((close - lowest) /
        (highest - lowest)) *
      100
    );
  }

  /* =====================================================
     14. ATR
     ===================================================== */

  function atr(candles, period = 14) {

    if (candles.length <= period) {
      return null;
    }

    const trs = [];

    for (
      let i = 1;
      i < candles.length;
      i++
    ) {

      const current =
        candles[i];

      const previous =
        candles[i - 1];

      const tr =
        Math.max(
          current.high - current.low,

          Math.abs(
            current.high -
            previous.close
          ),

          Math.abs(
            current.low -
            previous.close
          )
        );

      trs.push(tr);
    }

    return sma(trs, period);
  }

  /* =====================================================
     15. ANALYSIS
     ===================================================== */

  function analyzeIndicators(candles) {

    const closes =
      candles.map(c => c.close);

    const current =
      closes[closes.length - 1];

    const rsiValue =
      rsi(closes, 14);

    const ema9 =
      ema(closes, 9);

    const ema21 =
      ema(closes, 21);

    const ema50 =
      ema(closes, 50);

    const sma50 =
      sma(closes, 50);

    const macdValue =
      macd(closes);

    const bb =
      bollinger(closes, 20, 2);

    const stoch =
      stochastic(candles, 14);

    const atrValue =
      atr(candles, 14);

    /*
      Educational directional votes.
      These describe indicator alignment;
      they are NOT probabilities or guaranteed
      future outcomes.
    */

    let bullish = 0;
    let bearish = 0;
    let neutral = 0;

    /* RSI */

    if (rsiValue !== null) {

      if (rsiValue > 55) {
        bullish++;
      }
      else if (rsiValue < 45) {
        bearish++;
      }
      else {
        neutral++;
      }
    }

    /* EMA 9/21 */

    if (ema9 !== null && ema21 !== null) {

      if (ema9 > ema21) {
        bullish++;
      }
      else if (ema9 < ema21) {
        bearish++;
      }
      else {
        neutral++;
      }
    }

    /* MACD */

    if (macdValue) {

      if (
        macdValue.macd >
        macdValue.signal
      ) {
        bullish++;
      }
      else if (
        macdValue.macd <
        macdValue.signal
      ) {
        bearish++;
      }
      else {
        neutral++;
      }
    }

    /* Bollinger */

    if (bb) {

      if (current > bb.middle) {
        bullish++;
      }
      else if (current < bb.middle) {
        bearish++;
      }
      else {
        neutral++;
      }
    }

    /* Stochastic */

    if (stoch !== null) {

      if (stoch > 55 && stoch < 80) {
        bullish++;
      }
      else if (stoch < 45 && stoch > 20) {
        bearish++;
      }
      else {
        neutral++;
      }
    }

    /* SMA 50 */

    if (sma50 !== null) {

      if (current > sma50) {
        bullish++;
      }
      else if (current < sma50) {
        bearish++;
      }
      else {
        neutral++;
      }
    }

    /* EMA 50 trend confirmation */

    if (ema50 !== null) {

      if (current > ema50) {
        bullish++;
      }
      else if (current < ema50) {
        bearish++;
      }
      else {
        neutral++;
      }
    }

    const total =
      bullish +
      bearish +
      neutral;

    let state = "NEUTRAL";

    if (
      bullish > bearish &&
      bullish >= 4
    ) {
      state = "BULLISH";
    }
    else if (
      bearish > bullish &&
      bearish >= 4
    ) {
      state = "BEARISH";
    }

    let trend = "Neutral";

    if (ema9 > ema21 && current > sma50) {
      trend = "Bullish trend";
    }
    else if (
      ema9 < ema21 &&
      current < sma50
    ) {
      trend = "Bearish trend";
    }

    let momentum = "Neutral";

    if (rsiValue >= 55) {
      momentum = "Positive";
    }
    else if (rsiValue <= 45) {
      momentum = "Negative";
    }

    let volatility = "Normal";

    if (atrValue !== null) {

      const atrPercent =
        (atrValue / current) * 100;

      if (atrPercent > 0.08) {
        volatility = "High";
      }
      else if (atrPercent < 0.02) {
        volatility = "Low";
      }
    }

    return {
      current,
      rsi: rsiValue,
      ema9,
      ema21,
      ema50,
      sma50,
      macd: macdValue,
      bb,
      stoch,
      atr: atrValue,

      bullish,
      bearish,
      neutral,

      total,

      state,
      trend,
      momentum,
      volatility
    };
  }

  /* ============================
