// companies.js — savings calculator, company sign-up and the list of companies.

// Pricing comes from the backend so the page always matches config.js there.
let pricing = { companyPlanFee: 1200, platformCommissionPct: 20, quoteFee: 25 };

// ---------- Savings calculator ----------
// Same assumptions as the pitch doc:
//  - SnapQuote requests close at about 67% (homeowners already saw the price and preview)
//  - 25% of requests still need a short site check
//  - each online request takes 15 minutes to review at $53/hour
//  - the company keeps (100 - commission)% of a ~$22 average quote fee
function calculate() {
  const jobs = Number($("jobs").value) || 0;
  const closeRate = (Number($("closeRate").value) || 1) / 100;
  const visitCost = Number($("visitCost").value) || 0;

  const visits = jobs / closeRate;
  const inspection = visits * visitCost;

  const requests = jobs / 0.67;
  const siteChecks = requests * 0.25 * visitCost;
  const review = requests * 0.25 * 53;
  const feeShare = jobs * 22 * (1 - pricing.platformCommissionPct / 100);
  const snap = pricing.companyPlanFee + siteChecks + review - feeShare;

  const saving = inspection - snap;
  $("visits").textContent = Math.round(visits);
  $("inspectionCost").textContent = money(Math.round(inspection));
  $("snapCost").textContent = money(Math.round(snap));
  $("saving").textContent = money(Math.round(saving));
  $("savingPct").textContent = inspection > 0 ? "(" + Math.round((saving / inspection) * 100) + "% less)" : "";
  $("payback").textContent = visitCost > 0
    ? "The plan pays for itself after " + Math.ceil(pricing.companyPlanFee / visitCost) + " avoided visits."
    : "";
}
["jobs", "closeRate", "visitCost"].forEach((id) => $(id).addEventListener("input", calculate));

// ---------- Sign-up ----------
$("signupForm").addEventListener("submit", async (event) => {
  event.preventDefault(); // stop the browser reloading the page
  const btn = $("signupBtn");
  const trades = [...document.querySelectorAll("#trades input:checked")].map((c) => c.value);
  setBusy(btn, true, "Creating…");
  try {
    const { company } = await api.createCompany({
      name: $("coName").value.trim(),
      city: $("coCity").value.trim(),
      email: $("coEmail").value.trim(),
      trades,
    });
    const link = location.origin + "/c/" + company.slug;
    $("signupDone").innerHTML = `
      <b>${esc(company.name)} is live.</b> Send customers this link instead of booking an inspection:
      <div class="row mt-1">
        <input type="text" value="${esc(link)}" readonly id="newLink">
        <button class="btn btn-ghost" type="button" id="copyBtn">Copy</button>
        <a class="btn btn-dark" href="/dashboard?company=${encodeURIComponent(company.slug)}">Open dashboard</a>
      </div>`;
    $("signupDone").classList.remove("hidden");
    $("copyBtn").addEventListener("click", () => {
      navigator.clipboard.writeText(link).then(() => toast("Link copied"));
    });
    loadCompanies();
  } catch (e) {
    toast(e.message, true);
  }
  setBusy(btn, false);
});

// ---------- Company list ----------
async function loadCompanies() {
  try {
    const { companies } = await api.listCompanies();
    $("companyList").innerHTML = companies.length
      ? "<tr><th>Company</th><th>City</th><th>Customer link</th><th></th></tr>" +
        companies.map((c) => `
          <tr>
            <td><b>${esc(c.name)}</b></td>
            <td>${esc(c.city)}</td>
            <td><a href="/c/${encodeURIComponent(c.slug)}">/c/${esc(c.slug)}</a></td>
            <td><a href="/dashboard?company=${encodeURIComponent(c.slug)}">Dashboard</a></td>
          </tr>`).join("")
      : '<tr><td class="muted">No companies yet. Be the first.</td></tr>';
  } catch (e) {
    $("companyList").innerHTML = `<tr><td class="notice error">${esc(e.message)}</td></tr>`;
  }
}

async function init() {
  calculate();
  try {
    const cfg = await api.config();
    pricing = cfg.pricing;
    $("planLine").textContent = money(pricing.companyPlanFee) + "/month plan + you keep " +
      (100 - pricing.platformCommissionPct) + "% of every quote fee.";
    calculate();
  } catch (e) {
    /* keep the defaults */
  }
  loadCompanies();
}
init();
