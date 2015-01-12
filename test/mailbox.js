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
var Q = require('q');

describe('mailbox', function () {
  var config = {
    connectionString: 'tests.db',
    provider: 'sqlite'
  };
  var asyncDelay = 200;
  var helper;
  var mwi = function() {
    /*jshint newcap:false*/
    return Q();
  };

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
        done();
      })
      .done();
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
        done();
      })
      .done();
  });

  function verifyMailboxesMatchResults(result, expected) {
    if (result.length !== expected.length) {
      return false;
    }

    var x;
    for (x in result) {
      var number = result[x].mailboxNumber;
      var index = expected.indexOf(number);
      if (index <= -1) {
        return false;
      }
      expected.splice(index, 1);
    }

    if (expected.length === 0) {
      return true;
    }

    return false;
  }

  it('should support finding mailboxes by context', function(done) {
    var context = helper.context;
    var expectedMailboxNumbers = [1234, 1111];

    helper.dal.mailbox.findByContext(context)
      .then(function(result) {
        assert(verifyMailboxesMatchResults(result, expectedMailboxNumbers));
        done();
      })
      .done();
  });

  it('should support counting mailboxes by context', function(done) {
    var context = helper.context;

    helper.dal.mailbox.countByContext(context)
      .then(function(result) {
        assert(result === 2);
        done();
      })
      .done();
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

  it('should support updating mwi through newMessage', function(done) {
    var context = helper.context;
    var number = '1234';

    helper.dal.mailbox.get(number, context)
      .then(function(mailbox) {
        return helper.dal.mailbox.newMessage(mailbox, mwi);
      })
      .then(function(counts) {
        assert(counts.read === 1);
        assert(counts.unread === 2);
        done();
      })
      .done();
  });

  it('should support updating mwi through readMessage', function(done) {
    var context = helper.context;
    var number = '1234';

    helper.dal.mailbox.get(number, context)
      .then(function(mailbox) {
        return helper.dal.mailbox.readMessage(mailbox, mwi);
      })
      .then(function(counts) {
        assert(counts.read === 2);
        assert(counts.unread === 0);
        done();
      })
      .done();
  });

  it('should support updating mwi through deletedMessage', function(done) {
    var context = helper.context;
    var number = '1234';
    var mailbox;
    var read = true;

    helper.dal.mailbox.get(number, context)
      .then(function(mailboxInstance) {
        mailbox = mailboxInstance;
        return helper.dal.mailbox.deletedMessage(mailbox, read, mwi);
      })
      .then(function(counts) {
        assert(counts.read === 0);
        assert(counts.unread === 1);

        read = false;
        return helper.dal.mailbox.deletedMessage(mailbox, read, mwi);
      })
      .then(function(counts) {
        assert(counts.read === 0);
        assert(counts.unread === 0);

        done();
      })
      .done();
  });

  it('should support updating mwi for null read/unread', function(done) {
    var context = helper.context;
    var number = '1111';

    helper.dal.mailbox.get(number, context)
      .then(function(mailbox) {
        return helper.dal.mailbox.newMessage(mailbox, mwi);
      })
      .then(function(counts) {
        assert(counts.read === 0);
        assert(counts.unread === 1);
        done();
      })
      .done();
  });

  it('should support concurrent updates', function(done) {
    var context = helper.context;
    var number = '1234';
    var results = [];

    helper.dal.mailbox.get(number, context)
      .then(function(mailbox) {
        helper.dal.mailbox.newMessage(mailbox, mwi)
          .then(function(counts) {
            results.push(counts);
          })
          .done();
        helper.dal.mailbox.readMessage(mailbox, mwi)
          .then(function(counts) {
            results.push(counts);
          })
          .done();

        checkSuccess();

        function checkSuccess() {
          setTimeout(function() {
            var last = results[results.length - 1];
            if (last.read === 2 && last.unread === 1) {
              done();
            } else {
              checkSuccess();
            }
          }, asyncDelay);
        }
      })
      .done();
  });

  it('should support concurrent updates in opposite order', function(done) {
    var context = helper.context;
    var number = '1234';
    var results = [];

    helper.dal.mailbox.get(number, context)
      .then(function(mailbox) {
        helper.dal.mailbox.readMessage(mailbox, mwi)
          .then(function(counts) {
            results.push(counts);
          })
          .done();
        helper.dal.mailbox.newMessage(mailbox, mwi)
          .then(function(counts) {
            results.push(counts);
          })
          .done();

        checkSuccess();

        function checkSuccess() {
          setTimeout(function() {
            var last = results[results.length - 1];
            if (last.read === 2 && last.unread === 1) {
              done();
            } else {
              checkSuccess();
            }
          }, asyncDelay);
        }
      })
      .done();
  });

  it('should not allow saving mwi counts outside of new API', function(done) {
    var context = helper.context;
    var number = '1234';

    return helper.dal.mailbox.get(number, context)
      .then(function(instance) {
        instance.read = 2;
        instance.unread = 2;
        instance.email = 'somethingelse@email.com';

        return helper.dal.mailbox.save(instance);
      })
      .then(function() {
        return helper.dal.mailbox.get(number, context);
      })
      .then(function(instance) {
        assert(instance.mailboxNumber === number);
        assert(instance.read === 1);
        assert(instance.unread === 1);
        assert(instance.email === 'somethingelse@email.com');
        done();
      })
      .done();
  });

});
