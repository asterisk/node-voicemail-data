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
var common = require('../helpers/common.js');
var util = require('util');
var Compose = require('compose');

var provider;
var sqlGenerator;
var table;
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

/**
 * Creates a folder table.
 */
function createTable() {
  return common.createTable(table, provider);
}

/**
 * Creates folder indexes.
 */
function createIndexes() {
  return common.createIndex(table, 'vm_folder_name', 'name', provider)
    .then(function() {
      return common.createIndex(table, 'vm_folder_dtmf', 'dtmf', provider);
    });
}

/**
 * Create an instance of a folder.
 */
function create(fields, id) {
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
}

/*
 * Returns an object where the keys are folder dtmf, and the values are folder
 * instances.
 */
function all() {
  var query = table
    .select(table.star())
    .from(table)
    .toQuery();

  return common.find(query, provider, constructor)
    .then(function(result) {
      return result.reduce(function(folders, folder) {
        folders.add(folder);
        return folders;
      }, collection());
    });

  function constructor(id) {
    return create(id);
  }
}

/**
 * Save a folder instance to the database.
 */
function save(instance) {
  return common.save(instance, table, provider);
}

/**
 * Deletes a folder instance from the database.
 */
function remove(instance) {
  return common.remove(instance, table, provider);
}

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

/**
 * Returns a repository that can be used to interact with folders.
 *
 * @param {Object} config - config object containing connection string and
 *                          provider name
 * @returns {Object} repo - folder repository
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
    all: all,
    save: save,
    remove: remove
  }, provider.overrides.folder);

  return repo;
};
