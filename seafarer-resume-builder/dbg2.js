const fs=require("fs");const {JSDOM}=require("jsdom");
const ROOT="/workspace/seafarer-resume-builder";
const html=fs.readFileSync(ROOT+"/index.html","utf8");
const appJs=fs.readFileSync(ROOT+"/app.js","utf8");
function makeDom(){
  const dom=new JSDOM(html,{runScripts:"outside-only",url:"http://localhost/"});
  const w=dom.window;
  w.eval(appJs.replace('"use strict";',"")+"\n;window.__app={computeProgress:()=>computeProgress(),setVesselName:(i,v)=>{data.vessels[i].vesselName=v;rerenderLists();},setSimple:(p,val)=>{setByPath(data,p,val);updateProgress();},vesselKeysCount:()=>VESSEL_KEYS.length,getData:()=>data};");
  w.document.dispatchEvent(new w.Event("DOMContentLoaded",{bubbles:true}));
  return {w,d:w.document};
}
const {w,d}=makeDom();
const p0=w.__app.computeProgress();console.log("p0",JSON.stringify(p0));
w.__app.setSimple("header.fullName","Test");
w.__app.setSimple("header.rank","Chief Officer");
const p1=w.__app.computeProgress();console.log("p1",JSON.stringify(p1));
d.getElementById("addVesselBtn").click();
const p2=w.__app.computeProgress();console.log("p2",JSON.stringify(p2),"vessels:",JSON.stringify(w.__app.getData().vessels));
w.__app.setVesselName(0,"MV Test");
const p3=w.__app.computeProgress();console.log("p3",JSON.stringify(p3),"keys",w.__app.vesselKeysCount());
