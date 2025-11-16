(function(){
  if (window.__ANTI_REFRESH_ACTIVE__) {
    console.warn("Anti Refresh sudah aktif.");
    return;
  }
  window.__ANTI_REFRESH_ACTIVE__ = true;

  console.log("%c[Anti-Refresh] Aktif — halaman tidak bisa refresh otomatis.", 
              "color:#0f0;background:#111;padding:4px;");

  // ===========================
  // 1) BLOCK location.reload()
  // ===========================
  const originalReload = window.location.reload;
  window.location.reload = function() {
    console.warn("[BLOCKED] location.reload() dicegah.");
  };

  // ===========================
  // 2) BLOCK window.location = ...
  // ===========================
  const originalAssign = window.location.assign;
  const originalReplace = window.location.replace;
  window.location.assign = function(url){
    console.warn("[BLOCKED] Redirect assign:", url);
  };
  window.location.replace = function(url){
    console.warn("[BLOCKED] Redirect replace:", url);
  };

  Object.defineProperty(window, "location", {
    configurable: false,
    writable: false,
    value: window.location
  });

  // ===================================
  // 3) BLOCK META REFRESH (tag <meta>)
  // ===================================
  const blockMetaRefresh = () => {
    document.querySelectorAll("meta[http-equiv='refresh']").forEach(m => {
      console.warn("[BLOCKED] Meta refresh dihapus:", m.outerHTML);
      m.remove();
    });
  };
  blockMetaRefresh();
  new MutationObserver(blockMetaRefresh).observe(document.documentElement, { childList: true, subtree: true });

  // ===================================
  // 4) BLOCK beforeunload / unload
  // ===================================
  window.addEventListener("beforeunload", e => {
    console.warn("[BLOCKED] beforeunload dicegah.");
    e.stopImmediatePropagation();
  }, true);

  window.addEventListener("unload", e => {
    console.warn("[BLOCKED] unload dicegah.");
    e.stopImmediatePropagation();
  }, true);

  // ===================================
  // 5) FETCH LOGGER (Permanent)
  // ===================================
  const originalFetch = window.fetch;
  window.fetch = async function(resource, init){
    const method = init?.method || "GET";
    const url = typeof resource === "string" ? resource : resource.url;
    const body = init?.body ? init.body.slice(0,200) : "(none)";

    console.log("%c[FETCH]", "color:#6cf",
      "\nURL:", url,
      "\nMethod:", method,
      "\nBody:", body
    );

    return originalFetch.apply(this, arguments);
  };

  // ===================================
  // 6) XHR LOGGER (Permanent)
  // ===================================
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url){
    this.__m_method = method;
    this.__m_url = url;
    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function(body){
    const sample = typeof body === "string" ? body.slice(0,200) : "(none)";
    console.log("%c[XHR]", "color:#fc6",
      "\nURL:", this.__m_url,
      "\nMethod:", this.__m_method,
      "\nBody:", sample
    );
    return originalSend.apply(this, arguments);
  };

  console.log("%c[STATUS] Anti Refresh + Interceptor aktif.", 
              "color:#0f0;background:#222;padding:4px;");

})();
