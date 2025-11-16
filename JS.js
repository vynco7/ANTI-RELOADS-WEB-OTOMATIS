/* SAFE Login Finder + Marker Filler for CriticalDevInspector
   - Menemukan form login (heuristik), highlight, dan fill dengan marker aman.
   - Tidak meng-submit apapun.
   - Gunakan hanya pada aset milikmu atau dengan izin.
*/

(function CDI_LoginFinderSafe(){
  if (!window.__CDI_ACTIVE) {
    console.warn("Warning: CriticalDevInspector not active. This snippet can run standalone.");
  }

  // util
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const escapeHtml = s => String(s).replace(/[&<>"'`]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',"`":'&#96;'}[c]));

  // Safe marker payloads (NON-EXECUTABLE, for detection only)
  const SAFE_MARKERS = {
    XSS: [
      "XSS_MARKER_1",
      "<XSS_MARKER>",
      "[[XSS_MARKER]]",
      "${XSS_MARKER}"
    ],
    SQLI: [
      "SQLI_SAFE_MARKER_1",
      "SQLI_SAFE_MARKER_2",
      "SQLI_MARKER_##"
    ],
    CMD: [
      "CMD_SAFE_MARKER_1",
      "CMD_TEST_MARKER",
      "`CMD_MARKER`"
    ],
    CUSTOM: [
      "LOGIN_TEST_MARKER",
      "AUTOFILL_DEBUG",
      "TEMPLATE_MARKER"
    ]
  };

  // create UI panel (small, draggable)
  const panelId = "__cdi_login_panel";
  const existing = document.getElementById(panelId);
  if (existing) existing.remove();

  const panel = document.createElement("div");
  panel.id = panelId;
  panel.style = `
    position:fixed; left:10px; bottom:10px; z-index:2147483647;
    width:360px; max-height:60vh; overflow:auto;
    background:#0b0b0b; color:#eee; padding:10px; border-radius:8px;
    font-family:Inter,Segoe UI,monospace; font-size:13px; border:1px solid #333;
  `;

  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <strong>CDI Login Finder (SAFE)</strong>
      <div>
        <button id="cdi_lf_close" style="margin-left:6px">Close</button>
      </div>
    </div>
    <div style="color:#ccc;margin-bottom:8px;font-size:12px">
      Heuristik: cari input[type=password] atau tombol/label 'login','signin','sign in'.<br>
      Tombol 'Fill' hanya memasukkan marker — <b>tidak submit</b>.
    </div>

    <div style="display:flex;gap:6px;margin-bottom:8px">
      <button id="cdi_lf_scan" style="flex:1">Scan Login Forms</button>
      <button id="cdi_lf_highlight" style="flex:1">Highlight</button>
    </div>

    <div style="display:flex;gap:6px;margin-bottom:8px">
      <select id="cdi_lf_cat" style="flex:1">
        <option value="XSS">XSS (safe markers)</option>
        <option value="SQLI">SQLI (safe markers)</option>
        <option value="CMD">CMD (safe markers)</option>
        <option value="CUSTOM">CUSTOM</option>
      </select>
      <button id="cdi_lf_fill" style="flex:1">Fill Selected</button>
    </div>

    <div id="cdi_lf_results" style="font-size:12px;color:#ddd"></div>
  `;

  document.body.appendChild(panel);

  document.getElementById("cdi_lf_close").onclick = () => panel.remove();

  // storage for detected forms
  let detected = [];

  function heuristicallyFindLoginForms(){
    const forms = Array.from(document.forms);
    const results = [];

    forms.forEach((f, idx) => {
      const inputs = Array.from(f.elements || []);
      const hasPwd = inputs.some(i => i.type && i.type.toLowerCase() === "password");
      const text = (f.textContent || "") + (f.getAttribute && f.getAttribute('aria-label') || "");
      const action = f.action || location.href;
      // look for buttons/inputs that mention login
      const btns = inputs.filter(i => (i.tagName||"").toLowerCase()==="input" && (i.type==="submit"||i.type==="button"))
                        .concat(Array.from(f.querySelectorAll("button")));
      const btnLogin = btns.some(b => {
        const t = (b.innerText||b.value||"").toLowerCase();
        return /login|sign in|signin|masuk|log in/.test(t);
      });
      // fallback: find labels inside form that include login keywords
      const labelsText = Array.from(f.querySelectorAll("label")).map(l=>l.innerText||"").join(" ").toLowerCase();
      const labelLogin = /login|sign in|signin|masuk|log in/.test(labelsText);

      const score = (hasPwd?2:0) + (btnLogin?1:0) + (labelLogin?1:0);
      if (score > 0) {
        results.push({
          formIndex: idx,
          action,
          inputs: inputs.map(i => ({name:i.name||i.id||'(noname)', type:i.type||i.tagName, placeholder:i.placeholder||""})),
          hasPassword: hasPwd,
          score
        });
      }
    });
    // sort by score desc
    results.sort((a,b)=>b.score-a.score);
    return results;
  }

  function renderResults(list){
    const container = document.getElementById("cdi_lf_results");
    if (!list || list.length===0) {
      container.innerHTML = "<div style='color:#faa'>No login-like forms found.</div>";
      detected = [];
      return;
    }
    detected = list;
    const html = list.map((r,i) => {
      return `<div style="border:1px solid #222;padding:8px;border-radius:6px;margin-bottom:6px">
        <div><b>Form #${r.formIndex}</b> — action: ${escapeHtml(r.action)}</div>
        <div style="font-size:12px;color:#ccc">hasPassword:${r.hasPassword} — score:${r.score}</div>
        <div style="margin-top:6px;font-size:12px"><b>Inputs:</b><pre>${escapeHtml(JSON.stringify(r.inputs,null,2))}</pre></div>
        <div><button data-form="${r.formIndex}" class="cdi_lf_select_btn">Select</button>
             <button data-form="${r.formIndex}" class="cdi_lf_open_dom">Open DOM</button></div>
      </div>`;
    }).join("");
    container.innerHTML = html;
    // attach handlers
    Array.from(container.querySelectorAll(".cdi_lf_select_btn")).forEach(b=>{
      b.onclick = (e) => {
        const fi = Number(b.getAttribute("data-form"));
        // mark selection
        container.querySelectorAll(".cdi-selected").forEach(n=>n.classList.remove("cdi-selected"));
        b.parentElement.parentElement.classList.add("cdi-selected");
        panel.dataset.selectedForm = fi;
        outputSafely(`Selected form index ${fi}`);
      };
    });
    Array.from(container.querySelectorAll(".cdi_lf_open_dom")).forEach(b=>{
      b.onclick = ()=>{
        const fi = Number(b.getAttribute("data-form"));
        const formElem = document.forms[fi];
        if (!formElem) return alert("Form element not found in DOM (maybe dynamic).");
        // scroll to form and flash
        formElem.scrollIntoView({behavior:"smooth", block:"center"});
        formElem.style.transition = "box-shadow .2s ease";
        formElem.style.boxShadow = "0 0 0 4px rgba(255,200,0,0.6)";
        setTimeout(()=> formElem.style.boxShadow="", 2200);
      };
    });
  }

  function outputSafely(msg){
    const el = document.getElementById("cdi_lf_results");
    const p = document.createElement("div");
    p.style="font-size:12px;color:#9f9;margin-top:6px";
    p.textContent = msg;
    el.prepend(p);
  }

  document.getElementById("cdi_lf_scan").onclick = ()=>{
    const res = heuristicallyFindLoginForms();
    renderResults(res);
  };

  // highlight all detected (or all with password)
  document.getElementById("cdi_lf_highlight").onclick = ()=>{
    const list = detected.length? detected : heuristicallyFindLoginForms();
    if (!list.length) return alert("No login-like forms found to highlight.");
    list.forEach(r=>{
      const f = document.forms[r.formIndex];
      if (!f) return;
      f.style.outline = "3px solid rgba(60,160,220,0.9)";
      f.style.transition = "outline 0.2s ease";
      setTimeout(()=>{ try{ f.style.outline=""; }catch(e){} }, 5000);
    });
    outputSafely("Highlighted detected login-like forms briefly.");
  };

  // Fill selected form with safe markers (no submit)
  document.getElementById("cdi_lf_fill").onclick = ()=>{
    const sel = panel.dataset.selectedForm;
    if (typeof sel === "undefined") return alert("Pilih form dulu dari daftar (tombol Select).");
    const fi = Number(sel);
    const form = document.forms[fi];
    if (!form) return alert("Form tidak ditemukan di DOM.");

    const cat = document.getElementById("cdi_lf_cat").value;
    const markers = SAFE_MARKERS[cat] || SAFE_MARKERS.CUSTOM;
    const inputs = Array.from(form.elements || []).filter(i => {
      const tag = (i.tagName||"").toLowerCase();
      if (tag === "input") {
        const t = (i.type||"").toLowerCase();
        return ["text","email","tel","search","url","password","textarea",""].includes(t);
      }
      return tag === "textarea";
    });

    // fill: for password keep a safe placeholder and respect allowAutoSubmit = false
    inputs.forEach((inp, idx)=>{
      try {
        // do not overwrite file inputs, hidden with autocomplete tokens, or inputs explicitly marked data-cdi-protected
        if (inp.type === "file") return;
        if (inp.dataset && inp.dataset.cdiProtected === "1") return;
        const payload = markers[idx % markers.length] || ("MARKER_"+idx);
        // for password fields, use a neutral string
        if (inp.type && inp.type.toLowerCase() === "password") {
          inp.value = "PASSWORD_MARKER";
        } else {
          inp.value = payload;
        }
      } catch(e){}
    });

    outputSafely(`Filled form #${fi} with safe markers (category: ${cat}). No submit executed.`);
    // show a short README/warning
    setTimeout(()=>alert("Form fields telah diisi dengan marker aman. TIDAK otomatis disubmit. Periksa nilai di form dan submit manual jika Anda punya izin."), 50);
  };

  // small helper to expose SAFE_MARKERS for debugging in console
  window.CDI_SAFE_LOGIN_FINDER = {
    SAFE_MARKERS,
    heuristicallyFindLoginForms,
    renderResults
  };

  // end
  console.log("CDI Login Finder (SAFE) siap. Scan untuk menemukan form login, gunakan Select lalu Fill. Tidak ada submit otomatis.");
})();
