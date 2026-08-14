// @ts-nocheck
import React, { useState, useRef, useEffect } from "react";
import { supabase } from "./supabase";

/* ---------------------------------------------------------
   SkillBridge — Dual Portal: Applicant + Company
   Brand tokens: navy #11203b · gold #d4a83c · cream #faf7ef · green #167a44
--------------------------------------------------------- */

const ROLES = [
  { id: "sales",  label: "Sales Manager",    competencies: ["Pipeline & Target Management","Negotiation","Team Leadership","Client Communication","Strategic Thinking"] },
  { id: "hr",     label: "Human Resources",   competencies: ["Employee Relations","Recruiting & Screening","Policy & Compliance","Conflict Resolution","Communication"] },
  { id: "data",   label: "Data Analyst",      competencies: ["Analytical Reasoning","Tools (SQL/Excel/BI)","Attention to Detail","Data Storytelling","Problem Solving"] },
  { id: "other",  label: "Other role",        competencies: ["Role Knowledge","Communication","Problem Solving","Reliability","Professionalism"] },
];

const QUESTIONS_TARGET  = 10;
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const OPENROUTER_MODEL   = "anthropic/claude-sonnet-4-5";
const STORAGE_KEY        = "sb_candidates_v1";

/* ─── helpers ─── */

function cleanResponse(text) {
  return text.replace(/<budget:[^>]+>.*?<\/budget:[^>]+>/gs, "").trim();
}
function cleanJson(text) {
  const s = cleanResponse(text).replace(/```json/gi,"").replace(/```/g,"").trim();
  return JSON.parse(s);
}
function fmtDate(d) {
  return d.toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});
}
function genCertId() {
  return `SB-${new Date().getFullYear()}-${Math.floor(100000+Math.random()*900000)}`;
}
function genId() {
  return Math.random().toString(36).slice(2)+Date.now().toString(36);
}
function scoreColor(s) {
  if (s >= 70) return "#167a44";
  if (s >= 50) return "#d4a83c";
  return "#a13b3b";
}
function tierLabel(t) {
  if (t >= 100) return "Strong Fit";
  if (t >= 70)  return "Good Fit";
  return "Developing";
}

/* ─── Supabase helpers ─── */

async function loadCandidates() {
  try {
    const { data, error } = await supabase.from('candidates').select('*').eq('published', true).order('created_at', { ascending: false });
    if (error) { console.error("Supabase load error:", error); return []; }
    return (data || []).map(row => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      roleId: row.role_id,
      roleLabel: row.role_label,
      jobSpec: row.job_spec,
      resumeText: row.resume_text,
      resumeName: row.resume_name,
      overall_score: row.overall_score,
      tier: row.tier,
      competencies: row.competencies,
      strengths: row.strengths,
      improvements: row.improvements,
      summary: row.summary,
      certId: row.cert_id,
      location: row.location,
      linkedin: row.linkedin,
      portfolio: row.portfolio,
      experience: row.experience,
      avatarUrl: row.avatar_url,
      date: row.created_at
    }));
  } catch(e) { console.error("Supabase load error:", e); return []; }
}
async function saveCandidate(record) {
  try {
    const dbRecord = {
      name: record.name,
      email: record.email,
      phone: record.phone,
      role_id: record.roleId,
      role_label: record.roleLabel,
      job_spec: record.jobSpec,
      resume_text: record.resumeText,
      resume_name: record.resumeName,
      overall_score: record.overall_score,
      tier: record.tier,
      competencies: record.competencies,
      strengths: record.strengths,
      improvements: record.improvements,
      summary: record.summary,
      cert_id: record.certId,
      user_id: record.userId,
      published: record.published || false,
      location: record.location,
      linkedin: record.linkedin,
      portfolio: record.portfolio,
      experience: record.experience,
      avatar_url: record.avatarUrl,
    };
    const { data, error } = await supabase.from('candidates').insert([dbRecord]).select();
    if (data) return data[0].id;
    if (error) console.error("Supabase save error:", error);
  } catch(e) { console.error("Supabase save error:", e); }
}


async function publishCandidate(id) {
  try {
    const { error } = await supabase.from('candidates').update({ published: true }).eq('id', id);
    if (error) console.error("Supabase publish error:", error);
  } catch(e) { console.error("Supabase publish error:", e); }
}

async function loadProfile(userId) {
  try {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (error && error.code !== 'PGRST116') { console.error(error); return null; }
    return data;
  } catch(e) { return null; }
}

async function saveProfile(userId, email, profileData) {
  const { error } = await supabase.from('profiles').upsert({
    id: userId,
    email: email,
    name: profileData.name,
    phone: profileData.phone,
    resume_name: profileData.resumeName,
    resume_text: profileData.resumeText,
    location: profileData.location,
    linkedin: profileData.linkedin,
    portfolio: profileData.portfolio,
    experience: profileData.experience,
    avatar_url: profileData.avatarUrl,
    updated_at: new Date().toISOString()
  });
  if (error) {
    console.error("Supabase profiles upsert error:", error);
    throw error;
  }
}

/* ──────────────── Certificate Canvas ──────────────── */

function CertificateCanvas({ data, canvasRef }) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;
    const W = 1600, H = 1131;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    const NAVY="#11203b",GOLD="#d4a83c",CREAM="#faf7ef",GREY="#6b7280",GREEN="#167a44";
    ctx.fillStyle = CREAM; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle=NAVY; ctx.lineWidth=3; ctx.strokeRect(28,28,W-56,H-56);
    ctx.strokeStyle=GOLD; ctx.lineWidth=1.5; ctx.strokeRect(40,40,W-80,H-80);
    ctx.fillStyle=NAVY; ctx.fillRect(28,28,W-56,150);
    ctx.fillStyle=GOLD; ctx.font="bold 20px 'Space Grotesk',sans-serif"; ctx.textAlign="center";
    ctx.fillText("CERTIFICATE OF SCREENING & INTERVIEW COMPLETION",W/2,78);
    ctx.fillStyle="#fff"; ctx.font="bold 42px 'Space Grotesk',sans-serif";
    ctx.fillText("CERTIFICATION",W/2,130);
    ctx.fillStyle="#e9d9a0"; ctx.font="16px Inter,sans-serif";
    ctx.fillText(`Certificate No. ${data.certId}`,W/2,160);
    let y=260;
    ctx.fillStyle=GREY; ctx.font="18px Inter,sans-serif"; ctx.fillText("This is to certify that",W/2,y);
    y+=62; ctx.fillStyle=NAVY; ctx.font="bold 50px 'Space Grotesk',sans-serif"; ctx.fillText(data.name,W/2,y);
    y+=14; ctx.strokeStyle=GOLD; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(W/2-260,y); ctx.lineTo(W/2+260,y); ctx.stroke();
    y+=46; ctx.fillStyle=GREY; ctx.font="17px Inter,sans-serif";
    wrapCenter(ctx,`has completed the screening process and a formal autonomous interview for the role of "${data.roleLabel}", and has been assessed and certified as fit for this position.`,W/2,y,W-520,26);
    y+=100;
    ctx.fillStyle=NAVY; ctx.font="bold 22px 'Space Grotesk',sans-serif"; ctx.fillText("ROLE FIT STRENGTH",W/2,y); y+=50;
    const barW=620,barH=34,barX=W/2-barW/2;
    ctx.fillStyle="#e7e9ee"; roundRect(ctx,barX,y,barW,barH,8); ctx.fill();
    const fillW=Math.max((barW*data.tier)/100,barH);
    ctx.fillStyle=data.tier>=100?GREEN:data.tier>=70?GOLD:"#b07d2f"; roundRect(ctx,barX,y,fillW,barH,8); ctx.fill();
    ctx.fillStyle=NAVY; ctx.font="bold 20px Inter,sans-serif"; ctx.textAlign="left";
    ctx.fillText(`${data.tier}%`,barX+barW+16,y+25); ctx.textAlign="center"; y+=90;
    ctx.fillStyle=GREY; ctx.font="15px Inter,sans-serif";
    ctx.fillText(`Issued: ${data.issueDate}`,W/2-220,y);
    ctx.fillStyle="#a13b3b"; ctx.fillText(`Valid Until: ${data.expiryDate}`,W/2+220,y);
    const sx=W/2,sy=H-190;
    ctx.strokeStyle=GOLD; ctx.lineWidth=2.5; ctx.beginPath(); ctx.arc(sx,sy,60,0,Math.PI*2); ctx.stroke();
    ctx.lineWidth=1; ctx.beginPath(); ctx.arc(sx,sy,50,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle=GOLD; ctx.font="bold 12px Inter,sans-serif";
    ctx.fillText("SKILLBRIDGE",sx,sy-4); ctx.fillText("VERIFIED",sx,sy+12);
    ctx.strokeStyle=GREY; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(180,H-130); ctx.lineTo(460,H-130); ctx.stroke();
    ctx.fillStyle=GREY; ctx.font="14px Inter,sans-serif";
    ctx.fillText("Authorized Signature",320,H-108);
    ctx.beginPath(); ctx.moveTo(W-460,H-130); ctx.lineTo(W-180,H-130); ctx.stroke();
    ctx.fillText("Date Issued",W-320,H-108);
    ctx.fillStyle=NAVY; ctx.font="bold 15px Inter,sans-serif";
    ctx.fillText(data.issueDate,W-320,H-140);
  }, [data]);
  return <canvas ref={canvasRef} style={{width:"100%",height:"auto",borderRadius:10,boxShadow:"0 12px 40px rgba(17,32,59,0.25)"}} />;
}

function roundRect(ctx,x,y,w,h,r) {
  ctx.beginPath(); ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}
function wrapCenter(ctx,text,cx,y,maxW,lh) {
  const words=text.split(" "); let line=""; const lines=[];
  for(const w of words){ const t=(line+" "+w).trim(); if(ctx.measureText(t).width>maxW&&line){lines.push(line);line=w;}else line=t; }
  if(line)lines.push(line);
  lines.forEach((l,i)=>ctx.fillText(l,cx,y+i*lh));
}

/* ══════════════════════════════════════════════════════
   ROOT APP
══════════════════════════════════════════════════════ */

export default function App() {
  const [portal, setPortal] = useState("home"); // home | applicant | company

  return (
    <div style={S.page}>
      <style>{FONT_IMPORT}</style>

      {/* ── Header ── */}
      <header style={S.header}>
        <button onClick={()=>setPortal("home")} style={S.brandBtn}>
          <span style={S.brand}>SKILLBRIDGE</span>
          <span style={S.headerTag}>by kconect</span>
        </button>
        <div style={{flex:1}}/>
        {portal !== "home" && (
          <div style={S.headerNav}>
            <button
              style={{...S.navPill, ...(portal==="applicant"?S.navPillActive:{})}}
              onClick={()=>setPortal("applicant")}
            >Applicant Portal</button>
            <button
              style={{...S.navPill, ...(portal==="company"?S.navPillActive:{})}}
              onClick={()=>setPortal("company")}
            >Company Dashboard</button>
          </div>
        )}
      </header>

      {portal === "home"      && <HomePage      onApplicant={()=>setPortal("applicant")} onCompany={()=>setPortal("company")} />}
      {portal === "applicant" && <ApplicantPortal />}
      {portal === "company"   && <CompanyDashboard />}

      <footer style={S.footer}>© 2026 SkillBridge by kconect · AI-Powered Hiring Platform</footer>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   HOME PAGE
══════════════════════════════════════════════════════ */

function HomePage({ onApplicant, onCompany }) {
  return (
    <main style={S.homeMain}>
      <div style={S.homeHero}>
        <div style={S.heroKicker}>AI-POWERED TALENT CERTIFICATION</div>
        <h1 style={S.heroTitle}>The smarter way to<br/>hire and get hired.</h1>
        <p style={S.heroSub}>
          SkillBridge by kconect bridges the gap between top talent and leading companies. 
          Through rigorous, Silicon Valley-style AI interviews, we certify applicants' skills and provide businesses with a verified pool of exceptional candidates.
        </p>
      </div>

      <div style={S.infoSection}>
        <div style={S.infoBlock}>
          <div style={S.infoIcon}>🚀</div>
          <h3 style={S.infoTitle}>For Applicants</h3>
          <p style={S.infoText}>
            Stop sending resumes into the void. Take our intense, role-specific AI interview to prove your practical skills. Pass the threshold, and you'll earn a verified SkillBridge certificate and enter our exclusive talent pool where top companies can contact you directly.
          </p>
        </div>
        <div style={S.infoBlock}>
          <div style={S.infoIcon}>🏢</div>
          <h3 style={S.infoTitle}>For Businesses</h3>
          <p style={S.infoText}>
            Skip the endless resume screening. Access a curated pool of pre-interviewed candidates. Review detailed competency breakdowns, AI-generated strengths and weaknesses, and contact top-tier talent who have already proven their mettle.
          </p>
        </div>
      </div>

      <div style={S.portalGrid}>
        {/* Applicant card */}
        <div style={S.portalCard} onClick={onApplicant}>
          <div style={S.portalIcon}>🎯</div>
          <div style={S.portalCardBadge}>APPLICANT PORTAL</div>
          <h2 style={S.portalCardTitle}>Apply & Get Certified</h2>
          <p style={S.portalCardSub}>
            Complete a structured AI interview for your target role. Receive a verified
            score and downloadable certificate that employers trust.
          </p>
          <div style={S.portalCardSteps}>
            {["Fill your profile & upload CV","Complete 10-question AI interview","Get scored & certified instantly"].map((s,i)=>(
              <div key={i} style={S.portalStep}><span style={S.portalStepNum}>{i+1}</span>{s}</div>
            ))}
          </div>
          <button style={S.portalBtn}>Start My Application →</button>
        </div>

        {/* Company card */}
        <div style={{...S.portalCard,...S.portalCardDark}} onClick={onCompany}>
          <div style={S.portalIcon}>💼</div>
          <div style={{...S.portalCardBadge,...S.portalCardBadgeDark}}>COMPANY DASHBOARD</div>
          <h2 style={{...S.portalCardTitle,color:"#fff"}}>Search Talent Pool</h2>
          <p style={{...S.portalCardSub,color:"#b8c4d4"}}>
            Browse pre-screened, AI-interviewed candidates filtered by role and score.
            View CVs and contact top talent directly.
          </p>
          <div style={S.portalCardSteps}>
            {["Filter candidates by role","View scores & competency breakdown","Email or call candidates directly"].map((s,i)=>(
              <div key={i} style={{...S.portalStep,color:"#cbd5e1"}}><span style={{...S.portalStepNum,background:"#d4a83c",color:"#11203b"}}>{i+1}</span>{s}</div>
            ))}
          </div>
          <button style={{...S.portalBtn,...S.portalBtnGold}}>Open Dashboard →</button>
        </div>
      </div>

      <div style={S.homeStats}>
        {[["AI-Powered","Interviews"],["Verified","Scores"],["Instant","Certificates"],["Direct","Contact"]].map(([n,l],i)=>(
          <div key={i} style={S.statItem}>
            <div style={S.statIcon}>{["🤖","✅","📜","📞"][i]}</div>
            <div style={S.statLabel}>{n}</div>
            <div style={S.statSub}>{l}</div>
          </div>
        ))}
      </div>
    </main>
  );
}


async function uploadAvatar(file, userId) {
  if (!file) return null;
  if (file.size > 5 * 1024 * 1024) {
    alert("Image size must be less than 5MB");
    return null;
  }
  
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random()}.${fileExt}`;
  const filePath = `${userId}/${fileName}`;
  
  const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
  if (uploadError) {
    console.error('Error uploading avatar:', uploadError);
    alert('Failed to upload image: ' + uploadError.message + '\n\nPlease ensure the "avatars" bucket exists and your SQL script was successfully executed.');
    return null;
  }
  
  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
  return data.publicUrl;
}
/* ══════════════════════════════════════════════════════
   APPLICANT PORTAL  (interview flow)
══════════════════════════════════════════════════════ */


function ApplicantPortal() {
  const [session, setSession] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ email: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authInit, setAuthInit] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthInit(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleAuth(e) {
    e.preventDefault();
    setAuthBusy(true); setAuthError("");
    try {
      if (authMode === "signup") {
        const { error } = await supabase.auth.signUp({ email: authForm.email, password: authForm.password });
        if (error) throw error;
        setAuthError("Check your email for the confirmation link, or log in if auto-confirm is enabled.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authForm.email, password: authForm.password });
        if (error) throw error;
      }
    } catch(err) {
      setAuthError(err.message);
    } finally {
      setAuthBusy(false);
    }
  }

  if (authInit) return <main style={S.main}><div style={S.card}>Loading...</div></main>;

  if (!session) {
    return (
      <main style={S.main}>
        <div style={S.card}>
          <h2 style={S.cardTitle}>{authMode === "login" ? "Applicant Login" : "Applicant Sign Up"}</h2>
          <p style={S.cardSub}>Sign in to manage your profile and take certification interviews.</p>
          <form onSubmit={handleAuth}>
            <Field label="Email">
              <input style={S.input} type="email" required value={authForm.email} onChange={e=>setAuthForm(p=>({...p,email:e.target.value}))} />
            </Field>
            <Field label="Password">
              <input style={S.input} type="password" required value={authForm.password} onChange={e=>setAuthForm(p=>({...p,password:e.target.value}))} />
            </Field>
            {authError && <div style={{...S.errorBox, background: authError.includes("Check your email") ? "#f0fdf4" : "#fef2f2", color: authError.includes("Check your email") ? "#166534" : "#991b1b"}}>{authError}</div>}
            <button style={S.primaryBtn} type="submit" disabled={authBusy}>
              {authBusy ? "Please wait..." : authMode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>
          <button style={{...S.linkBtn, marginTop: 16}} onClick={() => { setAuthMode(m => m === "login" ? "signup" : "login"); setAuthError(""); }}>
            {authMode === "login" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </main>
    );
  }

  return <ApplicantDashboard session={session} />;
}

const TIME_PER_Q = 300; // seconds per question

function ApplicantDashboard({ session }) {
  const [tab, setTab] = useState("profile"); // profile | certification
  const [step, setStep] = useState("apply"); // apply | interview | scoring | results | certificate
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [form, setForm] = useState({
    name:"", email: session.user.email, phone:"", roleId:"sales",
    customRole:"", jobSpec:"", resumeName:"", resumeText:"",
    location: "", linkedin: "", portfolio: "", experience: "", avatarUrl: ""
  });
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [answerDraft, setAnswerDraft] = useState("");
  const [questionCount, setQuestionCount] = useState(0);
  const [result, setResult] = useState(null);
  const [cert, setCert] = useState(null);
  const [candidateId, setCandidateId] = useState(null);
  const [publishedStatus, setPublishedStatus] = useState("unpublished");
  const [emailStatus, setEmailStatus] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  const canvasRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    async function initProfile() {
      const data = await loadProfile(session.user.id);
      if (data) {
        setForm(p => ({
          ...p,
          name: data.name || "",
          phone: data.phone || "",
          resumeName: data.resume_name || "",
          resumeText: data.resume_text || "",
          location: data.location || "",
          linkedin: data.linkedin || "",
          portfolio: data.portfolio || "",
          experience: data.experience || "",
          avatarUrl: data.avatar_url || ""
        }));
      }
      setProfileLoading(false);
    }
    initProfile();
  }, [session]);

  useEffect(()=>{ chatEndRef.current?.scrollIntoView({behavior:"smooth"}); },[messages]);

  const role = ROLES.find(r=>r.id===form.roleId)||ROLES[0];
  const roleLabel = form.roleId==="other" ? (form.customRole||"the applied role") : role.label;

  function update(f,v){ setForm(p=>({...p,[f]:v})); }

  async function loadPdfJs() {
    return new Promise((resolve, reject) => {
      if (window.pdfjsLib) {
        resolve(window.pdfjsLib);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js";
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";
        resolve(window.pdfjsLib);
      };
      script.onerror = () => reject(new Error("Failed to load PDF library from CDN."));
      document.head.appendChild(script);
    });
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]; if(!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'doc', 'docx'].includes(ext)) {
      alert("Resume must be a PDF or Word document (.pdf, .doc, .docx)");
      return;
    }
    try {
      let extractedText = "";
      if(ext === "pdf") {
        const pdfjsLib = await loadPdfJs();
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
        let text = "";
        for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map(item => item.str).join(" ") + "\n";
        }
        extractedText = text.trim();
      } else if(ext === "docx" || ext === "doc"){
        const m = await import("mammoth");
        extractedText = ((await m.extractRawText({arrayBuffer:await file.arrayBuffer()})).value||"").trim();
      }
      update("resumeName", file.name);
      update("resumeText", extractedText.slice(0, 4000));
    } catch(err) {
      console.error("Document parsing error:", err);
      update("resumeName", file.name);
      update("resumeText", "");
    }
  }

  async function saveMyProfile() {
    if(!form.name || !form.phone) {
      alert("Please fill in your Full Name and Phone number.");
      return;
    }
    setBusy(true);
    try {
      await saveProfile(session.user.id, session.user.email, form);
      alert("Profile saved successfully.");
    } catch(e) {
      alert("Failed to save profile: " + (e.message || "Unknown error."));
    } finally {
      setBusy(false);
    }
  }

  async function deleteMyAccount() {
    setBusy(true);
    try {
      await supabase.from('profiles').delete().eq('id', session.user.id);
      await supabase.auth.signOut();
    } catch(e) {
      alert("Error deleting account: " + (e.message || "Unknown error."));
    } finally {
      setBusy(false);
    }
  }

  async function callLLM(system, msgs) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions",{
      method:"POST",
      headers:{
        "Authorization":`Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type":"application/json",
        "HTTP-Referer":window.location.origin,
        "X-Title":"SkillBridge by kconect",
      },
      body:JSON.stringify({
        model:OPENROUTER_MODEL,
        messages:[{role:"system",content:system},...msgs.map(m=>({role:m.role==="assistant"?"assistant":"user",content:m.content}))],
      }),
    });
    if(!res.ok){ const t=await res.text(); throw new Error(`OpenRouter ${res.status}: ${t}`); }
    return cleanResponse((await res.json()).choices[0].message.content);
  }

  function interviewSystem() {
    return [
      `You are an elite, notoriously rigorous technical interviewer at a top-tier Silicon Valley company (e.g. FAANG/MAANG).`,
      `You expect excellence. Your questions are extremely difficult, deeply practical, and designed to stress-test the candidate's actual applied knowledge in the field, not just theory.`,
      `Candidate: ${form.name}. Role: ${roleLabel}. Job spec: ${form.jobSpec}`,
      form.resumeText?`Resume excerpt: ${form.resumeText.slice(0,1500)}`:`No resume provided.`,
      `Competencies to probe: ${role.competencies.join(", ")}.`,
      `Rules: ONE concise, intense question per turn. Pose complex, real-world, high-stakes scenarios or technical edge-cases. Push for specific, actionable answers. No preamble, no pleasantries, no meta-commentary. Under 70 words. Do not answer your own question.`,
    ].join("\n");
  }

  async function startInterview() {
    setError("");
    if(!form.name || !form.phone){
      setError("Please fill in your Full Name and Phone number on the Profile page first.");
      return;
    }
    if(!form.jobSpec){
      setError("Please paste or describe the job specification you're applying for.");
      return;
    }
    setBusy(true);
    // Save profile silently — don't block interview on save failure
    try { await saveProfile(session.user.id, session.user.email, form); } catch(e) { console.warn("Profile auto-save failed:", e); }
    setStep("interview");
    try {
      const text = await callLLM(interviewSystem(),[{role:"user",content:"Begin the interview. Greet the candidate briefly and ask your first question."}]);
      setMessages([{role:"assistant",content:text.trim()}]);
      setQuestionCount(1);
    } catch(e){ setError("Could not start interview: "+(e.message||"Unknown")); setStep("apply"); }
    setBusy(false);
  }

  async function submitAnswer(forcedText) {
    const isForced = typeof forcedText === 'string';
    const textToSubmit = isForced ? forcedText : answerDraft;
    if(!textToSubmit.trim()||busy) return;
    const newMsgs = [...messages,{role:"user",content:textToSubmit.trim()}];
    setMessages(newMsgs); setAnswerDraft(""); setBusy(true);
    if(questionCount>=QUESTIONS_TARGET){ await finishAndScore(newMsgs); setBusy(false); return; }
    try {
      const text = await callLLM(interviewSystem(),newMsgs);
      setMessages(cur=>[...cur,{role:"assistant",content:text.trim()}]);
      setQuestionCount(c=>c+1);
    } catch(e){ setError("Connection issue — please try again."); }
    setBusy(false);
  }

  async function finishAndScore(finalMsgs) {
    setStep("scoring");
    try {
      const transcript = finalMsgs.map(m=>`${m.role==="assistant"?"Interviewer":"Candidate"}: ${m.content}`).join("\n\n");
      const scoringSystem = [
        `You are an expert hiring assessor evaluating a completed interview for "${roleLabel}".`,
        `Job spec: ${form.jobSpec}`,
        `Competencies (score 0-100 each): ${role.competencies.join(", ")}.`,
        `Respond ONLY with raw JSON, no markdown fences:`,
        `{"overall_score":number,"tier":50|70|100,"competencies":[{"name":string,"score":number,"comment":string}],"strengths":[string,string],"improvements":[string,string],"summary":string}`,
        `"tier" = nearest of 50,70,100. Be rigorous.`,
      ].join("\n");
      const parsed = cleanJson(await callLLM(scoringSystem,[{role:"user",content:`Transcript:\n\n${transcript}`}]));
      setResult(parsed);
      let newCert = null;
      if(parsed.overall_score>=40){
        const issue=new Date(), expiry=new Date(issue);
        expiry.setFullYear(expiry.getFullYear()+1);
        newCert={
          certId:genCertId(), name:form.name, email:form.email, roleLabel,
          tier:parsed.tier, overall_score:parsed.overall_score,
          issueDate:fmtDate(issue), expiryDate:fmtDate(expiry),
          issueDateISO:issue.toISOString(), expiryDateISO:expiry.toISOString(),
        };
        setCert(newCert);
      }
      const insertedId = await saveCandidate({
        userId: session.user.id,
        published: false,
        name:form.name, email:form.email, phone:form.phone,
        roleId:form.roleId, roleLabel, jobSpec:form.jobSpec,
        resumeText:form.resumeText, resumeName:form.resumeName,
        location:form.location, linkedin:form.linkedin, portfolio:form.portfolio, experience:form.experience, avatarUrl:form.avatarUrl,
        overall_score:parsed.overall_score, tier:parsed.tier,
        competencies:parsed.competencies, strengths:parsed.strengths,
        improvements:parsed.improvements, summary:parsed.summary,
        certId: newCert ? newCert.certId : null
      });
      if (insertedId) setCandidateId(insertedId);
      setStep("results");
    } catch(e){ setError("Scoring failed. Please try again."); setStep("interview"); }
  }

  function downloadCertificate() {
    const c=canvasRef.current; if(!c) return;
    const a=document.createElement("a");
    a.download=`SkillBridge-${cert.certId}.png`; a.href=c.toDataURL("image/png"); a.click();
  }

  async function handlePublish() {
    if (!candidateId) return;
    setPublishedStatus("publishing");
    await publishCandidate(candidateId);
    setPublishedStatus("published");
  }

  if (profileLoading) return <main style={S.main}><div style={S.card}>Loading profile...</div></main>;

  return (
    <main style={S.main}>
      {/* Top bar */}
      <div style={S.portalTopBar}>
        <div style={S.portalUserInfo}>
          {form.avatarUrl && <img src={form.avatarUrl} alt="avatar" style={S.portalAvatar} />}
          <span style={{color:"#6b7280", fontSize:13}}>{session.user.email}</span>
        </div>
        <button style={S.linkBtn} onClick={()=>supabase.auth.signOut()}>Sign Out</button>
      </div>

      {/* Tab nav */}
      <div style={S.tabNav}>
        <button style={{...S.tabBtn, ...(tab==="profile" ? S.tabBtnActive : {})}} onClick={()=>setTab("profile")}>
          👤 My Profile
        </button>
        <button style={{...S.tabBtn, ...(tab==="certification" ? S.tabBtnActive : {})}} onClick={()=>{ setTab("certification"); setStep("apply"); setError(""); }}>
          🎓 Certification
        </button>
      </div>

      {/* ── Profile Page ── */}
      {tab==="profile" && (
        <ProfilePage
          form={form}
          update={update}
          session={session}
          busy={busy}
          avatarUploading={avatarUploading}
          setAvatarUploading={setAvatarUploading}
          handleFile={handleFile}
          onSave={saveMyProfile}
          onDeleteRequest={()=>setShowDeleteModal(true)}
        />
      )}

      {/* ── Certification Page ── */}
      {tab==="certification" && (
        <div>
          {step==="apply" && (
            <ApplyForm form={form} update={update} handleFile={handleFile}
              onSubmit={startInterview} error={error} busy={busy} onCancel={()=>setTab("profile")} />
          )}
          {step==="interview" && (
            <Interview messages={messages} answerDraft={answerDraft}
              setAnswerDraft={setAnswerDraft} onSubmit={submitAnswer}
              busy={busy} questionCount={Math.min(questionCount,QUESTIONS_TARGET)}
              total={QUESTIONS_TARGET} chatEndRef={chatEndRef} error={error}
              voiceMode={voiceMode} onToggleVoice={()=>setVoiceMode(v=>!v)}
              timePerQ={TIME_PER_Q} />
          )}
          {step==="scoring" && <Scoring />}
          {step==="results" && result && (
            <Results result={result} cert={cert} roleLabel={roleLabel}
              onViewCert={()=>setStep("certificate")}
              onRestart={()=>{ setStep("apply"); setError(""); }}
              onPublish={handlePublish}
              publishedStatus={publishedStatus} />
          )}
          {step==="certificate" && cert && (
            <CertificateView cert={cert} canvasRef={canvasRef}
              onDownload={downloadCertificate} emailStatus={emailStatus}
              onEmail={()=>{ setEmailStatus("sending"); setTimeout(()=>setEmailStatus("sent"),900); }}
              onBack={()=>setStep("results")} />
          )}
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <DeleteAccountModal
          onConfirm={deleteMyAccount}
          onCancel={()=>setShowDeleteModal(false)}
          busy={busy}
        />
      )}
    </main>
  );
}

/* ── Profile Page ── */
function ProfilePage({ form, update, session, busy, avatarUploading, setAvatarUploading, handleFile, onSave, onDeleteRequest }) {
  return (
    <div style={{display:"flex", flexDirection:"column", gap:20}}>
      {/* Profile card */}
      <div style={S.card}>
        <h2 style={S.cardTitle}>My Profile</h2>
        <p style={S.cardSub}>Your personal details are stored securely and used in your certification interviews.</p>

        {/* Avatar section */}
        <div style={S.profileAvatarRow}>
          <div style={S.profileAvatarWrap}>
            {form.avatarUrl
              ? <img src={form.avatarUrl} alt="Profile" style={S.profileAvatarImg} />
              : <div style={S.profileAvatarPlaceholder}>👤</div>
            }
          </div>
          <div style={{flex:1}}>
            <div style={{fontWeight:700, fontSize:16, marginBottom:4}}>{form.name || "Your Name"}</div>
            <div style={{fontSize:13, color:"#6b7280", marginBottom:10}}>{session.user.email}</div>
            <label style={S.uploadPhotoBtn}>
              {avatarUploading ? "Uploading..." : "📷 Change Photo"}
              <input type="file" accept="image/*" style={{display:"none"}} onChange={async e => {
                const file = e.target.files?.[0];
                if(!file) return;
                if (file.size > 5 * 1024 * 1024) { alert("Image must be under 5MB"); return; }
                setAvatarUploading(true);
                const url = await uploadAvatar(file, session.user.id);
                if (url) update("avatarUrl", url);
                setAvatarUploading(false);
              }} />
            </label>
          </div>
        </div>

        <div style={S.divider} />

        {/* Fields */}
        <div style={S.profileGrid}>
          <Field label="Full Name *">
            <input style={S.input} value={form.name} onChange={e=>update("name",e.target.value)} placeholder="Jane Doe" />
          </Field>
          <Field label="Phone Number *">
            <input style={S.input} value={form.phone} onChange={e=>update("phone",e.target.value)} placeholder="+234 80..." />
          </Field>
          <Field label="Location">
            <input style={S.input} value={form.location} onChange={e=>update("location",e.target.value)} placeholder="e.g., Lagos, Nigeria" />
          </Field>
          <Field label="Years of Experience">
            <input style={S.input} value={form.experience} onChange={e=>update("experience",e.target.value)} placeholder="e.g., 5 years" />
          </Field>
          <Field label="LinkedIn URL">
            <input style={S.input} value={form.linkedin} onChange={e=>update("linkedin",e.target.value)} placeholder="https://linkedin.com/in/..." />
          </Field>
          <Field label="Portfolio URL">
            <input style={S.input} value={form.portfolio} onChange={e=>update("portfolio",e.target.value)} placeholder="https://yourportfolio.com" />
          </Field>
        </div>

        <Field label="CV / Résumé (PDF or Word, max 5MB)">
          <input style={S.input} type="file" accept=".pdf,.doc,.docx" onChange={handleFile} />
          {form.resumeName && <div style={{fontSize:12, marginTop:5, color:"#16a34a"}}>✓ {form.resumeName} loaded</div>}
        </Field>

        <button style={{...S.primaryBtn, marginTop:16}} onClick={onSave} disabled={busy}>
          {busy ? "Saving..." : "Save Profile"}
        </button>
      </div>

      {/* Danger Zone */}
      <div style={S.dangerZone}>
        <div style={S.dangerZoneTitle}>⚠️ Danger Zone</div>
        <p style={S.dangerZoneSub}>Permanently delete your profile and all associated data. This action cannot be undone.</p>
        <button style={S.deleteBtn} onClick={onDeleteRequest}>Delete My Account</button>
      </div>
    </div>
  );
}

/* ── Delete Account Modal ── */
function DeleteAccountModal({ onConfirm, onCancel, busy }) {
  const [phrase, setPhrase] = useState("");
  const CONFIRM_PHRASE = "DELETE MY ACCOUNT";
  const isMatch = phrase.trim() === CONFIRM_PHRASE;
  return (
    <div style={S.modalOverlay} onClick={onCancel}>
      <div style={{...S.modalBox, maxWidth:440, padding:32}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:40, textAlign:"center", marginBottom:12}}>🗑️</div>
        <h2 style={{...S.cardTitle, textAlign:"center", color:"#991b1b"}}>Delete Account</h2>
        <p style={{fontSize:14, color:"#5a5f6b", textAlign:"center", marginBottom:20, lineHeight:1.6}}>
          This will permanently delete your profile data and cannot be reversed.
          To confirm, type the phrase below:
        </p>
        <div style={{background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8, padding:"10px 16px", textAlign:"center", fontWeight:700, fontSize:14, color:"#991b1b", marginBottom:16, letterSpacing:1}}>
          {CONFIRM_PHRASE}
        </div>
        <input
          style={{...S.input, textAlign:"center", marginBottom:20, fontWeight:600}}
          placeholder="Type the phrase above..."
          value={phrase}
          onChange={e=>setPhrase(e.target.value)}
        />
        <div style={{display:"flex", gap:12}}>
          <button style={{...S.secondaryBtn, flex:1}} onClick={onCancel} disabled={busy}>Cancel</button>
          <button
            style={{...S.deleteBtn, flex:1, opacity: isMatch ? 1 : 0.4, cursor: isMatch ? "pointer" : "not-allowed"}}
            onClick={isMatch ? onConfirm : undefined}
            disabled={!isMatch || busy}
          >
            {busy ? "Deleting..." : "Confirm Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}


/* ── Apply form ── */
function ApplyForm({ form, update, handleFile, onSubmit, error, busy, onCancel }) {
  return (
    <div style={S.card}>
      <h2 style={S.cardTitle}>Your Application</h2>
      <p style={S.cardSub}>Fill in your details, upload your CV, and start the AI interview.</p>

      
      

      <Field label="Role you're applying for">
        <select style={S.input} value={form.roleId} onChange={e=>update("roleId",e.target.value)}>
          {ROLES.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
      </Field>
      {form.roleId==="other" && (
        <Field label="Specify the role">
          <input style={S.input} value={form.customRole} onChange={e=>update("customRole",e.target.value)} placeholder="e.g. Logistics Coordinator" />
        </Field>
      )}

      <Field label="Job specification *">
        <textarea style={{...S.input,height:88,resize:"vertical"}} value={form.jobSpec}
          onChange={e=>update("jobSpec",e.target.value)}
          placeholder="Paste or describe the job spec you're being screened against…" />
      </Field>

      

      {error && <div style={S.errorBox}>{error}</div>}
      
      <div style={{display:"flex", gap:16, marginTop:24}}>
        <button style={S.secondaryBtn} onClick={onCancel} disabled={busy}>Cancel</button>
        <button style={S.primaryBtn} onClick={onSubmit} disabled={busy}>
          
        {busy ? "Starting interview…" : "Submit & Start AI Interview →"}
      
        </button>
      </div>
    </div>
  );
}

/* ── Interview ── */
function Interview({ messages, answerDraft, setAnswerDraft, onSubmit, busy, questionCount, total, chatEndRef, error, voiceMode, onToggleVoice, timePerQ }) {
  const [timeLeft, setTimeLeft] = useState(timePerQ);
  const [listening, setListening] = useState(false);
  const timerRef = useRef(null);
  const recognitionRef = useRef(null);
  const lastMsgCount = useRef(messages.length);
  const voiceSupported = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const draftRef = useRef(answerDraft);
  useEffect(() => { draftRef.current = answerDraft; }, [answerDraft]);

  // Reset & start timer whenever a new AI message arrives
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== "assistant") return;
    setTimeLeft(timePerQ);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          const finalAns = draftRef.current.trim();
          onSubmit(finalAns ? finalAns + " [Time expired]" : "[No answer provided — time expired]");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [messages.length]);

  // Pause timer while AI is generating
  useEffect(() => {
    if (busy) {
      clearInterval(timerRef.current);
    }
  }, [busy]);

  // TTS: speak AI question when voice mode is on
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (!voiceMode || !lastMsg || lastMsg.role !== "assistant") return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(lastMsg.content);
    utt.rate = 0.95;
    utt.pitch = 1;
    window.speechSynthesis.speak(utt);
  }, [messages.length, voiceMode]);

  // Stop TTS when voice mode is turned off
  useEffect(() => {
    if (!voiceMode) window.speechSynthesis.cancel();
  }, [voiceMode]);

  function replayTTS() {
    const lastMsg = messages.filter(m => m.role === "assistant").pop();
    if (!lastMsg) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(lastMsg.content);
    utt.rate = 0.95;
    window.speechSynthesis.speak(utt);
  }

  function startListening() {
    if (!voiceSupported) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    
    const existingText = answerDraft.trim() ? answerDraft.trim() + " " : "";

    rec.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join("");
      setAnswerDraft(existingText + transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  // Timer color
  const pct = timeLeft / timePerQ;
  const timerColor = pct > 0.33 ? "#167a44" : pct > 0.11 ? "#d4a83c" : "#a13b3b";
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const timerLabel = `${mins}:${secs.toString().padStart(2,"0")}`;

  // SVG ring
  const R = 22, CIRC = 2 * Math.PI * R;
  const dash = CIRC * pct;

  return (
    <div style={S.card}>
      {/* Header row */}
      <div style={S.interviewHead}>
        <div>
          <h2 style={{...S.cardTitle, marginBottom:0}}>Live Interview</h2>
          <div style={S.progressTag}>Question {questionCount} of {total}</div>
        </div>
        <div style={{display:"flex", alignItems:"center", gap:14}}>
          {/* Countdown ring */}
          {!busy && (
            <div style={{display:"flex", alignItems:"center", gap:6}}>
              <svg width={54} height={54}>
                <circle cx={27} cy={27} r={R} fill="none" stroke="#eee8d8" strokeWidth={4}/>
                <circle cx={27} cy={27} r={R} fill="none" stroke={timerColor} strokeWidth={4}
                  strokeDasharray={`${dash} ${CIRC}`} strokeLinecap="round"
                  transform="rotate(-90 27 27)" style={{transition:"stroke-dasharray 1s linear, stroke 0.5s"}}/>
                <text x={27} y={31} textAnchor="middle" fontSize={11} fontWeight={700}
                  fontFamily="Inter,sans-serif" fill={timerColor}>{timerLabel}</text>
              </svg>
            </div>
          )}
          {/* Voice toggle */}
          <button
            title={voiceSupported ? (voiceMode ? "Switch to Text Mode" : "Switch to Voice Mode") : "Voice not supported in this browser"}
            style={{...S.voiceToggleBtn, ...(voiceMode ? S.voiceToggleBtnOn : {}), opacity: voiceSupported ? 1 : 0.35, cursor: voiceSupported ? "pointer" : "default"}}
            onClick={voiceSupported ? onToggleVoice : undefined}
          >
            {voiceMode ? "🔊 Voice" : "💬 Text"}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={S.progressTrack}>
        <div style={{...S.progressFill,width:`${(questionCount/total)*100}%`}} />
      </div>

      {/* Chat messages */}
      <div style={S.chatBox}>
        {messages.map((m,i)=>(
          <div key={i} style={m.role==="assistant"?S.bubbleAI:S.bubbleUser}>
            <div style={S.bubbleLabel}>{m.role==="assistant"?"Interviewer":"You"}</div>
            {m.content}
            {/* Replay TTS button on last AI message in voice mode */}
            {voiceMode && m.role==="assistant" && i===messages.length-1 && (
              <button onClick={replayTTS} style={S.replayBtn}>🔊 Replay</button>
            )}
          </div>
        ))}
        {busy && <div style={S.bubbleAI}><div style={S.bubbleLabel}>Interviewer</div><span style={S.dots}>···</span></div>}
        <div ref={chatEndRef} />
      </div>

      {error && <div style={S.errorBox}>{error}</div>}

      {/* Input area */}
      {voiceMode ? (
        <div style={S.voiceInputArea}>
          {answerDraft && (
            <div style={S.transcriptBox}>
              <div style={{fontSize:11, color:"#6b7280", marginBottom:4, fontWeight:600}}>TRANSCRIPT</div>
              <div style={{fontSize:14, color:"#11203b", lineHeight:1.6}}>{answerDraft}</div>
            </div>
          )}
          <div style={{display:"flex", gap:10, justifyContent:"center", marginTop:10}}>
            <button
              style={{...S.micBtn, ...(listening ? S.micBtnActive : {})}}
              onMouseDown={startListening}
              onMouseUp={stopListening}
              onTouchStart={startListening}
              onTouchEnd={stopListening}
              disabled={busy}
            >
              {listening ? "🎙 Listening…" : "🎤 Hold to Speak"}
            </button>
            <button style={S.primaryBtnSmall} onClick={onSubmit} disabled={busy||!answerDraft.trim()}>Send ↵</button>
          </div>
          {listening && <div style={S.listeningPulse}>● Recording — release to stop</div>}
        </div>
      ) : (
        <div style={S.answerRow}>
          <textarea style={{...S.input,height:70,resize:"none",flex:1}} placeholder="Type your answer…"
            value={answerDraft} onChange={e=>setAnswerDraft(e.target.value)}
            onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();onSubmit();} }}
            disabled={busy} />
          <button style={S.primaryBtnSmall} onClick={onSubmit} disabled={busy||!answerDraft.trim()}>Send</button>
        </div>
      )}
    </div>
  );
}

/* ── Scoring ── */
function Scoring() {
  return (
    <div style={S.card}>
      <div style={S.scoringWrap}>
        <div style={S.spinner} />
        <h2 style={S.cardTitle}>Scoring your interview…</h2>
        <p style={S.cardSub}>Evaluating responses against role competencies.</p>
      </div>
    </div>
  );
}

/* ── Results ── */
function Results({ result, cert, roleLabel, onViewCert, onRestart, onPublish, publishedStatus }) {
  const certified = result.overall_score >= 40;
  return (
    <div style={S.card}>
      <h2 style={S.cardTitle}>{certified?"Interview Complete":"Interview Complete — Not Yet Certified"}</h2>
      <div style={S.scoreHero}>
        <div style={{...S.scoreNum,color:scoreColor(result.overall_score)}}>{result.overall_score}</div>
        <div style={S.scoreLabel}>Overall Score · {roleLabel}</div>
        {cert && <div style={S.tierBadge(result.tier)}>{tierLabel(result.tier)}</div>}
      </div>
      <div style={S.competencyList}>
        {(result.competencies||[]).map((c,i)=>(
          <div key={i} style={S.compRow}>
            <div style={S.compName}>{c.name}</div>
            <div style={S.compTrack}><div style={{...S.compFill,width:`${c.score}%`,background:scoreColor(c.score)}} /></div>
            <div style={S.compScore}>{c.score}%</div>
          </div>
        ))}
      </div>
      <div style={S.twoCol}>
        <div><div style={S.miniTitle}>✅ Strengths</div>
          <ul style={S.list}>{(result.strengths||[]).map((s,i)=><li key={i}>{s}</li>)}</ul></div>
        <div><div style={S.miniTitle}>📈 Areas to improve</div>
          <ul style={S.list}>{(result.improvements||[]).map((s,i)=><li key={i}>{s}</li>)}</ul></div>
      </div>
      {result.summary && <p style={S.summary}>{result.summary}</p>}
      
      {certified && cert && (
        <div style={{ padding: "20px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", marginTop: "20px", marginBottom: "20px" }}>
          <h3 style={{ margin: "0 0 10px 0", color: "#166534", fontSize: "16px" }}>Publish to Talent Pool</h3>
          <p style={{ margin: "0 0 15px 0", color: "#15803d", fontSize: "14px" }}>
            Make your score and certificate visible to top companies searching for talent.
          </p>
          <button 
            style={publishedStatus === "published" ? S.secondaryBtn : S.primaryBtn} 
            onClick={onPublish} 
            disabled={publishedStatus === "publishing" || publishedStatus === "published"}
          >
            {publishedStatus === "published" ? "✅ Published to Talent Pool" : publishedStatus === "publishing" ? "Publishing..." : "Publish My Score & Certificate"}
          </button>
        </div>
      )}

      {certified && cert
        ? <button style={S.secondaryBtn} onClick={onViewCert}>View My Certificate →</button>
        : <div style={S.errorBox}>Score below certification threshold. Prepare further and reapply.</div>
      }
      <button style={S.linkBtn} onClick={onRestart}>Back to Dashboard</button>
    </div>
  );
}

/* ── Certificate View ── */
function CertificateView({ cert, canvasRef, onDownload, onEmail, emailStatus, onBack }) {
  return (
    <div style={S.card}>
      <h2 style={S.cardTitle}>Your Certificate</h2>
      <p style={S.cardSub}>Valid for one year — expires {cert.expiryDate}.</p>
      <CertificateCanvas data={cert} canvasRef={canvasRef} />
      <div style={S.certActions}>
        <button style={S.primaryBtn} onClick={onDownload}>⬇ Download PNG</button>
        <button style={S.secondaryBtn} onClick={onEmail} disabled={emailStatus==="sending"}>
          {emailStatus==="sent"?"✅ Emailed":emailStatus==="sending"?"Sending…":"✉ Email me a copy"}
        </button>
      </div>
      <button style={S.linkBtn} onClick={onBack}>← Back to results</button>
    </div>
  );
}

/* ── Shared form helpers ── */
function Field({ label, children }) {
  return <div style={S.field}><label style={S.label}>{label}</label>{children}</div>;
}
function Row({ children }) { return <div style={S.row}>{children}</div>; }

/* ══════════════════════════════════════════════════════
   COMPANY DASHBOARD
══════════════════════════════════════════════════════ */

function CompanyDashboard() {
  const [candidates, setCandidates] = useState([]);
  const [roleFilter, setRoleFilter] = useState("all");
  const [sort, setSort] = useState("score");
  const [selected, setSelected] = useState(null);
  const [cvTab, setCvTab] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{ 
    async function fetchCands() {
      setLoading(true);
      const data = await loadCandidates();
      setCandidates(data);
      setLoading(false);
    }
    fetchCands();
  },[]);

  const filtered = candidates
    .filter(c => roleFilter==="all" || c.roleId===roleFilter)
    .sort((a,b) => sort==="score" ? b.overall_score-a.overall_score : new Date(b.date)-new Date(a.date));

  return (
    <main style={S.dashMain}>
      {/* ── Top bar ── */}
      <div style={S.dashHeader}>
        <div>
          <h1 style={S.dashTitle}>Talent Pool</h1>
          <p style={S.dashSub}>{loading ? "Loading candidates..." : `${filtered.length} candidate${filtered.length!==1?"s":""} found`}</p>
        </div>
        <div style={S.dashControls}>
          <select style={S.filterSelect} value={roleFilter} onChange={e=>setRoleFilter(e.target.value)}>
            <option value="all">All Roles</option>
            {ROLES.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          <select style={S.filterSelect} value={sort} onChange={e=>setSort(e.target.value)}>
            <option value="score">Highest Score</option>
            <option value="date">Most Recent</option>
          </select>
        </div>
      </div>

      {/* ── No data state ── */}
      {candidates.length===0 && (
        <div style={S.emptyState}>
          <div style={S.emptyIcon}>👥</div>
          <h3 style={S.emptyTitle}>No candidates yet</h3>
          <p style={S.emptySub}>Candidates who complete the AI interview will appear here automatically.</p>
        </div>
      )}

      {/* ── Cards grid ── */}
      <div style={S.candidateGrid}>
        {filtered.map(c=>(
          <CandidateCard key={c.id} candidate={c} onSelect={()=>{setSelected(c);setCvTab(false);}} />
        ))}
      </div>

      {/* ── Profile Modal ── */}
      {selected && (
        <ProfileModal
          candidate={selected}
          cvTab={cvTab}
          setCvTab={setCvTab}
          onClose={()=>setSelected(null)}
        />
      )}
    </main>
  );
}

/* ── Score ring SVG ── */
function ScoreRing({ score, size=72, stroke=7 }) {
  const r = (size-stroke*2)/2;
  const circ = 2*Math.PI*r;
  const dash = circ*(score/100);
  const color = scoreColor(score);
  return (
    <svg width={size} height={size} style={{flexShrink:0}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#eee8d8" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x={size/2} y={size/2+5} textAnchor="middle" fontSize={size*0.24} fontWeight="700"
        fontFamily="'Space Grotesk',sans-serif" fill={color}>{score}</text>
    </svg>
  );
}

/* ── Candidate card ── */
function CandidateCard({ candidate:c, onSelect }) {
  const date = new Date(c.date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
  return (
    <div style={S.candCard} onClick={onSelect}>
      <div style={S.candCardTop}>
        <ScoreRing score={c.overall_score} />
        <div style={{flex:1,minWidth:0}}>
          <div style={{display: "flex", alignItems: "center", gap: "10px"}}>
              {c.avatarUrl && <img src={c.avatarUrl} alt={c.name} style={{width: 32, height: 32, borderRadius: "50%", objectFit: "cover"}} />}
              <div style={S.candName}>{c.name}</div>
            </div>
          <div style={S.candRole}>{c.roleLabel}</div>
          <div style={S.candDate}>{date}</div>
        </div>
        <div style={S.tierPip(c.tier)}>{tierLabel(c.tier)}</div>
      </div>
      <div style={S.candCompBar}>
        {(c.competencies||[]).slice(0,3).map((comp,i)=>(
          <div key={i} style={S.candMiniComp}>
            <div style={S.candMiniLabel}>{comp.name.split(" ")[0]}</div>
            <div style={S.candMiniTrack}><div style={{...S.candMiniFill,width:`${comp.score}%`,background:scoreColor(comp.score)}} /></div>
          </div>
        ))}
      </div>
      <div style={S.candFooter}>
        <a href={`mailto:${c.email}`} onClick={e=>e.stopPropagation()} style={S.contactBtnEmail}>✉ Email</a>
        <a href={`tel:${c.phone}`} onClick={e=>e.stopPropagation()} style={S.contactBtnCall}>📞 Call</a>
        <button style={S.profileBtn}>View Profile →</button>
      </div>
    </div>
  );
}

/* ── Profile modal ── */
function ProfileModal({ candidate:c, cvTab, setCvTab, onClose }) {
  const date = new Date(c.date).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={S.modalBox} onClick={e=>e.stopPropagation()}>

        {/* header */}
        <div style={S.modalHeader}>
          <div style={{display: "flex", alignItems: "center", gap: "16px"}}>
            {c.avatarUrl && <img src={c.avatarUrl} alt={c.name} style={{width: 64, height: 64, borderRadius: "50%", objectFit: "cover"}} />}
            <div>
              <div style={S.modalName}>{c.name}</div>
              <div style={S.modalMeta}>{c.roleLabel} · {date} · {c.certId}</div>
              <div style={{fontSize: 13, color: "#475569", marginTop: 4}}>
                {c.location && <span style={{marginRight: 10}}>📍 {c.location}</span>}
                {c.experience && <span style={{marginRight: 10}}>💼 {c.experience}</span>}
                {c.linkedin && <a href={c.linkedin} target="_blank" rel="noreferrer" style={{marginRight: 10, color: "#1d4ed8", textDecoration: "none"}}>🔗 LinkedIn</a>}
                {c.portfolio && <a href={c.portfolio} target="_blank" rel="noreferrer" style={{color: "#1d4ed8", textDecoration: "none"}}>🌍 Portfolio</a>}
              </div>
            </div>
          </div>
          <button style={S.modalClose} onClick={onClose}>✕</button>
        </div>

        {/* score strip */}
        <div style={S.modalScoreStrip}>
          <ScoreRing score={c.overall_score} size={90} stroke={8} />
          <div>
            <div style={S.modalScoreLabel}>Overall Score</div>
            <div style={S.tierBadgeLg(c.tier)}>{tierLabel(c.tier)} · {c.tier}% Fit</div>
            {c.summary && <p style={S.modalSummary}>{c.summary}</p>}
          </div>
        </div>

        {/* tabs */}
        <div style={S.modalTabs}>
          <button style={{...S.modalTab,...(!cvTab?S.modalTabActive:{})}} onClick={()=>setCvTab(false)}>📊 Assessment</button>
          <button style={{...S.modalTab,...(cvTab?S.modalTabActive:{})}} onClick={()=>setCvTab(true)}>📄 CV / Résumé</button>
        </div>

        {!cvTab ? (
          <div style={S.modalBody}>
            {/* competencies */}
            <div style={S.modalSection}>
              <div style={S.miniTitle}>Competency Scores</div>
              <div style={S.competencyList}>
                {(c.competencies||[]).map((comp,i)=>(
                  <div key={i}>
                    <div style={S.compRow}>
                      <div style={{...S.compName,width:200}}>{comp.name}</div>
                      <div style={S.compTrack}><div style={{...S.compFill,width:`${comp.score}%`,background:scoreColor(comp.score)}} /></div>
                      <div style={S.compScore}>{comp.score}%</div>
                    </div>
                    {comp.comment && <div style={S.compComment}>{comp.comment}</div>}
                  </div>
                ))}
              </div>
            </div>
            {/* strengths / improvements */}
            <div style={S.twoCol}>
              <div style={S.modalSection}>
                <div style={S.miniTitle}>✅ Strengths</div>
                <ul style={S.list}>{(c.strengths||[]).map((s,i)=><li key={i}>{s}</li>)}</ul>
              </div>
              <div style={S.modalSection}>
                <div style={S.miniTitle}>📈 Areas to improve</div>
                <ul style={S.list}>{(c.improvements||[]).map((s,i)=><li key={i}>{s}</li>)}</ul>
              </div>
            </div>
          </div>
        ) : (
          <div style={S.modalBody}>
            <div style={S.miniTitle}>Uploaded CV Content</div>
            {c.resumeText
              ? <pre style={S.cvText}>{c.resumeText}</pre>
              : <div style={S.cvEmpty}>No CV text was extracted for this candidate.</div>}
          </div>
        )}

        {/* contact bar */}
        <div style={S.modalContactBar}>
          <div style={S.modalContactInfo}>
            <span style={S.modalContactItem}>✉ {c.email}</span>
            <span style={S.modalContactItem}>📞 {c.phone}</span>
          </div>
          <div style={S.modalContactBtns}>
            <a href={`mailto:${c.email}`} style={S.contactBtnEmailLg}>✉ Send Email</a>
            <a href={`tel:${c.phone}`} style={S.contactBtnCallLg}>📞 Call Now</a>
          </div>
        </div>

      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   STYLES
══════════════════════════════════════════════════════ */

const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes fadeIn { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
@keyframes pulse { 0%,100% { box-shadow: 0 0 0 4px rgba(17,32,59,0.15); } 50% { box-shadow: 0 0 0 10px rgba(17,32,59,0.08); } }
* { box-sizing: border-box; }
body { margin: 0; }
`;

const S = {
  /* ── Shell ── */
  page:{ fontFamily:"Inter,sans-serif", background:"#f5f1e8", minHeight:"100vh", color:"#11203b", display:"flex", flexDirection:"column" },
  header:{ background:"#11203b", padding:"0 28px", display:"flex", alignItems:"center", gap:14, height:60, position:"sticky", top:0, zIndex:100, boxShadow:"0 2px 12px rgba(0,0,0,0.25)" },
  brandBtn:{ background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"baseline", gap:8, padding:0 },
  brand:{ fontFamily:"'Space Grotesk',sans-serif", color:"#fff", fontWeight:700, letterSpacing:1.5, fontSize:19 },
  headerTag:{ color:"#d4a83c", fontSize:12, fontWeight:600, letterSpacing:0.5 },
  headerNav:{ display:"flex", gap:8 },
  navPill:{ background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.15)", color:"#fff", padding:"7px 16px", borderRadius:20, cursor:"pointer", fontSize:13, fontWeight:500 },
  navPillActive:{ background:"#d4a83c", border:"1px solid #d4a83c", color:"#11203b", fontWeight:700 },
  footer:{ textAlign:"center", padding:16, color:"#9aa0ab", fontSize:12, borderTop:"1px solid #e7e2d3", marginTop:"auto" },

  /* ── Home ── */
  homeMain:{ flex:1, padding:"0 20px 48px" },
  homeHero:{ textAlign:"center", padding:"56px 20px 40px", maxWidth:640, margin:"0 auto" },
  heroKicker:{ color:"#a3823f", fontWeight:700, letterSpacing:2, fontSize:12, marginBottom:10, textTransform:"uppercase" },
  heroTitle:{ fontFamily:"'Space Grotesk',sans-serif", fontSize:42, margin:"0 0 14px", lineHeight:1.15 },
  heroSub:{ color:"#5a5f6b", fontSize:16, maxWidth:580, margin:"0 auto", lineHeight:1.6 },
  infoSection:{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))", gap:24, maxWidth:820, margin:"0 auto 48px", textAlign:"left" },
  infoBlock:{ background:"#fff", padding:32, borderRadius:20, border:"1px solid #e7e2d3", boxShadow:"0 4px 20px rgba(17,32,59,0.04)" },
  infoIcon:{ fontSize:36, marginBottom:16 },
  infoTitle:{ fontFamily:"'Space Grotesk',sans-serif", fontSize:22, margin:"0 0 10px", color:"#11203b" },
  infoText:{ color:"#5a5f6b", fontSize:15, lineHeight:1.6, margin:0 },
  portalGrid:{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:24, maxWidth:820, margin:"0 auto 48px" },
  portalCard:{ background:"#fff", border:"1px solid #e7e2d3", borderRadius:20, padding:32, cursor:"pointer", transition:"transform 0.2s, box-shadow 0.2s", boxShadow:"0 4px 20px rgba(17,32,59,0.07)", animation:"fadeIn 0.4s ease both" },
  portalCardDark:{ background:"#11203b", border:"1px solid #1a2d52" },
  portalIcon:{ fontSize:36, marginBottom:12 },
  portalCardBadge:{ fontSize:11, fontWeight:700, letterSpacing:2, color:"#a3823f", marginBottom:8, textTransform:"uppercase" },
  portalCardBadgeDark:{ color:"#d4a83c" },
  portalCardTitle:{ fontFamily:"'Space Grotesk',sans-serif", fontSize:26, margin:"0 0 10px" },
  portalCardSub:{ color:"#5a5f6b", fontSize:14, lineHeight:1.6, marginBottom:20 },
  portalCardSteps:{ display:"flex", flexDirection:"column", gap:8, marginBottom:24 },
  portalStep:{ display:"flex", alignItems:"center", gap:10, fontSize:13, color:"#3a3f4b" },
  portalStepNum:{ width:22, height:22, borderRadius:"50%", background:"#11203b", color:"#fff", fontSize:11, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
  portalBtn:{ width:"100%", padding:"13px", background:"#11203b", color:"#fff", border:"none", borderRadius:12, fontWeight:700, fontSize:14, cursor:"pointer" },
  portalBtnGold:{ background:"#d4a83c", color:"#11203b" },
  homeStats:{ display:"flex", justifyContent:"center", gap:32, flexWrap:"wrap", maxWidth:640, margin:"0 auto" },
  statItem:{ textAlign:"center" },
  statIcon:{ fontSize:28, marginBottom:4 },
  statLabel:{ fontWeight:700, fontSize:14 },
  statSub:{ color:"#5a5f6b", fontSize:12 },

  /* ── Applicant portal ── */
  main:{ flex:1, padding:"32px 20px", maxWidth:740, margin:"0 auto", width:"100%" },
  card:{ background:"#fff", border:"1px solid #e7e2d3", borderRadius:18, padding:30, boxShadow:"0 8px 30px rgba(17,32,59,0.07)", animation:"fadeIn 0.3s ease" },
  cardTitle:{ fontFamily:"'Space Grotesk',sans-serif", fontSize:24, margin:"0 0 6px" },
  cardSub:{ color:"#5a5f6b", fontSize:14, marginBottom:22 },
  field:{ marginBottom:16, flex:1 },
  row:{ display:"flex", gap:14 },
  label:{ display:"block", fontSize:13, fontWeight:600, marginBottom:6, color:"#3a3f4b" },
  input:{ width:"100%", padding:"11px 13px", borderRadius:9, border:"1.5px solid #e2ddcd", fontSize:14, fontFamily:"Inter,sans-serif", background:"#fdfcf8", outline:"none" },
  fileInput:{ fontSize:13 },
  fileNote:{ fontSize:12, color:"#167a44", marginTop:6 },
  errorBox:{ background:"#fdecec", color:"#a13b3b", padding:"10px 14px", borderRadius:8, fontSize:13, marginBottom:16 },
  primaryBtn:{ background:"#d4a83c", color:"#11203b", border:"none", padding:"14px 26px", borderRadius:12, fontWeight:700, fontSize:15, cursor:"pointer", width:"100%", marginTop:4 },
  primaryBtnSmall:{ background:"#d4a83c", color:"#11203b", border:"none", padding:"10px 18px", borderRadius:9, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" },
  secondaryBtn:{ background:"#fff", color:"#11203b", border:"1.5px solid #11203b", padding:"12px 22px", borderRadius:12, fontWeight:600, cursor:"pointer" },
  linkBtn:{ background:"none", border:"none", color:"#5a5f6b", textDecoration:"underline", cursor:"pointer", marginTop:14, fontSize:14, display:"block", marginInline:"auto" },
  interviewHead:{ display:"flex", justifyContent:"space-between", alignItems:"baseline" },
  progressTag:{ fontSize:13, color:"#5a5f6b", fontWeight:600 },
  progressTrack:{ height:5, background:"#eee8d8", borderRadius:4, marginTop:8, marginBottom:18, overflow:"hidden" },
  progressFill:{ height:"100%", background:"#d4a83c", borderRadius:4, transition:"width .4s" },
  chatBox:{ maxHeight:380, overflowY:"auto", display:"flex", flexDirection:"column", gap:12, marginBottom:16 },
  bubbleAI:{ background:"#11203b", color:"#fff", padding:"12px 14px", borderRadius:"12px 12px 12px 2px", maxWidth:"85%", fontSize:14, lineHeight:1.6 },
  bubbleUser:{ background:"#f1ede0", color:"#11203b", padding:"12px 14px", borderRadius:"12px 12px 2px 12px", maxWidth:"85%", fontSize:14, alignSelf:"flex-end", lineHeight:1.6 },
  bubbleLabel:{ fontSize:10, opacity:0.6, marginBottom:4, fontWeight:700, letterSpacing:0.5, textTransform:"uppercase" },
  dots:{ letterSpacing:3, fontSize:18 },
  answerRow:{ display:"flex", gap:10, alignItems:"flex-start" },
  scoringWrap:{ textAlign:"center", padding:"30px 0" },
  spinner:{ width:44, height:44, border:"4px solid #eee8d8", borderTopColor:"#d4a83c", borderRadius:"50%", margin:"0 auto 20px", animation:"spin 1s linear infinite" },
  scoreHero:{ textAlign:"center", margin:"16px 0 26px" },
  scoreNum:{ fontFamily:"'Space Grotesk',sans-serif", fontSize:64, fontWeight:700, lineHeight:1 },
  scoreLabel:{ color:"#5a5f6b", fontSize:14, marginTop:6 },
  tierBadge:(t)=>({ display:"inline-block", marginTop:8, padding:"4px 14px", borderRadius:20, fontSize:12, fontWeight:700, background: t>=100?"#dcfce7":t>=70?"#fef9c3":"#fee2e2", color: t>=100?"#166534":t>=70?"#854d0e":"#991b1b" }),
  competencyList:{ display:"flex", flexDirection:"column", gap:10, marginBottom:24 },
  compRow:{ display:"flex", alignItems:"center", gap:10 },
  compName:{ fontSize:13, width:190, flexShrink:0, color:"#3a3f4b" },
  compTrack:{ flex:1, height:8, background:"#eee8d8", borderRadius:4, overflow:"hidden" },
  compFill:{ height:"100%", borderRadius:4, transition:"width .5s" },
  compScore:{ fontSize:13, fontWeight:700, width:42, textAlign:"right" },
  compComment:{ fontSize:12, color:"#5a5f6b", marginLeft:200, marginTop:2, marginBottom:4, fontStyle:"italic" },
  twoCol:{ display:"flex", gap:24, marginBottom:16 },
  miniTitle:{ fontWeight:700, fontSize:13, marginBottom:8, color:"#11203b" },
  list:{ margin:0, paddingLeft:18, fontSize:13, color:"#5a5f6b", lineHeight:1.7 },
  summary:{ fontSize:14, color:"#5a5f6b", lineHeight:1.6, marginBottom:20, fontStyle:"italic" },
  certActions:{ display:"flex", gap:12, marginTop:20 },

  /* ── Company dashboard ── */
  dashMain:{ flex:1, padding:"28px 28px 48px", maxWidth:1200, margin:"0 auto", width:"100%" },
  dashHeader:{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", flexWrap:"wrap", gap:16, marginBottom:28 },
  dashTitle:{ fontFamily:"'Space Grotesk',sans-serif", fontSize:28, margin:"0 0 4px" },
  dashSub:{ color:"#5a5f6b", fontSize:14, margin:0 },
  dashControls:{ display:"flex", gap:10, flexWrap:"wrap" },
  filterSelect:{ padding:"9px 14px", borderRadius:9, border:"1.5px solid #e2ddcd", fontSize:13, fontFamily:"Inter,sans-serif", background:"#fff", cursor:"pointer" },
  emptyState:{ textAlign:"center", padding:"80px 20px" },
  emptyIcon:{ fontSize:56, marginBottom:16 },
  emptyTitle:{ fontFamily:"'Space Grotesk',sans-serif", fontSize:22, margin:"0 0 10px" },
  emptySub:{ color:"#5a5f6b", fontSize:15 },
  candidateGrid:{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))", gap:20 },
  candCard:{ background:"#fff", border:"1px solid #e7e2d3", borderRadius:16, padding:20, cursor:"pointer", transition:"transform 0.15s, box-shadow 0.15s", boxShadow:"0 4px 16px rgba(17,32,59,0.06)", animation:"fadeIn 0.3s ease" },
  candCardTop:{ display:"flex", alignItems:"flex-start", gap:14, marginBottom:14 },
  candName:{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:16, marginBottom:2 },
  candRole:{ fontSize:13, color:"#5a5f6b" },
  candDate:{ fontSize:12, color:"#9aa0ab", marginTop:3 },
  tierPip:(t)=>({ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:12, background: t>=100?"#dcfce7":t>=70?"#fef9c3":"#fee2e2", color: t>=100?"#166534":t>=70?"#854d0e":"#991b1b", whiteSpace:"nowrap", alignSelf:"flex-start" }),
  candCompBar:{ display:"flex", flexDirection:"column", gap:5, marginBottom:14 },
  candMiniComp:{ display:"flex", alignItems:"center", gap:8 },
  candMiniLabel:{ fontSize:11, color:"#5a5f6b", width:80, flexShrink:0, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" },
  candMiniTrack:{ flex:1, height:5, background:"#eee8d8", borderRadius:3, overflow:"hidden" },
  candMiniFill:{ height:"100%", borderRadius:3 },
  candFooter:{ display:"flex", gap:8, alignItems:"center" },
  contactBtnEmail:{ padding:"7px 12px", borderRadius:8, background:"#eff6ff", color:"#1d4ed8", fontSize:12, fontWeight:600, textDecoration:"none" },
  contactBtnCall:{ padding:"7px 12px", borderRadius:8, background:"#f0fdf4", color:"#15803d", fontSize:12, fontWeight:600, textDecoration:"none" },
  profileBtn:{ marginLeft:"auto", fontSize:12, fontWeight:700, color:"#11203b", background:"#f5f1e8", border:"none", padding:"7px 14px", borderRadius:8, cursor:"pointer" },

  /* ── Modal ── */
  modalOverlay:{ position:"fixed", inset:0, background:"rgba(17,32,59,0.55)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:20 },
  modalBox:{ background:"#fff", borderRadius:20, width:"100%", maxWidth:700, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 24px 80px rgba(0,0,0,0.25)", display:"flex", flexDirection:"column" },
  modalHeader:{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", padding:"24px 28px 0" },
  modalName:{ fontFamily:"'Space Grotesk',sans-serif", fontSize:22, fontWeight:700 },
  modalMeta:{ fontSize:12, color:"#5a5f6b", marginTop:4 },
  modalClose:{ background:"none", border:"none", fontSize:18, cursor:"pointer", color:"#5a5f6b", padding:4 },
  modalScoreStrip:{ display:"flex", gap:20, alignItems:"flex-start", padding:"20px 28px", background:"#faf7ef", margin:"20px 0 0" },
  modalScoreLabel:{ fontSize:12, color:"#5a5f6b", fontWeight:600, marginBottom:6 },
  tierBadgeLg:(t)=>({ display:"inline-block", padding:"5px 14px", borderRadius:20, fontSize:13, fontWeight:700, background: t>=100?"#dcfce7":t>=70?"#fef9c3":"#fee2e2", color: t>=100?"#166534":t>=70?"#854d0e":"#991b1b" }),
  modalSummary:{ fontSize:13, color:"#5a5f6b", lineHeight:1.6, marginTop:10, fontStyle:"italic" },
  modalTabs:{ display:"flex", gap:0, borderBottom:"2px solid #eee8d8", padding:"0 28px" },
  modalTab:{ padding:"12px 20px", background:"none", border:"none", cursor:"pointer", fontSize:13, fontWeight:600, color:"#5a5f6b", borderBottom:"2px solid transparent", marginBottom:-2 },
  modalTabActive:{ color:"#11203b", borderBottomColor:"#d4a83c" },
  modalBody:{ padding:"20px 28px", flex:1 },
  modalSection:{ marginBottom:20 },
  cvText:{ fontFamily:"Inter,sans-serif", fontSize:13, color:"#3a3f4b", lineHeight:1.7, whiteSpace:"pre-wrap", background:"#faf7ef", border:"1px solid #e7e2d3", borderRadius:10, padding:16, maxHeight:340, overflowY:"auto" },
  cvEmpty:{ color:"#9aa0ab", fontSize:14, textAlign:"center", padding:"30px 0" },
  modalContactBar:{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12, padding:"16px 28px 24px", borderTop:"1px solid #eee8d8", background:"#faf7ef", borderRadius:"0 0 20px 20px" },
  modalContactInfo:{ display:"flex", gap:20, flexWrap:"wrap" },
  modalContactItem:{ fontSize:13, color:"#3a3f4b", fontWeight:500 },
  modalContactBtns:{ display:"flex", gap:10 },
  contactBtnEmailLg:{ padding:"10px 20px", borderRadius:10, background:"#1d4ed8", color:"#fff", fontSize:13, fontWeight:700, textDecoration:"none" },
  contactBtnCallLg:{ padding:"10px 20px", borderRadius:10, background:"#15803d", color:"#fff", fontSize:13, fontWeight:700, textDecoration:"none" },

  /* ── Profile page & tab nav ── */
  portalTopBar:{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 },
  portalUserInfo:{ display:"flex", alignItems:"center", gap:10 },
  portalAvatar:{ width:32, height:32, borderRadius:"50%", objectFit:"cover" },
  tabNav:{ display:"flex", gap:4, background:"#fff", border:"1px solid #e7e2d3", borderRadius:14, padding:5, marginBottom:22, boxShadow:"0 2px 8px rgba(17,32,59,0.05)" },
  tabBtn:{ flex:1, padding:"11px", borderRadius:10, border:"none", background:"transparent", fontWeight:600, fontSize:14, cursor:"pointer", color:"#5a5f6b", transition:"all 0.2s" },
  tabBtnActive:{ background:"#11203b", color:"#fff", boxShadow:"0 2px 8px rgba(17,32,59,0.2)" },
  profileAvatarRow:{ display:"flex", alignItems:"center", gap:20, marginBottom:22 },
  profileAvatarWrap:{ width:84, height:84, borderRadius:"50%", overflow:"hidden", border:"3px solid #e7e2d3", flexShrink:0, background:"#f5f1e8", display:"flex", alignItems:"center", justifyContent:"center" },
  profileAvatarImg:{ width:"100%", height:"100%", objectFit:"cover" },
  profileAvatarPlaceholder:{ fontSize:36 },
  uploadPhotoBtn:{ display:"inline-block", padding:"8px 16px", background:"#f5f1e8", border:"1.5px solid #e7e2d3", borderRadius:9, fontSize:13, fontWeight:600, cursor:"pointer", color:"#11203b" },
  divider:{ height:1, background:"#e7e2d3", margin:"18px 0" },
  profileGrid:{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" },
  dangerZone:{ background:"#fff", border:"1.5px solid #fecaca", borderRadius:14, padding:24 },
  dangerZoneTitle:{ fontWeight:700, fontSize:15, color:"#991b1b", marginBottom:6 },
  dangerZoneSub:{ fontSize:13, color:"#6b7280", marginBottom:16, lineHeight:1.5, margin:"6px 0 16px" },
  deleteBtn:{ background:"#991b1b", color:"#fff", border:"none", padding:"12px 22px", borderRadius:10, fontWeight:700, fontSize:14, cursor:"pointer" },

  /* ── Voice mode ── */
  voiceToggleBtn:{ padding:"8px 14px", borderRadius:20, border:"1.5px solid #e2ddcd", background:"#f5f1e8", fontSize:13, fontWeight:600, cursor:"pointer", color:"#5a5f6b", transition:"all 0.2s" },
  voiceToggleBtnOn:{ background:"#11203b", color:"#d4a83c", border:"1.5px solid #11203b" },
  voiceInputArea:{ marginTop:12, display:"flex", flexDirection:"column", gap:8 },
  transcriptBox:{ background:"#f5f1e8", border:"1px solid #e7e2d3", borderRadius:10, padding:"12px 14px", minHeight:60 },
  micBtn:{ padding:"16px 32px", borderRadius:50, border:"2px solid #11203b", background:"#fff", fontSize:15, fontWeight:700, cursor:"pointer", color:"#11203b", transition:"all 0.2s", userSelect:"none" },
  micBtnActive:{ background:"#11203b", color:"#fff", boxShadow:"0 0 0 6px rgba(17,32,59,0.15)", animation:"pulse 1s ease-in-out infinite" },
  replayBtn:{ marginTop:8, display:"block", background:"none", border:"none", fontSize:12, color:"#d4a83c", cursor:"pointer", fontWeight:600, padding:0 },
  listeningPulse:{ textAlign:"center", fontSize:12, color:"#a13b3b", fontWeight:600, letterSpacing:0.5 },
};
