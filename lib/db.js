/**
 * Data Access Layer module for Asterisk Voicemail.
 *
 * @module asterisk-voicemail-data
 *
 * @copyright 2014, Digium, Inc.
 * @license Apache License, Version 2.0
 * @author Samuel Fortier-Galarneau <sgalarneau@digium.com>
 */

'use strict';

var mailboxRepo = require('./repositories/mailbox.js');
var contextRepo = require('./repositories/context.js');
var folderRepo = require('./repositories/folder.js');
var messageRepo = require('./repositories/message.js');
var mailboxConfigRepo = require('./repositories/mailboxconfig.js');
var contextConfigRepo = require('./repositories/contextconfig.js');

// keep a reference to repositories per connection string 
var cache = {};

/**
 * Returns a repositories object that can be used to interact with voicemail
 * related repositories.
 *
 * @param {object} dbConfig - database configuration
 * @param {object} dependencies - object keyed by module dependencies
 * @returns {Object} repositories - an object keyed by repositories
 */
module.exports = function(dbConfig, dependencies) {
  if (cache[dbConfig.connectionString]) {
    dependencies.logger.info('Loaded data access layer from cache');

    return cache[dbConfig.connectionString];
  } else {
    dependencies.logger = dependencies.logger.child({
      component: 'voicemail-data'
    });

    var repos = {
      context: contextRepo(dbConfig, dependencies),
      mailbox: mailboxRepo(dbConfig, dependencies),
      folder: folderRepo(dbConfig, dependencies),
      message: messageRepo(dbConfig, dependencies),
      contextConfig: contextConfigRepo(dbConfig, dependencies),
      mailboxConfig: mailboxConfigRepo(dbConfig, dependencies)
    };

    dependencies.logger.info('Data access layer created');

    cache[dbConfig.connectionString] = repos;
    return repos;
  }
};
