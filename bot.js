(() => {
"use strict";

const ID="RK_MARKET_ANALYZER";
document.getElementById(ID)?.remove();

const pairs=[
"EUR/USD","GBP/USD","USD/JPY","USD/CHF","AUD/USD","USD/CAD","NZD/USD",
"EUR/GBP","EUR/JPY","EUR/CHF","EUR/AUD","EUR/CAD","EUR/NZD",
"GBP/JPY","GBP/CHF","GBP/AUD","GBP/CAD","GBP/NZD",
"AUD/JPY","AUD/CAD","AUD/CHF","AUD/NZD",
"CAD/JPY","CAD/CHF","CHF/JPY","NZD/JPY","NZD/CAD","NZD/CHF"
];

const box=document.createElement("div");
box.id=ID;

Object.assign(box.style,{
position:"fixed",
top:"15px",
right:"15px",
width:"350px",
maxWidth:"calc(100vw - 30px)",
maxHeight:"90vh",
overflow:"auto",
zIndex:2147483647,
background:"#111827",
color:"#fff",
padding:"14px",
borderRadius:"14px",
fontFamily:"Arial,sans-serif",
boxShadow:"0 10px 35px rgba(0,0,0,.5)"
});

box.innerHTML=`
<div style="display:flex;justify-content:space-between;align-items:center">
<b style="font-size:18px">RK Market Analyzer</b>
<button id="rkX" style="background:#374151;color:#fff;border:0;border-radius:7px;padding:5px 10px">×</button>
</div>

<select id="rkPair"
style="width:100%;margin-top:12px;padding:10px;border-radius:8px;background:#1f2937;color:#fff">
${pairs.map(x=>`<option>${x}</option>`).join("")}
</select>

<div style="margin-top:8px;padding:9px;background:#1f2937;border-radius:8px">
Timeframe: <b>1 Minute</b>
</div>

<button id="rkGo"
style="width:100%;margin-top:10px;padding:11px;border:0;border-radius:8px;background:#2563eb;color:#fff;font-weight:bold">
ANALYZE
</button>

<div id="rkOut" style="margin-top:12px"></div>

<div style="font-size:10px;color:#9ca3af;margin-top:10px">
Educational market analysis • Not a trade instruction
</div>
`;

document.body.appendChild(box);

const $=x=>box.querySelector(x);

$("#rkX").onclick=()=>box.remove();

function sma(v,p){
 if(v.length<p)return null;
 return v.slice(-p).reduce((a,b)=>a+b,0)/p;
}

function ema(v,p){
 if(v.length<p)return null;
 const k=2/(p+1);
 let e=v.slice(0,p).reduce((a,b)=>a+b,0)/p;
 for(let i=p;i<v.length;i++)e=v[i]*k+e*(1-k);
 return e;
}

function rsi(v,p=14){
 if(v.length<=p)return null;
 let gain=0,loss=0;
 for(let i=v.length-p;i<v.length;i++){
   const d=v[i]-v[i-1];
   if(d>0)gain+=d;
   else loss-=d;
 }
 if(loss===0)return 100;
 return 100-100/(1+gain/loss);
}

function macd(v){
 const a=ema(v,12),b=ema(v,26);
 return a==null||b==null?null:a-b;
}

function boll(v,p=20){
 if(v.length<p)return null;
 const x=v.slice(-p);
 const m=x.reduce((a,b)=>a+b,0)/p;
 const sd=Math.sqrt(
   x.reduce((s,n)=>s+(n-m)**2,0)/p
 );
 return {mid:m,upper:m+2*sd,lower:m-2*sd};
}

function stochastic(c,p=14){
 if(c.length<p)return null;
 const x=c.slice(-p);
 const hi=Math.max(...x.map(a=>a.high));
 const lo=Math.min(...x.map(a=>a.low));
 const cl=x.at(-1).close;
 return hi===lo?50:(cl-lo)/(hi-lo)*100;
}

function atr(c,p=14){
 if(c.length<=p)return null;
 const tr=[];
 for(let i=1;i<c.length;i++){
   const a=c[i],b=c[i-1];
   tr.push(Math.max(
     a.high-a.low,
     Math.abs(a.high-b.close),
     Math.abs(a.low-b.close)
   ));
 }
 return sma(tr,p);
}

function analyse(c){

 const v=c.map(x=>Number(x.close));
 const price=v.at(-1);

 const RSI=rsi(v);
 const E9=ema(v,9);
 const E21=ema(v,21);
 const E50=ema(v,50);
 const S50=sma(v,50);
 const MACD=macd(v);
 const BB=boll(v);
 const ST=stochastic(c);
 const ATR=atr(c);

 let bullish=0,bearish=0;

 if(RSI>55)bullish++;
 else if(RSI<45)bearish++;

 if(E9>E21)bullish++;
 else if(E9<E21)bearish++;

 if(E50&&price>E50)bullish++;
 else if(E50&&price<E50)bearish++;

 if(S50&&price>S50)bullish++;
 else if(S50&&price<S50)bearish++;

 if(MACD>0)bullish++;
 else if(MACD<0)bearish++;

 if(BB&&price>BB.mid)bullish++;
 else if(BB&&price<BB.mid)bearish++;

 if(ST>50)bullish++;
 else if(ST<50)bearish++;

 let trend="Neutral";
 if(bullish>=5)trend="Bullish";
 else if(bearish>=5)trend="Bearish";

 let momentum="Mixed";
 if(bullish>=5||bearish>=5)momentum="Strong";
 else if(bullish>=4||bearish>=4)momentum="Moderate";

 let volatility="Unknown";
 if(ATR!=null){
   const range=price?ATR/price:0;
   volatility=range>0.001?"High":"Moderate";
 }

 return {
   price,RSI,E9,E21,E50,S50,MACD,BB,ST,ATR,
   bullish,bearish,trend,momentum,volatility
 };
}

/*
  DATA ADAPTER

  Your permitted market-data source should provide:

  window.RK_MARKET_DATA.getCandles(pair,"1m")

  Example candle:
  {
    open:1.1490,
    high:1.1500,
    low:1.1488,
    close:1.1497,
    time:123456789
  }

  The analyzer deliberately does NOT scrape
  protected account/chart data.
*/

async function getData(pair){

 if(window.RK_MARKET_DATA &&
    typeof window.RK_MARKET_DATA.getCandles==="function"){

   return await window.RK_MARKET_DATA.getCandles(pair,"1m");
 }

 throw new Error(
   "Market-data adapter not connected. Connect a permitted live FX data source."
 );
}

function n(x,d=5){
 return x==null?"—":Number(x).toFixed(d);
}

$("#rkGo").onclick=async()=>{

 const pair=$("#rkPair").value;
 const out=$("#rkOut");

 out.innerHTML=`
 <div style="padding:12px;background:#1f2937;border-radius:10px">
 Loading 1-minute market data...
 </div>`;

 try{

   const candles=await getData(pair);

   if(!Array.isArray(candles)||candles.length<60)
     throw new Error("At least 60 one-minute candles are required.");

   const r=analyse(candles);

   out.innerHTML=`

   <div style="padding:13px;background:#1f2937;border-radius:10px">

   <div style="font-size:20px;font-weight:bold">
   ${pair}
   </div>

   <div style="margin-top:5px">
   Price: <b>${n(r.price)}</b>
   </div>

   <hr style="border-color:#374151">

   <div>Trend:
   <b>${r.trend}</b></div>

   <div>Momentum:
   <b>${r.momentum}</b></div>

   <div>Volatility:
   <b>${r.volatility}</b></div>

   <div style="margin-top:6px">
   Indicator agreement:
   <b>${Math.max(r.bullish,r.bearish)}/7</b>
   </div>

   </div>

   <div style="margin-top:10px;padding:12px;background:#1f2937;border-radius:10px;font-size:12px">

   <b>7-Indicator Analysis</b><br><br>

   RSI(14): ${n(r.RSI,2)}<br>
   EMA 9: ${n(r.E9)}<br>
   EMA 21: ${n(r.E21)}<br>
   MACD: ${n(r.MACD)}<br>
   Bollinger Mid: ${r.BB?n(r.BB.mid):"—"}<br>
   Stochastic: ${n(r.ST,2)}<br>
   SMA 50: ${n(r.S50)}<br>
   ATR(14): ${n(r.ATR)}

   </div>

   <div style="margin-top:10px;padding:10px;background:#172033;border-radius:8px;font-size:11px">
   This is an indicator-based market analysis, not a guaranteed outcome or trade instruction.
   </div>
   `;

 }catch(e){

   out.innerHTML=`
   <div style="padding:12px;background:#1f2937;border-radius:10px;color:#fca5a5">
   ${e.message}
   </div>`;
 }
};

})();
