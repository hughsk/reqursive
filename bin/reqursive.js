#!/usr/bin/env node

var parseArgs = require('minimist');
var path = require('path');

var reqursive = require('../index.js');

function main(opts) {
    var fileName = path.resolve(opts._[0]);
    var dirName = path.dirname(fileName);

    reqursive(fileName, {
        traverseModules: false
    }, function (err, files) {
        if (err) {
            throw err;
        }

        var nonModules = files.filter(function (file) {
            return !file.module && !file.mgroup;
        }).map(function (file) {
            return path.join(dirName, file.filename);
        });

        console.log(nonModules.join('\n'));
    });
}

if (require.main === module) {
    main(parseArgs(process.argv.slice(2)));
}
