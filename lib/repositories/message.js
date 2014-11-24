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
var util = require('util');
var Compose = require('compose');
var moment = require('moment');
var Q = require('q');

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
     * Creates a message table.
     */
    createTable: function() {
      dependencies.logger.trace('message.createTable called');

      return common.createTable(table, provider);
    },

    /**
     * Creates message indexes.
     */
    createIndexes: function() {
      dependencies.logger.trace('message.createIndexes called');

      return common.createIndex(
        table,
        'vm_message_mailbox_id_folder_id_date',
        ['mailbox_id', 'folder_id', 'date'],
        provider
      );
    },

    /**
     * Create an instance of a message.
     */
    create: function(mailbox, folder, fields, id) {
      dependencies.logger.trace('message.create called');

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
    },

    /**
     * Return a message instance from the database.
     *
     * Note: private fields remain unchainged from the given instance.
     */
    get: function(instance) {
      dependencies.logger.trace('message.get called');

      var where = table.id
            .equals(instance.getId());

      return common.get(table, where, provider, constructor.bind(this))
        .then(function(message) {
          var result = convertFromStorage(message);

          dependencies.logger.debug({
            message: result
          }, 'Message loaded');

          return result;
        });

      function constructor(id) {
        /*jshint validthis:true*/
        return this.create(instance.getMailbox(), instance.getFolder(), id);
      }
    },

    /*
     * Returns a Messages object containing all messages for the given mailbox
     * and folder.
     */
    all: function(mailbox, folder) {
      dependencies.logger.trace('message.all called');

      var self = this;
      // fetch mailbox messages in batches in parallel
      var limit = 50;

      return count(mailbox, folder)
        .then(function(countResult) {
          dependencies.logger.debug({
            count: countResult
          }, 'Messages count');

          var runs = calculateRuns(countResult);

          return Q.all(getPromises(runs))
            .then(function(results) {
              // flatten to messages array
              return results.reduce(function(messages, batch) {
                messages = messages.concat(batch);

                dependencies.logger.debug({
                  messages: messages
                }, 'Messages loaded');

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

        /*jshint validthis:true*/
        return common.find(query, provider, constructor)
          .then(function(result) {
            return result.map(function(message) {
              return convertFromStorage(message);
            });
          });

        function constructor(id) {
          /*jshint validthis:true*/
          return self.create(mailbox, folder, id);
        }
      }
    },

    /**
     * Returns the latest messages after a given message for the given mailbox
     * and folder.
     *
     * @param {Mailbox} mailbox - mailbox instance
     * @param {Folder} folder - folder instance
     * @param {Moment} latestMessage - date of latest message
     */
    latest: function(mailbox, folder, latestMessage) {
      dependencies.logger.trace('message.latest called');

      var query = table
        .select(table.star())
        .from(table)
        .where(table['mailbox_id'].equals(mailbox.getId())
          .and(table['folder_id'].equals(folder.getId())))
          .and(table.date.gte(provider.convertDateForStorage(latestMessage)))
        .order(table.date)
        .toQuery();

      return common.find(query, provider, constructor.bind(this))
        .then(function(result) {
          return result.map(function(message) {
            return convertFromStorage(message);
          });
        })
        .then(function(result) {
          dependencies.logger.debug({
            messages: result
          }, 'Latest messages loaded');
          
          return result;
        });

      function constructor(id) {
        /*jshint validthis:true*/
        return this.create(mailbox, folder, id);
      }
    },

    /**
     * Save a message instance to the database.
     */
    save: function(instance) {
      dependencies.logger.trace('message.save called');

      var tempObject = convertForStorage(instance);

      return common.save(tempObject, table, provider)
        .then(function() {
          dependencies.logger.debug({
            message: instance
          }, 'Message saved');
        });
    },

    /**
     * Change the folder the message belongs to.
     */
    changeFolder: function(message, folder) {
      dependencies.logger.trace('message.changeFolder called');

      var fields = Object.keys(message).reduce(function(aggregate, key) {
        aggregate[key] = message[key];

        return aggregate;
      }, {});

      var instance = this.create(message.getMailbox(), folder,
                            fields, message.getId());

      return this.save(instance)
        .then(function() {
          dependencies.logger.debug({
            message: instance
          }, 'Message changed to other folder');

          return instance;
        });
    },

    /**
     * Marks the message instance as read in the database.
     */
    markAsRead: function(instance) {
      dependencies.logger.trace('message.markAsRead called');

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
                  dependencies.logger.debug({
                    message: instance,
                    updated: updated
                  }, 'Message marked as read');

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
    },

    /**
     * Deletes a message instance from the database.
     */
    remove: function remove(instance) {
      dependencies.logger.trace('message.remove called');

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
                  dependencies.logger.debug({
                    message: instance
                  }, 'Message removed');

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
  };

  /**
   * Returns a count of all messages for the given mailbox and folder.
   */
  function count(mailbox, folder) {
    dependencies.logger.trace('message.count called');

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
    dependencies.logger.trace('message.convertFromStorage called');

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
    dependencies.logger.trace('message.convertForStorage called');

    if (message) {
      // convert read for storage
      message.read = message.read ? 'Y': 'N';
      message.date = provider.convertDateForStorage(message.date);
    }

    return message;
  }
}

/**
 * Returns a repository that can be used to interact with messages.
 *
 * @param {Object} config - config object containing connection string and
 *                          provider name
 * @param {object} dependencies - object keyed by module dependencies
 * @returns {Object} repo - message repository
 */
module.exports = function(config, dependencies) {
  var file = util.format('../providers/%s.js', config.provider);
  var provider = require(file)(config, dependencies);
  var sqlGenerator = new sql.Sql(config.provider);

  var tableName = 'vm_message';
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
  ), provider.overrides.message);

  return repo;
};
