// quote.js — the homeowner flow on /quote and /c/<company>.
// Steps: 1 upload → 2 AI analysis → 3 preview + estimate → 4 free request.

// Everything we learn along the way is kept here.
const state = {
  company: getParam("company", "/c/"), // set when the page is /c/<slug>
  image: null,      // the 512x512 photo as a data URL
  detection: null,  // what the AI saw (step 2)
  option: null,     // the replacement the homeowner picked
  estimate: null,   // price + feasibility (step 3)
  after: null,      // the generated "after" picture
};

const painter = createMaskPainter($("maskCanvas"), () => Number($("brush").value));

// Marks the progress bar: steps before `n` are done, `n` is current.
function showStep(n) {
  document.querySelectorAll("#progress div").forEach((el) => {
    const s = Number(el.dataset.step);
    el.className = s < n ? "done" : s === n ? "current" : "";
  });
}

// ---------- Page start: load regions and the company name ----------
async function init() {
  showStep(1);
  try {
    const cfg = await api.config();
    $("region").innerHTML = cfg.regions.map((r) => `<option>${esc(r)}</option>`).join("");
    if (!cfg.ai) $("aiBanner").classList.remove("hidden");
  } catch (e) {
    toast(e.message, true);
  }
  if (state.company) {
    try {
      const { company } = await api.getCompany(state.company);
      $("pageTitle").textContent = "Get a free quote from " + company.name;
      document.title = "Free quote from " + company.name + " — SnapQuote";
    } catch (e) {
      toast("Company link not found. You can still get a quote.", true);
      state.company = null;
    }
  }
}

// ---------- Step 1: photo ----------
$("file").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    state.image = await drawSquarePhoto(file, $("photoCanvas"));
    painter.clear();
    $("photoBox").classList.remove("hidden");
    $("maskTools").classList.remove("hidden");
    $("analyzeBtn").disabled = false;
    ["step2", "step3", "estimateCard", "step4"].forEach((id) => $(id).classList.add("hidden"));
    showStep(1);
  } catch (e) {
    toast(e.message, true);
  }
});
$("clearMask").addEventListener("click", () => painter.clear());

$("analyzeBtn").addEventListener("click", async () => {
  const btn = $("analyzeBtn");
  setBusy(btn, true, "Analyzing photo…");
  try {
    const { detection } = await api.analyze(state.image, $("region").value);
    state.detection = detection;
    renderDetection(detection);
    $("step2").classList.remove("hidden");
    showStep(2);
    $("step2").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (e) {
    toast(e.message, true);
  }
  setBusy(btn, false);
});

// ---------- Step 2: show what the AI found ----------
function conditionBadge(condition) {
  const cls = condition === "good" ? "good" : condition === "poor" ? "bad" : "warn";
  return `<span class="badge ${cls}">${esc(condition)}</span>`;
}

function renderDetection(d) {
  const issues = (d.visible_issues || []).map((i) => `<span class="badge grey">${esc(i)}</span>`).join("");
  $("detection").innerHTML = `
    <p class="mt-0"><b>${esc(d.item_label)}</b> · ${esc(d.material)} · ${conditionBadge(d.condition)}</p>
    <p class="muted">Quantity: ${d.quantity} · Approx. size: ${esc(d.approx_dimensions)}</p>
    <div>${issues}${d.structural_concern ? '<span class="badge bad">Possible structural work</span>' : ""}</div>`;

  $("options").innerHTML = d.replacement_options
    .map((o, i) => `
      <label class="option">
        <input type="radio" name="option" value="${i}" ${i === 0 ? "checked" : ""}>${esc(o.name)}
        ${o.localFavorite ? `<span class="badge good">Chosen by ${o.localFavorite} homeowners nearby</span>` : ""}
        <small>${esc(o.prompt)}</small>
      </label>`)
    .join("");
}

function chosenOption() {
  const picked = document.querySelector('input[name="option"]:checked');
  if (!picked) return null;
  if (picked.value === "custom") {
    const text = $("customOption").value.trim();
    return text ? { name: text, prompt: text } : null;
  }
  return state.detection.replacement_options[Number(picked.value)];
}

// ---------- Step 3: preview + estimate (both AI calls run at the same time) ----------
$("visualizeBtn").addEventListener("click", async () => {
  const option = chosenOption();
  if (!option) return toast("Pick a replacement or describe one.", true);
  state.option = option;

  const btn = $("visualizeBtn");
  setBusy(btn, true, "Rendering preview & pricing…");
  $("loading").classList.remove("hidden");
  $("step3").classList.add("hidden");
  $("estimateCard").classList.add("hidden");

  // Run the price estimate and the picture separately, so one failing doesn't hide the other.
  const region = $("region").value;
  const [preview, priced] = await Promise.allSettled([
    api.visualize(state.image, option.prompt, painter.getMask()),
    api.estimate(state.detection, option, region),
  ]);
  $("loading").classList.add("hidden");

  if (preview.status === "fulfilled") {
    state.after = preview.value.image;
    renderPreview(preview.value);
  } else {
    state.after = null;
    toast("Preview failed: " + preview.reason.message, true);
  }

  if (priced.status === "fulfilled") {
    state.estimate = priced.value.estimate;
    renderEstimate(state.estimate);
    $("step4").classList.remove("hidden");
    showStep(3);
  } else {
    toast("Estimate failed: " + priced.reason.message, true);
  }
  setBusy(btn, false);
});

function renderPreview(v) {
  $("beforeImg").src = state.image;
  $("afterImg").src = v.image;
  const notes = {
    inpaint: "Replaced only the area you painted.",
    img2img: "Whole-photo restyle. Paint the area first for a precise swap.",
    generated: "Illustration of the new item (photo editing was unavailable).",
  };
  let note = notes[v.mode] || "";
  // The user painted, but precise mode failed and the backend fell back to a whole-photo restyle.
  if (v.mode !== "inpaint" && (v.fallbacks || []).some((f) => f.mode === "inpaint")) {
    note = "Precise mode is unavailable right now, so the whole photo was restyled.";
  }
  $("previewMode").textContent = note;
  $("compareRange").value = 50;
  $("compare").style.setProperty("--pos", "50%");
  $("step3").classList.remove("hidden");
}

// The slider moves the line between "before" and "after".
$("compareRange").addEventListener("input", (e) => {
  $("compare").style.setProperty("--pos", e.target.value + "%");
});

function list(id, items) {
  $(id).innerHTML = (items || []).map((i) => `<li>${esc(i)}</li>`).join("");
}

function renderEstimate(e) {
  const p = e.price;
  const score = $("score");
  score.textContent = e.feasibility_score;
  score.className = "score " + (e.feasibility_score >= 8 ? "good" : e.feasibility_score >= 5 ? "warn" : "bad");
  $("priceRange").textContent = money(p.low) + " – " + money(p.high);
  $("priceSub").textContent = p.quantity + " × " + p.unit + " · " + (e.region || "");
  $("feasLabel").textContent = e.feasibility_label;
  $("rationale").textContent = e.rationale;

  const c = p.calibration;
  let calib = c.applied
    ? `<span class="badge good">Adjusted from ${c.samples} completed jobs in your area</span>`
    : `<span class="badge grey">Learning: ${c.samples}/${c.needed} local jobs</span>`;
  if (e.local && e.local.completedJobs > 0) {
    calib += `<p class="muted">Homeowners nearby paid ${money(e.local.avgPaidPrice)} on average.</p>`;
  }
  $("calibration").innerHTML = calib;

  $("breakdown").innerHTML = `
    <tr><th>Line</th><th>Low</th><th>High</th></tr>
    <tr><td>Materials</td><td>${money(p.materials[0])}</td><td>${money(p.materials[1])}</td></tr>
    <tr><td>Labour</td><td>${money(p.labour[0])}</td><td>${money(p.labour[1])}</td></tr>`;
  list("scope", e.scope);
  list("materials", e.materials);
  $("timeline").textContent = "Typical timeline: " + e.timeline_days + " day(s).";
  $("verify").textContent = e.verify_on_site.length ? "Contractor will confirm: " + e.verify_on_site.join("; ") : "";
  $("estimateCard").classList.remove("hidden");
}

// ---------- Step 4: quote fee preview + free request ----------
let feeTimer;
$("custEmail").addEventListener("input", () => {
  clearTimeout(feeTimer);
  const email = $("custEmail").value.trim();
  if (!email.includes("@")) return $("feeCard").classList.add("hidden");
  // Wait until the user stops typing for half a second.
  feeTimer = setTimeout(async () => {
    try {
      const { quoteFee: f } = await api.quoteFee(email);
      $("feeCard").innerHTML = `
        <div class="muted">Quote fee if you go ahead</div>
        <div class="fee">${money(f.fee)}</div>
        ${f.discountPct > 0 ? `<span class="badge good">${f.discountPct}% loyalty discount</span>` : ""}
        <div class="muted">Next time: ${money(f.nextFee)}</div>`;
      $("feeCard").classList.remove("hidden");
    } catch (e) {
      /* the fee preview is optional */
    }
  }, 500);
});

$("sendBtn").addEventListener("click", async () => {
  const email = $("custEmail").value.trim();
  if (!email.includes("@")) return toast("Enter your email so the company can send your contract.", true);
  const btn = $("sendBtn");
  setBusy(btn, true, "Sending…");
  try {
    const { job } = await api.sendRequest({
      company: state.company || undefined,
      name: $("custName").value.trim() || "Homeowner",
      email,
      region: $("region").value,
      detection: state.detection,
      option: state.option,
      estimate: state.estimate,
      before: state.image,
      after: state.after,
    });
    showStep(5);
    $("sent").innerHTML = `<b>Request #${esc(job.id)} sent.</b> The company will review your pictured plan and send a contract.
      <div class="mt-1"><a class="btn btn-dark" href="/request?id=${encodeURIComponent(job.id)}">Track my request</a></div>`;
    $("sent").classList.remove("hidden");
    btn.classList.add("hidden");
    return;
  } catch (e) {
    toast(e.message, true);
  }
  setBusy(btn, false);
});

init();
