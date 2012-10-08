# reqursive [![Build Status](https://secure.travis-ci.org/hughsk/reqursive.png?branch=master)](http://travis-ci.org/hughsk/reqursive)

Take a file and recursively discover all the files loaded in using `require()`.

## Installation

``` bash
$ npm install reqursive
```

## Usage

Call `reqursive` on a file, and soon after you'll get an array containing
a list of all the scripts that file requires before running.

``` javascript
var worker = require('./lib/worker.js')
  , async = require('async')

reqursive(__filename
    , function(err, files) {
        files[1].id       // 'worker.js'
        files[1].filename // 'lib/worker.js'
        files[1].module   // false

        files[2].id       // 'async'
        files[2].filename // 'node_modules/async/index.js'
        files[2].module   // true

        files.length      // 3
    })
```

You might have noticed that reqursive steers clear of the insides of `node_modules`
by default. By passing the `traverseModules` option as true you'll get back
not only the modules, but their contents as well:

``` javascript
var async = require('async')
  , reqursive = require('reqursive')

reqursive(__filename, {
    traverseModules: true    
}, function(err, files) {
    files[0].id       // 'index.js'
    files[0].filename // 'index.js'
    files[0].module   // false
    files[0].parents  // []

    files[1].id       // 'async'
    files[1].filename // 'node_modules/async/index.js'
    files[1].module   // true
    files[1].parents  // [ 'index.js' ]

    files[2].id       // 'async.js'
    files[2].filename // 'node_modules/async/lib/async.js'
    files[2].module   // false
    files[2].parents  // [ 'node_modules/async/index.js' ]
})
```

You can pass in an array of files to evaluate them together - they don't have
to be connected, but they can be. If the files are from separate directories,
the returned paths will be relative to the first file by default.

``` javascript
reqursive([
    require.resolve('async')
  , require.resolve('express')
], function(err, files) {
    files[0].filename // index.js
    files[1].filename // ../node_modules/express/index.js
})
```

If you're looking to just get the files required by a single script, you can
use `reqursive.children()`:

``` javascript
var reqursive = require('reqursive')
  , filename = require.resolve('reqursive')

reqursive.children(filename
    , function(err, children) {
        files[0].id // 'index.js'
        files[1].id // 'nub'
        files[2].id // 'async'
        files[3].id // 'detective'
    })
```

## File Properties

The `reqursive` and `reqursive.children` methods return an array of file
objects, each with the following properties:

* `id`: Either the name of the module or the name of the file, e.g. `http` or
  `index.js`

* `filename`: The path to the file. When using `reqursive`, this is relative to
  the original file. When using `reqursive.children`, the path is absolute.

* `module`: true if the file is a module: taken from `node_modules`, or a part
  of Node's core.

* `native`: true if the file is a native module, e.g. `http` or `net`, but not
  `request` or `browserify`.

* `parents`: An array of scripts that require this file.

* `mgroup`: This is equal to the id of the module this file is a part of.
  Top-level scripts, i.e. not part of a module, will have an "mgroup" equal to
  "false".

* `error`: If a syntax error was picked up when parsing this file, it'll go
  here. Handle this however you please.

## Options

The following only apply to `reqursive`, not `reqursive.children`

* `traverseModules`: Don't stop when hitting a module - keep going through the
  module's files too.

* `absolute`: Return absolute paths instead of relative.