/**
 *  Folder specific unit tests.
 *
 *  @module tests-context
 *  @copyright 2014, Digium, Inc.
 *  @license Apache License, Version 2.0
 *  @author Samuel Fortier-Galarneau <sgalarneau@digium.com>
 */

'use strict';

/*global describe:false*/
/*global beforeEach:false*/
/*global it:false*/

var assert = require('assert');
var common = require('./helpers/common.js');

describe('folder', function () {
  var config = {
    connectionString: 'tests.db',
    provider: 'sqlite'
  };
  var helper;

  beforeEach(function (done) {
    common.populateDb(config)
      .then(function(testHelper) {
        helper = testHelper;
        done();
      })
      .done();
  });

  it('should support create', function(done) {
    var instance = helper.dal.folder.create({
      name: 'my-awesome-folder',
      recording: 'it-is-so-awesome.wav',
      dtmf: '2'
    });

    assert(instance.name === 'my-awesome-folder');
    assert(instance.recording === 'it-is-so-awesome.wav');
    assert(instance.dtmf === '2');
    assert(instance.getId() === undefined);
    done();
  });

  it('should support all', function(done) {
    helper.dal.folder.all()
      .then(function(folders) {
        var folder = folders['0'];

        assert(folder.getId());
        assert(folder.name === 'Inbox');
        assert(folder.recording === 'INBOX');
        assert(folder.dtmf === 0);
        done();
      })
      .done();
  });

  it('should support save', function(done) {
    var instance = helper.dal.folder.create({
      name: 'my-awesome-folder',
      recording: 'it-is-so-awesome.wav',
      dtmf: '2'
    });

    helper.dal.folder.save(instance)
      .then(function() {
        return helper.dal.folder.all();
      })
      .then(function(folders) {
        var folder = folders['2'];

        assert(folder.getId());
        assert(folder.name === 'my-awesome-folder');
        assert(folder.recording === 'it-is-so-awesome.wav');
        assert(folder.dtmf === 2);
        done();
      })
      .done();
  });

  it('should support remove', function(done) {
    var instance = helper.dal.folder.create({
      name: 'my-awesome-folder',
      recording: 'it-is-so-awesome.wav',
      dtmf: '2'
    });

    helper.dal.folder.save(instance)
      .then(function() {
        return helper.dal.folder.all();
      })
      .then(function(folders) {
        var folder = folders['2'];

        return helper.dal.folder.remove(folder);
      })
      .then(function() {
        return helper.dal.folder.all();
      })
      .then(function(folders) {
        var folder = folders['2'];

        assert(folder === undefined);
        done();
      })
      .done();
  });

  it('should support getting a folder by name', function(done) {
    helper.dal.folder.get('Old')
      .then(function(result) {
        assert(result.name === 'Old');
        assert(result.recording === 'Old');
        assert(result.dtmf === 1);
        done();
      });
  });

  function resultEquivalentExpectations(result, expectedItems) {
    if (result.length !== expectedItems.length) {
      return false;
    }

    result.forEach(function (item) {
      expectedItems = expectedItems.filter(function (expectedItem) {
        if (expectedItem.name === item.name &&
            expectedItem.recording === item.recording &&
            expectedItem.dtmf === item.dtmf) {
          return false;
        }

        return true;
      });
    });

    if (expectedItems.length === 0) {
      return true;
    }

    return false;
  }

  it('should support finding folders by name/dtmf', function(done) {
    var expectedItems = [{'name': 'Inbox', 'recording': 'INBOX', 'dtmf': 0},
                         {'name': 'Old', 'recording': 'Old', 'dtmf': 1}];

    helper.dal.folder.findByNameOrDTMF('Inbox', 1)
      .then(function(result) {
        assert(resultEquivalentExpectations(result, expectedItems));
        done();
      });
  });

  it('should support creating indexes', function(done) {
    helper.dal.folder.createIndexes()
      .then(function() {
        return helper.dal.folder.createIndexes();
      })
      .catch(function(err) {
        var alreadyExists = ~err.toString().search(/index.+already exists/);
        assert(alreadyExists);
        done();
      });
  });
});
