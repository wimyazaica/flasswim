/* FLASH SWIM: adult swimmer illustrations with articulated, outside-the-body strokes. */
(() => {
  'use strict';
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const records = new Set();
  const strokes = ['butterfly', 'backstroke', 'breaststroke', 'freestyle'];
  const TAU = Math.PI * 2;
  let frame = 0;
  let previousTime = 0;
  let scheduleRecord;
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const point = (x, y) => ({x, y});
  const mirror = p => point(p.x, 110 - p.y);
  const fmt = p => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  const armRoutes = {
    freestyle: {wrists:[point(199,42),point(177,15),point(133,11),point(94,34),point(150,8)], elbows:[point(171,38),point(151,13),point(111,31),point(115,20),point(124,15)]},
    backstroke: {wrists:[point(199,42),point(180,13),point(139,7),point(93,35),point(141,10)], elbows:[point(171,40),point(153,13),point(114,23),point(114,19),point(116,23)]},
    butterfly: {wrists:[point(199,43),point(179,13),point(132,9),point(93,34),point(158,8)], elbows:[point(171,39),point(152,13),point(112,26),point(113,18),point(131,12)]},
    breaststroke: {wrists:[point(199,46),point(185,22),point(151,19),point(156,36),point(190,43)], elbows:[point(171,41),point(157,18),point(119,20),point(129,19),point(167,32)]}
  };

  function limbMarkup(name) {
    return `<g class="swimmer-limb swimmer-${name}"><path class="limb-upper"/><path class="limb-lower"/><circle class="limb-joint"/><path class="limb-end"/><path class="limb-light"/></g>`;
  }

  function swimmerMarkup(stroke = 'freestyle') {
    const faceUp = stroke === 'backstroke';
    const head = faceUp
      ? `<ellipse cx="164" cy="55" rx="8.6" ry="9.5" fill="#edbc98"/><path d="M165 45.5c5 .4 8 4.4 8 9.5s-3 9.1-8 9.5l1-4.2c2.7-1.1 3.7-2.9 3.7-5.3s-1-4.2-3.7-5.3Z" fill="#167fa9"/><path d="m161 48.5 1 13" stroke="#194e60" stroke-width="1.2"/><ellipse cx="160" cy="51" rx="2.3" ry="1.7" fill="#124b5b"/><ellipse cx="160" cy="59" rx="2.3" ry="1.7" fill="#124b5b"/><path d="m156 52-1.4 3 1.4 1M154.5 57.5q1.1 1.2 2.3 0" stroke="#bd815f" stroke-width=".7" stroke-linecap="round"/>`
      : `<ellipse cx="163" cy="55" rx="8.5" ry="9.3" fill="#edbc98"/><path d="M159.5 46.5c6-3 13.5 1.7 13.5 8.5s-7.5 11.5-13.5 8.5l1.8-8.5Z" fill="#147fae"/><path d="M164 48.2q5.2 1 6 5" stroke="#83c5d6" stroke-width="1.1" stroke-linecap="round"/><path d="M159 48v14" stroke="#17465b" stroke-width="1.2"/><path d="m156 49 3-.5v4l-3 .4zm0 8 3 .4v4l-3-.5Z" fill="#154657"/><path d="m155 53-1 2 1 2" stroke="#d49773" stroke-width="1.1" stroke-linecap="round"/>`;
    return `<div class="swim-lane-wake"></div><svg class="swimmer-illustration swimmer-${stroke}" viewBox="0 0 220 110" fill="none" aria-hidden="true" focusable="false"><ellipse cx="110" cy="60" rx="75" ry="15" fill="#087681" opacity=".075"/><g class="swimmer-facing">${limbMarkup('leg-top')}${limbMarkup('leg-bottom')}${limbMarkup('arm-top')}${limbMarkup('arm-bottom')}<path d="M109 47c11-1.2 17-8 28-8.8 6.5-.5 12.4 3.4 14.4 9.3 1.5 4.4 1.5 10.6 0 15-2 5.9-7.9 9.8-14.4 9.3-11-.8-17-7.6-28-8.8Z" fill="#edbd9b"/><path d="M112 48.5c12.4-.5 19.2-9.1 28.2-7 3.4.8 6.4 3.2 7.7 5.9-9-3.9-18.7 4.4-35.9 5.1Z" fill="#f6ceae" opacity=".8"/><path d="M111 62c13.6.7 21.7 8.4 30.3 6.7" stroke="#d59b78" stroke-width="1" stroke-linecap="round" opacity=".55"/><path d="${faceUp ? 'M135 45q5 3 10 1M135 65q5-3 10-1M126 50v10' : 'M141 44q-7 2-9 7M141 66q-7-2-9-7M125 55h19'}" stroke="#ce9473" stroke-width=".8" stroke-linecap="round" opacity=".55"/><path d="M149 50.8h9.5v8.4H149Z" fill="#e5ad89"/><path d="M99 46.5c4.4-.2 9.4.1 14.3 1.4l-2 14.2c-5 1.3-9.4 1.5-13.8.8l2-8.2Z" fill="#ed263d"/><path d="M100 47.5q7 .2 12.5 1.5" stroke="#ff8290" stroke-width="1.3" stroke-linecap="round"/><path d="m99.5 60.4 11.4.9M110.6 49l-1.1 11.7" stroke="#bc142a" stroke-width=".9" stroke-linecap="round"/><path d="M106.5 48.5v2m-1.4-1 2.8.3" stroke="#fff4ec" stroke-width=".7" stroke-linecap="round"/>${head}</g></svg>`;
  }

  function makeLane(className, stroke = 'freestyle') {
    const lane = document.createElement('div');
    lane.className = className;
    lane.setAttribute('aria-hidden', 'true');
    lane.dataset.stroke = stroke;
    lane.innerHTML = `<span class="swim-rope"></span><span class="swim-rope swim-rope-bottom"></span><div class="swim-lane-swimmer">${swimmerMarkup(stroke)}</div>`;
    return lane;
  }

  function limbParts(swimmer, name) {
    const group = swimmer.querySelector('.swimmer-' + name);
    return {group, upper:group.querySelector('.limb-upper'), lower:group.querySelector('.limb-lower'), joint:group.querySelector('.limb-joint'), end:group.querySelector('.limb-end'), light:group.querySelector('.limb-light')};
  }

  function recordFor(element, lane, kind) {
    const swimmer = lane.querySelector('.swim-lane-swimmer');
    const record = {element, lane, kind, swimmer, stroke:lane.dataset.stroke || 'freestyle', phase:0, current:null, visible:true, lastDirection:1,
      facing:swimmer.querySelector('.swimmer-facing'), wake:swimmer.querySelector('.swim-lane-wake'),
      topArm:limbParts(swimmer, 'arm-top'), bottomArm:limbParts(swimmer, 'arm-bottom'),
      topLeg:limbParts(swimmer, 'leg-top'), bottomLeg:limbParts(swimmer, 'leg-bottom')};
    records.add(record);
    pose(record, 0);
    visibilityObserver?.observe(element);
    resizeObserver?.observe(element);
    return record;
  }

  const visibilityObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      for (const record of records) if (record.element === entry.target) record.visible = entry.isIntersecting;
    }
    requestFrame();
  }, {rootMargin:'0px'}) : null;
  const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(requestFrame) : null;

  document.querySelectorAll('.swim-divider').forEach((divider, index) => {
    if (divider.dataset.swimReady) return;
    divider.dataset.swimReady = 'true';
    const lane = makeLane('swim-divider-stage', strokes[index % strokes.length]);
    divider.append(lane);
    recordFor(divider, lane, 'divider');
  });

  function updateSchedule() {
    const weekdays = document.querySelector('.pool-schedule .weekdays');
    if (scheduleRecord && scheduleRecord.element !== weekdays) {
      visibilityObserver?.unobserve(scheduleRecord.element);
      resizeObserver?.unobserve(scheduleRecord.element);
      records.delete(scheduleRecord);
      scheduleRecord = undefined;
    }
    if (!weekdays) return;
    if (!scheduleRecord) {
      let lane = weekdays.parentElement.querySelector('.schedule-swimmer-lane');
      if (!lane) {
        lane = makeLane('schedule-swimmer-lane');
        weekdays.insertAdjacentElement('afterend', lane);
      }
      scheduleRecord = recordFor(weekdays, lane, 'schedule');
      scheduleRecord.current = 0;
    }
    requestFrame();
  }

  function targetPosition(record) {
    const box = record.lane.getBoundingClientRect();
    const travel = Math.max(0, box.width - record.swimmer.offsetWidth);
    if (record.kind === 'schedule') {
      const activeDay = record.element.querySelector('.schedule-day[aria-selected="true"]') || record.element.querySelector('.schedule-day');
      if (!activeDay) return travel * .5;
      const dayBox = activeDay.getBoundingClientRect();
      return clamp(dayBox.left + dayBox.width / 2 - box.left - record.swimmer.offsetWidth / 2, 0, travel);
    }
    if (motionPreference.matches) return travel * .45;
    return clamp((window.innerHeight - box.top) / (window.innerHeight + box.height)) * travel;
  }

  // Smooth closed trajectories keep each arm on its own side of the torso.
  function trajectory(keys, progress) {
    const scaled = ((progress % 1 + 1) % 1) * keys.length;
    const index = Math.floor(scaled);
    const t = scaled - index;
    const p0 = keys[(index - 1 + keys.length) % keys.length];
    const p1 = keys[index];
    const p2 = keys[(index + 1) % keys.length];
    const p3 = keys[(index + 2) % keys.length];
    const coordinate = axis => .5 * ((2 * p1[axis]) + (-p0[axis] + p2[axis]) * t + (2*p0[axis]-5*p1[axis]+4*p2[axis]-p3[axis])*t*t + (-p0[axis]+3*p1[axis]-3*p2[axis]+p3[axis])*t*t*t);
    return point(coordinate('x'), coordinate('y'));
  }

  function segmentPath(a, b, radiusA, radiusB) {
    const length = Math.max(1, Math.hypot(b.x-a.x, b.y-a.y));
    const ux = (b.x-a.x)/length, uy = (b.y-a.y)/length;
    const nx = -uy, ny = ux;
    const ap = point(a.x+nx*radiusA,a.y+ny*radiusA), am = point(a.x-nx*radiusA,a.y-ny*radiusA);
    const bp = point(b.x+nx*radiusB,b.y+ny*radiusB), bm = point(b.x-nx*radiusB,b.y-ny*radiusB);
    return `M${fmt(ap)}L${fmt(bp)}Q${fmt(point(b.x+ux*radiusB,b.y+uy*radiusB))} ${fmt(bm)}L${fmt(am)}Q${fmt(point(a.x-ux*radiusA,a.y-uy*radiusA))} ${fmt(ap)}Z`;
  }

  function drawLimb(parts, start, joint, end, tip, upperRadius, jointRadius, endRadius) {
    parts.upper.setAttribute('d',segmentPath(start,joint,upperRadius,jointRadius));
    parts.lower.setAttribute('d',segmentPath(joint,end,jointRadius,endRadius));
    parts.joint.setAttribute('cx',joint.x.toFixed(2));
    parts.joint.setAttribute('cy',joint.y.toFixed(2));
    parts.joint.setAttribute('r',(jointRadius*.95).toFixed(2));
    parts.end.setAttribute('d',segmentPath(end,tip,endRadius*1.24,endRadius*.7));
    parts.light.setAttribute('d',`M${fmt(point(start.x,start.y-upperRadius*.35))}Q${fmt(point((start.x+joint.x)/2,(start.y+joint.y)/2-upperRadius*.4))} ${fmt(point(joint.x,joint.y-jointRadius*.3))}`);
  }

  function drawArm(parts, shoulder, elbow, wrist) {
    // Coordinated joint paths avoid an IK branch flip or a forearm crossing the face.
    const forearmLength = Math.max(1,Math.hypot(wrist.x-elbow.x,wrist.y-elbow.y));
    const hand = point(wrist.x+(wrist.x-elbow.x)/forearmLength*8,wrist.y+(wrist.y-elbow.y)/forearmLength*8);
    drawLimb(parts,shoulder,elbow,wrist,hand,4.5,3,1.8);
  }

  function pose(record, position) {
    const phase = motionPreference.matches ? .9 : record.phase + position * .014;
    const progress = phase / TAU;
    const simultaneous = record.stroke === 'butterfly' || record.stroke === 'breaststroke';
    const armRoute = armRoutes[record.stroke] || armRoutes.freestyle;
    const lowerProgress=progress+(simultaneous?0:.5);
    drawArm(record.topArm,point(141,42),trajectory(armRoute.elbows,progress),trajectory(armRoute.wrists,progress));
    drawArm(record.bottomArm,point(141,68),mirror(trajectory(armRoute.elbows,lowerProgress)),mirror(trajectory(armRoute.wrists,lowerProgress)));
    const kick = Math.sin(phase*2);
    let knee = point(68.5,49+kick*1.8), ankle = point(35,49+kick*5.3), foot = point(24,49+kick*5.6);
    let lowerKnee, lowerAnkle, lowerFoot;
    if (record.stroke === 'breaststroke') {
      knee = trajectory([point(69,49),point(75,29),point(74,32),point(69,46)],progress-.06);
      ankle = trajectory([point(35,50),point(96,48),point(44,28),point(35,46)],progress-.06);
      foot = trajectory([point(24,49),point(93,37),point(33,25),point(23,45)],progress-.06);
      lowerKnee=mirror(knee); lowerAnkle=mirror(ankle); lowerFoot=mirror(foot);
    } else if (record.stroke === 'butterfly') {
      const wave = Math.sin(phase*2+.7);
      knee=point(69,49+wave*1.7); ankle=point(35,50+wave*5); foot=point(24,50+wave*6);
      lowerKnee=point(69,61+wave*1.7); lowerAnkle=point(35,60+wave*5); lowerFoot=point(24,60+wave*6);
    } else {
      lowerKnee=point(68.5,61-kick*1.8); lowerAnkle=point(35,61-kick*5.3); lowerFoot=point(24,61-kick*5.6);
    }
    drawLimb(record.topLeg,point(102,49),knee,ankle,foot,5.1,3.2,1.7);
    drawLimb(record.bottomLeg,point(102,61),lowerKnee,lowerAnkle,lowerFoot,5.1,3.2,1.7);
    record.topLeg.group.style.opacity = record.stroke==='backstroke' ? '.96' : String(.9+kick*.05);
    record.bottomLeg.group.style.opacity = record.stroke==='backstroke' ? '.96' : String(.9-kick*.05);
  }

  function tick(time) {
    frame = 0;
    if (document.hidden) {previousTime=0;return;}
    const elapsed = previousTime ? Math.min(time-previousTime,42) : 16;
    previousTime = time;
    let continueMotion = false;
    const reads = [];
    for (const record of records) {
      if (record.element.isConnected && record.visible) reads.push([record,targetPosition(record)]);
    }
    for (const [record,target] of reads) {
      if (!motionPreference.matches) {
        record.phase=(record.phase+elapsed*(record.stroke==='breaststroke'?.0027:.0036))%TAU;
        continueMotion=true;
      }
      if (record.current===null || motionPreference.matches) record.current=target;
      const distance=target-record.current;
      const moving=Math.abs(distance)>.15;
      record.current=moving?record.current+distance*(1-Math.exp(-elapsed/(record.kind==='schedule'?115:75))):target;
      if (moving && !motionPreference.matches) continueMotion=true;
      if (moving && record.kind==='schedule') record.lastDirection=distance<0?-1:1;
      record.facing.style.transform=record.lastDirection<0?'scaleX(-1)':'scaleX(1)';
      record.wake.style.transform=record.lastDirection<0?'translateX(150%) scaleX(-1)':'scaleX(1)';
      record.swimmer.style.transform=`translate3d(${record.current.toFixed(2)}px,-50%,0)`;
      pose(record,record.current);
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
