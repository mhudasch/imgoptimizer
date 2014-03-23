#!/usr/bin/env node

    /**
     * Module dependencies.
     */

var fs = require('fs')
  , async = require('async')
  , program = require('commander')
  , path = require('path')
  , basename = path.basename
  , dirname = path.dirname
  , resolve = path.resolve
  , exists = fs.existsSync || path.existsSync
  , join = path.join
  , optimizer = require('../');

    // options

program
.version(require('../package.json').version)
.usage('[file ...]')
.option('-o, --out <file>', 'The result file');

program.on('--help', function(){
    console.log('  Examples:');
    console.log('');
    console.log('    # optimize image file');
    console.log('    $ imgoptimizer bigfile.jpg --out smalllfile.jpg');
    console.log('');
});

program.parse(process.argv);

    // left-over args are file paths

var files = program.args;

    // compile files

if (files.length) {
    var infile = files[0],
        outfile = program.out || path.dirname(infile) + '/' + path.basename(infile).replace(path.extname(infile), '') + '_small' + path.extname(infile);
    fs.exists(infile, function(exists) {
        if(exists) {
            optimize(infile, outfile);
        } else {
            throw 'The source file does not exist.';
        }
    });    
} /*else {
    stdin();
}*/

function optimize(infile, outfile){
    var re = /\.png$|\.jpg$|\.jpeg|\.gif/, 
        type = path.extname(infile).replace('.', '');

    async.waterfall([
        function(cb) {
            fs.lstat(infile, function(err, stat) {
                if (err) throw err;
                if(stat.isFile() && re.test(infile)) {
                    cb(null);
                } else {
                    cb('Unsupported file type.');
                }                
            });
        },
        function(cb) {
            fs.readFile(infile, 'base64', function(err, str) {
                if (err) cb(err);                
                if(type === 'png') {
                    optimizer.png(str, function(err, result) { cb(err, result); });
                } else if(type == 'jpg') {
                    optimizer.jpg(str, function(err, result) { cb(err, result); });
                } else if(type == 'jpeg') {
                    optimizer.jpeg(str, function(err, result) { cb(err, result); });
                } else if(type == 'gif') {
                    optimizer.gif(str, function(err, result) { cb(err, result); });
                }
            });
        },
        function(result, cb) {
            console.log(result.toResultString());
            fs.writeFile(outfile, result.result, 'base64', function(err) {
                cb(err);
            });
        }],
        function(err, results){
            if(err) throw err;
            console.log('...done');
        });
}