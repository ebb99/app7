// server.js
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const pg = require('pg');
const path = require('path');
const { log } = require('console');
const cron = require("node-cron");

const app = express();
const PORT = process.env.PORT || 8080;

const SPIELZEIT_MINUTEN = 3;
const NACHSPIELZEIT_MINUTEN = 2;


// Middleware
app.use(express.json());
app.use(express.static('public'));
// --- Datenbank-Verbindung (PostgreSQL) ---

const isRailway = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("localhost");

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isRailway ? { rejectUnauthorized: false } : false
});

// Testen der DB-Verbindung
pool.connect((err, client, done) => {
    if (err) {
        console.error('Fehler beim Verbinden mit der Datenbank:', err);
        return;
    }
    client.release();
    console.log('PostgreSQL-Datenbank verbunden!');
});



cron.schedule("* * * * *", async () => {
    try {
        const result = await pool.query(
            `
            UPDATE spiele
            SET statuswort = 'live'
            WHERE statuswort = 'geplant'
              AND anstoss <= NOW()
            `
        );

        if (result.rowCount > 0) {
            console.log(`Statuswechsel: ${result.rowCount} Spiel(e) auf LIVE gesetzt`);
        }
    } catch (err) {
        console.error("Cron Fehler (Statuswechsel):", err);
    }
});

//import cron from "node-cron";
// oder: const cron = require("node-cron");

cron.schedule("* * * * *", async () => {
    try {
        const result = await pool.query(
            `
            UPDATE spiele
            SET statuswort = 'beendet'
            WHERE statuswort = 'live'
              AND anstoss
                  + INTERVAL '${SPIELZEIT_MINUTEN} minutes'
                  + INTERVAL '${NACHSPIELZEIT_MINUTEN} minutes'
                  <= NOW()
            `
        );

        if (result.rowCount > 0) {
            console.log(
                `Statuswechsel: ${result.rowCount} Spiel(e) auf BEENDET gesetzt`
            );
        }

    } catch (err) {
        console.error("Cron Fehler (Spiel beenden):", err);
    }
});

app.get("/api/tips", async (req, res) => {
    try {
        const result = await pool.query(
            `
            SELECT
                t.id AS tip_id,
                t.heimtipp,
                t.gasttipp,
                t.created_at,

                u.id AS user_id,
                u.name AS user_name,

                s.id AS spiel_id,
                s.heimverein,
                s.gastverein,
                s.anstoss,
                s.statuswort
            FROM tips t
            JOIN users u ON u.id = t.user_id
            JOIN spiele s ON s.id = t.spiel_id
            ORDER BY s.anstoss, u.name
            `
        );

        res.json(result.rows);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Fehler beim Laden der Tipps" });
    }
});







app.post("/api/tips", async (req, res) => {
    const { user_id, spiel_id, heimtipp, gasttipp } = req.body;

    if (
        user_id === undefined ||
        spiel_id === undefined ||
        heimtipp === undefined ||
        gasttipp === undefined
    ) {
        return res.status(400).json({ error: "Unvollständige Daten" });
    }

    try {
        // 1️⃣ User prüfen
        const userResult = await pool.query(
            "SELECT role FROM users WHERE id = $1",
            [user_id]
        );

        if (userResult.rowCount === 0) {
            return res.status(404).json({ error: "User nicht gefunden" });
        }

        if (userResult.rows[0].role !== "tipper") {
            return res.status(403).json({ error: "Nur Tipper dürfen tippen" });
        }

        // 2️⃣ Spiel prüfen
        const spielResult = await pool.query(
            "SELECT statuswort FROM spiele WHERE id = $1",
            [spiel_id]
        );

        if (spielResult.rowCount === 0) {
            return res.status(404).json({ error: "Spiel nicht gefunden" });
        }

        if (spielResult.rows[0].statuswort !== "geplant") {
            return res.status(403).json({
                error: "Tippen nur für geplante Spiele erlaubt"
            });
        }

        // 3️⃣ Tipp speichern (Insert oder Update)
        const tipResult = await pool.query(
            `
            INSERT INTO tips (user_id, spiel_id, heimtipp, gasttipp)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id, spiel_id)
            DO UPDATE SET
                heimtipp = EXCLUDED.heimtipp,
                gasttipp = EXCLUDED.gasttipp,
                created_at = NOW()
            RETURNING *
            `,
            [user_id, spiel_id, heimtipp, gasttipp]
        );

        res.json({
            message: "Tipp gespeichert",
            tip: tipResult.rows[0]
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Fehler beim Speichern des Tipps" });
    }
});


app.get("/api/spiele", async (req, res) => {
    try {
        // Status aktualisieren
        await pool.query(`
            UPDATE spiele
            SET statuswort = 'live'
            WHERE statuswort = 'geplant'
              AND anstoss <= NOW()
        `);
          await pool.query(`
    UPDATE spiele
    SET statuswort = 'beendet'
    WHERE statuswort = 'live'
      AND anstoss
          + INTERVAL '${SPIELZEIT_MINUTEN} minutes'
          + INTERVAL '${NACHSPIELZEIT_MINUTEN} minutes'
          <= NOW()
`);



        // Spiele laden
        const result = await pool.query(
            "SELECT * FROM spiele ORDER BY anstoss"
        );

        res.json(result.rows);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Fehler beim Laden der Spiele" });
    }
});


// DELETE ein Spiel
app.delete('/api/spiele/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM spiele WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE einen Verein
app.delete('/api/vereine/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM vereine WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE eine Zeit
app.delete('/api/zeiten/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM zeiten WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET alle Vereine
app.get('/api/vereine', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, vereinsname FROM vereine ORDER BY vereinsname'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET alle Zeiten
app.get('/api/zeiten', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, zeit FROM zeiten ORDER BY zeit'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET alle Spiele
app.get('/api/spiele', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, anstoss, heimverein, gastverein, heimtore, gasttore, statuswort FROM spiele ORDER BY anstoss'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Nur Ergebnis (Tore) aktualisieren
app.patch("/api/spiele/:id/ergebnis", async (req, res) => {
    const { id } = req.params;
    const { heimtore, gasttore,statuswort } = req.body;

    // einfache Validierung
    if (heimtore === undefined || gasttore === undefined) {
        return res.status(400).json({ error: "Heimtore und Gasttore sind Pflicht" });
    }

    try {
        const result = await pool.query(
            `
            UPDATE spiele
            SET heimtore = $1,
                gasttore = $2,
                statuswort = $3
            WHERE id = $4
            RETURNING id, heimtore, gasttore,statuswort
            `,
            [heimtore, gasttore,statuswort, id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Spiel nicht gefunden" });
        }

        res.json(result.rows[0]);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Fehler beim Speichern des Ergebnisses" });
    }
});



// Neuen Verein  anlegen i.A
app.post("/api/vereine", async (req, res) => {
    const { vereinsname } = req.body;

    try {
        const result = await pool.query(
            "INSERT INTO vereine (vereinsname) VALUES ($1) RETURNING *",
            [vereinsname]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Fehler beim Anlegen des Vereins" });
    }
});

// Neues Spiel anlegen i.A
app.post("/api/spiele", async (req, res) => {
    const { anstoss, heimverein, gastverein, heimtore, gasttore, statuswort } = req.body; 
    //log(`Server: Neues Spiel anlegen: ${anstoss}, ${heimverein}, ${gastverein}, ${statuswort}`);
    try {
        const result = await pool.query(
            "INSERT INTO spiele (anstoss, heimverein, gastverein, heimtore, gasttore, statuswort) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
            [anstoss, heimverein, gastverein, heimtore, gasttore, statuswort]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Fehler beim Anlegen des Spiels" });
    }
});

// --- API Endpunkt: Einen einzelnen Zeitpunkt speichern ---
app.post('/api/zeiten', async (req, res) => {
    const { zeit } = req.body;
    console.log('api zeiten', zeit);
    if (!zeit) {
        // Bei einem Fehler im Input senden wir einen 400 Bad Request zurück
        return res.status(400).json({ error: 'Zeitpunkt fehlt.' });
    }

    try {
        const result = await pool.query(
            'INSERT INTO zeiten (zeit) VALUES ($1) RETURNING *',
           [zeit]
        );

        // Wenn erfolgreich, senden wir eine 201 Created Antwort zurück
        // Die Frontend-Logik (messageArea.innerHTML etc.) wird im Frontend-JS gehandhabt
        res.status(201).json({
            message: 'Termin erfolgreich gespeichert!',
            id: result.rows[0].id,
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Fehler beim Speichern des Zeitpunkts:', error);
        // Bei einem Datenbank- oder Serverfehler senden wir einen 500 Internal Server Error zurück
        res.status(500).json({ error: 'Interner Serverfehler beim Speichern.' });
    }
});



// --- Static Files ---
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Server starten ---
app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
