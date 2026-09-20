(() => {

  "use strict";


  /* =========================================================
     RK TRADE BOT
     PAPER TRADING / EDUCATIONAL VERSION
     ========================================================= */


  const CONFIG = {

    startingBalance: 10000,

    candleCount: 250,

    updateInterval: 5000,

    payout: 0.80,

    storageKey: "RK_TRADE_BOT_STATE"

  };


  let running = false;

  let timer = null;

  let balance = CONFIG.startingBalance;

  let trades = [];

  let wins = 0;

  let losses = 0;

  let candles = [];


  /* =========================================================
     HELPERS
     ========================================================= */

  const $ = id =>
    document.getElementById(id);


  function random(min, max) {

    return Math.random() * (max - min) + min;

  }


  function formatPrice(value) {

    return Number(value).toFixed(5);

  }


  function formatMoney(value) {

    return "$" + Number(value).toFixed(2);

  }


  /* =========================================================
     SIMULATED MARKET
     ========================================================= */

  const basePrices = {

    "EUR/USD": 1.10000,
    "GBP/USD": 1.30000,
    "USD/JPY": 148.000,
    "USD/CHF": 0.85000,
    "AUD/USD": 0.66000,
    "USD/CAD": 1.36000,
    "NZD/USD": 0.61000,

    "EUR/GBP": 0.85000,
    "EUR/JPY": 163.000,
    "EUR/CHF": 0.94000,
    "EUR/AUD": 1.66000,
    "EUR/CAD": 1.50000,
    "EUR/NZD": 1.80000,

    "GBP/JPY": 193.000,
    "GBP/CHF": 1.10000,
    "GBP/AUD": 1.97000,
    "GBP/CAD": 1.77000,
    "GBP/NZD": 2.13000,

    "AUD/JPY": 98.000,
    "AUD/CHF": 0.56000,
    "AUD/CAD": 0.90000,
    "AUD/NZD": 1.08000,

    "NZD/JPY": 90.000,
    "NZD/CHF": 0.52000,
    "NZD/CAD": 0.83000,

    "CAD/JPY": 109.000,
    "CAD/CHF": 0.62500,
    "CHF/JPY": 175.000

  };


  function generateCandles(pair) {

    let price =
      basePrices[pair] || 1.10000;

    const result = [];

    for (let i = 0; i < CONFIG.candleCount; i++) {

      const open = price;

      const volatility =
        price * random(0.0001, 0.001);

      const movement =
        random(-volatility, volatility);

      const close =
        open + movement;

      const high =
        Math.max(open, close) +
        random(0, volatility * 0.5);

      const low =
        Math.min(open, close) -
        random(0, volatility * 0.5);

      result.push({

        time:
          Date.now() -
          (CONFIG.candleCount - i) * 60000,

        open,
        high,
        low,
        close

      });

      price = close;

    }

    return result;

  }


  /* =========================================================
     SMA
     ========================================================= */

  function SMA(values, period) {

    if (values.length < period)
      return null;

    const slice =
      values.slice(-period);

    return (
      slice.reduce(
        (sum, value) => sum + value,
        0
      ) / period
    );

  }


  /* =========================================================
     EMA
     ========================================================= */

  function EMA(values, period) {

    if (values.length < period)
      return null;

    const multiplier =
      2 / (period + 1);

    let result =
      values
        .slice(0, period)
        .reduce(
          (a, b) => a + b,
          0
        ) / period;

    for (
      let i = period;
      i < values.length;
      i++
    ) {

      result =
        (
          (values[i] - result) *
          multiplier
        ) + result;

    }

    return result;

  }


  /* =========================================================
     RSI
     ========================================================= */

  function RSI(values, period = 14) {

    if (values.length <= period)
      return null;

    let gains = 0;

    let lossesValue = 0;

    for (
      let i = values.length - period;
      i < values.length;
      i++
    ) {

      const change =
        values[i] - values[i - 1];

      if (change > 0)
        gains += change;

      else
        lossesValue += Math.abs(change);

    }

    if (lossesValue === 0)
      return 100;

    const rs =
      gains / lossesValue;

    return (
      100 -
      (100 / (1 + rs))
    );

  }


  /* =========================================================
     MACD
     ========================================================= */

  function MACD(values) {

    const ema12 =
      EMA(values, 12);

    const ema26 =
      EMA(values, 26);

    if (
      ema12 === null ||
      ema26 === null
    )
      return null;

    return ema12 - ema26;

  }


  /* =========================================================
     BOLLINGER BANDS
     ========================================================= */

  function Bollinger(values, period = 20) {

    if (values.length < period)
      return null;

    const slice =
      values.slice(-period);

    const middle =
      slice.reduce(
        (a, b) => a + b,
        0
      ) / period;

    const variance =
      slice.reduce(
        (sum, value) =>
          sum +
          Math.pow(
            value - middle,
            2
          ),
        0
      ) / period;

    const deviation =
      Math.sqrt(variance);

    return {

      middle,

      upper:
        middle +
        deviation * 2,

      lower:
        middle -
        deviation * 2

    };

  }


  /* =========================================================
     STOCHASTIC
     ========================================================= */

  function Stochastic(
    candleData,
    period = 14
  ) {

    if (
      candleData.length <
      period
    )
      return null;

    const slice =
      candleData.slice(-period);

    const highest =
      Math.max(
        ...slice.map(
          c => c.high
        )
      );

    const lowest =
      Math.min(
        ...slice.map(
          c => c.low
        )
      );

    const current =
      slice[
        slice.length - 1
      ].close;

    if (highest === lowest)
      return 50;

    return (
      (
        (current - lowest) /
        (highest - lowest)
      ) * 100
    );

  }


  /* =========================================================
     ATR
     ========================================================= */

  function ATR(
    candleData,
    period = 14
  ) {

    if (
      candleData.length <= period
    )
      return null;

    const ranges = [];

    for (
      let i =
        candleData.length - period;
      i < candleData.length;
      i++
    ) {

      const current =
        candleData[i];

      const previous =
        candleData[i - 1] ||
        current;

      const trueRange =
        Math.max(

          current.high -
          current.low,

          Math.abs(
            current.high -
            previous.close
          ),

          Math.abs(
            current.low -
            previous.close
          )

        );

      ranges.push(
        trueRange
      );

    }

    return (
      ranges.reduce(
        (a, b) => a + b,
        0
      ) / ranges.length
    );

  }


  /* =========================================================
     ANALYSIS ENGINE
     ========================================================= */

  function analyze() {

    const closes =
      candles.map(
        c => c.close
      );

    const current =
      closes[closes.length - 1];


    const rsi =
      RSI(closes, 14);

    const ema9 =
      EMA(closes, 9);

    const ema21 =
      EMA(closes, 21);

    const macd =
      MACD(closes);

    const bb =
      Bollinger(closes, 20);

    const stochastic =
      Stochastic(
        candles,
        14
      );

    const sma50 =
      SMA(closes, 50);

    const atr =
      ATR(candles, 14);


    let bullish = 0;

    let bearish = 0;


    /* EMA */

    if (
      ema9 !== null &&
      ema21 !== null
    ) {

      if (ema9 > ema21)
        bullish++;

      else
        bearish++;

    }


    /* MACD */

    if (macd !== null) {

      if (macd > 0)
        bullish++;

      else
        bearish++;

    }


    /* SMA */

    if (sma50 !== null) {

      if (current > sma50)
        bullish++;

      else
        bearish++;

    }


    /* RSI */

    if (rsi !== null) {

      if (rsi < 30)
        bullish++;

      else if (rsi > 70)
        bearish++;

    }


    /* STOCHASTIC */

    if (stochastic !== null) {

      if (stochastic < 20)
        bullish++;

      else if (stochastic > 80)
        bearish++;

    }


    /* BOLLINGER */

    if (bb) {

      if (current <= bb.lower)
        bullish++;

      else if (current >= bb.upper)
        bearish++;

    }


    /* MOMENTUM */

    if (closes.length >= 4) {

      const previous =
        closes[
          closes.length - 4
        ];

      if (current > previous)
        bullish++;

      else
        bearish++;

    }


    const totalSignals = 7;

    const strongest =
      Math.max(
        bullish,
        bearish
      );

    const confidence =
      Math.round(
        (
          strongest /
          totalSignals
        ) * 100
      );


    let signal = "WAIT";


    if (
      bullish > bearish
    )
      signal = "UP";


    if (
      bearish > bullish
    )
      signal = "DOWN";


    return {

      signal,

      confidence,

      bullish,

      bearish,

      current,

      rsi,

      ema9,

      ema21,

      macd,

      bb,

      stochastic,

      sma50,

      atr

    };

  }


  /* =========================================================
     UPDATE UI
     ========================================================= */

  function updateUI(result) {

    const pair =
      $("pair").value;


    $("selectedPair")
      .textContent = pair;


    $("price")
      .textContent =
      formatPrice(
        result.current
      );


    $("lastUpdate")
      .textContent =
      new Date()
        .toLocaleTimeString();


    $("signal")
      .textContent =
      result.signal;


    $("confidenceValue")
      .textContent =
      result.confidence +
      "%";


    $("rsi")
      .textContent =
      result.rsi === null
        ? "--"
        : result.rsi.toFixed(2);


    $("ema9")
      .textContent =
      result.ema9 === null
        ? "--"
        : formatPrice(
            result.ema9
          );


    $("ema21")
      .textContent =
      result.ema21 === null
        ? "--"
        : formatPrice(
            result.ema21
          );


    $("macd")
      .textContent =
      result.macd === null
        ? "--"
        : result.macd.toFixed(6);


    $("stochastic")
      .textContent =
      result.stochastic === null
        ? "--"
        : result.stochastic.toFixed(2);


    $("sma50")
      .textContent =
      result.sma50 === null
        ? "--"
        : formatPrice(
            result.sma50
          );


    $("atr")
      .textContent =
      result.atr === null
        ? "--"
        : result.atr.toFixed(6);


    $("bollinger")
      .textContent =
      result.bb
        ? formatPrice(
            result.bb.middle
          )
        : "--";


    $("signalMessage")
      .textContent =
      `${result.signal} — ${result.confidence}% indicator agreement | Bullish: ${result.bullish}/7 | Bearish: ${result.bearish}/7`;

  }


  /* =========================================================
     PAPER TRADE
     ========================================================= */

  function executePaperTrade(
    result
  ) {

    const minimumConfidence =
      Number(
        $("confidence").value
      ) || 70;


    if (
      result.signal === "WAIT"
    )
      return;


    if (
      result.confidence <
      minimumConfidence
    )
      return;


    const riskPercent =
      Number(
        $("risk").value
      ) || 2;


    const amount =
      balance *
      (riskPercent / 100);


    if (amount <= 0)
      return;


    /*
      Educational simulation only.
      The result is randomly generated.
    */

    const won =
      Math.random() >= 0.5;


    const profit =
      won
        ? amount * CONFIG.payout
        : -amount;


    balance += profit;


    if (won)
      wins++;

    else
      losses++;


    const trade = {

      time:
        new Date()
          .toLocaleTimeString(),

      pair:
        $("pair").value,

      timeframe:
        $("timeframe").value,

      signal:
        result.signal,

      confidence:
        result.confidence,

      amount,

      result:
        won
          ? "WIN"
          : "LOSS",

      profit

    };


    trades.unshift(
      trade
    );


    if (
      trades.length > 100
    )
      trades.pop();


    updateAccountUI();

    renderTrades();

    saveState();

  }


  /* =========================================================
     ACCOUNT UI
     ========================================================= */

  function updateAccountUI() {

    $("balance")
      .textContent =
      formatMoney(balance);


    $("tradeCount")
      .textContent =
      trades.length;


    $("wins")
      .textContent =
      wins;


    $("losses")
      .textContent =
      losses;

  }


  /* =========================================================
     JOURNAL
     ========================================================= */

  function renderTrades() {

    const table =
      $("tradeTable");


    table.innerHTML = "";


    trades.forEach(
      trade => {

        const row =
          document.createElement(
            "tr"
          );


        row.innerHTML = `

          <td>
            ${trade.time}
          </td>

          <td>
            ${trade.pair}
          </td>

          <td>
            ${trade.timeframe}m
          </td>

          <td>
            ${trade.signal}
          </td>

          <td>
            ${trade.confidence}%
          </td>

          <td>
            ${formatMoney(
              trade.amount
            )}
          </td>

          <td>
            ${trade.result}
          </td>

          <td>
            ${
              trade.profit >= 0
                ? "+"
                : ""
            }${formatMoney(
              trade.profit
            )}
          </td>

        `;


        table.appendChild(
          row
        );

      }
    );

  }


  /* =========================================================
     BOT LOOP
     ========================================================= */

  function runCycle() {

    if (!running)
      return;


    const pair =
      $("pair").value;


    candles =
      generateCandles(
        pair
      );


    const result =
      analyze();


    updateUI(
      result
    );


    executePaperTrade(
      result
    );

  }


  /* =========================================================
     START
     ========================================================= */

  function startBot() {

    if (running)
      return;


    running = true;


    $("statusText")
      .textContent =
      "RUNNING";


    $("statusDot")
      .style.background =
      "#168c59";


    runCycle();


    timer =
      setInterval(
        runCycle,
        CONFIG.updateInterval
      );

  }


  /* =========================================================
     STOP
     ========================================================= */

  function stopBot() {

    running = false;


    if (timer) {

      clearInterval(
        timer
      );

      timer = null;

    }


    $("statusText")
      .textContent =
      "STOPPED";


    $("statusDot")
      .style.background =
      "#777";

  }


  /* =========================================================
     STORAGE
     ========================================================= */

  function saveState() {

    localStorage.setItem(

      CONFIG.storageKey,

      JSON.stringify({

        balance,

        trades,

        wins,

        losses

      })

    );

  }


  function loadState() {

    try {

      const saved =
        JSON.parse(
          localStorage.getItem(
            CONFIG.storageKey
          )
        );


      if (!saved)
        return;


      balance =
        Number(
          saved.balance
        ) ||
        CONFIG.startingBalance;


      trades =
        Array.isArray(
          saved.trades
        )
          ? saved.trades
          : [];


      wins =
        Number(
          saved.wins
        ) || 0;


      losses =
        Number(
          saved.losses
        ) || 0;


      updateAccountUI();

      renderTrades();


    } catch (error) {

      console.error(
        "State loading error:",
        error
      );

    }

  }


  /* =========================================================
     CLEAR
     ========================================================= */

  function clearHistory() {

    trades = [];

    wins = 0;

    losses = 0;

    balance =
      CONFIG.startingBalance;


    localStorage.removeItem(
      CONFIG.storageKey
    );


    updateAccountUI();

    renderTrades();

  }


  /* =========================================================
     EVENTS
     ========================================================= */

  $("startBtn")
    .addEventListener(
      "click",
      startBot
    );


  $("stopBtn")
    .addEventListener(
      "click",
      stopBot
    );


  $("clearBtn")
    .addEventListener(
      "click",
      clearHistory
    );


  $("pair")
    .addEventListener(
      "change",
      () => {

        if (!running) {

          const pair =
            $("pair").value;

          candles =
            generateCandles(
              pair
            );

          const result =
            analyze();

          updateUI(
            result
          );

        }

      }
    );


  /* =========================================================
     INITIALIZATION
     ========================================================= */

  loadState();


  candles =
    generateCandles(
      $("pair").value
    );


  const initialAnalysis =
    analyze();


  updateUI(
    initialAnalysis
  );


})();
