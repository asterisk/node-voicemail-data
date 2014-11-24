/**
 * Postgres specific implementation.
 *
 * @module postgres
 *
 * @copyright 2014, Digium, Inc.
 * @license Apache License, Version 2.0
 * @author Samuel Fortier-Galarneau <sgalarneau@digium.com>
 */

'use strict';

var pg = require('pg');
var Q = require('q');
var moment = require('moment');
var util = require('util');

/**
 * Returns an API for postgres specific database operations.
 *
 * @param {Object} config - config object containing connection string and
 *                          provider name
 * @param {object} dependencies - object keyed by module dependencies
 */
function createApi(config, dependencies) {
  return {
    /*
     * Runs the given query inside a transaction.
     *
     * @param {Query} query - node-sql query object
     * @returns {Q} promise - a promise containing the result of the query
     */
    runQuery: function(query) {
      dependencies.logger.trace('postgres.runQuery called');

      // pg uses a connection pool - no need to cache client
      var connect = Q.denodeify(pg.connect.bind(pg));

      return connect(config.connectionString)
        .then(function (values) {
          var client = values[0];
          var done = values[1];
          var clientQuery = Q.denodeify(client.query.bind(client));

          return clientQuery('BEGIN')
            .then(function () {
              dependencies.logger.debug({
                query: query
              }, 'Running query');

              return clientQuery(query.text, query.values);
            })
            .then(function (result) {
              dependencies.logger.debug('Committing');

              return clientQuery('COMMIT')
                .then(function () {
                  return result;
                });
            })
            .catch(function (error) {
              dependencies.logger.debug('Rolling back');

              return clientQuery('ROLLBACK')
                .then(function() {
                  throw new Error(error);
                });
            })
            .finally(function() {
              done();
            });
        });
    },

    /*
     * Begins a transaction.
     *
     * @param {bool} lock - whether to lock, does not apply to postgres
     * @returns {Q} promise - a promise containing functions to run queries
     * and commit/rollback the transaction
     */
    beginTransaction: function(lock) {
      dependencies.logger.trace('postgres.beginTransaction called');

      // pg uses a connection pool - no need to cache client
      var connect = Q.denodeify(pg.connect.bind(pg));
      var clientQuery;
      var client;
      var done;

      return connect(config.connectionString)
        .then(function (values) {
          client = values[0];
          done = values[1];
          clientQuery = Q.denodeify(client.query.bind(client));

          return clientQuery('BEGIN')
            .then(function() {
              return {
                commit: commitTransaction,
                rollback: rollbackTransaction,
                runQuery: runQueryWithoutTransaction
              };
            });
        });

      /**
       * Commits the transaction and releases the connection.
       *
       * @returns {Q} promise - a promise containing the result of committing
       */
      function commitTransaction() {
        dependencies.logger.trace('postgres.trans.commit called');

        return clientQuery('COMMIT')
          .finally(function() {
            done();
          });
      }

      /**
       * Rolls back the transaction and releases the connection.
       *
       * @returns {Q} promise - a promise containing the result of rolling
       *                        back
       */
      function rollbackTransaction() {
        dependencies.logger.trace('postgres.trans.rollback called');

        return clientQuery('ROLLBACK')
          .finally(function() {
            done();
          });
      }

      /**
       * Returns a promise containing the result of the query.
       *
       * @param {Query} query - node-sql query object
       * @returns {Q} promise - a promise containing the result of running
       *   the query
       */
      function runQueryWithoutTransaction(query) {
        dependencies.logger.trace('postgres.trans.runQuery called');

        dependencies.logger.debug({
          query: query
        }, 'Running query');

        return clientQuery(query.text, query.values)
          .then(function (result) {
            return result;
          });
      }
    },

    /**
     * Adds for update to a select statement for row locking.
     *
     * @param {object} query - node-sql query object
     * @returns {object} query - a new query with a for update statement
     */
    forUpdate: function(query) {
      dependencies.logger.trace('postgres.forUpdate called');

      var replaced = {};
      replaced.text = util.format('%s FOR UPDATE', query.text);
      replaced.values = query.values;

      return replaced;
    },

    /**
     * Replaces the id portion of the create statement with a provider
     * specific auto increment statement.
     *
     * @param {string} createStatement - the create statement to modify
     */
    autoIncrement: function(createStatement) {
      dependencies.logger.trace('postgres.autoIncrement called');

      return createStatement.replace(/("id" )integer/, '$1serial');
    },

    /**
     * Modifies date from db storage to object format.
     *
     * @param {Object} date - date object fetched from database
     * @returns {Moment} date - Moment date object
     */
    convertDateFromStorage: function(date) {
      dependencies.logger.trace('postgres.convertDateFromStorage called');

      return moment.utc(moment(date).format('YYYY-MM-DD HH:mm'));
    },

    /**
     * Modifies date from object format for db storage.
     */
    convertDateForStorage: function(date) {
      dependencies.logger.trace('postgres.convertDateForStorage called');

      // postgres can deal with moment date object which gets stored as is (UTC)
      return date;
    },

    /**
     * Returns the date type for table creation.
     */
    getDateType: function() {
      dependencies.logger.trace('postgres.getDateType called');

      return 'timestamp';
    }
  };
}

/**
 * Returns a postgres provider helper object.
 *
 * @param {Object} config - config object containing connection string and
 *                          provider name
 * @param {object} dependencies - object keyed by module dependencies
 */
module.exports = function(config, dependencies) {
  var obj = createApi(config, dependencies);
  obj.overrides = {
    mailbox: {},
    context: {},
    folder: {},
    mailboxConfig: {},
    contextConfig: {},
    message: {}
  };

  return obj;
};
