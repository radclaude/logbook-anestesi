import React, { useState, useEffect } from "react";

// Tautan API Google Sheets
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwzBsWn_fvt786X2Ijn6LpYq2vEFeW_tGVCf95fVUdaRLoxVNS33F_kwOAXtRrtAPNMpQ/exec";

// ─── STYLES ANIMASI & ANTI-ZOOM (DIMASUKKAN KE SINI AGAR TIDAK ERROR) ───
const customStyles = `
  @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes tabFade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes progressFill { 0% { width: 0%; } 100% { width: 100%; } }
  
  .animate-slide-up { animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
  .animate-tab-switch { animation: tabFade 0.2s ease-out forwards; }
  .animate-progress-fill { animation: progressFill 2.5s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
  
  .hide-scrollbar::-webkit-scrollbar { display: none; }
  .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  .glass-nav { background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }
  
  /* ANTI ZOOM IOS FIX */
  html, body { touch-action: pan-x pan-y; overscroll-behavior-y: none; background-color: #f8fafc; }
  input, select, textarea { font-size: 16px !important; }
`;

// ─── DATA & KONFIGURASI ──────────────────────────────────────────────────────
const KOMORBID = ["COPD", "ASTHMA", "DM", "GERIATRI", "OBESITAS", "KELAINAN JANTUNG"];

const STASE_REQ = {
  "THT I": [
    { id: "tht_ga", label: "GA INTUBASI", sub: ["RHINO", "OTO", "LARINGFARING"], target: 30, grouped: true },
    { id: "tht_hip", label: "HIPOTENSI TERKENDALI", sub: [], target: 15 },
  ],
  "THT II": [
    { id: "tht2_da", label: "DIFFICULT AIRWAY", sub: [], target: 10 },
    { id: "tht2_re", label: "RE-KONSTRUKSI", sub: [], target: 10 },
  ],
  "ORTO I": [
    { id: "ort_sab", label: "SAB", sub: [], target: 20 },
    { id: "ort_epi", label: "EPIDURAL", sub: [], target: 10 },
    { id: "ort_ga", label: "GA ORTOPEDI", sub: ["SUPINE", "PRONE"], target: 30, grouped: true },
    { id: "ort_blok", label: "BLOK SARAF USG GUIDED", sub: [], target: 5 },
  ],
  "OBSGIN I": [
    { id: "obs_sab", label: "SAB", sub: [], target: 20 },
    { id: "obs_epi", label: "EPIDURAL", sub: [], target: 10 },
    { id: "obs_ga", label: "GA", sub: ["OBSTETRI", "GINEKOLOGI"], target: 30, grouped: true },
  ],
  "PEDIATRI I": [
    { id: "ped_ga", label: "GA ANAK >1TH", sub: [], target: 30 },
    { id: "ped_nyeri", label: "MANAJEMEN NYERI PEDIATRI", sub: [], target: 15 },
    { id: "ped_sed", label: "SEDASI PEDIATRI", sub: [], target: 10 },
    { id: "ped_caud", label: "CAUDAL BLOCK", sub: [], target: 5 },
  ],
  "ICU I": [
    { id: "icu_mgmt", label: "MANAJEMEN KASUS ICU", sub: [], target: 25 },
    { id: "icu_cvc", label: "CVC", sub: [], target: 20 },
    { id: "icu_res", label: "RESUSITASI LUAR OK", sub: [], target: 25 },
  ],
  "NORA": [
    { id: "nor_rj", label: "RAWAT JALAN", sub: [], target: 30 },
    { id: "nor_nora", label: "NORA", sub: ["MSCT", "MRI", "BRACHYTERAPI", "MTX IT"], target: 20, grouped: true },
  ],
  "PAIN": [
    { id: "pai_usg", label: "BASIC SKILL USG", sub: [], target: 5 },
    { id: "pai_akut", label: "MANAJEMEN NYERI AKUT", sub: [], target: 100 },
    { id: "pai_kron", label: "MANAJEMEN NYERI KRONIK", sub: [], target: 10 },
  ],
  "ONKOPLAST": [
    { id: "onk_da", label: "DIFFICULT AIRWAY", sub: [], target: 15 },
    { id: "onk_plast", label: "PLASTIK", sub: ["FLAP", "KONGENITAL"], target: 20, grouped: true },
    { id: "onk_hn", label: "GA HEAD & NECK", sub: ["HEAD & NECK", "LAINNYA"], target: 20, grouped: true },
    { id: "onk_endo", label: "ENDOKRIN", sub: ["THYROID", "LAINNYA"], target: 20, grouped: true },
  ],
  "MATA": [
    { id: "mat_gad", label: "GA DEWASA", sub: [], target: 30 },
    { id: "mat_gap", label: "GA PEDIATRI", sub: [], target: 20 },
    { id: "mat_reg", label: "REGIONAL ANESTESI", sub: [], target: 5 },
  ],
  "UROLOGI": [
    { id: "uro_sab", label: "BEDAH UROLOGI — SAB", sub: [], target: 15 },
    { id: "uro_epi", label: "BEDAH UROLOGI — EPIDURAL", sub: [], target: 5 },
    { id: "uro_ga", label: "BEDAH UROLOGI — GA", sub: [], target: 30 },
    { id: "uro_turp", label: "TURP", sub: [], target: 15 },
    { id: "uro_adr", label: "TUMOR ADRENAL", sub: [], target: 3 },
  ],
};

const STASE_ORDERED = Object.keys(STASE_REQ);

// ─── FUNGSI UTILITAS ─────────────────────────────────────────────────────────
const hashPin = (pin) => btoa("ppds_" + pin + "_anest");

function getProgress(entries, nim, stase) {
  const filtered = entries.filter((e) => e.nim === nim && e.stase === stase);
  const reqs = STASE_REQ[stase] || [];
  const totalTarget = reqs.reduce((acc, curr) => acc + curr.target, 0);
  const totalCount = reqs.reduce((acc, k) => acc + filtered.filter((e) => e.kompetensiId === k.id).length, 0);
  const totalPct = totalTarget > 0 ? Math.min(100, Math.round((totalCount / totalTarget) * 100)) : 0;
  const detail = reqs.map((k) => {
    const count = filtered.filter((e) => e.kompetensiId === k.id).length;
    return { ...k, count, pct: Math.min(100, Math.round((count / k.target) * 100)) };
  });
  return { detail, totalPct, totalCount, totalTarget };
}

const today = () => new Date().toISOString().split("T")[0];

// ─── KOMPONEN KECIL ──────────────────────────────────────────────────────────
function PinDots({ value, length = 4 }) {
  return (
    <div className="flex gap-4 justify-center my-8">
      {Array.from({ length }).map((_, i) => (
        <div key={i} className={`w-4 h-4 rounded-full transition-all duration-300 ${i < value.length ? "bg-blue-600 scale-125 shadow-md shadow-blue-200" : "bg-gray-200"}`} />
      ))}
    </div>
  );
}

function NumPad({ onPress }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];
  return (
    <div className="grid grid-cols-3 gap-y-4 gap-x-6 w-full max-w-[280px] mx-auto">
      {keys.map((k, i) => k === "" ? <div key={i} /> : (
        <button key={i} onClick={() => onPress(k)} 
          className={`h-16 w-16 mx-auto rounded-full text-2xl font-medium transition-all active:scale-90 flex items-center justify-center
          ${k === "⌫" ? "bg-gray-100 text-gray-500 hover:bg-gray-200" : "bg-white text-gray-800 shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-gray-50"}`}>
          {k}
        </button>
      ))}
    </div>
  );
}

// ─── LAYAR SPLASH ────────────────────────────────────────────────────────────
function SplashScreen({ isFading }) {
  return (
    <div className={`fixed inset-0 z-50 flex flex-col items-center justify-between bg-[#FAFAFA] px-6 pt-24 pb-12 transition-opacity duration-700 ease-in-out ${isFading ? 'opacity-0' : 'opacity-100'}`}>
      <div className="flex flex-col items-center flex-1 w-full mt-12">
        <div className="relative mb-12 animate-slide-up">
          <div className="w-[120px] h-[120px] rounded-full bg-gradient-to-b from-[#3B66F5] to-[#4536D6] shadow-[0_12px_40px_rgba(59,102,245,0.3)] flex items-center justify-center">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="#ffffff" xmlns="http://www.w3.org/2000/svg"><path d="M16 6V4C16 2.89543 15.1046 2 14 2H10C8.89543 2 8 2.89543 8 4V6H3C2.44772 6 2 6.44772 2 7V20C2 21.1046 2.89543 22 4 22H20C21.1046 22 22 21.1046 22 20V7C22 6.44772 21.5523 6 21 6H16ZM10 4H14V6H10V4ZM13 15H15V17H13V19H11V17H9V15H11V13H13V15Z" fill="#ffffff"/></svg>
          </div>
          <div className="absolute top-1 right-1 w-8 h-8 bg-emerald-100 rounded-full border-[3px] border-[#FAFAFA] flex items-center justify-center shadow-sm">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
        </div>
        <h1 className="text-[32px] font-black text-[#1A1A1A] leading-[1.15] text-center tracking-tight animate-slide-up" style={{animationDelay: '0.1s'}}>
          Logbook<br/>Residen Anestesi
        </h1>
        <p className="text-[9px] font-bold text-slate-400 tracking-[0.2em] mt-5 uppercase text-center max-w-[300px] animate-slide-up" style={{animationDelay: '0.2s'}}>
          Prodi Anestesiologi dan Terapi Intensif FK Undip
        </p>
        <div className="mt-16 w-full max-w-[260px] flex flex-col items-center animate-slide-up" style={{animationDelay: '0.3s'}}>
          <div className="flex items-center gap-2.5 mb-3">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
            <span className="text-[13px] text-blue-700 font-semibold tracking-wide">Sinkronisasi Cloud...</span>
          </div>
          <div className="w-full h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#3B66F5] to-[#4536D6] rounded-full animate-progress-fill"></div>
          </div>
          <p className="text-[10px] text-slate-400 mt-4 font-medium tracking-wide">Menyiapkan brankas klinis terenkripsi</p>
        </div>
      </div>
    </div>
  );
}

// ─── LAYAR LOGIN ─────────────────────────────────────────────────────────────
function LoginScreen({ registry, onSuccess, onBack, onResetPin }) {
  const [step, setStep] = useState("nim"); 
  const [nim, setNim] = useState(() => localStorage.getItem("last_nim_v5") || "");
  const [nama, setNama] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [foundUser, setFoundUser] = useState(null);
  const [err, setErr] = useState("");

  const resetLocal = () => { setPin(""); setPinConfirm(""); setErr(""); };

  function handleNimNext() {
    if (!nim.trim()) return setErr("NIM tidak boleh kosong");
    localStorage.setItem("last_nim_v5", nim.trim());
    const user = registry.find((p) => p.nim === nim.trim());
    if (user) { setFoundUser(user); setStep("pin"); setErr(""); } 
    else { setStep("setup_nim"); setErr(""); }
  }

  function handlePin(k) {
    if (k === "⌫") return setPin((p) => p.slice(0, -1));
    if (pin.length >= 4) return;
    const next = pin + k;
    setPin(next);
    if (next.length === 4) {
      setTimeout(() => {
        if (hashPin(next) === foundUser.pinHash) onSuccess(foundUser);
        else { setErr("PIN tidak valid"); setPin(""); }
      }, 250);
    }
  }

  if (step === "nim") return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-md mx-auto px-8 py-12 animate-fade-in relative z-10">
      <button onClick={onBack} className="text-slate-400 text-sm mb-12 flex items-center gap-2 font-medium active:scale-95 transition-transform w-fit hover:text-slate-600">
        <span className="text-lg">←</span> Kembali
      </button>
      <div className="flex-1 animate-slide-up" style={{animationDelay: '0.1s'}}>
        <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center text-3xl mb-6">🏥</div>
        <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Identitas PPDS</h2>
        <p className="text-slate-500 mb-10 text-sm leading-relaxed">Masukkan Nomor Induk Mahasiswa Anda untuk mengakses sistem logbook.</p>
        <div className="space-y-5">
          <input autoFocus value={nim} onChange={(e) => setNim(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleNimNext()} placeholder="Contoh: 11223344" className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-base focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm font-bold text-slate-700" />
          {err && <p className="text-red-500 text-sm px-2 font-medium">{err}</p>}
          <button onClick={handleNimNext} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-2xl font-bold text-lg shadow-[0_8px_30px_rgba(37,99,235,0.25)] active:scale-[0.98] transition-all">Lanjutkan</button>
        </div>
      </div>
    </div>
  );

  if (step === "pin") return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-md mx-auto py-12 animate-fade-in relative z-10">
      <div className="px-8 mb-6"><button onClick={() => { setStep("nim"); resetLocal(); }} className="text-blue-600 font-medium active:scale-95 transition-transform">← Ganti Akun</button></div>
      <div className="text-center flex-1 px-8 animate-slide-up" style={{animationDelay: '0.1s'}}>
        <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-4xl font-black mx-auto mb-5 shadow-lg">{foundUser.nama[0]}</div>
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{foundUser.nama}</h2>
        <p className="text-slate-400 mt-1.5 text-sm">Masukkan PIN Keamanan</p>
        <PinDots value={pin} />
        {err && <p className="text-red-500 text-sm mb-6 font-medium">{err}</p>}
        <NumPad onPress={handlePin} />
        <button onClick={() => { if(window.confirm("Lupa PIN? Anda harus mendaftarkan ulang nama Anda. Data logbook tetap aman berdasarkan NIM.")) { onResetPin(foundUser.nim); setStep("nim"); setNim(foundUser.nim); } }} className="mt-10 text-slate-400 text-sm font-medium hover:text-slate-600 transition-colors">Lupa PIN?</button>
      </div>
    </div>
  );

  if (step === "setup_nim" || step === "setup_pin" || step === "confirm_pin") return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-md mx-auto py-12 px-8 animate-fade-in relative z-10">
      {step === "setup_nim" && (
        <div className="mt-4 animate-slide-up">
          <button onClick={() => setStep("nim")} className="text-slate-400 text-sm mb-8 flex items-center gap-2 font-medium">← Kembali</button>
          <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center text-2xl mb-5">👋</div>
          <h2 className="text-3xl font-black mb-2 text-slate-900 tracking-tight">Halo, PPDS Baru!</h2>
          <p className="text-slate-500 mb-8 text-sm">NIM <strong className="text-slate-800">{nim}</strong> belum terdaftar. Lengkapi identitas Anda.</p>
          <div className="space-y-4">
            <input autoFocus value={nama} onChange={e => setNama(e.target.value)} placeholder="Contoh: dr. Budi Santoso" className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-base shadow-sm outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold text-slate-700" />
            {err && <p className="text-red-500 text-sm px-2 font-medium">{err}</p>}
            <button onClick={() => nama.trim() ? setStep("setup_pin") : setErr("Nama wajib diisi")} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg">Buat PIN Keamanan</button>
          </div>
        </div>
      )}
      {(step === "setup_pin" || step === "confirm_pin") && (
        <div className="text-center animate-slide-up">
          <button onClick={() => step === "setup_pin" ? setStep("setup_nim") : setStep("setup_pin")} className="absolute top-10 left-8 text-slate-400 font-medium">←</button>
          <div className="mt-8">
            <h2 className="text-2xl font-bold text-slate-900">{step === "setup_pin" ? "Buat PIN Baru" : "Konfirmasi PIN"}</h2>
            <p className="text-slate-500 mt-1.5 text-sm">{nama}</p>
            <PinDots value={step === "setup_pin" ? pin : pinConfirm} />
            <NumPad onPress={(k) => {
              if (k === "⌫") return step === "setup_pin" ? setPin(p => p.slice(0,-1)) : setPinConfirm(p => p.slice(0,-1));
              if (step === "setup_pin") { const next = pin + k; if(next.length <= 4) setPin(next); if(next.length === 4) setTimeout(() => setStep("confirm_pin"), 200); } 
              else { const next = pinConfirm + k; if(next.length <= 4) setPinConfirm(next); if(next.length === 4) { if (next === pin) onSuccess({ nim: nim.trim(), nama: nama.trim(), pinHash: hashPin(pin), staseHistory: [] }, true); else { alert("PIN tidak cocok."); setPin(""); setPinConfirm(""); setStep("setup_pin"); } } }
            }} />
          </div>
        </div>
      )}
    </div>
  );
  return null;
}

// ─── LAYAR PILIH STASE ───────────────────────────────────────────────────────
function PilihStaseScreen({ ppds, entries, onPilih, onLogout }) {
  const [pilihan, setPilihan] = useState("");
  const history = [...new Set((ppds.staseHistory || []).map((h) => h.stase))];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-md mx-auto relative overflow-hidden animate-fade-in">
      <div className="absolute top-0 left-0 right-0 h-80 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 rounded-b-[3rem] z-0"></div>
      <div className="px-6 pt-14 pb-8 text-white relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-[1.25rem] border border-white/20 flex items-center justify-center text-2xl font-bold shadow-lg">{ppds.nama[0]}</div>
            <div><p className="text-blue-100 text-xs font-semibold uppercase tracking-wider mb-0.5">Selamat Datang</p><h2 className="font-bold text-xl leading-tight text-white">{ppds.nama}</h2></div>
          </div>
        </div>
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 shadow-lg animate-slide-up" style={{animationDelay: '0.1s'}}>
          <p className="text-[11px] font-bold tracking-widest text-blue-200 uppercase mb-3 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>Riwayat Rotasi</p>
          <div className="flex flex-wrap gap-2">
            {history.length ? history.map(s => <span key={s} className="bg-white/20 text-white border border-white/20 text-xs font-medium px-3.5 py-1.5 rounded-xl shadow-sm">{s}</span>) : <p className="text-xs text-blue-200/70 italic">Belum ada riwayat</p>}
          </div>
        </div>
      </div>
      <div className="px-5 pb-8 flex-1 animate-slide-up relative z-10" style={{animationDelay: '0.2s'}}>
        <div className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100 p-6">
          <div className="mb-6"><h3 className="text-lg font-black text-slate-800 tracking-tight">Pilih Stase Aktif</h3><p className="text-slate-400 text-sm mt-1">Rotasi stase saat ini</p></div>
          <div className="grid grid-cols-1 gap-3 max-h-[45vh] overflow-y-auto pr-2 hide-scrollbar pb-4">
            {STASE_ORDERED.map((s) => {
              const prog = getProgress(entries, ppds.nim, s);
              const isSelected = pilihan === s;
              const hasCases = prog.totalCount > 0;
              return (
                <button key={s} onClick={() => setPilihan(s)} className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all active:scale-[0.98] text-left relative overflow-hidden ${isSelected ? "border-blue-500 bg-blue-50/50" : "border-slate-100 bg-white hover:border-slate-200"}`}>
                  <div className="relative z-10">
                    <div className={`font-bold text-sm ${isSelected ? "text-blue-700" : "text-slate-700"}`}>{s}</div>
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">{hasCases ? <><span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block"></span>{prog.totalCount} Kasus</> : "Belum ada data"}</div>
                  </div>
                  {hasCases && <div className="relative z-10"><div className={`text-xs font-black px-2.5 py-1 rounded-lg ${isSelected ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{prog.totalPct}%</div></div>}
                  {hasCases && isSelected && <div className="absolute left-0 top-0 bottom-0 bg-blue-100/50 transition-all duration-700" style={{width: `${prog.totalPct}%`}}></div>}
                </button>
              );
            })}
          </div>
          <div className="pt-4 border-t border-slate-100 mt-2">
            <button onClick={() => pilihan && onPilih(pilihan)} disabled={!pilihan} className={`w-full py-4 rounded-2xl font-bold text-base transition-all flex justify-center items-center gap-2 ${pilihan ? "bg-slate-900 hover:bg-slate-800 text-white shadow-lg active:scale-95" : "bg-slate-100 text-slate-400"}`}>
              {pilihan && getProgress(entries, ppds.nim, pilihan).totalCount > 0 ? `Lanjutkan Stase ${pilihan}` : `Mulai Rotasi ${pilihan || ""}`} <span>→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── TAB: FORM INPUT ─────────────────────────────────────────────────────────
function LogbookForm({ ppds, stase, onAdd }) {
  const blank = { tanggal:today(), noErm:"", inisial:"", diagnosis:"", tindakanBedah:"", kompetensiId:"", subTipe:"", catatan:"", komorbid:[] };
  const [form, setForm] = useState(blank);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  const reqs = STASE_REQ[stase] || [];
  const selKomp = reqs.find(k => k.id === form.kompetensiId);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function toggleKomorbid(k) { setForm(f => ({ ...f, komorbid: f.komorbid.includes(k) ? f.komorbid.filter(x => x !== k) : [...f.komorbid, k] })); }

  async function handleSubmit() {
    if (!form.tanggal || !form.noErm.trim() || !form.inisial.trim() || !form.kompetensiId) return setErr("Lengkapi Tanggal, No. ERM, Inisial, dan Tindakan");
    setErr(""); setSaved(true); setTimeout(() => setSaved(false), 3000);
    await onAdd({ ...form, nim: ppds.nim, nama: ppds.nama, stase });
    setForm(blank);
  }

  return (
    <div className="space-y-5 p-5 animate-tab-switch pb-8">
      {saved && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-3.5 rounded-2xl text-sm font-semibold flex items-center gap-3 shadow-sm">
          <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-lg">✅</div>
          <div><p>Kasus Berhasil Disimpan</p><p className="text-xs font-normal text-emerald-600/80">Sinkronisasi Cloud Aktif</p></div>
        </div>
      )}
      {err && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-2xl text-sm font-medium">{err}</div>}
      
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4">
        <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2"><span className="text-blue-500">📋</span> Data Pasien</h3>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs text-slate-500 font-semibold mb-1.5 block">Tanggal *</label><input type="date" value={form.tanggal} onChange={e => set("tanggal", e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-base focus:ring-4 focus:ring-blue-500/10 font-medium text-slate-700" /></div>
          <div><label className="text-xs text-slate-500 font-semibold mb-1.5 block">No. ERM *</label><input value={form.noErm} onChange={e => set("noErm", e.target.value)} placeholder="00-00-00" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-base focus:ring-4 focus:ring-blue-500/10 font-medium text-slate-700" /></div>
        </div>
        <div><label className="text-xs text-slate-500 font-semibold mb-1.5 block">Inisial Pasien *</label><input value={form.inisial} onChange={e => set("inisial", e.target.value)} placeholder="Contoh: A.S." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-base focus:ring-4 focus:ring-blue-500/10 font-medium text-slate-700" /></div>
        <div><label className="text-xs text-slate-500 font-semibold mb-1.5 block">Diagnosis</label><input value={form.diagnosis} onChange={e => set("diagnosis", e.target.value)} placeholder="Diagnosis kerja" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-base focus:ring-4 focus:ring-blue-500/10 font-medium text-slate-700" /></div>
      </div>

      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4">
        <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2"><span className="text-indigo-500">💉</span> Prosedur Klinis</h3>
        <div><label className="text-xs text-slate-500 font-semibold mb-1.5 block">Tindakan Bedah</label><input value={form.tindakanBedah} onChange={e => set("tindakanBedah", e.target.value)} placeholder="Jenis operasi" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-base focus:ring-4 font-medium text-slate-700" /></div>
        <div>
          <label className="text-xs text-slate-500 font-semibold mb-1.5 block">Tindakan Anestesi *</label>
          <select value={form.kompetensiId} onChange={e => { set("kompetensiId", e.target.value); set("subTipe", ""); }} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-base font-bold text-slate-700">
            <option value="">Pilih kompetensi...</option>{reqs.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
        </div>
        {selKomp?.sub?.length > 0 && (
          <div className="animate-fade-in">
            <label className="text-xs text-slate-500 font-semibold mb-1.5 block">Sub-Tipe Tindakan</label>
            <select value={form.subTipe} onChange={e => set("subTipe", e.target.value)} className="w-full bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3.5 text-base text-indigo-900 font-bold">
              <option value="">Spesifikasi...</option>{selKomp.sub.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
        <label className="text-xs text-slate-500 font-semibold mb-3 block flex items-center gap-2"><span className="text-rose-500">❤️‍🩹</span> Komorbid Penyerta</label>
        <div className="flex flex-wrap gap-2.5">
          {KOMORBID.map(k => (
            <button key={k} type="button" onClick={() => toggleKomorbid(k)} 
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${form.komorbid.includes(k) ? "bg-rose-50 text-rose-600 border-rose-200 shadow-sm" : "bg-white text-slate-500 border-slate-200"}`}>
              {k}
            </button>
          ))}
        </div>
      </div>

      <button onClick={handleSubmit} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-bold text-lg shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2">
        <span className="text-xl">💾</span> Simpan Logbook
      </button>
    </div>
  );
}

function CapaianView({ progress }) {
  const { detail, totalPct, totalCount, totalTarget } = progress;
  const doneKomp = detail.filter(k => k.count >= k.target).length;
  const totalKomp = detail.length;
  
  return (
    <div className="p-5 space-y-4 animate-tab-switch pb-8">
      <div className="bg-white border border-blue-100 rounded-3xl p-5 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-1">Capaian Kompetensi</p>
            <div className="flex items-baseline gap-1"><span className="text-2xl font-black text-slate-800">{doneKomp}</span><span className="text-sm font-semibold text-slate-500">/{totalKomp} selesai</span></div>
          </div>
          <div className="text-right">
            <span className={`text-4xl font-black ${totalPct >= 100 ? 'text-emerald-500' : 'text-blue-600'}`}>{totalPct}%</span>
            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{totalCount}/{totalTarget} Kasus</p>
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {detail.map(k => {
          const isDone = k.count >= k.target;
          return (
            <div key={k.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
               <div className="flex justify-between items-center mb-2">
                 <h4 className="font-bold text-sm text-slate-700">{k.label}</h4>
                 <span className={`font-black text-sm ${isDone ? 'text-emerald-500' : 'text-rose-500'}`}>{k.count}/{k.target}</span>
               </div>
               <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                 <div className={`h-full rounded-full transition-all duration-700 ${isDone ? 'bg-emerald-500' : 'bg-rose-400'}`} style={{width: `${k.pct}%`}}></div>
               </div>
            </div>
          )
        })}
      </div>
    </div>
  );
}

function ProfileView({ ppds, stase, onChangeStase, onLogout }) {
  return (
    <div className="p-6 animate-tab-switch pb-8">
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-8 text-center mb-6">
        <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[2rem] text-white flex items-center justify-center text-4xl font-black mx-auto mb-5 shadow-lg shadow-blue-500/30">
          {ppds.nama[0]}
        </div>
        <h2 className="text-xl font-black text-slate-800 tracking-tight">{ppds.nama}</h2>
        <p className="text-slate-500 text-sm mt-1 mb-6 font-medium">NIM. {ppds.nim}</p>
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-left flex justify-between items-center">
           <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Rotasi Aktif</p><p className="font-bold text-slate-800">{stase}</p></div>
           <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-blue-500">📍</div>
        </div>
      </div>
      <div className="space-y-3">
        <button onClick={onChangeStase} className="w-full bg-white border border-slate-200 text-slate-700 font-bold py-4 rounded-2xl shadow-sm active:scale-95 transition-all">Ganti Stase / Rotasi</button>
        <button onClick={onLogout} className="w-full bg-rose-50 border border-rose-100 text-rose-600 font-bold py-4 rounded-2xl shadow-sm active:scale-95 transition-all">Keluar (Logout)</button>
      </div>
    </div>
  );
}

// ─── APLIKASI UTAMA ─────────────────────────────────────────────────────────
export default function App() {
  const [splashState, setSplashState] = useState("visible");
  const [view, setView] = useState("welcome");
  const [ppds, setPpds] = useState(null);
  const [staseAktif, setStaseAktif] = useState("");
  const [ppdsTab, setPpdsTab] = useState("form");
  const [entries, setEntries] = useState([]);
  const [registry, setRegistry] = useState([]);

  useEffect(() => {
    // 💡 PENAMBAHAN CSS (INTERNAL)
    const styleSheet = document.createElement("style");
    styleSheet.innerText = customStyles;
    document.head.appendChild(styleSheet);

    const init = async () => {
      let reg = []; let ents = []; let session = null;
      try { reg = JSON.parse(localStorage.getItem("ppds_registry_v6")) || []; } catch(e){}
      try { ents = JSON.parse(localStorage.getItem("logbook_entries_v6")) || []; } catch(e){}
      try { session = JSON.parse(localStorage.getItem("active_session_v6")); } catch(e){}

      setRegistry(reg); setEntries(ents);

      if (SCRIPT_URL && SCRIPT_URL !== "PASTE_URL_APPS_SCRIPT_DI_SINI") {
        try {
          const res = await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "sync" }) });
          const data = await res.json();
          if (data.result === "success") {
            if (data.users && data.users.length > 1) {
              reg = data.users.slice(1).map(r => ({ nim: String(r[0]), nama: r[1], pinHash: r[2], staseHistory: (typeof r[3] === 'string' && r[3].startsWith('[')) ? JSON.parse(r[3]) : [] }));
              setRegistry(reg); localStorage.setItem("ppds_registry_v6", JSON.stringify(reg));
            }
            if (data.logs && data.logs.length > 1) {
              ents = data.logs.slice(1).map(r => ({
                id: r[0], ts: r[1], nim: String(r[2]), nama: r[3], stase: r[4], tanggal: r[5], noErm: r[6], inisial: r[7], diagnosis: r[8], tindakanBedah: r[9], kompetensiId: r[10], subTipe: r[11], komorbid: String(r[12] || "").split(",").map(s => s.trim()).filter(Boolean), catatan: r[13]
              }));
              setEntries(ents); localStorage.setItem("logbook_entries_v6", JSON.stringify(ents));
            }
          }
        } catch (err) {}
      }

      if (session && session.nim) {
        const latestReg = JSON.parse(localStorage.getItem("ppds_registry_v6")) || reg;
        const user = latestReg.find(u => u.nim === session.nim);
        if (user) {
          setPpds(user);
          if (session.staseAktif) { setStaseAktif(session.staseAktif); setView("logbook"); } 
          else { setView("pilih_stase"); }
        }
      }

      setTimeout(() => setSplashState("fading"), 800);
      setTimeout(() => setSplashState("hidden"), 1500);
    };
    init();

    return () => { document.head.removeChild(styleSheet); };
  }, []);

  const saveToLocal = (key, data) => localStorage.setItem(key, JSON.stringify(data));
  const syncUserToCloud = async (userObj) => { try { await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "register_user", ...userObj }) }); } catch(e){} };

  const handleLogout = () => { localStorage.removeItem("active_session_v6"); setPpds(null); setStaseAktif(""); setView("welcome"); };
  const handleChangeStase = () => { saveToLocal("active_session_v6", { nim: ppds.nim, staseAktif: "" }); setStaseAktif(""); setView("pilih_stase"); };

  const handlePilihStase = (s) => {
    const updatedUser = { ...ppds, staseHistory: [...(ppds.staseHistory || []).filter(h => h.stase !== s), { stase: s, mulai: today() }] };
    const newReg = [...registry.filter((p) => p.nim !== updatedUser.nim), updatedUser];
    setRegistry(newReg); saveToLocal("ppds_registry_v6", newReg); setPpds(updatedUser);
    saveToLocal("active_session_v6", { nim: updatedUser.nim, staseAktif: s }); 
    setStaseAktif(s); setPpdsTab("form"); setView("logbook");
    syncUserToCloud(updatedUser); 
  };

  const handleLoginSuccess = async (user) => {
    const newReg = [...registry.filter((p) => p.nim !== user.nim), user];
    setRegistry(newReg); saveToLocal("ppds_registry_v6", newReg); setPpds(user);
    saveToLocal("active_session_v6", { nim: user.nim, staseAktif: "" }); 
    setView("pilih_stase"); syncUserToCloud(user); 
  };

  const handleResetPin = async (nim) => {
    const newReg = registry.filter(p => p.nim !== nim);
    setRegistry(newReg); saveToLocal("ppds_registry_v6", newReg); localStorage.removeItem("last_nim_v5");
  };

  const addEntry = async (entry) => {
    const newEntry = { ...entry, id: Date.now(), ts: new Date().toISOString() };
    const newEnts = [...entries, newEntry];
    setEntries(newEnts); saveToLocal("logbook_entries_v6", newEnts);
    try { await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify(newEntry) }); } catch (err) {}
  };

  const deleteEntry = async (id) => {
    if(window.confirm("Hapus catatan kasus ini?")) {
      const newEnts = entries.filter(e => e.id !== id);
      setEntries(newEnts); saveToLocal("logbook_entries_v6", newEnts);
      try { await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "delete", id: id }) }); } catch (err) {}
    }
  };

  return (
    <React.Fragment>
      {splashState !== "hidden" && <SplashScreen isFading={splashState === "fading"} />}
      <div className={`w-full min-h-screen bg-slate-50 transition-opacity duration-700 ease-in-out ${splashState === "visible" ? "opacity-0" : "opacity-100"}`}>
        
        {view === "welcome" && (
          <div className="min-h-screen flex flex-col max-w-md mx-auto relative overflow-hidden">
            <div className="absolute top-[-10%] left-[-20%] w-[140%] h-[60%] bg-gradient-to-br from-blue-500 to-indigo-600 rounded-b-[100%] opacity-10"></div>
            <div className="flex-1 flex flex-col items-center justify-center p-8 relative z-10">
              <div className="w-24 h-24 bg-white rounded-3xl shadow-lg flex items-center justify-center text-5xl mb-8">🩺</div>
              <h1 className="text-4xl font-black text-center leading-tight mb-3 text-slate-900 tracking-tight">Logbook<br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Anestesi</span></h1>
              <p className="text-slate-500 mb-12 text-center text-sm font-medium">Sistem Rotasi & Capaian Klinis PPDS<br/>Cloud Sync Enabled</p>
              <button onClick={() => setView("ppds_login")} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-[1.25rem] font-bold text-lg shadow-lg active:scale-[0.98] transition-all">Masuk Sistem →</button>
            </div>
          </div>
        )}

        {view === "ppds_login" && <LoginScreen registry={registry} onSuccess={handleLoginSuccess} onBack={() => setView("welcome")} onResetPin={handleResetPin} />}
        {view === "pilih_stase" && <PilihStaseScreen ppds={ppds} entries={entries} onPilih={handlePilihStase} onLogout={handleLogout} />}

        {view === "logbook" && (
          <div className="min-h-screen flex flex-col max-w-md mx-auto relative">
            {ppdsTab !== "profile" && (
              <div className="bg-white px-6 pt-8 pb-5 flex-shrink-0 shadow-sm sticky top-0 z-20">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">{staseAktif}</h2>
                <p className="text-slate-400 text-sm mt-1 font-medium">{getProgress(entries, ppds.nim, staseAktif).totalCount}/{getProgress(entries, ppds.nim, staseAktif).totalTarget} Target Kasus Klinis</p>
              </div>
            )}
            
            <div className="flex-1 overflow-auto bg-slate-50 hide-scrollbar pb-36">
              {ppdsTab === "form" && <LogbookForm ppds={ppds} stase={staseAktif} onAdd={addEntry} />}
              {ppdsTab === "capaian" && <CapaianView progress={getProgress(entries, ppds.nim, staseAktif)} />}
              {ppdsTab === "profile" && <ProfileView ppds={ppds} stase={staseAktif} onChangeStase={handleChangeStase} onLogout={handleLogout} />}
              {ppdsTab === "riwayat" && (
                <div className="p-5 space-y-4 animate-tab-switch pb-8">
                  {entries.filter(e => e.nim === ppds.nim && e.stase === staseAktif).length === 0 ? (
                    <div className="text-center py-16 text-slate-400"><div className="text-4xl mb-3 opacity-50">📭</div><p className="text-sm font-medium">Belum ada kasus</p></div>
                  ) : entries.filter(e => e.nim === ppds.nim && e.stase === staseAktif).sort((a,b) => b.id - a.id).map(e => (
                    <div key={e.id} className="bg-white p-5 rounded-3xl shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-400"></div>
                      <div className="flex justify-between items-start mb-2">
                        <div><div className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md inline-block">{e.tanggal}</div><div className="text-xs font-semibold text-slate-400 mt-1">ERM: {e.noErm}</div></div>
                        <button onClick={() => deleteEntry(e.id)} className="w-8 h-8 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-100"><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                      </div>
                      <h4 className="font-black text-lg text-slate-800 mb-1">{e.inisial}</h4>
                      <div className="text-indigo-600 text-sm font-bold bg-indigo-50 inline-block px-3 py-1 rounded-lg mt-1 mb-2">{STASE_REQ[staseAktif]?.find(k => k.id === e.kompetensiId)?.label || e.kompetensiId}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="fixed bottom-0 w-full max-w-md bg-white border-t border-slate-100 pt-3 pb-6 z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.04)] rounded-t-[2rem]">
              <div className="flex justify-between items-center px-4 mb-4">
                <button onClick={() => setPpdsTab("form")} className={`flex flex-col items-center justify-center w-20 h-14 rounded-2xl transition-all duration-300 ${ppdsTab === "form" ? "bg-[#3B66F5] text-white shadow-lg scale-105" : "text-slate-400"}`}>
                  <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                  <span className="text-[9px] font-bold tracking-wider">INPUT</span>
                </button>
                <button onClick={() => setPpdsTab("riwayat")} className={`flex flex-col items-center justify-center w-20 h-14 rounded-2xl transition-all duration-300 relative ${ppdsTab === "riwayat" ? "bg-[#3B66F5] text-white shadow-lg scale-105" : "text-slate-400"}`}>
                  <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M12 7v5l4 2"></path></svg>
                  <span className="text-[9px] font-bold tracking-wider">HISTORY</span>
                </button>
                <button onClick={() => setPpdsTab("capaian")} className={`flex flex-col items-center justify-center w-20 h-14 rounded-2xl transition-all duration-300 ${ppdsTab === "capaian" ? "bg-[#3B66F5] text-white shadow-lg scale-105" : "text-slate-400"}`}>
                  <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="8" x2="12" y2="21"></line><line x1="16" y1="12" x2="16" y2="21"></line><line x1="8" y1="16" x2="8" y2="21"></line></svg>
                  <span className="text-[9px] font-bold tracking-wider">STATS</span>
                </button>
                <button onClick={() => setPpdsTab("profile")} className={`flex flex-col items-center justify-center w-20 h-14 rounded-2xl transition-all duration-300 ${ppdsTab === "profile" ? "bg-[#3B66F5] text-white shadow-lg scale-105" : "text-slate-400"}`}>
                  <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                  <span className="text-[9px] font-bold tracking-wider">PROFILE</span>
                </button>
              </div>
              <div className="text-center px-4"><p className="text-[9px] font-bold text-slate-400 tracking-[0.05em] uppercase">© 2026 PRODI ANESTESIOLOGI FK UNDIP</p></div>
            </div>
          </div>
        )}
      </div>
    </React.Fragment>
  );
}


