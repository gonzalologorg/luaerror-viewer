const pug = require("pug");
const compiledFunction = pug.compileFile('views/index.pug');

module.exports = {pug, compiledFunction};