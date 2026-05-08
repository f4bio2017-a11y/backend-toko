/**
 * patch-no-charts.js
 * Disables all Chart.js charts for performance.
 * Injected via <script> tag added to inventaris-bundling.html
 */
(function() {
  // 1. Override Chart constructor - returns dummy object
  window.Chart = function(ctx, config) {
    // Hide the canvas element
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

  // 2. Hide all canvas elements via CSS injection
  var style = document.createElement('style');
  style.textContent = [
    'canvas { display: none !important; height: 0 !important; min-height: 0 !important; }',
    '.chart-wrapper, .chart-container { display: none !important; }',
    '#wfShopeeChart, #wfTiktokChart { display: none !important; }',
    '#chartMarketplace, #chartTopBundles { display: none !important; }',
    '#chartSupplierCompare, #chartProfitMp { display: none !important; }',
    '#chartPerfMp, #chartPriceHist, #chartFeeHist { display: none !important; }'
  ].join('\n');
  document.head.appendChild(style);

  // 3. Prevent Chart.js CDN from loading if not yet loaded
  var origCreateElement = document.createElement.bind(document);
  document.createElement = function(tag) {
    var el = origCreateElement(tag);
    if(tag === 'script') {
      var origSetAttr = el.setAttribute.bind(el);
      el.setAttribute = function(name, value) {
        if(name === 'src' && value && value.includes('Chart.js')) {
          return; // Block Chart.js loading
        }
        origSetAttr(name, value);
      };
    }
    return el;
  };

  console.log('[patch-no-charts] Charts disabled for performance.');
})();
