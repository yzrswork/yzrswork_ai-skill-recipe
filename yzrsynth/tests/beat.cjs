// npm install --prefix /tmp/yzr-tests playwright@1.58.2
// PLAYWRIGHT_MODULE=... CHROMIUM_PATH=... WEBKIT_PATH=... node yzrsynth/tests/beat.cjs
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'evidence');
const BASELINE='5711edaae1b314f59221bcea67783452e4a1a215';
const before=execFileSync('git',['show',BASELINE+':yzrsynth/index.html'],{cwd:root,encoding:'utf8'});
const oldSW=execFileSync('git',['show',BASELINE+':yzrsynth/sw.js'],{cwd:root,encoding:'utf8'});
const after=fs.readFileSync(path.join(root,'yzrsynth/index.html'),'utf8');
const region=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
for(const [a,b] of [['// ── Audio','// ── Knobs'],['function playDrum','function startSeq'],['// ── Looper (hold-to-overdub','</script>']]) assert.equal(region(after,a,b),region(before,a,b),'audio/recording/hash region unchanged: '+a);
assert.equal(region(after,'function applyEffect','function knobLabel'),region(before,'function applyEffect','function knobLabel'),'BPM/Swing/effect mappings unchanged');
fs.mkdirSync(out,{recursive:true});
const results=[];let mode='after',offlineOrigin=false;
const server=http.createServer((req,res)=>{
 if(offlineOrigin){req.socket.destroy();return;}
 const route=new URL(req.url,'http://localhost').pathname;
 if(!route.startsWith('/yzrswork_ai-skill-recipe/')){res.writeHead(404).end();return;}
 let name=route.slice('/yzrswork_ai-skill-recipe/'.length);if(name.endsWith('/'))name+='index.html';
 if(name.includes('..')){res.writeHead(403).end();return;}
 const full=path.join(root,name);res.setHeader('Cache-Control','no-store');
 res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.json')?'application/json':name.endsWith('.png')?'image/png':'text/html; charset=utf-8');
 if(mode==='before'&&name==='yzrsynth/index.html')return res.end(before);
 if(mode==='before'&&name==='yzrsynth/sw.js')return res.end(oldSW);
 try{res.end(fs.readFileSync(full));}catch(e){res.writeHead(404).end();}
});
const initial=()=>Array.from({length:5},(_,t)=>Array.from({length:16},(_,s)=>t===0?s%4===0:t===1?s===4||s===12:t===2?s%2===0:false));
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url=`http://127.0.0.1:${server.address().port}/yzrswork_ai-skill-recipe/yzrsynth/`;
 try{for(const name of (process.env.ENGINE?[process.env.ENGINE]:['chromium','webkit'])){
  const browser=await pw[name].launch({headless:true,...(process.env[name.toUpperCase()+'_PATH']?{executablePath:process.env[name.toUpperCase()+'_PATH']}:{}),...(name==='chromium'?{args:['--no-sandbox']}:{}),env:{...process.env,LIBGL_ALWAYS_SOFTWARE:'1',WEBKIT_DISABLE_COMPOSITING_MODE:'1',WEBKIT_DISABLE_DMABUF_RENDERER:'1'}});
  try{
   const context=await browser.newContext({viewport:{width:375,height:667},isMobile:true,hasTouch:true,deviceScaleFactor:2,serviceWorkers:'block'});
   const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
   // Baseline capture and observations from the frozen main source, before any test edits.
   mode='before';await p.goto(url);await p.screenshot({path:path.join(out,name+'-before-375.png')});
   assert.equal(await p.locator('#seq-steps button').count(),16);
   const baselineMetrics=await p.locator('.step').first().boundingBox();
   assert.deepEqual(await p.evaluate(()=>drumPattern),initial());
   await p.locator('#seq-play').click();await p.waitForFunction(()=>seqPlaying&&playheadStep>=0);
   await p.locator('.drum-tab').nth(1).click();assert.equal(await p.locator('.step.on').count(),2);
   await p.locator('#seq-play').click();await p.locator('.scale-btn[data-scale="penta"]').click();assert.equal(await p.locator('.pad-key').count(),6);
   assert.deepEqual(errors,[],'baseline JS errors');
   mode='after';await p.goto(url);assert.deepEqual(await p.evaluate(()=>drumPattern),initial());
   assert.equal(await p.locator('#beat-matrix .step').count(),40);assert.equal(await p.locator('[data-drum-undo]').first().isDisabled(),true);
   // All 80 cells, via actual touch taps; each one must change exactly its own bit.
   const expected=initial();
   for(let page=0;page<2;page++){
    await p.locator(`[data-page="${page}"]`).tap();
    for(let t=0;t<5;t++)for(let i=0;i<8;i++){
     const s=page*8+i;await p.locator(`#beat-matrix [data-track="${t}"][data-step="${s}"]`).tap();expected[t][s]=!expected[t][s];
     assert.deepEqual(await p.evaluate(()=>drumPattern),expected,'isolated edit '+t+'/'+s);
    }
   }
   assert.equal(await p.evaluate(()=>drumHistory.length),32);
   // Precision is another view of the same bits. Closing restores page and scroll.
   await p.locator('.track-btn').nth(3).click();await p.locator('#precision-open').click();
   assert.equal(await p.locator('#precision-steps .step').count(),8);
   await p.locator('#precision-steps [data-step="8"]').tap();expected[3][8]=!expected[3][8];
   assert.deepEqual(await p.evaluate(()=>drumPattern),expected);
   assert.equal(await p.locator('#beat-matrix [data-track="3"][data-step="8"]').getAttribute('aria-pressed'),String(expected[3][8]));
   await p.locator('#precision-dialog [data-drum-undo]').click();expected[3][8]=!expected[3][8];
   assert.deepEqual(await p.evaluate(()=>drumPattern),expected);
   await p.locator('#precision-close').click();assert.equal(await p.evaluate(()=>beatPage),1);
   // Undo is bounded, never falls through into looper clear.
   while(await p.locator('#beat-panel [data-drum-undo]').isEnabled())await p.locator('#beat-panel [data-drum-undo]').click();
   assert.equal(await p.evaluate(()=>drumHistory.length),0);
   assert.equal(await p.evaluate(()=>looperState),'idle');
   // Old-format URL read + exact old-format output, including non-default knobs.
   const hash='#k=10,20,30,40,50,60,70,50,75,25&t=4&n=3&s=penta&g=1&p=8001,0020,aaaa,0400,0080';
   await p.goto(url+hash);await p.reload();assert.equal(await p.locator('#bpm-value').textContent(),'150');
   assert.equal(await p.locator('#swing-value').textContent(),'15%');
   assert.equal(await p.evaluate(()=>currentTimbre),4);assert.equal(await p.evaluate(()=>currentArpNotes),3);
   await p.locator('#beat-matrix [data-track="0"][data-step="1"]').tap();
   await p.waitForFunction(()=>location.hash.includes('p=8003'));
   const shared=p.url();const saved=await p.evaluate(()=>drumPattern);await p.reload();assert.deepEqual(await p.evaluate(()=>drumPattern),saved);
   assert.equal(new URL(shared).hash,hash.replace('p=8001','p=8003'));
   // Real-clock playhead, no automatic page following, and edit while playing.
   await p.goto(url);await p.locator('#seq-play').tap();
   await p.waitForFunction(()=>playheadStep>=8);assert.equal(await p.evaluate(()=>beatPage),0);
   assert.match(await p.locator('#seq-position').textContent(),/別ページ/);
   await p.locator('[data-page="1"]').tap();await p.waitForFunction(()=>playheadStep>=8);
   assert.equal(await p.locator('#beat-matrix .step.playhead').count(),5);
   await p.locator('#beat-matrix [data-track="4"][data-step="9"]').tap();
   assert.equal(await p.evaluate(()=>seqPlaying),true);
   await p.evaluate(()=>{window.testTimer=seqTimer;window.testAudio=audioCtx;});
   await p.locator('#view-performance').tap();assert.equal(await p.evaluate(()=>seqTimer===window.testTimer&&audioCtx===window.testAudio),true);
   // Timbres, pads, arp, effects and hold-to-record remain accessible.
   for(const timbre of ['chip','bell','piano','pad','acid']){await p.locator('#tb-'+timbre).tap();assert.equal(await p.locator('#tb-'+timbre).getAttribute('class').then(s=>s.includes('active')),true);}
   await p.locator('[data-scale="penta"]').tap();assert.equal(await p.locator('.pad-key').count(),6);
   await p.locator('[data-scale="major"]').tap();assert.equal(await p.locator('.pad-key').count(),6);
   await p.locator('.arp-note-btn[data-notes="2"]').tap();assert.equal(await p.evaluate(()=>currentArpNotes),2);
   // Real pointer gestures on preserved effect and tempo knobs.
   for(const id of ['knob-rev','knob-arpSpd','knob-bpm','knob-swing']){
    await p.locator('#'+id).scrollIntoViewIfNeeded();const r=await p.locator('#'+id).boundingBox();
    await p.mouse.move(r.x+r.width/2,r.y+r.height/2);await p.mouse.down();await p.mouse.move(r.x+r.width/2,r.y+r.height/2-12);await p.mouse.up();
   }
   assert.ok(await p.evaluate(()=>knobVals.rev>0&&knobVals.arpSpd>0&&bpm>120&&swing>0));
   // Capture a live drum take, then overdub. Check nonempty PCM/state, not perceptual audio quality.
   async function take(){await p.locator('#looper-rec').scrollIntoViewIfNeeded();const r=await p.locator('#looper-rec').boundingBox();await p.mouse.move(r.x+r.width/2,r.y+r.height/2);await p.mouse.down();await p.waitForTimeout(450);assert.equal(await p.evaluate(()=>looperState),'recording');await p.mouse.up();await p.waitForFunction(()=>looperState==='playing');}
   await take();assert.ok(await p.evaluate(()=>loopBuffer.getChannelData(0).some(v=>Math.abs(v)>.0001)));
   await p.evaluate(()=>{window.testLoop=loopSource;window.testBuffer=loopBuffer;});
   await p.locator('#view-beat').tap();assert.equal(await p.evaluate(()=>loopSource===window.testLoop&&loopBuffer===window.testBuffer&&seqTimer===window.testTimer),true);
   // Drum Undo cannot touch the existing recorded audio.
   await p.locator('#beat-matrix .step').first().tap();await p.locator('#beat-panel [data-drum-undo]').tap();assert.equal(await p.evaluate(()=>loopBuffer===window.testBuffer),true);
   await p.locator('#view-performance').tap();await take();assert.equal(await p.locator('#looper-clear').textContent(),'UNDO');
   await p.locator('#looper-clear').click();assert.equal(await p.evaluate(()=>loopBuffer===window.testBuffer),true);
   await p.locator('[data-scale="free"]').tap();assert.equal(await p.locator('.white-key').count(),10);
   await p.locator('.white-key').first().scrollIntoViewIfNeeded();let key=await p.locator('.white-key').first().boundingBox();
   await p.mouse.move(key.x+key.width/2,key.y+key.height-10);await p.mouse.down();assert.ok(await p.evaluate(()=>Object.keys(activeVoices).length>0));
   // A second-finger view action, dispatched while the real keyboard pointer is down.
   await p.locator('#view-beat').dispatchEvent('click');assert.equal(await p.evaluate(()=>Object.keys(activeVoices).length),0);await p.mouse.up();
   await p.locator('#seq-play').tap();assert.equal(await p.evaluate(()=>seqPlaying),false);assert.equal(await p.evaluate(()=>looperState),'playing');
   assert.equal(await p.locator('#beat-matrix .playhead').count(),0);assert.match(await p.locator('#seq-position').textContent(),/停止中/);
   // Layout evidence: normal, precision, preserved controls, short viewport, landscape, desktop.
   for(const [w,h] of [[375,667],[390,844],[360,800],[375,500],[667,375],[1280,900]]){
    await p.setViewportSize({width:w,height:h});await p.goto(url);
    const geometry=await p.evaluate(()=>{const r=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom};};return {overflow:document.documentElement.scrollWidth>innerWidth,cell:r(document.querySelector('#beat-matrix .step')),transport:r(document.getElementById('seq-transport')),nav:r(document.getElementById('view-switch'))};});
    assert.equal(geometry.overflow,false);assert.ok(geometry.transport.bottom<=h+.5);assert.ok(geometry.transport.y>=0);assert.ok(geometry.cell.width>=33&&geometry.cell.height>=48);
    await p.screenshot({path:path.join(out,`${name}-beat-${w}x${h}.png`)});
    await p.locator('#precision-open').click();await p.screenshot({path:path.join(out,`${name}-precision-${w}x${h}.png`)});
    const sizes=await p.locator('#precision-steps .step').evaluateAll(es=>es.map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));
    assert.ok(sizes.every(s=>s.w>=60&&s.h>=76));
    await p.locator('#precision-close').click();assert.equal(await p.evaluate(()=>beatPanel.scrollTop),await p.evaluate(()=>beatScrollBeforePrecision));
    await p.locator('#view-performance').click();await p.locator('#keyboard-wrap').scrollIntoViewIfNeeded();
    assert.ok((await p.locator('.white-key').first().boundingBox()).height>=180);
    if(w===375&&h===667)await p.screenshot({path:path.join(out,name+'-performance-375.png')});
    results.push({engine:name,version:browser.version(),viewport:[w,h],geometry});
   }
   assert.deepEqual(errors,[],'runtime JS errors');await context.close();
   // PWA: install old cache, update the actual service worker, retain unrelated cache,
   // then reload with the origin unavailable. No network mocking of the SW response.
   mode='before';const pc=await browser.newContext({viewport:{width:375,height:667}});const q=await pc.newPage();const pe=[];q.on('pageerror',e=>pe.push(e.message));
   await q.goto(url);await q.evaluate(()=>navigator.serviceWorker.ready);await q.reload();
   await q.waitForFunction(()=>!!navigator.serviceWorker.controller);
   await q.evaluate(()=>caches.open('unrelated-app-test'));
   mode='after';await q.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration();const changed=new Promise(r=>navigator.serviceWorker.addEventListener('controllerchange',r,{once:true}));await reg.update();await changed;});
   await q.reload();assert.equal(await q.locator('#beat-matrix .step').count(),40);
   const keys=await q.evaluate(()=>caches.keys());assert.ok(keys.includes('yapps-yzrsynth-v3-beat'));assert.ok(!keys.includes('yapps-yzrsynth-v2'));assert.ok(keys.includes('unrelated-app-test'));
   offlineOrigin=true;if(name==='chromium')await pc.setOffline(true);
   await q.reload();assert.equal(await q.locator('#beat-matrix .step').count(),40);
   await q.locator('#beat-matrix .step').first().click();await q.waitForFunction(()=>location.hash.includes('p='));
   await q.locator('#seq-play').click();await q.waitForFunction(()=>seqPlaying&&playheadStep>=0);
   await q.locator('#seq-play').click();assert.deepEqual(pe,[]);
   offlineOrigin=false;await pc.close();results.push({engine:name,tests:'80 cell edits, precision, Undo isolation, URL roundtrip, live playhead, audio state, looper PCM/overdub/Undo, source parity, cache upgrade/offline',baselineCell:baselineMetrics,pass:true});
   console.log(name+' PASS');
  }finally{offlineOrigin=false;await browser.close();}
 }}finally{server.close();fs.writeFileSync(path.join(out,(process.env.ENGINE||'all')+'-results.json'),JSON.stringify(results,null,2)+'\n');}
})().catch(e=>{console.error(e);process.exitCode=1;});
