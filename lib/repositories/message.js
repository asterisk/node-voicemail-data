/**
 * Message repository for interacting with message records.
 *
 * @module message
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
var moment = require('moment');
var Q = require('q');

var provider;
var sqlGenerator;
var table;
var tableName = 'vm_message';

/**
 * Returns column definitions for the message table.
 */
function getColumns() {
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
    name: 'recording',
    dataType: 'varchar(100)',
    notNull: true
  }, {
    name: 'read',
    dataType: 'char(1)',
    notNull: true
  }, {
    name: 'date',
    dataType: provider.getDateType(),
    notNull: true
  }, {
    name: 'original_mailbox',
    dataType: 'integer'
  }, {
    name: 'caller_id',
    dataType: 'varchar(100)'
  }, {
    name: 'duration',
    dataType: 'varchar(100)',
    notNull: true
  }, {
    name: 'folder_id',
    dataType: 'integer',
    references: {
      table: 'vm_folder',
      column: 'id'
    },
    notNull: true
  }];

  return columns;
}

/**
 * Creates a message table.
 */
function createTable() {
  return common.createTable(table, provider);
}

/**
 * Creates message indexes.
 */
function createIndexes() {
  return common.createIndex(
    table,
    'vm_message_mailbox_id_folder_id_date',
    ['mailbox_id', 'folder_id', 'date'],
    provider
  );
}

/**
 * Create an instance of a message.
 */
function create(mailbox, folder, fields, id) {
  id = common.optionalArgument(fields, id, 'number');

  var instance = {
    date: undefined,
    read: undefined,
    originalMailbox: undefined,
    callerId: undefined,
    duration: undefined,
    recording: undefined,

    getId: function() {
      return id;
    },

    getMailbox: function() {
      return mailbox;
    },

    getFolder: function() {
      return folder;
    },

    /**
     * Initialization steps for new messages.
     */
    init: function() {
      this.date = moment.utc();
      this.read = false;
    },

    /**
     * Mark the message as read. Returns true if this message was previously
     * unread.
     */
    markAsRead: function() {
      if (!this.read) {
        this.read = true;
        return true;
      }

      return false;
    }
  };

  return common.populateFields(instance, fields);
}

/**
 * Return a message instance from the database.
 *
 * Note: private fields remain unchainged from the given instance.
 */
function get(instance) {
  var where = table.id
        .equals(instance.getId());

  return common.get(table, where, provider, constructor)
    .then(function(message) {
      return convertFromStorage(message);
    });

  function constructor(id) {
    return create(instance.getMailbox(), instance.getFolder(), id);
  }
}

/*
 * Returns a Messages object containing all messages for the given mailbox and
 * folder.
 */
function all(mailbox, folder) {
  // fetch mailbox messages in batches in parallel
  var limit = 50;

  return count(mailbox, folder)
    .then(function(countResult) {
      var runs = calculateRuns(countResult);

      return Q.all(getPromises(runs))
        .then(function(results) {
          // flatten to messages array
          return results.reduce(function(messages, batch) {
            messages = messages.concat(batch);

            return messages;
          }, []);
        });
    });

  function calculateRuns(count) {
    // even limit runs plus any remainder
    return (Math.floor(count / limit)) + ((count % limit > 0) ? 1 : 0);
  }

  function getPromises(runs) {
    var handled = 0;
    var promises = [];

    while(handled !== runs) {
      promises.push(getMessageBatch(handled * limit));
      handled += 1;
    }

    return promises;
  }

  function getMessageBatch(offset) {
    var query = table
      .select(table.star())
      .from(table)
      .where(table['mailbox_id'].equals(mailbox.getId())
        .and(table['folder_id'].equals(folder.getId())))
      .order(table.date)
      .limit(limit)
      .offset(offset)
      .toQuery();

    return common.find(query, provider, constructor)
      .then(function(result) {
        return result.map(function(message) {
          return convertFromStorage(message);
        });
      });

    function constructor(id) {
      return create(mailbox, folder, id);
    }
  }
}

/**
 * Returns the latest messages after a given message for the given mailbox and
 * folder.
 *
 * @param {Mailbox} mailbox - mailbox instance
 * @param {Folder} folder - folder instance
 * @param {Moment} latestMessage - date of latest message
 */
function latest(mailbox, folder, latestMessage) {
  var query = table
    .select(table.star())
    .from(table)
    .where(table['mailbox_id'].equals(mailbox.getId())
      .and(table['folder_id'].equals(folder.getId())))
      .and(table.date.gte(provider.convertDateForStorage(latestMessage)))
    .order(table.date)
    .toQuery();

  return common.find(query, provider, constructor)
    .then(function(result) {
      return result.map(function(message) {
        return convertFromStorage(message);
      });
    });

  function constructor(id) {
    return create(mailbox, folder, id);
  }
}

/**
 * Save a message instance to the database.
 */
function save(instance) {
  instance = convertForStorage(instance);
  return common.save(instance, table, provider);
}

/**
 * Change the folder the message belongs to.
 */
function changeFolder(message, folder) {
  var fields = Object.keys(message).reduce(function(aggregate, key) {
    aggregate[key] = message[key];

    return aggregate;
  }, {});

  var instance = create(message.getMailbox(), folder, fields, message.getId());

  return save(instance)
    .then(function() {
      return instance;
    });
}

/**
 * Marks the message instance as read in the database.
 */
function markAsRead(instance) {
  var query = table
    .select(table.star())
    .from(table)
    .where(table.id.equals(instance.getId()))
    .toQuery();
  query = provider.forUpdate(query);

  return provider.beginTransaction(true)
    .then(function(transaction) {

      return transaction.runQuery(query)
        .then(function(result) {
          /*jshint newcap:false*/
          var promise = Q();
          var message = result.rows[0];
          var updated = false;
          message = convertFromStorage(message);

          if (message && !message.read) {
            updated = true;
            message.read = true;
            message = convertForStorage(message);

            var query = table
              .update({read: message.read})
              .where(table.id.equals(instance.getId()))
              .toQuery();

            promise = transaction.runQuery(query);
          }

          return promise
            .then(function() {
              return transaction.commit();
            })
            .then(function() {
              return updated;
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

/**
 * Deletes a message instance from the database.
 */
function remove(instance) {
  var query = table
    .select(table.star())
    .from(table)
    .where(table.id.equals(instance.getId()))
    .toQuery();
  query = provider.forUpdate(query);

  return provider.beginTransaction(true)
    .then(function(transaction) {

      return transaction.runQuery(query)
        .then(function(result) {
          var query = table
            .delete()
            .where(table.id.equals(instance.getId()))
            .toQuery();

          var message = result.rows[0];
          message = convertFromStorage(message);

          return transaction.runQuery(query)
            .then(function() {
              return transaction.commit();
            })
            .then(function() {
              return message;
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

/**
 * Returns a count of all messages for the given mailbox and folder.
 */
function count(mailbox, folder) {
   var query = table
    .select('count(*)')
    .from(table)
    .where(table['mailbox_id'].equals(mailbox.getId())
      .and(table['folder_id'].equals(folder.getId())))
    .toQuery();

  return common.count(table, query, provider);
}

/**
 * Modifies certain types from db storage to object format.
 */
function convertFromStorage(message) {
  if (message) {
    // convert read and date from storage
    message.read = message.read === 'Y' ? true : false;
    message.date = provider.convertDateFromStorage(message.date);
  }

  return message;
}

/**
 * Modifies certain types from object format for db storage.
 */
function convertForStorage(message) {
  if (message) {
    // convert read for storage
    message.read = message.read ? 'Y': 'N';
    message.date = provider.convertDateForStorage(message.date);
  }

  return message;
}

/**
 * Returns a repository that can be used to interact with messages.
 *
 * @param {Object} config - config object containing connection string and
 *                          provider name
 * @returns {Object} repo - message repository
 */
module.exports = function(config) {
  var file = util.format('../providers/%s.js', config.provider);
  provider = require(file)(config);
  sqlGenerator = new sql.Sql(config.provider);

  table = sqlGenerator.define({
    name: tableName,
    columns: getColumns()
  });
  // provider specific overrides
  var repo = Compose.call({
    createTable: createTable,
    createIndexes: createIndexes,
    create: create,
    all: all,
    get: get,
    markAsRead: markAsRead,
    latest: latest,
    save: save,
    changeFolder: changeFolder,
    remove: remove
  }, provider.overrides.message);

  return repo;
};
