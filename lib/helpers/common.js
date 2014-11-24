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
 * Returns a common API for interacting with repositories.
 */
function createApi(dependencies) {
  return {
    /**
     * Returns first if it matches the type, second otherwise.
     *
     * @param {object} first - optional argument
     * @param {object} second - non optional argument
     * @param {string} type - expected type of non optional argument
     */
    optionalArgument: function(first, second, type) {
      dependencies.logger.trace('common.optionalArgument called');

      if (typeof(first) === type) {
        return first;
      } else {
        return second;
      }
    },

    /**
     * Populates the instance with fields if they contain appropriate keys.
     *
     * @param {object} instance - repository instance
     * @param {object} fields - key/value field mappings
     */
    populateFields: function(instance, fields) {
      dependencies.logger.trace('common.populateFields called');

      fields = fields || {};
      Object.keys(instance).forEach(function(field) {
        if (typeof(instance[field]) !== 'function' &&
            fields[field] !== undefined) {
          instance[field] = fields[field];
        }
      });

      return instance;
    },

    /**
     * Creates the given table using the given provider.
     *
     * @param {object} table - a node-sql table definition
     * @param {object} provider - a database specific provider instance
     * @returns {Q} promise - a promise containing the result of creating
     *                        the table
     */
    createTable: function(table, provider) {
      dependencies.logger.trace('common.createTable called');

      var query = table.create().ifNotExists().toQuery();
      query.text = provider.autoIncrement(query.text);

      return provider.runQuery(query);
    },

    /**
     * Creates an index for the table using the name and fields given.
     *
     * @param {object} table - node-sql table definition
     * @param {string} name - index name
     * @param {string[]} fields - array of field names
     * @param {object} provider - database provider
     * @returns {Q} promise - a promise containing the result of creating
     *                        the index
     */
    createIndex: function(table, name, fields, provider) {
      dependencies.logger.trace('common.createIndex called');

      fields = (Array.isArray(fields)) ? fields: [fields];

      var indexFields = fields.map(function(field) {
        return table[field];
      });
      var index = table.indexes().create(name).unique();
      var query = index.on.apply(index, indexFields).toQuery();

      return provider.runQuery(query);
    },

    /**
     * Returns a single instance tied to the given table using a where clause
     * and the given constructor to construct the instance.
     *
     * @param {object} table - a node-sql table definition
     * @param {object} where - a node-sql where clause
     * @param {object} provider - a database specific provider instance
     * @param {function} constructor - a constructor for the repository being
     *                                 operated on
     */
    get: function(table, where, provider, constructor) {
      dependencies.logger.trace('common.get called');

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
    },

    /**
     * Returns an array of instances for the given query using the given
     * constructor.
     *
     * @param {object} query - a node-sql query instance
     * @param {object} provider - a database specific provider instance
     * @param {function} constructor - a constructor for the repository being
     *                                 operated on
     */
    find: function(query, provider, constructor) {
      dependencies.logger.trace('common.find called');

      return provider.runQuery(query)
        .then(function(result) {
          var instances = result.rows.map(function(row) {
            return instanceFromRow(row, constructor);
          });

          return instances;
        });
    },

    /**
     * Returns an integer count using the given query.
     *
     * @param {object} table - a node-sql table definition
     * @param {object} query - a node-sql query instance
     * @param {object} provider - a database specific provider instance
     */
    count: function(table, query, provider) {
      dependencies.logger.trace('common.count called');

      return provider.runQuery(query)
        .then(function(result) {
          var countRow = result.rows[0];
          var count = +countRow[Object.keys(countRow)[0]];

          return count;
        });
    },

    /**
     * Saves the instance using the given table and provider.
     *
     * @param {pbject} instance - the instance to save to the database
     * @param {object} table - a node-sql table definition
     * @param {object} provider - a database specific provider instance
     */
    save: function(instance, table, provider) {
      dependencies.logger.trace('common.save called');

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
    },

    remove: function(instance, table, provider) {
      dependencies.logger.trace('common.remove called');

      var query = table
        .delete()
        .where(table.id.equals(instance.getId()))
        .toQuery();

      return provider.runQuery(query);
    }
  };

  /**
   * Returns an instance from the given row using the given constructor.
   *
   * @param {object} row - a database row
   * @param {function} constructor - a constructor for the repository being
   *                                 operated on
   */
  function instanceFromRow(row, constructor) {
    dependencies.logger.trace('common.instanceFromRow called');

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

  /**
   * Returns the fields that should be saved to the database from the given
   * instance using the table definition as a reference.
   *
   * @param {pbject} instance - the instance to save to the database
   * @param {object} table - a node-sql table definition
   * @param {function} step - a step function for accumulating fields
   * @param {object} initial - an initial value to reduce the fields over
   * @returns {collection} - a collection containing the fields that should be
   *                         saved
   */
  function getFields(instance, table, step, initial) {
    dependencies.logger.trace('common.getFields called');

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
    dependencies.logger.trace('common.removeEmptyFields called');

    var result = {};
    Object.keys(fields).forEach(function(field) {
      if (fields[field] !== undefined) {
        result[field] = fields[field];
      }
    });

    return result;
  }
}

/**
 * Returns a common API for dealing with repositories.
 *
 * @param {object} dependencies - object keyed by module dependencies
 */
module.exports = function(dependencies) {
  return createApi(dependencies);
};
