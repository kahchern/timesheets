import { useState, useRef, useEffect, useCallback } from "react";

// ─── CONFIG ────────────────────────────────────────────────────────────────────
const HOUR_HEIGHT = 80;     // px per hour in the grid
const START_HOUR  = 7;      // grid starts at 7 AM
const END_HOUR    = 19;     // grid ends at 7 PM
const SNAP_MIN    = 15;     // snap to 15-minute increments
const WORKDAY_MIN = 8 * 60; // 8-hour workday for progress bar

const BUCKETS = [
  { id: "ci",       label: "Continuous Improvement", short: "CI",       color: "#60A5FA", bg: "rgba(59,130,246,0.12)"  },
  { id: "design",   label: "Design & Development",   short: "Design",   color: "#34D399", bg: "rgba(16,185,129,0.12)"  },
  { id: "admin",    label: "Admin & Planning",        short: "Admin",    color: "#FBBF24", bg: "rgba(245,158,11,0.12)"  },
  { id: "meetings", label: "Meetings",                short: "Meetings", color: "#F87171", bg: "rgba(239,68,68,0.12)"   },
  { id: "vendor",   label: "Vendor Quality",          short: "Vendor",   color: "#C084FC", bg: "rgba(168,85,247,0.12)"  },
  { id: "other",    label: "Other",                   short: "Other",    color: "#94A3B8", bg: "rgba(148,163,184,0.12)" },
];

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];
const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ─── HELPERS ───────────────────────────────────────────────────────────────────
function snap(minutes) {
  return Math.round(minutes / SNAP_MIN) * SNAP_MIN;
}
function pxToMin(px) {
  return snap(Math.max(0, Math.min((px / HOUR_HEIGHT) * 60, (END_HOUR - START_HOUR) * 60)));
}
function minToPx(min) {
  return (min / 60) * HOUR_HEIGHT;
}
function formatTime(offsetMin) {
  const total = START_HOUR * 60 + offsetMin;
  const h = Math.floor(total / 60);
  const m = total % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12  = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}
function formatDur(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m}m`;
  if (!m) return `${h}h`;
  return `${h}h ${m}m`;
}
function toKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function sameDay(a, b) { return toKey(a) === toKey(b); }
function loadBlocks(date) {
  try { return JSON.parse(localStorage.getItem(`tl_${toKey(date)}`)) || []; }
  catch { return []; }
}
function saveBlocks(date, blocks) {
  localStorage.setItem(`tl_${toKey(date)}`, JSON.stringify(blocks));
}

// ─── MINI CALENDAR ────────────────────────────────────────────────────────────
function MiniCalendar({ value, onChange, onClose }) {
  const [view, setView] = useState(new Date(value.getFullYear(), value.getMonth(), 1));
  const yr   = view.getFullYear();
  const mo   = view.getMonth();
  const fd   = new Date(yr, mo, 1).getDay();        // first weekday
  const days = new Date(yr, mo + 1, 0).getDate();  // days in month
  const today = new Date();

  return (
    <div style={{
      position:"absolute", top:"calc(100% + 10px)", left:"50%",
      transform:"translateX(-50%)", zIndex:500,
      background:"#0D1627", border:"1px solid #1E3A5F",
      borderRadius:12, padding:18, width:252,
      boxShadow:"0 30px 70px rgba(0,0,0,0.85)"
    }}>
      {/* Month nav */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <CalNavBtn onClick={()=>setView(new Date(yr,mo-1,1))}>‹</CalNavBtn>
        <span style={{color:"#CBD5E1",fontSize:12,fontFamily:"'Space Mono',monospace",letterSpacing:1}}>
          {MONTH_NAMES[mo].toUpperCase().slice(0,3)} {yr}
        </span>
        <CalNavBtn onClick={()=>setView(new Date(yr,mo+1,1))}>›</CalNavBtn>
      </div>

      {/* Day headers */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:6}}>
        {["S","M","T","W","T","F","S"].map((d,i)=>(
          <div key={i} style={{textAlign:"center",fontSize:10,color:"#334155",fontFamily:"'Space Mono',monospace"}}>{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
        {Array(fd).fill(null).map((_,i)=><div key={`e${i}`}/>)}
        {Array.from({length:days},(_,i)=>i+1).map(d=>{
          const dt       = new Date(yr,mo,d);
          const isSel    = sameDay(dt, value);
          const isToday  = sameDay(dt, today);
          return (
            <button key={d} onClick={()=>{ onChange(dt); onClose(); }} style={{
              background : isSel ? "#3B82F6" : isToday ? "rgba(59,130,246,0.15)" : "transparent",
              border     : `1px solid ${isSel ? "#3B82F6" : isToday ? "rgba(59,130,246,0.4)" : "transparent"}`,
              borderRadius: 6, padding:"5px 0", textAlign:"center",
              color      : isSel ? "#fff" : isToday ? "#93C5FD" : "#94A3B8",
              fontSize: 12, cursor:"pointer", fontFamily:"'Space Mono',monospace"
            }}>{d}</button>
          );
        })}
      </div>
    </div>
  );
}
function CalNavBtn({ children, onClick }) {
  return (
    <button onClick={onClick} style={{
      background:"transparent",border:"none",color:"#475569",
      fontSize:20,cursor:"pointer",padding:"0 8px",lineHeight:1
    }}>{children}</button>
  );
}

// ─── BUCKET POPOVER ───────────────────────────────────────────────────────────
function BucketPopover({ range, onSelect, onCancel }) {
  return (
    <>
      <div onClick={onCancel} style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.4)"}}/>
      <div style={{
        position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",
        zIndex:201,background:"#0D1627",border:"1px solid #1E3A5F",
        borderRadius:14,padding:22,minWidth:290,
        boxShadow:"0 40px 100px rgba(0,0,0,0.95)"
      }}>
        <div style={{marginBottom:16}}>
          <div style={{color:"#475569",fontSize:10,letterSpacing:"0.12em",marginBottom:6}}>ASSIGN TIME BLOCK</div>
          <div style={{color:"#E2E8F0",fontFamily:"'Space Mono',monospace",fontSize:13}}>
            {formatTime(range.start)} – {formatTime(range.end)}
            <span style={{color:"#3B82F6",marginLeft:10}}>{formatDur(range.end - range.start)}</span>
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:7}}>
          {BUCKETS.map(b=>(
            <button key={b.id} onClick={()=>onSelect(b.id)} style={{
              background:b.bg, border:`1px solid ${b.color}25`,
              borderLeft:`3px solid ${b.color}`,
              borderRadius:8, padding:"10px 14px",
              cursor:"pointer", textAlign:"left",
              color:b.color, fontSize:12,
              fontFamily:"'Space Mono',monospace",
              transition:"background 0.12s, border-color 0.12s"
            }}
            onMouseEnter={e=>{e.currentTarget.style.background=b.bg.replace("0.12","0.22");e.currentTarget.style.borderColor=`${b.color}60`;}}
            onMouseLeave={e=>{e.currentTarget.style.background=b.bg;e.currentTarget.style.borderColor=`${b.color}25`;}}
            >{b.label}</button>
          ))}
        </div>
        <button onClick={onCancel} style={{
          marginTop:12,width:"100%",background:"transparent",
          border:"1px solid #1E293B",borderRadius:8,padding:9,
          color:"#334155",cursor:"pointer",fontSize:11,
          fontFamily:"'Space Mono',monospace"
        }}>Cancel</button>
      </div>
    </>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [date,    setDate]    = useState(new Date());
  const [blocks,  setBlocks]  = useState(() => loadBlocks(new Date()));
  const [showCal, setShowCal] = useState(false);
  const [drag,    setDrag]    = useState(null);    // {start,end} offset-minutes
  const [popover, setPopover] = useState(null);    // {start,end}
  const gridRef   = useRef(null);
  const dragging  = useRef(false);

  // Reload blocks when date changes
  useEffect(() => { setBlocks(loadBlocks(date)); setPopover(null); }, [date]);

  // Close calendar when clicking outside
  useEffect(() => {
    if (!showCal) return;
    const h = (e) => {
      if (!e.target.closest("[data-cal]")) setShowCal(false);
    };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, [showCal]);

  // ── Grid coordinate helper ──
  const gridMin = useCallback((clientY) => {
    if (!gridRef.current) return 0;
    const rect = gridRef.current.getBoundingClientRect();
    return pxToMin(clientY - rect.top);
  }, []);

  // ── Drag handlers ──
  const onGridMouseDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setPopover(null);
    const m = gridMin(e.clientY);
    dragging.current = true;
    setDrag({ start: m, end: m + SNAP_MIN });
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      const m = gridMin(e.clientY);
      setDrag(prev => prev ? { ...prev, end: Math.max(prev.start + SNAP_MIN, m) } : prev);
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      setDrag(prev => {
        if (prev && prev.end > prev.start) setPopover({ start: prev.start, end: prev.end });
        return null;
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [gridMin]);

  // ── Block actions ──
  const addBlock = (bucketId) => {
    if (!popover) return;
    const updated = [...blocks, { id: Date.now().toString(), start: popover.start, end: popover.end, bucket: bucketId }];
    setBlocks(updated);
    saveBlocks(date, updated);
    setPopover(null);
  };
  const deleteBlock = (id) => {
    const updated = blocks.filter(b => b.id !== id);
    setBlocks(updated);
    saveBlocks(date, updated);
  };

  // ── Date navigation ──
  const shiftDate = (days) => setDate(d => { const n=new Date(d); n.setDate(n.getDate()+days); return n; });

  // ── Summary ──
  const summary   = BUCKETS.map(b=>({ ...b, total: blocks.filter(bl=>bl.bucket===b.id).reduce((s,bl)=>s+(bl.end-bl.start),0) })).filter(b=>b.total>0);
  const totalMin  = blocks.reduce((s,b)=>s+(b.end-b.start),0);

  // ── Now-line ──
  const now = new Date();
  const nowOffset = sameDay(date, now) ? (now.getHours()-START_HOUR)*60+now.getMinutes() : null;

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  return (
    <div style={{ minHeight:"100vh", background:"#060B14", fontFamily:"'Space Mono',monospace", display:"flex", flexDirection:"column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Syne:wght@700;800&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        body { overflow:hidden; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-track { background:#060B14; }
        ::-webkit-scrollbar-thumb { background:#1E293B; border-radius:2px; }
        .time-block:hover .del-btn { opacity:1 !important; }
        .time-block:hover { filter: brightness(1.15); }
      `}</style>

      {/* ── HEADER ── */}
      <header style={{
        background:"#080E1C", borderBottom:"1px solid #111E35",
        padding:"0 28px", height:58,
        display:"flex", alignItems:"center", justifyContent:"space-between",
        flexShrink:0
      }}>
        {/* Logo */}
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:30,height:30,background:"linear-gradient(135deg,#3B82F6,#6366F1)",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>⧖</div>
          <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:17,color:"#F1F5F9",letterSpacing:-0.5}}>
            TIME<span style={{color:"#3B82F6"}}>LOG</span>
          </span>
        </div>

        {/* Date navigation */}
        <div style={{display:"flex",alignItems:"center",gap:8,position:"relative"}} data-cal>
          <HdrBtn onClick={()=>shiftDate(-1)}>←</HdrBtn>

          <button data-cal onClick={()=>setShowCal(v=>!v)} style={{
            background:"#0D1627",border:"1px solid #1E3A5F",borderRadius:8,
            padding:"7px 16px",color:"#CBD5E1",cursor:"pointer",
            fontSize:12,fontFamily:"'Space Mono',monospace",
            display:"flex",alignItems:"center",gap:10,
            transition:"border-color 0.2s"
          }}>
            <span style={{color:"#475569",fontSize:11}}>{DAY_NAMES[date.getDay()]}</span>
            {MONTH_NAMES[date.getMonth()]} {date.getDate()}, {date.getFullYear()}
            <span style={{color:"#334155",fontSize:9}}>▼</span>
          </button>

          <HdrBtn onClick={()=>shiftDate(1)}>→</HdrBtn>

          <button onClick={()=>setDate(new Date())} style={{
            background:"rgba(59,130,246,0.1)",border:"1px solid rgba(59,130,246,0.25)",
            borderRadius:8,padding:"7px 14px",color:"#60A5FA",
            cursor:"pointer",fontSize:11,fontFamily:"'Space Mono',monospace"
          }}>Today</button>

          {showCal && <MiniCalendar value={date} onChange={setDate} onClose={()=>setShowCal(false)}/>}
        </div>

        {/* Right spacer */}
        <div style={{width:160,display:"flex",justifyContent:"flex-end"}}>
          {totalMin > 0 && (
            <div style={{textAlign:"right"}}>
              <div style={{color:"#3B82F6",fontSize:15,fontWeight:700,fontFamily:"'Syne',sans-serif"}}>{formatDur(totalMin)}</div>
              <div style={{color:"#334155",fontSize:9,letterSpacing:"0.1em"}}>LOGGED TODAY</div>
            </div>
          )}
        </div>
      </header>

      {/* ── BODY ── */}
      <div style={{display:"flex",flex:1,overflow:"hidden"}}>

        {/* Grid area */}
        <div style={{flex:1,overflowY:"auto",paddingBottom:60}}>
          <div style={{display:"flex",paddingTop:24,paddingLeft:8}}>

            {/* Hour labels */}
            <div style={{width:72,flexShrink:0}}>
              {hours.map(h=>(
                <div key={h} style={{height:HOUR_HEIGHT,display:"flex",alignItems:"flex-start",justifyContent:"flex-end",paddingRight:14}}>
                  <span style={{fontSize:10,color:"#253351",fontFamily:"'Space Mono',monospace",transform:"translateY(-6px)"}}>
                    {h===12?"12 PM":h>12?`${h-12} PM`:`${h} AM`}
                  </span>
                </div>
              ))}
            </div>

            {/* Canvas */}
            <div style={{flex:1,paddingRight:28,position:"relative"}}>
              <div
                ref={gridRef}
                onMouseDown={onGridMouseDown}
                style={{
                  position:"relative",
                  height: HOUR_HEIGHT * (END_HOUR - START_HOUR),
                  background:"#080E1C",
                  border:"1px solid #111E35",
                  borderRadius:12,
                  overflow:"hidden",
                  cursor:"crosshair",
                  userSelect:"none"
                }}
              >
                {/* Grid lines */}
                {Array.from({length:END_HOUR-START_HOUR},(_,i)=>i+1).map(i=>(
                  <div key={i} style={{position:"absolute",top:i*HOUR_HEIGHT,left:0,right:0,borderTop:"1px solid #0D1A2E",pointerEvents:"none"}}/>
                ))}
                {Array.from({length:END_HOUR-START_HOUR},(_,i)=>i).map(i=>(
                  <div key={`h${i}`} style={{position:"absolute",top:i*HOUR_HEIGHT+HOUR_HEIGHT/2,left:0,right:0,borderTop:"1px dashed #0A1525",pointerEvents:"none"}}/>
                ))}

                {/* Blocks */}
                {blocks.map(b=>{
                  const bk = BUCKETS.find(x=>x.id===b.bucket);
                  if (!bk) return null;
                  const top = minToPx(b.start)+1;
                  const ht  = Math.max(minToPx(b.end-b.start)-2, 20);
                  return (
                    <div key={b.id} className="time-block" style={{
                      position:"absolute",top,height:ht,left:4,right:4,
                      background:bk.bg,
                      border:`1px solid ${bk.color}30`,
                      borderLeft:`3px solid ${bk.color}`,
                      borderRadius:7,padding:"4px 10px",
                      overflow:"hidden",zIndex:2,cursor:"default",
                      transition:"filter 0.1s"
                    }}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <span style={{fontSize:11,color:bk.color,fontWeight:700}}>{bk.short}</span>
                        <button
                          className="del-btn"
                          onClick={()=>deleteBlock(b.id)}
                          style={{opacity:0,background:"none",border:"none",color:"#EF4444",cursor:"pointer",fontSize:13,lineHeight:1,padding:"0 2px",transition:"opacity 0.15s"}}
                        >✕</button>
                      </div>
                      {ht > 32 && (
                        <div style={{fontSize:10,color:"#334155",marginTop:2}}>
                          {formatTime(b.start)} – {formatTime(b.end)} · {formatDur(b.end-b.start)}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Drag preview */}
                {drag && (
                  <div style={{
                    position:"absolute",
                    top:minToPx(drag.start)+1,
                    height:Math.max(minToPx(drag.end-drag.start)-2,20),
                    left:4,right:4,
                    background:"rgba(59,130,246,0.1)",
                    border:"1px dashed #3B82F6",
                    borderRadius:7,padding:"4px 10px",
                    pointerEvents:"none",zIndex:3
                  }}>
                    <div style={{fontSize:11,color:"#60A5FA"}}>
                      {formatTime(drag.start)} – {formatTime(drag.end)} · {formatDur(drag.end-drag.start)}
                    </div>
                  </div>
                )}

                {/* Now line */}
                {nowOffset !== null && nowOffset >= 0 && nowOffset <= (END_HOUR-START_HOUR)*60 && (
                  <div style={{position:"absolute",top:minToPx(nowOffset),left:0,right:0,zIndex:4,pointerEvents:"none"}}>
                    <div style={{position:"absolute",left:0,top:-4,width:8,height:8,background:"#F87171",borderRadius:"50%"}}/>
                    <div style={{borderTop:"1px solid #F87171",marginLeft:8}}/>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <aside style={{
          width:220,flexShrink:0,
          background:"#080E1C",borderLeft:"1px solid #111E35",
          padding:22,display:"flex",flexDirection:"column",gap:28,
          overflowY:"auto"
        }}>
          {/* Progress */}
          <div>
            <Label>Day Progress</Label>
            <div style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6}}>
                <span style={{color:"#E2E8F0",fontSize:20,fontFamily:"'Syne',sans-serif",fontWeight:700}}>
                  {formatDur(totalMin)}
                </span>
                <span style={{color:"#334155",fontSize:10}}>/ 8h</span>
              </div>
              <div style={{height:4,background:"#0D1627",borderRadius:2}}>
                <div style={{
                  height:"100%",
                  width:`${Math.min(100,(totalMin/WORKDAY_MIN)*100)}%`,
                  background: totalMin>=WORKDAY_MIN?"#34D399":"#3B82F6",
                  borderRadius:2,transition:"width 0.4s"
                }}/>
              </div>
              {totalMin===0 && <div style={{color:"#1E3A5F",fontSize:11,marginTop:10,fontStyle:"italic"}}>No entries yet.<br/>Drag on the grid to start.</div>}
            </div>
          </div>

          {/* Summary */}
          {summary.length > 0 && (
            <div>
              <Label>Breakdown</Label>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {summary.map(b=>(
                  <div key={b.id}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                      <span style={{color:b.color,fontSize:11}}>{b.short}</span>
                      <span style={{color:"#64748B",fontSize:11}}>{formatDur(b.total)}</span>
                    </div>
                    <div style={{height:3,background:"#0D1627",borderRadius:2}}>
                      <div style={{
                        height:"100%",width:`${Math.min(100,(b.total/WORKDAY_MIN)*100)}%`,
                        background:b.color,borderRadius:2,transition:"width 0.4s"
                      }}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Legend */}
          <div style={{marginTop:"auto"}}>
            <Label>Buckets</Label>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {BUCKETS.map(b=>(
                <div key={b.id} style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:8,height:8,background:b.color,borderRadius:2,flexShrink:0}}/>
                  <span style={{fontSize:10,color:"#334155",lineHeight:1.3}}>{b.label}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* Bucket selector popover */}
      {popover && <BucketPopover range={popover} onSelect={addBlock} onCancel={()=>setPopover(null)}/>}
    </div>
  );
}

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────
function HdrBtn({ children, onClick }) {
  return (
    <button onClick={onClick} style={{
      background:"#0D1627",border:"1px solid #1E3A5F",borderRadius:8,
      padding:"7px 13px",color:"#475569",cursor:"pointer",
      fontSize:14,fontFamily:"'Space Mono',monospace"
    }}>{children}</button>
  );
}
function Label({ children }) {
  return (
    <div style={{color:"#253351",fontSize:10,letterSpacing:"0.12em",marginBottom:12,textTransform:"uppercase"}}>
      {children}
    </div>
  );
}
