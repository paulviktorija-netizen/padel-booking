import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set, remove } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBUbkpUV2AaP1_R57TrnxcjFgvqYajda8g",
  authDomain: "padel-booking-a9fa2.firebaseapp.com",
  databaseURL: "https://padel-booking-a9fa2-default-rtdb.firebaseio.com",
  projectId: "padel-booking-a9fa2",
  storageBucket: "padel-booking-a9fa2.firebasestorage.app",
  messagingSenderId: "515938677517",
  appId: "1:515938677517:web:9c049074ac21876895f644",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const PHASES = ["Phase 1", "Phase 2", "Phase 3"];

function generateSlots() {
  const slots = [];
  let current = 9 * 60;
  const end = 22 * 60;
  while (current + 90 <= end) {
    const fmt = (min) => `${String(Math.floor(min/60)).padStart(2,"0")}:${String(min%60).padStart(2,"0")}`;
    slots.push({ id: current, label: `${fmt(current)} – ${fmt(current+90)}`, startMin: current });
    current += 90;
  }
  return slots;
}

const SLOTS = generateSlots();
const dateKey = (d) => d.toISOString().split("T")[0];
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
const isSameDay = (a, b) => a.toDateString() === b.toDateString();
const fmt2 = (n) => String(n).padStart(2,"0");

function formatDateEN(date) {
  return date.toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" });
}

function canBook(slotStartMin, slotDate, now) {
  const slotDT = new Date(slotDate);
  slotDT.setHours(Math.floor(slotStartMin/60), slotStartMin%60, 0, 0);
  if (slotDT <= now) return { ok:false, reason:"past" };
  const earliest = new Date(slotDT.getTime() - 24*60*60*1000);
  if (now < earliest) return { ok:false, reason:"tooEarly", earliest };
  return { ok:true };
}

const emptyPlayers = () => [{first:"",last:""},{first:"",last:""},{first:"",last:""},{first:"",last:""}];

const navBtn = {
  background:"rgba(255,255,255,0.06)", border:"1.5px solid rgba(255,255,255,0.1)",
  color:"#e2e8f0", borderRadius:9, width:36, height:36, cursor:"pointer",
  fontSize:18, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center",
};
const labelStyle = {
  fontSize:10.5, color:"#475569", fontWeight:700, textTransform:"uppercase",
  letterSpacing:"0.5px", display:"block", marginBottom:5,
};
const errTxt = { margin:"3px 0 0", fontSize:10.5, color:"#f87171", fontWeight:500 };
const inputBase = {
  background:"rgba(255,255,255,0.06)", border:"1.5px solid rgba(255,255,255,0.1)",
  borderRadius:10, padding:"10px 12px", color:"#e2e8f0", fontSize:14, fontWeight:500,
  outline:"none", width:"100%", boxSizing:"border-box", transition:"border-color 0.15s", fontFamily:"inherit",
};

export default function App() {
  const [now, setNow] = useState(new Date());
  const today = new Date(); today.setHours(0,0,0,0);

  const [selectedDate, setSelectedDate] = useState(today);
  const [bookings, setBookings] = useState({});
  const [weekOffset, setWeekOffset] = useState(0);
  const [connected, setConnected] = useState(false);
  const [modal, setModal] = useState(null);
  const [players, setPlayers] = useState(emptyPlayers());
  const [phase, setPhase] = useState("");
  const [unit, setUnit] = useState("");
  const [errors, setErrors] = useState({});
  const [cancelTarget, setCancelTarget] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const bookingsRef = ref(db, "bookings");
    const unsub = onValue(bookingsRef, (snapshot) => {
      setBookings(snapshot.val() || {});
      setConnected(true);
    }, () => setConnected(false));
    return () => unsub();
  }, []);

  const weekStart = (() => {
    const d = new Date(today);
    d.setDate(d.getDate() + weekOffset*7);
    const day = d.getDay();
    d.setDate(d.getDate() + (day===0 ? -6 : 1-day));
    return d;
  })();
  const weekDays = Array.from({length:7}, (_,i) => addDays(weekStart, i));

  function showToast(msg, type="success") {
    setToast({msg, type});
    setTimeout(() => setToast(null), 4000);
  }

  function getBooking(date, slotId) { return bookings[dateKey(date)]?.[slotId] || null; }

  function getSlotState(slot, date) {
    const booking = getBooking(date, slot.id);
    if (booking) return {status:"booked", booking};
    const check = canBook(slot.startMin, date, now);
    if (check.reason==="past") return {status:"past"};
    if (check.reason==="tooEarly") return {status:"locked", earliest:check.earliest};
    return {status:"free"};
  }

  function openBookModal(slot) {
    const check = canBook(slot.startMin, selectedDate, now);
    if (!check.ok) {
      if (check.reason==="past") { showToast("This slot has already passed.", "error"); return; }
      const e = check.earliest;
      showToast(`Booking opens ${e.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})} at ${fmt2(e.getHours())}:${fmt2(e.getMinutes())}.`, "error");
      return;
    }
    setPlayers(emptyPlayers()); setPhase(""); setUnit(""); setErrors({});
    setModal({slot, date:selectedDate});
  }

  function validate() {
    const errs = {};
    let allFilled = true;
    players.forEach((p,i) => {
      if (!p.first.trim()) { errs[`p${i}f`]=true; allFilled=false; }
      if (!p.last.trim()) { errs[`p${i}l`]=true; allFilled=false; }
    });
    if (!allFilled) errs.playersMsg="All 4 players (first & last name) are required.";
    if (!phase) errs.phase=true;
    if (!unit.trim()) errs.unit=true;
    return errs;
  }

  async function confirmBooking() {
    const errs = validate();
    if (Object.keys(errs).length>0) { setErrors(errs); return; }
    const key = dateKey(modal.date);
    await set(ref(db, `bookings/${key}/${modal.slot.id}`), {
      players: players.map(p => `${p.first.trim()} ${p.last.trim()}`),
      phase, unit: unit.trim().toUpperCase(),
      slotLabel: modal.slot.label,
      bookedAt: new Date().toISOString(),
    });
    setModal(null);
    showToast("Booking confirmed! 🎾");
  }

  async function cancelBooking() {
    const {date, slotId} = cancelTarget;
    await remove(ref(db, `bookings/${dateKey(date)}/${slotId}`));
    setCancelTarget(null);
    showToast("Booking cancelled.", "error");
  }

  return (
    <div style={{
      minHeight:"100vh",
      background:"linear-gradient(160deg, #060d18 0%, #0b1d2e 60%, #06120d 100%)",
      fontFamily:"'DM Sans', 'Segoe UI', sans-serif",
      color:"#e2e8f0", paddingBottom:80,
    }}>
      {/* Header */}
      <div style={{
        padding:"26px 20px 16px", background:"rgba(0,0,0,0.3)",
        borderBottom:"1px solid rgba(74,222,128,0.12)", backdropFilter:"blur(10px)",
        position:"sticky", top:0, zIndex:10,
      }}>
        <div style={{display:"flex", alignItems:"center", gap:13, maxWidth:600, margin:"0 auto"}}>
          <div style={{
            width:46, height:46, borderRadius:13,
            background:"linear-gradient(135deg, #4ade80, #16a34a)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:22, boxShadow:"0 0 22px rgba(74,222,128,0.35)", flexShrink:0,
          }}>🎾</div>
          <div style={{flex:1}}>
            <h1 style={{margin:0, fontSize:20, fontWeight:800, color:"#fff", letterSpacing:"-0.4px"}}>
              Padel Court Booking
            </h1>
            <p style={{margin:0, fontSize:10.5, color:"#4ade80", fontWeight:600, letterSpacing:"0.8px", textTransform:"uppercase"}}>
              Residence · 1 court · 1h30 per session
            </p>
          </div>
          <div style={{
            width:8, height:8, borderRadius:"50%",
            background:connected ? "#4ade80" : "#ef4444",
            boxShadow:connected ? "0 0 8px #4ade80" : "0 0 8px #ef4444",
          }} title={connected ? "Live" : "Connecting..."} />
        </div>
      </div>

      <div style={{maxWidth:600, margin:"0 auto", padding:"0 14px"}}>
        {/* Week nav */}
        <div style={{padding:"18px 0 6px"}}>
          <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:13}}>
            <button onClick={() => setWeekOffset(w=>w-1)} style={navBtn}>‹</button>
            <span style={{fontWeight:700, fontSize:13, color:"#86efac"}}>
              {weekStart.toLocaleDateString("en-US",{month:"short",day:"numeric"})} –{" "}
              {addDays(weekStart,6).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
            </span>
            <button onClick={() => setWeekOffset(w=>w+1)} style={navBtn}>›</button>
          </div>
          <div style={{display:"flex", gap:6, overflowX:"auto", paddingBottom:4}}>
            {weekDays.map(day => {
              const isSel = isSameDay(day, selectedDate);
              const isTod = isSameDay(day, today);
              const isPast = day < today;
              const hasBkg = Object.keys(bookings[dateKey(day)]||{}).length>0;
              return (
                <button key={day.toISOString()} onClick={() => setSelectedDate(day)} style={{
                  flex:"0 0 auto", minWidth:50, padding:"9px 6px", borderRadius:13,
                  border:isSel ? "2px solid #4ade80" : "2px solid rgba(255,255,255,0.07)",
                  background:isSel ? "rgba(74,222,128,0.14)" : isPast ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.05)",
                  cursor:"pointer", textAlign:"center", opacity:isPast?0.45:1, transition:"all 0.16s",
                }}>
                  <div style={{fontSize:9, color:isSel?"#4ade80":"#475569", fontWeight:700, textTransform:"uppercase", marginBottom:3}}>
                    {day.toLocaleDateString("en-US",{weekday:"short"}).slice(0,3)}
                  </div>
                  <div style={{fontSize:17, fontWeight:800, color:isSel?"#fff":isTod?"#4ade80":"#cbd5e1"}}>
                    {day.getDate()}
                  </div>
                  {hasBkg && <div style={{width:5,height:5,borderRadius:"50%",background:"#4ade80",margin:"3px auto 0",boxShadow:"0 0 5px #4ade80"}}/>}
                </button>
              );
            })}
          </div>
        </div>

        <p style={{margin:"6px 0 10px", fontSize:12, color:"#334155", fontWeight:500}}>
          {formatDateEN(selectedDate)}
        </p>

        {/* Slots */}
        <div style={{display:"flex", flexDirection:"column", gap:8}}>
          {SLOTS.map(slot => {
            const {status, booking, earliest} = getSlotState(slot, selectedDate);
            return (
              <div key={slot.id} style={{
                borderRadius:14,
                border:status==="booked" ? "1.5px solid rgba(74,222,128,0.28)"
                  : status==="locked" ? "1.5px solid rgba(234,179,8,0.2)"
                  : status==="past" ? "1.5px solid rgba(255,255,255,0.04)"
                  : "1.5px solid rgba(255,255,255,0.1)",
                background:status==="booked" ? "rgba(74,222,128,0.08)"
                  : status==="locked" ? "rgba(234,179,8,0.04)"
                  : status==="past" ? "rgba(255,255,255,0.02)"
                  : "rgba(255,255,255,0.05)",
                padding:"14px 16px", opacity:status==="past"?0.38:1,
              }}>
                <div style={{display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:10}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700, fontSize:15, color:status==="past"?"#334155":"#e2e8f0"}}>
                      {slot.label}
                    </div>
                    {status==="booked" && (
                      <div style={{marginTop:7}}>
                        <div style={{fontSize:10.5, color:"#4ade80", marginBottom:5, fontWeight:700, letterSpacing:"0.4px", textTransform:"uppercase"}}>
                          {booking.phase} · Unit {booking.unit}
                        </div>
                        <div style={{display:"flex", flexWrap:"wrap", gap:4}}>
                          {booking.players.map((p,i) => (
                            <span key={i} style={{
                              background:"rgba(74,222,128,0.12)", border:"1px solid rgba(74,222,128,0.25)",
                              color:"#86efac", borderRadius:20, padding:"2px 10px", fontSize:11.5, fontWeight:600,
                            }}>{p}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {status==="locked" && earliest && (
                      <div style={{fontSize:10.5, color:"#a16207", marginTop:4, fontWeight:500}}>
                        ⏳ Opens {earliest.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})} at {fmt2(earliest.getHours())}:{fmt2(earliest.getMinutes())}
                      </div>
                    )}
                  </div>
                  <div style={{flexShrink:0, paddingTop:2}}>
                    {status==="free" && (
                      <button onClick={() => openBookModal(slot)} style={{
                        background:"linear-gradient(135deg, #4ade80, #16a34a)",
                        border:"none", color:"#052e16", fontWeight:800, fontSize:13,
                        padding:"9px 18px", borderRadius:10, cursor:"pointer",
                        boxShadow:"0 3px 14px rgba(74,222,128,0.3)",
                      }}>Book</button>
                    )}
                    {status==="booked" && (
                      <button onClick={() => setCancelTarget({date:selectedDate, slotId:slot.id})} style={{
                        background:"rgba(239,68,68,0.09)", border:"1px solid rgba(239,68,68,0.28)",
                        color:"#f87171", fontWeight:700, fontSize:12,
                        padding:"8px 13px", borderRadius:10, cursor:"pointer",
                      }}>Cancel</button>
                    )}
                    {status==="locked" && <span style={{fontSize:20}}>🔒</span>}
                    {status==="past" && <span style={{fontSize:10.5, color:"#1e293b"}}>Past</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Booking modal */}
      {modal && (
        <div style={{
          position:"fixed", inset:0, background:"rgba(0,0,0,0.82)",
          display:"flex", alignItems:"flex-end", justifyContent:"center",
          zIndex:100, backdropFilter:"blur(8px)",
        }} onClick={e => e.target===e.currentTarget && setModal(null)}>
          <div style={{
            background:"linear-gradient(180deg, #0c1e32, #060d18)",
            border:"1px solid rgba(74,222,128,0.16)",
            borderRadius:"22px 22px 0 0",
            padding:"22px 20px 50px", width:"100%", maxWidth:600,
            boxShadow:"0 -20px 60px rgba(0,0,0,0.7)",
            maxHeight:"94vh", overflowY:"auto",
          }}>
            <div style={{width:36,height:4,borderRadius:2,background:"rgba(255,255,255,0.15)",margin:"0 auto 22px"}}/>
            <h2 style={{margin:"0 0 3px", fontWeight:800, fontSize:19, color:"#fff"}}>Reserve the Court</h2>
            <p style={{margin:"0 0 22px", color:"#4ade80", fontSize:13, fontWeight:600}}>
              🎾 {modal.slot.label} · {modal.date.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}
            </p>
            <div style={{display:"flex", gap:10, marginBottom:18}}>
              <div style={{flex:1}}>
                <label style={labelStyle}>Phase</label>
                <select value={phase} onChange={e=>{setPhase(e.target.value);setErrors(er=>({...er,phase:false}));}}
                  style={{...inputBase, borderColor:errors.phase?"#ef4444":"rgba(255,255,255,0.1)", cursor:"pointer", appearance:"none", color:phase?"#e2e8f0":"#475569"}}>
                  <option value="" disabled>Select…</option>
                  {PHASES.map(p=><option key={p} value={p} style={{background:"#0c1e32"}}>{p}</option>)}
                </select>
                {errors.phase && <p style={errTxt}>Required</p>}
              </div>
              <div style={{flex:1}}>
                <label style={labelStyle}>Unit number</label>
                <input value={unit} placeholder="e.g. C107"
                  onChange={e=>{setUnit(e.target.value);setErrors(er=>({...er,unit:false}));}}
                  style={{...inputBase, borderColor:errors.unit?"#ef4444":"rgba(255,255,255,0.1)"}}
                  onFocus={e=>e.target.style.borderColor="#4ade80"}
                  onBlur={e=>e.target.style.borderColor=errors.unit?"#ef4444":"rgba(255,255,255,0.1)"}
                />
                {errors.unit && <p style={errTxt}>Required</p>}
              </div>
            </div>
            <label style={{...labelStyle, display:"block", marginBottom:8}}>Players — all 4 required</label>
            {errors.playersMsg && <p style={{...errTxt, marginBottom:10}}>{errors.playersMsg}</p>}
            <div style={{display:"flex", flexDirection:"column", gap:9, marginBottom:24}}>
              {[0,1,2,3].map(i=>(
                <div key={i} style={{display:"flex", gap:8, alignItems:"center"}}>
                  <span style={{fontSize:11, color:"#4ade80", fontWeight:700, minWidth:18, textAlign:"right"}}>{i+1}</span>
                  <input placeholder="First name" value={players[i].first}
                    onChange={e=>{const u=[...players];u[i]={...u[i],first:e.target.value};setPlayers(u);setErrors(er=>({...er,[`p${i}f`]:false,playersMsg:null}));}}
                    style={{...inputBase, flex:1, borderColor:errors[`p${i}f`]?"#ef4444":"rgba(255,255,255,0.1)"}}
                    onFocus={e=>e.target.style.borderColor="#4ade80"}
                    onBlur={e=>e.target.style.borderColor=errors[`p${i}f`]?"#ef4444":"rgba(255,255,255,0.1)"}
                  />
                  <input placeholder="Last name" value={players[i].last}
                    onChange={e=>{const u=[...players];u[i]={...u[i],last:e.target.value};setPlayers(u);setErrors(er=>({...er,[`p${i}l`]:false,playersMsg:null}));}}
                    style={{...inputBase, flex:1, borderColor:errors[`p${i}l`]?"#ef4444":"rgba(255,255,255,0.1)"}}
                    onFocus={e=>e.target.style.borderColor="#4ade80"}
                    onBlur={e=>e.target.style.borderColor=errors[`p${i}l`]?"#ef4444":"rgba(255,255,255,0.1)"}
                  />
                </div>
              ))}
            </div>
            <div style={{display:"flex", gap:10}}>
              <button onClick={()=>setModal(null)} style={{
                flex:1, padding:"14px", borderRadius:13,
                border:"1.5px solid rgba(255,255,255,0.1)",
                background:"transparent", color:"#64748b",
                fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"inherit",
              }}>Cancel</button>
              <button onClick={confirmBooking} style={{
                flex:2, padding:"14px", borderRadius:13,
                background:"linear-gradient(135deg, #4ade80, #16a34a)",
                border:"none", color:"#052e16",
                fontWeight:800, fontSize:14, cursor:"pointer", fontFamily:"inherit",
                boxShadow:"0 4px 18px rgba(74,222,128,0.35)",
              }}>Confirm Booking</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel confirm */}
      {cancelTarget && (
        <div style={{
          position:"fixed", inset:0, background:"rgba(0,0,0,0.82)",
          display:"flex", alignItems:"center", justifyContent:"center",
          zIndex:100, backdropFilter:"blur(8px)", padding:20,
        }}>
          <div style={{
            background:"linear-gradient(180deg, #1c0909, #060d18)",
            border:"1px solid rgba(239,68,68,0.3)",
            borderRadius:18, padding:28, maxWidth:320, width:"100%",
          }}>
            <div style={{fontSize:32, textAlign:"center", marginBottom:10}}>⚠️</div>
            <h3 style={{margin:"0 0 6px", fontWeight:800, textAlign:"center", color:"#fff", fontSize:17}}>Cancel this booking?</h3>
            <p style={{margin:"0 0 22px", color:"#64748b", fontSize:13, textAlign:"center"}}>This action cannot be undone.</p>
            <div style={{display:"flex", gap:10}}>
              <button onClick={()=>setCancelTarget(null)} style={{
                flex:1, padding:"12px", borderRadius:11,
                border:"1.5px solid rgba(255,255,255,0.1)",
                background:"transparent", color:"#64748b",
                fontWeight:700, cursor:"pointer", fontFamily:"inherit",
              }}>Keep it</button>
              <button onClick={cancelBooking} style={{
                flex:1, padding:"12px", borderRadius:11,
                background:"linear-gradient(135deg, #ef4444, #b91c1c)",
                border:"none", color:"#fff", fontWeight:800, cursor:"pointer", fontFamily:"inherit",
              }}>Yes, cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position:"fixed", bottom:28, left:"50%", transform:"translateX(-50%)",
          background:toast.type==="error" ? "linear-gradient(135deg, #7f1d1d, #3b0a0a)" : "linear-gradient(135deg, #14532d, #052e16)",
          border:`1px solid ${toast.type==="error" ? "rgba(239,68,68,0.4)" : "rgba(74,222,128,0.4)"}`,
          color:toast.type==="error" ? "#fca5a5" : "#86efac",
          padding:"12px 22px", borderRadius:13, fontWeight:700, fontSize:13.5,
          zIndex:200, whiteSpace:"nowrap", boxShadow:"0 8px 30px rgba(0,0,0,0.5)",
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
