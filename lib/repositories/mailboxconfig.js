/**
 * Mailbox Config repository for interacting with mailbox config records.
 *
 * @module mailboxconfig
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
     * Creates a mailbox config table.
     */
    createTable: function() {
      dependencies.logger.trace('mailboxConfig.createTable called');

      return common.createTable(table, provider);
    },

    /**
     * Creates mailbox config indexes.
     */
    createIndexes: function() {
      dependencies.logger.trace('mailboxConfig.createIndexes called');

      return common.createIndex(
        table, 'vm_mailbox_config_mailbox_id', 'mailbox_id', provider);
    },

    /**
     * Create an instance of a mailbox config.
     */
    create: function(mailbox, fields, id) {
      dependencies.logger.trace('mailboxConfig.create called');

      id = common.optionalArgument(fields, id, 'number');

      var instance = {
        key: undefined,
        value: undefined,

        getId: function() {
          return id;
        },

        getMailbox: function() {
          return mailbox;
        }
      };

      return common.populateFields(instance, fields);
    },

    /**
     * Returns all mailbox config instance from the database for a given
     * mailbox.
     */
    all: function(mailbox) {
      dependencies.logger.trace('mailboxConfig.all called');

      var query = table
        .select(table.star())
        .from(table)
        .where(table['mailbox_id'].equals(mailbox.getId()))
        .toQuery();

      return common.find(query, provider, constructor.bind(this))
        .then(function(results) {
          dependencies.logger.debug({
            mailboxConfigs: results
          }, 'Mailbox Config loaded');

          return results;
        });

      function constructor(id) {
        /*jshint validthis:true*/
        return this.create(mailbox, id);
      }
    },

    /**
     * Save a mailbox config instance to the database.
     */
    save: function(instance) {
      dependencies.logger.trace('mailboxConfig.save called');

      return common.save(instance, table, provider)
        .then(function() {
          dependencies.logger.debug({
            mailboxConfig: instance
          }, 'Mailbox Config saved');
        });
    },

    /**
     * Deletes a mailbox config instance from the database.
     */
    remove: function(instance) {
      dependencies.logger.trace('mailboxConfig.remove called');

      return common.remove(instance, table, provider)
        .then(function() {
          dependencies.logger.debug({
            mailboxConfig: instance
          }, 'Mailbox Config removed');
        });
    }
  };
}

/**
 * Returns a repository that can be used to interact with mailbox configs.
 *
 * @param {Object} config - config object containing connection string and
 *                          provider name
 * @param {object} dependencies - object keyed by module dependencies
 * @returns {Object} repo - mailbox config repository
 */
module.exports = function(config, dependencies) {
  var file = util.format('../providers/%s.js', config.provider);
  var provider = require(file)(config, dependencies);
  var sqlGenerator = new sql.Sql(config.provider);

  var tableName = 'vm_mailbox_config';
  var columns = [{
    name: 'id',
    dataType: 'integer',
    notNull: true,
    primaryKey: true
  }, {
    name: 'mailbox_id',
    dataType: 'integer',
    references: {
      table: 'vm_mailbox',
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
  ), provider.overrides.mailboxConfig);

  return repo;
};
