/**
 * Sqlite specific implementation.
 *
 * @module sqlite
 *
 * @copyright 2014, Digium, Inc.
 * @license Apache License, Version 2.0
 * @author Samuel Fortier-Galarneau <sgalarneau@digium.com>
 */

'use strict';

var sqlite3 = require('sqlite3').verbose();
var Q = require('q');
var moment = require('moment');
var util = require('util');

// cache by connection string so we don't reload the db multiple times
var cache = {};

/**
 * Returns an API for sqlite specific database operations.
 *
 * @param {Object} config - config object containing connection string and
 *                          provider name
 * @param {object} dependencies - object keyed by module dependencies
 */
function createApi(config, dependencies) {
  return {
    /*
     * Returns a promise containing the result of the query.
     *
     * @param {Query} query - node-sql query object
     */
    runQuery: function(query) {
      dependencies.logger.trace('sqlite.runQuery called');

      var db = new sqlite3.Database(config.connectionString);
      var run = Q.denodeify(db.run.bind(db));
      var all = Q.denodeify(db.all.bind(db));
      var close = Q.denodeify(db.close.bind(db));
      var promise = run('BEGIN');
      var exec;

      if (~query.text.toLowerCase().search(/^select.+/)) {
        exec = all;
      } else {
        exec = run;
      }

      return promise
        .then(function() {
          dependencies.logger.debug({
            query: query
          }, 'Running query');

          return exec(query.text, query.values);
        })
        .then(function(result) {
          dependencies.logger.debug('Committing');

          return run('COMMIT')
            .finally(function() {
              return close();
            })
            .then(function() {
              return {
                rows: result
              };
            });
        })
        .catch(function(err) {
          dependencies.logger.debug('Rolling back');

          return run('ROLLBACK')
            .finally(function() {
              return close();
            })
            .finally(function() {
              throw new Error(err);
            });
        });
    },

    /**
     * Begins a transaction.
     *
     * @param {bool} lock - whether to lock, does not apply to postgres
     * @returns {Q} promise - a promise containing functions to run queries
     * and commit/rollback the transaction
     */
    beginTransaction: function(lock) {
      dependencies.logger.trace('sqlite.beginTransaction called');

      var db = new sqlite3.Database(config.connectionString);
      var run = Q.denodeify(db.run.bind(db));
      var all = Q.denodeify(db.all.bind(db));
      var close = Q.denodeify(db.close.bind(db));

      return run(util.format('BEGIN', lock ? ' IMMEDIATE': ''))
        .then(function() {
          return {
            commit: commitTransaction,
            rollback: rollbackTransaction,
            runQuery: runQueryWithoutTransaction
          };
        });

      /**
       * Commits the transaction and releases the connection.
       *
       * @returns {Q} promise - a promise containing the result of committing
       */
      function commitTransaction() {
        dependencies.logger.trace('sqlite.trans.commit called');

        return run('COMMIT')
          .finally(function() {
            return close();
          });
      }

      /**
       * Rolls back the transaction and releases the connection.
       *
       * @returns {Q} promise - a promise containing the result of rolling back
       */
      function rollbackTransaction() {
        dependencies.logger.trace('sqlite.trans.rollback called');

        return run('ROLLBACK')
          .finally(function() {
            return close();
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
        dependencies.logger.trace('sqlite.trans.runQuery called');

        var exec;

        if (~query.text.toLowerCase().search(/^select.+/)) {
          exec = all;
        } else {
          exec = run;
        }

        dependencies.logger.debug({
          query: query
        }, 'Running query');

        return exec(query.text, query.values)
          .then(function (result) {
            return {
              rows: result
            };
          });
      }
    },

    /**
     * Adds for update to a select statement for row locking. This does not do
     * anything for the sqlite provider as it is not supported.
     *
     * @param {object} query - node-sql query object
     * @returns {object} query - a new query with a for update statement
     */
    forUpdate: function(query) {
      dependencies.logger.trace('sqlite.forUpdate called');

      // return new object anyways to match other providers
      var replaced = {};
      replaced.text = query.text;
      replaced.values = query.values;

      return replaced;
    },

    /**
     * Create statement does not have to be modified for sqlite. Integer primary
     * keys automatically get a unique Integer value if not given on insert.
     *
     * @param {string} createStatement - the create statement to modify
     */
    autoIncrement: function(createStatement) {
      dependencies.logger.trace('sqlite.autoIncrement called');

      return createStatement;
    },

    /**
     * Modifies date from db storage to object format.
     *
     * @param {Object} date - date object fetched from database
     * @returns {Moment} date - Moment date object
     */
    convertDateFromStorage: function(date) {
      dependencies.logger.trace('sqlite.convertDateFromStorage called');

      return moment.unix(date).utc();
    },

    /**
     * Modifies date from object format for db storage.
     *
     * @param {Moment} date - Moment date object
     * @returns {Object} date - date object for database
     */
    convertDateForStorage: function(date) {
      dependencies.logger.trace('sqlite.convertDateForStorage called');

      // postgres can deal with moment date object which gets stored as is (UTC)
      return date.unix();
    },

    /**
     * Returns the date type for table creation.
     */
    getDateType: function() {
      dependencies.logger.trace('sqlite.getDateType called');

      return 'integer';
    }
  };
}

/**
 * Returns a sqlite provider helper object.
 *
 * @param {Object} config - config object containing connection string and
 *                          provider name
 * @param {object} dependencies - object keyed by module dependencies
 */
module.exports = function(config, dependencies) {
  if (cache[config.connectionString]) {
    return cache[config.connectionString];
  } else {
    var obj = createApi(config, dependencies);
    obj.overrides = {
      mailbox: {},
      context: {},
      folder: {},
      mailboxConfig: {},
      contextConfig: {},
      message: {}
    };

    cache[config.connectionString] = obj;
    return obj;
  }
};
