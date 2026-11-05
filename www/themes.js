/* Theme list + applier. Loaded in <head>; the choice itself is saved by the app in its data store. */
window.LedgerThemes = (function(){
  var LIST = [
    {id:'classic', name:'Classic Paper', desc:'The original ledger', bg:'#1B2430', sw:['#F3EAD9','#33553B','#B9863C'], meta:'#1B2430'},
    {id:'midnight', name:'Midnight Gold', desc:'Black and burnished gold', bg:'#08080B', sw:['#17171E','#D9B672','#F3ECDD'], meta:'#08080B'},
    {id:'emerald', name:'Emerald Luxe', desc:'Deep green, champagne', bg:'#03201A', sw:['#0C3429','#E6D09A','#F3EDD8'], meta:'#03201A'},
    {id:'sapphire', name:'Royal Sapphire', desc:'Navy with platinum', bg:'#060D24', sw:['#111C42','#B5C8F6','#EEF2FF'], meta:'#060D24'},
    {id:'rose', name:'Rose Noir', desc:'Dark wine, rose gold', bg:'#130609', sw:['#271019','#EDB9A4','#FAEBE4'], meta:'#130609'},
    {id:'ivory', name:'Ivory & Gold', desc:'Light, marble and gold', bg:'#ECE5D6', sw:['#FFFEFA','#A57A28','#1F1B14'], meta:'#ECE5D6'}
  ];
  function get(id){ for(var i=0;i<LIST.length;i++) if(LIST[i].id===id) return LIST[i]; return LIST[0]; }
  function apply(id){
    var t = get(id), de = document.documentElement;
    if(t.id==='classic') de.removeAttribute('data-theme'); else de.setAttribute('data-theme', t.id);
    var m = document.querySelector('meta[name="theme-color"]'); if(m) m.setAttribute('content', t.meta);
    return t.id;
  }
  return { list: LIST, get: get, apply: apply };
})();
