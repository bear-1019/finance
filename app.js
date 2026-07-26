
const STORAGE_KEY = "future-ledger-v1";
const START_YEAR = 2026;
const END_YEAR = 2045;

const defaultData = {
  settings: {
    startCash: 650000,
    startInvestment: 480000,
    startInsurance: 320000,
    salary: 62000,
    fixedExpense: 28000,
    monthlyInvestment: 18000,
    annualReturnRate: 6,
    insurancePremium: 5000,
    bonusMonths: 1.5,
    bonusMonth: 1,
    profitShare: 160000,
    profitShareMonth: 8
  },
  car: {
    price: 1800000, year: 2028, month: 7, downPayment: 500000,
    loanYears: 5, annualRate: 2.2, monthlyCost: 6500, depreciation: 15
  },
  house: {
    price: 15000000, year: 2032, month: 7, downPayment: 3000000,
    loanYears: 40, annualRate: 2.2, closingCost: 900000,
    monthlyCost: 6000, rentOffset: 15000, appreciation: 2
  }
};

let data = loadData();
let selectedScenario = "base";
let selectedYear = 2026;
let selectedMonth = 7;
let allResults = {};

function loadData(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || structuredClone(defaultData); }
  catch { return structuredClone(defaultData); }
}
function saveData(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
function money(value){ return "NT$ " + Math.round(value).toLocaleString("zh-TW"); }
function signedMoney(value){ return `${value >= 0 ? "+" : "−"}NT$ ${Math.abs(Math.round(value)).toLocaleString("zh-TW")}`; }
function pmt(principal, annualRate, months){
  if (months <= 0) return 0;
  const r = annualRate / 100 / 12;
  if (r === 0) return principal / months;
  return principal * r * Math.pow(1+r, months) / (Math.pow(1+r, months)-1);
}
function monthIndex(year, month){ return (year - START_YEAR) * 12 + (month - 1); }

function calculateScenario(scenario){
  const s = data.settings;
  let cash = s.startCash;
  let investment = s.startInvestment;
  let insurance = s.startInsurance;
  let carValue = 0, carDebt = 0, houseValue = 0, houseDebt = 0;
  const rows = [];
  const monthlyReturn = s.annualReturnRate / 100 / 12;

  const carLoanPrincipal = Math.max(0, data.car.price - data.car.downPayment);
  const carLoanMonths = data.car.loanYears * 12;
  const carPayment = pmt(carLoanPrincipal, data.car.annualRate, carLoanMonths);
  const carStartIndex = monthIndex(data.car.year, data.car.month);

  const houseLoanPrincipal = Math.max(0, data.house.price - data.house.downPayment);
  const houseLoanMonths = data.house.loanYears * 12;
  const housePayment = pmt(houseLoanPrincipal, data.house.annualRate, houseLoanMonths);
  const houseStartIndex = monthIndex(data.house.year, data.house.month);

  for(let year = START_YEAR; year <= END_YEAR; year++){
    for(let month = 1; month <= 12; month++){
      const idx = monthIndex(year, month);
      const startCash = cash, startInvestment = investment, startInsurance = insurance;
      const startCarValue = carValue, startCarDebt = carDebt, startHouseValue = houseValue, startHouseDebt = houseDebt;
      const incomeItems = [{label:"月薪", value:s.salary}];
      if(month === Number(s.bonusMonth)) incomeItems.push({label:"年終獎金", value:s.salary * s.bonusMonths});
      if(month === Number(s.profitShareMonth)) incomeItems.push({label:"年度分紅", value:s.profitShare});
      const income = incomeItems.reduce((a,b)=>a+b.value,0);

      const expenseItems = [{label:"固定生活支出", value:s.fixedExpense}];
      let scenarioPayment = 0;
      let scenarioLabel = "";
      let scenarioItems = [];

      const carEnabled = scenario === "car" || scenario === "both";
      const houseEnabled = scenario === "house" || scenario === "both";

      if(carEnabled && idx === carStartIndex){
        cash -= data.car.downPayment;
        carValue = data.car.price;
        carDebt = carLoanPrincipal;
        scenarioItems.push({label:"汽車頭期款", value:data.car.downPayment});
      }
      if(carEnabled && idx >= carStartIndex){
        const elapsed = idx - carStartIndex;
        if(elapsed < carLoanMonths && carDebt > 0){
          const monthlyRate = data.car.annualRate / 100 / 12;
          const interest = carDebt * monthlyRate;
          const principalPaid = Math.min(carDebt, Math.max(0, carPayment - interest));
          carDebt -= principalPaid;
          scenarioPayment += carPayment;
          scenarioItems.push({label:"車貸", value:carPayment});
        }
        scenarioPayment += data.car.monthlyCost;
        scenarioItems.push({label:"車輛持有成本", value:data.car.monthlyCost});
        carValue *= Math.pow(1 - data.car.depreciation / 100, 1/12);
        scenarioLabel = "買車方案支出";
      }

      if(houseEnabled && idx === houseStartIndex){
        cash -= data.house.downPayment + data.house.closingCost;
        houseValue = data.house.price;
        houseDebt = houseLoanPrincipal;
        scenarioItems.push({label:"房屋頭期款", value:data.house.downPayment});
        scenarioItems.push({label:"裝潢與交易費", value:data.house.closingCost});
      }
      if(houseEnabled && idx >= houseStartIndex){
        const elapsed = idx - houseStartIndex;
        if(elapsed < houseLoanMonths && houseDebt > 0){
          const monthlyRate = data.house.annualRate / 100 / 12;
          const interest = houseDebt * monthlyRate;
          const principalPaid = Math.min(houseDebt, Math.max(0, housePayment - interest));
          houseDebt -= principalPaid;
          scenarioPayment += housePayment;
          scenarioItems.push({label:"房貸", value:housePayment});
        }
        scenarioPayment += data.house.monthlyCost;
        scenarioPayment -= data.house.rentOffset;
        scenarioItems.push({label:"房屋持有成本", value:data.house.monthlyCost});
        scenarioItems.push({label:"停止租屋節省", value:-data.house.rentOffset});
        houseValue *= Math.pow(1 + data.house.appreciation / 100, 1/12);
        scenarioLabel = scenarioLabel ? "買車＋買房支出" : "買房方案支出";
      }

      const investmentReturn = investment * monthlyReturn;
      investment += investmentReturn + s.monthlyInvestment;
      insurance += s.insurancePremium;
      cash += income - s.fixedExpense - s.monthlyInvestment - s.insurancePremium - scenarioPayment;

      const assets = cash + investment + insurance + carValue + houseValue;
      const debts = carDebt + houseDebt;
      const netWorth = assets - debts;

      rows.push({
        year, month, idx,
        startCash, startInvestment, startInsurance, startCarValue, startHouseValue, startCarDebt, startHouseDebt,
        income, incomeItems,
        expense: s.fixedExpense, expenseItems,
        investmentContribution: s.monthlyInvestment,
        insurancePremium: s.insurancePremium,
        investmentReturn,
        scenarioPayment, scenarioLabel, scenarioItems,
        cash, investment, insurance, carValue, houseValue, carDebt, houseDebt, assets, debts, netWorth
      });
    }
  }
  return rows;
}

function recalc(){
  allResults = {
    base: calculateScenario("base"),
    car: calculateScenario("car"),
    house: calculateScenario("house"),
    both: calculateScenario("both")
  };
  render();
}
function currentRow(scenario = selectedScenario){
  return allResults[scenario].find(r => r.year === Number(selectedYear) && r.month === Number(selectedMonth));
}
function render(){
  const row = currentRow();
  const base = currentRow("base");
  document.getElementById("selectedPeriod").textContent = `${selectedYear} 年 ${selectedMonth} 月`;
  document.getElementById("netWorthValue").textContent = money(row.netWorth);
  document.getElementById("cashValue").textContent = money(row.cash);
  document.getElementById("investmentValue").textContent = money(row.investment);
  document.getElementById("insuranceValue").textContent = money(row.insurance);
  document.getElementById("debtValue").textContent = money(row.debts);

  const delta = row.netWorth - base.netWorth;
  const deltaEl = document.getElementById("scenarioDelta");
  deltaEl.textContent = selectedScenario === "base" ? "與基準相同" : `較基準 ${signedMoney(delta)}`;
  deltaEl.className = `delta ${delta > 0 ? "positive" : delta < 0 ? "negative" : "neutral"}`;

  document.getElementById("incomeValue").textContent = signedMoney(row.income);
  document.getElementById("expenseValue").textContent = signedMoney(-row.expense);
  document.getElementById("investContributionValue").textContent = signedMoney(-row.investmentContribution);
  document.getElementById("investmentReturnValue").textContent = signedMoney(row.investmentReturn);

  const scenarioRow = document.getElementById("scenarioPaymentRow");
  if(row.scenarioPayment !== 0 || row.scenarioItems.length){
    scenarioRow.classList.remove("hidden");
    document.getElementById("scenarioPaymentLabel").textContent = row.scenarioLabel || "方案支出";
    document.getElementById("scenarioPaymentValue").textContent = signedMoney(-row.scenarioPayment);
  } else scenarioRow.classList.add("hidden");

  document.getElementById("formulaText").textContent =
    `${money(row.startCash + row.startInvestment + row.startInsurance + row.startCarValue + row.startHouseValue - row.startCarDebt - row.startHouseDebt)}`
    + ` ＋ 本月淨變化 ${signedMoney(row.netWorth - (row.startCash + row.startInvestment + row.startInsurance + row.startCarValue + row.startHouseValue - row.startCarDebt - row.startHouseDebt))}`
    + ` ＝ ${money(row.netWorth)}`;

  renderDetails(row);
  renderTimeline();
  renderPlans();
}
function renderDetails(row){
  const groups = [
    ["收入明細", row.incomeItems],
    ["支出明細", [...row.expenseItems, {label:"投資投入", value:row.investmentContribution}, {label:"儲蓄險保費", value:row.insurancePremium}]],
    ["投資變化", [{label:"月初投資資產", value:row.startInvestment},{label:"本月投入", value:row.investmentContribution},{label:"本月投資損益", value:row.investmentReturn},{label:"月底投資資產", value:row.investment}]],
    ["資產與負債", [
      {label:"現金", value:row.cash},{label:"投資資產", value:row.investment},{label:"儲蓄險價值", value:row.insurance},
      ...(row.carValue ? [{label:"車輛價值", value:row.carValue}] : []),
      ...(row.houseValue ? [{label:"房屋價值", value:row.houseValue}] : []),
      ...(row.carDebt ? [{label:"車貸餘額", value:-row.carDebt}] : []),
      ...(row.houseDebt ? [{label:"房貸餘額", value:-row.houseDebt}] : [])
    ]]
  ];
  if(row.scenarioItems.length) groups.splice(2,0,["方案支出明細",row.scenarioItems]);
  document.getElementById("detailGroups").innerHTML = groups.map(([title,items]) => `
    <div class="detail-group">
      <header><strong>${title}</strong></header>
      ${items.map(item=>`<div class="detail-item"><span>${item.label}</span><strong>${signedMoney(item.value)}</strong></div>`).join("")}
    </div>`).join("");
}
function renderTimeline(){
  document.getElementById("yearSelect").value = selectedYear;
  const months = allResults[selectedScenario].filter(r => r.year === Number(selectedYear));
  const max = Math.max(...months.map(r=>Math.abs(r.netWorth)),1);
  document.getElementById("monthTimeline").innerHTML = months.map(r => `
    <button class="month-dot ${r.month === Number(selectedMonth) ? "active":""}" data-month="${r.month}" title="${r.month}月 ${money(r.netWorth)}">
      <span>${r.month}</span>
      <i style="height:${Math.max(18, Math.abs(r.netWorth)/max*78)}px"></i>
    </button>`).join("");
  document.querySelectorAll(".month-dot").forEach(btn=>btn.addEventListener("click",()=>{
    selectedMonth = Number(btn.dataset.month); render();
  }));
}
function renderPlans(){
  const carPayment = pmt(Math.max(0,data.car.price-data.car.downPayment),data.car.annualRate,data.car.loanYears*12);
  document.getElementById("carPlanText").textContent =
    `${data.car.year}/${data.car.month} 購買，頭期 ${money(data.car.downPayment)}，月付約 ${money(carPayment)}`;
  const housePayment = pmt(Math.max(0,data.house.price-data.house.downPayment),data.house.annualRate,data.house.loanYears*12);
  document.getElementById("housePlanText").textContent =
    `${data.house.year}/${data.house.month} 購買，頭期 ${money(data.house.downPayment)}，月付約 ${money(housePayment)}`;
}

function populateControls(){
  const years = Array.from({length:END_YEAR-START_YEAR+1},(_,i)=>START_YEAR+i);
  document.getElementById("yearSelect").innerHTML = years.map(y=>`<option>${y}</option>`).join("");
  document.getElementById("periodYearInput").innerHTML = years.map(y=>`<option>${y}</option>`).join("");
  document.getElementById("periodMonthInput").innerHTML = Array.from({length:12},(_,i)=>`<option value="${i+1}">${i+1} 月</option>`).join("");
}
function fillSettings(){
  const s=data.settings;
  const map={startCashInput:"startCash",startInvestmentInput:"startInvestment",startInsuranceInput:"startInsurance",salaryInput:"salary",fixedExpenseInput:"fixedExpense",monthlyInvestmentInput:"monthlyInvestment",returnRateInput:"annualReturnRate",insurancePremiumInput:"insurancePremium",bonusMonthsInput:"bonusMonths",bonusMonthInput:"bonusMonth",profitShareInput:"profitShare",profitShareMonthInput:"profitShareMonth"};
  Object.entries(map).forEach(([id,key])=>document.getElementById(id).value=s[key]);
}
function readSettings(){
  const map={startCashInput:"startCash",startInvestmentInput:"startInvestment",startInsuranceInput:"startInsurance",salaryInput:"salary",fixedExpenseInput:"fixedExpense",monthlyInvestmentInput:"monthlyInvestment",returnRateInput:"annualReturnRate",insurancePremiumInput:"insurancePremium",bonusMonthsInput:"bonusMonths",bonusMonthInput:"bonusMonth",profitShareInput:"profitShare",profitShareMonthInput:"profitShareMonth"};
  Object.entries(map).forEach(([id,key])=>data.settings[key]=Number(document.getElementById(id).value)||0);
}
function openPlan(type){
  document.getElementById("planTypeInput").value=type;
  document.getElementById("planDialogTitle").textContent=type==="car"?"買車方案":"買房方案";
  document.getElementById("carFields").classList.toggle("hidden",type!=="car");
  document.getElementById("houseFields").classList.toggle("hidden",type!=="house");
  if(type==="car"){
    const c=data.car;
    [["carPriceInput","price"],["carYearInput","year"],["carMonthInput","month"],["carDownPaymentInput","downPayment"],["carLoanYearsInput","loanYears"],["carLoanRateInput","annualRate"],["carMonthlyCostInput","monthlyCost"],["carDepreciationInput","depreciation"]].forEach(([id,k])=>document.getElementById(id).value=c[k]);
  }else{
    const h=data.house;
    [["housePriceInput","price"],["houseYearInput","year"],["houseMonthInput","month"],["houseDownPaymentInput","downPayment"],["houseLoanYearsInput","loanYears"],["houseLoanRateInput","annualRate"],["houseClosingCostInput","closingCost"],["houseMonthlyCostInput","monthlyCost"],["houseRentOffsetInput","rentOffset"],["houseAppreciationInput","appreciation"]].forEach(([id,k])=>document.getElementById(id).value=h[k]);
  }
  document.getElementById("planDialog").showModal();
}
function savePlan(){
  const type=document.getElementById("planTypeInput").value;
  if(type==="car"){
    const map=[["carPriceInput","price"],["carYearInput","year"],["carMonthInput","month"],["carDownPaymentInput","downPayment"],["carLoanYearsInput","loanYears"],["carLoanRateInput","annualRate"],["carMonthlyCostInput","monthlyCost"],["carDepreciationInput","depreciation"]];
    map.forEach(([id,k])=>data.car[k]=Number(document.getElementById(id).value)||0);
  }else{
    const map=[["housePriceInput","price"],["houseYearInput","year"],["houseMonthInput","month"],["houseDownPaymentInput","downPayment"],["houseLoanYearsInput","loanYears"],["houseLoanRateInput","annualRate"],["houseClosingCostInput","closingCost"],["houseMonthlyCostInput","monthlyCost"],["houseRentOffsetInput","rentOffset"],["houseAppreciationInput","appreciation"]];
    map.forEach(([id,k])=>data.house[k]=Number(document.getElementById(id).value)||0);
  }
  saveData(); recalc();
}

document.addEventListener("DOMContentLoaded",()=>{
  populateControls();
  recalc();

  document.querySelectorAll(".scenario-chip").forEach(btn=>btn.addEventListener("click",()=>{
    document.querySelectorAll(".scenario-chip").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    selectedScenario=btn.dataset.scenario; render();
  }));
  document.getElementById("toggleDetailBtn").addEventListener("click",e=>{
    const panel=document.getElementById("detailPanel");
    panel.classList.toggle("hidden");
    const open=!panel.classList.contains("hidden");
    e.currentTarget.textContent=open?"收合明細":"顯示更多";
    e.currentTarget.setAttribute("aria-expanded",String(open));
  });
  document.getElementById("yearSelect").addEventListener("change",e=>{selectedYear=Number(e.target.value);render();});
  document.getElementById("periodBtn").addEventListener("click",()=>{
    document.getElementById("periodYearInput").value=selectedYear;
    document.getElementById("periodMonthInput").value=selectedMonth;
    document.getElementById("periodDialog").showModal();
  });
  document.getElementById("applyPeriodBtn").addEventListener("click",()=>{
    selectedYear=Number(document.getElementById("periodYearInput").value);
    selectedMonth=Number(document.getElementById("periodMonthInput").value);
    setTimeout(render,0);
  });
  document.getElementById("settingsBtn").addEventListener("click",()=>{fillSettings();document.getElementById("settingsDialog").showModal();});
  document.getElementById("saveSettingsBtn").addEventListener("click",()=>{readSettings();saveData();setTimeout(recalc,0);});
  document.querySelectorAll("[data-edit-plan]").forEach(btn=>btn.addEventListener("click",()=>openPlan(btn.dataset.editPlan)));
  document.getElementById("savePlanBtn").addEventListener("click",()=>{savePlan();});
  if("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js");
});
