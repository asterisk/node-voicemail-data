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
                done();
                return result;
              });
          })
          .catch(function (error) {
            return clientQuery('ROLLBACK')
              .then(function() {
                done();
                throw new Error(error);
              });
          });
      });
  }
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
