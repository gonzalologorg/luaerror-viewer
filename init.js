const express = require("express");
const config = require("./config.json");
const app = express();
const fs = require("fs");
const requestIP = require('request-ip');

app.set("view engine", "pug");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const {conn, event} = require("./src/database.js");
const {pug, compiledFunction} = require("./src/view.js");
pug.app = app;

var cache = {};

function process(entry) {
    entry.name = entry.error.slice(0, 192);
    return entry;
}

event.on("initialized", () => {
    conn.query(`
        CREATE TABLE IF NOT EXISTS errors (
            id INT NOT NULL AUTO_INCREMENT,
            hash VARCHAR(255) NOT NULL,
            error TEXT NOT NULL,
            stack TEXT NOT NULL,
            realm VARCHAR(8) NOT NULL,
            PRIMARY KEY (id));
    `, function(err){
        if (err) {
            console.log("Error creating errors table");
        }

        conn.query("SELECT * FROM errors", (err, rows, fields) => {
            if (err) {
                console.log("Error downloading cache\n" + err);
                return;
            }
    
            for (var i = 0; i < rows.length; i++) {
                cache[rows[i].hash] = process(rows[i]);
            }
    
            console.log("Cache downloaded (" + rows.length + " entries)");
        });
    })
})

app.post("/", (req, res) => {
    const ipAddresses = requestIP.getClientIp(req);
    if (config.whitelist.indexOf(ipAddresses) == -1) {
        console.log("Received request from " + ipAddresses)
        res.status(400).send("You're not whitelisted");
        return;
    }

    var body = req.body;
    if (!body.hash || !body.error || (body.stack != "" && !body.stack) || !body.realm) {
        console.log("Received missing parameter from " + ipAddresses)
        res.status(400).send("Missing parameters");
        return;
    }

    if (cache[body.hash]) {
        console.log("Error it's already logged from " + ipAddresses)
        res.status(200).send("Error already logged");
        return;
    }

    body.hash = conn.escape(body.hash);
    body.error = conn.escape(body.error);
    body.stack = conn.escape(body.stack);
    body.realm = conn.escape(body.realm);

    conn.query("INSERT INTO errors (hash, error, stack, realm) VALUES (?, ?, ?, ?)", [body.hash, body.error, body.stack, body.realm], (err, rows, fields) => {
        if (err) {
            console.log("Error inserting error into database\n" + err);
            res.status(500).send("Error inserting error into database");
            return;
        }

        cache[body.hash] = process(body);
        console.log("Error logged:\n" + body.error);
        res.status(200).send("Error logged:\n" + body.error);
    })
})

app.get("/", (req, res) => {
    res.render("index.pug", {cache: cache});
})

//quiero un delete que elimine una entrada en base de datos
app.delete("/delete/:id", (req, res) => {
    let hash = req.params.id;
    if (!hash) {
        res.send("Missing parameters").status(400);
        return;
    }
    
    hash = conn.escape(hash);
    if (!cache[hash]) {
        res.send("Error not logged").status(200);
        return;
    }

    conn.query("DELETE FROM errors WHERE hash = ?", [hash], (err, rows, fields) => {
        if (err) {
            console.log("Error deleting error from database\n" + err);
            res.status(500).send("Error deleting error from database");
            return;
        }

        delete cache[hash];
        res.status(200).send("Error deleted");
    })
})

var server;
if (!config.useSSL) {
    var http = require('http');
    server = http.createServer(app);
} else {
    var https = require('https');
    server = https.createServer({
        key: fs.readFileSync(config.privateKeyPath, 'utf8'),
        cert: fs.readFileSync(config.certificatePath, 'utf8')
    }, app);
}

server.listen(config.port);