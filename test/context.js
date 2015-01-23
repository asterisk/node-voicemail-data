/**
 *  Context specific unit tests.
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
var Q = require('q');

describe('context', function () {
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
    var domain = 'domain.com';
    var instance = helper.dal.context.create(domain);

    assert(instance.domain === domain);
    assert(instance.getId() === undefined);
    done();
  });

  it('should support get', function(done) {
    var domain = 'digium.com';
    helper.dal.context.get(domain)
      .then(function(context) {
        assert(context.getId());
        assert(context.domain === domain);
        done();
      })
      .done();
  });

  it('should support save', function(done) {
    var domain = 'asterisk.org';
    var instance = helper.dal.context.create(domain);

    helper.dal.context.save(instance)
      .then(function() {
        return helper.dal.context.get(domain);
      })
      .then(function(newContext) {
        assert(newContext.getId());
        assert(newContext.domain === domain);
        done();
      })
      .done();
  });

  it('should support remove', function(done) {
    var domain = 'asterisk.org';
    var instance = helper.dal.context.create(domain);

    helper.dal.context.save(instance)
      .then(function() {
        return helper.dal.context.get(domain);
      })
      .then(function(newContext) {
        return helper.dal.context.remove(newContext);
      })
      .then(function() {
        return helper.dal.context.get(domain);
      })
      .then(function(result) {
        assert(result === null);
        done();
      })
      .done();
  });

  function saveInstanceArray(instanceArray) {
    return helper.dal.context.save(instanceArray.pop())
    .then(function() {
      if (instanceArray.length > 0) {
        return saveInstanceArray(instanceArray);
      }
    });
  }

  function resultEquivalentExpectations(result, expectedItems) {
    if (result.length !== expectedItems.length) {
      return false;
    }

    result.forEach(function (item) {
      expectedItems = expectedItems.filter(function (expectedItem) {
        return expectedItem !== item.domain;
      });
    });

    if (expectedItems.length === 0) {
      return true;
    }

    return false;
  }

  it('should support retrieving a list of contexts', function(done) {
    var items = ['asterisk.org', 'domain.com'];
    var expectedItems = ['asterisk.org', 'domain.com', 'digium.com'];
    var instances = [];

    items.forEach(function (item) {
      instances.push(helper.dal.context.create(item));
    });

    saveInstanceArray(instances)
    .then(function() {
      return helper.dal.context.all();
    })
    .then(function(result) {
      assert(resultEquivalentExpectations(result, expectedItems));
      done();
    })
    .done();
  });

  it('should support creating indexes', function(done) {
    helper.dal.context.createIndexes()
      .then(function() {
        return helper.dal.context.createIndexes();
      })
      .catch(function(err) {
        var alreadyExists = ~err.toString().search(/index.+already exists/);
        assert(alreadyExists);
        done();
      });
  });
});
