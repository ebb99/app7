document.getElementById("btnLogin").addEventListener("click", async () => {
    const name = document.getElementById("name").value;
    const password = document.getElementById("password").value;

    const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password })
    });

    const data = await res.json();

    if (!res.ok) {
        document.getElementById("meldung").innerText = data.error;
        return;
    }

    // Weiterleiten
    window.location.href = "/tippen.html";
});
