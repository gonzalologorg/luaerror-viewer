console.log("Initializing Express Module")
const config = require("./../config.json");
const express = require("express");
const favicon = require('serve-favicon')
const app = express();
const fs = require("fs");
const path = require('path')

app.set("view engine", "pug");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(favicon(path.join(__dirname, './../public', 'favicon.ico')));

const {conn, event, process} = require("./database.js");

var cache = {};
event.on("initialized", (data) => {
    console.log("Cache downloaded (" + Object.keys(data).length + " entries)");
    cache = data;
})

app.post("/", (req, res) => {
    var body = req.body;
    if (!body.hash || !body.error || (body.stack != "" && !body.stack) || !body.realm) {
        console.log("Received missing parameter from " + req.hostname)
        res.status(400).send("Missing parameters");
        return;
    }

    if (parseInt(body.hash) || (body.realm != "client" && body.realm != "server")) {
        console.log("Hash/realm input it's invalid");
        res.status(400).send("Error already logged");
    }

    if (cache[body.hash]) {
        console.log("Error it's already logged from " + ipAddresses)
        res.status(200).send("Error already logged");
        return;
    }

    body.hash = parseInt(body.hash);
    body.error = conn.escape(body.error);
    body.stack = conn.escape(body.stack);
    body.realm = body.realm;

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
    console.log("Starting HTTP server");
    var http = require('http');
    server = http.createServer(app);
} else {
    console.log("Starting HTTPS server");
    var https = require('https');
    server = https.createServer({
        key: fs.readFileSync(config.privateKeyPath, 'utf8'),
        cert: fs.readFileSync(config.certificatePath, 'utf8')
    }, app);
}

server.listen(config.port, () => {
    console.log("Server listening on port " + config.port);
});