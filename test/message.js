/**
 *  Message Config specific unit tests.
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

describe('message', function () {
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
    var folder = helper.folder;

    var instance = helper.dal.message.create(mailbox, folder, {
      recording: 'awesome-message.wav',
      callerId: 'John Smith',
      duration: '10' 
    });
    instance.init();

    assert(instance.getMailbox().mailboxNumber === mailbox.mailboxNumber);
    assert(instance.getFolder().dtmf === folder.dtmf);
    assert(instance.getId() === undefined);
    assert(instance.read === false);
    assert(instance.recording === 'awesome-message.wav');
    assert(instance.callerId === 'John Smith');
    assert(instance.duration === '10');
    done();
  });

  it('should support setting to read', function(done) {
    var mailbox = helper.mailbox;
    var folder = helper.folder;

    var instance = helper.dal.message.create(mailbox, folder, {
      recording: 'awesome-message.wav',
      callerId: 'John Smith',
      duration: '10' 
    });
    instance.init();

    assert(!instance.read);
    var changed = instance.markAsRead();
    assert(changed);
    assert(instance.read);

    done();
  });

  it('should support all', function(done) {
    var mailbox = helper.mailbox;
    var folder = helper.folder;

    helper.dal.message.all(mailbox, folder)
      .then(function(messages) {
        var message = messages[0];

        assert(message.getId());
        assert(message.getMailbox().mailboxNumber === mailbox.mailboxNumber);
        assert(message.getFolder().dtmf === folder.dtmf);
        assert(message.recording === 'mymessage');
        assert(message.read === false);
        assert(message.callerId === 'John Smith');
        assert(message.duration === '50');

        message = messages[1];
        assert(message.getId());
        assert(message.getMailbox().mailboxNumber === mailbox.mailboxNumber);
        assert(message.getFolder().dtmf === folder.dtmf);
        assert(message.recording === 'myothermessage');
        assert(!message.read);
        assert(message.callerId === 'Jane Smith');
        assert(message.duration === '60');
      })
      .done(function() {
        done();
      });
  });
  
  it('should support latest', function(done) {
    var mailbox = helper.mailbox;
    var folder = helper.folder;

    var instance = helper.dal.message.create(mailbox, folder, {
      recording: 'awesome-message.wav',
      callerId: 'John Smith',
      duration: '10' 
    });
    instance.init();

    helper.dal.message.all(mailbox, folder)
      .then(function(messages) {
        return helper.dal.message.save(instance)
          .then(function() {
            return messages[messages.length - 1].date;
          });
      })
      .then(function(latest) {
        return helper.dal.message.latest(mailbox, folder, latest);
      })
      .then(function(messages) {
        var message = messages[1];

        // latest is returned to ensure message save at same second is not
        // skipped
        assert(messages.length === 2);
        assert(message.getId());
        assert(message.getMailbox().mailboxNumber === mailbox.mailboxNumber);
        assert(message.getFolder().dtmf === folder.dtmf);
        assert(!message.read);
        assert(message.recording === 'awesome-message.wav');
        assert(message.callerId === 'John Smith');
        assert(message.duration === '10');
      })
      .done(function() {
        done();
      });
  });

  it('should support save', function(done) {
    var mailbox = helper.mailbox;
    var folder = helper.folder;

    var instance = helper.dal.message.create(mailbox, folder, {
      recording: 'awesome-message.wav',
      callerId: 'John Smith',
      duration: '10' 
    });
    instance.init();

    helper.dal.message.save(instance)
      .then(function() {
        return helper.dal.message.all(mailbox, folder);
      })
      .then(function(messages) {
        var message = messages[2];

        assert(message.getId());
        assert(message.getMailbox().mailboxNumber === mailbox.mailboxNumber);
        assert(message.getFolder().dtmf === folder.dtmf);
        assert(!message.read);
        assert(message.recording === 'awesome-message.wav');
        assert(message.callerId === 'John Smith');
        assert(message.duration === '10');
      })
      .done(function() {
        done();
      });
  });

  it('should support remove', function(done) {
    var mailbox = helper.mailbox;
    var folder = helper.folder;

    var instance = helper.dal.message.create(mailbox, folder, {
      recording: 'awesome-message.wav',
      callerId: 'John Smith',
      duration: '10' 
    });
    instance.init();
    var messageId;

    helper.dal.message.save(instance)
      .then(function() {
        return helper.dal.message.all(mailbox, folder);
      })
      .then(function(messages) {
        var message = messages[0];

        messageId = message.getId();
        return helper.dal.message.remove(message);
      })
      .then(function() {
        return helper.dal.message.all(mailbox, folder);
      })
      .then(function(messages) {
        var message = messages[0];
        assert(message.getId() !== messageId);
      })
      .done(function() {
        done();
      });
  });

  it('should support creating indexes', function(done) {
    helper.dal.message.createIndexes()
      .then(function() {
        return helper.dal.message.createIndexes();
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
