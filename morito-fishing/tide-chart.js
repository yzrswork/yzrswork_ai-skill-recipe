(() => {
  const STYLE_ID='morito-tide-chart-style';

  function installStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
.tide-chart-wrap{margin-top:12px;border:1px solid var(--line);background:#fff;padding:9px 8px 5px;overflow:hidden}
.tide-chart-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 3px 3px}
.tide-chart-head b{font:800 .66rem var(--mono);letter-spacing:.05em}
.tide-chart-head span{font:600 .58rem var(--mono);color:var(--muted)}
.tide-chart-svg{display:block;width:100%;height:auto;aspect-ratio:600/220;overflow:visible}
.tide-chart-grid{stroke:#dfe3df;stroke-width:1}
.tide-chart-axis{fill:var(--muted);font:600 11px var(--mono)}
.tide-chart-area{fill:var(--sea2);opacity:.72}
.tide-chart-line{fill:none;stroke:var(--sea);stroke-width:4;stroke-linecap:round;stroke-linejoin:round}
.tide-chart-event-line{stroke-width:1;stroke-dasharray:3 4;opacity:.45}
.tide-chart-event-dot{stroke:#fff;stroke-width:3}
.tide-chart-event-label{font:800 11px var(--mono);paint-order:stroke;stroke:#fff;stroke-width:4;stroke-linejoin:round}
.tide-chart-now-line{stroke:var(--ink);stroke-width:1.5;stroke-dasharray:4 4;opacity:.75}
.tide-chart-now-dot{fill:var(--ink);stroke:#fff;stroke-width:3}
.tide-chart-now-label{fill:var(--ink);font:800 11px var(--mono);paint-order:stroke;stroke:#fff;stroke-width:4}
.tide-chart-note{font-size:.58rem;color:var(--muted);margin:1px 4px 3px}
`;
    document.head.appendChild(style);
  }

  function ensureContainer(){
    let box=document.getElementById('tideChart');
    if(box)return box;
    const events=document.getElementById('tideEvents');
    if(!events)return null;
    box=document.createElement('div');
    box.id='tideChart';
    box.className='tide-chart-wrap';
    events.parentNode.insertBefore(box,events);
    return box;
  }

  function timeHour(time){
    const [h,m]=String(time).split(':').map(Number);
    return h+(m||0)/60;
  }

  function interpolate(samples,hour){
    if(!samples.length)return null;
    if(hour<=samples[0].h)return samples[0].v;
    if(hour>=samples[samples.length-1].h)return samples[samples.length-1].v;
    const i=Math.floor(hour);
    const a=samples.find(p=>p.h===i)||samples[0];
    const b=samples.find(p=>p.h===i+1)||a;
    const t=Math.max(0,Math.min(1,hour-i));
    return a.v+(b.v-a.v)*t;
  }

  function smoothPath(points){
    if(points.length<2)return '';
    let d=`M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for(let i=0;i<points.length-1;i++){
      const p0=points[i-1]||points[i];
      const p1=points[i];
      const p2=points[i+1];
      const p3=points[i+2]||p2;
      const c1x=p1.x+(p2.x-p0.x)/6;
      const c1y=p1.y+(p2.y-p0.y)/6;
      const c2x=p2.x-(p3.x-p1.x)/6;
      const c2y=p2.y-(p3.y-p1.y)/6;
      d+=` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  }

  function chartSVG(day){
    if(!Array.isArray(day.hourlyCm)||day.hourlyCm.length!==24)return '<div class="empty">毎時潮位データなし</div>';
    const days=DB.tides.days;
    const idx=days.findIndex(d=>d.date===day.date);
    const next=idx>=0?days[idx+1]:null;
    const nextMidnight=next?.hourlyCm?.[0] ?? day.nextMidnightCm ?? day.hourlyCm[23];
    const samples=day.hourlyCm.map((v,h)=>({h,v}));
    samples.push({h:24,v:nextMidnight});

    const W=600,H=220,L=40,R=12,T=17,B=31;
    const plotW=W-L-R,plotH=H-T-B;
    const allValues=[...samples.map(p=>p.v),...day.events.map(e=>e.heightCm)];
    const min=Math.floor((Math.min(...allValues)-10)/10)*10;
    const max=Math.ceil((Math.max(...allValues)+10)/10)*10;
    const span=Math.max(20,max-min);
    const x=h=>L+(h/24)*plotW;
    const y=v=>T+((max-v)/span)*plotH;
    const points=samples.map(p=>({x:x(p.h),y:y(p.v)}));
    const line=smoothPath(points);
    const area=`${line} L ${x(24).toFixed(1)} ${(H-B).toFixed(1)} L ${x(0).toFixed(1)} ${(H-B).toFixed(1)} Z`;

    const yTicks=[max,Math.round((max+min)/2),min];
    const xTicks=[0,6,12,18,24];
    const grids=[
      ...yTicks.map(v=>`<line class="tide-chart-grid" x1="${L}" y1="${y(v).toFixed(1)}" x2="${W-R}" y2="${y(v).toFixed(1)}"/><text class="tide-chart-axis" x="${L-5}" y="${(y(v)+4).toFixed(1)}" text-anchor="end">${v}</text>`),
      ...xTicks.map(h=>`<line class="tide-chart-grid" x1="${x(h).toFixed(1)}" y1="${T}" x2="${x(h).toFixed(1)}" y2="${H-B}"/><text class="tide-chart-axis" x="${x(h).toFixed(1)}" y="${H-8}" text-anchor="middle">${h}</text>`)
    ].join('');

    const events=day.events.map(e=>{
      const eh=timeHour(e.time), ex=x(eh), ey=y(e.heightCm);
      const high=e.type==='high';
      const c=high?'var(--sea)':'var(--orange)';
      const label=high?'満':'干';
      const ly=Math.max(T+12,Math.min(H-B-8,ey+(high?-10:18)));
      return `<line class="tide-chart-event-line" x1="${ex.toFixed(1)}" y1="${T}" x2="${ex.toFixed(1)}" y2="${H-B}" style="stroke:${c}"/><circle class="tide-chart-event-dot" cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="6" style="fill:${c}"/><text class="tide-chart-event-label" x="${ex.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" style="fill:${c}">${label}</text>`;
    }).join('');

    let nowMarkup='';
    if(localISO(new Date())===day.date){
      const now=new Date();
      const hour=now.getHours()+now.getMinutes()/60;
      const value=interpolate(samples,hour);
      const nx=x(hour),ny=y(value);
      nowMarkup=`<line class="tide-chart-now-line" x1="${nx.toFixed(1)}" y1="${T}" x2="${nx.toFixed(1)}" y2="${H-B}"/><circle class="tide-chart-now-dot" cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="6"/><text class="tide-chart-now-label" x="${Math.min(W-R-20,nx+8).toFixed(1)}" y="${Math.max(T+12,ny-10).toFixed(1)}">NOW</text>`;
    }

    return `<svg class="tide-chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${day.date} 湘南港の毎時予測潮位グラフ">${grids}<path class="tide-chart-area" d="${area}"/><path class="tide-chart-line" d="${line}"/>${events}${nowMarkup}</svg>`;
  }

  function renderHourlyTideChart(){
    if(typeof DB==='undefined'||!DB||typeof selectedDate==='undefined'||!selectedDate)return;
    installStyles();
    const box=ensureContainer();
    const day=DB.tides.days.find(d=>d.date===selectedDate);
    if(!box||!day)return;
    box.innerHTML=`<div class="tide-chart-head"><b>24H TIDE</b><span>毎時予測 / cm</span></div>${chartSVG(day)}<div class="tide-chart-note">気象庁・湘南港の毎時天文潮位。曲線は1時間ごとの予測値を滑らかにつないだ表示。</div>`;
    const source=document.getElementById('tideSource');
    if(source){
      const href=DB.tides.source.hourlySourceUrl||DB.tides.source.sourceUrl;
      source.innerHTML=`<b>森戸参考値</b>：<a href="${href}" target="_blank" rel="noopener">気象庁「${DB.tides.source.station.nameJa}」潮位表</a>。森戸そのものの観測点ではなく、風・気圧・波で実際の水位はずれる。`;
    }
  }

  if(typeof tideSlotHTML==='function'){
    const originalSlot=tideSlotHTML;
    tideSlotHTML=function(e,index){
      if(!e)return `<div class="tide-slot missing"><span class="no">${index}</span><span class="time">—</span><span class="cm">この日は1回のみ</span></div>`;
      return originalSlot(e,index);
    };
  }

  if(typeof renderTide==='function'){
    const originalRenderTide=renderTide;
    renderTide=function(){
      originalRenderTide();
      renderHourlyTideChart();
    };
  }

  if(typeof DB!=='undefined'&&DB&&typeof selectedDate!=='undefined'&&selectedDate)renderTide();
})();
