/**
 * Common (provider agnostic) functions for data access.
 *
 * @module common
 *
 * @copyright 2014, Digium, Inc.
 * @license Apache License, Version 2.0
 * @author Samuel Fortier-Galarneau <sgalarneau@digium.com>
 */

'use strict';

var Case = require('case');
var util = require('util');

/**
 * Returns first if it matches the type, second otherwise.
 *
 * @param {Object} first - optional argument
 * @param {Object} second - non optional argument
 * @param {string} type - expected type of non optional argument
 */
function optionalArgument(first, second, type) {
  if (typeof(first) === type) {
    return first;
  } else {
    return second;
  }
}

/**
 * Populates the instance with fields if they contain appropriate keys.
 *
 * @param {Object} instance - repository instance
 * @param {Object} fields - key/value field mappings
 */
function populateFields(instance, fields) {
  fields = fields || {};
  Object.keys(instance).forEach(function(field) {
    if (typeof(instance[field]) !== 'function' && fields[field] !== undefined) {
      instance[field] = fields[field];
    }
  });

  return instance;
}

/**
 * Creates the given table using the given provider.
 *
 * @returns {Q} promise - a promise containing the result of creating the table
 */
function createTable(table, provider) {
  var query = table.create().ifNotExists().toQuery();
  query.text = provider.autoIncrement(query.text);

  return provider.runQuery(query);
}

/**
 * Creates an index for the table using the name and fields given.
 *
 * @param {Object} table - node-sql table definition
 * @param {string} name - index name
 * @param {string[]} fields - array of field names
 * @param {Object} provider - database provider
 * @returns {Q} promise - a promise containing the result of creating the index
 */
function createIndex(table, name, fields, provider) {
  fields = (Array.isArray(fields)) ? fields: [fields];

  var indexFields = fields.map(function(field) {
    return table[field];
  });
  var index = table.indexes().create(name).unique();
  var query = index.on.apply(index, indexFields).toQuery();

  return provider.runQuery(query);
}

/**
 * Returns a single instance tied to the given table using a where clause and
 * the given constructor to construct the instance.
 */
function get(table, where, provider, constructor) {
  // this set to repo instance, can use this.create to get instance
  var query = table
    .select(table.star())
    .from(table)
    .where(where)
    .toQuery();

  return provider.runQuery(query)
    .then(function(result) {
      var row = result.rows[0];

      return instanceFromRow(row, constructor);
    });
}

/**
 * Returns an array of instances for the given query using the given
 * constructor.
 */
function find(query, provider, constructor) {
  return provider.runQuery(query)
    .then(function(result) {
      var instances = result.rows.map(function(row) {
        return instanceFromRow(row, constructor);
      });

      return instances;
    });
}

/**
 * Returns an integer count using the given query.
 */
function count(table, query, provider) {
  return provider.runQuery(query)
    .then(function(result) {
      var countRow = result.rows[0];
      var count = +countRow[Object.keys(countRow)[0]];

      return count;
    });
}

/**
 * Returns an instance from the given row using the given constructor.
 */
function instanceFromRow(row, constructor) {
  var instance = null;

  if (row) {
    instance = constructor(row.id);
    Object.keys(instance).forEach(function(key) {
      if (instance[key] === undefined) {
        var field = Case.snake(key);
        instance[key] = row[field];
      }
    });
  }

  return instance;
}

function save(instance, table, provider) {
  var query;
  var fields;

  // update or insert?
  if (instance.getId()) {
    fields = getFields(instance, table, function(all, current, value) {
      all[current] = value;

      return all;
    }, {});
    query = table
      .update(removeEmptyFields(fields))
      .where(table.id.equals(instance.getId()))
      .toQuery();
  } else {
    fields = getFields(instance, table, function(all, current, value) {
      var field = table[current].value(value);
      all.push(field);

      return all;
    }, []);
    query = table
      .insert.apply(table, fields)
      .toQuery();
  }

  return provider.runQuery(query);
}

function remove(instance, table, provider) {
  var query = table
    .delete()
    .where(table.id.equals(instance.getId()))
    .toQuery();

  return provider.runQuery(query);
}

function getFields(instance, table, step, initial) {
  var fields = table.columns.reduce(function(all, column) {
    // reference or property?
    if (column.references) {
      var referenceName = column.name.split('_')[0];
      var referenceField = column.name.split('_')[1];
      var method = util.format('get%s', Case.title(referenceName));

      if (instance[method]) {
        all = step(all, column.name, instance[method]().getId());
      }
    } else {
      var property = Case.camel(column.name);

      if (instance[property] && typeof(instance[property]) !== 'function') {
        all = step(all, column.name, instance[property]);
      }
    }

    return all;
  }, initial);

  return fields;
}

/**
 * Removes any field from the object with an undefined value. Nulls are
 * conserved to ensure fields can be updated to a null value.
 *
 * @param {Object} fields - object used to update a record
 */
function removeEmptyFields(fields) {
  var result = {};
  Object.keys(fields).forEach(function(field) {
    if (fields[field] !== undefined) {
      result[field] = fields[field];
    }
  });

  return result;
}

module.exports = {
  optionalArgument: optionalArgument,
  populateFields: populateFields,
  createTable: createTable,
  createIndex: createIndex,
  get: get,
  find: find,
  count: count,
  save: save,
  remove: remove
};
