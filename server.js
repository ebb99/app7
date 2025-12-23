// ===============================
// ENV
// ===============================
if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}

// ===============================
// Imports
// ===============================
const express = require("express");
const pg = require("pg");
const path = require("path");
const cron = require("node-cron");
const session = require("express-session");
const bcrypt = require("bcrypt");

// ===============================
// App
// ===============================
const app = express();
const PORT = process.env.PORT || 8080;

// ===============================
// Konstanten
// ===============================
const SPIELZEIT_MINUTEN = 3;
const NACHSPIELZEIT_MINUTEN = 2;

// ===============================
// Middleware
// ===============================
app.use(express.json());
app.use(express.static("public"));

app.use(session({
    secret: process.env.SESSION_SECRET || "super-geheim",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24
    }
}));

// ===============================
// Auth Middleware
// ===============================
function requireLogin(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({ error: "Login erforderlich" });
    }
    next();
}

function requireTipper(req, res, next) {
    if (req.session.user.role !== "tipper") {
        return res.status(403).json({ error: "Nur Tipper erlaubt" });
    }
    next();
}

// ===============================
// Datenbank
// ===============================
const isRailway =
    process.env.DATABASE_URL &&
    !process.env.DATABASE_URL.includes("localhost");

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isRailway ? { rejectUnauthorized: false } : false
});

pool.connect()
    .then(client => {
        client.release();
        console.log("PostgreSQL verbunden");
    })
    .catch(err => {
        console.error("DB Fehler:", err);
    });

// ===============================
// Cron Jobs
// ===============================
cron.schedule("* * * * *", async () => {
    try {
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
    } catch (err) {
        console.error("Cron Fehler:", err);
    }
});

// ===============================
// Auth Routen
// ===============================
app.post("/api/login", async (req, res) => {
    const { name, password } = req.body;

    try {
        const result = await pool.query(
            "SELECT id, name, role, password FROM users WHERE name = $1",
            [name]
        );

        if (result.rowCount === 0) {
            return res.status(401).json({ error: "Login fehlgeschlagen" });
        }

        const user = result.rows[0];
        const valid = await bcrypt.compare(password, user.password);

        if (!valid) {
            return res.status(401).json({ error: "Login fehlgeschlagen" });
        }

        req.session.user = {
            id: user.id,
            name: user.name,
            role: user.role
        };

        res.json({ message: "Login erfolgreich" });

    } catch (err) {
        res.status(500).json({ error: "Login-Fehler" });
    }
});


app.post("/api/logout", (req, res) => {
    req.session.destroy(() => {
        res.json({ message: "Logout erfolgreich" });
    });
});

// ===============================
// Tipps
// ===============================
app.get("/api/tips", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                t.id AS tip_id,
                t.heimtipp,
                t.gasttipp,
                u.name AS user_name,
                s.heimverein,
                s.gastverein,
                s.anstoss,
                s.statuswort
            FROM tips t
            JOIN users u ON u.id = t.user_id
            JOIN spiele s ON s.id = t.spiel_id
            ORDER BY s.anstoss, u.name
        `);

        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Fehler beim Laden der Tipps" });
    }
});

app.post("/api/tips", requireLogin, requireTipper, async (req, res) => {
    const { spiel_id, heimtipp, gasttipp } = req.body;
    const user_id = req.session.user.id;

    if (
        spiel_id === undefined ||
        heimtipp === undefined ||
        gasttipp === undefined
    ) {
        return res.status(400).json({ error: "Unvollständige Daten" });
    }

    try {
        const spiel = await pool.query(
            "SELECT statuswort FROM spiele WHERE id = $1",
            [spiel_id]
        );

        if (
            spiel.rowCount === 0 ||
            spiel.rows[0].statuswort !== "geplant"
        ) {
            return res.status(403).json({ error: "Tippen nicht erlaubt" });
        }

        const tip = await pool.query(`
            INSERT INTO tips (user_id, spiel_id, heimtipp, gasttipp)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id, spiel_id)
            DO UPDATE SET
                heimtipp = EXCLUDED.heimtipp,
                gasttipp = EXCLUDED.gasttipp,
                created_at = NOW()
            RETURNING *
        `, [user_id, spiel_id, heimtipp, gasttipp]);

        res.json(tip.rows[0]);

    } catch (err) {
        res.status(500).json({ error: "Fehler beim Speichern" });
    }
});

// ===============================
// Spiele
// ===============================
app.get("/api/spiele", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM spiele ORDER BY anstoss"
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Fehler beim Laden der Spiele" });
    }
});

app.post("/api/spiele", requireLogin, requireAdmin, async (req, res) => {
    const { anstoss, heimverein, gastverein, heimtore, gasttore, statuswort } = req.body;

    try {
        const result = await pool.query(`
            INSERT INTO spiele (anstoss, heimverein, gastverein, heimtore, gasttore, statuswort)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [anstoss, heimverein, gastverein, heimtore, gasttore, statuswort]);

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Fehler beim Anlegen des Spiels" });
    }
});

app.patch("/api/spiele/:id/ergebnis", requireLogin, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { heimtore, gasttore, statuswort } = req.body;

    if (heimtore === undefined || gasttore === undefined) {
        return res.status(400).json({ error: "Tore fehlen" });
    }

    try {
        const result = await pool.query(`
            UPDATE spiele
            SET heimtore = $1,
                gasttore = $2,
                statuswort = $3
            WHERE id = $4
            RETURNING *
        `, [heimtore, gasttore, statuswort, id]);

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Fehler beim Update" });
    }
});
function requireAdmin(req, res, next) {
    if (!req.session.user || req.session.user.role !== "admin") {
        return res.status(403).json({ error: "Nur Admin" });
    }
    next();
}



app.post("/api/users", requireLogin, requireAdmin, async (req, res) => {
    const { name, password, role } = req.body;

    const hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
        "INSERT INTO users (name, password, role) VALUES ($1, $2, $3) RETURNING id, name, role",
        [name, hash, role]
    );

    res.json(result.rows[0]);
});


// ===============================
// Static
// ===============================
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ===============================
// Start
// ===============================
app.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
});
