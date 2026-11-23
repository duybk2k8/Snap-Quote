// common.js — small helpers every page uses.

// Shortcut: $("id") instead of document.getElementById("id")
function $(id) {
  return document.getElementById(id);
}

// Turns 1234.5 into "$1,234.5" (no forced decimals).
function money(n) {
  if (n === null || n === undefined || isNaN(n)) return "–";
  return "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

// Makes text safe to put inside HTML (stops "<script>" in a name from running).
function esc(text) {
  return String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Shows a message at the bottom of the screen for a few seconds.
function toast(message, isError) {
  const el = document.createElement("div");
  el.className = "toast" + (isError ? " error" : "");
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), isError ? 6000 : 3500);
}

// Puts a spinner on a button while something runs, then restores it.
function setBusy(button, busy, label) {
  if (busy) {
    button.dataset.label = button.innerHTML;
    button.innerHTML = '<span class="spinner"></span>' + (label || "Working…");
    button.disabled = true;
  } else {
    button.innerHTML = button.dataset.label || button.innerHTML;
    button.disabled = false;
  }
}

// Reads ?name=value from the address bar, or the last part of a path like /c/maple-windows.
function getParam(name, pathPrefix) {
  const fromQuery = new URLSearchParams(location.search).get(name);
  if (fromQuery) return fromQuery;
  if (pathPrefix && location.pathname.startsWith(pathPrefix)) {
    return decodeURIComponent(location.pathname.slice(pathPrefix.length).split("/")[0]) || null;
  }
  return null;
}

// Highlights the current page in the top menu.
document.addEventListener("DOMContentLoaded", () => {
  const page = location.pathname.split("/")[1] || "index";
  document.querySelectorAll(".nav a").forEach((a) => {
    if (a.dataset.page === page || (page === "c" && a.dataset.page === "quote")) a.classList.add("active");
  });
});
