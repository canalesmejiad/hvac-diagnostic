const form = document.querySelector("#diagnostic-form");
const resultsSection = document.querySelector("#results");
const formMessage = document.querySelector("#form-message");

const componentSearchInput = document.querySelector("#component-search");
const componentResult = document.querySelector("#component-result");

const DIAG_API_URL = "https://69816966c9a606f5d446bed4.mockapi.io/diagnoses";
const COMP_API_URL = "https://69816966c9a606f5d446bed4.mockapi.io/components";

const IS_GITHUB_PAGES = location.hostname.includes("github.io");

const PROXIES = [
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url) => `https://cors.isomorphic-git.org/${url}`,
];

function showMessage(msg, isError = false) {
    formMessage.textContent = msg;
    formMessage.style.color = isError ? "crimson" : "green";
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => {
        const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
        return map[m];
    });
}

function renderList(title, items) {
    const safeItems = (items || []).map((i) => `<li>${escapeHtml(i)}</li>`).join("");
    return `<h4>${escapeHtml(title)}</h4><ul>${safeItems}</ul>`;
}

function isValidTemperature(value) {
    const temp = Number(value);
    return Number.isFinite(temp) && temp >= 30 && temp <= 110;
}

function resetResults() {
    resultsSection.innerHTML = `
    <h3>Results</h3>
    <div class="results-box">
      <p class="muted">Submit the form to see possible causes and next steps.</p>
    </div>
  `;
}

async function fetchJsonDirect(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${res.statusText} - ${text.slice(0, 160)}`);
    }
    return res.json();
}

async function fetchJsonViaProxies(url) {
    let lastErr;

    for (const proxy of PROXIES) {
        const finalUrl = proxy(url);
        try {
            const res = await fetch(finalUrl, { cache: "no-store" });

            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(`HTTP ${res.status} ${res.statusText} - ${text.slice(0, 160)}`);
            }

            return res.json();
        } catch (err) {
            console.error("Proxy failed:", finalUrl, err);
            lastErr = err;
        }
    }

    throw lastErr || new Error("Failed to fetch via proxies");
}

async function fetchJson(url) {
    return IS_GITHUB_PAGES ? fetchJsonViaProxies(url) : fetchJsonDirect(url);
}

async function fetchAllDiagnoses() {
    return fetchJson(DIAG_API_URL);
}

function findDiagnosis(all, systemTypeText, symptomText) {
    return (all || []).find((d) => d.systemType === systemTypeText && d.symptom === symptomText);
}

function renderDiagnosis(d) {
    const confidencePct = Math.round((Number(d.confidence) || 0) * 100);

    resultsSection.innerHTML = `
    <h3>Results</h3>
    <div class="results-box">
      <p><strong>${escapeHtml(d.summary)}</strong></p>
      <span class="confidence-badge">Confidence: ${confidencePct}%</span>
      ${renderList("Possible Causes", d.likelyCauses)}
      ${renderList("Recommended Checks", d.recommendedChecks)}
      ${renderList("Recommended Fixes", d.recommendedFixes)}
      <div class="safety-box">
        <h4 class="safety-title">Safety Warnings</h4>
        <ul>${(d.safetyWarnings || []).map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul>
      </div>
    </div>
  `;
}

async function fetchAllComponents() {
    return fetchJson(COMP_API_URL);
}

function findComponent(all, term) {
    const t = term.toLowerCase().trim();
    if (!t) return null;

    return (all || []).find(
        (c) =>
            (c.name || "").toLowerCase().includes(t) ||
            (c.componentId || "").toLowerCase().includes(t)
    );
}

function renderComponent(comp) {
    componentResult.innerHTML = `
    <div class="results-box">
      <h4>${escapeHtml(comp.name)}</h4>
      <p>${escapeHtml(comp.description)}</p>
      ${renderList("Inspection Steps", comp.inspectionSteps)}
      ${renderList("Tools Required", comp.toolsRequired)}
      ${renderList("Safety Notes", comp.safetyNotes)}
    </div>
  `;
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showMessage("");

    const systemSelect = document.querySelector("#system");
    const symptomSelect = document.querySelector("#symptom");
    const tempValue = document.querySelector("#temperature").value;

    resetResults();

    if (!systemSelect.value || !symptomSelect.value || !tempValue) {
        showMessage("Please complete all fields.", true);
        return;
    }

    if (!isValidTemperature(tempValue)) {
        showMessage("Please enter a valid indoor temperature (30°F to 110°F).", true);
        return;
    }

    const systemTypeText = systemSelect.selectedOptions[0].textContent.trim();
    const symptomText = symptomSelect.selectedOptions[0].textContent.trim();

    try {
        const diagnoses = await fetchAllDiagnoses();
        const match = findDiagnosis(diagnoses, systemTypeText, symptomText);

        if (!match) {
            showMessage("No diagnosis found for that selection.", true);
            return;
        }

        renderDiagnosis(match);
        showMessage("Diagnosis generated successfully.");
    } catch (err) {
        console.error(err);
        showMessage("Unable to load diagnosis data. Please try again.", true);
    }
});

let compTimer = null;

componentSearchInput.addEventListener("input", () => {
    clearTimeout(compTimer);

    compTimer = setTimeout(async () => {
        const term = componentSearchInput.value.trim();

        if (!term) {
            componentResult.innerHTML = "";
            return;
        }

        componentResult.innerHTML = `<p class="muted">Searching...</p>`;

        try {
            const components = await fetchAllComponents();
            const match = findComponent(components, term);

            if (!match) {
                componentResult.innerHTML = `<p class="muted">No component found.</p>`;
                return;
            }

            renderComponent(match);
        } catch (err) {
            console.error(err);
            componentResult.innerHTML = `<p class="muted">Error loading component data.</p>`;
        }
    }, 300);
});

resetResults();

const notesForm = document.querySelector("#notes-form");
const notesMessage = document.querySelector("#notes-message");
const notesList = document.querySelector("#notes-list");
const clearNotesBtn = document.querySelector("#clear-notes");

const noteText = document.querySelector("#note-text");
const noteTech = document.querySelector("#note-tech");
const noteDate = document.querySelector("#note-date");

const NOTES_KEY = "hvac_service_notes";

function setNotesMessage(msg, isError = false) {
    notesMessage.textContent = msg;
    notesMessage.style.color = isError ? "crimson" : "green";
}

function loadNotes() {
    try {
        return JSON.parse(localStorage.getItem(NOTES_KEY)) || [];
    } catch {
        return [];
    }
}

function saveNotes(notes) {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

function renderNotes() {
    const notes = loadNotes();
    if (!notes.length) {
        notesList.innerHTML = `<p class="muted">No notes yet.</p>`;
        return;
    }

    notesList.innerHTML = notes
        .map(
            (n) => `
    <div class="note-item">
      <div class="note-meta">
        <span><strong>Date:</strong> ${escapeHtml(n.date)}</span>
        ${n.tech ? `<span><strong>Tech:</strong> ${escapeHtml(n.tech)}</span>` : ""}
        ${n.system ? `<span><strong>System:</strong> ${escapeHtml(n.system)}</span>` : ""}
        ${n.symptom ? `<span><strong>Symptom:</strong> ${escapeHtml(n.symptom)}</span>` : ""}
      </div>
      <div>${escapeHtml(n.text)}</div>
      <div class="note-actions">
        <button class="small-btn small-btn-danger" data-delete="${n.id}">Delete</button>
      </div>
    </div>
  `
        )
        .join("");
}

(function initNotes() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    noteDate.value = `${yyyy}-${mm}-${dd}`;
    renderNotes();
})();

notesForm.addEventListener("submit", (e) => {
    e.preventDefault();
    setNotesMessage("");

    const text = noteText.value.trim();
    const tech = noteTech.value.trim();
    const date = noteDate.value;

    if (!text || !date) {
        setNotesMessage("Please enter notes and a date.", true);
        return;
    }

    const systemSelect = document.querySelector("#system");
    const symptomSelect = document.querySelector("#symptom");
    const systemText = systemSelect?.value ? systemSelect.selectedOptions[0].textContent.trim() : "";
    const symptomText = symptomSelect?.value ? symptomSelect.selectedOptions[0].textContent.trim() : "";

    const notes = loadNotes();
    notes.unshift({
        id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()),
        text,
        tech,
        date,
        system: systemText,
        symptom: symptomText,
    });

    saveNotes(notes);
    noteText.value = "";
    noteTech.value = "";

    renderNotes();
    setNotesMessage("Note saved.");
});

notesList.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-delete]");
    if (!btn) return;

    const id = btn.getAttribute("data-delete");
    const notes = loadNotes().filter((n) => n.id !== id);
    saveNotes(notes);
    renderNotes();
    setNotesMessage("Note deleted.");
});

clearNotesBtn.addEventListener("click", () => {
    saveNotes([]);
    renderNotes();
    setNotesMessage("All notes cleared.");
});