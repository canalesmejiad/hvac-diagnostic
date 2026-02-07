const form = document.querySelector("#diagnostic-form");
const resultsSection = document.querySelector("#results");
const formMessage = document.querySelector("#form-message");

const componentSearchInput = document.querySelector("#component-search");
const componentResult = document.querySelector("#component-result");

// Your MockAPI endpoints
const DIAG_API_URL = "https://69816966c9a606f5d446bed4.mockapi.io/diagnoses";
const COMP_API_URL = "https://69816966c9a606f5d446bed4.mockapi.io/components";

// ---------- HELPERS ----------
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
    const safeItems = (items || []).map(i => `<li>${escapeHtml(i)}</li>`).join("");
    return `
    <h4>${escapeHtml(title)}</h4>
    <ul>${safeItems}</ul>
  `;
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

// ---------- DIAGNOSTIC ----------
async function fetchAllDiagnoses() {
    const res = await fetch(DIAG_API_URL);
    if (!res.ok) throw new Error("Failed to fetch diagnoses");
    return res.json();
}

function findDiagnosis(all, system, symptom) {
    return all.find(d => d.systemType === system && d.symptom === symptom);
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
        <ul>
          ${(d.safetyWarnings || []).map(w => `<li>${escapeHtml(w)}</li>`).join("")}
        </ul>
      </div>
    </div>
  `;
}

// ---------- COMPONENT LOOKUP ----------
async function fetchAllComponents() {
    const res = await fetch(COMP_API_URL);
    if (!res.ok) throw new Error("Failed to fetch components");
    return res.json();
}

function findComponent(all, term) {
    const t = term.toLowerCase().trim();
    if (!t) return null;

    return all.find(c =>
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

// ---------- EVENTS ----------
form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showMessage("");

    const system = document.querySelector("#system").value;
    const symptom = document.querySelector("#symptom").value;
    const tempValue = document.querySelector("#temperature").value;

    // Clear previous results (requested improvement)
    resetResults();

    // Validation
    if (!system || !symptom || !tempValue) {
        showMessage("Please complete all fields.", true);
        return;
    }

    if (!isValidTemperature(tempValue)) {
        showMessage("Please enter a valid indoor temperature (30°F to 110°F).", true);
        return;
    }

    try {
        const diagnoses = await fetchAllDiagnoses();
        const match = findDiagnosis(diagnoses, system, symptom);

        if (!match) {
            showMessage("No diagnosis found for that selection.", true);
            return;
        }

        renderDiagnosis(match);
        showMessage("Diagnosis generated successfully.");
    } catch (err) {
        showMessage("Unable to load diagnosis data. Please try again.", true);
    }
});

// Component search (simple debounce)
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
            componentResult.innerHTML = `<p class="muted">Error loading component data.</p>`;
        }
    }, 300);
});

// Initial state
resetResults();
// ---------- MAINTENANCE NOTES (localStorage) ----------
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

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => {
        const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
        return map[m];
    });
}

function renderNotes() {
    const notes = loadNotes();
    if (!notes.length) {
        notesList.innerHTML = `<p class="muted">No notes yet.</p>`;
        return;
    }

    notesList.innerHTML = notes.map(n => `
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
  `).join("");
}

// Optional: prefill date with today
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

    // Pull current selections to store context (optional but useful)
    const system = document.querySelector("#system")?.value || "";
    const symptom = document.querySelector("#symptom")?.value || "";

    const notes = loadNotes();
    notes.unshift({
        id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()),
        text,
        tech,
        date,
        system,
        symptom
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
    const notes = loadNotes().filter(n => n.id !== id);
    saveNotes(notes);
    renderNotes();
    setNotesMessage("Note deleted.");
});

clearNotesBtn.addEventListener("click", () => {
    saveNotes([]);
    renderNotes();
    setNotesMessage("All notes cleared.");
});