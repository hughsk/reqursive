var assert = require('assert')
  , path = require('path')
  , reqursive = require('../index')

var mocks = {
      'relative':      __dirname + '/mock/relative.js'
    , 'modules':       __dirname + '/mock/modules.js'
    , 'native':        __dirname + '/mock/native.js'
    , 'recursive':     __dirname + '/mock/recursive.js'
    , 'duplicates':    __dirname + '/mock/duplicates.js'
    , 'invalid':       __dirname + '/mock/invalid.js'
    , 'invalidParent': __dirname + '/mock/invalid-parent.js'
    , 'mgroups':       __dirname + '/mock/mgroups.js'
    , 'deeper':        __dirname + '/mock/deeper/index.js'
    , 'overlap':       __dirname + '/mock/deeper/other.js'
}

suite('reqursive.children', function() {
    var children = reqursive.children

    function count(file, total) {
        return function count(done) {
            children(file, function(err, files) {
                assert.ifError(err)
                assert.equal(files.length, total)
                done()
            })
        };
    };

    function itself(file, params) {
        return function itself(done) {
            children(file, function(err, files) {
                assert.ifError(err)

                assert.equal(files[0].id, path.basename(file))
                assert.equal(files[0].filename, path.resolve(file))
                assert.equal(files[0].module, params.module)
                assert.equal(files[0].module, params.native)

                done()
            })
        };
    };

    function parent(file) {
        var absolute = path.resolve(file)

        return function parent(done) {
            children(file, function(err, files) {
                assert.ifError(err)

                files.slice(1).map(function(file) {
                    assert.ok(file.parents.indexOf(absolute) !== -1)
                })

                done()
            })
        };
    };

    function appropriate(filename, matching, key) {
        return function(done) {
            children(filename, function(err, files) {
                assert.ifError(err)

                files.slice(1).map(function(file) {
                    var match = key(files[0], file)
                      , index = matching.indexOf(match)

                    assert.notEqual(index, -1)
                    matching.splice(index, 1)
                })

                assert.equal(matching.length, 0)
                done()
            })
        };
    };

    suite('Relative requires', function() {
        test('Should return required files, including itself'
            , count(mocks.relative, 4))

        test('Should return itself as the first element'
            , itself(mocks.relative, {
                'native': false,
                'module': false
            }))

        test('Should have the first file as their parent'
            , parent(mocks.relative))

        test('Should include the appropriate filenames'
            , appropriate(mocks.relative, [
                  '../../index.js'
                , '../test.js'
                , 'modules.js'
            ]
            , function(parent, child) {
                return path.relative(path.dirname(parent.filename), child.filename)
            }));
    })

    suite('Module requires', function() {
        test('Should return required files, including itself'
            , count(mocks.modules, 4))

        test('Should return itself as the first element'
            , itself(mocks.modules, {
                'native': false,
                'module': false
            }))

        test('Should have the first file as their parent'
            , parent(mocks.modules))

        test('Should include a filename', function(done) {
            children(mocks.modules, function(err, files) {
                assert.ifError(err)

                files.slice(1).map(function(file) {
                    assert.ok(file.filename)
                })

                done()
            })
        })

        test('Should include the appropriate IDs'
            , appropriate(mocks.modules, [
                  'async'
                , 'nub'
                , 'detective'
            ]
            , function(parent, child) {
                return child.id
            }));

        test('Should be marked as modules, but not native', function(done) {
            children(mocks.modules, function(err, files) {
                assert.ifError(err)

                files.slice(1).map(function(file) {
                    assert.ok(file.module)
                    assert.ok(!file.native)
                })

                done()
            })
        })
    })

    suite('Native requires', function() {
        test('Should return required files, including itself'
            , count(mocks.native, 3))

        test('Should return itself as the first element'
            , itself(mocks.native, {
                'native': false,
                'module': false
            }))

        test('Should have the first file as their parent'
            , parent(mocks.native))

        test('Should be marked as native modules', function(done) {
            children(mocks.native, function(err, files) {
                assert.ifError(err)

                files.slice(1).map(function(file) {
                    assert.ok(file.module)
                    assert.ok(file.native)
                })

                done()
            })
        })

        test('Should not have a filename', function(done) {
            children(mocks.native, function(err, files) {
                assert.ifError(err)

                files.slice(1).map(function(file) {
                    assert.ok(!file.filename)
                })

                done()
            })
        })

        test('Should include the appropriate IDs'
            , appropriate(mocks.native, [
                  'http'
                , 'fs'
            ]
            , function(parent, child) {
                return child.id
            }));
    })

    suite('Duplicate requires', function() {
        test('Should only be included once'
            , appropriate(mocks.duplicates, [
                  'http'
                , 'async'
                , 'test.js'
                , 'relative.js'
                , 'recursive.js'
                , 'modules.js'
            ]
            , function(parent, child) {
                return child.id
            }));
    })

    suite('Invalid Syntax', function(done) {
        test('Should return an error in the callback', function(done) {
            children(mocks.invalid, function(err, files) {
                assert.ok(err)
                done()
            })
        })
    })
})

suite('reqursive', function() {
    function expect(entry, options, params, values, iterator) {
        return function(done) {
            reqursive(entry, options, function(err, files) {
                assert.ifError(err)

                files.forEach(function(file) {
                    var key = iterator(file, files)
                      , index = values.indexOf(key)

                    assert.notEqual(index, -1)
                    values.splice(index, 1)
                })

                if (params.strict) assert.equal(values.length, 0)
                done()
            })
        };
    };

    suite('Require Loops', function() {
        test('Should allow for the original file to have a parent', function(done) {
            reqursive(mocks.recursive, {
                traverseModules: true
            }, function(err, files) {
                assert.ifError(err);
                assert.equal(files[0].parents[0], 'duplicates.js');
                done()
            })
        })

        test('Should allow for scripts to be parents of each other', function(done) {
            reqursive(mocks.recursive, {
                traverseModules: true
            }, function(err, files) {
                var duplicate = false

                assert.ifError(err);
                assert.equal(files[0].parents[0], 'duplicates.js');

                for (var i = 0; i < files.length; i += 1) {
                    if (files[i].id === 'duplicates.js') {
                        duplicate = files[i]
                        break
                    }
                }

                assert.ok(duplicate)
                assert.notEqual(duplicate.parents.indexOf(
                    path.basename(mocks.recursive)
                ), -1)
                done()
            })
        })
    })

    suite('Duplicate require statements', function() {
        test('Should only appear once', function(done) {
            reqursive(mocks.recursive, {
                traverseModules: true
            }, function(err, files) {
                var found = []

                files.map(function(file) {
                    assert.equal(found.indexOf(file), -1)
                    found.push(file)
                })

                assert.equal(found.length, files.length)
                done()
            })
        })
    })

    suite('Invalid Scripts', function() {
        test('Should return an error if the parent is invalid', function(done) {
            reqursive(mocks.invalid, function(err) {
                assert.ok(err); done()
            })
        })
        test('Should not return an error if only a child is invalid', function(done) {
            reqursive(mocks.invalidParent, function(err) {
                assert.ifError(err); done()
            })
        })
        test('Invalid child scripts should contain an error property', function(done) {
            reqursive(mocks.invalidParent, function(err, files) {
                assert.ifError(err);
                assert.ok(files[1].error)
                done();
            })
        })
    });

    suite('Module Groups', function() {
        test('Scripts outside of any modules should have "mgroup" set to "false"', function(done) {
            reqursive(mocks.relative, {
                traverseModules: false
            }, function(err, files) {
                assert.ifError(err)
                
                files = files.filter(function(file) {
                    return !file.module
                })

                assert.ok(files.length)

                files.forEach(function(file) {
                    assert.equal(file.mgroup, false)
                })

                done()
            })
        })

        test('A script\'s "mgroup" should be the ID of the closest module ancestor', function(done) {
            reqursive(mocks.mgroups, {
                traverseModules: true
            }, function(err, files) {
                var modules = files.filter(function(file) {
                    return file.module
                }).reduce(function(memo, file) {
                    memo[file.id] = file 
                    return memo
                }, {});

                assert.ifError(err)

                assert.ok(files.length)

                files.forEach(function(file) {
                    if (!file.parents.length) {
                        assert.equal(file.mgroup, false)
                    } else
                    if (file.module) {
                        assert.equal(file.mgroup, file.id)
                    } else {
                        assert.equal(file.mgroup, 'fake')
                    }
                })

                done()
            })
        })
    })

    suite('Native modules', function() {
        test('Should not have a filename property', function(done) {
            reqursive(mocks.recursive, {
                traverseModules: true
            }, function(err, files) {
                assert.ifError(err)

                var nativeFiles = files.filter(function(file) {
                    return !!file.native
                })
                assert.ok(nativeFiles.length)
                nativeFiles = nativeFiles.filter(function(file) {
                    return file.filename
                })
                assert.ok(!nativeFiles.length)
                done()
            })
        })
    })

    suite('Multiple Entry Points', function() {
        test('Should be relative to the first file (#1)'
            , expect([
                  mocks.mgroups
                , mocks.deeper
            ], {
                traverseModules: true
            }, {
                strict: true
            }, [
                  'mgroups.js'
                , 'deeper/index.js'
                , 'deeper/other.js'
                , '../node_modules/fake/index.js'
                , '../node_modules/fake/other.js'
                , '../node_modules/fake/another.js'
            ], function(file, all) {
                return file.filename || file.id
            }))

        test('Should be relative to the first file (#2)'
            , expect([
                  mocks.deeper
                , mocks.mgroups
            ], {
                traverseModules: true
            }, {
                strict: true
            }, [
                  '../mgroups.js'
                , 'index.js'
                , 'other.js'
                , '../../node_modules/fake/index.js'
                , '../../node_modules/fake/other.js'
                , '../../node_modules/fake/another.js'
            ], function(file, all) {
                return file.filename || file.id
            }))

        test('Overlapping dependencies should not interfere with results'
            , expect([
                  mocks.deeper
                , mocks.mgroups
                , mocks.mgroups
                , mocks.overlap
                , mocks.overlap
            ], {
                traverseModules: true
            }, {
                strict: true
            }, [
                  'index.js other.js'
                , 'other.js index.js'
                , '../mgroups.js '
                , '../../node_modules/fake/other.js ../../node_modules/fake/index.js'
                , '../../node_modules/fake/index.js ../mgroups.js'
                , '../../node_modules/fake/another.js ../../node_modules/fake/other.js'
            ], function(file, all) {
                return file.filename + ' ' + file.parents.join(',')
            }))
    })

    suite('options', function() {
        suite('.traverseModules', function() {
            test('When false, should ignore module children'
                , expect(mocks.recursive, {
                    traverseModules: false
                }, {
                    strict: true
                }, [
                      'recursive.js'
                    , 'duplicates.js'
                    , 'relative.js'
                    , 'modules.js'
                    , 'index.js'
                    , 'test.js'
                    , 'nub'
                    , 'http'
                    , 'fs'
                    , 'assert'
                    , 'path'
                    , 'module'
                    , 'detective'
                    , 'async'
                ], function(file, all) {
                    return file.id
                }));

            test('When false, should still include modules', function(done) {
                reqursive(mocks.recursive, {
                    traverseModules: false
                }, function(err, files) {
                    assert.ifError(err)
                    var modules = files.filter(function(file) {
                        return file.module
                    })
                    assert.ok(modules.length)
                    done()
                })
            });

            test('When true, should include module children', function(done) {
                reqursive(mocks.recursive, {
                    traverseModules: true
                }, function(err, files) {
                    var modules = files.filter(function(file) {
                        return file.module && !file.native
                    })

                    var modchildren = files.filter(function(file) {
                        return modules.filter(function(module) {
                            return file.parents.indexOf(module.filename) !== -1
                        }).length > 0
                    })

                    assert.ok(modules.length)
                    assert.ok(modchildren.length)

                    done()
                })
            });
        });

        suite('.absolute', function() {
            test('When false, should return relative paths'
                , expect(mocks.mgroups, {
                    absolute: false
                }, {
                    strict: true
                }, [
                      'mgroups.js'
                    , '../node_modules/fake/index.js'
                ], function(file) {
                    return file.filename
                }))

            test('When true, should supply the correct absolute paths', function(done) {
                var directory = path.dirname(mocks.mgroups)

                expect(mocks.mgroups, {
                    absolute: true
                }, {
                    strict: true
                }, [
                      'mgroups.js'
                    , '../node_modules/fake/index.js'
                ], function(file) {
                    // Check path is absolute, Windows-friendly
                    assert.ok(file.filename.match(/^\/|^[A-Z]{1,2}\:/g))
                    return path.relative(directory, file.filename)
                })(done)
            })
        })
    })
})
