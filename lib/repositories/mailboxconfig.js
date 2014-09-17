/**
 * Mailbox Config repository for interacting with mailbox config records.
 *
 * @module mailboxconfig
 *
 * @copyright 2014, Digium, Inc.
 * @license Apache License, Version 2.0
 * @author Samuel Fortier-Galarneau <sgalarneau@digium.com>
 */

'use strict';

var sql = require('sql');
var common = require('../helpers/common.js');
var util = require('util');
var Compose = require('compose');

var provider;
var sqlGenerator;
var table;
var tableName = 'vm_mailbox_config';
var columns = [{
  name: 'id',
  dataType: 'integer',
  notNull: true,
  primaryKey: true
}, {
  name: 'mailbox_id',
  dataType: 'integer',
  references: {
    table: 'vm_mailbox',
    column: 'id'
  },
  notNull: true
}, {
  name: 'key',
  dataType: 'varchar(100)',
  notNull: true
}, {
  name: 'value',
  dataType: 'varchar(100)',
  notNull: true
}];

/**
 * Creates a mailbox config table.
 */
function createTable() {
  return common.createTable(table, provider);
}

/**
 * Creates mailbox config indexes.
 */
function createIndexes() {
  return common.createIndex(
    table, 'vm_mailbox_config_mailbox_id', 'mailbox_id', provider);
}

/**
 * Create an instance of a mailbox config.
 */
function create(mailbox, fields, id) {
  id = common.optionalArgument(fields, id, 'number');

  var instance = {
    key: undefined,
    value: undefined,

    getId: function() {
      return id;
    },

    getMailbox: function() {
      return mailbox;
    }
  };

  return common.populateFields(instance, fields);
}

/**
 * Returns all mailbox config instance from the database for a given mailbox.
 */
function all(mailbox) {
  var query = table
    .select(table.star())
    .from(table)
    .where(table['mailbox_id'].equals(mailbox.getId()))
    .toQuery();

  return common.find(query, provider, constructor);

  function constructor(id) {
    return create(mailbox, id);
  }
}

/**
 * Save a mailbox config instance to the database.
 */
function save(instance) {
  return common.save(instance, table, provider);
}

/**
 * Deletes a mailbox config instance from the database.
 */
function remove(instance) {
  return common.remove(instance, table, provider);
}

/**
 * Returns a repository that can be used to interact with mailbox configs.
 *
 * @param {Object} config - config object containing connection string and
 *                          provider name
 * @returns {Object} repo - mailbox config repository
 */
module.exports = function(config) {
  var file = util.format('../providers/%s.js', config.provider);
  provider = require(file)(config);
  sqlGenerator = new sql.Sql(config.provider);

  table = sqlGenerator.define({
    name: tableName,
    columns: columns
  });
  // provider specific overrides
  var repo = Compose.call({
    createTable: createTable,
    createIndexes: createIndexes,
    create: create,
    all: all,
    save: save,
    remove: remove
  }, provider.overrides.mailboxConfig);

  return repo;
};
