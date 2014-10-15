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
var common = require('../helpers/common.js');
var util = require('util');
var Compose = require('compose');

var provider;
var sqlGenerator;
var table;
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

/**
 * Creates a mailbox table.
 */
function createTable() {
  return common.createTable(table, provider);
}

/**
 * Creates mailbox indexes.
 */
function createIndexes() {
  return common.createIndex(
    table,
    'vm_mailbox_mailbox_number_context_id',
    ['mailbox_number', 'context_id'],
    provider
  );
}

/**
 * Create an instance of a mailbox.
 */
function create(number, context, fields, id) {
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
}

/**
 * Return a mailbox instance from the database.
 */
function get(number, context) {
  var where = table['mailbox_number']
        .equals(number)
        .and(table['context_id'].equals(context.getId()));

  return common.get(table, where, provider, constructor);

  function constructor(id) {
    return create(number, context, id);
  }
}

/**
 * Save a mailbox instance to the database.
 */
function save(instance) {
  // only mwi functions should allow updating read/unread fields
  if (instance.getId()) {
    var temp = [instance.read, instance.unread];
    instance.read = undefined;
    instance.unread = undefined;
  }

  return common.save(instance, table, provider)
    .then(function(result) {
      if (instance.getId()) {
        instance.read = temp[0];
        instance.unread = temp[1];
      }

      return result;
    });
}

/**
 * Deletes a mailbox instance from the database.
 */
function remove(instance) {
  return common.remove(instance, table, provider);
}

/**
 * Updates the unread count.
 *
 * @param {Mailbox} instance - mailbox instance
 * @param {Function} mwi - a function to update mwi counts that returns a
 *   promise
 * @returns {Q} promise - a promise containing the result of updating the
 *   message counts
 */
function newMessage(instance, mwi) {

  return updateMwi(instance, mwi, modifier);

  function modifier (row) {
    var read = +row.read || 0;
    var unread = +row.unread || 0;

    return {
      read: read,
      unread: unread + 1
    };
  }
}

/**
 * Updates the read/unread counts.
 *
 * @param {Mailbox} instance - mailbox instance
 * @param {Function} mwi - a function to update mwi counts that returns a
 *   promise
 * @returns {Q} promise - a promise containing the result of updating the
 *   message counts
 */
function readMessage(instance, mwi) {

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
}

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
function deletedMessage(instance, messageRead, mwi) {

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
              return counts;
            });
        })
        .catch(function(err) {
          return transaction.rollback()
            .then(function() {
              throw new Error(err);
            });
        });
    });
}

/**
 * Returns a repository that can be used to interact with mailboxes.
 *
 * @param {Object} config - config object containing connection string and
 *                          provider name
 * @returns {Object} repo - mailbox repository
 */
module.exports = function(config) {
  var file = util.format('../providers/%s.js', config.provider);
  provider = require(file)(config);
  sqlGenerator = new sql.Sql(config.provider);

  table = sqlGenerator.define({
    name: tableName,
    columns: columns
  });
  // provider specific overrides
  var repo = Compose.call({
    createTable: createTable,
    createIndexes: createIndexes,
    create: create,
    get: get,
    save: save,
    remove: remove,
    newMessage: newMessage,
    readMessage: readMessage,
    deletedMessage: deletedMessage
  }, provider.overrides.mailbox);

  return repo;
};
