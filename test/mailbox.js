/**
 *  Mailbox specific unit tests.
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

describe('mailbox', function () {
  var connectionString = 'sqlite://tests.db';
  var helper;

  beforeEach(function (done) {
    common.populateDb(connectionString)
      .then(function(testHelper) {
        helper = testHelper;
        done();
      })
      .done();
  });

  it('should support create', function(done) {
    var context = helper.context;
    var number = '5678';

    var instance = helper.dal.mailbox.create(number, context, {
      mailboxName: 'mine',
      password: 'pass',
      name: 'Samuel Galarneau',
      email: 'sam@email.com'
    });

    assert(instance.getContext().domain === context.domain);
    assert(instance.mailboxNumber === number);
    assert(instance.mailboxName === 'mine');
    assert(instance.password === 'pass');
    assert(instance.name === 'Samuel Galarneau');
    assert(instance.email === 'sam@email.com');
    assert(instance.getId() === undefined);
    done();
  });

  it('should support get', function(done) {
    var context = helper.context;
    var number = '1234';

    helper.dal.mailbox.get(number, context)
      .then(function(mailbox) {
        assert(mailbox.getId());
        assert(mailbox.mailboxNumber === number);
        assert(mailbox.mailboxName === 'Samuel Galarneau\'s Mailbox');
        assert(mailbox.password === '1234');
        assert(mailbox.name === 'Samuel Galarneau');
        assert(mailbox.email === 'sgalarneau@digium.com');
      })
      .done(function() {
        done();
      });
  });

  it('should support save', function(done) {
    var context = helper.context;
    var number = '5678';

    var instance = helper.dal.mailbox.create(number, context, {
      mailboxName: 'mine',
      password: 'pass',
      name: 'Samuel Galarneau',
      email: 'sam@email.com'
    });

    helper.dal.mailbox.save(instance)
      .then(function() {
        return helper.dal.mailbox.get(number, context);
      })
      .then(function(newMailbox) {
        assert(newMailbox.getId());
        assert(newMailbox.mailboxNumber === number);
        assert(newMailbox.mailboxName === 'mine');
        assert(newMailbox.password === 'pass');
        assert(newMailbox.name === 'Samuel Galarneau');
        assert(newMailbox.email === 'sam@email.com');
      })
      .done(function() {
        done();
      });
  });

  it('should support remove', function(done) {
    var context = helper.context;
    var number = '5678';

    var instance = helper.dal.mailbox.create(number, context, {
      mailboxName: 'mine',
      password: 'pass',
      name: 'Samuel Galarneau',
      email: 'sam@email.com'
    });

    helper.dal.mailbox.save(instance)
      .then(function() {
        return helper.dal.mailbox.get(number, context);
      })
      .then(function(newMailbox) {
        return helper.dal.mailbox.remove(newMailbox);
      })
      .then(function() {
        return helper.dal.mailbox.get(number, context);
      })
      .then(function(result) {
        assert(result === null);
      })
      .done(function() {
        done();
      });
  });

  it('should support creating indexes', function(done) {
    helper.dal.mailbox.createIndexes()
      .then(function() {
        return helper.dal.mailbox.createIndexes();
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
