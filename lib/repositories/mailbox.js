/**
 * Mailbox repository for interacting with mailbox records.
 *
 * @module mailbox
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
var tableName = 'vm_mailbox';
var columns = [{
  name: 'id',
  dataType: 'integer',
  notNull: true,
  primaryKey: true
}, {
  name: 'mailbox_number',
  dataType: 'integer',
  notNull: true
}, {
  name: 'mailbox_name',
  dataType: 'varchar(255)'
}, {
  name: 'context_id',
  dataType: 'integer',
  references: {
  table: 'vm_context',
  column: 'id'
  },
  notNull: true
}, {
  name: 'password',
  dataType: 'varchar(100)',
  notNull: true
}, {
  name: 'name',
  dataType: 'varchar(100)',
  notNull: true
}, {
  name: 'email',
  dataType: 'varchar(256)',
  notNull: true
}, {
  name: 'greeting_away',
  dataType: 'varchar(100)'
}, {
  name: 'greeting_busy',
  dataType: 'varchar(100)'
}, {
  name: 'greeting_name',
  dataType: 'varchar(100)'
}];

/**
 * Creates a mailbox table.
 */
function createTable() {
  return common.createTable(table, provider);
}

/**
 * Creates mailbox indexes.
 */
function createIndexes() {
  return common.createIndex(
    table,
    'vm_mailbox_mailbox_number_context_id',
    ['mailbox_number', 'context_id'],
    provider
  );
}

/**
 * Create an instance of a mailbox.
 */
function create(number, context, fields, id) {
  id = common.optionalArgument(fields, id, 'number');

  var instance = {
    mailboxNumber: number,
    mailboxName: undefined,
    password: undefined,
    name: undefined,
    email: undefined,
    greetingBusy: undefined,
    greetingAway: undefined,
    greetingName: undefined,

    getId: function() {
      return id;
    },

    getContext: function() {
      return context;
    }
  };

  return common.populateFields(instance, fields);
}

/**
 * Return a mailbox instance from the database.
 */
function get(number, context) {
  var where = table['mailbox_number']
        .equals(number)
        .and(table['context_id'].equals(context.getId()));

  return common.get(table, where, provider, constructor);

  function constructor(id) {
    return create(number, context, id);
  }
}

/**
 * Save a mailbox instance to the database.
 */
function save(instance) {
  return common.save(instance, table, provider);
}

/**
 * Deletes a mailbox instance from the database.
 */
function remove(instance) {
  return common.remove(instance, table, provider);
}

/**
 * Returns a repository that can be used to interact with mailboxes.
 *
 * @param {Object} config - config object containing connection string and
 *                          provider name
 * @returns {Object} repo - mailbox repository
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
    get: get,
    save: save,
    remove: remove
  }, provider.overrides.mailbox);

  return repo;
};
