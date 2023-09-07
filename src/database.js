const mysql = require("mysql");
const config = require("../config.json");
const EventEmitter = require("events");
const dbEmitter = new EventEmitter();
const connection = mysql.createPool({
    host: config.host,
    user: config.user,
    password: config.password,
    database: config.database,
    connectionLimit : 10,
});

function process(entry) {
    entry.name = entry.error.slice(0, 192);
    entry.stack = entry.stack.replace(/'/gm, "");
    return entry;
}

connection.query(`CREATE TABLE IF NOT EXISTS errors (
    id INT NOT NULL AUTO_INCREMENT,
    hash VARCHAR(255) NOT NULL,
    error TEXT NOT NULL,
    stack TEXT NOT NULL,
    realm VARCHAR(8) NOT NULL,
    PRIMARY KEY (id));`, function(err){
        console.log("Connected to database, downloading cache");
        let cache = {};
        connection.query("SELECT * FROM errors", (err, rows, fields) => {
            if (err) {
                console.log("Error downloading cache\n" + err);
                return;
            }
    
            for (var i = 0; i < rows.length; i++) {
                cache[rows[i].hash] = process(rows[i]);
            }
    
            dbEmitter.emit("initialized", cache);
        });

    }
);

module.exports = {
    conn : connection,
    event : dbEmitter,
    process : process
};