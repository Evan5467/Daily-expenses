/* Waits for the data store to load, applies theme + lock state, then starts the app. */
(function(){
  var de = document.documentElement;
  function start(){
    try{ if(JSON.parse(LS.getItem('ledger_lock_v1')||'{}').enabled) de.classList.add('locked'); }catch(e){}
    try{ window.LedgerThemes.apply(LS.getItem('ledger_theme')||'classic'); }catch(e){}
    var s = document.createElement('script');
    s.textContent = document.getElementById('appsrc').textContent + '\n//# sourceURL=ledger-app.js';
    document.body.appendChild(s);
  }
  window.LedgerStore.ready.then(start, start).then(function(){ de.classList.add('ready'); de.classList.remove('booting'); });
  setTimeout(function(){ de.classList.add('ready'); de.classList.remove('booting'); }, 5000);
  if('serviceWorker' in navigator && location.protocol.indexOf('http') === 0 && !(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())){
    window.addEventListener('load', function(){ navigator.serviceWorker.register('sw.js').catch(function(){}); });
  }
})();
