(function() {
    console.log("%c[Anti-Refresh] Aktif", "color:#0f0; font-size:14px;");

    // ==== 1. Blok location.reload() ====
    const oldReload = location.reload;
    location.reload = function() {
        console.log("[Anti-Refresh] Blocked location.reload()");
    };

    // ==== 2. Blok window.location / URL assign ====
    Object.defineProperty(window, "location", {
        configurable: false,
        enumerable: true,
        get() { return window.__real_location || window.location; },
        set(v) {
            console.log("[Anti-Refresh] Blocked redirect to:", v);
        }
    });

    // ==== 3. Blok window.location.assign() dan replace() ====
    const loc = window.__proto__.location.__proto__;
    loc.assign = function(url) {
        console.log("[Anti-Refresh] Blocked assign:", url);
    };
    loc.replace = function(url) {
        console.log("[Anti-Refresh] Blocked replace:", url);
    };

    // ==== 4. Blok meta refresh ====
    const metas = document.querySelectorAll("meta[http-equiv='refresh']");
    metas.forEach(m => {
        console.log("[Anti-Refresh] Removed meta refresh:", m.content);
        m.remove();
    });

    // ==== 5. Blok setTimeout / setInterval yang mencoba reload ====
    const originalSetTimeout = window.setTimeout;
    const originalSetInterval = window.setInterval;

    window.setTimeout = function(fn, t) {
        const stringified = fn.toString();
        if (/location\.reload|location\.href|window\.location/.test(stringified)) {
            console.log("[Anti-Refresh] Blocked timed reload:", stringified);
            return;
        }
        return originalSetTimeout(fn, t);
    };

    window.setInterval = function(fn, t) {
        const stringified = fn.toString();
        if (/location\.reload|location\.href|window\.location/.test(stringified)) {
            console.log("[Anti-Refresh] Blocked interval reload:", stringified);
            return;
        }
        return originalSetInterval(fn, t);
    };

    // ==== 6. Blok unload / beforeunload listener ====
    window.addEventListener = new Proxy(window.addEventListener, {
        apply(target, thisArg, args) {
            if (args[0] === "beforeunload" || args[0] === "unload") {
                console.log("[Anti-Refresh] Blocked unload handler");
                return;
            }
            return Reflect.apply(target, thisArg, args);
        }
    });

    // ==== 7. Blok history pushState auto-redirect ====
    const oldPushState = history.pushState;
    const oldReplaceState = history.replaceState;
    history.pushState = function() {
        console.log("[Anti-Refresh] Blocked pushState redirect");
    };
    history.replaceState = function() {
        console.log("[Anti-Refresh] Blocked replaceState redirect");
    };

})();
