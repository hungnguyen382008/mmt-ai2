/* =============================================
   MATHMENTOR-AI – app.js v4.0
   OpenRouter API (no Gemini)
   ============================================= */

// ───────── CONFIG ─────────
// ───── GROQ CONFIG (miễn phí, không cần thẻ) ─────
const GROQ_API_KEY = "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";
const GROQ_URL     = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODELS  = [
  "llama-3.3-70b-versatile",
  "llama3-70b-8192",
  "gemma2-9b-it",
  "llama3-8b-8192",
];
let currentGroqModel = 0;
const STORAGE_KEY = "mathmentor_v4";

// KaTeX options
window.katexOpts = {
  delimiters: [
    {left:"$$", right:"$$", display:true},
    {left:"\\[", right:"\\]", display:true},
    {left:"$",  right:"$",  display:false},
    {left:"\\(", right:"\\)", display:false}
  ],
  throwOnError: false,
  errorColor: "#ef4444"
};
window.katexQueue = [];

function renderMath(el) {
  if (window.katexReady && window.renderMathInElement) {
    renderMathInElement(el, window.katexOpts);
  } else {
    if (!window.katexQueue) window.katexQueue = [];
    window.katexQueue.push(el);
  }
}

// ───────── SYSTEM PROMPTS ─────────
const PROMPT_NORMAL = `Bạn là MATHMENTOR-AI – Giáo sư Toán học AI thông minh, thân thiện, dành cho học sinh Việt Nam.

NHIỆM VỤ: Hỗ trợ toàn bộ chương trình Toán Việt Nam từ lớp 1 đến đại học.

CÁCH TRÌNH BÀY (bắt buộc):
- Viết rõ ràng, có cấu trúc với tiêu đề emoji: 📌 Phân tích → 📖 Lý thuyết → 🔢 Các bước giải → ✅ Kết quả → 💡 Mẹo
- Mỗi bước giải xuống dòng riêng biệt
- Chỉ dùng LaTeX ($...$) cho công thức phức tạp như phân số $\frac{a}{b}$, căn $\sqrt{x}$, tích phân $\int$
- KHÔNG dùng LaTeX cho những thứ đơn giản như x^2, 2x+1

ĐỒ THỊ/HÌNH HỌC: Khi bài liên quan đồ thị hoặc hình học, thêm dòng cuối: [GEOGEBRA: lệnh]
Ví dụ: [GEOGEBRA: f(x)=x^2-2x+1] hoặc [GEOGEBRA: A=(0,0);B=(3,0);C=(1.5,2.6);Polygon(A,B,C)]

NGÔN NGỮ: Luôn trả lời bằng Tiếng Việt.
CÁC MÔN: Đại số, Giải tích, Hình học, Lượng giác, Xác suất, Số phức, Tổ hợp, Dãy số.`;

const PROMPT_TUTOR = `Bạn là MATHMENTOR-AI – Giáo sư Toán học AI theo phương pháp gia sư Socratic.

CHẾ ĐỘ GIA SƯ: KHÔNG đưa đáp án ngay. Thay vào đó:
1. Khen ngợi câu hỏi của học sinh.
2. Hỏi học sinh đã biết gì về chủ đề này.
3. Gợi ý từng bước NHỎ để học sinh tự tư duy.
4. Khen khi đúng và hướng dẫn bước tiếp theo.
5. Chỉ đưa đáp án khi học sinh đã cố gắng hoặc yêu cầu rõ ràng.

CÁCH TRÌNH BÀY: Rõ ràng, đơn giản. Chỉ dùng LaTeX ($...$) khi thực sự cần.
NGÔN NGỮ: Luôn Tiếng Việt. Giọng khuyến khích, kiên nhẫn.`;

// ───────── STATE ─────────
let conversations = {};
let currentConvId  = null;
let aiMode = "normal";
let pendingAttachments = [];
let deleteTarget = null;

// ───────── DOM ─────────
const sidebar        = document.getElementById("sidebar");
const sidebarToggle  = document.getElementById("sidebarToggle");
const topbarToggle   = document.getElementById("topbarToggle");
const newChatBtn     = document.getElementById("newChatBtn");
const historyList    = document.getElementById("historyList");
const deleteAllBtn   = document.getElementById("deleteAllBtn");
const welcomeScreen  = document.getElementById("welcomeScreen");
const chatArea       = document.getElementById("chatArea");
const messagesEl     = document.getElementById("messages");
const userInput      = document.getElementById("userInput");
const sendBtn        = document.getElementById("sendBtn");
const imageInput     = document.getElementById("imageInput");
const docInput       = document.getElementById("docInput");
const attachmentsBar = document.getElementById("attachmentsBar");
const attachmentsList= document.getElementById("attachmentsList");
const confirmModal   = document.getElementById("confirmModal");
const confirmText    = document.getElementById("confirmText");
const confirmOk      = document.getElementById("confirmOk");
const confirmCancel  = document.getElementById("confirmCancel");
const geoModal       = document.getElementById("geoModal");
const geoClose       = document.getElementById("geoClose");
const modeDesc       = document.getElementById("modeDesc");
const modeIndicator  = document.getElementById("modeIndicator");
const generateQuizBtn= document.getElementById("generateQuizBtn");
const quizTopic      = document.getElementById("quizTopic");
const quizLevel      = document.getElementById("quizLevel");
const quizCount      = document.getElementById("quizCount");
const quickBtns      = document.querySelectorAll(".quick-btn");

// ───────── INIT ─────────
function init() {
  const raw = localStorage.getItem(STORAGE_KEY);
  conversations = raw ? JSON.parse(raw) : {};
  renderHistoryList();
}

// ───────── SIDEBAR ─────────
function toggleSidebar() { sidebar.classList.toggle("collapsed"); }
sidebarToggle.addEventListener("click", toggleSidebar);
topbarToggle.addEventListener("click", toggleSidebar);

// ───────── MODE SWITCH ─────────
document.querySelectorAll(".mode-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    aiMode = btn.dataset.mode;
    if (aiMode === "tutor") {
      modeDesc.textContent = "AI gợi ý từng bước, KHÔNG đưa đáp án ngay!";
      modeIndicator.textContent = "📝 Chế độ gia sư";
      modeIndicator.classList.add("tutor");
    } else {
      modeDesc.textContent = "AI giải thích và đưa đáp án đầy đủ.";
      modeIndicator.textContent = "🎓 Giải đầy đủ";
      modeIndicator.classList.remove("tutor");
    }
  });
});

// ───────── NEW CHAT ─────────
newChatBtn.addEventListener("click", startNewChat);
function startNewChat() {
  currentConvId = "conv_" + Date.now();
  conversations[currentConvId] = { title: "Hội thoại mới", messages: [] };
  saveHistory(); renderHistoryList(); showWelcome(); clearAttachments();
}

// ───────── HISTORY ─────────
function renderHistoryList() {
  const ids = Object.keys(conversations).reverse();
  if (!ids.length) { historyList.innerHTML = '<div class="history-empty">Chưa có lịch sử.</div>'; return; }
  historyList.innerHTML = ids.map(id => `
    <div class="history-item ${id===currentConvId?'active':''}" data-id="${id}">
      <span class="history-item-text">💬 ${escHtml(conversations[id].title)}</span>
      <button class="history-item-del" data-id="${id}">✕</button>
    </div>`).join("");
  historyList.querySelectorAll(".history-item-text").forEach(el =>
    el.addEventListener("click", () => loadConversation(el.closest(".history-item").dataset.id)));
  historyList.querySelectorAll(".history-item-del").forEach(btn =>
    btn.addEventListener("click", e => {
      e.stopPropagation();
      showConfirm("conv", btn.dataset.id, `Xóa hội thoại "<b>${escHtml(conversations[btn.dataset.id]?.title)}</b>"?`);
    }));
}

function loadConversation(id) {
  currentConvId = id;
  renderHistoryList();
  const conv = conversations[id];
  if (!conv?.messages.length) { showWelcome(); return; }
  showChat();
  messagesEl.innerHTML = "";
  conv.messages.forEach(m => renderMessage(m.role, m.content, m.time, m.attachments||[], m.msgType||"normal", false));
  scrollToBottom();
}

function saveHistory() { localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations)); }

// ───────── DELETE ─────────
deleteAllBtn.addEventListener("click", () => showConfirm("all", null, "Xóa <b>toàn bộ</b> lịch sử hội thoại?"));
function showConfirm(type, id, text) {
  deleteTarget = {type, id};
  confirmText.innerHTML = text + "<br/><small>Hành động này không thể hoàn tác.</small>";
  confirmModal.classList.remove("hidden");
}
confirmCancel.addEventListener("click", () => confirmModal.classList.add("hidden"));
confirmOk.addEventListener("click", () => {
  if (!deleteTarget) return;
  if (deleteTarget.type==="all") { conversations={}; currentConvId=null; saveHistory(); showWelcome(); }
  else { delete conversations[deleteTarget.id]; saveHistory(); if(currentConvId===deleteTarget.id){currentConvId=null;showWelcome();} }
  renderHistoryList(); confirmModal.classList.add("hidden"); deleteTarget=null;
});

// ───────── SCREENS ─────────
function showWelcome() { welcomeScreen.style.display="flex"; chatArea.style.display="none"; messagesEl.innerHTML=""; }
function showChat()    { welcomeScreen.style.display="none"; chatArea.style.display="flex"; }

// ───────── QUICK PROMPTS ─────────
quickBtns.forEach(btn => btn.addEventListener("click", () => {
  if (!currentConvId) startNewChat();
  userInput.value = btn.dataset.q;
  sendMessage();
}));

// ───────── FILE ATTACH ─────────
imageInput.addEventListener("change", () => handleFiles(imageInput.files));
docInput.addEventListener("change",   () => handleFiles(docInput.files));

async function handleFiles(files) {
  for (const file of Array.from(files)) {
    const id = "att_"+Date.now()+"_"+Math.random().toString(36).slice(2);
    if (file.type.startsWith("image/")) {
      const dataUrl = await readAsDataURL(file);
      pendingAttachments.push({id, name:file.name, type:"image", mimeType:file.type, dataUrl, textContent:null});
    } else {
      const text = await readAsText(file);
      pendingAttachments.push({id, name:file.name, type:"doc", mimeType:file.type, dataUrl:null, textContent:text});
    }
  }
  imageInput.value=""; docInput.value="";
  renderAttachmentsBar();
}

function renderAttachmentsBar() {
  if (!pendingAttachments.length) { attachmentsBar.style.display="none"; return; }
  attachmentsBar.style.display="block";
  attachmentsList.innerHTML = pendingAttachments.map(a => `
    <div class="attach-chip">
      ${a.type==="image"?`<img class="attach-chip-thumb" src="${a.dataUrl}" alt="">`:`<span class="attach-chip-icon">📄</span>`}
      <span class="attach-chip-name">${escHtml(a.name)}</span>
      <button class="attach-chip-remove" data-id="${a.id}">✕</button>
    </div>`).join("");
  attachmentsList.querySelectorAll(".attach-chip-remove").forEach(btn =>
    btn.addEventListener("click", () => { pendingAttachments=pendingAttachments.filter(a=>a.id!==btn.dataset.id); renderAttachmentsBar(); }));
}

function clearAttachments() { pendingAttachments=[]; renderAttachmentsBar(); }
function readAsDataURL(f){ return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f);}); }
function readAsText(f)   { return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsText(f,"utf-8");}); }

// ───────── QUIZ GENERATOR ─────────
generateQuizBtn.addEventListener("click", async () => {
  const topic = quizTopic.value;
  if (!topic) { alert("Vui lòng chọn chủ đề!"); return; }
  const level = quizLevel.value;
  const count = quizCount.value;
  if (!currentConvId) startNewChat();
  showChat();

  const quizPrompt = `Tạo ${count} bài tập môn Toán về "${topic}", mức độ ${level}, cho học sinh lớp 12 Việt Nam.

Định dạng CHÍNH XÁC (bắt buộc):
[CÂU 1] Nội dung câu hỏi đầy đủ...
[ĐÁP ÁN 1] Đáp án và hướng dẫn giải từng bước...

[CÂU 2] ...
[ĐÁP ÁN 2] ...

Viết công thức rõ ràng, dễ đọc. Chỉ dùng LaTeX ($...$) khi thực sự cần.`;

  const now = getTime();
  const userLabel = `🎯 Tạo ${count} bài tập ${level} về: ${topic}`;
  if (!conversations[currentConvId]) conversations[currentConvId]={title:userLabel.slice(0,42),messages:[]};
  conversations[currentConvId].messages.push({role:"user",content:userLabel,time:now,attachments:[],msgType:"normal"});
  if (conversations[currentConvId].messages.filter(m=>m.role==="user").length===1)
    conversations[currentConvId].title=userLabel.slice(0,42);
  renderHistoryList();
  renderMessage("user",userLabel,now,[],"normal",true);

  const typingEl=showTyping();
  try {
    const aiText=await callAI([{role:"user",content:quizPrompt}],"normal");
    typingEl.remove();
    const aiTime=getTime();
    conversations[currentConvId].messages.push({role:"ai",content:aiText,time:aiTime,attachments:[],msgType:"quiz"});
    saveHistory();
    renderMessage("ai",aiText,aiTime,[],"quiz",true);
  } catch(err){ typingEl.remove(); renderMessage("ai","❌ Lỗi: "+err.message,getTime(),[],"normal",true); }
  scrollToBottom();
});

// ───────── SEND ─────────
sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keydown", e => { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();} });
userInput.addEventListener("input", () => { userInput.style.height="auto"; userInput.style.height=Math.min(userInput.scrollHeight,128)+"px"; });

async function sendMessage() {
  const text=userInput.value.trim();
  if (!text && !pendingAttachments.length) return;
  if (!currentConvId) startNewChat();

  const conv=conversations[currentConvId];
  showChat();
  const now=getTime();
  const atts=[...pendingAttachments];
  const userText=text||(atts.length?"(Đính kèm tài liệu)":"");

  conv.messages.push({role:"user",content:userText,time:now,
    attachments:atts.map(a=>({name:a.name,type:a.type,dataUrl:a.type==="image"?a.dataUrl:null})),msgType:"normal"});
  if (conv.messages.filter(m=>m.role==="user").length===1){
    conv.title=userText.slice(0,42)+(userText.length>42?"…":""); renderHistoryList();
  }

  renderMessage("user",userText,now,atts,"normal",true);
  userInput.value=""; userInput.style.height="auto";
  clearAttachments();

  // Build OpenRouter messages
  const messages=[];
  // Add history
  conv.messages.slice(0,-1).forEach(m=>{
    messages.push({role:m.role==="ai"?"assistant":"user", content:m.content});
  });
  // Build current user message content
  const contentParts=[];
  for (const a of atts) {
    if (a.type==="image") {
      contentParts.push({type:"image_url", image_url:{url:a.dataUrl}});
    } else {
      contentParts.push({type:"text", text:`[TÀI LIỆU: ${a.name}]\n${a.textContent?.slice(0,8000)}\n[HẾT TÀI LIỆU]`});
    }
  }
  if (text) contentParts.push({type:"text", text});
  if (atts.length) contentParts.push({type:"text", text:"\nHãy đọc nội dung/ảnh và giải thích hoặc giải bài toán."});

  // If only text (no images), use simple string format
  const userContent = (atts.some(a=>a.type==="image") || contentParts.length>1)
    ? contentParts
    : (text || "(Đính kèm tài liệu)");
  messages.push({role:"user", content:userContent});

  const typingEl=showTyping();
  try {
    const aiText=await callAI(messages, aiMode);
    typingEl.remove();
    const aiTime=getTime();
    const msgType=aiMode==="tutor"?"tutor-msg":"normal";
    conv.messages.push({role:"ai",content:aiText,time:aiTime,attachments:[],msgType});
    saveHistory();
    renderMessage("ai",aiText,aiTime,[],msgType,true);
    const geoMatch=aiText.match(/\[GEOGEBRA:\s*(.+?)\]/);
    if (geoMatch) addGeoButton(geoMatch[1].trim());
  } catch(err){
    typingEl.remove();
    const msg=err.message||"";
    let errMsg;
    if (msg.includes("quota")||msg.includes("rate limit")||msg.includes("429"))
      errMsg="⚠️ Đã đạt giới hạn lượt dùng. Thử lại sau ít phút.";
    else if (msg.includes("401")||msg.includes("403")||msg.includes("auth"))
      errMsg="🔑 API Key không hợp lệ. Kiểm tra lại key OpenRouter.";
    else if (msg.includes("Failed to fetch")||msg.includes("NetworkError"))
      errMsg="🌐 Mất kết nối mạng. Kiểm tra internet và thử lại.";
    else
      errMsg="❌ Lỗi: "+msg;
    renderMessage("ai",errMsg,getTime(),[],"normal",true);
  }
  scrollToBottom();
}

// ───────── GROQ API (miễn phí, fallback tự động) ─────────
async function callAI(messages, mode="normal") {
  const systemPrompt = mode==="tutor" ? PROMPT_TUTOR : PROMPT_NORMAL;

  for (let i = currentGroqModel; i < GROQ_MODELS.length; i++) {
    let resp;
    try {
      resp = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: GROQ_MODELS[i],
          messages: [{role:"system", content:systemPrompt}, ...messages],
          max_tokens: 2048,
          temperature: 0.7
        })
      });
    } catch(e) {
      throw new Error("Mất kết nối mạng. Kiểm tra internet và thử lại.");
    }

    if (!resp.ok) {
      const errData = await resp.json().catch(()=>({}));
      const msg = errData?.error?.message || "";
      const status = resp.status;
      if (status === 429 || status === 503 || msg.includes("rate_limit") || msg.includes("overloaded")) {
        currentGroqModel = i + 1;
        continue;
      }
      throw new Error(msg || `HTTP ${status}`);
    }

    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content || "";
    if (!text || text.trim().length < 5) {
      currentGroqModel = i + 1;
      continue;
    }

    currentGroqModel = i;
    return text;
  }

  currentGroqModel = 0;
  throw new Error("Groq đang bận. Vui lòng thử lại sau 1 phút.");
}

// ───────── GEOGEBRA ─────────
function addGeoButton(commands) {
  const bubbles=messagesEl.querySelectorAll(".msg.ai .msg-bubble");
  if (!bubbles.length) return;
  const btn=document.createElement("button");
  btn.className="geo-btn";
  btn.innerHTML="🔷 Mở hình vẽ GeoGebra";
  btn.addEventListener("click",()=>openGeogebra(commands));
  bubbles[bubbles.length-1].appendChild(btn);
}

function openGeogebra(commands) {
  geoModal.classList.remove("hidden");
  const container=document.getElementById("ggbApplet");
  container.innerHTML="";
  const params={
    appName:"graphing", width:container.clientWidth||780, height:480,
    showToolBar:true, showAlgebraInput:true, showMenuBar:false,
    showResetIcon:true, showZoomButtons:true,
    appletOnLoad:function(api){
      commands.split(";").forEach(cmd=>{cmd=cmd.trim();if(cmd){try{api.evalCommand(cmd);}catch(e){}}});
    }
  };
  if (typeof GGBApplet!=="undefined"){ new GGBApplet(params,true).inject("ggbApplet"); }
  else{ container.innerHTML='<div style="padding:40px;text-align:center;color:#64748b;">⚠️ GeoGebra đang tải... Thử lại sau vài giây.</div>'; }
}

geoClose.addEventListener("click",()=>{ geoModal.classList.add("hidden"); document.getElementById("ggbApplet").innerHTML=""; });

// ───────── RENDER MESSAGE ─────────
function renderMessage(role, content, time, attachments, msgType, animate) {
  const div=document.createElement("div");
  div.className=`msg ${role}${msgType==="quiz"?" quiz":""}${msgType==="tutor-msg"?" tutor-msg":""}`;

  let bubble;
  if (role==="ai") {
    const clean=content.replace(/\[GEOGEBRA:[^\]]+\]/g,"").trim();
    bubble=msgType==="quiz"?renderQuizBubble(clean):markdownToHtml(clean);
  } else {
    bubble=`<p>${escHtml(content)}</p>`;
  }

  let attHtml="";
  if (attachments?.length){
    attHtml=attachments.map(a=>
      a.type==="image"&&a.dataUrl?`<img class="msg-img" src="${a.dataUrl}" alt="${escHtml(a.name)}">`:
      `<div class="msg-file-chip">📄 ${escHtml(a.name)}</div>`).join("");
  }

  div.innerHTML=`
    <div class="msg-avatar">${role==="user"?"👤":"∑"}</div>
    <div class="msg-body">
      <div class="msg-bubble">${attHtml}${bubble}</div>
      <span class="msg-time">${time}</span>
    </div>`;
  messagesEl.appendChild(div);
  const bubbleEl=div.querySelector(".msg-bubble");
  if (bubbleEl) renderMath(bubbleEl);
}

// ───────── QUIZ RENDER ─────────
function renderQuizBubble(content) {
  const qMap={},aMap={};
  const qRe=/\[CÂU\s*(\d+)\]([\s\S]*?)(?=\[CÂU\s*\d+\]|\[ĐÁP ÁN|\[DAP AN|$)/gi;
  const aRe=/\[(?:ĐÁP ÁN|DAP AN)\s*(\d+)\]([\s\S]*?)(?=\[(?:ĐÁP ÁN|DAP AN)\s*\d+\]|\[CÂU|$)/gi;
  let m;
  while((m=qRe.exec(content))!==null) qMap[m[1]]=m[2].trim();
  while((m=aRe.exec(content))!==null) aMap[m[1]]=m[2].trim();
  const nums=Object.keys(qMap);
  if (!nums.length) return `<div class="quiz-container">${markdownToHtml(content)}</div>`;
  const html=nums.map(n=>`
    <div class="quiz-q">
      <div class="quiz-q-num">📝 Câu ${n}</div>
      <div class="quiz-q-text">${markdownToHtml(qMap[n]||"")}</div>
      ${aMap[n]?`<button class="quiz-reveal-btn" onclick="toggleAnswer(this)">👁️ Xem đáp án</button>
      <div class="quiz-answer">${markdownToHtml(aMap[n])}</div>`:""}
    </div>`).join("");
  return `<div style="margin-bottom:8px;font-weight:700;color:#9333ea;">🎯 Đề kiểm tra – ${nums.length} câu</div><div class="quiz-container">${html}</div>`;
}

window.toggleAnswer=function(btn){
  const ans=btn.nextElementSibling;
  if (!ans) return;
  const show=ans.classList.toggle("show");
  btn.textContent=show?"🙈 Ẩn đáp án":"👁️ Xem đáp án";
  if (show) renderMath(ans);
};

// ───────── TYPING ─────────
function showTyping(){
  const div=document.createElement("div");
  div.className="msg ai";
  div.innerHTML=`<div class="msg-avatar">∑</div><div class="msg-body"><div class="msg-bubble"><div class="typing-indicator"><span></span><span></span><span></span></div></div></div>`;
  messagesEl.appendChild(div); scrollToBottom(); return div;
}

// ───────── MARKDOWN → HTML ─────────
function markdownToHtml(text) {
  if (!text) return "";
  const protected_chunks=[];
  let safe=text;
  safe=safe.replace(/\$\$([\s\S]*?)\$\$/g,(match)=>{ protected_chunks.push(match); return`%%MATH${protected_chunks.length-1}%%`; });
  safe=safe.replace(/\$([^\$\n]+?)\$/g,(match)=>{ protected_chunks.push(match); return`%%MATH${protected_chunks.length-1}%%`; });
  safe=safe.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  safe=safe.replace(/```[\w]*\n?([\s\S]*?)```/g,(_,c)=>`<pre><code>${c.trim()}</code></pre>`);
  safe=safe.replace(/`([^`\n]+)`/g,"<code>$1</code>");
  safe=safe.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>");
  safe=safe.replace(/\*(.+?)\*/g,"<em>$1</em>");
  safe=safe.replace(/^###\s+(.+)$/gm,"<h4>$1</h4>");
  safe=safe.replace(/^##\s+(.+)$/gm,"<h3>$1</h3>");
  safe=safe.replace(/^#\s+(.+)$/gm,"<h3>$1</h3>");
  safe=safe.replace(/^[\-\*•]\s+(.+)$/gm,"<li>$1</li>");
  safe=safe.replace(/(<li>[\s\S]*?<\/li>(\n|$))+/g,m=>`<ul>${m}</ul>`);
  safe=safe.replace(/<\/ul>\s*<ul>/g,"");
  safe=safe.replace(/^\d+\.\s+(.+)$/gm,"<li>$1</li>");
  safe=safe.replace(/^---+$/gm,"<hr/>");
  safe=safe.split(/\n\n+/).map(block=>{
    block=block.trim(); if(!block) return"";
    if(/^<(h[2-6]|ul|ol|pre|hr|li)/.test(block)) return block;
    return`<p>${block.replace(/\n/g,"<br/>")}</p>`;
  }).join("");
  protected_chunks.forEach((chunk,i)=>{ safe=safe.replace(`%%MATH${i}%%`,chunk); });
  return safe;
}

// ───────── UTILS ─────────
function getTime(){return new Date().toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"});}
function scrollToBottom(){setTimeout(()=>{if(messagesEl.parentElement)messagesEl.parentElement.scrollTop=messagesEl.parentElement.scrollHeight;},80);}
function escHtml(str){return(str||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}

// ───────── START ─────────
init();
