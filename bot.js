(() => {
  "use strict";

  /* =========================================================
     RK SIGNAL PROVIDER
     Bookmarklet-compatible
     Analysis only — no real-money order execution
     ========================================================= */

  const CONFIG = {
    candlesRequired: 200,
    rsiPeriod: 14,
    emaFast: 9,
    emaSlow: 21,
    smaPeriod: 50,
    bbPeriod: 20,
    bbDeviation: 2,
    stochasticPeriod: 14,
    atrPeriod: 14,
    minimumConfidence: 70,
    refreshMs: 5000
  };

  const PAIRS = [
    "EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF",
    "AUD/USD", "USD/CAD", "NZD/USD",
    "EUR/GBP", "EUR/JPY", "EUR/CHF",
    "EUR/AUD", "EUR/CAD", "EUR/NZD",
    "GBP/JPY", "GBP/CHF", "GBP/AUD",
    "GBP/CAD", "GBP/NZD",
    "AUD/JPY", "AUD/CHF", "AUD/CAD", "AUD/NZD",
    "NZD/JPY", "NZD/CHF", "NZD/CAD",
    "CAD/JPY", "CAD/CHF", "CHF/JPY"
  ];

  let selectedPair = "EUR/USD";
  let interval = null;

  /* ---------- math ---------- */

  function sma(values, period) {
    if (values.length < period) return null;

    const x = values.slice(-period);

    return x.reduce((a, b) => a + b, 0) / period;
  }

  function ema(values, period) {
    if (values.length < period) return null;

    const multiplier = 2 / (period + 1);

    let result =
      values.slice(0, period)
        .reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < values.length; i++) {
      result =
        ((values[i] - result) * multiplier) + result;
    }

    return result;
  }

  function rsi(values, period = 14) {
    if (values.length <= period) return null;

    let gains = 0;
    let losses = 0;

    for (let i = values.length - period; i < values.length; i++) {
      const change = values[i] - values[i - 1];

      if (change >= 0) gains += change;
      else losses += Math.abs(change);
    }

    if (losses === 0) return 100;

    const rs = gains / losses;

    return 100 - (100 / (1 + rs));
  }

  function bollinger(values, period = 20, deviation = 2) {
    if (values.length < period) return null;

    const x = values.slice(-period);

    const middle =
      x.reduce((a, b) => a + b, 0) / period;

    const variance =
      x.reduce(
        (sum, value) => sum + Math.pow(value - middle, 2),
        0
      ) / period;

    const sd = Math.sqrt(variance);

    return {
      middle,
      upper: middle + sd * deviation,
      lower: middle - sd * deviation
    };
  }

  function stochastic(candles, period = 14) {
    if (candles.length < period) return null;

    const x = candles.slice(-period);

    const highest = Math.max(...x.map(c => c.high));
    const lowest = Math.min(...x.map(c => c.low));
    const close = x[x.length - 1].close;

    if (highest === lowest) return 50;

    return ((close - lowest) / (highest - lowest)) * 100;
  }

  function atr(candles, period = 14) {
    if (candles.length <= period) return null;

    const ranges = [];

    for (
      let i = candles.length - period;
      i < candles.length;
      i++
    ) {
      const current = candles[i];
      const previous = candles[i - 1] || current;

      ranges.push(
        Math.max(
          current.high - current.low,
          Math.abs(current.high - previous.close),
          Math.abs(current.low - previous.close)
        )
      );
    }

    return ranges.reduce((a, b) => a + b, 0) / ranges.length;
  }

  /* ---------- analysis ---------- */

  function analyze(candles) {
    if (!Array.isArray(candles) ||
        candles.length < CONFIG.candlesRequired) {
      return {
        signal: "WAIT",
        confidence: 0,
        reason: "Not enough candle data"
      };
    }

    const closes = candles.map(c => Number(c.close));

    const price = closes.at(-1);

    const rsiValue =
      rsi(closes, CONFIG.rsiPeriod);

    const ema9 =
      ema(closes, CONFIG.emaFast);

    const ema21 =
      ema(closes, CONFIG.emaSlow);

    const ema50 =
      ema(closes, 50);

    const sma50 =
      sma(closes, CONFIG.smaPeriod);

    const macdFast =
      ema(closes, 12);

    const macdSlow =
      ema(closes, 26);

    const macd =
      macdFast !== null && macdSlow !== null
        ? macdFast - macdSlow
        : null;

    const bb =
      bollinger(
        closes,
        CONFIG.bbPeriod,
        CONFIG.bbDeviation
      );

    const stoch =
      stochastic(
        candles,
        CONFIG.stochasticPeriod
      );

    const atrValue =
      atr(candles, CONFIG.atrPeriod);

    let up = 0;
    let down = 0;

    const reasons = [];

    /* EMA trend */

    if (ema9 > ema21) {
      up++;
      reasons.push("EMA bullish");
    } else {
      down++;
      reasons.push("EMA bearish");
    }

    /* MACD */

    if (macd !== null) {
      if (macd > 0) {
        up++;
        reasons.push("MACD positive");
      } else {
        down++;
        reasons.push("MACD negative");
      }
    }

    /* SMA trend */

    if (sma50 !== null) {
      if (price > sma50) {
        up++;
        reasons.push("Price above SMA50");
      } else {
        down++;
        reasons.push("Price below SMA50");
      }
    }

    /* RSI */

    if (rsiValue !== null) {
      if (rsiValue < 30) {
        up++;
        reasons.push("RSI oversold");
      } else if (rsiValue > 70) {
        down++;
        reasons.push("RSI overbought");
      }
    }

    /* Stochastic */

    if (stoch !== null) {
      if (stoch < 20) {
        up++;
        reasons.push("Stochastic oversold");
      } else if (stoch > 80) {
        down++;
        reasons.push("Stochastic overbought");
      }
    }

    /* Bollinger */

    if (bb) {
      if (price <= bb.lower) {
        up++;
        reasons.push("Lower Bollinger area");
      } else if (price >= bb.upper) {
        down++;
        reasons.push("Upper Bollinger area");
      }
    }

    /* Short momentum */

    if (closes.length >= 4) {
      const oldPrice = closes.at(-4);

      if (price > oldPrice) {
        up++;
        reasons.push("Positive momentum");
      } else {
        down++;
        reasons.push("Negative momentum");
      }
    }

    const total = 7;

    const strongest = Math.max(up, down);

    const confidence =
      Math.round((strongest / total) * 100);

    let signal = "WAIT";

    if (up > down) signal = "UP";
    if (down > up) signal = "DOWN";

    return {
      pair: selectedPair,
      signal,
      confidence,
      price,
      up,
      down,
      rsi: rsiValue,
      ema9,
      ema21,
      ema50,
      sma50,
      macd,
      bollinger: bb,
      stochastic: stoch,
      atr: atrValue,
      reasons
    };
  }

  /* ---------- data adapter ---------- */

  async function getCandles() {
    /*
      Your permitted market-data adapter should provide:

      window.RK_MARKET_DATA.getCandles(pair)

      returning:

      [
        {
          time: 1234567890,
          open: 1.1000,
          high: 1.1010,
          low: 1.0990,
          close: 1.1005
        }
      ]
    */

    if (
      window.RK_MARKET_DATA &&
      typeof window.RK_MARKET_DATA.getCandles === "function"
    ) {
      return await window.RK_MARKET_DATA.getCandles(
        selectedPair
      );
    }

    return [];
  }

  /* ---------- UI ---------- */

  function createUI() {
    if (document.getElementById("rk-signal-panel")) return;

    const panel = document.createElement("div");

    panel.id = "rk-signal-panel";

    panel.style.cssText = `
      position:fixed;
      top:15px;
      right:15px;
      width:330px;
      max-width:calc(100vw - 30px);
      z-index:2147483647;
      background:#101827;
      color:white;
      padding:16px;
      border-radius:14px;
      font-family:Arial,sans-serif;
      box-shadow:0 10px 35px rgba(0,0,0,.45);
    `;

    panel.innerHTML = `
      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        margin-bottom:12px;
      ">
        <b style="font-size:18px;">RK Signal Bot</b>
        <button id="rk-close"
          style="
            background:#303b50;
            color:white;
            border:0;
            border-radius:6px;
            padding:5px 9px;
          ">
          ×
        </button>
      </div>

      <select id="rk-pair"
        style="
          width:100%;
          padding:9px;
          margin-bottom:12px;
          background:#1c2638;
          color:white;
          border:1px solid #35425a;
          border-radius:7px;
        ">
        ${PAIRS.map(
          p => `<option>${p}</option>`
        ).join("")}
      </select>

      <div id="rk-signal"
        style="
          text-align:center;
          font-size:28px;
          font-weight:bold;
          padding:14px;
          background:#182235;
          border-radius:9px;
        ">
        WAIT
      </div>

      <div style="
        margin-top:12px;
        line-height:1.8;
        font-size:13px;
      ">
        <div>Confidence: <b id="rk-confidence">0%</b></div>
        <div>Price: <b id="rk-price">--</b></div>
        <div>RSI: <b id="rk-rsi">--</b></div>
        <div>EMA 9/21: <b id="rk-ema">--</b></div>
        <div>MACD: <b id="rk-macd">--</b></div>
        <div>Stochastic: <b id="rk-stoch">--</b></div>
        <div>ATR: <b id="rk-atr">--</b></div>
      </div>

      <div id="rk-reasons"
        style="
          margin-top:10px;
          color:#aeb9cc;
          font-size:12px;
          line-height:1.5;
        ">
        Waiting for market data...
      </div>

      <div style="
        margin-top:12px;
        font-size:11px;
        color:#7f8ba0;
        text-align:center;
      ">
        Analysis only — no order execution
      </div>
    `;

    document.body.appendChild(panel);

    document
      .getElementById("rk-close")
      .onclick = () => {
        stop();
        panel.remove();
      };

    document
      .getElementById("rk-pair")
      .onchange = e => {
        selectedPair = e.target.value;
        update();
      };
  }

  function updateUI(result) {
    const signal =
      document.getElementById("rk-signal");

    if (!signal) return;

    signal.textContent =
      result.signal;

    document.getElementById(
      "rk-confidence"
    ).textContent =
      `${result.confidence}%`;

    document.getElementById(
      "rk-price"
    ).textContent =
      result.price
        ? Number(result.price).toFixed(6)
        : "--";

    document.getElementById(
      "rk-rsi"
    ).textContent =
      result.rsi == null
        ? "--"
        : result.rsi.toFixed(2);

    document.getElementById(
      "rk-ema"
    ).textContent =
      result.ema9 && result.ema21
        ? `${result.ema9.toFixed(6)} / ${result.ema21.toFixed(6)}`
        : "--";

    document.getElementById(
      "rk-macd"
    ).textContent =
      result.macd == null
        ? "--"
        : result.macd.toFixed(6);

    document.getElementById(
      "rk-stoch"
    ).textContent =
      result.stochastic == null
        ? "--"
        : result.stochastic.toFixed(2);

    document.getElementById(
      "rk-atr"
    ).textContent =
      result.atr == null
        ? "--"
        : result.atr.toFixed(6);

    document.getElementById(
      "rk-reasons"
    ).textContent =
      result.reasons
        ? result.reasons.join(" • ")
        : result.reason || "";
  }

  async function update() {
    try {
      const candles = await getCandles();

      const result =
        analyze(candles);

      updateUI(result);

    } catch (error) {
      updateUI({
        signal: "ERROR",
        confidence: 0,
        reason: error.message
      });
    }
  }

  function start() {
    createUI();

    update();

    interval =
      setInterval(
        update,
        CONFIG.refreshMs
      );
  }

  function stop() {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  }

  start();

})();
