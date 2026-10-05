// ====== CONFIG ======
// Your API returns default_prediction: 1 = High Risk (likely to default), 0 = Low Risk.
// So by default, 0 => approved and 1 => "bring documents to the bank".
// If your model's label is the other way round, set this to false.
const PREDICTION_ZERO_MEANS_APPROVED = true;

const API_URL = "/predict";

// ====== ELEMENTS ======
const form = document.getElementById("loanForm");
const submitBtn = document.getElementById("submitBtn");
const btnLabel = submitBtn.querySelector(".btn-label");
const spinner = submitBtn.querySelector(".spinner");
const errorEl = document.getElementById("formError");

const modal = document.getElementById("resultModal");
const approvedView = document.getElementById("approvedView");
const reviewView = document.getElementById("reviewView");

const incomeEl = document.getElementById("person_income");
const amountEl = document.getElementById("loan_amnt");
const percentEl = document.getElementById("loan_percent_income");

const numberFields = [
  "person_age", "person_income", "person_emp_length",
  "loan_amnt", "loan_int_rate", "loan_percent_income", "cb_person_cred_hist_length",
];
const textFields = [
  "person_home_ownership", "loan_intent", "loan_grade", "cb_person_default_on_file",
];
const intFields = ["person_age", "cb_person_cred_hist_length"];

// ====== AUTO-CALCULATE loan_percent_income ======
function updatePercent() {
  const income = parseFloat(incomeEl.value);
  const amount = parseFloat(amountEl.value);
  percentEl.value = income > 0 && amount >= 0 ? (amount / income).toFixed(2) : "";
}
incomeEl.addEventListener("input", updatePercent);
amountEl.addEventListener("input", updatePercent);

// ====== VALIDATION + PAYLOAD ======
function buildPayload() {
  const payload = {};
  let valid = true;

  [...numberFields, ...textFields].forEach((id) => {
    const el = document.getElementById(id);
    const field = el.closest(".field");
    const raw = el.value.trim();
    let ok = raw !== "";

    if (ok && numberFields.includes(id)) {
      const n = Number(raw);
      ok = Number.isFinite(n) && n >= 0;
      payload[id] = intFields.includes(id) ? Math.round(n) : n;
    } else if (ok) {
      payload[id] = raw;
    }

    field.classList.toggle("invalid", !ok);
    if (!ok) valid = false;
  });

  return valid ? payload : null;
}

// ====== SUBMIT ======
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorEl.textContent = "";
  updatePercent();

  const payload = buildPayload();
  if (!payload) {
    errorEl.textContent = "Please fill in all fields with valid values.";
    return;
  }

  setLoading(true);
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Server responded with ${res.status}`);
    const data = await res.json();
    showResult(data);
  } catch (err) {
    console.error(err);
    errorEl.textContent = "Something went wrong reaching the server. Please try again.";
  } finally {
    setLoading(false);
  }
});

function setLoading(on) {
  submitBtn.disabled = on;
  spinner.hidden = !on;
  btnLabel.textContent = on ? "Analyzing…" : "Check My Eligibility";
}

// ====== RESULT ======
function showResult(data) {
  const prediction = Number(data.default_prediction);
  const approved = PREDICTION_ZERO_MEANS_APPROVED ? prediction === 0 : prediction === 1;
  const riskPct = Math.round((data.default_probability ?? 0) * 100);

  approvedView.hidden = !approved;
  reviewView.hidden = approved;

  if (approved) {
    document.getElementById("okLabel").textContent = `Estimated risk score: ${riskPct}%`;
    animateMeter("okMeter", 100 - riskPct);
  } else {
    document.getElementById("warnLabel").textContent = `Estimated risk score: ${riskPct}%`;
    animateMeter("warnMeter", riskPct);
  }
  openModal();
}

function animateMeter(id, pct) {
  const el = document.getElementById(id);
  el.style.width = "0";
  requestAnimationFrame(() => setTimeout(() => (el.style.width = Math.max(4, pct) + "%"), 50));
}

// ====== MODAL ======
function openModal() {
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}
function closeModal() {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}
document.getElementById("closeModal").addEventListener("click", closeModal);
document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closeModal));
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

// Open the nearest bank branch using the visitor's location when possible
document.getElementById("branchBtn").addEventListener("click", (e) => {
  if (!navigator.geolocation) return; // falls back to the default "bank near me" link
  e.preventDefault();
  const fallback = e.currentTarget.href;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      window.open(`https://www.google.com/maps/search/bank/@${latitude},${longitude},14z`, "_blank", "noopener");
    },
    () => window.open(fallback, "_blank", "noopener"),
    { timeout: 6000 }
  );
});

// ====== SCROLL REVEAL + COUNT-UP ======
const io = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add("in-view");
    const counter = entry.target.querySelector("[data-count]");
    if (counter) countUp(counter);
    io.unobserve(entry.target);
  });
}, { threshold: 0.2 });
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

function countUp(el) {
  const target = Number(el.dataset.count);
  const suffix = el.dataset.suffix || "";
  const start = performance.now();
  const duration = 1400;
  (function tick(now) {
    const t = Math.min((now - start) / duration, 1);
    el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3))) + suffix;
    if (t < 1) requestAnimationFrame(tick);
  })(start);
}
