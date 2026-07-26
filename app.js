
const STORAGE_KEY="future-ledger-v3-2";
const START_YEAR=2027, END_YEAR=2045;
const defaults={
 settings:{
  startCash:500000,startLockedCash:150000,lockedCashYear:2028,lockedCashMonth:1,startMarket:480000,startEmployeeStock:180000,startInsuranceUsd:10000,usdRate:31.8,startDebt:0,
  salary:62000,fixedExpense:28000,monthlyMarket:18000,marketReturn:6,monthlyEmployee:5000,employeeReturn:5,
  insurancePremiumUsd:120,insuranceReturn:2,bonusMonths:1.5,bonusMonth:1,
  profitShare1:100000,profitShare1Month:4,profitShare2:100000,profitShare2Month:10,
  annualItems:[{name:"年度保險",amount:36000},{name:"旅遊預算",amount:120000}]
 },
 car:{price:1800000,year:2028,month:7,downPayment:500000,loanYears:5,annualRate:2.2,monthlyCost:6500},
 house:{price:15000000,year:2032,month:7,downPayment:3000000,loanYears:40,annualRate:2.2,closingCost:900000,monthlyCost:6000,
  sources:{cash:true,market:true,employee:false,insurance:false}}
};
let data=load();
let selectedYear=2027, selectedMonth=1, carOn=false, houseOn=false, detailOpen=false;
let results={};

function clone(v){return JSON.parse(JSON.stringify(v))}
function load(){try{return Object.assign(clone(defaults),JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}"))}catch{return clone(defaults)}}
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(data))}
function money(v){return "NT$ "+Math.round(v).toLocaleString("zh-TW")}
function signed(v){return `${v>=0?"+":"−"}NT$ ${Math.abs(Math.round(v)).toLocaleString("zh-TW")}`}
function pmt(principal,annualRate,months){if(months<=0)return 0;const r=annualRate/100/12;if(!r)return principal/months;return principal*r*Math.pow(1+r,months)/(Math.pow(1+r,months)-1)}
function idx(y,m){return (y-START_YEAR)*12+(m-1)}
function annualMonthly(){return (data.settings.annualItems||[]).reduce((a,b)=>a+(Number(b.amount)||0),0)/12}
function currentKey(){return `${carOn?"car":""}${houseOn?"house":""}`||"base"}

function drawFromSources(state,need,sources){
 const items=[], order=[["cash","現金流"],["market","台股與 ETF"],["employee","公司認股"],["insuranceTwd","美元儲蓄險"]];
 let remain=need;
 for(const [key,label] of order){
  if(!sources[key.replace("insuranceTwd","insurance")])continue;
  const take=Math.min(Math.max(0,state[key]),remain);
  if(take>0){state[key]-=take;remain-=take;items.push({label:`由${label}支付`,value:take})}
  if(remain<=0)break;
 }
 if(remain>0){state.cash-=remain;items.push({label:"資金不足（現金流轉負）",value:remain,warning:true});remain=0}
 return items;
}

function calculate(carEnabled,houseEnabled){
 const s=data.settings;
 let cash=s.startCash,lockedCash=s.startLockedCash,market=s.startMarket,employee=s.startEmployeeStock,insuranceUsd=s.startInsuranceUsd;
 let carValue=0,carDebt=0,houseValue=0,houseDebt=0;
 const rows=[], monthlyAnnualExpense=annualMonthly();
 const carPrincipal=Math.max(0,data.car.price-data.car.downPayment),carMonths=data.car.loanYears*12,carPay=pmt(carPrincipal,data.car.annualRate,carMonths),carStart=idx(data.car.year,data.car.month);
 const housePrincipal=Math.max(0,data.house.price-data.house.downPayment),houseMonths=data.house.loanYears*12,housePay=pmt(housePrincipal,data.house.annualRate,houseMonths),houseStart=idx(data.house.year,data.house.month);
 for(let year=START_YEAR;year<=END_YEAR;year++)for(let month=1;month<=12;month++){
  const mi=idx(year,month), insuranceTwd=insuranceUsd*s.usdRate;
  const start={cash,lockedCash,market,employee,insuranceUsd,insuranceTwd,carValue,carDebt,houseValue,houseDebt};
  let unlockedCash=0;
  if(year===+s.lockedCashYear && month===+s.lockedCashMonth && lockedCash>0){
   unlockedCash=lockedCash;
   cash+=lockedCash;
   lockedCash=0;
  }
  const incomeItems=[{label:"月薪",value:s.salary}];
  if(month===+s.bonusMonth)incomeItems.push({label:"年終獎金",value:s.salary*s.bonusMonths});
  if(month===+s.profitShare1Month)incomeItems.push({label:"第一次分紅",value:s.profitShare1});
  if(month===+s.profitShare2Month)incomeItems.push({label:"第二次分紅",value:s.profitShare2});
  const income=incomeItems.reduce((a,b)=>a+b.value,0);
  const marketReturn=market*(s.marketReturn/100/12);
  const employeeReturn=employee*(s.employeeReturn/100/12);
  const insuranceReturnUsd=insuranceUsd*(s.insuranceReturn/100/12);
  market+=marketReturn+s.monthlyMarket;
  employee+=employeeReturn+s.monthlyEmployee;
  insuranceUsd+=insuranceReturnUsd+s.insurancePremiumUsd;
  cash+=income-s.fixedExpense-monthlyAnnualExpense-s.monthlyMarket-s.monthlyEmployee-s.insurancePremiumUsd*s.usdRate;
  let planCashFlow=0,planItems=[],fundingWarning=false;

  if(carEnabled&&mi===carStart){
   cash-=data.car.downPayment;carValue=data.car.price;carDebt=carPrincipal;
   planItems.push({label:"汽車頭期款",value:data.car.downPayment});planCashFlow+=data.car.downPayment;
  }
  if(carEnabled&&mi>=carStart){
   const elapsed=mi-carStart;
   if(elapsed<carMonths&&carDebt>0){const r=data.car.annualRate/100/12,interest=carDebt*r,principal=Math.min(carDebt,Math.max(0,carPay-interest));carDebt-=principal;cash-=carPay;planCashFlow+=carPay;planItems.push({label:"車貸月付",value:carPay})}
   cash-=data.car.monthlyCost;planCashFlow+=data.car.monthlyCost;planItems.push({label:"車輛持有成本",value:data.car.monthlyCost});
  }

  if(houseEnabled&&mi===houseStart){
   const state={cash,market,employee,insuranceTwd:insuranceUsd*s.usdRate};
   const funding=drawFromSources(state,data.house.downPayment+data.house.closingCost,data.house.sources);
   cash=state.cash;market=state.market;employee=state.employee;insuranceUsd=state.insuranceTwd/s.usdRate;
   houseValue=data.house.price;houseDebt=housePrincipal;planItems.push(...funding);
   planCashFlow+=data.house.downPayment+data.house.closingCost;
   fundingWarning=funding.some(x=>x.warning);
  }
  if(houseEnabled&&mi>=houseStart){
   const elapsed=mi-houseStart;
   if(elapsed<houseMonths&&houseDebt>0){const r=data.house.annualRate/100/12,interest=houseDebt*r,principal=Math.min(houseDebt,Math.max(0,housePay-interest));houseDebt-=principal;cash-=housePay;planCashFlow+=housePay;planItems.push({label:"房貸月付",value:housePay})}
   cash-=data.house.monthlyCost;planCashFlow+=data.house.monthlyCost;
   planItems.push({label:"房屋持有成本",value:data.house.monthlyCost});
  }

  const insuranceValue=insuranceUsd*s.usdRate;
  const assets=cash+lockedCash+market+employee+insuranceValue+carValue+houseValue;
  const debts=s.startDebt+carDebt+houseDebt;
  const netWorth=assets-debts;
  rows.push({year,month,income,incomeItems,monthlyExpense:s.fixedExpense,annualExpense:monthlyAnnualExpense,
   marketContribution:s.monthlyMarket,employeeContribution:s.monthlyEmployee,insurancePremiumTwd:s.insurancePremiumUsd*s.usdRate,
   marketReturn,employeeReturn,insuranceReturnTwd:insuranceReturnUsd*s.usdRate,planCashFlow,planItems,fundingWarning,
   cash,lockedCash,unlockedCash,market,employee,insuranceUsd,insuranceValue,carValue,carDebt,houseValue,houseDebt,assets,debts,netWorth,start});
 }
 return rows;
}

function recalc(){
 results.base=calculate(false,false);results.car=calculate(true,false);results.house=calculate(false,true);results.carhouse=calculate(true,true);
 renderAll();
}
function rowFor(key=currentKey()){return results[key].find(r=>r.year===+selectedYear&&r.month===+selectedMonth)}
function baseStartNet(){const s=data.settings;return s.startCash+s.startLockedCash+s.startMarket+s.startEmployeeStock+s.startInsuranceUsd*s.usdRate-s.startDebt}

function renderAll(){renderOverview();renderTimeline();renderPlans();renderSettings()}
function renderOverview(){
 const s=data.settings;
 document.getElementById("overviewCash").textContent=money(s.startCash);
 document.getElementById("overviewLockedCash").textContent=money(s.startLockedCash);
 document.getElementById("overviewMarket").textContent=money(s.startMarket);
 document.getElementById("overviewEmployeeStock").textContent=money(s.startEmployeeStock);
 document.getElementById("overviewInsurance").textContent=money(s.startInsuranceUsd*s.usdRate);
 document.getElementById("overviewNetWorth").textContent=money(baseStartNet());
 const cp=pmt(Math.max(0,data.car.price-data.car.downPayment),data.car.annualRate,data.car.loanYears*12);
 const hp=pmt(Math.max(0,data.house.price-data.house.downPayment),data.house.annualRate,data.house.loanYears*12);
 document.getElementById("overviewCarText").textContent=`${data.car.year}/${data.car.month}，頭期 ${money(data.car.downPayment)}，月付約 ${money(cp)}`;
 document.getElementById("overviewHouseText").textContent=`${data.house.year}/${data.house.month}，頭期與費用 ${money(data.house.downPayment+data.house.closingCost)}，月付約 ${money(hp)}`;
 const years=[2027,2030,2035,2040].filter(y=>y<=END_YEAR);
 document.getElementById("outlookList").innerHTML=years.map(y=>{const r=results.base.find(x=>x.year===y&&x.month===12);return `<div class="outlook-row"><span>${y} 年底</span><strong>${money(r.netWorth)}</strong></div>`}).join("");
 const homeRow=results.house.find(x=>x.year===data.house.year&&x.month===data.house.month);
 let text=`依目前基準規劃，${data.house.year} 年 ${data.house.month} 月套用買房計畫後，月底可直接動用現金預估為 ${money(homeRow.cash)}。`;
 if(homeRow.fundingWarning||homeRow.cash<0)text+=" 目前設定的可動用資產不足，系統會以負現金顯示缺口，建議延後購屋或調整頭期款來源。";
 else text+=` 仍可保留 ${money(Math.max(0,homeRow.cash))} 現金流。`;
 document.getElementById("advisorText").textContent=text;
}
function renderTimeline(){
 const r=rowFor(),base=rowFor("base");
 document.getElementById("selectedPeriod").textContent=`${selectedYear} 年 ${selectedMonth} 月底`;
 document.getElementById("netWorthValue").textContent=money(r.netWorth);
 document.getElementById("cashValue").textContent=money(r.cash);
 document.getElementById("lockedCashValue").textContent=money(r.lockedCash);
 document.getElementById("marketValue").textContent=money(r.market);
 document.getElementById("employeeStockValue").textContent=money(r.employee);
 document.getElementById("insuranceValue").textContent=money(r.insuranceValue);
 const d=r.netWorth-base.netWorth,delta=document.getElementById("scenarioDelta");
 if(carOn||houseOn){delta.classList.remove("hidden");delta.textContent=`較基準資產減少 ${money(Math.abs(Math.min(0,d)))}`;}else delta.classList.add("hidden");
 document.getElementById("incomeValue").textContent=signed(r.income);
 document.getElementById("monthlyExpenseValue").textContent=signed(-r.monthlyExpense);
 document.getElementById("annualExpenseValue").textContent=signed(-r.annualExpense);
 document.getElementById("marketContributionValue").textContent=signed(-r.marketContribution);
 document.getElementById("employeeContributionValue").textContent=signed(-r.employeeContribution);
 document.getElementById("insurancePremiumValue").textContent=signed(-r.insurancePremiumTwd);
 const planRow=document.getElementById("planCostRow");
 if(r.planCashFlow){planRow.classList.remove("hidden");document.getElementById("planCostValue").textContent=signed(-r.planCashFlow)}else planRow.classList.add("hidden");
 document.getElementById("carSwitchDescription").textContent=`${data.car.year}/${data.car.month} 起套用`;
 document.getElementById("houseSwitchDescription").textContent=`${data.house.year}/${data.house.month} 起套用`;
 renderMonths();renderDetails(r);
}
function renderMonths(){
 const rows=results[currentKey()].filter(r=>r.year===+selectedYear);
 document.getElementById("yearSelect").value=selectedYear;
 document.getElementById("monthList").innerHTML=rows.map(r=>`<button class="month-button ${r.month===+selectedMonth?"active":""}" data-month="${r.month}"><span>${r.month} 月底</span><strong>${money(r.netWorth)}</strong></button>`).join("");
 document.querySelectorAll(".month-button").forEach(b=>b.onclick=()=>{selectedMonth=+b.dataset.month;renderTimeline()});
}
function renderDetails(r){
 const startNet=r.start.cash+r.start.lockedCash+r.start.market+r.start.employee+r.start.insuranceTwd+r.start.carValue+r.start.houseValue-r.start.carDebt-r.start.houseDebt-data.settings.startDebt;
 document.getElementById("formulaText").textContent=`${money(startNet)} ＋ 本月淨變化 ${signed(r.netWorth-startNet)} ＝ ${money(r.netWorth)}`;
 const groups=[
  ["收入明細",r.incomeItems],
  ...(r.unlockedCash?[["資金解鎖",[{label:"暫不可動用轉為可直接動用",value:r.unlockedCash}]]]:[]),
  ["每月資金配置",[
   {label:"每月固定支出",value:-r.monthlyExpense},{label:"年度固定支出分攤",value:-r.annualExpense},
   {label:"台股與 ETF 投入",value:-r.marketContribution},{label:"公司認股投入",value:-r.employeeContribution},
   {label:"美元保單保費",value:-r.insurancePremiumTwd}
  ]],
  ["資產報酬",[
   {label:"台股與 ETF 損益",value:r.marketReturn},{label:"公司認股損益",value:r.employeeReturn},{label:"保單增值（換算 TWD）",value:r.insuranceReturnTwd}
  ]],
  ...(r.planItems.length?[["計畫與資金來源",r.planItems.map(x=>({label:x.label,value:-x.value}))]]:[]),
  ["月底資產與負債",[
   {label:"可直接動用現金",value:r.cash},{label:"暫不可動用現金",value:r.lockedCash},{label:"台股與 ETF",value:r.market},{label:"公司認股",value:r.employee},
   {label:`儲蓄險 ${r.insuranceUsd.toFixed(2)} USD`,value:r.insuranceValue},
   ...(r.carValue?[{label:"車輛價值",value:r.carValue},{label:"車貸餘額",value:-r.carDebt}]:[]),
   ...(r.houseValue?[{label:"房屋價值",value:r.houseValue},{label:"房貸餘額",value:-r.houseDebt}]:[]),
   ...(data.settings.startDebt?[{label:"其他負債",value:-data.settings.startDebt}]:[])
  ]]
 ];
 document.getElementById("detailGroups").innerHTML=groups.map(([title,items])=>`<div class="detail-group"><h3>${title}</h3>${items.map(i=>`<div class="detail-item"><span>${i.label}</span><strong>${signed(i.value)}</strong></div>`).join("")}</div>`).join("");
 document.getElementById("detailPanel").classList.toggle("hidden",!detailOpen);
 document.getElementById("toggleDetailBtn").textContent=detailOpen?"收合明細":"顯示更多";
}
function renderPlans(){
 const cp=pmt(Math.max(0,data.car.price-data.car.downPayment),data.car.annualRate,data.car.loanYears*12);
 const hp=pmt(Math.max(0,data.house.price-data.house.downPayment),data.house.annualRate,data.house.loanYears*12);
 document.getElementById("carMonthlyPaymentBadge").textContent=`月付 ${money(cp)}`;
 document.getElementById("houseMonthlyPaymentBadge").textContent=`月付 ${money(hp)}`;
}
function renderSettings(){
 document.getElementById("lockedCashPreview").textContent=`暫不可動用現金將於 ${data.settings.lockedCashYear} 年 ${data.settings.lockedCashMonth} 月底轉入可直接動用現金。`;
 document.getElementById("insuranceTwdPreview").textContent=`目前儲蓄險換算價值：約 ${money(data.settings.startInsuranceUsd*data.settings.usdRate)}`;
 const total=(data.settings.annualItems||[]).reduce((a,b)=>a+(+b.amount||0),0);
 document.getElementById("annualTotalValue").textContent=money(total);
 document.getElementById("annualMonthlyValue").textContent=money(total/12);
 renderAnnualItems();
}
function renderAnnualItems(){
 const list=document.getElementById("annualItemsList");
 list.innerHTML=(data.settings.annualItems||[]).map((it,i)=>`<div class="annual-item"><label>項目<input data-annual-name="${i}" value="${escapeHtml(it.name)}"></label><label>年度金額<input type="number" min="0" step="1000" data-annual-amount="${i}" value="${it.amount}"></label><button class="remove-item" data-remove-annual="${i}">刪除</button></div>`).join("");
 list.querySelectorAll("[data-annual-name]").forEach(el=>el.oninput=()=>{data.settings.annualItems[+el.dataset.annualName].name=el.value});
 list.querySelectorAll("[data-annual-amount]").forEach(el=>el.oninput=()=>{data.settings.annualItems[+el.dataset.annualAmount].amount=+el.value||0;renderSettings()});
 list.querySelectorAll("[data-remove-annual]").forEach(el=>el.onclick=()=>{data.settings.annualItems.splice(+el.dataset.removeAnnual,1);renderSettings()});
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}

const settingMap={
 startCashInput:"startCash",startLockedCashInput:"startLockedCash",lockedCashYearInput:"lockedCashYear",lockedCashMonthInput:"lockedCashMonth",startMarketInput:"startMarket",startEmployeeStockInput:"startEmployeeStock",startInsuranceUsdInput:"startInsuranceUsd",usdRateInput:"usdRate",startDebtInput:"startDebt",
 salaryInput:"salary",fixedExpenseInput:"fixedExpense",monthlyMarketInput:"monthlyMarket",marketReturnInput:"marketReturn",monthlyEmployeeInput:"monthlyEmployee",employeeReturnInput:"employeeReturn",
 insurancePremiumUsdInput:"insurancePremiumUsd",insuranceReturnInput:"insuranceReturn",bonusMonthsInput:"bonusMonths",bonusMonthInput:"bonusMonth",
 profitShare1Input:"profitShare1",profitShare1MonthInput:"profitShare1Month",profitShare2Input:"profitShare2",profitShare2MonthInput:"profitShare2Month"
};
const carMap={carPriceInput:"price",carYearInput:"year",carMonthInput:"month",carDownPaymentInput:"downPayment",carLoanYearsInput:"loanYears",carLoanRateInput:"annualRate",carMonthlyCostInput:"monthlyCost"};
const houseMap={housePriceInput:"price",houseYearInput:"year",houseMonthInput:"month",houseDownPaymentInput:"downPayment",houseLoanYearsInput:"loanYears",houseLoanRateInput:"annualRate",houseClosingCostInput:"closingCost",houseMonthlyCostInput:"monthlyCost"};
function fillForms(){
 Object.entries(settingMap).forEach(([id,k])=>document.getElementById(id).value=data.settings[k]);
 Object.entries(carMap).forEach(([id,k])=>document.getElementById(id).value=data.car[k]);
 Object.entries(houseMap).forEach(([id,k])=>document.getElementById(id).value=data.house[k]);
 document.getElementById("fundCashInput").checked=!!data.house.sources.cash;
 document.getElementById("fundMarketInput").checked=!!data.house.sources.market;
 document.getElementById("fundEmployeeInput").checked=!!data.house.sources.employee;
 document.getElementById("fundInsuranceInput").checked=!!data.house.sources.insurance;
}
function readSettings(){
 Object.entries(settingMap).forEach(([id,k])=>data.settings[k]=+document.getElementById(id).value||0);
}
function readPlans(){
 Object.entries(carMap).forEach(([id,k])=>data.car[k]=+document.getElementById(id).value||0);
 Object.entries(houseMap).forEach(([id,k])=>data.house[k]=+document.getElementById(id).value||0);
 data.house.sources={cash:document.getElementById("fundCashInput").checked,market:document.getElementById("fundMarketInput").checked,employee:document.getElementById("fundEmployeeInput").checked,insurance:document.getElementById("fundInsuranceInput").checked};
}
function goPage(page){
 document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id===page));
 document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
 scrollTo({top:0,behavior:"smooth"});
}

document.addEventListener("DOMContentLoaded",()=>{
 const years=Array.from({length:END_YEAR-START_YEAR+1},(_,i)=>START_YEAR+i);
 document.getElementById("yearSelect").innerHTML=years.map(y=>`<option>${y}</option>`).join("");
 document.getElementById("periodYearInput").innerHTML=years.map(y=>`<option>${y}</option>`).join("");
 document.getElementById("periodMonthInput").innerHTML=Array.from({length:12},(_,i)=>`<option value="${i+1}">${i+1} 月</option>`).join("");
 const planYears=Array.from({length:2060-START_YEAR+1},(_,i)=>START_YEAR+i);
 const planMonths=Array.from({length:12},(_,i)=>i+1);
 document.getElementById("carYearInput").innerHTML=planYears.map(y=>`<option value="${y}">${y} 年</option>`).join("");
 document.getElementById("houseYearInput").innerHTML=planYears.map(y=>`<option value="${y}">${y} 年</option>`).join("");
 document.getElementById("carMonthInput").innerHTML=planMonths.map(m=>`<option value="${m}">${m} 月</option>`).join("");
 document.getElementById("houseMonthInput").innerHTML=planMonths.map(m=>`<option value="${m}">${m} 月</option>`).join("");
 const unlockYears=Array.from({length:2060-2027+1},(_,i)=>2027+i);
 document.getElementById("lockedCashYearInput").innerHTML=unlockYears.map(y=>`<option value="${y}">${y} 年</option>`).join("");
 document.getElementById("lockedCashMonthInput").innerHTML=planMonths.map(m=>`<option value="${m}">${m} 月底</option>`).join("");
 fillForms();recalc();

 document.querySelectorAll(".nav-item").forEach(b=>b.onclick=()=>goPage(b.dataset.page));
 document.querySelectorAll("[data-page-jump]").forEach(b=>b.onclick=()=>goPage(b.dataset.pageJump));
 document.getElementById("quickSettingsBtn").onclick=()=>goPage("settingsPage");
 document.getElementById("carToggle").onchange=e=>{carOn=e.target.checked;renderTimeline()};
 document.getElementById("houseToggle").onchange=e=>{houseOn=e.target.checked;renderTimeline()};
 document.getElementById("toggleDetailBtn").onclick=()=>{detailOpen=!detailOpen;renderTimeline()};
 document.getElementById("yearSelect").onchange=e=>{selectedYear=+e.target.value;renderTimeline()};
 document.getElementById("periodBtn").onclick=()=>{document.getElementById("periodYearInput").value=selectedYear;document.getElementById("periodMonthInput").value=selectedMonth;document.getElementById("periodDialog").showModal()};
 document.getElementById("applyPeriodBtn").onclick=()=>{selectedYear=+document.getElementById("periodYearInput").value;selectedMonth=+document.getElementById("periodMonthInput").value;setTimeout(renderTimeline,0)};
 document.getElementById("addAnnualItemBtn").onclick=()=>{data.settings.annualItems.push({name:"新年度項目",amount:0});renderSettings()};
 const saveSettingsHandler=()=>{readSettings();save();fillForms();recalc()};
 document.getElementById("saveSettingsTop").onclick=saveSettingsHandler;
 document.getElementById("saveSettingsBottom").onclick=saveSettingsHandler;
 const savePlansHandler=()=>{readPlans();save();fillForms();recalc()};
 document.getElementById("savePlansTop").onclick=savePlansHandler;
 document.getElementById("savePlansBottom").onclick=savePlansHandler;
 document.getElementById("usdRateInput").oninput=()=>{const usd=+document.getElementById("startInsuranceUsdInput").value||0,rate=+document.getElementById("usdRateInput").value||0;document.getElementById("insuranceTwdPreview").textContent=`目前儲蓄險換算價值：約 ${money(usd*rate)}`};
 document.getElementById("startInsuranceUsdInput").oninput=document.getElementById("usdRateInput").oninput;
 const updateLockedPreview=()=>{document.getElementById("lockedCashPreview").textContent=`暫不可動用現金將於 ${document.getElementById("lockedCashYearInput").value} 年 ${document.getElementById("lockedCashMonthInput").value} 月底轉入可直接動用現金。`};
 document.getElementById("lockedCashYearInput").onchange=updateLockedPreview;
 document.getElementById("lockedCashMonthInput").onchange=updateLockedPreview;
 if("serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js");
});
