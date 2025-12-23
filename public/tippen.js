// ⚠️ TEMPORÄR – später durch Login / Session ersetzen
const USER_ID = 1;

// 1️⃣ Geplante Spiele laden
async function ladeGeplanteSpiele() {
    const res = await fetch("/api/spiele");
    const spiele = await res.json();

    const select = document.getElementById("spielSelect");
    select.innerHTML = '<option value="">Bitte wählen …</option>';

    spiele
        .filter(spiel => spiel.statuswort === "geplant")
        .forEach(spiel => {
            const opt = document.createElement("option");
            opt.value = spiel.id;
            opt.textContent =
                `${spiel.heimverein} – ${spiel.gastverein} (${spiel.anstoss})`;
            select.appendChild(opt);
        });
}

// 2️⃣ Tipp speichern
document.getElementById("btnTippen").addEventListener("click", async () => {
    const spiel_id = document.getElementById("spielSelect").value;
    const heimtipp = document.getElementById("heimtipp").value;
    const gasttipp = document.getElementById("gasttipp").value;

    if (!spiel_id) {
        return zeigeMeldung("Bitte ein Spiel auswählen", "red");
    }

    if (heimtipp === "" || gasttipp === "") {
        return zeigeMeldung("Bitte beide Tipps eingeben", "red");
    }

    try {
        const res = await fetch("/api/tips", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_id: USER_ID,
                spiel_id: Number(spiel_id),
                heimtipp: Number(heimtipp),
                gasttipp: Number(gasttipp)
            })
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.error);

        zeigeMeldung("Tipp gespeichert ✔", "green");

    } catch (err) {
        zeigeMeldung(err.message, "red");
    }
});

// 3️⃣ Meldungen anzeigen
function zeigeMeldung(text, farbe) {
    const el = document.getElementById("meldung");
    el.textContent = text;
    el.style.color = farbe;
}

// Start
ladeGeplanteSpiele();
