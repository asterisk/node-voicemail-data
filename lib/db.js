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
 * @param {string} connectionString - the connection string to the database
 * @returns {Object} repositories - an object keyed by repositories
 */
module.exports = function(connectionString) {
  if (cache[connectionString]) {
    return cache[connectionString];
  } else {
    var provider = connectionString.split(':')[0];

    var config = {
      connectionString: connectionString,
      provider: provider
    };

    var repos = {
      context: contextRepo(config),
      mailbox: mailboxRepo(config),
      folder: folderRepo(config),
      message: messageRepo(config),
      contextConfig: contextConfigRepo(config),
      mailboxConfig: mailboxConfigRepo(config)
    };

    cache[connectionString] = repos;
    return repos;
  }
};
