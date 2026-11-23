// dashboard.js — a company sees its requests, finalizes contracts and tracks payouts.

const slug = getParam("company", "/dashboard/"); // null = show every company's requests
let lastSignature = "";

async function init() {
  if (slug) {
    try {
      const { company } = await api.getCompany(slug);
      const link = location.origin + "/c/" + company.slug;
      $("dashTitle").textContent = company.name;
      $("dashLink").innerHTML = `Your customer link: <a href="${esc(link)}">${esc(link)}</a>
        <button class="btn btn-ghost" type="button" id="copyLink" style="padding:0.3rem 0.7rem">Copy</button>`;
      $("copyLink").addEventListener("click", () => navigator.clipboard.writeText(link).then(() => toast("Link copied")));
    } catch (e) {
      toast("Company not found", true);
    }
  }
  load();
}

async function load(force) {
  // Don't redraw while someone is typing a price, or their input would be wiped.
  if (!force && document.activeElement && document.activeElement.closest(".contract-form")) return;
  try {
    const { jobs, stats } = await api.listJobs(slug);
    $("sRequests").textContent = stats.requests;
    $("sContracts").textContent = stats.contracts;
    $("sPaid").textContent = stats.paid;
    $("sRevenue").textContent = money(stats.repairRevenue);
    $("sPayout").textContent = money(stats.companyPayout);
    $("sDelta").textContent = stats.avgDeltaPct === null ? "–" : (stats.avgDeltaPct > 0 ? "+" : "") + stats.avgDeltaPct + "%";

    const signature = jobs.map((j) => j.id + j.status).join(",");
    if (!force && signature === lastSignature) return; // nothing new
    lastSignature = signature;

    $("jobs").innerHTML = jobs.length
      ? jobs.map(jobCard).join("")
      : `<div class="card muted">No requests yet. ${slug ? "Share your link /c/" + esc(slug) + " with customers." : "Submit one from the quote page."}</div>`;
    jobs.forEach(wireJob);
  } catch (e) {
    $("jobs").innerHTML = `<div class="notice error">${esc(e.message)}</div>`;
  }
}

function statusBadge(status) {
  if (status === "paid") return '<span class="badge good">Paid</span>';
  if (status === "contract_sent") return '<span class="badge">Contract sent</span>';
  return '<span class="badge grey">New request</span>';
}

function jobCard(j) {
  const e = j.estimate || {};
  const p = e.price || {};
  const d = j.detection || {};
  const mid = Math.round(((p.low || 0) + (p.high || 0)) / 2);
  const fee = (j.quoteFeePreview && j.quoteFeePreview.fee) || 25;

  let action = "";
  if (j.status === "requested") {
    action = `
      <div class="contract-form mt-1">
        <div class="row">
          <div style="flex:1;min-width:140px"><label class="mt-0">Repair price $</label><input type="number" id="price-${j.id}" value="${mid}"></div>
          <div style="flex:2;min-width:200px"><label class="mt-0">Note to homeowner</label><input type="text" id="note-${j.id}" placeholder="Install next week, includes trim"></div>
        </div>
        <p class="muted mt-1" id="total-${j.id}">Homeowner pays ${money(mid + fee)} (incl. ${money(fee)} quote fee)</p>
        <button class="btn btn-primary" type="button" id="send-${j.id}">Finalize contract</button>
      </div>`;
  } else if (j.status === "contract_sent") {
    action = `<p class="notice info mt-1">Waiting for the homeowner to pay ${money(j.contract.total)}.</p>`;
  } else if (j.status === "paid") {
    const b = j.billing;
    action = `<p class="notice ok mt-1">Paid ${money(b.total)} · Your payout ${money(b.companyPayout)} · SnapQuote commission ${money(b.platformCommission)}</p>`;
  }

  return `
    <article class="card">
      <div class="job">
        <div>
          <div class="thumbs">
            <img src="${j.before}" alt="Before">
            ${j.after ? `<img src="${j.after}" alt="After">` : ""}
          </div>
          <p class="muted">Before / After</p>
        </div>
        <div>
          <div class="row spread">
            <b>#${esc(j.id)} · ${esc(d.item_label)} → ${esc(j.option && j.option.name)}</b>
            <span>${statusBadge(j.status)} <span class="badge grey">${esc(j.region)}</span></span>
          </div>
          <p class="muted">${esc(j.customer.name)} · ${esc(j.customer.email)} · ${new Date(j.createdAt).toLocaleString()}</p>
          <p>Feasibility <b>${e.feasibility_score}/10</b> · Estimate <b>${money(p.low)} – ${money(p.high)}</b> · ${e.timeline_days} day(s)</p>
          <p class="muted">${esc(e.rationale)}</p>
          <ul>${(e.scope || []).map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
          ${action}
        </div>
      </div>
    </article>`;
}

// Hooks up the price box and button of one job card.
function wireJob(j) {
  if (j.status !== "requested") return;
  const fee = (j.quoteFeePreview && j.quoteFeePreview.fee) || 25;
  const priceInput = $("price-" + j.id);
  priceInput.addEventListener("input", () => {
    const repair = Number(priceInput.value) || 0;
    $("total-" + j.id).textContent = "Homeowner pays " + money(repair + fee) + " (incl. " + money(fee) + " quote fee)";
  });
  $("send-" + j.id).addEventListener("click", async (event) => {
    const btn = event.currentTarget;
    setBusy(btn, true, "Sending…");
    try {
      await api.finalizeContract(j.id, Number(priceInput.value), $("note-" + j.id).value.trim());
      toast("Contract sent to the homeowner");
      document.activeElement.blur();
      load(true);
    } catch (e) {
      toast(e.message, true);
      setBusy(btn, false);
    }
  });
}

$("refreshBtn").addEventListener("click", () => load(true));
init();
setInterval(load, 10000);
