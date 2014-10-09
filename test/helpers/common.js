/**
 *  Common unit test helpers.
 *
 *  @module tests-context
 *  @copyright 2014, Digium, Inc.
 *  @license Apache License, Version 2.0
 *  @author Samuel Fortier-Galarneau <sgalarneau@digium.com>
 */

'use strict';

var testFixtures = require('./fixtures.json');
var Q = require('q');
var moment = require('moment');
var fs = require('fs');

/**
 * Populates a test database with data from fixtures.
 *
 * @param {object} dbConfig - database config
 * @returns {Q} promise - a promise that will return a test helper
 */
function populateDb(dbConfig) {
  var file = dbConfig.connectionString;
  var context;
  var mailbox;
  var folder;
  var dal;

  // delete sqlite db
  return deleteDb(file)
    .then(function() {
      dal = getDal(dbConfig);
      var repos = [
        dal.context,
        dal.contextConfig,
        dal.mailbox,
        dal.mailboxConfig,
        dal.folder,
        dal.message
      ];

      /*jshint newcap:false*/
      return repos.reduce(function(series, repo) {
        return series.then(function() {
          return repo.createTable();
        });
      }, Q());
    })
    .then(function() {
      return createContextData(dal.context);
    })
    .then(function() {
      var domain = 'digium.com';
      return dal.context.get(domain);
    })
    .then(function(instance) {
      context = instance;
      return createContextConfigData(dal.contextConfig, context);
    })
    .then(function() {
      return createMailboxData(dal.mailbox, context);
    })
    .then(function() {
      var mailboxNumber = '1234';
      return dal.mailbox.get(mailboxNumber, context);
    })
    .then(function(instance) {
      mailbox = instance;
      return createMailboxConfigData(dal.mailboxConfig, mailbox);
    })
    .then(function() {
      return createFolderData(dal.folder);
    })
    .then(function() {
      return dal.folder.all();
    })
    .then(function(folders) {
      folder = folders['1'];
      return createMessageData(dal.message, mailbox, folder);
    })
    .then(function() {
      return {
        dal: dal,
        mailbox: mailbox,
        context: context,
        folder: folder
      };
    });
}

/**
 * Deletes a file based sqlite db.
 *
 * @param {string} file - path to the file
 * @returns {Q} promise - promise
 */
function deleteDb(file) {
  var unlink = Q.denodeify(fs.unlink);

  return unlink(file)
    .catch(function(err) {
      // skip error in case db has already been deleted
    });
}

/**
 * Returns a data access layer for the given connection string.
 *
 * @param {object} dbConfig - database config
 */
function getDal(dbConfig) {
  // force db modules to reload since we're deleting the db after each run
  var name = require.resolve('../../lib/providers/sqlite.js');
  delete require.cache[name];
  name = require.resolve('../../lib/db.js');
  delete require.cache[name];
  var data = require('../../lib/db.js');

  return data(dbConfig);
}

/**
 * Returns a promise chain for creating context records.
 *
 * @param {Object} repo - a context repository instance
 * @returns {Q} promise - promise chain for creating context records
 */
function createContextData(repo) {
  return createInstances(testFixtures.context.instances, repo, constructor);

  function constructor(fixture) {
    return repo.create(fixture.domain);
  }
}

/**
 * Returns a promise chain for creating context config records.
 *
 * @param {Object} repo - a context config repository instance
 * @param {Context} context - a context instance
 * @returns {Q} promise - promise chain for creating context config records
 */
function createContextConfigData(repo, context) {
  return createInstances(testFixtures.contextConfig.instances,
                         repo, constructor);

  function constructor(fixture) {
    var instance = repo.create(context, {
      key: fixture.key,
      value: fixture.value
    });

    return instance;
  }
}

/**
 * Returns a promise chain for creating mailbox records.
 *
 * @param {Object} repo - a mailbox repository instance
 * @param {Context} context - a context instance
 * @returns {Q} promise - promise chain for creating mailbox records
 */
function createMailboxData(repo, context) {
  return createInstances(testFixtures.mailbox.instances,
                         repo, constructor);

  function constructor(fixture) {
    var instance = repo.create(fixture['mailbox_number'], context, {
      mailboxName: fixture['mailbox_name'],
      name: fixture.name,
      email: fixture.email,
      password: fixture.password,
      read: fixture.read,
      unread: fixture.unread
    });

    return instance;
  }
}

/**
 * Returns a promise chain for creating mailbox config records.
 *
 * @param {Object} repo - a mailbox config repository instance
 * @param {Context} context - a mailbox instance
 * @returns {Q} promise - promise chain for creating mailbox config records
 */
function createMailboxConfigData(repo, mailbox) {
  return createInstances(testFixtures.mailboxConfig.instances,
                         repo, constructor);

  function constructor(fixture) {
    var instance = repo.create(mailbox, {
      key: fixture.key,
      value: fixture.value
    });

    return instance;
  }
}

/**
 * Returns a promise chain for creating folder records.
 *
 * @param {Object} repo - a folder repository instance
 * @returns {Q} promise - promise chain for creating folder records
 */
function createFolderData(repo) {
  return createInstances(testFixtures.folder.instances,
                         repo, constructor);

  function constructor(fixture) {
    var instance = repo.create({
      name: fixture.name,
      recording: fixture.recording,
      dtmf: fixture.dtmf
    });

    return instance;
  }
}

/**
 * Returns a promise chain for creating message records.
 *
 * @param {Object} repo - a message repository instance
 * @param {Mailbox} mailbox - a mailbox instance
 * @param {Folder} folder - a folder instance
 * @returns {Q} promise - promise chain for creating message records
 */
function createMessageData(repo, mailbox, folder) {
  return createInstances(testFixtures.message.instances,
                         repo, constructor);

  function constructor(fixture) {
    var instance = repo.create(mailbox, folder, {
      recording: fixture.recording,
      read: fixture.read,
      date: moment(fixture.date),
      callerId: fixture['caller_id'],
      duration: fixture.duration
    });

    return instance;
  }
}

/**
 * Returns a promise chain for creating instance records.
 *
 * @param {Object[]} fixtures - instance test fixtures
 * @param {Object} repo - a context repository instance
 * @param {Function} constructor - function that returns an instance
 * @returns {Q} promise - promise chain for creating instance records
 */
function createInstances(fixtures, repo, constructor) {
  /*jshint newcap: false*/
  return fixtures.reduce(function(series, fixture) {
    return series.then(function() {
      var instance = constructor(fixture);
      return repo.save(instance);
    });
  }, Q());
}

module.exports = {
  populateDb: populateDb
};
