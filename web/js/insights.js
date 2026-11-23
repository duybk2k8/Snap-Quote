// insights.js — shows what SnapQuote has learned from paid jobs (the data moat).

async function load() {
  try {
    const data = await api.insights();
    const t = data.totals;
    $("tRequests").textContent = t.requests;
    $("tContracts").textContent = t.contracts;
    $("tPaid").textContent = t.paid;
    $("tConversion").textContent = t.conversionPct + "%";
    $("tRecords").textContent = t.learningRecords;

    $("calibCaption").textContent = "Every paid job teaches SnapQuote the real local price. After " +
      data.minSamples + " jobs, new estimates in that area adjust automatically.";

    // Table: one row per item type + region
    $("calibTable").innerHTML = data.calibration.length
      ? "<tr><th>Item</th><th>Area</th><th>Paid jobs</th><th>Correction</th><th></th></tr>" +
        data.calibration.map((c) => {
          const pct = Math.round((c.factor - 1) * 100);
          const status = c.active
            ? '<span class="badge good">Active</span>'
            : `<span class="badge grey">Learning (${c.samples}/${data.minSamples})</span>`;
          return `<tr><td>${esc(c.item_type)}</td><td>${esc(c.region)}</td><td>${c.samples}</td>
                  <td>${pct > 0 ? "+" : ""}${pct}%</td><td>${status}</td></tr>`;
        }).join("")
      : '<tr><td class="muted">No completed jobs yet.</td></tr>';

    // Bars: width = completed jobs compared with the most popular option
    const max = Math.max(1, ...data.options.map((o) => o.completed));
    $("bars").innerHTML = data.options.length
      ? data.options.map((o) => `
          <div class="bar-row" title="Average paid: ${money(o.avgPaidPrice)}">
            <span>${esc(o.item_type)} · ${esc(o.option)}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${(o.completed / max) * 100}%"></div></div>
            <b>${o.completed}</b>
          </div>`).join("")
      : '<p class="muted">No completed jobs yet.</p>';
  } catch (e) {
    toast(e.message, true);
  }
}

load();
setInterval(load, 15000);
