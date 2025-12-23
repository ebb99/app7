async function ladeTipps() {
    const res = await fetch("/api/tips");
    const tips = await res.json();

    const container = document.getElementById("tipListe");
    container.innerHTML = "";

    // Gruppieren nach spiel_id
    const spieleMap = {};

    tips.forEach(t => {
        if (!spieleMap[t.spiel_id]) {
            spieleMap[t.spiel_id] = {
                spiel: t,
                tips: []
            };
        }
        spieleMap[t.spiel_id].tips.push(t);
    });

    // Rendern
    Object.values(spieleMap).forEach(gruppe => {
        const spielDiv = document.createElement("div");
        spielDiv.className = "spiel";

        spielDiv.innerHTML = `
            <h3>${gruppe.spiel.heimverein} – ${gruppe.spiel.gastverein}</h3>
            <div class="status">
                ${gruppe.spiel.statuswort} | ${new Date(gruppe.spiel.anstoss).toLocaleString()}
            </div>
        `;

        gruppe.tips.forEach(tipp => {
            const tippDiv = document.createElement("div");
            tippDiv.className = "tipp";
            tippDiv.innerHTML = `
                <span class="name">${tipp.user_name}</span>
                <span class="ergebnis">${tipp.heimtipp} : ${tipp.gasttipp}</span>
            `;
            spielDiv.appendChild(tippDiv);
        });

        container.appendChild(spielDiv);
    });
}

// Start
ladeTipps();
