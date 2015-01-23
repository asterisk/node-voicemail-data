/**
 * Folder repository for interacting with folder records.
 *
 * @module folder
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
 * Returns an API for interacting with folders.
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
     * Creates a folder table.
     */
    createTable: function() {
      dependencies.logger.trace('folder.createTable called');

      return common.createTable(table, provider);
    },

    /**
     * Creates folder indexes.
     */
    createIndexes: function() {
      dependencies.logger.trace('folder.createIndexes called');

      return common.createIndex(table, 'vm_folder_name', 'name', provider)
        .then(function() {
          return common.createIndex(table, 'vm_folder_dtmf', 'dtmf', provider);
        });
    },

    /**
     * Create an instance of a folder.
     */
    create: function(fields, id) {
      dependencies.logger.trace('folder.create called');

      id = common.optionalArgument(fields, id, 'number');

      var instance = {
        name: undefined,
        recording: undefined,
        dtmf: undefined,

        getId: function() {
          return id;
        }
      };

      return common.populateFields(instance, fields);
    },

    /*
     * Returns an object where the keys are folder dtmf, and the values are
     * folder instances.
     */
    all: function() {
      dependencies.logger.trace('folder.all called');

      var query = table
        .select(table.star())
        .from(table)
        .toQuery();

      return common.find(query, provider, constructor.bind(this))
        .then(function(result) {
          return result.reduce(function(folders, folder) {
            folders.add(folder);
            return folders;
          }, collection());
        });

      function constructor(id) {
        /*jshint validthis:true*/
        return this.create(id);
      }
    },

    /**
     * Return a folder instance from the database.
     */
    get: function(name) {
      dependencies.logger.trace('folder.get called');

      var where = table.name
            .equals(name);

      return common.get(table, where, provider, constructor.bind(this))
        .then(function(folder) {
          dependencies.logger.debug({folder: folder}, 'Folder loaded');

          return folder;
        });

      function constructor(id) {
        /*jshint validthis:true*/
        return this.create(id);
      }
    },

    /**
     * Return an array of folders instance from the database matching
     * the name or DTMF provided. Useful for checking for conflicts
     * prior to adding a new item.
     */
    findByNameOrDTMF: function(name, dtmf) {
      dependencies.logger.trace('folder.findByNameOrDtmf called');

      var where = table.name.equals(name)
                  .or(table.dtmf.equals(dtmf));

      var query = table
        .select(table.star())
        .from(table)
        .where(where)
        .toQuery();

      return common.find(query, provider, constructor.bind(this))
        .then(function(result) {
          dependencies.logger.debug({
            folders: result
          }, 'Folders loaded');

          return result;
        });

      function constructor(id) {
        /*jshint validthis:true*/
        return this.create(id);
      }
    },

    /**
     * Save a folder instance to the database.
     */
    save: function(instance) {
      dependencies.logger.trace('folder.save called');

      return common.save(instance, table, provider)
        .then(function() {
          dependencies.logger.debug({
            folder: instance
          }, 'Folder saved');
        });
    },

    /**
     * Deletes a folder instance from the database.
     */
    remove: function(instance) {
      dependencies.logger.trace('folder.remove called');

      return common.remove(instance, table, provider)
        .then(function() {
          dependencies.logger.debug({
            folder: instance
          }, 'Folder removed');
        });
    }
  };

  /**
   * Returns an object representing a collection of folders.
   */
  function collection() {
    var collectionObj = {
      add: function(folders) {
        var self = this;
        folders = (Array.isArray(folders)) ? folders: [folders];

        folders.forEach(function(folder) {
          self[folder.dtmf] = folder;
        });
      }
    };

    return collectionObj;
  }

}

/**
 * Returns a repository that can be used to interact with folders.
 *
 * @param {Object} config - config object containing connection string and
 *                          provider name
 * @param {object} dependencies - object keyed by module dependencies
 * @returns {Object} repo - folder repository
 */
module.exports = function(config, dependencies) {
  var file = util.format('../providers/%s.js', config.provider);
  var provider = require(file)(config, dependencies);
  var sqlGenerator = new sql.Sql(config.provider);

  var tableName = 'vm_folder';
  var columns = [{
    name: 'id',
    dataType: 'integer',
    notNull: true,
    primaryKey: true
  }, {
    name: 'name',
    dataType: 'varchar(25)',
    notNull: true
  }, {
    name: 'recording',
    dataType: 'varchar(100)',
    notNull: true
  }, {
    name: 'dtmf',
    dataType: 'integer',
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
  ), provider.overrides.folder);

  return repo;
};
