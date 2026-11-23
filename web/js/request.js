// request.js — the homeowner tracks a request: requested → contract sent → paid.

const jobId = getParam("id", "/request/");
let lastStatus = null;

async function load() {
  if (!jobId) {
    $("statusCard").innerHTML = '<p class="notice error">No request id in the link.</p>';
    return;
  }
  try {
    const { job } = await api.getJob(jobId);
    $("jobId").textContent = "#" + job.id;
    if (job.status !== lastStatus) render(job); // only redraw when something changed
    lastStatus = job.status;
  } catch (e) {
    $("statusCard").innerHTML = `<p class="notice error">${esc(e.message)}</p>`;
  }
}

function render(job) {
  const company = (job.company && job.company.name) || (job.contract && job.contract.company) || "the company";
  const card = $("statusCard");

  if (job.status === "requested") {
    card.innerHTML = `
      <span class="badge grey">Request sent</span>
      <h2 class="mt-1">Sent to ${esc(company)}</h2>
      <p>They will review your pictured plan and send a contract. Nothing to pay yet.</p>
      <p class="muted">Quote fee if you go ahead: ${money(job.quoteFeePreview.fee)}</p>`;
  }

  if (job.status === "contract_sent") {
    const c = job.contract;
    card.innerHTML = `
      <span class="badge">Contract ready</span>
      <h2 class="mt-1">${esc(c.company)} sent your contract</h2>
      ${c.note ? `<p class="muted">"${esc(c.note)}"</p>` : ""}
      <table>
        <tr><td>Repair price</td><td>${money(c.repairPrice)}</td></tr>
        <tr><td>Quote fee ${c.discountPct > 0 ? `<span class="badge good">−${c.discountPct}% loyalty</span>` : ""}</td><td>${money(c.quoteFee)}</td></tr>
        <tr><th>Total</th><th>${money(c.total)}</th></tr>
      </table>
      <button class="btn btn-primary btn-lg mt-1" id="payBtn" type="button">Accept &amp; pay ${money(c.total)}</button>
      <p class="muted mt-1">Demo mode: no card is charged.</p>`;
    $("payBtn").addEventListener("click", pay);
  }

  if (job.status === "paid") {
    const b = job.billing;
    card.innerHTML = `
      <div class="notice ok"><b>Paid.</b> ${esc(company)} will schedule your repair.</div>
      <table class="mt-1">
        <tr><td>Repair</td><td>${money(b.repairPrice)}</td></tr>
        <tr><td>Quote fee</td><td>${money(b.quoteFee)}</td></tr>
        <tr><th>Total paid</th><th>${money(b.total)}</th></tr>
      </table>
      ${job.nextQuoteFee ? `<p class="mt-1">Your next quote fee: <b>${money(job.nextQuoteFee.fee)}</b> <span class="badge good">loyalty discount</span></p>` : ""}`;
  }

  // The plan the homeowner sent (photos + estimate)
  const e = job.estimate || {};
  const p = e.price || {};
  $("thumbs").innerHTML = `<img src="${job.before}" alt="Before">` + (job.after ? `<img src="${job.after}" alt="After">` : "");
  $("planText").innerHTML = `
    <p class="mt-0"><b>${esc(job.detection.item_label)} → ${esc(job.option && job.option.name)}</b></p>
    <p class="muted">Estimate ${money(p.low)} – ${money(p.high)} · feasibility ${e.feasibility_score}/10 · ${esc(job.region)}</p>`;
  $("planCard").classList.remove("hidden");
}

async function pay() {
  const btn = $("payBtn");
  setBusy(btn, true, "Paying…");
  try {
    const { job } = await api.payContract(jobId);
    lastStatus = job.status;
    render(job);
    toast("Payment confirmed");
  } catch (e) {
    toast(e.message, true);
    setBusy(btn, false);
  }
}

load();
setInterval(load, 10000);
