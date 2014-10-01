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
 * @returns {Object} repositories - an object keyed by repositories
 */
module.exports = function(dbConfig) {
  if (cache[dbConfig.connectionString]) {
    return cache[dbConfig.connectionString];
  } else {
    var repos = {
      context: contextRepo(dbConfig),
      mailbox: mailboxRepo(dbConfig),
      folder: folderRepo(dbConfig),
      message: messageRepo(dbConfig),
      contextConfig: contextConfigRepo(dbConfig),
      mailboxConfig: mailboxConfigRepo(dbConfig)
    };

    cache[dbConfig.connectionString] = repos;
    return repos;
  }
};
