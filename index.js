module.exports = (function () {
    var Optimizer = require('./lib/imgoptimizer.js').Optimizer,
        c = new Optimizer();
    return {
        png: c.png,
        jpg: c.jpg,
        jpeg: c.jpg,
        gif: c.gif,
    }
}());