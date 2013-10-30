var detective = require('detective')
  , async = require('async')
  , nub = require('nub')
  , fs = require('fs')
  , path = require('path')
  , mod = require('module').Module

var findPath = mod._findPath
  , lookupPaths = mod._resolveLookupPaths
  , nodeModules = mod._nodeModulePaths

/**
 * Finds a file that is required using an absolute
 * or relative path.
 *
 * @param  {String} request   The string supplied to require()
 * @param  {String} directory The directory of the file calling require()
 * @param  {Object} parent    id, filename, etc. of the file calling require()
 */
function findRelative(request, directory, parent) {
    var target = path.resolve(directory, request)
    var exists = false

    ;[
          target
        , target + '.js'
        , target + '.json'
        , target + '.coffee'
        , target + '/index.js'
    ].forEach(function(attempt) {
        var ok = (path.existsSync || fs.existsSync)(attempt)
        exists = ok || exists

        if (ok) {
            target = attempt
        }
    })

    return {
          'id': path.basename(target)
        , 'filename': target
        , 'parents': [parent.filename]
        , 'module': false
        , 'native': false
        , 'mgroup': parent.mgroup || false
    }
};

/**
 * Finds a file that is required as a module,
 * i.e. require('detective') as opposed to require('./lib/app')
 *
 * @param  {String} request   The string supplied to require()
 * @param  {Object} parent    id, filename, etc. of the file calling require()
 */
function findModule(request, parent) {
    var directory
      , filename
      , paths
      , id

    directory = path.resolve(parent.filename)
    directory = path.dirname(directory)

    paths = lookupPaths(request, {
          id: parent.id || request
        , paths: nodeModules(directory)
    })

    if (paths && paths[0] && !paths[1].length) {
        return {
              'id': request
            , 'module': true
            , 'native': true
            , 'parents': [parent.filename]
            , 'mgroup': request
        };
    } else
    if (!paths || !paths.length) {
        return false
    }

    id = paths[0]
    paths = [directory].concat(paths[1])
    filename = findPath(id, paths)

    return {
          'id': id
        , 'filename': filename
        , 'parents': [parent.filename]
        , 'module': true
        , 'native': false
        , 'mgroup': id
    };
};

function entryObject(filename) {
    return {
          id: path.basename(filename)
        , parents: []
        , module: false
        , mgroup: false
        , filename: filename
    };
};

/**
 * Get a file's child scripts: the files pulled
 * in using require().
 *
 * @param  {String}   parent   The file to query
 * @param  {Function} callback
 */
function getChildren(parent, callback) {
    if (typeof parent === 'string') {
        parent = { filename: parent }
    }

    var filename = parent.filename

    fs.readFile(filename, 'utf8', function(err, body) {
        if (err) return callback(null, [])

        // Save Esprima from freaking out about
        // hashbangs
        body = body.split('\n')
        if (/^\#!\//.test(body[0])) {
            body = body.slice(1)
        }
        body = body.join('\n')

        try {
            var modules = detective(body);
        } catch(e) {
            return callback(e)
        }

        modules = modules.map(function(id) {
            if (id.match(/^[\.\/]/)) {
                return findRelative(id
                    , path.resolve(path.dirname(filename))
                    , parent
                );
            } else {
                return findModule(id, parent);
            }
        }).filter(function(script) {
            return script && script.id
        })

        modules = nub.by(modules, function(one, two) {
            if (one.module && two.module) {
                return one.id === two.id
            }
            return one.filename === two.filename
        })

        callback(null, modules)
    })
};

/**
 * Pulls in a list of all the files required,
 * recursively, starting from a single file.
 *
 * For now there's only one option: "traverseModules".
 * This is enabled by default, but setting it to false
 * will ignore the contents of other modules.
 *
 * @param  {String}   entry    The initial filename
 * @param  {Object}   options  (optional)
 * @param  {Function} callback (optional)
 */
function getChildrenRecursive(entry, options, callback) {
    var results = {}
      , entry = Array.isArray(entry) ? entry : [entry]
      , first = true
      , queue

    if (typeof options === 'function') {
        callback = options
        options = {}
    }

    callback = callback || function(){}

    options = options || {}
    options.traverseModules = !!options.traverseModules

    entry = entry.map(function(filename) {
        filename = path.resolve(filename)
        results[filename] = entryObject(filename)
        return filename
    })
    queue = [].concat(entry)

    async.whilst(function() {
        return queue.length > 0
    }, iteration
     , finished)

    function iteration(next) {
        var nextFile = queue.shift()
        if (!nextFile) return next()
        var absolute = path.resolve(nextFile)

        getChildren(results[absolute] || absolute, function(err, children) {
            if (err && first) {
                return next(err)
            } else
            if (err) {
                results[absolute].error = err
                return next()
            }

            first = false

            children.forEach(function(child) {
                if (results[child.filename]) {
                    results[child.filename].parents.push(absolute)
                    return
                }

                results[
                    child.native ? 'native::' + child.id :
                    child.filename
                ] = child

                if (child.native) return;

                if (!child.module || options.traverseModules) {
                    queue.push(child.filename)
                }
            })

            next()
        });
    };

    function finished(err) {
        if (err) return callback(err);

        var response = []

        Object.keys(results).forEach(function(key) {
            var dirname = path.dirname(entry[0])
              , relative = path.relative(dirname, key)

            results[key].parents = nub(
                results[key].parents || []
            ).map(function(script) {
                return options.absolute ? script : path.relative(dirname, script)
            })

            if (results[key].filename && !options.absolute) {
                results[key].filename = path.relative(dirname, results[key].filename)
            }

            response.push(results[key])
        });

        callback(null, response)
    };
};

module.exports = getChildrenRecursive

module.exports.children = function children(filename, callback) {
    var absolute = path.resolve(filename)

    getChildren(filename, function(err, children) {
        if (err) return callback(err)

        children.unshift(entryObject(absolute))
        callback(null, children)
    })
};
