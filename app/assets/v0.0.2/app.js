window.__FAOXIMA_APP_STARTED__ = true;

import * as Telegram from './telegram.js';
import { verify } from './api.js';
import { start as startRouter } from './router.js';
import { getToken, clearToken } from './state.js';
import { loadSavedTheme } from './pages/settings.js';
import { loadBrandFromServer } from './brand.js';
import { icon } from './icons.js';

window.__FAOXIMA_MODULES_OK__ = true;


try { loadSavedTheme(); } catch (_) {  }

const M = (typeof window !== 'undefined' && window.__FAOXIMA__) || null;

function safeDiagnostics() {
    try {
        if (Telegram && typeof Telegram.diagnostics === 'function') {
            return Telegram.diagnostics();
        }
    } catch (_) {  }
    if (M && typeof M.diag === 'function') {
        try { return M.diag(); } catch (_) {}
    }
    try {
        const w = (window.Telegram && window.Telegram.WebApp) || null;
        return {
            hasTelegram: !!window.Telegram,
            hasWebApp:   !!w,
            platform:    w ? w.platform : null,
            initDataLen: w && w.initData ? w.initData.length : 0,
            href:        location.href,
            note:        'fallback diagnostics',
        };
    } catch (e) {
        return { error: String((e && e.message) || e) };
    }
}

function logErr(msg, where, stack, extra) {
    try { console.error('[' + where + ']', msg, stack); } catch (_) {}
    if (M && M.postLog) {
        try { M.postLog('error', String(msg), String(where || ''), String(stack || ''), extra || null); } catch (_) {}
    }
}

window.addEventListener('error', (e) => {
    logErr((e.error && e.error.message) || e.message || 'Script error',
           (e.filename || '?') + ':' + (e.lineno || '?'),
           (e.error && e.error.stack) || '');
});
window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    logErr((r && r.message) || String(r || 'Unhandled rejection'),
           'unhandledrejection',
           (r && r.stack) || '');
});

function showInitialSkeleton() {
    const view = document.getElementById('view');
    if (!view) return;
    view.innerHTML = `
        <article class="card card-window">
            <header class="card-window-bar">
                <span class="dots"><span></span><span></span><span></span></span>
                <span class="window-url">faoxima/loading</span>
            </header>
            <div class="card-body">
                <div class="skeleton skeleton-row"></div>
                <div class="skeleton skeleton-row"></div>
                <div class="skeleton skeleton-row"></div>
                <p class="muted center mono mt-md" style="font-size:11px">در حال آماده‌سازی…</p>
            </div>
        </article>
    `;
}

function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = String(s == null ? '' : s);
    return d.innerHTML;
}

function showAccessError(err) {
    try {
        const view = document.getElementById('view');
        if (!view) return;

        const diag = safeDiagnostics();
        const code = err && err.code;
        const status = err && err.status;
        const data = err && err.data;

        let title = 'دسترسی برقرار نشد';
        let body  = (err && err.message) ? err.message : 'لطفا از داخل تلگرام باز کنید.';
        let hint  = '';

        if (code === 'NETWORK') {
            title = 'خطای شبکه';
            body  = 'اتصال به سرور برقرار نشد. لطفا اینترنت خود را بررسی کنید.';
        } else if (code === 'NO_SDK') {
            title = 'SDK تلگرام بارگذاری نشد';
            body  = 'فایل telegram-web-app.js نه از سرور و نه از CDN قابل دانلود نبود.';
            hint  = 'مدیر سرور باید فایل <code>app/js/telegram-web-app.js</code> را روی هاست بازیابی کند.';
        } else if (code === 'NO_INIT_DATA') {
            if (!diag.hasWebApp) {
                title = 'این صفحه را داخل تلگرام باز کنید';
                body  = 'این مینی‌اپ تنها از طریق ربات تلگرام قابل استفاده است.';
            } else if (diag.hasUnsafeUser && !diag.hasInitData) {
                title = 'پیکربندی ربات نیاز به اصلاح دارد';
                body  = 'مینی‌اپ از طریق دکمه‌ی نادرستی باز شده و امضای امنیتی همراه ندارد.';
                hint  = 'دکمه‌ی Mini App باید از نوع <code>web_app</code> باشد، نه <code>url</code>.';
            }
        } else if (status === 401 || status === 403) {
            title = 'احراز هویت ناموفق';
            body  = (err && err.message) || 'سرور توکن را نپذیرفت. لطفاً مینی‌اپ را ببندید و دوباره از داخل ربات باز کنید.';
        } else if (status === 404) {
            title = 'سرور پیدا نشد';
            body  = 'آدرس API در دسترس نیست. مدیر سرور باید مسیر api/ را بررسی کند.';
            hint  = 'بررسی کنید که پوشه‌ی <code>api/</code> در کنار <code>app/</code> روی سرور موجود باشد و فایل <code>verify.php</code> در دسترس باشد.';
        } else if (status >= 500) {
            title = 'خطای سرور';
            body  = (err && err.message) || ('سرور با کد ' + status + ' پاسخ داد.');
        }

        logErr(title + ' — ' + body, 'access-error', err && err.stack || '', { code, status, data });

        view.innerHTML = `
            <div class="empty">
                ${icon('alert', 'class="ico ico-xxl ico-warn"')}
                <h3>${escapeHtml(title)}</h3>
                <p class="muted">${escapeHtml(body)}</p>
                ${hint ? `<p class="muted mono mt-sm" style="font-size:11px;line-height:1.7">${hint}</p>` : ''}
                <button class="btn btn-primary mt-md" id="retry-btn">تلاش مجدد</button>
                <details class="mt-md" style="text-align:start">
                    <summary class="muted mono" style="font-size:11px;cursor:pointer">جزئیات تشخیصی</summary>
                    <pre class="codeblock" style="margin-top:8px;direction:ltr;text-align:start;font-size:11px">${escapeHtml(JSON.stringify({ code, status, server: data, diag }, null, 2))}</pre>
                </details>
            </div>
        `;

        const retry = document.getElementById('retry-btn');
        if (retry) retry.addEventListener('click', () => {
            // Telegram's in-app WebView (tdesktop especially) serves index.php
            // and assets from disk cache on a plain location.reload(), so a
            // failed verification stays "stuck" on the screen even after the
            // server is fixed. __hardReload (in app/index.php) drops caches,
            // service workers, and bumps a `_r=...` query param to force a
            // fresh fetch of every resource.
            if (typeof window.__hardReload === 'function') {
                window.__hardReload();
                return;
            }
            try { sessionStorage.clear(); } catch (_) {}
            try {
                const u = new URL(location.href);
                u.searchParams.set('_r', Date.now().toString(36));
                location.replace(u.toString());
            } catch (_) {
                location.reload();
            }
        });
    } catch (renderErr) {
        logErr('Error UI itself crashed: ' + (renderErr.message || renderErr),
               'showAccessError-internal',
               renderErr.stack || '');
    }
}

function applyStartParam() {
    try {
        const w = (window.Telegram && window.Telegram.WebApp) || null;
        const sp = w && w.initDataUnsafe && w.initDataUnsafe.start_param
            ? String(w.initDataUnsafe.start_param)
            : '';
        if (!sp) return;

        if (sp.startsWith('plisiopaid_') || sp.startsWith('plisiofail_')) {
            const order = sp.replace(/^plisio(paid|fail)_/, '');
            if (order) {
                const want = '#/watch/' + encodeURIComponent(order);
                if (window.location.hash !== want) {
                    window.location.hash = want;
                }
            }
        }
    } catch (_) {  }
}

async function bootstrap() {
    showInitialSkeleton();

    try {
        await Telegram.waitForSDK(4000);
        Telegram.ready();
    } catch (err) {
        logErr(err.message || 'SDK wait failed', 'bootstrap-sdk', err.stack || '');
        showAccessError(err);
        return;
    }

    applyStartParam();

    if (getToken()) {
        try {
            startRouter();
            return;
        } catch (err) {
            logErr(err.message || 'cached-token boot failed', 'bootstrap-cached', err.stack || '');
            clearToken();
        }
    }

    try {
        await verify();
    } catch (err) {
        logErr((err && err.message) || 'verify failed', 'bootstrap-verify', (err && err.stack) || '', {
            code: err && err.code, status: err && err.status, data: err && err.data,
        });
        showAccessError(err);
        return;
    }

    try {
        startRouter();
    } catch (err) {
        logErr(err.message || 'router start failed', 'bootstrap-start', err.stack || '');
        showAccessError(err);
    }


    loadBrandFromServer().catch(() => {});
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        bootstrap().catch((err) => {
            logErr((err && err.message) || String(err), 'bootstrap-unhandled', (err && err.stack) || '');
            showAccessError(err);
        });
    }, { once: true });
} else {
    bootstrap().catch((err) => {
        logErr((err && err.message) || String(err), 'bootstrap-unhandled', (err && err.stack) || '');
        showAccessError(err);
    });
}

(function(){
  function clearPanel(){
    var h=document.getElementById('action-panel-host');
    if(!h||!h.querySelector('.ico-success'))return;
    h.innerHTML='';
    var a=document.querySelectorAll('.action-tile.is-active');
    for(var i=0;i<a.length;i++)a[i].classList.remove('is-active');
  }
  document.addEventListener('click',function(e){
    var h=document.getElementById('action-panel-host');
    if(h&&h.querySelector('.ico-success')&&e.target===h)clearPanel();
  });
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape')clearPanel();
  });
})();

(function(){
  var SEL='.btn,.action-tile,.list-item,.plan,.pay-card,.theme-tile,.chip,.icon-btn';
  document.addEventListener('pointerdown',function(e){
    var el=e.target;
    if(!el||!el.closest)return;
    var t=el.closest(SEL);
    if(!t)return;
    if(t.disabled||t.classList.contains('is-disabled')||t.classList.contains('is-locked'))return;
    var r=t.getBoundingClientRect();
    var d=Math.max(r.width,r.height);
    var s=document.createElement('span');
    s.className='fx-ripple';
    s.style.width=d+'px';
    s.style.height=d+'px';
    s.style.left=((e.clientX!=null?e.clientX:r.left+r.width/2)-r.left-d/2)+'px';
    s.style.top=((e.clientY!=null?e.clientY:r.top+r.height/2)-r.top-d/2)+'px';
    t.appendChild(s);
    s.addEventListener('animationend',function(){ if(s.parentNode)s.parentNode.removeChild(s); });
    try{ var tg=window.Telegram&&window.Telegram.WebApp; if(tg&&tg.HapticFeedback)tg.HapticFeedback.impactOccurred('light'); }catch(_){}
  },true);
})();

(function(){
  var INT='a,button,.btn,.action-tile,.list-item,.plan,.pay-card,.theme-tile,.chip,.icon-btn,.tab,.tab-cta,[role="button"]';
  document.addEventListener('contextmenu',function(e){
    var el=e.target;
    if(el && el.closest){
      if(el.closest('.selectable')) return;
      if(el.closest(INT)) e.preventDefault();
    }
  },false);
  function neutralize(a){
    if(a.getAttribute('data-fx-route')!=null)return;
    var href=a.getAttribute('href');
    if(href==null)return;
    if(href.charAt(0)!=='#'||href.length<2)return;
    a.setAttribute('data-fx-route',href);
    a.removeAttribute('href');
    if(a.getAttribute('role')==null)a.setAttribute('role','button');
    if(!a.hasAttribute('tabindex'))a.setAttribute('tabindex','0');
  }
  function scan(root){
    var list=(root||document).querySelectorAll('a[href^="#"]');
    for(var i=0;i<list.length;i++)neutralize(list[i]);
  }
  function go(a){ var h=a.getAttribute('data-fx-route'); if(h)location.hash=h; }
  document.addEventListener('click',function(e){
    var a=e.target.closest&&e.target.closest('a[data-fx-route]');
    if(a){ e.preventDefault(); e.stopPropagation(); go(a); }
  },true);
  document.addEventListener('keydown',function(e){
    if(e.key==='Enter'||e.key===' '){
      var a=e.target.closest&&e.target.closest('a[data-fx-route]');
      if(a){ e.preventDefault(); go(a); }
    }
  });
  function start(){
    scan(document);
    if(window.MutationObserver){
      var mo=new MutationObserver(function(m){
        for(var i=0;i<m.length;i++){
          var n=m[i].addedNodes;
          for(var j=0;j<n.length;j++){
            var node=n[j];
            if(node.nodeType!==1)continue;
            if(node.matches&&node.matches('a[href^="#"]'))neutralize(node);
            if(node.querySelectorAll)scan(node);
          }
        }
      });
      mo.observe(document.body||document.documentElement,{childList:true,subtree:true});
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);
  else start();
})();
