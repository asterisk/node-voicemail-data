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
  // manually create index to ensure descending order on date
  var query = {
    text: util.format(
      'create index %s on %s(%s)',
      'vm_message_mailbox_id_folder_id_read_date',
      'vm_message',
      'mailbox_id, folder_id, read, date desc'
    ),
    values: []
  };

  return provider.runQuery(query);
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

/*
 * Returns a Messages object containing all messages for the given mailbox and
 * folder.
 */
function all(mailbox, folder) {
  // fetch mailbox messages in batches in parallel
  var limit = 50;
  var messages = [];

  return count(mailbox, folder)
    .then(function(countResult) {
      var runs = calculateRuns(countResult);

      return Q.all(getPromises(runs))
        .then(function(results) {
          // flatten to messages array
          return results.reduce(function(messages, batch) {
            messages.add(batch);

            return messages;
          }, collection());
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
      .order(table.read, table.date.descending)
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
    .order(table.read, table.date.descending)
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
 * Deletes a message instance from the database.
 */
function remove(instance) {
  return common.remove(instance, table, provider);
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
 * Returns an object representing a collection of messages.
 */
function collection() {
  var messages = [];
  var previousMessages = [];
  var currentMessage = null;

  var collectionObj = {
    countNew: 0,
    countOld: 0,
    // 1900
    latest: moment.utc('1990-01-01T00:00:00.000Z'),

    previousExists: function() {
      return !!previousMessages.length;
    },

    currentExists: function() {
      return !!currentMessage;
    },

    isEmpty: function() {
      return !!messages.length;
    },

    isNotEmpty: function() {
      return !this.isEmpty();
    },
  
    next: function() {
      var result;

      var more = messages.some(function(message) {
        // has the message been played before?
        var played = previousMessages.some(function(prevMessage) {
          return prevMessage.getId() === message.getId();
        });

        if (played || (currentMessage &&
                       currentMessage.getId() === message.getId())) {
          return false;
        } else {
          result = message;
          return true;
        }
      });

      if (more) {
        // update previous messages and current message
        if (currentMessage) {
          previousMessages.push(currentMessage);
        }

        currentMessage = result;
      }

      return result;
    },

    current: function() {
      return currentMessage;
    },

    previous: function() {
      var result = previousMessages.pop();

      if (result) {
        currentMessage = result;
      }

      return result;
    },

    first: function() {
      currentMessage = undefined;
      previousMessages = [];

      return this.next();
    },

    getMessage: function(playback) {
      var recording = playback['media_uri'].slice(10);

      return messages.filter(function(message) {
        return message.recording === recording;
      })[0];
    },

    markAsRead: function(message) {
      var changed = message.markAsRead();

      if (changed) {
        this.countOld += 1;
        this.countNew -= 1;
      }
      return changed;
    },

    add: function(newMessages) {
      var self = this;
      var reinsert = false;
      if (!Array.isArray(newMessages)) {
        newMessages = [newMessages];
      }
      if (messages.length) {
        reinsert = true;
      }

      newMessages.forEach(function (message) {
        // skip duplicates
        var existing = messages.filter(function(candidate) {
          return candidate.getId() === message.getId() && message.getId();
        });

        if (!existing.length) {
          messages.push(message);
          if (message.read) {
            self.countOld += 1;
          } else {
            self.countNew += 1;
          }

          if (message.date.isAfter(self.latest)) {
            self.latest = message.date;
          }
        }
      });

      if (reinsert) {
        this.sort();
      }
    },

    sort: function() {
      var unread = split(messages, false);
      var read = split(messages, true);
      sortByDate(unread);
      sortByDate(read);
      // add all unread to the list of read to recombine into final array
      Array.prototype.push.apply(unread, read);
      messages = unread;

      function split(group, read) {
        return group.filter(function(message) {
          return (read && message.read) || (!read && !message.read);
        });
      }

      function sortByDate(group) {
        group.sort(function(first, second) {
          // sort in descending order
          if (first.date.isAfter(second.date)) {
            return -1;
          } else if (second.date.isAfter(first.date)) {
            return 1;
          } else {
            return 0;
          }
        });
      }
    },

    remove: function(message) {
      // no need to update latest since we use that value to fetch another batch
      // of messages
      messages = messages.filter(function(candidate) {
        return candidate.getId() !== message.getId();
      });

      // update previous messages and current message
      previousMessages = previousMessages.filter(function(candidate) {
        return candidate.getId() !== message.getId();
      });
      if (currentMessage.getId() === message.getId()) {
        currentMessage = undefined;
      }

      if (message.read) {
        this.countOld -= 1;
      } else {
        this.countNew -= 1;
      }
    }
  };

  return collectionObj;
}

/**
 * Modifies certain types from db storage to object format.
 */
function convertFromStorage(message) {
  // convert read and date from storage
  message.read = message.read === 'Y' ? true : false;
  message.date = provider.convertDateFromStorage(message.date);

  return message;
}

/**
 * Modifies certain types from object format for db storage.
 */
function convertForStorage(message) {
  // convert read for storage
  message.read = message.read ? 'Y': 'N';
  message.date = provider.convertDateForStorage(message.date);

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
    latest: latest,
    save: save,
    remove: remove
  }, provider.overrides.message);

  return repo;
};
