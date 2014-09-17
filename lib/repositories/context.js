/**
 * Context repository for interacting with context records.
 *
 * @module context
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
var tableName = 'vm_context';
var columns = [{
  name: 'id',
  dataType: 'integer',
  notNull: true,
  primaryKey: true
}, {
  name: 'domain',
  dataType: 'varchar(254)',
  notNull: true
}];

/**
 * Creates a context table.
 */
function createTable() {
  return common.createTable(table, provider);
}

/**
 * Creates context indexes.
 */
function createIndexes() {
  return common.createIndex(table, 'vm_context_domain', 'domain', provider);
}

/**
 * Create an instance of a context.
 */
function create(domain, id) {

  return {
    domain: domain,

    getId: function() {
      return id;
    }
  };
}

/**
 * Return a context instance from the database.
 */
function get(domain) {
  var where = table.domain
        .equals(domain);

  return common.get(table, where, provider, constructor);

  function constructor(id) {
    return create(domain, id);
  }
}

/**
 * Save a context instance to the database.
 */
function save(instance) {
  return common.save(instance, table, provider);
}

/**
 * Deletes a context instance from the database.
 */
function remove(instance) {
  return common.remove(instance, table, provider);
}

/**
 * Returns a repository that can be used to interact with contexts.
 *
 * @param {Object} config - config object containing connection string and
 *                          provider name
 * @returns {Object} repo - context repository
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
  }, provider.overrides.context);

  return repo;
};
