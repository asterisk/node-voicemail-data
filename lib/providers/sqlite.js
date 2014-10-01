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

// cache by connection string so we don't reload the db multiple times
var cache = {};

/*
 * Returns a runQuery function bound to the given database instance.
 */
function runQuery(db) {
  return boundRunQuery;

  /**
   * Returns a promise containing the result of the query.
   *
   * @param {Query} query - node-sql query object
   */
  function boundRunQuery(query) {
    var run = Q.denodeify(db.run.bind(db));
    var all = Q.denodeify(db.all.bind(db));
    var promise = run('BEGIN');

    if (~query.text.toLowerCase().search(/^select.+/)) {
      promise = promise.then(function() {
        return all(query.text, query.values);
      });
    } else {
      promise = promise.then(function() {
        return run(query.text, query.values);
      });
    }

    return promise
      .then(function(result) {
        return run('COMMIT').then(function() {
          return {
            rows: result
          };
        });
      })
      .catch(function(error) {
        return run('ROLLBACK')
          .then(function() {
            throw new Error(error);
          });
      });
  }
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
    var file = config.connectionString;
    var db = new sqlite3.Database(file);
    var obj = {
      runQuery: runQuery(db),
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
