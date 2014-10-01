/**
 *  Mailbox Config specific unit tests.
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


describe('mailbox config', function () {
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
    var mailbox = helper.mailbox;

    var instance = helper.dal.mailboxConfig.create(mailbox, {
      key: 'min_sec',
      value: '50'
    });

    assert(instance.getMailbox().mailboxNumber === mailbox.mailboxNumber);
    assert(instance.getId() === undefined);
    assert(instance.key === 'min_sec');
    assert(instance.value === '50');
    done();
  });

  it('should support get', function(done) {
    var mailbox = helper.mailbox;

    helper.dal.mailboxConfig.all(mailbox)
      .then(function(mailboxConfigs) {
        var mailboxConfig = mailboxConfigs[0];

        assert(mailboxConfig.getId());
        assert(
          mailboxConfig.getMailbox().mailboxNumber === mailbox.mailboxNumber);
        assert(mailboxConfig.key === 'max_sec');
        assert(mailboxConfig.value === '20');
      })
      .done(function() {
        done();
      });
  });

  it('should support save', function(done) {
    var mailbox = helper.mailbox;

    var instance = helper.dal.mailboxConfig.create(mailbox, {
      key: 'max_silence',
      value: '5'
    });

    helper.dal.mailboxConfig.save(instance)
      .then(function() {
        return helper.dal.mailboxConfig.all(mailbox);
      })
      .then(function(mailboxConfigs) {
        var mailboxConfig = mailboxConfigs[mailboxConfigs.length - 1];

        assert(mailboxConfig.getId());
        assert(
          mailboxConfig.getMailbox().mailboxNumber === mailbox.mailboxNumber);
        assert(mailboxConfig.key === 'max_silence');
        assert(mailboxConfig.value === '5');
      })
      .done(function() {
        done();
      });
  });

  it('should support remove', function(done) {
    var mailbox = helper.mailbox;

    var instance = helper.dal.mailboxConfig.create(mailbox, {
      key: 'max_messages',
      value: '100'
    });

    helper.dal.mailboxConfig.save(instance)
      .then(function() {
        return helper.dal.mailboxConfig.all(mailbox);
      })
      .then(function(mailboxConfigs) {
        return helper.dal.mailboxConfig.remove(
          mailboxConfigs[mailboxConfigs.length - 1]);
      })
      .then(function() {
        return helper.dal.mailboxConfig.all(mailbox);
      })
      .then(function(result) {
        assert(result.length === 1);
      })
      .done(function() {
        done();
      });
  });

  it('should support creating indexes', function(done) {
    helper.dal.mailboxConfig.createIndexes()
      .then(function() {
        return helper.dal.mailboxConfig.createIndexes();
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
