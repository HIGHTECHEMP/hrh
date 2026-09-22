(() => {
    "use strict";
    const $=s=>document.querySelector(s);
    async function count(table, filters=[]){let q=hrSupabase.from(table).select("id",{count:"exact",head:true});for(const [c,o,v] of filters)q=o==="eq"?q.eq(c,v):q;const r=await q;return r.error?0:(r.count||0);}
    async function init(){if(!window.hrSupabase)return;try{$("#students").textContent=await count("profiles",[["role","eq","student"]]);$("#pending-results").textContent=await count("results",[["status","eq","submitted"]]);$("#applications").textContent=await count("applications",[["status","eq","submitted"]]);}catch(e){console.error(e);}}
    if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();