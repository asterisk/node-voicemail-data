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
var util = require('util');
var Compose = require('compose');

/**
 * Returns an API for interacting with contexts.
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
     * Creates a context table.
     */
    createTable: function() {
      dependencies.logger.trace('context.createTable called');

      return common.createTable(table, provider);
    },

    /**
     * Creates context indexes.
     */
    createIndexes: function() {
      dependencies.logger.trace('context.createIndexes called');

      return common.createIndex(table, 'vm_context_domain', 'domain', provider);
    },

    /**
     * Create an instance of a context.
     */
    create: function(domain, id) {
      dependencies.logger.trace('context.create called');

      return {
        domain: domain,

        getId: function() {
          return id;
        }
      };
    },

    /**
     * Returns an array of all context instances from the database.
     */
    all: function() {
      dependencies.logger.trace('context.all called');

      var query = table
        .select(table.star())
        .from(table)
        .toQuery();

      return common.find(query, provider, constructor.bind(this))
        .then(function(result) {
          return result.reduce(function(contexts, context) {
            contexts.push(context);
            return contexts;
          }, []);
        });

      function constructor(id) {
        /*jshint validthis:true*/
        //Passing undefined so that domain can be populated by db result
        return this.create(undefined, id);
      }
    },

    /**
     * Return a context instance from the database.
     */
    get: function(domain) {
      dependencies.logger.trace('context.get called');

      var where = table.domain
            .equals(domain);

      return common.get(table, where, provider, constructor.bind(this))
        .then(function(context) {
          dependencies.logger.debug({context: context}, 'Context loaded');

          return context;
        });

      function constructor(id) {
        /*jshint validthis:true*/
        return this.create(domain, id);
      }
    },

    /**
     * Save a context instance to the database.
     */
    save: function(instance) {
      dependencies.logger.trace('context.save called');

      return common.save(instance, table, provider)
        .then(function() {
          dependencies.logger.debug({
            context: instance
          }, 'Context saved');
        });
    },

    /**
     * Deletes a context instance from the database.
     */
    remove: function(instance) {
      return common.remove(instance, table, provider)
        .then(function() {
          dependencies.logger.debug({
            context: instance
          }, 'Context removed');
        });
    },
  };
}

/**
 * Returns a repository that can be used to interact with contexts.
 *
 * @param {Object} config - config object containing connection string and
 *                          provider name
 * @param {object} dependencies - object keyed by module dependencies
 * @returns {Object} repo - context repository
 */
module.exports = function(config, dependencies) {
  var file = util.format('../providers/%s.js', config.provider);
  var provider = require(file)(config, dependencies);
  var sqlGenerator = new sql.Sql(config.provider);

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
  ), provider.overrides.context);

  return repo;
};
