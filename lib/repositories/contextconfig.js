/**
 * Context Config repository for interacting with context config records.
 *
 * @module contextconfig
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
var tableName = 'vm_context_config';
var columns = [{
  name: 'id',
  dataType: 'integer',
  notNull: true,
  primaryKey: true
}, {
  name: 'context_id',
  dataType: 'integer',
  references: {
    table: 'vm_context',
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
 * Creates a context config table.
 */
function createTable() {
  return common.createTable(table, provider);
}

/**
 * Creates context config indexes.
 */
function createIndexes() {
  return common.createIndex(
    table, 'vm_context_config_context_id', 'context_id', provider);
}

/**
 * Create an instance of a context config.
 *
 * @param {Context} context - context instance
 * @param {Object} fields - key/value field mappings
 * @param {Number} id - context id
 */
function create(context, fields, id) {
  id = common.optionalArgument(fields, id, 'number');

  var instance = {
    key: undefined,
    value: undefined,

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
 * Returns all context config instances from the database for a given context.
 */
function all(context) {
  var query = table
    .select(table.star())
    .from(table)
    .where(table['context_id'].equals(context.getId()))
    .toQuery();

  return common.find(query, provider, constructor);

  function constructor(id) {
    return create(context, id);
  }
}

/**
 * Save a context config instance to the database.
 */
function save(instance) {
  return common.save(instance, table, provider);
}

/**
 * Deletes a context config instance from the database.
 */
function remove(instance) {
  return common.remove(instance, table, provider);
}

/**
 * Returns a repository that can be used to interact with context configs.
 *
 * @param {Object} config - config object containing connection string and
 *                          provider name
 * @returns {Object} repo - context config repository
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
  }, provider.overrides.contextConfig);

  return repo;
};
