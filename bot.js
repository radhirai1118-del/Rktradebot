(() => {
  "use strict";

  // Prevent duplicate installation
  if (window.__RK_INDICATORS__) {
    window.__RK_INDICATORS__.toggle();
    return;
  }

  const RK = {
    prices: [],
    timeframe: "1m",
    panel: null,

    toggle() {
      if (!this.panel) return;
      this.panel.style.display =
        this.panel.style.display === "none" ? "block" : "none";
    },

    ema(data, period) {
      if (data.length < period) return null;

      const multiplier = 2 / (period + 1);
      let ema = data.slice(0, period)
        .reduce((a, b) => a + b, 0) / period;

      for (let i = period; i < data.length; i++) {
        ema = ((data[i] - ema) * multiplier) + ema;
      }

      return ema;
    },

    sma(data, period) {
      if (data.length < period) return null;

      const values = data.slice(-period);
      return values.reduce((a, b) => a + b, 0) / period;
    },

    rsi(data, period = 14) {
      if (data.length < period + 1) return null;

      let gains = 0;
      let losses = 0;

      for (let i = data.length - period; i < data.length; i++) {
        const change = data[i] - data[i - 1];

        if (change > 0) gains += change;
        else losses += Math.abs(change);
      }

      if (losses === 0) return 100;

      const rs = gains / losses;
      return 100 - (100 / (1 + rs));
    },

    macd(data) {
      if (data.length < 26) return null;

      const ema12 = this.ema(data, 12);
      const ema26 = this.ema(data, 26);

      if (ema12 === null || ema26 === null) return null;

      return ema12 - ema26;
    },

    bollinger(data, period = 20, multiplier = 2) {
      if (data.length < period) return null;

      const values = data.slice(-period);
      const mean =
        values.reduce((a, b) => a + b, 0) / period;

      const variance =
        values.reduce((sum, value) =>
          sum + Math.pow(value - mean, 2), 0
        ) / period;

      const sd = Math.sqrt(variance);

      return {
        middle: mean,
        upper: mean + multiplier * sd,
        lower: mean - multiplier * sd
      };
    },

    stochastic(data, period = 14) {
      if (data.length < period) return null;

      const values = data.slice(-period);
      const high = Math.max(...values);
      const low = Math.min(...values);
      const current = values[values.length - 1];

      if (high === low) return 50;

      return ((current - low) / (high - low)) * 100;
    },

    analyze() {
      const p = this.prices;

      if (p.length < 26) {
        return {
          status: "Need more data",
          detail: `Add at least 26 closing prices. Current: ${p.length}`
        };
      }

      const current = p[p.length - 1];

      const rsi = this.rsi(p);
      const ema9 = this.ema(p, 9);
      const ema21 = this.ema(p, 21);
      const sma20 = this.sma(p, 20);
      const macd = this.macd(p);
      const bb = this.bollinger(p);
      const stoch = this.stochastic(p);

      let bullish = 0;
      let bearish = 0;

      if (rsi !== null) {
        if (rsi > 50) bullish++;
        if (rsi < 50) bearish++;
      }

      if (ema9 !== null && ema21 !== null) {
        if (ema9 > ema21) bullish++;
        if (ema9 < ema21) bearish++;
      }

      if (macd !== null) {
        if (macd > 0) bullish++;
        if (macd < 0) bearish++;
      }

      if (stoch !== null) {
        if (stoch > 50) bullish++;
        if (stoch < 50) bearish++;
      }

      if (bb) {
        if (current > bb.middle) bullish++;
        if (current < bb.middle) bearish++;
      }

      let signal = "WAIT";

      if (bullish >= 4 && bullish > bearish) {
        signal = "BULLISH";
      } else if (bearish >= 4 && bearish > bullish) {
        signal = "BEARISH";
      }

      return {
        status: signal,
        current,
        rsi,
        ema9,
        ema21,
        sma20,
        macd,
        bb,
        stoch,
        bullish,
        bearish
      };
    },

    parsePrices() {
      const input = document.getElementById("rk-price-input");

      if (!input) return;

      const prices = input.value
        .split(/[\s,;]+/)
        .map(Number)
        .filter(Number.isFinite);

      this.prices = prices;

      this.renderAnalysis();
    },

    clearPrices() {
      this.prices = [];

      const input = document.getElementById("rk-price-input");

      if (input) input.value = "";

      this.renderAnalysis();
    },

    renderAnalysis() {
      const result = this.analyze();

      const box = document.getElementById("rk-analysis");

      if (!box) return;

      if (result.status === "Need more data") {
        box.innerHTML = `
          <div class="rk-status rk-neutral">
            ${result.detail}
          </div>
        `;
        return;
      }

      const fmt = v =>
        v === null || v === undefined
          ? "—"
          : Number(v).toFixed(4);

      let cls = "rk-neutral";

      if (result.status === "BULLISH") cls = "rk-bull";
      if (result.status === "BEARISH") cls = "rk-bear";

      box.innerHTML = `
        <div class="rk-status ${cls}">
          ${result.status}
        </div>

        <div class="rk-grid">
          <div>Price</div>
          <div>${fmt(result.current)}</div>

          <div>RSI 14</div>
          <div>${fmt(result.rsi)}</div>

          <div>EMA 9</div>
          <div>${fmt(result.ema9)}</div>

          <div>EMA 21</div>
          <div>${fmt(result.ema21)}</div>

          <div>SMA 20</div>
          <div>${fmt(result.sma20)}</div>

          <div>MACD</div>
          <div>${fmt(result.macd)}</div>

          <div>Stochastic</div>
          <div>${fmt(result.stoch)}</div>

          <div>BB Upper</div>
          <div>${result.bb ? fmt(result.bb.upper) : "—"}</div>

          <div>BB Middle</div>
          <div>${result.bb ? fmt(result.bb.middle) : "—"}</div>

          <div>BB Lower</div>
          <div>${result.bb ? fmt(result.bb.lower) : "—"}</div>
        </div>

        <div class="rk-score">
          Bullish factors: ${result.bullish}<br>
          Bearish factors: ${result.bearish}
        </div>

        <div class="rk-warning">
          Analysis only — not a guaranteed outcome or
          prediction of the next trade.
        </div>
      `;
    },

    createUI() {
      const style = document.createElement("style");

      style.textContent = `
        #rk-indicators {
          position: fixed;
          top: 20px;
          right: 20px;
          width: 340px;
          max-height: 90vh;
          overflow: auto;
          z-index: 2147483647;
          background: #101318;
          color: #fff;
          border: 1px solid #343943;
          border-radius: 14px;
          padding: 16px;
          font-family: Arial, sans-serif;
          box-shadow: 0 10px 40px rgba(0,0,0,.45);
        }

        #rk-indicators * {
          box-sizing: border-box;
        }

        .rk-title {
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 4px;
        }

        .rk-subtitle {
          color: #9ca3af;
          font-size: 12px;
          margin-bottom: 14px;
        }

        #rk-price-input {
          width: 100%;
          height: 100px;
          resize: vertical;
          background: #181c23;
          color: white;
          border: 1px solid #363b46;
          border-radius: 8px;
          padding: 10px;
          outline: none;
        }

        .rk-buttons {
          display: flex;
          gap: 8px;
          margin-top: 8px;
        }

        .rk-buttons button {
          flex: 1;
          padding: 9px;
          border: 0;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
        }

        .rk-primary {
          background: #fff;
          color: #111;
        }

        .rk-secondary {
          background: #292e38;
          color: white;
        }

        .rk-status {
          margin-top: 14px;
          padding: 12px;
          border-radius: 8px;
          text-align: center;
          font-size: 18px;
          font-weight: 700;
        }

        .rk-bull {
          background: rgba(34,197,94,.15);
          color: #4ade80;
        }

        .rk-bear {
          background: rgba(239,68,68,.15);
          color: #f87171;
        }

        .rk-neutral {
          background: rgba(156,163,175,.12);
          color: #d1d5db;
        }

        .rk-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1px;
          margin-top: 12px;
          background: #303540;
          border-radius: 8px;
          overflow: hidden;
        }

        .rk-grid div {
          background: #181c23;
          padding: 8px;
          font-size: 12px;
        }

        .rk-grid div:nth-child(even) {
          text-align: right;
        }

        .rk-score {
          margin-top: 12px;
          padding: 10px;
          background: #181c23;
          border-radius: 8px;
          font-size: 12px;
          line-height: 1.7;
        }

        .rk-warning {
          margin-top: 10px;
          color: #fbbf24;
          font-size: 10px;
          line-height: 1.4;
        }
      `;

      document.head.appendChild(style);

      const panel = document.createElement("div");

      panel.id = "rk-indicators";

      panel.innerHTML = `
        <div class="rk-title">RK Indicators</div>
        <div class="rk-subtitle">
          Paper-analysis prototype
        </div>

        <textarea
          id="rk-price-input"
          placeholder="Paste closing prices here, newest last.

Example:
1.0821
1.0824
1.0822
1.0827
..."
        ></textarea>

        <div class="rk-buttons">
          <button class="rk-primary" id="rk-analyze">
            Analyze
          </button>

          <button class="rk-secondary" id="rk-clear">
            Clear
          </button>

          <button class="rk-secondary" id="rk-close">
            Hide
          </button>
        </div>

        <div id="rk-analysis">
          <div class="rk-status rk-neutral">
            Waiting for price data
          </div>
        </div>
      `;

      document.body.appendChild(panel);

      document
        .getElementById("rk-analyze")
        .onclick = () => this.parsePrices();

      document
        .getElementById("rk-clear")
        .onclick = () => this.clearPrices();

      document
        .getElementById("rk-close")
        .onclick = () => this.toggle();

      this.panel = panel;
    },

    init() {
      this.createUI();

      window.__RK_INDICATORS__ = this;

      console.log(
        "RK Indicators initialized in paper-analysis mode."
      );
    }
  };

  RK.init();

})();
