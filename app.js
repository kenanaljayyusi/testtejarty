(() => {
  "use strict";
  const T = window.TIJARATI_TRANSLATIONS;
  let lang = localStorage.getItem("tijarati-language") || "ar";
  let activeCategory = "all";
  let toastTimer;
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const tr = key => (T[lang] && T[lang][key]) || key;
  const money = n => {
    const currency = $("#currencySelect")?.value || "JOD";
    const locale = lang === "ar" ? "ar-JO" : "en-US";
    return new Intl.NumberFormat(locale, {style:"currency", currency, maximumFractionDigits:2}).format(Number.isFinite(n) ? n : 0);
  };
  function applyTranslations() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    $$("[data-i18n]").forEach(el => {
      const key = el.dataset.i18n;
      if (T[lang][key] !== undefined) el.innerHTML = T[lang][key];
    });
    $$("[data-i18n-placeholder]").forEach(el => el.placeholder = tr(el.dataset.i18nPlaceholder));
    $("#languageToggle").innerHTML = `${lang === "ar" ? "EN" : "ع"} <span aria-hidden="true">↗</span>`;
    $("#languageToggle").setAttribute("aria-label", lang === "ar" ? "Switch language to English" : "تغيير اللغة إلى العربية");
    $("#menuToggle").setAttribute("aria-label", lang === "ar" ? "فتح القائمة" : "Open menu");
    document.title = lang === "ar" ? "تجارتي | أدوات ذكية لتجارتك" : "Tijarati | Smart tools for your business";
    renderToolCards();
    if (!$("#toolWorkspace").classList.contains("hidden") && currentTool) openTool(currentTool, false);
  }
  function showToast(message) {
    const toast = $("#toast"); toast.textContent = message; toast.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
  }
  const toolInfo = {
    profit:{title:"profitTitle",desc:"profitDesc"},discount:{title:"discountTitle",desc:"discountDesc"},price:{title:"priceTitle",desc:"priceDesc"},
    description:{title:"descriptionTitle",desc:"descriptionDesc"},ads:{title:"adsTitle",desc:"adsDesc"},order:{title:"orderTitle",desc:"orderDesc"}
  };
  let currentTool = null;
  function renderToolCards() {
    const query = ($("#toolSearch").value || "").trim().toLocaleLowerCase();
    let count = 0;
    $$(".tool-card").forEach(card => {
      const categoryMatch = activeCategory === "all" || card.dataset.category === activeCategory;
      const text = `${tr(toolInfo[card.dataset.tool].title)} ${tr(toolInfo[card.dataset.tool].desc)}`.toLocaleLowerCase();
      const match = categoryMatch && (!query || text.includes(query));
      card.classList.toggle("hidden", !match); if (match) count++;
    });
    $("#emptyState").classList.toggle("hidden", count > 0);
  }
  function field(id, label, opts={}) {
    const type = opts.type || "number";
    const min = opts.min !== undefined ? ` min="${opts.min}"` : (type === "number" ? ' min="0"' : "");
    const max = opts.max !== undefined ? ` max="${opts.max}"` : "";
    const step = opts.step || (type === "number" ? "0.01" : "");
    const value = opts.value !== undefined ? ` value="${opts.value}"` : "";
    const required = opts.required ? " required" : "";
    const placeholder = opts.placeholder ? ` placeholder="${opts.placeholder}"` : "";
    if (opts.select) return `<div class="field"><label for="${id}">${tr(label)}</label><select id="${id}">${opts.select.map(o=>`<option value="${o.value}">${tr(o.label)}</option>`).join("")}</select></div>`;
    if (type === "textarea") return `<div class="field"><label for="${id}">${tr(label)}</label><textarea id="${id}"${placeholder}></textarea></div>`;
    return `<div class="field"><label for="${id}">${tr(label)}</label><input id="${id}" type="${type}"${min}${max}${step ? ` step="${step}"` : ""}${value}${required}${placeholder}></div>`;
  }
  function currencyField() {
    return `<div class="field"><label for="currencySelect">${tr("currency")}</label><select id="currencySelect"><option value="JOD">JOD — Jordanian dinar</option><option value="USD">USD — US dollar</option><option value="EUR">EUR — Euro</option><option value="SAR">SAR — Saudi riyal</option><option value="AED">AED — UAE dirham</option></select><span class="field-hint">${lang==="ar"?"تغيير رمز العرض فقط، دون تحويل للعملة.":"Changes display format only; no currency conversion."}</span></div>`;
  }
  function formShell(fields, note="") {
    return `<div class="tool-form-grid">${fields}</div>${note ? `<p class="result-note">${note}</p>` : ""}<div class="tool-actions"><button class="btn btn-primary btn-small" id="calculateBtn" type="button">${tr("calculate")} ↗</button><button class="btn btn-outline btn-small" id="resetBtn" type="button">${tr("reset")}</button></div><div id="toolResults"></div>`;
  }
  function resultBox(items, note="", copyText="") {
    return `<div class="results-box"><h3>${tr("descriptionOutput")}</h3><div class="result-grid">${items.map((x,i)=>`<div class="result-item ${x.primary?"primary-result":""}"><span>${tr(x.label)}</span><strong>${x.value}</strong></div>`).join("")}</div>${note?`<p class="result-note">${note}</p>`:""}<div class="tool-actions"><button class="btn btn-outline btn-small" id="copyResultBtn" type="button" data-copy="${encodeURIComponent(copyText || items.map(x=>`${tr(x.label)}: ${x.value}`).join("\n"))}">${tr("copy")}</button></div></div>`;
  }
  function num(id) { const el = $("#"+id); return el && el.value.trim() !== "" ? Number(el.value) : NaN; }
  function nonnegative(ids) { return ids.every(id => Number.isFinite(num(id)) && num(id) >= 0); }
  function error(msg) { $("#toolResults").innerHTML = `<p class="result-note" role="alert" style="color:#b34242;font-weight:800">${msg}</p>`; }
  function bindCommon(run) {
    $("#calculateBtn").addEventListener("click", run);
    $("#resetBtn").addEventListener("click", () => { $("#toolPanel").querySelectorAll("input,textarea").forEach(el => { if(el.type==="number") el.value=""; else el.value=""; }); $("#toolPanel").querySelectorAll("select").forEach(el=>el.selectedIndex=0); $("#toolResults").innerHTML=""; });
    const curr = $("#currencySelect"); if(curr) curr.addEventListener("change", () => { if ($("#toolResults").innerHTML) run(); });
  }
  function bindCopy() {
    const b = $("#copyResultBtn"); if (!b) return;
    b.addEventListener("click", async () => {
      const text = decodeURIComponent(b.dataset.copy);
      try { await navigator.clipboard.writeText(text); showToast(tr("copied")); }
      catch { const area=document.createElement("textarea"); area.value=text; document.body.append(area); area.select(); const ok=document.execCommand("copy"); area.remove(); showToast(ok?tr("copied"):tr("copyFail")); }
    });
  }
  function openTool(id, scroll=true) {
    const savedValues = (!scroll && currentTool === id) ? Object.fromEntries($$("#toolPanel input, #toolPanel textarea, #toolPanel select").map(el => [el.id, el.value])) : null;
    currentTool=id; const info=toolInfo[id];
    $("#workspaceTitle").textContent=tr(info.title); $("#workspaceDescription").textContent=tr(info.desc);
    $("#toolWorkspace").classList.remove("hidden");
    const panel=$("#toolPanel");
    if(id==="profit") {
      panel.innerHTML=formShell(field("purchase","costPurchase",{value:"",required:true})+field("sale","sellingPrice",{required:true})+field("shipping","shipping")+field("packaging","packaging")+field("extras","extraCosts")+field("fee","paymentFee",{max:100,value:0})+currencyField());
      bindCommon(()=>{const ids=["purchase","sale","shipping","packaging","extras","fee"];if(!nonnegative(ids)){error(tr("errorNumbers"));return;}const [p,s,sh,pk,ex,f]=ids.map(num);if(f>100){error(tr("errorDiscount"));return;}const fee=s*f/100,cost=p+sh+pk+ex+fee,profit=s-cost,margin=s>0?profit/s*100:0,markup=cost>0?profit/cost*100:0;const status=profit>0?tr("profit"):profit<0?tr("loss"):tr("breakEven");$("#toolResults").innerHTML=resultBox([{label:"totalCosts",value:money(cost)},{label:"netProfit",value:money(profit),primary:true},{label:"profitMargin",value:s>0?`${margin.toFixed(2)}%`:"—"},{label:"markup",value:cost>0?`${markup.toFixed(2)}%`:"—"},{label:"status",value:status}].map(x=>({...x,value:x.value})),tr("profitNote"));bindCopy();});
    } else if(id==="discount") {
      panel.innerHTML=formShell(field("original","originalPrice",{required:true})+field("discountRate","discountRate",{max:100,required:true})+currencyField());
      bindCommon(()=>{if(!nonnegative(["original","discountRate"])){error(tr("errorNumbers"));return;}const p=num("original"),r=num("discountRate");if(r>100){error(tr("errorDiscount"));return;}const d=p*r/100,final=p-d;$("#toolResults").innerHTML=resultBox([{label:"discountValue",value:money(d)},{label:"finalPrice",value:money(final),primary:true}], "", `${tr("discountValue")}: ${money(d)}\n${tr("finalPrice")}: ${money(final)}`);bindCopy();});
    } else if(id==="price") {
      panel.innerHTML=formShell(field("productCost","productCost",{required:true})+field("extras","extraCosts")+field("margin","targetMargin",{max:99.99,required:true})+currencyField(),tr("marginHelp"));
      bindCommon(()=>{if(!nonnegative(["productCost","extras","margin"])){error(tr("errorNumbers"));return;}const c=num("productCost")+num("extras"),m=num("margin");if(m>=100){error(tr("errorMargin"));return;}if(c<=0){error(tr("costMustPositive"));return;}const price=c/(1-m/100),profit=price-c;$("#toolResults").innerHTML=resultBox([{label:"totalCost",value:money(c)},{label:"requiredPrice",value:money(price),primary:true},{label:"netProfit",value:money(profit)},{label:"profitMargin",value:`${m.toFixed(2)}%`}],tr("marginHelp"));bindCopy();});
    } else if(id==="description") {
      panel.innerHTML=formShell(field("productName","productName",{type:"text",required:true})+field("productType","productType",{type:"text",required:true})+field("audience","audience",{type:"text"})+field("features","features",{type:"textarea"})+field("style","writingStyle",{select:[{value:"professional",label:"professional"},{value:"friendly",label:"friendly"},{value:"marketing",label:"marketing"}]})+field("outputLang","language",{select:[{value:"ar",label:"arabic"},{value:"en",label:"english"}]}));
      $("#calculateBtn").textContent=tr("generate");
      $("#calculateBtn").addEventListener("click",()=>{const name=$("#productName").value.trim(),type=$("#productType").value.trim(),features=$("#features").value.trim(),aud=$("#audience").value.trim(),style=$("#style").value,outLang=$("#outputLang").value;if(!name||!type){error(tr("invalid"));return;}const isAr=outLang==="ar";const fs=features?features.split(/[,،\n]/).map(x=>x.trim()).filter(Boolean):[];let text;if(isAr){const opener=style==="professional"?`تعرّف على ${name}، خيار عملي من فئة ${type}.`:style==="friendly"?`خلّي تجربتك أسهل مع ${name}!`:`اكتشف ${name} واستعد لتجربة مختلفة من ${type}.`;text=`${opener}\n${fs.length?"أبرز المميزات:\n"+fs.map(x=>"• "+x).join("\n"):"صُمّم ليكون إضافة مناسبة لاحتياجاتك اليومية."}\n${aud?`مناسب لـ ${aud}.`:"اختيار مناسب لمن يبحث عن الجودة والعملية."}\nاطلبه اليوم وتعرّف على تفاصيله.`;}else{const opener=style==="professional"?`Meet ${name}, a practical ${type} option.`:style==="friendly"?`Make your day easier with ${name}!`:`Discover ${name} and bring a fresh touch to your ${type} choices.`;text=`${opener}\n${fs.length?"Key features:\n"+fs.map(x=>"• "+x).join("\n"):"Designed to be a useful addition to your everyday needs."}\n${aud?`A great fit for ${aud}.`:"A practical choice for those who value quality and function."}\nExplore it today and learn more.`;}$("#toolResults").innerHTML=`<div class="results-box"><h3>${tr("descriptionOutput")}</h3><div class="generated-output" id="generatedOutput"></div><p class="result-note">${tr("aboutToolAI")}</p><div class="tool-actions"><button class="btn btn-outline btn-small" id="copyTextBtn">${tr("copy")}</button></div></div>`;$("#generatedOutput").textContent=text;$("#copyTextBtn").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(text);showToast(tr("copied"));}catch{showToast(tr("copyFail"));}});});
      $("#resetBtn").addEventListener("click",()=>{$("#calculateBtn").textContent=tr("generate");});
    } else if(id==="ads") {
      panel.innerHTML=formShell(field("adProduct","productName",{type:"text",required:true})+field("audience","audience",{type:"text"})+field("platform","adPlatform",{select:[{value:"instagram",label:"instagram"},{value:"facebook",label:"facebook"},{value:"tiktok",label:"tiktok"}]})+field("adStyle","adStyle",{select:[{value:"bold",label:"bold"},{value:"playful",label:"playful"},{value:"elegant",label:"elegant"}]}));
      $("#calculateBtn").textContent=tr("generate");
      $("#calculateBtn").addEventListener("click",()=>{const product=$("#adProduct").value.trim(),aud=$("#audience").value.trim(),platform=$("#platform").value,style=$("#adStyle").value;if(!product){error(tr("invalid"));return;}const ar=lang==="ar",plat=platform==="instagram"?"Instagram":platform==="facebook"?"Facebook":"TikTok";const tone=style==="bold"?(ar?"مباشر وقوي":"direct and bold"):style==="playful"?(ar?"مرح وقريب":"playful and friendly"):(ar?"أنيق واحترافي":"elegant and professional");const ideas=ar?[`1. ${tr("adHook")}: "جاهز تجرّب ${product}؟"`,`2. ${tr("adBenefit")}: "خلّي ${product} يضيف فرقًا ليومك."`,`3. ${tr("adCall")}: "اكتشف التفاصيل وشاركنا رأيك."`,`4. فكرة محتوى: اعرض ${product} في استخدام واقعي مع إبراز ميزة واحدة واضحة.`,`5. المنصة: ${plat} · الأسلوب: ${tone}${aud?` · الجمهور: ${aud}`:""}`]:[`1. ${tr("adHook")}: "Ready to try ${product}?"`,`2. ${tr("adBenefit")}: "Let ${product} add something useful to your day."`,`3. ${tr("adCall")}: "Explore the details and tell us what you think."`,`4. Content idea: Show ${product} in a real-life use case and highlight one clear benefit.`,`5. Platform: ${plat} · Style: ${tone}${aud?` · Audience: ${aud}`:""}`];$("#toolResults").innerHTML=`<div class="results-box"><h3>${tr("adIdeas")}</h3>${ideas.map((x,i)=>`<div class="generated-output" style="margin-top:10px" id="adIdea${i}"></div><button class="text-link" style="margin-top:8px" data-copy-idea="${i}">${tr("copy")} ↗</button>`).join("")}<p class="result-note">${tr("adDisclosure")}</p></div>`;ideas.forEach((x,i)=>$("#adIdea"+i).textContent=x);$$("[data-copy-idea]").forEach(b=>b.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(ideas[Number(b.dataset.copyIdea)]);showToast(tr("copied"));}catch{showToast(tr("copyFail"));}}));});
      $("#resetBtn").addEventListener("click",()=>{$("#calculateBtn").textContent=tr("generate");});
    } else if(id==="order") {
      panel.innerHTML=formShell(field("unitCost","unitCost",{required:true})+field("quantity","quantity",{type:"number",min:1,step:1,value:1,required:true})+field("shipping","shipping")+field("packaging","packaging")+field("extras","extraCosts")+field("unitPrice","unitSellingPrice")+currencyField());
      bindCommon(()=>{if(!nonnegative(["unitCost","quantity","shipping","packaging","extras"])||num("quantity")<1){error(tr("errorNumbers"));return;}const unit=num("unitCost"),q=Math.floor(num("quantity")),ship=num("shipping"),pack=num("packaging"),extra=num("extras"),price=$("#unitPrice").value.trim()===""?null:num("unitPrice");if(price!==null&&(!Number.isFinite(price)||price<0)){error(tr("errorNumbers"));return;}const products=unit*q,total=products+ship+pack+extra,per=total/q,revenue=price===null?null:price*q,profit=price===null?null:revenue-total;const items=[{label:"productsTotal",value:money(products)},{label:"orderTotal",value:money(total),primary:true},{label:"unitTotal",value:money(per)}];if(price!==null)items.push({label:"revenue",value:money(revenue)},{label:"orderProfit",value:money(profit)});$("#toolResults").innerHTML=resultBox(items,price===null?tr("orderMissingPrice"):"",items.map(x=>`${tr(x.label)}: ${x.value}`).join("\n"));bindCopy();});
    }
    if (savedValues) Object.entries(savedValues).forEach(([key, value]) => { const el = $("#" + key); if (el) el.value = value; });
    if(scroll) $("#toolWorkspace").scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"});
  }
  $("#languageToggle").addEventListener("click",()=>{lang=lang==="ar"?"en":"ar";localStorage.setItem("tijarati-language",lang);applyTranslations();showToast(lang==="ar"?"تم تغيير اللغة إلى العربية":"Language changed to English");});
  $("#toolSearch").addEventListener("input",renderToolCards);
  $$(".category-chip").forEach(btn=>btn.addEventListener("click",()=>{$$(".category-chip").forEach(x=>x.classList.remove("active"));btn.classList.add("active");activeCategory=btn.dataset.category;renderToolCards();}));
  $$("[data-open-tool]").forEach(btn=>btn.addEventListener("click",()=>openTool(btn.dataset.openTool)));
  $("#closeWorkspace").addEventListener("click",()=>{$("#toolWorkspace").classList.add("hidden");currentTool=null;$("#tools").scrollIntoView({behavior:"smooth"});});
  $("#menuToggle").addEventListener("click",()=>{const nav=$("#navLinks"),open=nav.classList.toggle("open");$("#menuToggle").setAttribute("aria-expanded",String(open));});
  $$("#navLinks a").forEach(a=>a.addEventListener("click",()=>{$("#navLinks").classList.remove("open");$("#menuToggle").setAttribute("aria-expanded","false");}));
  document.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();$("#toolSearch").focus();}});
  $("#year").textContent=new Date().getFullYear();
  applyTranslations();
})();