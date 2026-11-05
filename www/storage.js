/* Ledger storage layer.
 *
 * The app keeps its data in memory and writes every change straight through to one of:
 *   1. "file"      - a real file on the device (ledger-data.json) when running as the installed Android/iOS app
 *   2. "indexeddb" - the browser's database, marked persistent, when running as a website / home-screen app
 *   3. "browser"   - plain localStorage, only as a last resort if the above are unavailable
 *
 * Nothing else in the app touches localStorage: it uses the `LS` object defined here.
 */
(function(){
  'use strict';
  var FILE_DIR = 'Ledger', FILE_NAME = 'ledger-data.json', FILE_BAK = 'ledger-data.bak.json';
  var DB_NAME = 'ledger-db', STORE = 'kv', REC = 'data';
  var cache = Object.create(null);
  var backend = 'memory', persistent = null, lastError = '', lastSaved = 0, fileDir = null;
  var timer = null, chain = Promise.resolve(), lastSnapshot = null;

  var cap = window.Capacitor;
  var native = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
  var FS = native && cap.Plugins ? cap.Plugins.Filesystem : null;

  /* ---------- IndexedDB ---------- */
  function openDB(){
    return new Promise(function(res, rej){
      if(!window.indexedDB) return rej(new Error('no indexedDB'));
      var r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = function(){ r.result.createObjectStore(STORE); };
      r.onsuccess = function(){ res(r.result); };
      r.onerror = function(){ rej(r.error || new Error('indexedDB open failed')); };
      r.onblocked = function(){ rej(new Error('indexedDB blocked')); };
    });
  }
  function idbRead(db){
    return new Promise(function(res, rej){
      var q = db.transaction(STORE, 'readonly').objectStore(STORE).get(REC);
      q.onsuccess = function(){ res(q.result || null); };
      q.onerror = function(){ rej(q.error); };
    });
  }
  function idbWrite(db, obj){
    return new Promise(function(res, rej){
      var tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(obj, REC);
      tx.oncomplete = function(){ res(); };
      tx.onerror = tx.onabort = function(){ rej(tx.error || new Error('indexedDB write failed')); };
    });
  }
  var db = null;

  /* ---------- device file (Capacitor) ---------- */
  function pickDirs(){
    var plat = cap.getPlatform ? cap.getPlatform() : 'android';
    // Android: the app's own folder in shared storage (survives app updates, visible to file managers).
    // iOS: the app's Documents folder (visible in the Files app).
    return plat === 'ios' ? ['DOCUMENTS', 'DATA'] : ['EXTERNAL', 'DATA'];
  }
  async function fileRead(name){
    var dirs = fileDir ? [fileDir] : pickDirs();
    for(var i = 0; i < dirs.length; i++){
      try{
        var r = await FS.readFile({ path: FILE_DIR + '/' + name, directory: dirs[i], encoding: 'utf8' });
        if(r && typeof r.data === 'string') return { text: r.data, dir: dirs[i] };
      }catch(e){ /* not there yet */ }
    }
    return null;
  }
  async function fileWrite(name, text){
    var dirs = fileDir ? [fileDir] : pickDirs(), err;
    for(var i = 0; i < dirs.length; i++){
      try{
        await FS.writeFile({ path: FILE_DIR + '/' + name, data: text, directory: dirs[i], encoding: 'utf8', recursive: true });
        fileDir = dirs[i]; return;
      }catch(e){ err = e; }
    }
    throw err || new Error('file write failed');
  }

  /* ---------- init ---------- */
  function parse(text){
    try{ var o = JSON.parse(text); return (o && typeof o === 'object' && !Array.isArray(o)) ? o : null; }catch(e){ return null; }
  }
  function absorb(obj){ if(!obj) return; Object.keys(obj).forEach(function(k){ cache[k] = String(obj[k]); }); }

  async function init(){
    if(native && FS){
      try{
        var main = await fileRead(FILE_NAME), data = main && parse(main.text);
        if(main) fileDir = main.dir;
        if(!data){ var bak = await fileRead(FILE_BAK); data = bak && parse(bak.text); if(bak && !fileDir) fileDir = bak.dir; if(data) lastError = 'Restored from the backup copy.'; }
        absorb(data);
        backend = 'file';
        if(!main && !data){
          // first run in the app: bring in anything the in-app webview already had
          migrateFromLocalStorage();
          await flushNow(true);
        }
        persistent = true;
        return;
      }catch(e){ lastError = String(e && e.message || e); }
    }
    try{
      db = await openDB();
      var stored = await idbRead(db);
      if(stored) absorb(stored);
      backend = 'indexeddb';
      var moved = migrateFromLocalStorage();
      if(moved) { await idbWrite(db, snapshotObj()); verifyThenClearLocal(); }
      if(navigator.storage && navigator.storage.persist){
        try{ persistent = (await navigator.storage.persisted()) || (await navigator.storage.persist()); }catch(e){ persistent = null; }
      }
      return;
    }catch(e){ lastError = String(e && e.message || e); }
    // last resort
    backend = 'browser';
    try{ for(var i = 0; i < localStorage.length; i++){ var k = localStorage.key(i); if(k.indexOf('ledger_') === 0) cache[k] = localStorage.getItem(k); } }catch(e){}
  }

  /* data written by older versions of the app lived in localStorage: move it, don't lose it */
  var legacyKeys = [];
  function migrateFromLocalStorage(){
    var n = 0;
    try{
      for(var i = 0; i < localStorage.length; i++){
        var k = localStorage.key(i);
        if(k && k.indexOf('ledger_') === 0){ legacyKeys.push(k); if(!(k in cache)){ cache[k] = localStorage.getItem(k); n++; } }
      }
    }catch(e){}
    return n;
  }
  async function verifyThenClearLocal(){
    try{
      var back = await idbRead(db);
      var ok = back && legacyKeys.every(function(k){ return back[k] === cache[k] || (k in back); });
      if(ok) legacyKeys.forEach(function(k){ try{ localStorage.removeItem(k); }catch(e){} });
    }catch(e){}
  }

  /* ---------- writing ---------- */
  function snapshotObj(){ var o = {}; Object.keys(cache).forEach(function(k){ o[k] = cache[k]; }); return o; }
  function schedule(){
    clearTimeout(timer);
    timer = setTimeout(function(){ flushNow(false); }, 120);
  }
  function flushNow(force){
    clearTimeout(timer); timer = null;
    var obj = snapshotObj(), text = JSON.stringify(obj);
    chain = chain.then(async function(){
      try{
        if(backend === 'file'){
          if(lastSnapshot && lastSnapshot !== text) await fileWrite(FILE_BAK, lastSnapshot).catch(function(){});
          await fileWrite(FILE_NAME, text); lastSnapshot = text;
        } else if(backend === 'indexeddb'){
          await idbWrite(db, obj);
        } else if(backend === 'browser'){
          Object.keys(obj).forEach(function(k){ localStorage.setItem(k, obj[k]); });
        }
        lastSaved = Date.now(); lastError = '';
      }catch(e){ lastError = String(e && e.message || e); }
    });
    return chain;
  }
  window.addEventListener('pagehide', function(){ if(timer) flushNow(true); });
  document.addEventListener('visibilitychange', function(){ if(document.visibilityState === 'hidden' && timer) flushNow(true); });

  /* ---------- the localStorage-shaped interface the app uses ---------- */
  var LS = {
    getItem: function(k){ return (k in cache) ? cache[k] : null; },
    setItem: function(k, v){ cache[k] = String(v); schedule(); },
    removeItem: function(k){ if(k in cache){ delete cache[k]; schedule(); } },
    keys: function(){ return Object.keys(cache); }
  };
  window.LS = LS;
  window.LedgerStore = {
    ready: init(),
    flush: function(){ return flushNow(true); },
    info: function(){
      return { backend: backend, persistent: persistent, native: native, lastError: lastError, lastSaved: lastSaved,
               where: backend === 'file' ? ('Ledger/' + FILE_NAME + (fileDir === 'EXTERNAL' ? ' in the app\'s folder on your phone storage' : fileDir === 'DOCUMENTS' ? ' in the app\'s Documents folder' : ' in the app\'s private storage')) : '' };
    }
  };
})();

/* Saving files (exports, backups) inside the installed app: WebViews can't do <a download>, so write to cache and open the share sheet. */
window.LedgerNative = (function(){
  var cap = window.Capacitor;
  var native = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
  function plug(n){ return native && cap.Plugins ? cap.Plugins[n] : null; }
  return {
    available: function(){ return !!(plug('Filesystem') && plug('Share')); },
    saveFile: function(blob, name){
      return new Promise(function(res, rej){
        var r = new FileReader();
        r.onerror = function(){ rej(r.error); };
        r.onload = async function(){
          try{
            var b64 = String(r.result).split(',')[1] || '';
            await plug('Filesystem').writeFile({ path: name, data: b64, directory: 'CACHE' });
            var u = await plug('Filesystem').getUri({ path: name, directory: 'CACHE' });
            await plug('Share').share({ title: name, url: u.uri, dialogTitle: 'Save or send ' + name });
            res();
          }catch(e){ if(!(e && /cancel/i.test(String(e.message||e)))) rej(e); else res(); }
        };
        r.readAsDataURL(blob);
      });
    }
  };
})();
