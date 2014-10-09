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

/*
 * Returns a runQuery function bound to the given config.
 */
function runQuery(config) {
  return boundRunQuery;

  /**
   * Runs the given query inside a transaction.
   *
   * @param {Query} query - node-sql query object
   * @returns {Q} promise - a promise containing the result of the query
   */
  function boundRunQuery(query) {
    // pg uses a connection pool - no need to cache client
    var connect = Q.denodeify(pg.connect.bind(pg));

    return connect(config.connectionString)
      .then(function (values) {
        var client = values[0];
        var done = values[1];
        var clientQuery = Q.denodeify(client.query.bind(client));

        return clientQuery('BEGIN')
          .then(function () {
            return clientQuery(query.text, query.values);
          })
          .then(function (result) {
            return clientQuery('COMMIT')
              .then(function () {
                return result;
              });
          })
          .catch(function (error) {
            return clientQuery('ROLLBACK')
              .then(function() {
                throw new Error(error);
              });
          })
          .finally(function() {
            done();
          });
      });
  }
}

/*
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
      return clientQuery('COMMIT')
        .finally(function() {
          done();
        });
    }

    /**
     * Rolls back the transaction and releases the connection.
     *
     * @returns {Q} promise - a promise containing the result of rolling back
     */
    function rollbackTransaction() {
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
      return clientQuery(query.text, query.values)
        .then(function (result) {
          return result;
        });
    }
  }
}

/**
 * Adds for update to a select statement for row locking.
 *
 * @param {object} query - node-sql query object
 * @returns {object} query - a new query with a for update statement
 */
function forUpdate(query) {
  var replaced = {};
  replaced.text = util.format('%s FOR UPDATE', query.text);
  replaced.values = query.values;

  return replaced;
}

/**
 * Replaces the id portion of the create statement with a provider
 * specific auto increment statement.
 *
 * @param {string} createStatement - the create statement to modify
 */
function autoIncrement(createStatement) {
  return createStatement.replace(/("id" )integer/, '$1serial');
}

/**
 * Modifies date from db storage to object format.
 *
 * @param {Object} date - date object fetched from database
 * @returns {Moment} date - Moment date object
 */
function convertDateFromStorage(date) {
  return moment.utc(moment(date).format('YYYY-MM-DD HH:mm'));
}

/**
 * Modifies date from object format for db storage.
 */
function convertDateForStorage(date) {
  // postgres can deal with moment date object which gets stored as is (UTC)
  return date;
}

/**
 * Returns the date type for table creation.
 */
function getDateType() {
  return 'timestamp';
}

module.exports = function(config) {
  return {
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
};
