    // Author: Martin Hudasch
    // imgoptimizer.js

var OptimizationResult = (function () {
    'use strict';
    function OptimizationResult(sourceFile, resultFile) {
        this.originalFileName = sourceFile;
        this.resultFileName = resultFile;
        this.originalFileSize = 0;
        this.resultFileSize = 0;
        this.saving = 0;
        this.savingPercentage = 0;
        this.result = undefined;
    }

    OptimizationResult.prototype.toResultString = function () {
        return 'Before: ' + this.originalFileSize + ' bytes \n' +
               'After: ' + this.resultFileSize + ' bytes \n' +
               'Saving: ' + this.saving + ' bytes \n' +
               'Percentage: ' + this.savingPercentage + '%';
    }

    OptimizationResult.prototype.toString = function () {
        return '[object OptimizationResult <' + this.toResultString() + '>]';
    };

    OptimizationResult.prototype.toJson = function () {
        return {
            message: this.toResultString(),
            originalSize: this.originalFileSize,
            resultSize: this.resultFileSize,
            saving: this.saving,
            savingPercentage: this.savingPercentage,
            resultBase64: this.result
        };
    };
    OptimizationResult.prototype.toJsonString = function () {
        return JSON.stringify(this.toJson());
    };
    return OptimizationResult;
}()),
Optimizer = (function () {
    'use strict';
    var fs = require('fs'),
        log4js = require('log4js'),
        logger,
        async = require('async'),
        exec = require('child_process').exec,
        toolpath,
        temppath = 'tmp',
        nodetemppathformat, proctemppathformat, pngcommand, jpgcommand, gifcommand;

    if (process.platform === 'linux') {
        toolpath = __dirname + '/../bin/linux';
        nodetemppathformat = __dirname + '/../' + temppath + '/{0}{1}';
        proctemppathformat = nodetemppathformat;
        pngcommand = 'cd ' + toolpath + ' && ./png {0} {1}';
        jpgcommand = 'cd ' + toolpath + ' && ./jpg {0} {1}';
        gifcommand = 'cd ' + toolpath + ' && ./gif {0} {1}';
    }
    else if (process.platform === 'win32') {
        toolpath = __dirname + '\\..\\bin\\windows';
        nodetemppathformat = __dirname + '\\..\\' + temppath + '\\{0}{1}';
        proctemppathformat = '"' + nodetemppathformat + '"';
        pngcommand = 'cmd /c "cd "' + toolpath + '" && png.cmd {0} {1}"';
        jpgcommand = 'cmd /c "cd "' + toolpath + '" && jpg.cmd {0} {1}"';
        gifcommand = 'cmd /c "cd "' + toolpath + '" && gif.cmd {0} {1}"';
    } else {
        throw 'unknown os';
    }

    function Optimizer() {
        log4js.configure(__dirname + '/../config/log4js-release.json', {});
        logger = log4js.getLogger('optimizer');
    }

    Optimizer.prototype.png = function (base64Source, callback) {
        if (!base64Source || base64Source === '') {
            callback('no base64', null);
            return;
        }
        Optimizer.execute(base64Source, '.png', callback);
    };
    Optimizer.prototype.jpg = function (base64Source, callback) {
        if (!base64Source || base64Source === '') {
            callback('no base64', null);
            return;
        }
        Optimizer.execute(base64Source, '.jpg', callback);
    };
    Optimizer.prototype.gif = function (base64Source, callback) {
        if (!base64Source || base64Source === '') {
            callback('no base64', null);
            return;
        }
        Optimizer.execute(base64Source, '.gif', callback);
    };
    Optimizer.s4 = function () {
        return Math.floor((1 + Math.random()) * 0x10000)
               .toString(16)
               .substring(1);
    };
    Optimizer.guid = function () {
        return Optimizer.s4() + Optimizer.s4() + '-' + Optimizer.s4() + '-' + Optimizer.s4() + '-' +
               Optimizer.s4() + '-' + Optimizer.s4() + Optimizer.s4() + Optimizer.s4();
    };
    Optimizer.execute = function (base64Source, extension, resultCallback) {
        var uuid = Optimizer.guid();
        async.waterfall([
            function (callback) {
                fs.exists(nodetemppathformat.replace('{0}{1}', ''), function (exists) {
                    if (exists) {
                        callback(null);
                    } else {
                        fs.mkdir(nodetemppathformat.replace('{0}{1}', ''), function (err) {
                            callback(err);
                        });
                    }
                });
            },
            function (callback) {
                var sn = nodetemppathformat.replace('{0}', uuid).replace('{1}', extension),
                    rn = nodetemppathformat.replace('{0}', uuid).replace('{1}', '_result' + extension);
                fs.writeFile(sn, base64Source, 'base64', function (err) {
                    callback(err, sn, rn);
                });
            },
            function (sn, rn, callback) {
                var psn = proctemppathformat.replace('{0}', uuid).replace('{1}', extension),
                    prn = proctemppathformat.replace('{0}', uuid).replace('{1}', '_result' + extension),
                    procc = function (err, stdout, stderr) {
                        if (err && err.message) {
                            // pngout process prints optimization states into stderr
                            if (/Processing:/g.test(stderr) && /Output file:/g.test(stderr)) {
                                logger.debug(err.message);
                                callback(null, stdout, sn, rn);
                            // gifsicle process prints warnings into strerr
                            } else if(/gifsicle:/g.test(stderr) && !(/error:/g.test(stderr))){
                                logger.debug(stderr);
                                callback(null, stdout, sn, rn);
                            } else {
                                if(err === undefined) {
                                    err = { stderr: stderr };
                                } else {
                                    err.stderr = stderr
                                }                                
                                callback(err, null);
                            }
                        } else {
                            callback(null, stdout, sn, rn);
                        }
                    };
                if (extension === '.png') {
                    exec(pngcommand.replace('{0}', psn).replace('{1}', prn), procc);
                } else if (extension === '.jpg') {
                    exec(jpgcommand.replace('{0}', psn).replace('{1}', prn), procc);
                } else if (extension === '.gif') {
                    exec(gifcommand.replace('{0}', psn).replace('{1}', prn), procc);
                }
            },
            function (message, sn, rn, callback) {
                var optimizationResult;
                async.filter([sn, rn], fs.exists, function (results) {
                    // results now equals an array of the existing files
                    async.map(results, fs.stat, function (err, results) {
                        if (results.length === 2) {
                            optimizationResult = new OptimizationResult(sn, rn);
                            optimizationResult.originalFileSize = results[0] == undefined ? 0 : results[0].size || 0;
                            optimizationResult.resultFileSize = results[1] == undefined ? 0 : results[1].size || 0;
                            optimizationResult.saving = optimizationResult.originalFileSize - optimizationResult.resultFileSize;
                            optimizationResult.savingPercentage = Math.round(100 - optimizationResult.resultFileSize / optimizationResult.originalFileSize * 100);
                            callback(err, message, optimizationResult);
                        } else {
                            callback('optimazion process crashed for unknown reason', null);
                        }
                    });
                })
            },
            function (message, cr, callback) {
                fs.readFile(cr.resultFileName, 'base64', function (err, data) {
                    cr.result = data;
                    callback(err, message, cr);
                });
            },
            function (message, cr, callback) {
                async.each([cr.originalFileName, cr.resultFileName], fs.unlink, function (err, results) {
                    callback(err, message, cr);
                });
            }
        ],
        function (err, message, cr) {
            if (err) { resultCallback(err, null); return; }
            if (message) { logger.debug(message); }
            resultCallback(null, cr);
        });
    };
    return Optimizer;
}());

exports.Optimizer = Optimizer;
