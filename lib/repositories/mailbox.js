/**
 * Mailbox repository for interacting with mailbox records.
 *
 * @module mailbox
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
     * Creates a mailbox table.
     */
    createTable: function() {
      dependencies.logger.trace('mailbox.createTable called');

      return common.createTable(table, provider);
    },

    /**
     * Creates mailbox indexes.
     */
    createIndexes: function() {
      dependencies.logger.trace('mailbox.createIndexes called');

      return common.createIndex(
        table,
        'vm_mailbox_mailbox_number_context_id',
        ['mailbox_number', 'context_id'],
        provider
      );
    },

    /**
     * Create an instance of a mailbox.
     */
    create: function(number, context, fields, id) {
      dependencies.logger.trace('mailbox.create called');

      id = common.optionalArgument(fields, id, 'number');

      var instance = {
        mailboxNumber: number,
        mailboxName: undefined,
        password: undefined,
        name: undefined,
        email: undefined,
        read: undefined,
        unread: undefined,
        greetingBusy: undefined,
        greetingAway: undefined,
        greetingName: undefined,

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
     * Returns an array of all mailboxes belonging to the specified context
     */
    findByContext: function(context) {
      dependencies.logger.trace('mailbox.findByContext called');

      var query = table
        .select(table.star())
        .from(table)
        .where(table['context_id'].equals(context.getId()))
        .toQuery();

      return common.find(query, provider, constructor.bind(this))
        .then(function(result) {
          return result.reduce(function(mailboxes, mailbox) {
            mailboxes.push(mailbox);
            return mailboxes;
          }, []);
        });

      function constructor(id) {
        /*jshint validthis:true*/
        //Passing undefined so that number can be populated by db result
        return this.create(undefined, context, id);
      }

    },

    /**
     * Returns count of all mailboxes belonging to the specified context
     */
    countByContext: function(context) {
      dependencies.logger.trace('mailbox.countByContext called');

      var query = table
        .select('count(*)')
        .from(table)
        .where(table['context_id'].equals(context.getId()))
        .toQuery();

      return common.count(table, query, provider);
    },

    /**
     * Return a mailbox instance from the database.
     */
    get: function(number, context) {
      dependencies.logger.trace('mailbox.get called');

      var where = table['mailbox_number']
            .equals(number)
            .and(table['context_id'].equals(context.getId()));

      return common.get(table, where, provider, constructor.bind(this))
        .then(function(mailbox) {
          dependencies.logger.debug({
            mailbox: mailbox
          }, 'Mailbox loaded');

          return mailbox;
        });

      function constructor(id) {
        /*jshint validthis:true*/
        return this.create(number, context, id);
      }
    },

    /**
     * Save a mailbox instance to the database.
     */
    save: function(instance) {
      dependencies.logger.trace('mailbox.save called');

      // only mwi functions should allow updating read/unread fields
      if (instance.getId()) {
        var temp = [instance.read, instance.unread];
        instance.read = undefined;
        instance.unread = undefined;
      }

      return common.save(instance, table, provider)
        .then(function() {
          if (instance.getId()) {
            instance.read = temp[0];
            instance.unread = temp[1];
          }

          dependencies.logger.debug({
            mailbox: instance
          }, 'Mailbox saved');
        });
    },

    /**
     * Deletes a mailbox instance from the database.
     */
    remove: function(instance) {
      dependencies.logger.trace('mailbox.remove called');

      return common.remove(instance, table, provider)
        .then(function() {
          dependencies.logger.debug({
            mailbox: instance
          }, 'Mailbox removed');
        });
    },

    /**
     * Updates the unread count.
     *
     * @param {Mailbox} instance - mailbox instance
     * @param {Function} mwi - a function to update mwi counts that returns a
     *   promise
     * @returns {Q} promise - a promise containing the result of updating the
     *   message counts
     */
    newMessage: function(instance, mwi) {
      dependencies.logger.trace('mailbox.newMessage called');

      return updateMwi(instance, mwi, modifier);

      function modifier (row) {
        var read = +row.read || 0;
        var unread = +row.unread || 0;

        return {
          read: read,
          unread: unread + 1
        };
      }
    },

    /**
     * Updates the read/unread counts.
     *
     * @param {Mailbox} instance - mailbox instance
     * @param {Function} mwi - a function to update mwi counts that returns a
     *   promise
     * @returns {Q} promise - a promise containing the result of updating the
     *   message counts
     */
    readMessage: function(instance, mwi) {
      dependencies.logger.trace('mailbox.readMessage called');

      return updateMwi(instance, mwi, modifier);

      function modifier (row) {
        var read = +row.read || 0;
        // make sure unread will be 0 if currently null
        var unread = +row.unread || 1;

        return {
          read: read + 1,
          unread: unread - 1
        };
      }
    },

    /**
     * Updates the read/unread counts.
     *
     * @param {Mailbox} instance - mailbox instance
     * @param {bool} messageRead - whether deleted message had been read or not
     * @param {Function} mwi - a function to update mwi counts that returns a
     *   promise
     * @returns {Q} promise - a promise containing the result of updating the
     *   message counts
     */
    deletedMessage: function(instance, messageRead, mwi) {
      dependencies.logger.trace('mailbox.deletedMessage called');

      return updateMwi(instance, mwi, modifier);

      function modifier (row) {
        var read = +row.read || 0;
        // make sure unread will be 0 if currently null
        var unread = +row.unread || 0;

        if (read && messageRead) {
          read -= 1;
        }

        if (unread && !messageRead) {
          unread -= 1;
        }

        return {
          read: read,
          unread: unread
        };
      }
    }
  };

  /**
   * Updates the mwi counts for a mailbox.
   *
   * @param {Mailbox} instance - mailbox instance
   * @param {Function} mwi - a function to update mwi counts that returns a
   *   promise
   * @param {Function} modifier - a function that takes a database result and
   *   returns an object containing the updated read/unread counts
   * @returns {Q} promise - a promise containing the result of updating the
   *   message counts
   */
  function updateMwi(instance, mwi, modifier) {
    dependencies.logger.trace('mailbox.updateMwi called');

    var query = table
      .select(table.star())
      .from(table)
      .where(table['mailbox_number'].equals(instance.mailboxNumber)
          .and(table['context_id'].equals(instance.getContext().getId())))
      .toQuery();
    query = provider.forUpdate(query);

    return provider.beginTransaction(true)
      .then(function(transaction) {

        return transaction.runQuery(query)
          .then(function(result) {
            var counts = modifier(result.rows[0]);
            
            return mwi(counts.read, counts.unread)
              .then(function() {
                var query = table
                  .update({read: counts.read, unread: counts.unread})
                  .where(table['mailbox_number'].equals(instance.mailboxNumber)
                      .and(table['context_id']
                        .equals(instance.getContext().getId())))
                  .toQuery();

                return transaction.runQuery(query);
              })
              .then(function() {
                return transaction.commit();
              })
              .then(function() {
                dependencies.logger.debug({
                  read: counts.read,
                  unread: counts.unread
                }, 'MWI counts updated');

                return counts;
              });
          })
          .catch(function(err) {
            return transaction.rollback()
              .finally(function() {
                throw new Error(err);
              });
          });
      });
  }
}

/**
 * Returns a repository that can be used to interact with mailboxes.
 *
 * @param {Object} config - config object containing connection string and
 *                          provider name
 * @param {object} dependencies - object keyed by module dependencies
 * @returns {Object} repo - mailbox repository
 */
module.exports = function(config, dependencies) {
  var file = util.format('../providers/%s.js', config.provider);
  var provider = require(file)(config, dependencies);
  var sqlGenerator = new sql.Sql(config.provider);

  var tableName = 'vm_mailbox';
  var columns = [{
    name: 'id',
    dataType: 'integer',
    notNull: true,
    primaryKey: true
  }, {
    name: 'mailbox_number',
    dataType: 'integer',
    notNull: true
  }, {
    name: 'mailbox_name',
    dataType: 'varchar(255)'
  }, {
    name: 'context_id',
    dataType: 'integer',
    references: {
    table: 'vm_context',
    column: 'id'
    },
    notNull: true
  }, {
    name: 'password',
    dataType: 'varchar(100)',
    notNull: true
  }, {
    name: 'name',
    dataType: 'varchar(100)',
    notNull: true
  }, {
    name: 'email',
    dataType: 'varchar(256)',
    notNull: true
  }, {
    name: 'read',
    dataType: 'integer'
  }, {
    name: 'unread',
    dataType: 'integer'
  }, {
    name: 'greeting_away',
    dataType: 'varchar(100)'
  }, {
    name: 'greeting_busy',
    dataType: 'varchar(100)'
  }, {
    name: 'greeting_name',
    dataType: 'varchar(100)'
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
  ), provider.overrides.mailbox);

  return repo;
};
