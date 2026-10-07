/* Isolated cloud controls. Existing payroll calculations, printing and styles remain in their original files. */
(function() {
  "use strict";
  const APP = "AL JEFOON TENTS - Payroll";
  const KEY = "alJefoonPayrollV1";
  const SETTINGS = "alJefoonPayrollCloudBackupURL";
  const SECRET = "alJefoonPayrollCloudBackupAccessKey";
  const SAFETY = "alJefoonPayrollPreRestoreBackupV1";
  const DEFAULT_URL = "";
  const styles=document.createElement("style");
  styles.textContent=`#payrollCloudBackupModal:not(.show){display:none} #payrollCloudBackupModal [hidden]{display:none!important}
  #payrollCloudBackupModal .customer-select-buttons{display:flex;flex-wrap:wrap;gap:8px}
  #payrollCloudBackupModal .customer-select-buttons button{padding:8px 12px;border:1px solid #ddd;border-radius:6px;background:#fff;color:#222}
  #payrollCloudBackupModal #cloudStatus{padding:10px;border-left:3px solid #fcc224;margin:0;overflow-wrap:anywhere}
  #payrollCloudBackupModal button:disabled{opacity:.6;cursor:wait}
  @media print{#payrollCloudBackupModal,#payrollCloudBackupBtn{display:none!important}}`;
  document.head.appendChild(styles);
  let busy = false;
  let preview = null;
  let previewLocal = null;
  let panel;
  function esc(s) {return String(s ?? "").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function validate(data) {
    if (!data || data.app !== APP || !data.state || typeof data.state !== "object" || Array.isArray(data.state)) throw new Error("This is not a valid Payroll backup.");
    const dataState=data.state;
    ["employees","transactions","leaves"].forEach(collection=>{
      if (!Array.isArray(dataState[collection])) throw new Error("Payroll backup is missing "+collection+".");
      const ids=new Set();
      dataState[collection].forEach(record=>{
        if (!record || typeof record!=="object" || Array.isArray(record) || typeof record.id!=="string" || !record.id || ids.has(record.id)) throw new Error("Invalid or duplicate ID in "+collection+".");
        ids.add(record.id);
        if(collection==="employees" && typeof record.name!=="string") throw new Error("Invalid employee name.");
        if(collection!=="employees" && typeof record.employeeId!=="string") throw new Error("Invalid employee reference.");
        if(collection==="transactions" && (typeof record.date!=="string" || typeof record.type!=="string")) throw new Error("Invalid transaction date or type.");
        if(collection==="leaves") ["startDate","endDate"].forEach(key=>{if(record[key]!==undefined && typeof record[key]!=="string") throw new Error("Invalid leave date.");});
        const amounts=collection==="employees"?["salary","food"]:collection==="transactions"?["amount"]:["days"];
        amounts.forEach(key=>{
          const value=record[key];
          if(value!==undefined && (value===null || (typeof value!=="number" && typeof value!=="string") || String(value).trim()==="" || !Number.isFinite(Number(value)))) throw new Error("Invalid payroll number: "+key+".");
        });
      });
    });
    return data;
  }
  function snapshot() {
    return validate({app:APP,version:"1.0",storageKey:KEY,backupDate:new Date().toISOString(),state:JSON.parse(JSON.stringify(state))});
  }
  function status(message) {panel.querySelector("#cloudStatus").textContent=message;}
  function settings() {
    const url=panel.querySelector("#cloudURL").value.trim();
    const accessKey=panel.querySelector("#cloudKey").value.trim();
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/.test(url)) throw new Error("Enter the Google Apps Script web app URL ending in /exec.");
    if (accessKey.length<24) throw new Error("Enter your backup access key (at least 24 characters).");
    localStorage.setItem(SETTINGS,url);
    sessionStorage.setItem(SECRET,accessKey);
    return {url,accessKey};
  }
  function request(action, extra) {
    const config=settings();
    const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);
    const requestId=Array.from(bytes,x=>x.toString(16).padStart(2,"0")).join("");
    return new Promise((resolve,reject)=>{
      const frame=document.createElement("iframe");
      frame.name="cloud_"+requestId;frame.hidden=true;frame.setAttribute("aria-hidden","true");
      const form=document.createElement("form");
      form.method="POST";form.action=config.url;form.target=frame.name;form.hidden=true;
      const params=Object.assign({action,requestId,accessKey:config.accessKey,origin:location.origin},extra||{});
      Object.entries(params).forEach(([name,value])=>{
        const input=document.createElement("input");input.type="hidden";input.name=name;input.value=String(value);form.appendChild(input);
      });
      let timer;
      function clean(){clearTimeout(timer);window.removeEventListener("message",receive);frame.remove();form.remove();}
      function receive(event){
        if (!/^https:\/\/(?:script\.google\.com|(?:[a-zA-Z0-9-]+[.-])?script\.googleusercontent\.com)$/.test(event.origin)) return;
        const message=event.data;
        if (!message || message.channel!=="alJefoonPayrollCloudBackup" || message.requestId!==requestId) return;
        clean();
        if (!message.result || message.result.success!==true) reject(new Error(message.result && message.result.message || "Cloud request failed."));
        else resolve(message.result);
      }
      window.addEventListener("message",receive);
      timer=setTimeout(()=>{clean();reject(new Error(action==="backup" ? "No confirmation received. The backup may have saved; check the cloud backup list before retrying." : "No cloud response received. Check the deployment, connection and access key."));},45000);
      document.body.appendChild(frame);document.body.appendChild(form);
      try{form.submit();}catch(error){clean();reject(error);}
    });
  }
  async function run(task) {
    if (busy) return;
    busy=true;
    const clicked=panel.contains(document.activeElement)?document.activeElement:null;
    const label=clicked && clicked.tagName==="BUTTON"?clicked.textContent:null;
    if(label)clicked.textContent="Please wait…";
    panel.querySelectorAll("button,input,select").forEach(n=>{n.disabled=true;});
    try{await task();}catch(error){status(error.message);}finally{
      busy=false;
      if(label)clicked.textContent=label;
      panel.querySelectorAll("button,input,select").forEach(n=>{n.disabled=false;});
    }
  }
  function download(data,name) {
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function clearPreview(){preview=null;previewLocal=null;panel.querySelector("#cloudPreview").textContent="";panel.querySelector("#applyCloudRestore").hidden=true;}
  function showPreview(data) {
    preview=validate(data);
    previewLocal=JSON.stringify(state);
    panel.querySelector("#cloudPreview").textContent=preview.state.employees.length+" employees · "+preview.state.transactions.length+
      " transactions · "+preview.state.leaves.length+" leave records · Backup: "+(preview.backupDate||"Unknown date")+
      ". Restoring replaces payroll data after saving a safety copy.";
    panel.querySelector("#applyCloudRestore").hidden=false;
  }
  function applyRestore() {
    if (!preview) throw new Error("Preview a backup first.");
    if (JSON.stringify(state)!==previewLocal) throw new Error("Payroll changed after preview. Preview the backup again before restoring.");
    validate(preview);
    if (!confirm("Replace your current payroll with this backup? A safety copy will be saved first.")) return;
    const before=snapshot();
    localStorage.setItem(SAFETY,JSON.stringify(before));
    const restored=JSON.parse(JSON.stringify(preview.state));
    localStorage.setItem(KEY,JSON.stringify(restored));
    state=restored;
    try {renderAll();} catch(error) {
      localStorage.setItem(KEY,JSON.stringify(before.state));state=before.state;
      try{renderAll();}catch(ignored){}
      throw new Error("Restore could not refresh the payroll screens. Previous data was restored. "+error.message);
    }
    clearPreview();
    status("Restore completed. Your previous payroll is available using Download Safety Copy.");
  }
  function open() {
    if(panel){panel.classList.add("show");return;}
    panel=document.createElement("div");panel.id="payrollCloudBackupModal";panel.className="modal show";
    panel.setAttribute("role","dialog");panel.setAttribute("aria-modal","true");panel.setAttribute("aria-labelledby","cloudTitle");
    panel.innerHTML=`<div class="modal-box">
      <div class="modal-head"><h2 id="cloudTitle">Cloud Backup & Restore</h2></div><div style="padding:20px;">
      <p>Save payroll data in your Google Drive or restore an earlier backup. Backups run only when you click Backup Now.</p>
      <p id="cloudStatus" role="status" aria-live="polite">Enter your payroll web app URL and access key, then test the connection.</p><br>
      <div class="form-grid" style="grid-template-columns:1fr;">
        <label>Web app URL<input id="cloudURL" type="url" style="width:100%;box-sizing:border-box;margin:6px 0 12px;" value="${esc(localStorage.getItem(SETTINGS)||DEFAULT_URL)}"></label>
        <label>Backup access key<input id="cloudKey" type="password" autocomplete="off" style="width:100%;box-sizing:border-box;margin:6px 0 12px;" value="${esc(sessionStorage.getItem(SECRET)||"")}"></label>
        <div class="customer-select-buttons" style="display:flex;flex-wrap:wrap;gap:8px;">
          <button type="button" id="cloudTest">Test Connection</button>
          <button type="button" id="cloudBackupNow">Backup Now</button>
          <button type="button" id="cloudList">Load Cloud Backups</button>
          <button type="button" id="cloudDownload">Download Local Backup</button>
          <button type="button" id="cloudSafety">Download Safety Copy</button>
        </div>
        <label>Cloud backup<select id="cloudVersions" style="width:100%;margin:6px 0;"><option value="">Load cloud backups first</option></select></label>
        <div class="customer-select-buttons"><button type="button" id="cloudPreviewButton">Preview Cloud Restore</button></div>
        <label>Or restore a backup file<input id="cloudFile" type="file" accept=".json,application/json" style="width:100%;margin:6px 0;"></label>
        <p id="cloudPreview"></p>

      </div>
      <div class="form-actions" style="display:flex;gap:8px;justify-content:flex-end;">
        <button type="button" id="cloudClose" class="secondary">Close</button>
        <button type="button" id="applyCloudRestore" class="primary" hidden>Restore Selected Backup</button>
      </div>
    </div></div>`;
    document.body.appendChild(panel);
    panel.querySelector("#cloudTest").onclick=()=>run(async()=>{status("Testing connection…");await request("test");status("Cloud connection verified.");});
    panel.querySelector("#cloudBackupNow").onclick=()=>run(async()=>{
      const data=snapshot();if(!data.state.employees.length && !data.state.transactions.length && !data.state.leaves.length)throw new Error("Empty backups are blocked to protect your cloud data.");
      status("Saving cloud backup…");const result=await request("backup",{payload:JSON.stringify(data)});
      status("Cloud backup verified: "+result.employeeCount+" employees · "+result.transactionCount+" transactions · "+result.leaveCount+" leave records · "+result.backupDate);
    });
    panel.querySelector("#cloudList").onclick=()=>run(async()=>{
      clearPreview();status("Loading cloud backups…");const result=await request("list");
      const select=panel.querySelector("#cloudVersions");select.innerHTML="";
      result.backups.forEach(file=>{const option=document.createElement("option");option.value=file.id;option.textContent=file.date+" — "+(file.name==="Payroll_Backup.json"?"Latest backup":"Previous backup");select.appendChild(option);});
      status(result.backups.length?result.backups.length+" cloud backup(s) available.":"No cloud backups found yet.");
    });
    panel.querySelector("#cloudVersions").onchange=clearPreview;
    panel.querySelector("#cloudPreviewButton").onclick=()=>run(async()=>{
      clearPreview();const fileId=panel.querySelector("#cloudVersions").value;if(!fileId)throw new Error("Load and select a cloud backup first.");
      status("Loading backup preview…");const result=await request("restore",{fileId});showPreview(result.backup);status("Review the preview, then click Restore Selected Backup.");
    });
    panel.querySelector("#cloudFile").onchange=()=>run(async()=>{
      clearPreview();const file=panel.querySelector("#cloudFile").files[0];if(!file)return;
      if(file.size>5000000)throw new Error("Backup file exceeds 5 MB.");showPreview(JSON.parse(await file.text()));status("Backup file validated. Review the preview before restoring.");
    });
    panel.querySelector("#applyCloudRestore").onclick=()=>run(async()=>applyRestore());
    panel.querySelector("#cloudDownload").onclick=()=>run(async()=>{download(snapshot(),"Payroll_Local_Backup.json");status("Local backup downloaded.");});
    panel.querySelector("#cloudSafety").onclick=()=>run(async()=>{const raw=localStorage.getItem(SAFETY);if(!raw)throw new Error("No restore safety copy is available yet.");download(validate(JSON.parse(raw)),"Payroll_PreRestore_Backup.json");status("Safety copy downloaded.");});
    const close=()=>{if(!busy)panel.classList.remove("show");};
    panel.querySelector("#cloudClose").onclick=close;
    panel.addEventListener("click",e=>{if(e.target===panel)close();});
    document.addEventListener("keydown",e=>{if(e.key==="Escape"&&panel.classList.contains("show")){e.stopImmediatePropagation();close();}},true);
  }
  document.getElementById("payrollCloudBackupBtn").addEventListener("click",open);
})();
