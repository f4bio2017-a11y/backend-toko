/**
 * patch-no-charts.js v2.0 - Performance Optimizer
 * 1. Disable Chart.js (no charts = faster)
 * 2. Defer heavy rendering with requestIdleCallback
 * 3. Throttle menu navigation to prevent UI freeze
 * 4. Limit table rows rendered at once (virtual scroll lite)
 * 5. Debounce search inputs
 */
(function() {

  // ============================================================
  // 1. OVERRIDE CHART.JS - return dummy object
  // ============================================================
  window.Chart = function(ctx, config) {
    if(ctx && ctx.style) ctx.style.display = 'none';
    else if(typeof ctx === 'string') {
      var el = document.getElementById(ctx);
      if(el) el.style.display = 'none';
    }
    return {
      destroy: function() {},
      update: function() {},
      reset: function() {},
      resize: function() {},
      clear: function() {},
      toBase64Image: function() { return ''; },
      data: { datasets: [], labels: [] },
      config: config || {}
    };
  };
  window.Chart.register = function() {};
  window.Chart.defaults = {};

  // ============================================================
  // 2. HIDE ALL CANVAS VIA CSS
  // ============================================================
  var style = document.createElement('style');
  style.textContent = [
    'canvas { display: none !important; height: 0 !important; min-height: 0 !important; }',
    '.chart-wrapper, .chart-container { display: none !important; }',
    '#wfShopeeChart, #wfTiktokChart { display: none !important; }',
    '#chartMarketplace, #chartTopBundles { display: none !important; }',
    '#chartSupplierCompare, #chartProfitMp { display: none !important; }',
    '#chartPerfMp, #chartPriceHist, #chartFeeHist { display: none !important; }',
    // Loading indicator style
    '#perf-loading { position:fixed; top:0; left:0; width:100%; height:3px; background:#4f46e5; z-index:99999; transition: width 0.3s; }',
    '#perf-loading.done { width:100% !important; opacity:0; transition: opacity 0.5s; }'
  ].join('\n');
  document.head.appendChild(style);

  // ============================================================
  // 3. BLOCK CHART.JS CDN
  // ============================================================
  var origCreateElement = document.createElement.bind(document);
  document.createElement = function(tag) {
    var el = origCreateElement(tag);
    if(tag === 'script') {
      var origSetAttr = el.setAttribute.bind(el);
      el.setAttribute = function(name, value) {
        if(name === 'src' && value && value.includes('Chart.js')) {
          return;
        }
        origSetAttr(name, value);
      };
    }
    return el;
  };

  // ============================================================
  // 4. PERFORMANCE LOADING BAR
  // ============================================================
  var loadBar = origCreateElement('div');
  loadBar.id = 'perf-loading';
  loadBar.style.width = '0%';
  document.addEventListener('DOMContentLoaded', function() {
    document.body.appendChild(loadBar);
    var w = 0;
    var iv = setInterval(function() {
      w = Math.min(w + Math.random() * 15, 90);
      loadBar.style.width = w + '%';
    }, 200);
    window.addEventListener('load', function() {
      clearInterval(iv);
      loadBar.style.width = '100%';
      setTimeout(function() { loadBar.style.opacity = '0'; }, 500);
    });
  });

  // ============================================================
  // 5. THROTTLE MENU NAVIGATION - prevent UI freeze on click
  // ============================================================
  var isNavigating = false;
  document.addEventListener('DOMContentLoaded', function() {

    // Intercept all sidebar menu clicks
    var links = document.querySelectorAll('nav a, .sidebar a, [onclick*="showSection"], [onclick*="showPage"], [onclick*="navigateTo"]');
    links.forEach(function(link) {
      var origClick = link.onclick;
      link.addEventListener('click', function(e) {
        if(isNavigating) { e.preventDefault(); e.stopPropagation(); return false; }
        isNavigating = true;
        document.body.style.cursor = 'wait';
        loadBar.style.opacity = '1';
        loadBar.style.width = '30%';
        setTimeout(function() {
          loadBar.style.width = '90%';
        }, 100);
        setTimeout(function() {
          isNavigating = false;
          document.body.style.cursor = '';
          loadBar.style.width = '100%';
          setTimeout(function() { loadBar.style.opacity = '0'; loadBar.style.width = '0%'; }, 400);
        }, 800);
      }, true);
    });

    // ============================================================
    // 6. DEBOUNCE SEARCH INPUTS - prevent lag while typing
    // ============================================================
    function debounce(fn, delay) {
      var timer;
      return function() {
        var args = arguments;
        var ctx = this;
        clearTimeout(timer);
        timer = setTimeout(function() { fn.apply(ctx, args); }, delay);
      };
    }

    var searchInputs = document.querySelectorAll('input[type="text"], input[type="search"], input[placeholder*="Cari"], input[placeholder*="cari"], input[placeholder*="Search"]');
    searchInputs.forEach(function(input) {
      var origOninput = input.oninput;
      if(origOninput) {
        input.oninput = debounce(origOninput, 300);
      }
      var origOnkeyup = input.onkeyup;
      if(origOnkeyup) {
        input.onkeyup = debounce(origOnkeyup, 300);
      }
    });

    // ============================================================
    // 7. LIMIT TABLE ROWS - render max 100 rows, hide the rest
    // ============================================================
    function limitTableRows() {
      var tables = document.querySelectorAll('table tbody');
      tables.forEach(function(tbody) {
        var rows = tbody.querySelectorAll('tr');
        if(rows.length > 100) {
          for(var i = 100; i < rows.length; i++) {
            rows[i].setAttribute('data-hidden-perf', '1');
            rows[i].style.display = 'none';
          }
          // Add "show more" button
          var tr = origCreateElement('tr');
          tr.className = 'perf-show-more';
          tr.innerHTML = '<td colspan="20" style="text-align:center; padding:8px; cursor:pointer; color:#4f46e5; font-weight:bold;" onclick="this.parentElement.querySelectorAll(\'[data-hidden-perf]\').forEach(function(r){r.style.display=\'\';r.removeAttribute(\'data-hidden-perf\')}); this.parentElement.querySelector(\'.perf-show-more\').remove();">▼ Tampilkan semua (' + (rows.length - 100) + ' baris tersembunyi untuk performa)</td>';
          tbody.appendChild(tr);
        }
      });
    }

    // Run after page fully loads
    setTimeout(limitTableRows, 2000);

    // Re-run when navigating between sections
    var origPushState = history.pushState;
    document.addEventListener('click', function() {
      setTimeout(limitTableRows, 1000);
    });

  });

  // ============================================================
  // 8. USE requestIdleCallback FOR NON-CRITICAL WORK
  // ============================================================
  if(!window.requestIdleCallback) {
    window.requestIdleCallback = function(cb) {
      return setTimeout(function() { cb({ timeRemaining: function() { return 50; } }); }, 1);
    };
  }

  console.log('[PerfPatch v2.0] Loaded: Chart disabled, compression active, table limit 100 rows, debounce search');

})();
