const mysql = require("mysql");
const config = require("../config.json");
const EventEmitter = require("events");
const dbEmitter = new EventEmitter();
const connection = mysql.createPool({
    host: config.host,
    user: config.user,
    password: config.password,
    database: config.database,
    connectionLimit: 10,
});

function process(entry) {
    entry.name = entry.error.slice(0, 192);
    entry.stack = entry.stack.replace(/'/g, "").replace(/\\n/g, "<br />");
    return entry;
}

connection.query(
    `CREATE TABLE IF NOT EXISTS errors (
    id INT NOT NULL AUTO_INCREMENT,
    hash VARCHAR(255) NOT NULL,
    error TEXT NOT NULL,
    stack TEXT NOT NULL,
    realm VARCHAR(8) NOT NULL,
    PRIMARY KEY (id));`,
    (err) => {
        console.log("Connected to database, downloading cache");
        let cache = {};
        connection.query("SELECT * FROM errors", (err, rows) => {
            if (err) {
                console.log("Error downloading cache\n" + err);
                return;
            }

            for (const row of rows) {
                cache[row.hash] = process(row);
            }

            dbEmitter.emit("initialized", cache);
        });
    }
);

module.exports = {
    conn: connection,
    event: dbEmitter,
    process: process,
};
