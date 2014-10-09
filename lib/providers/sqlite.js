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

/*
 * Returns a runQuery function bound to the given config.
 */
function runQuery(config) {
  return boundRunQuery;

  /**
   * Returns a promise containing the result of the query.
   *
   * @param {Query} query - node-sql query object
   */
  function boundRunQuery(query) {
    var db = new sqlite3.Database(config.connectionString);
    var run = Q.denodeify(db.run.bind(db));
    var all = Q.denodeify(db.all.bind(db));
    var promise = run('BEGIN');
    var exec;

    if (~query.text.toLowerCase().search(/^select.+/)) {
      exec = all;
    } else {
      exec = run;
    }

    return promise
      .then(function() {
        return exec(query.text, query.values);
      })
      .then(function(result) {
        return run('COMMIT').then(function() {
          return {
            rows: result
          };
        });
      })
      .catch(function(err) {
        return run('ROLLBACK')
          .then(function() {
            throw new Error(err);
          });
      })
      .finally(function() {
        var close = Q.denodeify(db.close.bind(db));
        close()
          .catch(function(err) {
            throw new Error(err);
          });
      });
  }
}

/**
 * Returns a beginTransaction function bound to the given config.
 */
function beginTransaction(config) {
  return boundBeginTransaction;

  /**
   * Begins a transaction.
   *
   * @param {bool} lock - whether to lock, does not apply to postgres
   * @returns {Q} promise - a promise containing functions to run queries
   * and commit/rollback the transaction
   */
  function boundBeginTransaction(lock) {
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
      return run('COMMIT')
        .finally(function() {
          close()
            .catch(function(err) {
              throw new Error(err);
            });
        });
    }

    /**
     * Rolls back the transaction and releases the connection.
     *
     * @returns {Q} promise - a promise containing the result of rolling back
     */
    function rollbackTransaction() {
      return run('ROLLBACK')
        .finally(function() {
          close()
            .catch(function(err) {
              throw new Error(err);
            });
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
      var exec;

      if (~query.text.toLowerCase().search(/^select.+/)) {
        exec = all;
      } else {
        exec = run;
      }

      return exec(query.text, query.values)
        .then(function (result) {
          return {
            rows: result
          };
        });
    }
  }
}

/**
 * Adds for update to a select statement for row locking. This does not do
 * anything for the sqlite provider as it is not supported.
 *
 * @param {object} query - node-sql query object
 * @returns {object} query - a new query with a for update statement
 */
function forUpdate(query) {
  // return new object anyways to match other providers
  var replaced = {};
  replaced.text = query.text;
  replaced.values = query.values;

  return replaced;
}

/**
 * Create statement does not have to be modified for sqlite. Integer primary
 * keys automatically get a unique Integer value if not given on insert.
 *
 * @param {string} createStatement - the create statement to modify
 */
function autoIncrement(createStatement) {
  return createStatement;
}

/**
 * Modifies date from db storage to object format.
 *
 * @param {Object} date - date object fetched from database
 * @returns {Moment} date - Moment date object
 */
function convertDateFromStorage(date) {
  return moment.unix(date).utc();
}

/**
 * Modifies date from object format for db storage.
 *
 * @param {Moment} date - Moment date object
 * @returns {Object} date - date object for database
 */
function convertDateForStorage(date) {
  // postgres can deal with moment date object which gets stored as is (UTC)
  return date.unix();
}

/**
 * Returns the date type for table creation.
 */
function getDateType() {
  return 'integer';
}

module.exports = function(config) {
  if (cache[config.connectionString]) {
    return cache[config.connectionString];
  } else {
    var obj = {
      runQuery: runQuery(config),
      beginTransaction: beginTransaction(config),
      forUpdate: forUpdate,
      autoIncrement: autoIncrement,
      convertDateFromStorage: convertDateFromStorage,
      convertDateForStorage: convertDateForStorage,
      getDateType: getDateType,
      overrides: {
        mailbox: {},
        context: {},
        folder: {},
        mailboxConfig: {},
        contextConfig: {},
        message: {}
      }
    };

    cache[config.connectionString] = obj;
    return obj;
  }
};
