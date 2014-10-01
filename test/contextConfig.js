/**
 *  Context Config specific unit tests.
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


describe('context config', function () {
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
    var context = helper.context;

    var instance = helper.dal.contextConfig.create(context, {
      key: 'min_sec',
      value: '50'
    });

    assert(instance.getContext().domain === context.domain);
    assert(instance.getId() === undefined);
    assert(instance.key === 'min_sec');
    assert(instance.value === '50');
    done();
  });

  it('should support get', function(done) {
    var context = helper.context;

    helper.dal.contextConfig.all(context)
      .then(function(contextConfigs) {
        var contextConfig = contextConfigs[0];

        assert(contextConfig.getId());
        assert(contextConfig.getContext().domain === context.domain);
        assert(contextConfig.key === 'max_sec');
        assert(contextConfig.value === '30');
      })
      .done(function() {
        done();
      });
  });

  it('should support save', function(done) {
    var context = helper.context;

    var instance = helper.dal.contextConfig.create(context, {
      key: 'max_silence',
      value: '5'
    });

    helper.dal.contextConfig.save(instance)
      .then(function() {
        return helper.dal.contextConfig.all(context);
      })
      .then(function(contextConfigs) {
        var contextConfig = contextConfigs[contextConfigs.length - 1];

        assert(contextConfig.getId());
        assert(contextConfig.getContext().domain === context.domain);
        assert(contextConfig.key === 'max_silence');
        assert(contextConfig.value === '5');
      })
      .done(function() {
        done();
      });
  });

  it('should support remove', function(done) {
    var context = helper.context;

    var instance = helper.dal.contextConfig.create(context, {
      key: 'max_messages',
      value: '100'
    });

    helper.dal.contextConfig.save(instance)
      .then(function() {
        return helper.dal.contextConfig.all(context);
      })
      .then(function(contextConfigs) {
        return helper.dal.contextConfig.remove(
          contextConfigs[contextConfigs.length - 1]);
      })
      .then(function() {
        return helper.dal.contextConfig.all(context);
      })
      .then(function(result) {
        assert(result.length === 1);
      })
      .done(function() {
        done();
      });
  });

  it('should support creating indexes', function(done) {
    helper.dal.contextConfig.createIndexes()
      .then(function() {
        return helper.dal.contextConfig.createIndexes();
      })
      .catch(function(err) {
        var alreadyExists = ~err.toString().search(/index.+already exists/);
        assert(alreadyExists);
      })
      .done(function() {
        done();
      });
  });
});
