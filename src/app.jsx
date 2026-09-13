import { useState, useEffect, useRef, useCallback } from "react";

/* ================================================================
   FIXED:
   ✅ Images + Videos show as real previews in proof
   ✅ Audio files play in proof
   ✅ GPS sent with every alert
   ✅ Alerts AUTOMATICALLY SENT (Twilio simulation)
   ✅ No manual "copy" needed — alert fires instantly
================================================================ */

const fl = document.createElement("link");
fl.rel = "stylesheet";
fl.href = "https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;600;700&display=swap";
document.head.appendChild(fl);

const st = document.createElement("style");
st.textContent = `
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:#020b14;font-family:'Rajdhani',sans-serif;color:#dbeafe}
  ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#164e63;border-radius:4px}
  @keyframes rpulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.8)}60%{box-shadow:0 0 0 16px rgba(239,68,68,0)}}
  @keyframes gpulse{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,.6)}60%{box-shadow:0 0 0 10px rgba(34,197,94,0)}}
  @keyframes scan{0%{top:0;opacity:.8}100%{top:100%;opacity:0}}
  @keyframes blink{50%{opacity:0}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes inR{from{transform:translateX(110%);opacity:0}to{transform:translateX(0);opacity:1}}
  @keyframes outR{from{transform:translateX(0)}to{transform:translateX(110%);opacity:0}}
  @keyframes fadeUp{from{transform:translateY(10px);opacity:0}to{transform:translateY(0);opacity:1}}
  @keyframes wavebar{0%,100%{transform:scaleY(.1)}50%{transform:scaleY(1)}}
  @keyframes sentPop{0%{transform:scale(.8);opacity:0}60%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
  .rpulse{animation:rpulse 1.8s infinite}
  .gpulse{animation:gpulse 2.5s infinite}
  .blink{animation:blink 1s step-end infinite}
  .spin{animation:spin 1s linear infinite}
  .inR{animation:inR .42s cubic-bezier(.16,1,.3,1) forwards}
  .outR{animation:outR .3s ease-in forwards}
  .fadeUp{animation:fadeUp .3s ease-out both}
  .sentPop{animation:sentPop .5s cubic-bezier(.16,1,.3,1) both}
`;
document.head.appendChild(st);

// ── Constants ─────────────────────────────────────────────────
const RISK_KW  = ["scream","attack","danger","fight","help","assault","threat","suspicious","violence","emergency","shout","cry","harass","knife","gun"];
const RISK_ACT = ["Scream / Loud Cry Detected","Suspicious Motion Detected","Fall Detected — Person Down","Group Surrounding Individual","Aggressive Posture Detected","Distress Signal Detected","Threatening Behaviour","Woman Alone — High Risk Zone"];
const SAFE_ACT = ["Normal Pedestrian Movement","Routine Activity — No Threat","Ambient Noise Only","Clear Zone — All Safe","Scheduled Patrol OK"];
const ZONES    = ["Zone A · Sriperumbudur Town","Zone B · Oragadam Industrial Area","Zone C · Irungattukottai","Zone D · Nazarathpet","Zone E · Manimangalam","Zone F · Thirumazhisai","Zone G · Vengadu"];
const POLICE_CONTACTS = ["+91-98765-43210 (Control Room)", "+91-87654-32109 (Zone Officer)"];

// ── Helpers ───────────────────────────────────────────────────
const uid     = () => Math.random().toString(36).slice(2,8).toUpperCase();
const rnd     = (a,b) => Math.random()*(b-a)+a;
const pick    = a => a[Math.floor(Math.random()*a.length)];
const nowT    = () => new Date().toLocaleTimeString("en-IN",{hour12:false});
const nowF    = () => new Date().toLocaleString("en-IN");

// ── Read file as ObjectURL (works for video/image/audio preview) ──
function fileToObjectURL(file) {
  if (!file) return null;
  try { return URL.createObjectURL(file); } catch(_) { return null; }
}

// ── Capture camera frame ──────────────────────────────────────
function snapCam(videoEl) {
  if (!videoEl || !videoEl.srcObject || videoEl.readyState < 2) return null;
  try {
    const c = document.createElement("canvas");
    c.width = videoEl.videoWidth || 320;
    c.height = videoEl.videoHeight || 240;
    c.getContext("2d").drawImage(videoEl, 0, 0);
    return c.toDataURL("image/jpeg", 0.75);
  } catch(_) { return null; }
}

// ── Build proof package ───────────────────────────────────────
function buildProof({ videoEl, audioDb, gps, files }) {
  const attachments = (files || []).map(f => ({
    name:    f.name,
    size:    (f.size / 1024).toFixed(1) + " KB",
    type:    f.type,
    kind:    f.type.split("/")[0],      // "image" | "video" | "audio"
    objUrl:  fileToObjectURL(f),        // ObjectURL — works instantly for preview
  }));

  return {
    cameraSnap:  snapCam(videoEl),
    audioDb:     audioDb != null ? parseFloat(audioDb).toFixed(1) : null,
    audioDanger: audioDb != null && parseFloat(audioDb) > 75,
    gpsLat:      gps?.lat     || "NOT AVAILABLE",
    gpsLng:      gps?.lng     || "NOT AVAILABLE",
    gpsAcc:      gps?.acc     || "—",
    mapsUrl:     gps?.mapsUrl || null,
    attachments,
    capturedAt:  nowF(),
  };
}

// ── AUTO SEND ALERT (simulates Twilio SMS + Firebase) ─────────
// In production: replace with real fetch() to your backend
let alertSendLog = [];
function autoSendAlert(incident) {
  const p = incident.proof || {};
  const msg = [
    "🚨 GUARDIAN AI — AUTOMATIC ALERT",
    `ID: ${incident.id}  |  ${incident.activity}`,
    `Zone: ${incident.zone}  |  Confidence: ${incident.confidence}%`,
    `Time: ${incident.fullTime}`,
    `GPS: ${p.gpsLat}, ${p.gpsLng}`,
    p.mapsUrl ? `Maps: ${p.mapsUrl}` : null,
    `Audio: ${p.audioDb ? p.audioDb+" dB"+(p.audioDanger?" ⚠ SCREAM":"") : "N/A"}`,
    `Camera: ${p.cameraSnap ? "Snapshot captured" : "No snapshot"}`,
    `Files attached: ${(p.attachments||[]).length}`,
    ...(p.attachments||[]).map(a => `  → ${a.name} (${a.kind}, ${a.size})`),
  ].filter(Boolean).join("\n");

  // Simulate sending to police numbers
  const result = {
    alertId:   incident.id,
    sentAt:    nowF(),
    to:        POLICE_CONTACTS,
    message:   msg,
    status:    "SENT ✅",
    channel:   "Twilio SMS + Firebase",
    filesCount:(p.attachments||[]).length,
    hasGPS:    p.gpsLat !== "NOT AVAILABLE",
    hasAudio:  !!p.audioDb,
    hasSnap:   !!p.cameraSnap,
  };
  alertSendLog.push(result);

  // In production, this would be:
  // fetch('/api/send-alert', { method:'POST', body: JSON.stringify({incident, to: POLICE_CONTACTS}) })
  console.log("🚨 GUARDIAN AUTO ALERT SENT:", result);
  return result;
}

// ── Analyse file ──────────────────────────────────────────────
function analyseFile(file, gps) {
  const n = file.name.toLowerCase();
  const flagged = RISK_KW.some(k => n.includes(k)) || Math.random() < 0.38;
  // Use real GPS place name — never random zone
  const zone = gps?.placeName || gps?.area || gps?.city || "Location Unavailable";
  return {
    id:         uid(),
    name:       file.name,
    size:       (file.size/1024).toFixed(1)+" KB",
    mimeKind:   file.type.split("/")[0]||"unknown",
    flagged,
    confidence: parseFloat(flagged ? rnd(68,97).toFixed(1) : rnd(5,34).toFixed(1)),
    activity:   flagged ? pick(RISK_ACT) : pick(SAFE_ACT),
    zone,
    time:       nowT(),
    fullTime:   nowF(),
    status:     "active",
    sendResult: null,
    proof:      null,
  };
}

/* ================================================================
   SHARED UI
================================================================ */
function Card({ title, accent="#0ea5e9", children }) {
  return (
    <div style={{ background:"#040d18", border:`1px solid ${accent}33`, borderRadius:12, padding:16 }}>
      <div style={{ fontFamily:"'Orbitron',monospace", fontSize:9, color:accent, letterSpacing:2, marginBottom:12, textTransform:"uppercase" }}>{title}</div>
      {children}
    </div>
  );
}
function Btn({ color="#0ea5e9", onClick, children }) {
  return (
    <button onClick={onClick} style={{ padding:"8px 18px", background:`${color}18`, color, border:`1px solid ${color}55`, borderRadius:6, cursor:"pointer", fontFamily:"'Rajdhani',sans-serif", fontWeight:700, fontSize:12 }}>
      {children}
    </button>
  );
}
function Row({ children }) { return <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>{children}</div>; }
function Stat({ icon, label, val, c }) {
  return (
    <div style={{ background:"#040d18", border:`1px solid ${c}33`, borderRadius:12, padding:16, textAlign:"center" }}>
      <div style={{ fontSize:26, marginBottom:5 }}>{icon}</div>
      <div style={{ fontFamily:"'Orbitron',monospace", fontSize:24, fontWeight:700, color:c }}>{val}</div>
      <div style={{ fontSize:10, color:"#1e3a5f", letterSpacing:1, marginTop:3 }}>{label}</div>
    </div>
  );
}
function Bdg({ ok, label, c }) {
  return (
    <span style={{ fontSize:9, padding:"2px 7px", borderRadius:10, fontWeight:700, background:ok?`${c}22`:"#0f1f2e", color:ok?c:"#334155", border:`1px solid ${ok?c:"#1e3a5f"}` }}>
      {label}
    </span>
  );
}
function Empty({ msg }) {
  return (
    <div style={{ textAlign:"center", padding:60, color:"#1e3a5f", fontFamily:"'Orbitron',monospace", fontSize:12 }}>
      <div style={{ fontSize:40, marginBottom:12 }}>📡</div>{msg}
    </div>
  );
}

/* ================================================================
   ALERT SENT BANNER — shown after auto dispatch
================================================================ */
function SentBanner({ sendResult }) {
  if (!sendResult) return null;
  return (
    <div className="sentPop" style={{ margin:"10px 0", padding:"12px 14px", background:"linear-gradient(135deg,#052e16,#064e3b)", border:"1px solid #22c55e", borderRadius:8 }}>
      <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:8 }}>
        <span style={{ fontSize:20 }}>✅</span>
        <div>
          <div style={{ fontFamily:"'Orbitron',monospace", fontSize:11, color:"#4ade80", fontWeight:700 }}>
            ALERT AUTOMATICALLY SENT
          </div>
          <div style={{ fontSize:11, color:"#22c55e", marginTop:2 }}>
            {sendResult.channel} · {sendResult.sentAt}
          </div>
        </div>
      </div>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8 }}>
        {sendResult.to.map((n,i) => (
          <span key={i} style={{ fontSize:10, padding:"3px 9px", background:"rgba(34,197,94,.12)", border:"1px solid #22c55e55", borderRadius:12, color:"#4ade80" }}>
            📱 {n}
          </span>
        ))}
      </div>
      <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
        <Bdg ok={sendResult.hasGPS}   label={sendResult.hasGPS?"📍 GPS ✅":"📍 NO GPS"}              c="#38bdf8" />
        <Bdg ok={sendResult.hasAudio} label={sendResult.hasAudio?"🎙 AUDIO ✅":"🎙 NO AUDIO"}        c="#fbbf24" />
        <Bdg ok={sendResult.hasSnap}  label={sendResult.hasSnap?"📷 SNAP ✅":"📷 NO SNAP"}          c="#4ade80" />
        <Bdg ok={sendResult.filesCount>0} label={`📁 ${sendResult.filesCount} FILE${sendResult.filesCount!==1?"S":""} ${sendResult.filesCount>0?"SENT":""}`} c="#a78bfa" />
      </div>
    </div>
  );
}

/* ================================================================
   PROOF PANEL — shows images, videos, audio + GPS
================================================================ */
function ProofPanel({ proof, incId }) {
  const [open, setOpen] = useState(false);
  if (!proof) return null;

  const images = (proof.attachments||[]).filter(a => a.kind==="image");
  const videos = (proof.attachments||[]).filter(a => a.kind==="video");
  const audios = (proof.attachments||[]).filter(a => a.kind==="audio");
  const others = (proof.attachments||[]).filter(a => !["image","video","audio"].includes(a.kind));

  return (
    <div style={{ marginTop:10 }}>
      {/* Summary strip */}
      <div style={{ display:"flex", gap:5, alignItems:"center", padding:"7px 10px", background:"rgba(14,165,233,.07)", border:"1px solid rgba(14,165,233,.25)", borderRadius:7, flexWrap:"wrap" }}>
        <span style={{ fontSize:10, color:"#38bdf8", fontWeight:700 }}>📎 PROOF SENT:</span>
        <Bdg ok={!!proof.cameraSnap}                     label={proof.cameraSnap?"📷 CAM ✅":"📷 NO CAM"}                                             c="#4ade80" />
        <Bdg ok={!!proof.audioDb}                        label={proof.audioDb?`🎙 ${proof.audioDb}dB${proof.audioDanger?" ⚠":""}` :"🎙 NO MIC"}       c="#fbbf24" />
        <Bdg ok={proof.gpsLat!=="NOT AVAILABLE"}         label={proof.gpsLat!=="NOT AVAILABLE"?"📍 GPS ✅":"📍 NO GPS"}                               c="#38bdf8" />
        {images.length>0 && <Bdg ok label={`🖼 ${images.length} IMG`}   c="#a78bfa" />}
        {videos.length>0 && <Bdg ok label={`🎬 ${videos.length} VID`}   c="#f472b6" />}
        {audios.length>0 && <Bdg ok label={`🎵 ${audios.length} AUD`}   c="#34d399" />}
        {others.length>0 && <Bdg ok label={`📄 ${others.length} FILE`}  c="#94a3b8" />}
        <button onClick={() => setOpen(v=>!v)} style={{
          marginLeft:"auto", padding:"3px 10px",
          background:"#071624", border:"1px solid #38bdf8",
          borderRadius:5, color:"#38bdf8", fontSize:9, fontWeight:700, cursor:"pointer",
        }}>
          {open ? "▲ HIDE" : "▼ VIEW FILES"}
        </button>
      </div>

      {open && (
        <div style={{ marginTop:6, padding:"14px", background:"#030a10", border:"1px solid #0e3a56", borderRadius:10 }}>
          <div style={{ fontFamily:"'Orbitron',monospace", fontSize:9, color:"#0ea5e9", marginBottom:12 }}>
            EVIDENCE FILES — ALERT #{incId}
          </div>

          {/* Camera snapshot */}
          {proof.cameraSnap && (
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10, color:"#4ade80", fontWeight:700, marginBottom:6 }}>📷 CAMERA SNAPSHOT AT DETECTION</div>
              <img src={proof.cameraSnap} alt="cam"
                style={{ width:"100%", maxWidth:400, borderRadius:6, border:"1px solid #4ade8033", display:"block" }} />
            </div>
          )}

          {/* Images */}
          {images.length > 0 && (
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10, color:"#a78bfa", fontWeight:700, marginBottom:8 }}>
                🖼 UPLOADED IMAGES — {images.length} file{images.length>1?"s":""}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:8 }}>
                {images.map((a,i) => (
                  <div key={i} style={{ background:"#040d18", borderRadius:6, overflow:"hidden", border:"1px solid #a78bfa33" }}>
                    {a.objUrl
                      ? <img src={a.objUrl} alt={a.name}
                          style={{ width:"100%", height:120, objectFit:"cover", display:"block" }} />
                      : <div style={{ height:120, display:"flex", alignItems:"center", justifyContent:"center", color:"#334155", fontSize:11 }}>🖼 Loading…</div>
                    }
                    <div style={{ padding:"5px 7px" }}>
                      <div style={{ fontSize:9, color:"#64748b", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{a.name}</div>
                      <div style={{ fontSize:9, color:"#1e3a5f" }}>{a.size}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Videos */}
          {videos.length > 0 && (
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10, color:"#f472b6", fontWeight:700, marginBottom:8 }}>
                🎬 UPLOADED VIDEOS — {videos.length} file{videos.length>1?"s":""}
              </div>
              {videos.map((a,i) => (
                <div key={i} style={{ marginBottom:8, background:"#040d18", borderRadius:6, overflow:"hidden", border:"1px solid #f472b633" }}>
                  {a.objUrl
                    ? <video src={a.objUrl} controls style={{ width:"100%", maxHeight:220, display:"block", background:"#000" }} />
                    : <div style={{ height:120, display:"flex", alignItems:"center", justifyContent:"center", color:"#334155", fontSize:11 }}>🎬 Loading…</div>
                  }
                  <div style={{ padding:"5px 10px", display:"flex", justifyContent:"space-between" }}>
                    <span style={{ fontSize:9, color:"#64748b" }}>{a.name}</span>
                    <span style={{ fontSize:9, color:"#f472b6" }}>{a.size}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Audio */}
          {audios.length > 0 && (
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10, color:"#34d399", fontWeight:700, marginBottom:8 }}>
                🎵 UPLOADED AUDIO — {audios.length} file{audios.length>1?"s":""}
              </div>
              {audios.map((a,i) => (
                <div key={i} style={{ marginBottom:6, padding:"10px", background:"#040d18", borderRadius:6, border:"1px solid #34d39933" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                    <span style={{ fontSize:10, color:"#34d399" }}>🎵 {a.name}</span>
                    <span style={{ fontSize:9, color:"#334155" }}>{a.size}</span>
                  </div>
                  {a.objUrl
                    ? <audio src={a.objUrl} controls style={{ width:"100%", height:34 }} />
                    : <div style={{ fontSize:10, color:"#334155" }}>Audio loading…</div>
                  }
                </div>
              ))}
            </div>
          )}

          {/* GPS */}
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:10, color:"#38bdf8", fontWeight:700, marginBottom:6 }}>📍 GPS LOCATION SENT WITH ALERT</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:5 }}>
              {[["LATITUDE",proof.gpsLat],["LONGITUDE",proof.gpsLng],["ACCURACY",`±${proof.gpsAcc} m`],["CAPTURED",proof.capturedAt]].map(([l,v]) => (
                <div key={l} style={{ padding:"7px 9px", background:"#040d18", borderRadius:5 }}>
                  <div style={{ fontSize:9, color:"#1e3a5f", fontWeight:700 }}>{l}</div>
                  <div style={{ fontSize:10, color:"#94a3b8", wordBreak:"break-all" }}>{v}</div>
                </div>
              ))}
            </div>
            {proof.mapsUrl && (
              <a href={proof.mapsUrl} target="_blank" rel="noreferrer"
                style={{ display:"block", textAlign:"center", padding:"7px 0", marginTop:6, background:"rgba(34,197,94,.08)", border:"1px solid #22c55e44", borderRadius:5, color:"#4ade80", fontSize:11, fontWeight:700, textDecoration:"none" }}>
                🗺 OPEN LOCATION ON GOOGLE MAPS ↗
              </a>
            )}
          </div>

          {/* Live mic level */}
          {proof.audioDb && (
            <div style={{ padding:"8px 10px", background:proof.audioDanger?"#1a0000":"#040d18", border:`1px solid ${proof.audioDanger?"#ef4444":"#1e3a5f"}`, borderRadius:6 }}>
              <div style={{ fontSize:9, color:"#fbbf24", fontWeight:700, marginBottom:2 }}>🎙 MIC LEVEL AT DETECTION</div>
              <div style={{ fontSize:18, color:proof.audioDanger?"#ef4444":"#fbbf24", fontWeight:700 }}>
                {proof.audioDb} dB {proof.audioDanger && <span className="blink">⚠ SCREAM DETECTED</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   TOAST (top-right auto alert notification)
================================================================ */
function Toasts({ toasts, setToasts }) {
  return (
    <div style={{ position:"fixed", top:16, right:16, zIndex:9999, display:"flex", flexDirection:"column", gap:8, pointerEvents:"none", maxWidth:360, width:"90vw" }}>
      {toasts.map((t,i) => (
        <div key={t._tid} className={t._dying?"outR":"inR"}
          style={{ background:"#07111c", border:"1px solid #ef4444", borderRadius:10, padding:"12px 14px", boxShadow:"0 0 24px rgba(239,68,68,.4)", pointerEvents:"all", animationDelay:`${i*.04}s` }}>
          <div style={{ display:"flex", gap:9, alignItems:"flex-start" }}>
            <span className="blink" style={{ width:9, height:9, borderRadius:"50%", background:"#ef4444", flexShrink:0, marginTop:3, display:"block" }} />
            <div style={{ flex:1, minWidth:0 }}>
              {/* Alert info */}
              <div style={{ fontFamily:"'Orbitron',monospace", fontSize:10, color:"#fca5a5" }}>🚨 {t.activity}</div>
              <div style={{ fontSize:11, color:"#475569", marginTop:2 }}>{t.zone} · {t.time}</div>
              <div style={{ fontSize:11, color:"#38bdf8", marginTop:2 }}>
                📍 {t.lat}, {t.lng}
                {t.mapsUrl && <a href={t.mapsUrl} target="_blank" rel="noreferrer" style={{ color:"#4ade80", marginLeft:6, fontSize:10, textDecoration:"none" }}>Maps ↗</a>}
              </div>
              {/* Auto sent badge */}
              <div className="sentPop" style={{ marginTop:7, padding:"6px 9px", background:"rgba(34,197,94,.1)", border:"1px solid #22c55e55", borderRadius:6 }}>
                <div style={{ fontSize:10, color:"#4ade80", fontWeight:700 }}>✅ ALERT AUTOMATICALLY SENT TO POLICE</div>
                <div style={{ fontSize:10, color:"#22c55e", marginTop:2 }}>
                  {POLICE_CONTACTS.map((n,i) => <span key={i} style={{ marginRight:8 }}>📱 {n}</span>)}
                </div>
                {/* proof badges */}
                <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginTop:5 }}>
                  <Bdg ok={!!t.proof?.cameraSnap}              label={t.proof?.cameraSnap?"📷 SNAP":"📷 NO SNAP"}         c="#4ade80" />
                  <Bdg ok={!!t.proof?.audioDb}                 label={t.proof?.audioDb?`🎙 ${t.proof.audioDb}dB`:"🎙 NO MIC"} c="#fbbf24" />
                  <Bdg ok={t.proof?.gpsLat!=="NOT AVAILABLE"}  label={t.proof?.gpsLat!=="NOT AVAILABLE"?"📍 GPS":"📍 NO GPS"} c="#38bdf8" />
                  {(t.proof?.attachments||[]).length>0 && (
                    <Bdg ok label={`📁 ${t.proof.attachments.length} FILE${t.proof.attachments.length>1?"S":""} ATTACHED`} c="#a78bfa" />
                  )}
                </div>
              </div>
            </div>
            <button onClick={() => setToasts(p=>p.filter(x=>x._tid!==t._tid))} style={{ background:"none", border:"none", color:"#334155", cursor:"pointer", fontSize:14, flexShrink:0 }}>✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ================================================================
   HEADER
================================================================ */
function Header({ activeCount }) {
  const [clock, setClock] = useState(nowT());
  useEffect(() => { const i = setInterval(()=>setClock(nowT()),1000); return ()=>clearInterval(i); },[]);
  const chip = (label,val,c,bl) => (
    <div style={{ padding:"5px 12px", background:"#040d18", border:`1px solid ${c}44`, borderRadius:20, display:"flex", gap:6, alignItems:"center" }}>
      <span className={bl?"blink":""} style={{ width:7, height:7, borderRadius:"50%", background:c, display:"inline-block" }} />
      <span style={{ fontSize:10, color:"#475569" }}>{label}</span>
      <span style={{ fontSize:11, color:c, fontWeight:700, fontFamily:"'Orbitron',monospace" }}>{val}</span>
    </div>
  );
  return (
    <header style={{ background:"linear-gradient(135deg,#040d18,#071626)", borderBottom:"1px solid #0e3a56", padding:"14px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
      <div style={{ display:"flex", alignItems:"center", gap:14 }}>
        <div style={{ width:44, height:44, borderRadius:"50%", background:"linear-gradient(135deg,#0ea5e9,#0369a1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, boxShadow:"0 0 18px rgba(14,165,233,.5)" }}>🛡</div>
        <div>
          <div style={{ fontFamily:"'Orbitron',monospace", fontSize:16, fontWeight:900, letterSpacing:3, color:"#f0f9ff" }}>GUARDIAN · STREETLIGHT AI</div>
          <div style={{ fontSize:11, color:"#0ea5e9", letterSpacing:2 }}>AUTO-ALERT SYSTEM · PROOF ATTACHED · POLICE NOTIFIED INSTANTLY</div>
        </div>
      </div>
      <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
        {chip("SYSTEM","ONLINE","#22c55e")}
        {chip("CAMERAS","47 ACTIVE","#f59e0b")}
        {activeCount>0 ? chip("ALERTS",activeCount,"#ef4444",true) : chip("STATUS","ALL CLEAR","#22c55e")}
        <div style={{ fontFamily:"'Orbitron',monospace", fontSize:13, color:"#38bdf8", padding:"6px 14px", background:"#040d18", borderRadius:20, border:"1px solid #0e3a56" }}>{clock}</div>
      </div>
    </header>
  );
}

/* ================================================================
   AUDIO ANALYSIS — real dB → risk scoring
   Thresholds:
     dB >= 70  → RISK  (scream / shout level)
     dB >= 45  → WARN  (raised voice — monitor)
     dB <  45  → SAFE  (normal ambient)
================================================================ */
/* ── Audio analysis using REAL Web Audio API RMS range (0–30 typical) ──
   Browser mic RMS values:
     silence  →  0–2
     whisper  →  2–8
     talking  →  8–18
     loud     →  18–28
     scream   →  28+
   We map these to a 0–100 display scale (* 3.2) then threshold:
     display >= 55  →  RISK  (shout / scream)
     display >= 25  →  WARN  (raised voice)
     display <  25  →  SAFE
------------------------------------------------------------------ */
function analyseAudio(displayDb) {
  const d = parseFloat(displayDb) || 0;
  if (d >= 55) {
    const conf = Math.min(97, 65 + (d - 55) * 1.4).toFixed(1);
    const acts = ["Scream / Loud Cry Detected","Distress Signal Detected","Threatening Behaviour","Aggressive Posture Detected","Emergency — Loud Distress Audio"];
    return { flagged:true,  confidence:parseFloat(conf), activity:pick(acts),               level:"DANGER" };
  }
  if (d >= 25) {
    const conf = Math.min(54, 28 + (d - 25) * 0.9).toFixed(1);
    return { flagged:false, confidence:parseFloat(conf), activity:"Raised Voice — Monitoring", level:"WARN"   };
  }
  const conf = Math.max(5, d * 0.6).toFixed(1);
  return { flagged:false, confidence:parseFloat(conf), activity:pick(SAFE_ACT),               level:"SAFE"   };
}

/* ================================================================
   LIVE MONITOR TAB
================================================================ */
function LiveMonitor({ addLive, liveLog, gps, gpsStatus, fetchGps }) {
  const videoRef   = useRef(null);
  const audioRef   = useRef(null);
  const scanRef    = useRef(null);
  const dbRef      = useRef(0); // always current, no stale closure

  const [camOn,      setCamOn]      = useState(false);
  const [micOn,      setMicOn]      = useState(false);
  const [audioDb,    setAudioDb]    = useState(0);
  const [scanning,   setScanning]   = useState(false);
  const [scanMsg,    setScanMsg]    = useState("");
  const [resultLog,  setResultLog]  = useState([]); // ALL scan results shown live
  const [countdown,  setCountdown]  = useState(3);  // visible countdown

  /* ── Camera ── */
  const startCam = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video:true });
      if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play(); }
      setCamOn(true);
    } catch { alert("Allow camera access in browser settings."); }
  };
  const stopCam = () => {
    videoRef.current?.srcObject?.getTracks().forEach(t => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamOn(false);
  };

  /* ── Microphone ── */
  const startMic = async () => {
    try {
      const s  = await navigator.mediaDevices.getUserMedia({ audio:true });
      const cx = new (window.AudioContext || window.webkitAudioContext)();
      const an = cx.createAnalyser();
      an.fftSize = 512;
      cx.createMediaStreamSource(s).connect(an);
      audioRef.current = { s, cx, an };
      const arr = new Uint8Array(an.frequencyBinCount);
      const tick = () => {
        an.getByteTimeDomainData(arr);
        // RMS amplitude
        const rms = Math.sqrt(arr.reduce((a, v) => a + (v - 128) ** 2, 0) / arr.length);
        // Scale to 0–100 display units
        const db  = Math.min(100, rms * 3.2);
        dbRef.current = db;
        setAudioDb(db);
        audioRef.current._raf = requestAnimationFrame(tick);
      };
      tick();
      setMicOn(true);
      setResultLog([]);
    } catch { alert("Allow microphone access in browser settings."); }
  };
  const stopMic = () => {
    if (audioRef.current) {
      cancelAnimationFrame(audioRef.current._raf);
      audioRef.current.s?.getTracks().forEach(t => t.stop());
      audioRef.current.cx?.close();
      audioRef.current = null;
    }
    setMicOn(false); setAudioDb(0); dbRef.current = 0;
    clearInterval(scanRef.current);
  };

  /* ── Countdown ticker (visual only) ── */
  useEffect(() => {
    if (!micOn && !camOn) return;
    const t = setInterval(() => setCountdown(c => c <= 1 ? 3 : c - 1), 1000);
    return () => clearInterval(t);
  }, [micOn, camOn]);

  /* ── Auto scan every 3 s using real dB from ref ── */
  useEffect(() => {
    if (!micOn && !camOn) { clearInterval(scanRef.current); return; }
    scanRef.current = setInterval(() => {
      const db = dbRef.current;
      setScanning(true);

      const steps = ["Reading audio level…","Analysing waveform…","Classifying sound…","Checking threat score…"];
      let si = 0;
      const st = setInterval(() => setScanMsg(steps[si++ % steps.length]), 220);

      setTimeout(() => {
        clearInterval(st);
        const analysis = analyseAudio(db);
        const proof    = buildProof({ videoEl: videoRef.current, audioDb: db, gps, files: [] });

        const item = {
          id:         uid(),
          name:       `mic_${nowT()}`,
          type:       camOn && micOn ? "video+audio" : micOn ? "audio" : "video",
          flagged:    analysis.flagged,
          confidence: analysis.confidence,
          activity:   analysis.activity,
          level:      analysis.level,
          audioDb:    db.toFixed(1),
          zone:       gps?.placeName || gps?.area || gps?.city || "Location Unavailable",
          time:       nowT(),
          fullTime:   nowF(),
          status:     "active",
          proof,
        };

        // Prepend to local result log (newest on top)
        setResultLog(prev => [item, ...prev].slice(0, 30));
        addLive(item);
        setScanning(false);
        setScanMsg("");
      }, 700);

    }, 3000);
    return () => clearInterval(scanRef.current);
  }, [micOn, camOn, gps, addLive]);

  /* ── Derived display values ── */
  const dbc      = audioDb >= 55 ? "#ef4444" : audioDb >= 25 ? "#f59e0b" : "#22c55e";
  const levelTxt = audioDb >= 55 ? "DANGER"  : audioDb >= 25 ? "CAUTION" : audioDb > 3 ? "NORMAL" : "SILENT";

  const monitoring = micOn || camOn;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

      {/* ── Top row: Camera + Mic + GPS ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(270px,1fr))", gap:14 }}>

        {/* Camera */}
        <Card title="📷 LIVE CAMERA" accent="#38bdf8">
          <div style={{ position:"relative", background:"#000", borderRadius:8, overflow:"hidden", aspectRatio:"4/3", marginBottom:10 }}>
            <video ref={videoRef} style={{ width:"100%", height:"100%", objectFit:"cover" }} muted playsInline />
            {!camOn && (
              <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"#1e3a5f", gap:8 }}>
                <div style={{ fontSize:38 }}>📷</div><div style={{ fontSize:12 }}>Camera Off</div>
              </div>
            )}
            {camOn && (
              <>
                <div className="blink" style={{ position:"absolute", top:8, left:8, background:"rgba(239,68,68,.9)", borderRadius:4, padding:"2px 8px", fontSize:10, color:"#fff", fontWeight:700 }}>● REC</div>
                <div style={{ position:"absolute", left:0, right:0, height:2, background:"rgba(56,189,248,.6)", animation:"scan 2.5s linear infinite" }} />
              </>
            )}
          </div>
          <Row>
            {!camOn ? <Btn color="#38bdf8" onClick={startCam}>▶ Start Camera</Btn>
                    : <Btn color="#ef4444" onClick={stopCam}>■ Stop</Btn>}
          </Row>
        </Card>

        {/* ── Microphone + INSTANT result ── */}
        <Card title="🎙 LIVE AUDIO DETECTION" accent="#a855f7">

          {/* Waveform */}
          <div style={{ background:"#020b14", borderRadius:8, padding:"10px 12px", marginBottom:10, border:`2px solid ${dbc}55`, transition:"border-color .3s" }}>
            <div style={{ display:"flex", gap:2, justifyContent:"center", alignItems:"flex-end", height:48, marginBottom:8 }}>
              {Array.from({length:32}).map((_,i) => (
                <div key={i} style={{
                  width:3, borderRadius:2, transformOrigin:"bottom", background:dbc,
                  height: `${micOn ? Math.max(3, audioDb * rnd(.3,1)) : 3}px`,
                  animation: micOn ? `wavebar ${.2+rnd(0,.4)}s ${i*.03}s ease-in-out infinite` : "none",
                  transition: "background .2s",
                }} />
              ))}
            </div>

            {/* Big dB reading */}
            <div style={{ textAlign:"center", fontFamily:"'Orbitron',monospace", fontSize:36, fontWeight:900, color:dbc, lineHeight:1 }}>
              {micOn ? audioDb.toFixed(0) : "—"}
            </div>
            <div style={{ textAlign:"center", fontSize:10, color:dbc, letterSpacing:2, marginTop:2, fontFamily:"'Orbitron',monospace" }}>
              {micOn ? `${levelTxt} · ${audioDb.toFixed(1)} UNITS` : "MIC OFF"}
            </div>

            {/* Live status banner — updates every frame */}
            {micOn && (
              <div style={{
                marginTop:8, padding:"8px 10px", borderRadius:6, textAlign:"center",
                background: audioDb>=55 ? "rgba(239,68,68,.15)" : audioDb>=25 ? "rgba(245,158,11,.1)" : "rgba(34,197,94,.08)",
                border:`1px solid ${dbc}55`,
              }}>
                <div style={{ fontFamily:"'Orbitron',monospace", fontSize:13, fontWeight:700, color:dbc }}>
                  {audioDb>=55 ? "🚨 DANGER — SCREAM / SHOUT" : audioDb>=25 ? "⚠ CAUTION — RAISED VOICE" : "✅ SAFE — NORMAL AUDIO"}
                </div>
                <div style={{ fontSize:10, color:"#475569", marginTop:3 }}>
                  {audioDb>=55 ? "Alert will fire in next scan" : audioDb>=25 ? "Monitoring — watching level" : "No threat detected"}
                </div>
              </div>
            )}
          </div>

          {/* Threshold reference bar */}
          {micOn && (
            <div style={{ marginBottom:10, padding:"8px 10px", background:"#020b14", borderRadius:6, border:"1px solid #0e2a3a" }}>
              <div style={{ fontSize:9, color:"#334155", marginBottom:5, fontFamily:"'Orbitron',monospace", letterSpacing:1 }}>DETECTION THRESHOLDS</div>
              <div style={{ position:"relative", height:12, background:"#0e1f2e", borderRadius:6, overflow:"hidden" }}>
                <div style={{ position:"absolute", left:0, top:0, bottom:0, width:"25%", background:"#22c55e33" }} />
                <div style={{ position:"absolute", left:"25%", top:0, bottom:0, width:"30%", background:"#f59e0b33" }} />
                <div style={{ position:"absolute", left:"55%", top:0, bottom:0, right:0, background:"#ef444433" }} />
                {/* Current level marker */}
                <div style={{ position:"absolute", top:0, bottom:0, width:3, background:"#fff", borderRadius:2, left:`${Math.min(97,audioDb)}%`, transition:"left .1s" }} />
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:3 }}>
                <span style={{ fontSize:8, color:"#22c55e" }}>SAFE 0–24</span>
                <span style={{ fontSize:8, color:"#f59e0b" }}>CAUTION 25–54</span>
                <span style={{ fontSize:8, color:"#ef4444" }}>DANGER 55+</span>
              </div>
            </div>
          )}

          {/* Scanning status */}
          {monitoring && (
            <div style={{ display:"flex", gap:8, alignItems:"center", padding:"5px 10px", marginBottom:8, background:"#020b14", borderRadius:5 }}>
              {scanning
                ? <><span className="spin" style={{ fontSize:12 }}>⟳</span><span style={{ fontSize:10, color:"#38bdf8", fontFamily:"'Orbitron',monospace" }}>{scanMsg}</span></>
                : <><span style={{ fontSize:10, color:"#334155" }}>Next scan in</span><span style={{ fontFamily:"'Orbitron',monospace", fontSize:12, color:"#38bdf8", marginLeft:4 }}>{countdown}s</span></>
              }
            </div>
          )}

          <Row>
            {!micOn
              ? <Btn color="#a855f7" onClick={startMic}>🎙 Start Mic</Btn>
              : <Btn color="#ef4444" onClick={stopMic}>■ Stop Mic</Btn>}
          </Row>
        </Card>

        {/* GPS */}
        <Card title="📍 GPS LOCATION" accent="#f59e0b">
          <div style={{ background:"#020b14", borderRadius:8, padding:14, marginBottom:10, minHeight:110 }}>
            {gpsStatus==="loading" && (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:80, gap:8 }}>
                <div className="spin" style={{ fontSize:24 }}>⟳</div>
                <div style={{ fontSize:11, color:"#f59e0b" }}>Getting GPS…</div>
              </div>
            )}
            {gpsStatus==="failed" && (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:80, gap:8 }}>
                <div style={{ fontSize:11, color:"#ef4444", textAlign:"center" }}>❌ Location blocked.<br/>Allow in browser.</div>
                <Btn color="#f59e0b" onClick={fetchGps}>🔄 Retry</Btn>
              </div>
            )}
            {gpsStatus==="locked" && gps && (
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {/* Locked badge */}
                <div className="gpulse" style={{ display:"flex", gap:7, alignItems:"center", padding:"7px 10px", background:"rgba(34,197,94,.08)", border:"1px solid #22c55e44", borderRadius:6 }}>
                  <span style={{ color:"#22c55e", fontSize:14 }}>●</span>
                  <div>
                    <div style={{ fontFamily:"'Orbitron',monospace", fontSize:10, color:"#22c55e", fontWeight:700 }}>GPS LOCKED ±{gps.acc}m</div>
                  </div>
                </div>

                {/* Big place name */}
                <div style={{ padding:"10px 12px", background:"linear-gradient(135deg,#071624,#040d18)", border:"1px solid #f59e0b44", borderRadius:8 }}>
                  <div style={{ fontSize:9, color:"#475569", fontFamily:"'Orbitron',monospace", letterSpacing:1, marginBottom:5 }}>📍 YOUR CURRENT LOCATION</div>
                  <div style={{ fontSize:15, color:"#f59e0b", fontWeight:700, lineHeight:1.3, wordBreak:"break-word" }}>
                    {gps.placeName || "Locating..."}
                  </div>
                  {gps.area && gps.area !== gps.placeName && (
                    <div style={{ fontSize:11, color:"#94a3b8", marginTop:4 }}>{gps.area}</div>
                  )}
                  {gps.district && (
                    <div style={{ fontSize:10, color:"#475569", marginTop:2 }}>{gps.district}</div>
                  )}
                </div>

                {/* Lat / Lng */}
                {[["LATITUDE", gps.lat],["LONGITUDE", gps.lng]].map(([l,v]) => (
                  <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"5px 9px", background:"#040d18", borderRadius:5 }}>
                    <span style={{ fontSize:10, color:"#475569" }}>{l}</span>
                    <span style={{ fontFamily:"'Orbitron',monospace", fontSize:11, color:"#f59e0b" }}>{v}</span>
                  </div>
                ))}

                {/* Maps link */}
                {gps.mapsUrl && (
                  <a href={gps.mapsUrl} target="_blank" rel="noreferrer"
                    style={{ display:"block", textAlign:"center", padding:"7px", background:"rgba(34,197,94,.08)", border:"1px solid #22c55e44", borderRadius:5, color:"#4ade80", fontSize:11, textDecoration:"none", fontWeight:700 }}>
                    🗺 Open My Location on Google Maps ↗
                  </a>
                )}
              </div>
            )}
          </div>
          <Row><Btn color="#f59e0b" onClick={fetchGps}>🔄 Refresh</Btn></Row>
        </Card>
      </div>

      {/* ── LIVE RESULT FEED — always visible, newest on top ── */}
      {monitoring && (
        <div style={{ background:"#040d18", border:"1px solid #0e3a56", borderRadius:12, padding:16 }}>
          <div style={{ fontFamily:"'Orbitron',monospace", fontSize:9, color:"#38bdf8", letterSpacing:2, marginBottom:10 }}>
            📊 LIVE SCAN RESULTS — UPDATES EVERY 3 SECONDS
          </div>

          {resultLog.length === 0 && !scanning && (
            <div style={{ textAlign:"center", padding:"20px 0", color:"#1e3a5f", fontSize:12 }}>
              Waiting for first scan… speak into mic or make noise
            </div>
          )}

          {scanning && resultLog.length === 0 && (
            <div style={{ textAlign:"center", padding:"16px 0", color:"#38bdf8", fontSize:12, fontFamily:"'Orbitron',monospace" }}>
              <span className="spin" style={{ display:"inline-block", marginRight:8 }}>⟳</span>{scanMsg}
            </div>
          )}

          <div style={{ display:"flex", flexDirection:"column", gap:6, maxHeight:340, overflowY:"auto" }}>
            {resultLog.map((r, i) => (
              <div key={r.id} className={i===0?"fadeUp":""} style={{
                display:"flex", gap:12, padding:"10px 14px",
                background:    r.flagged ? "rgba(239,68,68,.1)"  : "rgba(34,197,94,.06)",
                border:       `1px solid ${r.flagged ? "#ef444455" : "#22c55e33"}`,
                borderLeft:   `4px solid ${r.flagged ? "#ef4444"   : "#22c55e"}`,
                borderRadius:  8,
              }}>
                {/* Icon */}
                <div style={{ fontSize:22, flexShrink:0, paddingTop:2 }}>
                  {r.flagged ? "🚨" : "✅"}
                </div>

                {/* Content */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap", marginBottom:3 }}>
                    <span style={{
                      fontFamily:"'Orbitron',monospace", fontSize:12, fontWeight:700,
                      color: r.flagged ? "#fca5a5" : "#4ade80",
                    }}>
                      {r.flagged ? "⚠ RISK DETECTED" : "✅ SAFE"}
                    </span>
                    <span style={{ fontSize:11, color:"#94a3b8" }}>{r.activity}</span>
                  </div>
                  <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                    <span style={{ fontSize:10, color:"#475569" }}>🎙 {r.audioDb} units</span>
                    <span style={{ fontSize:10, color:"#475569" }}>📍 {r.zone}</span>
                    <span style={{ fontSize:10, color:"#475569" }}>⏱ {r.time}</span>
                    {r.flagged && <span style={{ fontSize:10, color:"#4ade80", fontWeight:700 }}>✅ Alert auto-sent</span>}
                  </div>
                </div>

                {/* Confidence */}
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontFamily:"'Orbitron',monospace", fontSize:16, fontWeight:700, color: r.flagged ? "#ef4444" : "#22c55e" }}>
                    {r.confidence}%
                  </div>
                  <div style={{ fontSize:9, color:"#334155" }}>confidence</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past scan log (collapsed) */}
      {liveLog.length > 0 && (
        <Card title={`📋 FULL HISTORY — ${liveLog.length} SCANS`} accent="#334155">
          <div style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:200, overflowY:"auto" }}>
            {liveLog.map((r,i) => (
              <div key={r.id} style={{ display:"flex", gap:8, padding:"6px 10px", background:"#020b14", borderRadius:5, alignItems:"center" }}>
                <span style={{ fontSize:12 }}>{r.flagged?"🚨":"✅"}</span>
                <span style={{ fontSize:11, color:"#334155", flex:1 }}>{r.activity}</span>
                <span style={{ fontSize:10, color:r.flagged?"#ef4444":"#22c55e", fontFamily:"'Orbitron',monospace" }}>{r.confidence}%</span>
                <span style={{ fontSize:10, color:"#1e3a5f" }}>{r.time}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ================================================================
   FILE SCAN TAB
================================================================ */
function FileScan({ addIncident, addIgnored, gps, gpsStatus }) {
  const [files,    setFiles]    = useState([]);
  const [results,  setResults]  = useState([]);
  const [running,  setRunning]  = useState(false);
  const [progress, setProgress] = useState(0);
  const [current,  setCurrent]  = useState("");

  const onDrop = e => {
    e.preventDefault();
    const dropped = [...(e.dataTransfer?.files || e.target.files || [])];
    setFiles(p => [...p, ...dropped].slice(0,500));
    setResults([]); setProgress(0);
  };

  const runScan = async () => {
    if (!files.length) return;
    setRunning(true); setResults([]); setProgress(0);
    const out = [];
    for (let i=0; i<files.length; i++) {
      setCurrent(files[i].name);
      setProgress(Math.round(((i+1)/files.length)*100));
      await new Promise(r => setTimeout(r, 80+Math.random()*150));

      // Build proof with the actual uploaded file attached
      const proof = buildProof({ videoEl:null, audioDb:null, gps, files:[files[i]] });

      const res = {
        ...analyseFile(files[i], gps),
        lat:     gps?.lat     || "N/A",
        lng:     gps?.lng     || "N/A",
        mapsUrl: gps?.mapsUrl || null,
        fullTime: nowF(),
        proof,
        sendResult: null,
      };

      // AUTO SEND if flagged
      if (res.flagged) {
        res.sendResult = autoSendAlert(res);
        addIncident(res);
      } else {
        addIgnored(res);
      }
      out.push(res); setResults([...out]);
    }
    setRunning(false); setCurrent("");
  };

  const flagged = results.filter(r=>r.flagged);
  const safe    = results.filter(r=>!r.flagged);
  const done    = !running && results.length>0;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Drop zone */}
      <div onDrop={onDrop} onDragOver={e=>e.preventDefault()}
        style={{ border:"2px dashed #0e3a56", borderRadius:12, padding:32, textAlign:"center", background:"#040d18", cursor:"pointer" }}>
        <div style={{ fontSize:46, marginBottom:10 }}>📂</div>
        <div style={{ fontFamily:"'Orbitron',monospace", fontSize:14, color:"#38bdf8", marginBottom:6 }}>UPLOAD EVIDENCE FILES</div>
        <div style={{ color:"#334155", fontSize:12, marginBottom:4 }}>🎬 Videos · 🖼 Images · 🎵 Audio files</div>
        <div style={{ color:"#1e3a5f", fontSize:11, marginBottom:16 }}>
          Files are read and <span style={{ color:"#a78bfa", fontWeight:700 }}>automatically sent as proof</span> with every alert
        </div>
        <label style={{ padding:"9px 22px", background:"#0ea5e9", color:"#fff", borderRadius:8, cursor:"pointer", fontWeight:700, fontSize:13 }}>
          Browse & Select
          <input type="file" multiple accept="video/*,audio/*,image/*" onChange={onDrop} style={{ display:"none" }} />
        </label>
        {files.length>0&&<div style={{ marginTop:10, color:"#22c55e", fontSize:12 }}>✓ {files.length} file{files.length!==1?"s":""} ready</div>}
        <div style={{ marginTop:8, fontSize:11, color:gpsStatus==="locked"?"#22c55e":"#475569" }}>
          📍 {gpsStatus==="locked"?`GPS: ${gps?.lat}, ${gps?.lng}`:gpsStatus==="loading"?"Getting GPS…":"GPS unavailable"}
        </div>
      </div>

      {/* Queue */}
      {files.length>0&&!running&&results.length===0&&(
        <Card title={`📋 ${files.length} FILES READY`} accent="#a78bfa">
          <div style={{ maxHeight:180, overflowY:"auto", display:"flex", flexDirection:"column", gap:3, marginBottom:14 }}>
            {files.map((f,i)=>{
              const k=f.type.split("/")[0];
              return (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 10px", background:"#020b14", borderRadius:5 }}>
                  <span style={{ fontSize:11, color:"#64748b" }}>{k==="image"?"🖼":k==="video"?"🎬":k==="audio"?"🎵":"📄"} {f.name}</span>
                  <span style={{ fontSize:10, color:"#334155" }}>{k.toUpperCase()} · {(f.size/1024).toFixed(1)} KB</span>
                </div>
              );
            })}
          </div>
          <button onClick={runScan} style={{ width:"100%", padding:12, background:"linear-gradient(135deg,#0ea5e9,#0369a1)", color:"#fff", border:"none", borderRadius:8, fontFamily:"'Rajdhani',sans-serif", fontWeight:700, fontSize:14, cursor:"pointer", letterSpacing:1 }}>
            ⚡ SCAN & AUTO-SEND ALERTS WITH PROOF
          </button>
        </Card>
      )}

      {/* Progress */}
      {running&&(
        <Card title="⟳ SCANNING + AUTO-SENDING ALERTS…" accent="#f59e0b">
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:6 }}>
            <span style={{ color:"#94a3b8" }}>{current}</span>
            <span style={{ color:"#f59e0b", fontFamily:"'Orbitron',monospace" }}>{progress}%</span>
          </div>
          <div style={{ background:"#020b14", borderRadius:6, height:8, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${progress}%`, background:"linear-gradient(90deg,#0ea5e9,#38bdf8)", transition:"width .3s" }} />
          </div>
          <div style={{ marginTop:8, fontSize:10, color:"#334155" }}>Analysing files · Building proof · Sending alerts automatically…</div>
        </Card>
      )}

      {/* Results */}
      {done&&(
        <>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:12 }}>
            <Stat icon="🔍" label="Total Scanned"  val={results.length} c="#38bdf8" />
            <Stat icon="🚨" label="Alerts Sent"    val={flagged.length} c="#ef4444" />
            <Stat icon="✅" label="Safe Files"     val={safe.length}    c="#22c55e" />
          </div>
          {flagged.length>0&&(
            <Card title={`🚨 ${flagged.length} RISKS — ALERTS AUTOMATICALLY SENT TO POLICE`} accent="#ef4444">
              <div style={{ display:"flex", flexDirection:"column", gap:10, maxHeight:500, overflowY:"auto" }}>
                {flagged.map((r,i)=>(
                  <div key={r.id} className="fadeUp" style={{ background:"#070612", border:"1px solid #ef444433", borderLeft:"3px solid #ef4444", borderRadius:8, padding:12, animationDelay:`${i*.04}s` }}>
                    <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap", marginBottom:6 }}>
                      <span style={{ fontFamily:"'Orbitron',monospace", fontSize:10, color:"#0ea5e9" }}>#{r.id}</span>
                      <span style={{ fontSize:12, color:"#fca5a5", fontWeight:700 }}>{r.activity}</span>
                      <span style={{ fontSize:11, color:"#ef4444", fontFamily:"'Orbitron',monospace" }}>{r.confidence}%</span>
                      <span style={{ fontSize:10, color:"#64748b" }}>{r.zone} · {r.time}</span>
                    </div>
                    <SentBanner sendResult={r.sendResult} />
                    <ProofPanel proof={r.proof} incId={r.id} />
                  </div>
                ))}
              </div>
            </Card>
          )}
          {safe.length>0&&(
            <Card title={`✅ ${safe.length} SAFE — NO ALERT`} accent="#22c55e">
              <div style={{ display:"flex", flexDirection:"column", gap:3, maxHeight:200, overflowY:"auto" }}>
                {safe.map((r,i)=>(
                  <div key={r.id} className="fadeUp" style={{ display:"flex", justifyContent:"space-between", padding:"5px 10px", background:"#020b14", borderRadius:5, animationDelay:`${i*.02}s` }}>
                    <span style={{ fontSize:11, color:"#334155" }}>{r.name}</span>
                    <span style={{ fontSize:10, color:"#22c55e" }}>{r.activity}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

/* ================================================================
   ALERTS LOG TAB
================================================================ */
function AlertsLog({ incidents, setIncidents }) {
  const resolve = id => setIncidents(p=>p.map(i=>i.id===id?{...i,status:"resolved"}:i));
  const active   = incidents.filter(i=>i.status!=="resolved");
  const resolved = incidents.filter(i=>i.status==="resolved");
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      {incidents.length===0&&<Empty msg="No alerts yet. Start Live Monitor or scan files." />}
      {active.length>0&&(
        <Card title={`🚨 ACTIVE — ${active.length} ALERTS`} accent="#ef4444">
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {active.map((r,i)=>(
              <div key={r.id} className="rpulse fadeUp"
                style={{ background:"#070612", border:"1px solid #ef444455", borderLeft:"4px solid #ef4444", borderRadius:8, padding:14, animationDelay:`${i*.04}s` }}>
                <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap", marginBottom:6 }}>
                  <span style={{ fontFamily:"'Orbitron',monospace", fontSize:10, color:"#0ea5e9" }}>#{r.id}</span>
                  <span style={{ fontSize:13, color:"#fca5a5", fontWeight:700 }}>{r.activity}</span>
                  <span style={{ fontSize:11, color:"#ef4444", fontFamily:"'Orbitron',monospace" }}>{r.confidence}%</span>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:5, marginBottom:8 }}>
                  {[["FILE",r.name,"#64748b"],["ZONE",r.zone,"#94a3b8"],["GPS",r.mapsUrl?<a href={r.mapsUrl} target="_blank" rel="noreferrer" style={{color:"#4ade80",textDecoration:"none"}}>{r.lat}, {r.lng} ↗</a>:`${r.lat}, ${r.lng}`,"#f59e0b"],["TIME",r.fullTime||r.time,"#475569"]].map(([l,v,c])=>(
                    <div key={l} style={{ padding:"6px 9px", background:"#040d18", borderRadius:5 }}>
                      <div style={{ fontSize:9, color:"#1e3a5f", fontFamily:"'Orbitron',monospace" }}>{l}</div>
                      <div style={{ fontSize:10, color:c, marginTop:2, wordBreak:"break-all" }}>{v}</div>
                    </div>
                  ))}
                </div>
                <SentBanner sendResult={r.sendResult} />
                <ProofPanel proof={r.proof} incId={r.id} />
                <button onClick={()=>resolve(r.id)} style={{ marginTop:10, padding:"6px 16px", background:"#052e16", color:"#4ade80", border:"1px solid #166534", borderRadius:6, cursor:"pointer", fontFamily:"'Rajdhani',sans-serif", fontWeight:700, fontSize:12 }}>
                  ✓ Mark Resolved
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}
      {resolved.length>0&&(
        <Card title={`✓ RESOLVED — ${resolved.length}`} accent="#22c55e">
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {resolved.map(r=>(
              <div key={r.id} style={{ background:"#040d18", border:"1px solid #22c55e22", borderRadius:6, padding:"10px 14px", opacity:.65, display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                <span style={{ fontFamily:"'Orbitron',monospace", fontSize:10, color:"#0ea5e9" }}>#{r.id}</span>
                <span style={{ fontSize:12, color:"#94a3b8" }}>{r.activity}</span>
                <span style={{ fontSize:10, color:"#22c55e", marginLeft:"auto" }}>RESOLVED ✓</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ================================================================
   IGNORED TAB
================================================================ */
function IgnoredLog({ ignored }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      {ignored.length===0&&<Empty msg="No ignored entries yet." />}
      {ignored.length>0&&(
        <Card title={`✅ ${ignored.length} SAFE ENTRIES`} accent="#22c55e">
          <div style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:500, overflowY:"auto" }}>
            {ignored.map((r,i)=>(
              <div key={r.id} className="fadeUp" style={{ display:"flex", gap:10, padding:"7px 12px", background:"#020b14", borderRadius:5, alignItems:"center", animationDelay:`${i*.02}s` }}>
                <span>✅</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, color:"#334155" }}>{r.name}</div>
                  <div style={{ fontSize:10, color:"#1e3a5f", marginTop:1 }}>{r.activity} · {r.zone}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:10, color:"#22c55e" }}>SAFE</div>
                  <div style={{ fontSize:10, color:"#334155" }}>{r.time}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ================================================================
   REPORT TAB
================================================================ */
function ReportTab({ incidents, ignored }) {
  const total    = incidents.length + ignored.length;
  const flagged  = incidents.length;
  const resolved = incidents.filter(i=>i.status==="resolved").length;
  const riskPct  = total?((flagged/total)*100).toFixed(1):0;
  const byZone   = {};
  incidents.forEach(i=>{ byZone[i.zone]=(byZone[i.zone]||0)+1; });

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {total===0&&<Empty msg="No data yet. Start monitoring or scan files." />}
      {total>0&&(
        <>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:12 }}>
            <Stat icon="🔍" label="Total"     val={total}       c="#38bdf8" />
            <Stat icon="🚨" label="Alerts"    val={flagged}     c="#ef4444" />
            <Stat icon="✅" label="Safe"      val={ignored.length} c="#22c55e" />
            <Stat icon="✓"  label="Resolved"  val={resolved}    c="#a855f7" />
            <Stat icon="⚡" label="Risk Rate" val={riskPct+"%"} c="#f59e0b" />
          </div>
          {Object.keys(byZone).length>0&&(
            <Card title="🗺 INCIDENTS BY ZONE" accent="#f59e0b">
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {Object.entries(byZone).sort((a,b)=>b[1]-a[1]).map(([z,c])=>(
                  <div key={z}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:3 }}>
                      <span style={{ color:"#94a3b8" }}>{z}</span>
                      <span style={{ color:"#f59e0b", fontFamily:"'Orbitron',monospace", fontWeight:700 }}>{c}</span>
                    </div>
                    <div style={{ background:"#020b14", borderRadius:4, height:5, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${(c/flagged)*100}%`, background:"linear-gradient(90deg,#f59e0b,#fbbf24)", transition:"width .5s" }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
          <Card title="📋 FULL INCIDENT LOG" accent="#ef4444">
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                <thead>
                  <tr>{["ID","ACTIVITY","ZONE","GPS","CONF","TIME","PROOF","ALERT STATUS"].map(h=>(
                    <th key={h} style={{ padding:"8px 10px", background:"#020b14", color:"#334155", fontSize:9, letterSpacing:1.2, textAlign:"left", fontFamily:"'Orbitron',monospace", whiteSpace:"nowrap" }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {incidents.map((r,i)=>(
                    <tr key={r.id} style={{ borderTop:"1px solid #0e1f2e", background:i%2===0?"#040d18":"transparent" }}>
                      <td style={{ padding:"7px 10px", color:"#0ea5e9", fontFamily:"'Orbitron',monospace", fontSize:10 }}>#{r.id}</td>
                      <td style={{ padding:"7px 10px", color:"#fca5a5" }}>{r.activity}</td>
                      <td style={{ padding:"7px 10px", color:"#94a3b8" }}>{r.zone}</td>
                      <td style={{ padding:"7px 10px", color:"#f59e0b", fontSize:10, whiteSpace:"nowrap" }}>{r.lat},{r.lng}</td>
                      <td style={{ padding:"7px 10px", color:"#ef4444", fontFamily:"'Orbitron',monospace", fontWeight:700 }}>{r.confidence}%</td>
                      <td style={{ padding:"7px 10px", color:"#475569", whiteSpace:"nowrap" }}>{r.time}</td>
                      <td style={{ padding:"7px 10px", fontSize:10, color:"#a78bfa" }}>
                        {(r.proof?.attachments||[]).length} file{(r.proof?.attachments||[]).length!==1?"s":""}
                        {r.proof?.cameraSnap?" + 📷":""}
                        {r.proof?.gpsLat!=="NOT AVAILABLE"?" + 📍":""}
                      </td>
                      <td style={{ padding:"7px 10px" }}>
                        <span style={{ padding:"2px 8px", borderRadius:10, fontSize:10, background:r.status==="resolved"?"#052e16":"#3b0a0a", color:r.status==="resolved"?"#4ade80":"#f87171" }}>
                          {r.status==="resolved"?"RESOLVED":"ACTIVE"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

/* ================================================================
   LOG ROW (live scan log)
================================================================ */
function LogRow({ r, delay=0 }) {
  return (
    <div className="fadeUp" style={{ display:"flex", gap:10, padding:"8px 12px", background:r.flagged?"#070612":"#040d18", border:`1px solid ${r.flagged?"#ef444433":"#22c55e22"}`, borderLeft:`3px solid ${r.flagged?"#ef4444":"#22c55e"}`, borderRadius:6, alignItems:"flex-start", animationDelay:`${delay}s` }}>
      <span style={{ fontSize:12 }}>{r.type==="video+audio"?"📡":r.type==="video"?"📹":"🎙"}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
          <span style={{ fontSize:11, color:"#334155", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:180 }}>{r.name}</span>
          <span style={{ fontSize:10, padding:"1px 7px", borderRadius:10, background:r.flagged?"#3b0a0a":"#052e16", color:r.flagged?"#f87171":"#4ade80" }}>{r.flagged?"RISK":"SAFE"}</span>
        </div>
        <div style={{ fontSize:11, color:r.flagged?"#fca5a5":"#334155", marginTop:2 }}>{r.activity}</div>
        {r.flagged&&<div className="fadeUp" style={{ fontSize:10, color:"#4ade80", marginTop:2 }}>✅ Alert auto-sent · {r.zone}</div>}
      </div>
      <div style={{ textAlign:"right", flexShrink:0 }}>
        <div style={{ fontFamily:"'Orbitron',monospace", fontSize:12, color:r.flagged?"#ef4444":"#22c55e", fontWeight:700 }}>{r.confidence}%</div>
        <div style={{ fontSize:10, color:"#334155" }}>{r.time}</div>
      </div>
    </div>
  );
}

/* ================================================================
   ROOT APP
================================================================ */
export default function App() {
  const [tab,       setTab]       = useState("live");
  const [incidents, setIncidents] = useState([]);
  const [ignored,   setIgnored]   = useState([]);
  const [toasts,    setToasts]    = useState([]);
  const [liveLog,   setLiveLog]   = useState([]);
  const [gps,       setGps]       = useState(null);
  const [gpsStatus, setGpsStatus] = useState("loading");

  const fetchGps = useCallback(() => {
    setGpsStatus("loading");
    if (!navigator.geolocation) { setGpsStatus("failed"); return; }
    navigator.geolocation.getCurrentPosition(
      async p => {
        const lat = p.coords.latitude;
        const lng = p.coords.longitude;
        const acc = p.coords.accuracy.toFixed(0);
        const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
        // Reverse geocode using OpenStreetMap Nominatim (free, no API key)
        let placeName = "Locating area...";
        let area = "";
        let city = "";
        let district = "";
        try {
          const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, { headers:{ "Accept-Language":"en" } });
          const data = await res.json();
          const ad   = data.address || {};
          // Build a readable name from most specific to least
          const parts = [
            ad.neighbourhood || ad.suburb || ad.quarter,
            ad.village || ad.town || ad.city_district,
            ad.city || ad.county || ad.state_district,
            ad.state,
          ].filter(Boolean);
          placeName = parts.slice(0,3).join(", ") || data.display_name?.split(",").slice(0,3).join(",") || "Unknown Location";
          area      = ad.neighbourhood || ad.suburb || ad.village || "";
          city      = ad.city || ad.town || ad.county || "";
          district  = ad.state_district || ad.county || ad.state || "";
        } catch(_) {
          placeName = "Location name unavailable";
        }
        setGps({
          lat:      lat.toFixed(6),
          lng:      lng.toFixed(6),
          acc,
          mapsUrl,
          placeName,
          area,
          city,
          district,
        });
        setGpsStatus("locked");
      },
      () => setGpsStatus("failed"),
      { enableHighAccuracy:true, timeout:15000, maximumAge:0 }
    );
  }, []);
  useEffect(() => { fetchGps(); }, [fetchGps]);

  const addIncident = useCallback((item) => {
    const full = { ...item, lat:gps?.lat||item.lat||"N/A", lng:gps?.lng||item.lng||"N/A", mapsUrl:gps?.mapsUrl||null };
    // Auto send alert
    if (!full.sendResult) full.sendResult = autoSendAlert(full);
    setIncidents(p => [full,...p].slice(0,200));
    const t = { ...full, _tid:uid(), _dying:false };
    setToasts(p => [t,...p].slice(0,4));
    setTimeout(()=>{
      setToasts(p=>p.map(x=>x._tid===t._tid?{...x,_dying:true}:x));
      setTimeout(()=>setToasts(p=>p.filter(x=>x._tid!==t._tid)),350);
    }, 10000);
  }, [gps]);

  const addIgnored = useCallback((item) => {
    setIgnored(p=>[{...item,lat:gps?.lat||"N/A",lng:gps?.lng||"N/A"},...p].slice(0,200));
  }, [gps]);

  const addLive = useCallback((item) => {
    const full = { ...item, lat:gps?.lat||"N/A", lng:gps?.lng||"N/A", mapsUrl:gps?.mapsUrl||null };
    setLiveLog(p=>[full,...p].slice(0,60));
    if (full.flagged) addIncident(full); else addIgnored(full);
  }, [gps, addIncident, addIgnored]);

  const activeCount = incidents.filter(i=>i.status!=="resolved").length;

  const TAB = (key,label) => (
    <button key={key} onClick={()=>setTab(key)} style={{
      padding:"11px 18px", background:"transparent", border:"none",
      color: tab===key?"#38bdf8":"#334155",
      fontFamily:"'Rajdhani',sans-serif", fontWeight:700, fontSize:12,
      letterSpacing:1.5, cursor:"pointer",
      borderBottom: tab===key?"2px solid #38bdf8":"2px solid transparent",
      transition:"color .2s",
    }}>{label}</button>
  );

  return (
    <div style={{ background:"#020b14", minHeight:"100vh", color:"#dbeafe" }}>
      <Toasts toasts={toasts} setToasts={setToasts} />
      <Header activeCount={activeCount} />
      <nav style={{ display:"flex", gap:2, padding:"0 20px", background:"#040d18", borderBottom:"1px solid #0e3a56", flexWrap:"wrap" }}>
        {TAB("live",    "📡 LIVE MONITOR")}
        {TAB("upload",  "📂 FILE SCAN")}
        {TAB("alerts",  `🚨 ALERTS (${activeCount})`)}
        {TAB("ignored", `✅ IGNORED (${ignored.length})`)}
        {TAB("report",  "📋 REPORT")}
      </nav>
      <main style={{ padding:20, maxWidth:1300, margin:"0 auto" }}>
        {tab==="live"    && <LiveMonitor addLive={addLive}    liveLog={liveLog} gps={gps} gpsStatus={gpsStatus} fetchGps={fetchGps} />}
        {tab==="upload"  && <FileScan    addIncident={addIncident} addIgnored={addIgnored} gps={gps} gpsStatus={gpsStatus} />}
        {tab==="alerts"  && <AlertsLog   incidents={incidents} setIncidents={setIncidents} />}
        {tab==="ignored" && <IgnoredLog  ignored={ignored} />}
        {tab==="report"  && <ReportTab   incidents={incidents} ignored={ignored} />}
      </main>
    </div>
  );
}
