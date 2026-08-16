// @ts-nocheck
import React, { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "./supabase";
import { WorldMap } from "./components/ui/map";
import AetherFlowHero from "./components/ui/aether-flow-hero";
import { Skiper52 } from "./components/ui/expand-on-hover";
import { VoiceChat } from "./components/ui/ia-siri-chat";
import { ChatBubble, ChatBubbleAvatar, ChatBubbleMessage, ChatBubbleAction, ChatBubbleActionWrapper } from "./components/ui/chat-bubble";
import { Volume2, Home, User, Briefcase } from "lucide-react";
import { FAQSection } from "./components/ui/faq-section";
import { CinematicFooter } from "./components/ui/motion-footer";
import { Dock, DockIcon, DockItem, DockLabel } from "./components/ui/dock";

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

const QUESTIONS_TARGET  = 3;
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const OPENROUTER_MODEL   = "anthropic/claude-sonnet-4-5";
const STORAGE_KEY        = "sb_candidates_v1";

/* ─── helpers ─── */

function cleanResponse(text) {
  let cleaned = text.replace(/<budget:[^>]+>.*?<\/budget:[^>]+>/gs, "").trim();
  // Replace markdown bold with quotes, and strip remaining asterisks to prevent TTS reading them
  cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '"$1"');
  cleaned = cleaned.replace(/\*/g, '');
  return cleaned;
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
  if (s >= 90) return "#167a44";
  if (s >= 70) return "#d4a83c";
  return "#a13b3b";
}
function tierLabel(t) {
  if (t >= 100) return "Exceptional Fit";
  if (t >= 90)  return "Qualified Fit";
  return "Not Qualified";
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
    if (error) {
      console.error("Supabase save error:", error);
      alert("DB Insert Error: " + JSON.stringify(error));
    }
  } catch(e) {
    console.error("Supabase save error:", e);
    alert("DB Catch Error: " + e.message);
  }
}


async function publishCandidate(id) {
  try {
    const { error } = await supabase.from('candidates').update({ published: true }).eq('id', id);
    if (error) console.error("Supabase publish error:", error);
  } catch(e) { console.error("Supabase publish error:", e); }
}

async function loadMyLatestCandidate(userId) {
  try {
    const { data, error } = await supabase.from('candidates').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).single();
    if (error && error.code !== 'PGRST116') {
      console.error(error);
      alert("DB Load Error: " + JSON.stringify(error));
      return null;
    }
    return data;
  } catch(e) { return null; }
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
    ctx.fillStyle=data.tier>=90?GREEN:data.tier>=70?GOLD:"#a13b3b"; roundRect(ctx,barX,y,fillW,barH,8); ctx.fill();
    ctx.fillStyle=NAVY; ctx.font="bold 20px Inter,sans-serif"; ctx.textAlign="left";
    ctx.fillText(`${data.tier}%`,barX+barW+16,y+25); ctx.textAlign="center"; y+=80;

    let remark = "Demonstrated baseline competencies required for the role.";
    let remarkColor = "#b07d2f";
    const score = typeof data.overall_score === 'number' ? data.overall_score : (data.tier || 0);
    if (score >= 90) { remark = "Exceptional performance. Passed the 90% baseline and is highly recommended."; remarkColor = GREEN; }
    else { remark = "Did not meet the 90% baseline requirement to qualify for this role."; remarkColor = "#a13b3b"; }

    ctx.fillStyle=NAVY; ctx.font="bold 22px 'Space Grotesk',sans-serif"; ctx.fillText(`FINAL INTERVIEW SCORE: ${score} / 100`, W/2, y); y+=40;
    ctx.fillStyle=remarkColor; ctx.font="italic 19px Inter,sans-serif"; ctx.fillText(`Official Remark: "${remark}"`, W/2, y); y+=90;

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

      {/* Floating Dock Navigation Bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-full">
        <Dock className="items-end pb-3 bg-neutral-900/60 border border-neutral-800/80 shadow-2xl rounded-2xl backdrop-blur-xl">
          <DockItem
            onClick={() => setPortal("home")}
            className={`aspect-square rounded-full flex items-center justify-center border transition-all ${
              portal === "home"
                ? "bg-purple-600/90 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]"
                : "bg-neutral-800/70 border-neutral-700/50 hover:bg-neutral-700/80"
            }`}
          >
            <DockLabel>Home</DockLabel>
            <DockIcon>
              <Home className="h-5 w-5 text-neutral-200" />
            </DockIcon>
          </DockItem>

          <DockItem
            onClick={() => setPortal("applicant")}
            className={`aspect-square rounded-full flex items-center justify-center border transition-all ${
              portal === "applicant"
                ? "bg-purple-600/90 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]"
                : "bg-neutral-800/70 border-neutral-700/50 hover:bg-neutral-700/80"
            }`}
          >
            <DockLabel>Applicant Portal</DockLabel>
            <DockIcon>
              <User className="h-5 w-5 text-neutral-200" />
            </DockIcon>
          </DockItem>

          <DockItem
            onClick={() => setPortal("company")}
            className={`aspect-square rounded-full flex items-center justify-center border transition-all ${
              portal === "company"
                ? "bg-purple-600/90 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]"
                : "bg-neutral-800/70 border-neutral-700/50 hover:bg-neutral-700/80"
            }`}
          >
            <DockLabel>Company Dashboard</DockLabel>
            <DockIcon>
              <Briefcase className="h-5 w-5 text-neutral-200" />
            </DockIcon>
          </DockItem>
        </Dock>
      </div>

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
  useEffect(() => {
    window.scrollTo(0, 0);
    const resetEvent = new Event('resetSection');
    window.dispatchEvent(resetEvent);
  }, []);

  return (
    <div className="relative w-full min-h-screen overflow-x-hidden bg-[#020617]">
      {/* ─── DARK SECTION: HERO & MAP ─── */}
      <main className="relative z-10 w-full bg-[#020617] mb-[-1px]">
        <div style={S.landingPage}>
          {/* ═══ AETHER FLOW HERO (particle canvas + headline + CTAs) ═══ */}
          <AetherFlowHero onApplicant={onApplicant} onCompany={onCompany} />

          {/* ═══ WORLD MAP ═══ */}
          <div className="relative w-full" style={{minHeight: '55vh', background: '#020617'}}>
            <div className="absolute inset-x-0 top-0 h-32 z-10 pointer-events-none" style={{background:'linear-gradient(to bottom, #020617, transparent)'}} />
            <div className="absolute inset-x-0 bottom-0 h-32 z-10 pointer-events-none" style={{background:'linear-gradient(to top, #020617, transparent)'}} />
            <WorldMap
              dots={[
                { start: { lat: 64.2008, lng: -149.4937, label: "Fairbanks" }, end: { lat: 34.0522, lng: -118.2437, label: "Los Angeles" } },
                { start: { lat: 64.2008, lng: -149.4937, label: "Fairbanks" }, end: { lat: -15.7975, lng: -47.8919, label: "Brasília" } },
                { start: { lat: -15.7975, lng: -47.8919, label: "Brasília" }, end: { lat: 38.7223, lng: -9.1393, label: "Lisbon" } },
                { start: { lat: 51.5074, lng: -0.1278, label: "London" }, end: { lat: 28.6139, lng: 77.209, label: "New Delhi" } },
                { start: { lat: 28.6139, lng: 77.209, label: "New Delhi" }, end: { lat: 43.1332, lng: 131.9113, label: "Vladivostok" } },
                { start: { lat: 28.6139, lng: 77.209, label: "New Delhi" }, end: { lat: -1.2921, lng: 36.8219, label: "Nairobi" } },
                { start: { lat: -1.2921, lng: 36.8219, label: "Nairobi" }, end: { lat: -26.2041, lng: 28.0473, label: "Johannesburg" } },
                { start: { lat: 6.5244, lng: 3.3792, label: "Lagos" }, end: { lat: 51.5074, lng: -0.1278, label: "London" } },
                { start: { lat: 6.5244, lng: 3.3792, label: "Lagos" }, end: { lat: 40.7128, lng: -74.006, label: "New York" } },
              ]}
            />
          </div>
        </div>
      </main>

      {/* ─── LIGHT SECTION: PARTNERS TO BEFORE FOOTER ─── */}
      <div className="relative z-20 w-full bg-[#f5efe4] text-slate-900 rounded-t-[40px] shadow-[0_-12px_40px_rgba(0,0,0,0.06)] overflow-hidden">
        {/* ── PARTNERS ── */}
        <section style={{...S.partnersSection, borderBottom:"1px solid rgba(15,23,42,0.08)"}} className="py-20">
          <div style={{...S.partnersLabel, color:"rgba(15,23,42,0.4)"}}>TRUSTED BY LEADING BUSINESSES ACROSS AFRICA</div>
          <Skiper52 />
        </section>

        {/* ── PORTALS ── */}
        <section style={S.portalSection}>
          <div style={S.sectionLabel}>TWO POWERFUL PORTALS</div>
          <h2 style={{...S.sectionTitle, color:"#0f172a"}}>One Platform. Two Paths.</h2>
          <p style={{...S.sectionSub, color:"rgba(15,23,42,0.65)"}}>Whether you're proving your skills or finding exceptional talent, SkillBridge has you covered.</p>

          <div style={S.newPortalGrid}>
            {/* Applicant */}
            <div className="portal-card-hover border border-slate-200/80 shadow-md hover:shadow-lg transition-all duration-300" style={S.newPortalCardLight} onClick={onApplicant}>
              <div style={S.newPortalCardTop}>
                <div style={S.newPortalCardIconWrap}><span style={{fontSize:32}}>🎯</span></div>
                <div style={S.newPortalBadgeLight}>APPLICANT PORTAL</div>
              </div>
              <h3 style={{...S.newPortalCardTitle, color:"#0f172a"}}>Apply & Get Certified</h3>
              <p style={{...S.newPortalCardSub, color:"rgba(15,23,42,0.7)"}}>Stop sending resumes into the void. Complete an intense, role-specific AI interview and earn a verified certificate that employers trust.</p>
              <div style={S.newPortalSteps}>
                {["Fill your profile & upload CV","Answer 3 AI-driven interview questions","Score 80%+ to earn your certificate"].map((s,i)=>(
                  <div key={i} style={S.newPortalStep}>
                    <div style={{...S.newPortalStepNum, background:"rgba(124,58,237,0.1)", color:"#7c3aed"}}>{i+1}</div>
                    <span style={{fontSize:14, color:"#334155"}}>{s}</span>
                  </div>
                ))}
              </div>
              <button style={S.newPortalBtnDark}>Start My Application →</button>
            </div>

            {/* Company */}
            <div className="portal-card-hover border border-purple-500/20 shadow-xl transition-all duration-300" style={S.newPortalCardDark} onClick={onCompany}>
              <div style={S.newPortalCardTop}>
                <div style={{...S.newPortalCardIconWrap, background:"rgba(212,168,60,0.15)", border:"1px solid rgba(212,168,60,0.3)"}}><span style={{fontSize:32}}>💼</span></div>
                <div style={S.newPortalBadgeDark}>COMPANY DASHBOARD</div>
              </div>
              <h3 style={{...S.newPortalCardTitle, color:"#fff"}}>Search Verified Talent</h3>
              <p style={{...S.newPortalCardSub, color:"#8fa3be"}}>Skip endless CV screening. Browse a curated pool of pre-tested, AI-scored candidates — complete with competency breakdowns and direct contact info.</p>
              <div style={S.newPortalSteps}>
                {["Filter by role and score threshold","View AI-generated competency breakdowns","Email or call candidates instantly"].map((s,i)=>(
                  <div key={i} style={S.newPortalStep}>
                    <div style={{...S.newPortalStepNum, background:"#d4a83c", color:"#11203b"}}>{i+1}</div>
                    <span style={{fontSize:14, color:"#9db3c8"}}>{s}</span>
                  </div>
                ))}
              </div>
              <button style={S.newPortalBtnGold}>Open Dashboard →</button>
            </div>
          </div>
        </section>

        {/* ── ABOUT & MISSION ── */}
        <section style={S.aboutSection} className="py-16">
          <div style={S.aboutGrid}>
            <div className="bg-white border border-slate-200/60 p-8 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
              <div style={S.aboutIcon}>🌍</div>
              <h3 style={{...S.aboutTitle, color:"#0f172a"}}>About Us</h3>
              <p style={{...S.aboutText, color:"#475569"}}>SkillBridge by kconect is redefining how talent meets opportunity. We leverage cutting-edge AI to conduct rigorous, unbiased interviews, ensuring candidates are judged purely on merit, practical skills, and cultural fit.</p>
            </div>
            <div className="bg-white border border-slate-200/60 p-8 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
              <div style={S.aboutIcon}>🎯</div>
              <h3 style={{...S.aboutTitle, color:"#0f172a"}}>Our Mission</h3>
              <p style={{...S.aboutText, color:"#475569"}}>To democratize access to elite careers for African professionals by removing bias from the hiring process and providing companies with instantly verified, highly capable talent pools.</p>
            </div>
            <div className="bg-white border border-slate-200/60 p-8 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
              <div style={S.aboutIcon}>👁️</div>
              <h3 style={{...S.aboutTitle, color:"#0f172a"}}>Our Vision</h3>
              <p style={{...S.aboutText, color:"#475569"}}>A world where resumes are obsolete, and a single, unified SkillBridge certificate is the global standard for proving competency and securing top-tier employment.</p>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section style={S.howSection}>
          <div style={S.sectionLabel}>SIMPLE PROCESS</div>
          <h2 style={{...S.sectionTitle, color:"#0f172a"}}>From Sign-Up to Certificate</h2>
          <p style={{...S.sectionSub, color:"rgba(15,23,42,0.65)"}}>Four steps stand between you and a verified credential that opens doors.</p>
          <div style={S.howGrid}>
            {[
              {step:"01", icon:"📋", title:"Create Profile", desc:"Fill in your details, upload your CV, and pick your target role."},
              {step:"02", icon:"🤖", title:"AI Interview", desc:"Face 3 expertly crafted questions testing IQ, teamwork, and leadership."},
              {step:"03", icon:"📊", title:"Instant Scoring", desc:"Our AI assessor scores your answers against a rigorous 80% baseline."},
              {step:"04", icon:"🏅", title:"Get Certified", desc:"Download your official certificate and get discovered by top employers."},
            ].map((item, i) => (
              <div key={i} className="step-card bg-white border border-slate-200/50 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300" style={{...S.howCard, background:"none", border:"none", boxShadow:"none"}}>
                <div style={{...S.howStep, color:"rgba(168,85,247,0.15)"}}>{item.step}</div>
                <div style={S.howIcon}>{item.icon}</div>
                <h4 style={{...S.howTitle, color:"#0f172a"}}>{item.title}</h4>
                <p style={{...S.howDesc, color:"#475569"}}>{item.desc}</p>
                {i < 3 && <div style={{...S.howConnector, color:"rgba(168,85,247,0.3)"}}>→</div>}
              </div>
            ))}
          </div>
        </section>

        {/* ── STATS ── */}
        <section style={S.statsSection}>
          <div style={S.statsGrid} className="border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
            {[
              {num:"10,000+", label:"Professionals Placed", sub:"Across leading tech hubs"},
              {num:"80%", label:"Pass Mark Baseline", sub:"Only the best qualify"},
              {num:"3", label:"Targeted Questions", sub:"IQ · Team · Leadership"},
              {num:"AI", label:"Powered Scoring", sub:"Instant, unbiased results"},
            ].map((s,i)=>(
              <div key={i} style={{...S.statCard, background:"#ffffff", border:"none"}} className="border-r border-b border-slate-200/60 last:border-none p-8">
                <div style={{...S.statNum, background:"linear-gradient(135deg,#7c3aed,#4f46e5)"}} className="bg-clip-text text-transparent font-bold">{s.num}</div>
                <div style={{...S.statCardLabel, color:"#0f172a"}}>{s.label}</div>
                <div style={{...S.statCardSub, color:"#64748b"}}>{s.sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── TESTIMONIALS ── */}
        <section style={S.testimonialsSection}>
          <div style={S.sectionLabel}>SUCCESS STORIES</div>
          <h2 style={{...S.sectionTitle, color:"#0f172a"}}>Don't Just Take Our Word For It</h2>
          <div style={S.testimonialsGrid}>
            {[
              {quote: "SkillBridge bypassed the noise of 1,000 resumes. We hired three verified candidates in a week who hit the ground running.", author: "Sarah Okafor", role: "HR Director, FinTech Africa"},
              {quote: "The AI interview was the most intense 15 minutes of my life, but it proved I had the skills. Got hired 2 days after certification.", author: "David E.", role: "Certified Data Analyst"},
              {quote: "Knowing candidates have already passed an 80% strict baseline for IQ, Leadership, and Teamwork saves us months of screening.", author: "Kconect Inc", role: "Hiring Partner"}
            ].map((t,i) => (
              <div key={i} style={S.testimonialCard} className="border border-slate-200/80 hover:shadow-md transition-shadow duration-300">
                <div style={S.testimonialQuote} className="text-slate-600">"{t.quote}"</div>
                <div style={S.testimonialAuthor}>
                  <div style={S.testimonialAvatar} className="bg-purple-100 text-purple-700">{t.author[0]}</div>
                  <div>
                    <div style={{...S.testimonialName, color:"#0f172a"}}>{t.author}</div>
                    <div style={{...S.testimonialRole, color:"#64748b"}}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <FAQSection />

        {/* ── CTA BANNER ── */}
        <section style={{...S.ctaBanner, background:"linear-gradient(135deg, #f5efff, #faf5ff)", border:"1px solid rgba(168,85,247,0.12)"}} className="my-16 rounded-2xl max-w-5xl mx-auto shadow-sm">
          <div style={S.ctaInner}>
            <div style={S.sectionLabel}>READY TO BEGIN?</div>
            <h2 style={{...S.sectionTitle, color:"#0f172a", marginBottom:12}}>Your Certificate Is 3 Questions Away.</h2>
            <p style={{...S.sectionSub, color:"#475569", marginBottom:36}}>Join the growing network of certified African professionals.</p>
            <div style={S.heroCTARow}>
              <button className="cta-btn-hover" style={{...S.heroCtaPrimary, background:"linear-gradient(135deg, #a855f7, #6366f1)", color:"#fff", boxShadow:"0 0 20px rgba(168,85,247,0.3)"}} onClick={onApplicant}>Get Certified Now →</button>
              <button className="cta-btn-hover" style={{...S.heroCtaSecondary, borderColor:"rgba(15,23,42,0.2)", color:"#0f172a"}} onClick={onCompany}>Hire Verified Talent</button>
            </div>
          </div>
        </section>
      </div>
      <CinematicFooter />
    </div>
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

function ProctorCam({ onWarning, onTerminate }) {
  const videoRef = useRef(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const warningCount = useRef(0);
  const framesWithoutFace = useRef(0);
  const [showWarning, setShowWarning] = useState(false);
  const [warningReason, setWarningReason] = useState("");
  const [isTerminated, setIsTerminated] = useState(false);

  useEffect(() => {
    async function loadModels() {
      if (window.faceapi) {
        await window.faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/');
        setModelLoaded(true);
      } else {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.js";
        script.onload = async () => {
          await window.faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/');
          setModelLoaded(true);
        };
        document.head.appendChild(script);
      }
    }
    loadModels();
  }, []);

  useEffect(() => {
    let stream = null;
    let loopId = null;

    async function startCam() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (e) {
        console.error("Camera error", e);
      }
    }
    startCam();

    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (loopId) cancelAnimationFrame(loopId);
    };
  }, []);

  const triggerWarning = useCallback((reason) => {
    if (isTerminated) return;
    if (warningCount.current < 3) {
      warningCount.current += 1;
      setWarningReason(reason);
      setShowWarning(true);
      onWarning && onWarning();
    } else {
      setWarningReason(reason);
      setIsTerminated(true);
      setShowWarning(true);
    }
  }, [onWarning, isTerminated]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden && !showWarning && !isTerminated) {
        triggerWarning("You left the interview screen or switched tabs.");
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [showWarning, isTerminated, triggerWarning]);

  useEffect(() => {
    if (!modelLoaded || !videoRef.current || showWarning || isTerminated) return;
    let loopId;
    let lastTime = 0;
    
    async function detect() {
      const now = Date.now();
      if (now - lastTime > 300) { // ~3fps
        lastTime = now;
        if (videoRef.current && videoRef.current.readyState === 4) {
          const detections = await window.faceapi.detectAllFaces(videoRef.current, new window.faceapi.TinyFaceDetectorOptions());
          if (detections.length === 0) {
            framesWithoutFace.current += 1;
            if (framesWithoutFace.current >= 9) { // 3 seconds
              triggerWarning("We cannot detect your face. Please ensure you remain in front of the camera.");
            }
          } else {
            framesWithoutFace.current = 0;
          }
        }
      }
      loopId = requestAnimationFrame(detect);
    }
    detect();
    return () => cancelAnimationFrame(loopId);
  }, [modelLoaded, showWarning, isTerminated, triggerWarning]);

  function handleResume() {
    setShowWarning(false);
    framesWithoutFace.current = 0;
  }

  function handleExit() {
    onTerminate && onTerminate();
  }

  return (
    <>
      <div style={S.proctorWrap}>
        <div style={S.proctorLabel}><div style={S.proctorDot}/> {modelLoaded ? "PROCTOR ACTIVE" : "LOADING..."}</div>
        <video ref={videoRef} autoPlay playsInline muted style={S.proctorVideo} />
      </div>
      {showWarning && (
        <div style={S.proctorWarningOverlay}>
          {isTerminated ? (
            <>
              <div style={S.proctorWarningTitle}>⚠️ Interview Terminated</div>
              <div style={S.proctorWarningText}>{warningReason} You have exceeded the maximum allowed violations. A score of 0 has been recorded.</div>
              <button style={S.proctorWarningBtn} onClick={handleExit}>Exit Interview</button>
            </>
          ) : (
            <>
              <div style={S.proctorWarningTitle}>⚠️ Proctor Warning ({warningCount.current}/3)</div>
              <div style={S.proctorWarningText}>{warningReason} Further violations will result in immediate termination.</div>
              <button style={S.proctorWarningBtn} onClick={handleResume}>I Understand</button>
            </>
          )}
        </div>
      )}
    </>
  );
}

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
  const [myLatestInterview, setMyLatestInterview] = useState(null);
  const [certificateGenerated, setCertificateGenerated] = useState(false);
  
  const [proctorTerminated, setProctorTerminated] = useState(false);

  const canvasRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    async function initProfile() {
      const pastInterview = await loadMyLatestCandidate(session.user.id);
      if (pastInterview) {
        const issue = new Date(pastInterview.created_at || new Date());
        const expiry = new Date(issue);
        expiry.setFullYear(expiry.getFullYear() + 1);
        setMyLatestInterview({
          certId: pastInterview.cert_id,
          name: pastInterview.name,
          email: pastInterview.email,
          roleLabel: pastInterview.role_label,
          tier: pastInterview.tier,
          overall_score: pastInterview.overall_score,
          issueDate: fmtDate(issue),
          expiryDate: fmtDate(expiry)
        });
      }
      
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

  if (proctorTerminated) {
    return (
      <main style={S.main}>
        <div style={S.card}>
          <h2 style={{...S.cardTitle, color:"#991b1b"}}>⚠️ Interview Terminated</h2>
          <p style={S.cardSub}>Your session was terminated due to a proctoring violation (leaving the camera frame repeatedly).</p>
          <div style={S.errorBox}>A score of 0 has been recorded for this session.</div>
          <button style={S.primaryBtn} onClick={() => { setProctorTerminated(false); setStep("apply"); }}>Return to Dashboard</button>
        </div>
      </main>
    );
  }

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

  function interviewSystem(currentQ) {
    let focus = "";
    if (currentQ === 1) focus = "For this first question, ask a challenging IQ / Logical Reasoning puzzle or problem-solving scenario.";
    else if (currentQ === 2) focus = "For this second question, ask a complex scenario focused strictly on Team Building and interpersonal dynamics.";
    else if (currentQ === 3) focus = "For this final question, ask a high-stakes scenario focused strictly on Leadership and decision-making under pressure.";
    return [
      `You are an elite, notoriously rigorous expert interviewer assessing a candidate for the role of: ${roleLabel}.`,
      `You expect excellence. Your questions must be extremely difficult, deeply practical, and designed to stress-test the candidate's actual applied knowledge in the ${roleLabel} field, not just theory.`,
      `Context: The interview is taking place in a Nigerian/African professional context. Frame scenarios, challenges, and cultural nuances within this environment while maintaining Silicon Valley tier rigor.`,
      `Candidate: ${form.name}. Job spec: ${form.jobSpec}`,
      form.resumeText?`Resume excerpt: ${form.resumeText.slice(0,1500)}`:`No resume provided.`,
      `Competencies to probe: ${role.competencies.join(", ")}.`,
      focus,
      `Rules: Ask exactly ONE concise, intense question per turn. Pose complex, real-world, high-stakes scenarios or edge-cases specific to the ${roleLabel} role. Push for specific, actionable answers. No preamble, no pleasantries, no meta-commentary. Under 70 words. Do not answer your own question. DO NOT use markdown formatting like asterisks (**); use quotation marks instead if you need to emphasize something.`,
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
      const text = await callLLM(interviewSystem(1),[{role:"user",content:"Begin the interview. Greet the candidate briefly and ask your first question."}]);
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
      const text = await callLLM(interviewSystem(questionCount + 1),newMsgs);
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
        `{"overall_score":number,"tier":0|50|90|100,"competencies":[{"name":string,"score":number,"comment":string}],"strengths":[string,string],"improvements":[string,string],"summary":string}`,
        `"tier" = nearest of 0,50,90,100. 90 is the strict baseline to qualify. Be rigorous.`,
      ].join("\n");
      const parsed = cleanJson(await callLLM(scoringSystem,[{role:"user",content:`Transcript:\n\n${transcript}`}]));
      setResult(parsed);
      const issue=new Date(), expiry=new Date(issue);
      expiry.setFullYear(expiry.getFullYear()+1);
      let newCert={
        certId:genCertId(), name:form.name, email:form.email, roleLabel,
        tier:parsed.tier, overall_score:parsed.overall_score,
        issueDate:fmtDate(issue), expiryDate:fmtDate(expiry),
        issueDateISO:issue.toISOString(), expiryDateISO:expiry.toISOString(),
      };
      setCert(newCert);
      setMyLatestInterview(newCert);
      setCertificateGenerated(false);

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
      if (insertedId) {
        setCandidateId(insertedId);
        await publishCandidate(insertedId); // Auto-publish to bypass RLS SELECT restriction
      }
      setStep("results");
    } catch(e){ setError("Scoring failed. Please try again."); setStep("interview"); }
  }

  function downloadCertificate() {
    const c=canvasRef.current; if(!c) return;
    const certToDownload = (tab === "my-certificate" ? myLatestInterview : cert) || cert;
    const a=document.createElement("a");
    a.download=`SkillBridge-${certToDownload.certId}.png`; a.href=c.toDataURL("image/png"); a.click();
  }

  async function handlePublish() {
    if (!candidateId) return;
    setPublishedStatus("publishing");
    await publishCandidate(candidateId);
    setPublishedStatus("published");
  }

  if (profileLoading) return <main className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-gray-500">Loading profile...</div></main>;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Sidebar Nav */}
      <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-6">
          <div className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <span className="text-primary">✦</span> SkillBridge
          </div>
        </div>

        <nav className="flex-1 px-4 pb-4 space-y-1 overflow-y-auto">
          <button className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${tab === "profile" ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`} onClick={()=>setTab("profile")}>
            <span className="text-lg">👤</span> My Profile
          </button>
          <button className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${tab === "certification" ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`} onClick={()=>{ setTab("certification"); setStep("apply"); setError(""); }}>
            <span className="text-lg">🎓</span> Certification
          </button>
          <button className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${tab === "my-certificate" ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`} onClick={()=>{ setTab("my-certificate"); }}>
            <span className="text-lg">📜</span> My Certificate
          </button>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-4 px-2">
            {form.avatarUrl 
              ? <img src={form.avatarUrl} alt="avatar" className="h-8 w-8 rounded-full object-cover shadow-sm" /> 
              : <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-xs">👤</div>}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-gray-900 truncate">{form.name || "Applicant"}</div>
              <div className="text-[10px] text-gray-500 truncate">{session.user.email}</div>
            </div>
          </div>
          <button className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-colors" onClick={()=>supabase.auth.signOut()}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12">
        <div className="max-w-4xl mx-auto">

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
            <>
              <ProctorCam 
                onTerminate={() => { setProctorTerminated(true); }}
              />
              <Interview messages={messages} answerDraft={answerDraft}
                setAnswerDraft={setAnswerDraft} onSubmit={submitAnswer}
                busy={busy} questionCount={Math.min(questionCount,QUESTIONS_TARGET)}
                total={QUESTIONS_TARGET} chatEndRef={chatEndRef} error={error}
                voiceMode={voiceMode} onToggleVoice={()=>setVoiceMode(v=>!v)}
                timePerQ={TIME_PER_Q} />
            </>
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

      {/* ── My Certificate Page ── */}
      {tab==="my-certificate" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-10 text-center flex flex-col items-center">
          {myLatestInterview ? (
            !certificateGenerated ? (
              <div className="py-12 max-w-lg w-full flex flex-col items-center">
                <div className="h-20 w-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-3xl mb-6">🏆</div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Interview Concluded Successfully</h2>
                <div className="text-5xl font-extrabold text-green-600 my-6">
                  {myLatestInterview.overall_score || myLatestInterview.tier}<span className="text-2xl text-green-600/50">/100</span>
                </div>
                <p className="text-gray-500 mb-8">You are now eligible to generate your official SkillBridge certificate.</p>
                <button className="inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 bg-gray-900 text-gray-50 hover:bg-gray-900/90 h-11 px-8 py-2" onClick={() => setCertificateGenerated(true)}>
                  Generate Certificate ✨
                </button>
              </div>
            ) : (
              <div className="max-w-4xl w-full flex flex-col items-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Your Certificate</h2>
                <p className="text-gray-500 mb-8">Generated from your successful AI interview.</p>
                <div className="w-full flex justify-center bg-gray-50 p-6 rounded-xl border border-gray-100 shadow-inner mb-8 overflow-hidden">
                  <CertificateCanvas data={myLatestInterview} canvasRef={canvasRef} />
                </div>
                <div className="flex flex-wrap justify-center gap-4">
                  <button className="inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 bg-gray-900 text-gray-50 hover:bg-gray-900/90 h-11 px-6 py-2" onClick={downloadCertificate}>⬇ Download PNG</button>
                  <button className="inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 bg-white border border-gray-200 text-gray-900 hover:bg-gray-50 h-11 px-6 py-2 disabled:opacity-50" onClick={()=>{ setEmailStatus("sending"); setTimeout(()=>setEmailStatus("sent"),900); }} disabled={emailStatus==="sending"}>
                    {emailStatus==="sent"?"✅ Emailed":emailStatus==="sending"?"Sending...":"✉ Email me a copy"}
                  </button>
                </div>
              </div>
            )
          ) : (
            <div className="py-16 max-w-lg w-full flex flex-col items-center">
              <div className="h-20 w-20 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center text-3xl mb-6">⚠️</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">No Certificate Available</h2>
              <p className="text-gray-500 mb-8">You must complete and pass an interview before a certificate can be generated.</p>
              <button className="inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 bg-gray-900 text-gray-50 hover:bg-gray-900/90 h-11 px-8 py-2" onClick={()=>{ setTab("certification"); setStep("apply"); setError(""); }}>
                Start Interview →
              </button>
            </div>
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
        </div>
      </main>
    </div>
  );
}

/* ── Profile Page ── */
function ProfilePage({ form, update, session, busy, avatarUploading, setAvatarUploading, handleFile, onSave, onDeleteRequest }) {
  return (
    <div className="flex flex-col gap-6">
      {/* Profile card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">My Profile</h2>
        <p className="text-gray-500 mb-8">Your personal details are stored securely and used in your certification interviews.</p>

        {/* Avatar section */}
        <div className="flex items-center gap-6 mb-8">
          <div className="relative h-24 w-24 rounded-full overflow-hidden border-4 border-white shadow-md bg-gray-100 flex items-center justify-center shrink-0">
            {form.avatarUrl
              ? <img src={form.avatarUrl} alt="Profile" className="h-full w-full object-cover" />
              : <span className="text-3xl">👤</span>
            }
          </div>
          <div className="flex-1">
            <div className="font-bold text-xl text-gray-900 mb-1">{form.name || "Your Name"}</div>
            <div className="text-sm text-gray-500 mb-4">{session.user.email}</div>
            <label className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium transition-colors bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg cursor-pointer">
              {avatarUploading ? "Uploading..." : "📷 Change Photo"}
              <input type="file" accept="image/*" className="hidden" onChange={async e => {
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

        <div className="h-px bg-gray-100 w-full mb-8" />

        {/* Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Field label="Full Name *">
            <input className="flex h-11 w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:cursor-not-allowed disabled:opacity-50" value={form.name} onChange={e=>update("name",e.target.value)} placeholder="Jane Doe" />
          </Field>
          <Field label="Phone Number *">
            <input className="flex h-11 w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:cursor-not-allowed disabled:opacity-50" value={form.phone} onChange={e=>update("phone",e.target.value)} placeholder="+234 80..." />
          </Field>
          <Field label="Location">
            <input className="flex h-11 w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:cursor-not-allowed disabled:opacity-50" value={form.location} onChange={e=>update("location",e.target.value)} placeholder="e.g., Lagos, Nigeria" />
          </Field>
          <Field label="Years of Experience">
            <input className="flex h-11 w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:cursor-not-allowed disabled:opacity-50" value={form.experience} onChange={e=>update("experience",e.target.value)} placeholder="e.g., 5 years" />
          </Field>
          <Field label="LinkedIn URL">
            <input className="flex h-11 w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:cursor-not-allowed disabled:opacity-50" value={form.linkedin} onChange={e=>update("linkedin",e.target.value)} placeholder="https://linkedin.com/in/..." />
          </Field>
          <Field label="Portfolio URL">
            <input className="flex h-11 w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:cursor-not-allowed disabled:opacity-50" value={form.portfolio} onChange={e=>update("portfolio",e.target.value)} placeholder="https://yourportfolio.com" />
          </Field>
        </div>

        <Field label="CV / Résumé (PDF or Word, max 5MB)">
          <input className="flex h-11 w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:cursor-not-allowed disabled:opacity-50" type="file" accept=".pdf,.doc,.docx" onChange={handleFile} />
          {form.resumeName && <div className="text-xs mt-2 text-green-600 font-medium">✓ {form.resumeName} loaded</div>}
        </Field>

        <button className="mt-8 inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 bg-gray-900 text-gray-50 hover:bg-gray-900/90 h-11 px-8 py-2 disabled:opacity-50" onClick={onSave} disabled={busy}>
          {busy ? "Saving..." : "Save Profile"}
        </button>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50/50 rounded-2xl border border-red-100 p-6 md:p-10">
        <div className="text-red-700 font-bold text-lg mb-2">⚠️ Danger Zone</div>
        <p className="text-red-600/80 mb-6">Permanently delete your profile and all associated data. This action cannot be undone.</p>
        <button className="inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 h-10 px-4 py-2" onClick={onDeleteRequest}>Delete My Account</button>
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
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-10 max-w-3xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Your Application</h2>
      <p className="text-gray-500 mb-8">Fill in your details, upload your CV, and start the AI interview.</p>

      <div className="space-y-6">
        <Field label="Role you're applying for">
          <select className="flex h-11 w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:cursor-not-allowed disabled:opacity-50" value={form.roleId} onChange={e=>update("roleId",e.target.value)}>
            {ROLES.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </Field>
        {form.roleId==="other" && (
          <Field label="Specify the role">
            <input className="flex h-11 w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:cursor-not-allowed disabled:opacity-50" value={form.customRole} onChange={e=>update("customRole",e.target.value)} placeholder="e.g. Logistics Coordinator" />
          </Field>
        )}

        <Field label="Job specification *">
          <textarea className="flex min-h-[88px] w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:cursor-not-allowed disabled:opacity-50 resize-y" value={form.jobSpec}
            onChange={e=>update("jobSpec",e.target.value)}
            placeholder="Paste or describe the job spec you're being screened against." />
        </Field>

        {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm border border-red-100">{error}</div>}
        
        <div className="flex gap-4 pt-4">
          <button className="inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 bg-white border border-gray-200 text-gray-900 hover:bg-gray-50 h-11 px-8 py-2" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 bg-gray-900 text-gray-50 hover:bg-gray-900/90 h-11 px-8 py-2 disabled:opacity-50 flex-1" onClick={onSubmit} disabled={busy}>
            {busy ? "Starting interview..." : "Submit & Start AI Interview"}
          </button>
        </div>
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
      <div style={S.chatBox} className="space-y-4 p-4">
        {messages.map((m, i) => {
          const variant = m.role === "assistant" ? "received" : "sent";
          return (
            <ChatBubble key={i} variant={variant}>
              <ChatBubbleAvatar fallback={variant === "received" ? "AI" : "US"} />
              <div className="flex flex-col">
                <ChatBubbleMessage variant={variant}>
                  {m.content}
                </ChatBubbleMessage>
                {/* Read Aloud button on last AI message in voice mode */}
                {voiceMode && m.role === "assistant" && i === messages.length - 1 && (
                  <ChatBubbleActionWrapper>
                    <ChatBubbleAction icon={<Volume2 className="size-4" />} onClick={replayTTS} />
                  </ChatBubbleActionWrapper>
                )}
              </div>
            </ChatBubble>
          );
        })}
        {busy && (
          <ChatBubble variant="received">
            <ChatBubbleAvatar fallback="AI" />
            <ChatBubbleMessage isLoading />
          </ChatBubble>
        )}
        <div ref={chatEndRef} />
      </div>

      {error && <div style={S.errorBox}>{error}</div>}

      {/* Input area */}
      {voiceMode ? (
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <VoiceChat 
            onStart={() => { if (!listening) startListening(); }}
            onStop={() => { if (listening) stopListening(); }}
            demoMode={false}
            className="w-full min-h-[260px] shadow-sm border border-gray-200/60"
          />
          {answerDraft && (
            <div style={{...S.transcriptBox, margin: 0}}>
              <div style={{fontSize:11, color:"#6b7280", marginBottom:6, fontWeight:600, letterSpacing:1}}>LIVE TRANSCRIPT</div>
              <div style={{fontSize:15, color:"#11203b", lineHeight:1.6}}>{answerDraft}</div>
            </div>
          )}
          <div style={{display:"flex", gap:12, justifyContent:"flex-end", marginTop:8}}>
            <button style={{...S.primaryBtnSmall, padding:"12px 24px", fontSize:14}} onClick={onSubmit} disabled={busy||!answerDraft.trim()}>
              {busy ? "Sending..." : "Submit Answer ↵"}
            </button>
          </div>
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
  return <div className="flex flex-col space-y-1.5"><label className="text-sm font-semibold text-gray-700">{label}</label>{children}</div>;
}
function Row({ children }) { return <div className="flex flex-col md:flex-row gap-4">{children}</div>; }

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
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap');
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes fadeIn { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
@keyframes fadeUp { from { opacity:0; transform:translateY(40px); } to { opacity:1; transform:translateY(0); } }
@keyframes pulse { 0%,100% { box-shadow: 0 0 0 4px rgba(17,32,59,0.15); } 50% { box-shadow: 0 0 0 10px rgba(17,32,59,0.08); } }
@keyframes meshShift { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
@keyframes floatY { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }
@keyframes orb1 { 0%{transform:translate(0,0) scale(1)} 50%{transform:translate(60px,-40px) scale(1.15)} 100%{transform:translate(0,0) scale(1)} }
@keyframes orb2 { 0%{transform:translate(0,0) scale(1)} 50%{transform:translate(-50px,60px) scale(0.9)} 100%{transform:translate(0,0) scale(1)} }
@keyframes ticker { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
@keyframes shimmer { from{background-position:-400px 0} to{background-position:400px 0} }
@keyframes glowPulse { 0%,100%{box-shadow:0 0 30px rgba(212,168,60,0.3)} 50%{box-shadow:0 0 60px rgba(212,168,60,0.6)} }
* { box-sizing: border-box; }
body { margin: 0; }
.portal-card-hover:hover { transform:translateY(-6px) !important; box-shadow:0 28px 60px rgba(0,0,0,0.18) !important; }
.step-card:hover { transform:translateY(-4px); border-color:rgba(212,168,60,0.5) !important; }
.cta-btn-hover:hover { transform:scale(1.03); filter:brightness(1.1); }
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

  /* ── Landing Page ── */
  landingPage:{ background:"#020617", color:"#f8fafc", overflowX:"hidden" },

  /* Hero */
  heroSection:{ position:"relative", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", background:"radial-gradient(ellipse at 20% 50%, rgba(17,32,59,0.8) 0%, #080f1e 60%), radial-gradient(ellipse at 80% 20%, rgba(212,168,60,0.08) 0%, transparent 50%)" },
  orb1:{ position:"absolute", width:600, height:600, borderRadius:"50%", background:"radial-gradient(circle, rgba(212,168,60,0.12) 0%, transparent 70%)", top:"-100px", right:"-150px", animation:"orb1 12s ease-in-out infinite", pointerEvents:"none" },
  orb2:{ position:"absolute", width:500, height:500, borderRadius:"50%", background:"radial-gradient(circle, rgba(22,122,68,0.1) 0%, transparent 70%)", bottom:"-80px", left:"-100px", animation:"orb2 15s ease-in-out infinite", pointerEvents:"none" },
  orb3:{ position:"absolute", width:300, height:300, borderRadius:"50%", background:"radial-gradient(circle, rgba(212,168,60,0.06) 0%, transparent 70%)", top:"40%", left:"30%", animation:"orb1 18s ease-in-out infinite reverse", pointerEvents:"none" },
  heroInner:{ position:"relative", zIndex:2, textAlign:"center", padding:"80px 24px 60px", maxWidth:800, margin:"0 auto" },
  heroBadge:{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(212,168,60,0.1)", border:"1px solid rgba(212,168,60,0.3)", borderRadius:100, padding:"6px 18px", fontSize:11, fontWeight:700, letterSpacing:2, color:"#d4a83c", textTransform:"uppercase", marginBottom:28, animation:"fadeUp 0.6s ease both" },
  heroBadgeDot:{ width:6, height:6, borderRadius:"50%", background:"#d4a83c", animation:"pulse 2s infinite" },
  landingHeroTitle:{ fontFamily:"'Space Grotesk',sans-serif", fontSize:72, fontWeight:700, lineHeight:1.05, margin:"0 0 24px", letterSpacing:-1, animation:"fadeUp 0.7s 0.1s ease both" },
  landingHeroGold:{ background:"linear-gradient(135deg, #d4a83c, #f5c842, #b8882a)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" },
  landingHeroSub:{ fontSize:18, color:"rgba(255,255,255,0.6)", maxWidth:560, margin:"0 auto 36px", lineHeight:1.7, animation:"fadeUp 0.7s 0.2s ease both" },
  heroCTARow:{ display:"flex", gap:14, justifyContent:"center", flexWrap:"wrap", marginBottom:48, animation:"fadeUp 0.7s 0.3s ease both" },
  heroCtaPrimary:{ background:"linear-gradient(135deg,#d4a83c,#f0c040)", color:"#080f1e", border:"none", padding:"15px 32px", borderRadius:50, fontWeight:700, fontSize:15, cursor:"pointer", fontFamily:"'Space Grotesk',sans-serif", transition:"all 0.2s", boxShadow:"0 0 30px rgba(212,168,60,0.35)" },
  heroCtaSecondary:{ background:"transparent", color:"rgba(255,255,255,0.8)", border:"1px solid rgba(255,255,255,0.2)", padding:"15px 32px", borderRadius:50, fontWeight:600, fontSize:15, cursor:"pointer", fontFamily:"'Space Grotesk',sans-serif", transition:"all 0.2s", backdropFilter:"blur(10px)" },
  heroChips:{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap", animation:"fadeUp 0.7s 0.4s ease both" },
  heroChip:{ display:"inline-flex", alignItems:"center", gap:6, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:100, padding:"7px 16px", fontSize:13, color:"rgba(255,255,255,0.7)", backdropFilter:"blur(8px)", animation:"fadeUp 0.5s ease both" },

  /* Ticker & Partners */
  ticker:{ background:"rgba(212,168,60,0.08)", borderTop:"1px solid rgba(212,168,60,0.15)", borderBottom:"1px solid rgba(212,168,60,0.15)", overflow:"hidden", padding:"14px 0" },
  tickerTrack:{ display:"inline-flex", whiteSpace:"nowrap", animation:"ticker 30s linear infinite" },
  tickerItem:{ fontSize:13, fontWeight:600, letterSpacing:1.5, color:"#d4a83c", textTransform:"uppercase", paddingRight:0 },
  partnersSection:{ padding:"60px 24px", maxWidth:1100, margin:"0 auto", textAlign:"center", borderBottom:"1px solid rgba(0,0,0,0.05)" },
  partnersLabel:{ fontSize:11, fontWeight:700, letterSpacing:2, color:"rgba(17,32,59,0.4)", textTransform:"uppercase", marginBottom:32 },
  partnersGrid:{ display:"flex", flexWrap:"wrap", justifyContent:"center", gap:"32px 48px", opacity:0.8 },
  partnerLogo:{ fontSize:18, fontWeight:700, fontFamily:"'Space Grotesk',sans-serif", letterSpacing:1, color:"#11203b" },

  /* Sections shared */
  sectionLabel:{ fontSize:11, fontWeight:700, letterSpacing:3, color:"#d4a83c", textTransform:"uppercase", textAlign:"center", marginBottom:14 },
  sectionTitle:{ fontFamily:"'Space Grotesk',sans-serif", fontSize:42, fontWeight:700, textAlign:"center", color:"#f8fafc", margin:"0 0 12px", lineHeight:1.15 },
  sectionSub:{ fontSize:16, color:"rgba(255,255,255,0.6)", textAlign:"center", maxWidth:520, margin:"0 auto 48px", lineHeight:1.7 },

  /* Portals */
  portalSection:{ padding:"96px 24px", maxWidth:1100, margin:"0 auto" },
  newPortalGrid:{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(340px,1fr))", gap:24 },
  newPortalCardLight:{ background:"#fff", borderRadius:24, padding:36, cursor:"pointer", transition:"transform 0.3s, box-shadow 0.3s", boxShadow:"0 12px 40px rgba(0,0,0,0.15)" },
  newPortalCardDark:{ background:"linear-gradient(145deg,#0d1a2e,#11203b)", border:"1px solid rgba(212,168,60,0.2)", borderRadius:24, padding:36, cursor:"pointer", transition:"transform 0.3s, box-shadow 0.3s", boxShadow:"0 12px 40px rgba(0,0,0,0.4)" },
  newPortalCardTop:{ display:"flex", alignItems:"center", gap:14, marginBottom:20 },
  newPortalCardIconWrap:{ width:56, height:56, borderRadius:16, background:"rgba(17,32,59,0.08)", border:"1px solid rgba(17,32,59,0.12)", display:"flex", alignItems:"center", justifyContent:"center" },
  newPortalCardIconWrap:{ width:56, height:56, borderRadius:16, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", display:"flex", alignItems:"center", justifyContent:"center" },
  newPortalBadgeLight:{ fontSize:10, fontWeight:700, letterSpacing:2, color:"#a3823f", textTransform:"uppercase", background:"rgba(212,168,60,0.1)", padding:"4px 10px", borderRadius:100 },
  newPortalBadgeDark:{ fontSize:10, fontWeight:700, letterSpacing:2, color:"#d4a83c", textTransform:"uppercase", background:"rgba(212,168,60,0.1)", padding:"4px 10px", borderRadius:100, border:"1px solid rgba(212,168,60,0.2)" },
  newPortalCardTitle:{ fontFamily:"'Space Grotesk',sans-serif", fontSize:26, fontWeight:700, color:"#f8fafc", margin:"0 0 10px" },
  newPortalCardSub:{ fontSize:14, color:"rgba(255,255,255,0.6)", lineHeight:1.7, marginBottom:24 },
  newPortalSteps:{ display:"flex", flexDirection:"column", gap:10, marginBottom:28 },
  newPortalStep:{ display:"flex", alignItems:"center", gap:12 },
  newPortalStepNum:{ width:26, height:26, borderRadius:"50%", background:"rgba(255,255,255,0.1)", color:"#fff", fontSize:12, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
  newPortalBtnDark:{ width:"100%", padding:"14px", background:"#11203b", color:"#fff", border:"none", borderRadius:14, fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"'Space Grotesk',sans-serif", transition:"opacity 0.2s" },
  newPortalBtnGold:{ width:"100%", padding:"14px", background:"linear-gradient(135deg,#d4a83c,#f0c040)", color:"#080f1e", border:"none", borderRadius:14, fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"'Space Grotesk',sans-serif", transition:"opacity 0.2s", boxShadow:"0 0 24px rgba(212,168,60,0.3)" },

  /* About */
  aboutSection:{ padding:"48px 24px", maxWidth:1100, margin:"0 auto" },
  aboutGrid:{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:24 },
  aboutCard:{ background:"#0f172a", border:"1px solid rgba(255,255,255,0.1)", borderRadius:20, padding:32, boxShadow:"0 8px 30px rgba(0,0,0,0.3)" },
  aboutIcon:{ fontSize:32, marginBottom:16 },
  aboutTitle:{ fontFamily:"'Space Grotesk',sans-serif", fontSize:22, fontWeight:700, color:"#f8fafc", margin:"0 0 12px" },
  aboutText:{ fontSize:14, color:"rgba(255,255,255,0.7)", lineHeight:1.7, margin:0 },

  /* How it works */
  howSection:{ padding:"96px 24px", maxWidth:1100, margin:"0 auto" },
  howGrid:{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:20, position:"relative" },
  howCard:{ background:"#0f172a", border:"1px solid rgba(255,255,255,0.1)", borderRadius:20, padding:28, position:"relative", transition:"transform 0.3s, border-color 0.3s", cursor:"default", boxShadow:"0 8px 30px rgba(0,0,0,0.3)" },
  howStep:{ fontSize:48, fontWeight:700, color:"rgba(212,168,60,0.15)", fontFamily:"'Space Grotesk',sans-serif", lineHeight:1, marginBottom:12 },
  howIcon:{ fontSize:28, marginBottom:12 },
  howTitle:{ fontFamily:"'Space Grotesk',sans-serif", fontSize:18, fontWeight:600, color:"#f8fafc", margin:"0 0 8px" },
  howDesc:{ fontSize:14, color:"rgba(255,255,255,0.7)", lineHeight:1.6, margin:0 },
  howConnector:{ position:"absolute", right:-16, top:"50%", transform:"translateY(-50%)", fontSize:22, color:"rgba(212,168,60,0.3)", zIndex:1 },

  /* Stats */
  statsSection:{ padding:"0 24px 60px", maxWidth:1100, margin:"0 auto" },
  statsGrid:{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:2 },
  statCard:{ background:"#0f172a", border:"1px solid rgba(255,255,255,0.1)", padding:"36px 24px", textAlign:"center", transition:"background 0.2s", boxShadow:"0 8px 30px rgba(0,0,0,0.3)" },
  statNum:{ fontFamily:"'Space Grotesk',sans-serif", fontSize:52, fontWeight:700, background:"linear-gradient(135deg,#d4a83c,#b8882a)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text", lineHeight:1, marginBottom:8 },
  statCardLabel:{ fontSize:15, fontWeight:600, color:"#f8fafc", marginBottom:4 },
  statCardSub:{ fontSize:13, color:"rgba(255,255,255,0.5)" },

  /* Testimonials */
  testimonialsSection:{ padding:"60px 24px 96px", maxWidth:1100, margin:"0 auto" },
  testimonialsGrid:{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:24, marginTop:48 },
  testimonialCard:{ background:"#fff", border:"1px solid rgba(0,0,0,0.05)", borderRadius:20, padding:32, position:"relative", boxShadow:"0 8px 30px rgba(0,0,0,0.04)" },
  testimonialQuote:{ fontSize:15, color:"rgba(17,32,59,0.8)", lineHeight:1.7, fontStyle:"italic", marginBottom:24 },
  testimonialAuthor:{ display:"flex", alignItems:"center", gap:14 },
  testimonialAvatar:{ width:44, height:44, borderRadius:"50%", background:"#d4a83c", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:700 },
  testimonialName:{ fontSize:15, fontWeight:600, color:"#11203b", marginBottom:2 },
  testimonialRole:{ fontSize:12, color:"rgba(17,32,59,0.5)" },

  /* CTA Banner */
  ctaBanner:{ position:"relative", background:"linear-gradient(135deg,#0d1a2e 0%,#11203b 50%,#0d1a2e 100%)", borderTop:"1px solid rgba(212,168,60,0.15)", borderBottom:"1px solid rgba(212,168,60,0.15)", overflow:"hidden", padding:"96px 24px" },
  ctaOrb1:{ position:"absolute", width:400, height:400, borderRadius:"50%", background:"radial-gradient(circle,rgba(212,168,60,0.1) 0%,transparent 70%)", top:"-100px", right:"-80px", pointerEvents:"none", animation:"orb1 10s ease-in-out infinite" },
  ctaOrb2:{ position:"absolute", width:300, height:300, borderRadius:"50%", background:"radial-gradient(circle,rgba(22,122,68,0.08) 0%,transparent 70%)", bottom:"-60px", left:"-60px", pointerEvents:"none", animation:"orb2 13s ease-in-out infinite" },
  ctaInner:{ position:"relative", zIndex:2, maxWidth:600, margin:"0 auto", textAlign:"center" },

  /* Legacy (keep for other pages) */
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

  /* ── Proctor Cam ── */
  proctorWrap:{ position:"fixed", bottom:30, right:30, width:160, height:120, borderRadius:12, overflow:"hidden", border:"2px solid #e7e2d3", background:"#000", boxShadow:"0 8px 24px rgba(17,32,59,0.15)", zIndex:50 },
  proctorVideo:{ width:"100%", height:"100%", objectFit:"cover", transform:"scaleX(-1)" },
  proctorLabel:{ position:"absolute", top:6, left:6, background:"rgba(0,0,0,0.6)", color:"#fff", fontSize:10, padding:"4px 8px", borderRadius:4, fontWeight:600, display:"flex", alignItems:"center", gap:6 },
  proctorDot:{ width:6, height:6, borderRadius:"50%", background:"#ef4444", animation:"pulse 2s infinite" },
  proctorWarningOverlay:{ position:"fixed", inset:0, background:"rgba(153,27,27,0.95)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", zIndex:9999, padding:20, textAlign:"center", color:"#fff", backdropFilter:"blur(8px)" },
  proctorWarningTitle:{ fontSize:24, fontWeight:700, marginBottom:12, fontFamily:"'Space Grotesk',sans-serif" },
  proctorWarningText:{ fontSize:15, lineHeight:1.6, marginBottom:24, maxWidth:400 },
  proctorWarningBtn:{ background:"#fff", color:"#991b1b", border:"none", padding:"12px 24px", borderRadius:12, fontWeight:700, fontSize:15, cursor:"pointer" },

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
