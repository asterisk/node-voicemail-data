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
var util = require('util');
var Compose = require('compose');

/**
 * Returns an API for interacting with context configs.
 *
 * @param {object} table - node-sql table definition
 * @param {object} provider - database specific provider instance
 * @param {object} table - node-sql generator
 * @param {object} dependencies - object keyed by module dependencies
 */
function createApi(table, provider, sqlGenerator, dependencies) {
  var common = require('../helpers/common.js')(dependencies);

  return {
    /**
     * Creates a context config table.
     */
    createTable: function() {
      dependencies.logger.trace('contextConfig.createTable called');

      return common.createTable(table, provider);
    },

    /**
     * Creates context config indexes.
     */
    createIndexes: function() {
      dependencies.logger.trace('contextConfig.createIndexes called');

      return common.createIndex(
        table, 'vm_context_config_context_id', 'context_id', provider);
    },

    /**
     * Create an instance of a context config.
     *
     * @param {Context} context - context instance
     * @param {Object} fields - key/value field mappings
     * @param {Number} id - context id
     */
    create: function(context, fields, id) {
      dependencies.logger.trace('contextConfig.create called');

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
    },

    /**
     * Returns all context config instances from the database for a given
     * context.
     */
    all: function(context) {
      dependencies.logger.trace('contextConfig.all called');

      var query = table
        .select(table.star())
        .from(table)
        .where(table['context_id'].equals(context.getId()))
        .toQuery();

      return common.find(query, provider, constructor.bind(this))
        .then(function(results) {
          dependencies.logger.debug({
            contextConfigs: results
          }, 'Context Config loaded');

          return results;
        });

      function constructor(id) {
        /*jshint validthis:true*/
        return this.create(context, id);
      }
    },

    /**
     * Save a context config instance to the database.
     */
    save: function(instance) {
      dependencies.logger.trace('contextConfig.save called');

      return common.save(instance, table, provider)
        .then(function() {
          dependencies.logger.debug({
            contextConfig: instance
          }, 'Context Config saved');
        });
    },

    /**
     * Deletes a context config instance from the database.
     */
    remove: function(instance) {
      dependencies.logger.trace('contextConfig.remove called');

      return common.remove(instance, table, provider)
        .then(function() {
          dependencies.logger.debug({
            contextConfig: instance
          }, 'Context Config removed');
        });
    }
  };
}

/**
 * Returns a repository that can be used to interact with context configs.
 *
 * @param {Object} config - config object containing connection string and
 *                          provider name
 * @param {object} dependencies - object keyed by module dependencies
 * @returns {Object} repo - context config repository
 */
module.exports = function(config, dependencies) {
  var file = util.format('../providers/%s.js', config.provider);
  var provider = require(file)(config, dependencies);
  var sqlGenerator = new sql.Sql(config.provider);

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

  var table = sqlGenerator.define({
    name: tableName,
    columns: columns
  });

  // provider specific overrides
  var repo = Compose.call(createApi(
    table,
    provider,
    sqlGenerator,
    dependencies
  ), provider.overrides.contextConfig);

  return repo;
};
