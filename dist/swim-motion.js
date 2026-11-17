/* FLASH SWIM: transparent frame atlases; no runtime GIF decoder or pixel readback. */
(() => {
  'use strict';
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const records = new Set();
  const assetCache = new Map();
  const strokes = ['butterfly', 'backstroke', 'breaststroke', 'freestyle'];
  const assetConfiguration = window.FLASHSWIM_SWIM_ASSETS || {};
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const MAX_DAY_SPEED = .52; // CSS pixels per millisecond; prevents a long selection jumping across the lane.
  let frame = 0;
  let previousTime = 0;
  let scheduleRecord;

  function getAsset(stroke) {
    if (assetCache.has(stroke)) return assetCache.get(stroke);
    const config = assetConfiguration[stroke];
    const asset = {status:'error',image:null,width:0,height:0,columns:1,delays:[100]};
    assetCache.set(stroke,asset);
    if (!config || typeof config.src !== 'string' || !config.src || !(config.width > 0) || !(config.height > 0)) return asset;
    asset.width = Math.round(config.width);
    asset.height = Math.round(config.height);
    asset.columns = Math.max(1,Math.round(config.columns || 6));
    asset.delays = Array.isArray(config.delays) && config.delays.length
      ? config.delays.map(delay => Number.isFinite(Number(delay)) && Number(delay)>0 ? Number(delay) : 100)
      : Array(24).fill(100);
    asset.status = 'loading';
    asset.image = new Image();
    asset.image.decoding = 'async';
    asset.image.onload = () => {
      const requiredWidth = asset.width*Math.min(asset.columns,asset.delays.length);
      const requiredHeight = asset.height*Math.ceil(asset.delays.length/asset.columns);
      asset.status = asset.image.naturalWidth>=requiredWidth && asset.image.naturalHeight>=requiredHeight ? 'ready' : 'error';
      for (const record of records) {
        if (record.asset !== asset) continue;
        record.lane.dataset.swimMedia = asset.status;
        record.swimmer.classList.toggle('swim-media-failed',asset.status==='error');
        if (asset.status==='ready') drawFrame(record,0,true);
      }
      requestFrame();
    };
    asset.image.onerror = () => {
      asset.status = 'error';
      for (const record of records) {
        if (record.asset!==asset) continue;
        record.lane.dataset.swimMedia='error';
        record.swimmer.classList.add('swim-media-failed');
      }
      requestFrame();
    };
    // Same-origin and file:// paths both work; drawImage never reads the pixels back.
    asset.image.src=config.src;
    return asset;
  }

  function makeLane(className, stroke='freestyle') {
    const lane=document.createElement('div');
    lane.className=className;
    lane.setAttribute('aria-hidden','true');
    lane.dataset.stroke=stroke;
    lane.innerHTML='<span class="swim-rope"></span><span class="swim-rope swim-rope-bottom"></span><div class="swim-lane-swimmer"><div class="swim-lane-wake"></div><div class="swimmer-facing"><canvas class="swimmer-canvas swimmer-illustration" aria-hidden="true"></canvas></div></div>';
    return lane;
  }

  function recordFor(element,lane,kind) {
    const swimmer=lane.querySelector('.swim-lane-swimmer');
    const canvas=swimmer.querySelector('canvas');
    const asset=getAsset(lane.dataset.stroke || 'freestyle');
    canvas.width=asset.width || 320;
    canvas.height=asset.height || 232;
    const context=canvas.getContext('2d');
    if (context) {
      context.imageSmoothingEnabled=true;
      context.imageSmoothingQuality='high';
    }
    const record={element,lane,kind,swimmer,canvas,context,asset,current:null,destination:null,tween:null,
      visible:true,lastDirection:1,frameIndex:0,frameElapsed:0,paintedFrame:-1,
      facing:swimmer.querySelector('.swimmer-facing'),wake:swimmer.querySelector('.swim-lane-wake')};
    records.add(record);
    lane.dataset.swimMedia=asset.status;
    swimmer.classList.toggle('swim-media-failed',asset.status==='error');
    record.facing.style.transform='scaleX(-1)'; // Source cycles all point left; the initial journey points right.
    if (asset.status==='ready') drawFrame(record,0,true);
    visibilityObserver?.observe(lane);
    resizeObserver?.observe(lane);
    return record;
  }

  function drawFrame(record,index,force=false) {
    if (!record.context || record.asset.status!=='ready' || (!force && record.paintedFrame===index)) return;
    const {image,width,height,columns}=record.asset;
    const sourceX=(index%columns)*width;
    const sourceY=Math.floor(index/columns)*height;
    try {
      record.context.clearRect(0,0,width,height);
      record.context.drawImage(image,sourceX,sourceY,width,height,0,0,width,height);
      record.paintedFrame=index;
    } catch {
      record.asset.status='error';
      record.lane.dataset.swimMedia='error';
      record.swimmer.classList.add('swim-media-failed');
    }
  }

  function advanceCycle(record,elapsed) {
    if (!record.context || record.asset.status!=='ready') return false;
    if (motionPreference.matches) {
      record.frameIndex=0;
      record.frameElapsed=0;
      drawFrame(record,0);
      return false;
    }
    record.frameElapsed+=elapsed;
    const delays=record.asset.delays;
    while (record.frameElapsed>=delays[record.frameIndex]) {
      record.frameElapsed-=delays[record.frameIndex];
      record.frameIndex=(record.frameIndex+1)%delays.length;
    }
    drawFrame(record,record.frameIndex);
    return true;
  }

  const visibilityObserver='IntersectionObserver' in window ? new IntersectionObserver(entries=>{
    for (const entry of entries) {
      for (const record of records) if (record.lane===entry.target) record.visible=entry.isIntersecting;
    }
    requestFrame();
  },{rootMargin:'0px'}) : null;
  const resizeObserver='ResizeObserver' in window ? new ResizeObserver(requestFrame) : null;

  document.querySelectorAll('.swim-divider').forEach((divider,index)=>{
    if (divider.dataset.swimReady) return;
    divider.dataset.swimReady='true';
    const lane=makeLane('swim-divider-stage',strokes[index%strokes.length]);
    divider.append(lane);
    recordFor(divider,lane,'divider');
  });

  function updateSchedule() {
    const weekdays=document.querySelector('.pool-schedule .weekdays');
    if (scheduleRecord && scheduleRecord.element!==weekdays) {
      visibilityObserver?.unobserve(scheduleRecord.lane);
      resizeObserver?.unobserve(scheduleRecord.lane);
      records.delete(scheduleRecord);
      scheduleRecord=undefined;
    }
    if (!weekdays) return;
    if (!scheduleRecord) {
      let lane=weekdays.parentElement.querySelector('.schedule-swimmer-lane');
      if (!lane) {
        lane=makeLane('schedule-swimmer-lane');
        weekdays.insertAdjacentElement('afterend',lane);
      }
      scheduleRecord=recordFor(weekdays,lane,'schedule');
    }
    requestFrame();
  }

  function targetPosition(record) {
    const box=record.lane.getBoundingClientRect();
    const travel=Math.max(0,box.width-record.swimmer.offsetWidth);
    if (record.kind==='schedule') {
      const day=record.element.querySelector('.schedule-day[aria-selected="true"]') || record.element.querySelector('.schedule-day');
      if (!day) return travel*.5;
      const dayBox=day.getBoundingClientRect();
      return clamp(dayBox.left+dayBox.width/2-box.left-record.swimmer.offsetWidth/2,0,travel);
    }
    if (motionPreference.matches) return travel*.45;
    return clamp((window.innerHeight-box.top)/(window.innerHeight+box.height))*travel;
  }

  function moveToDay(record,target,elapsed) {
    if (record.current===null || motionPreference.matches) {
      record.current=target;
      record.destination=target;
      record.tween=null;
      return false;
    }
    if (record.destination===null || Math.abs(target-record.destination)>.25) {
      const distance=Math.abs(target-record.current);
      record.destination=target;
      record.tween={from:record.current,to:target,elapsed:0,duration:clamp(650+distance*2.35,800,2000)};
      if (distance>.1) record.lastDirection=target<record.current?-1:1;
    }
    if (!record.tween) return false;
    const tween=record.tween;
    tween.elapsed+=elapsed;
    const progress=clamp(tween.elapsed/tween.duration);
    const eased=.5-Math.cos(Math.PI*progress)/2;
    const planned=tween.from+(tween.to-tween.from)*eased;
    const difference=planned-record.current;
    record.current+=clamp(difference,-MAX_DAY_SPEED*elapsed,MAX_DAY_SPEED*elapsed);
    if (progress>=1 && Math.abs(tween.to-record.current)<.1) {
      record.current=tween.to;
      record.tween=null;
    }
    return !!record.tween;
  }

  function tick(time) {
    frame=0;
    if (document.hidden) {previousTime=0;return;}
    const elapsed=previousTime?Math.min(Math.max(time-previousTime,0),100):16;
    previousTime=time;
    let continueMotion=false;
    const reads=[];
    for (const record of records) {
      if (record.element.isConnected && record.visible) reads.push([record,targetPosition(record)]);
    }
    for (const [record,target] of reads) {
      if (record.kind==='schedule') {
        if (moveToDay(record,target,elapsed)) continueMotion=true;
      } else {
        if (record.current!==null && Math.abs(target-record.current)>.1 && !motionPreference.matches) record.lastDirection=target<record.current?-1:1;
        record.current=target; // Scroll is proportional, without an easing tail that detaches the swimmer from its lane.
      }
      record.facing.style.transform=record.lastDirection<0?'scaleX(1)':'scaleX(-1)';
      record.wake.style.transform=record.lastDirection<0?'translateX(150%) scaleX(-1)':'scaleX(1)';
      record.swimmer.style.transform=`translate3d(${record.current.toFixed(2)}px,-50%,0)`;
      if (advanceCycle(record,elapsed)) continueMotion=true;
    }
    if (continueMotion) frame=requestAnimationFrame(tick);
    else previousTime=0;
  }

  function requestFrame() {if (!frame && !document.hidden) frame=requestAnimationFrame(tick);}
  updateSchedule();
  const poolPanel=document.querySelector('#pool-panel');
  if (poolPanel) new MutationObserver(updateSchedule).observe(poolPanel,{childList:true,subtree:true});
  document.addEventListener('flashswim:daychange',updateSchedule);
  window.addEventListener('scroll',requestFrame,{passive:true});
  window.addEventListener('resize',requestFrame,{passive:true});
  motionPreference.addEventListener('change',requestFrame);
  document.addEventListener('visibilitychange',()=>{
    if (document.hidden) {cancelAnimationFrame(frame);frame=0;previousTime=0;}
    else requestFrame();
  });
  requestFrame();
})();
