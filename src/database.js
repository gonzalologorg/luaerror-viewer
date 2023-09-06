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

connection.connect((err) => {
    if (err) {
        console.log("Error connecting to database");
        return;
    }

    console.log("Connected to database, downloading cache");
    dbEmitter.emit("initialized");
});

module.exports = {
    conn : connection,
    event : dbEmitter
};