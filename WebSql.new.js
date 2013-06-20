/**
 * @class Ext.data.proxy.WebSql
 * @author Paul van Santen
 * @author Grgur Grisogono
 *
 * WebSQL proxy connects models and stores to local WebSQL database.
 *
 * WebSQL is deprecated in favor of indexedDb, so use with caution.
 * IndexedDb is not available for mobile browsers at the time of writing this code
 *
 * Version: 0.3
 *
 * TODO:
 *      filters,
 *      failover option for remote proxies,
 *      database version migration
 */
Ext.define('Ext.data.proxy.WebSql', {
    extend: 'Ext.data.proxy.Proxy',
    alias: 'proxy.websql',

    config: {
        batchActions: true,

        /**
         * @cfg {String} version
         * database version. If different than current, use updatedb event to update database
         */
        dbVersion: '1.0',

        /**
         * @cfg {String} dbName
         * @required
         * Name of database
         */
        dbName: undefined,

        /**
         * @cfg {String} dbDescription
         * Description of the database
         */
        dbDescription: '',

        /**
         * @cfg {String} dbSize
         * Max storage size in bytes
         */
        dbSize: 10 * 1024 * 1024,

        /**
         * @cfg {String} dbTable
         * @required
         * Name for table where all the data will be stored
         */
        dbTable: undefined,

        /**
         * @cfg {String} pkField
         * Primary key name. Defaults to idProperty
         */
        pkField: undefined,

        /**
         * @cfg {String} pkType
         * Type of primary key. By default it an autoincrementing integer
         */
        pkType: 'INTEGER PRIMARY KEY ASC',

        /**
         * @cfg {boolean} insertReplace
         * Setting that switches the insert and save methods
         * When true it will do INSERT OR REPLACE queries, otherwise UPDATE and INSERT queries
         */
        insertOrReplace: false,

        /**
         * @cfg {boolean} autoCreateTable
         * Should we automaticly create the table if it does not exists when initializing?
         */
        autoCreateTable: true,

        /**
         * @cfg {string[]} customWhereClauses
         * The custom where clauses to use when querying
         */
        customWhereClauses: [],

        /**
         * @cfg {Array} customWhereParams
         * The parameters for the custom where clauses to use when querying
         */
        customWhereParameters: []
    },
    /**
     * @type {Database} database
     * @private
     * db object
     */
    database: undefined,

    /**
     * The maximum number of arguments in a SQLite query
     * @type {number} maxArguments
     * @private
     */
    maxArguments: 100,

    /**
     * Creates the proxy, throws an error if local storage is not supported in the current browser.
     * @param {Object} config (optional) Config object.
     */
    constructor: function (config) {
        this.initConfig(config);
        this.callParent(arguments);
    },

    /**
     * Sets the custom clauses and parameters
     * @param {Array} clauses
     * @param {Array} params
     */
    setCustomWhereClausesAndParameters: function(clauses, params) {
        this.setCustomWhereClauses(clauses);
        this.setCustomWhereParameters(params);
    },

    /**
     * Clears the custom where clauses
     */
    clearCustomWhereClauses: function() {
        this.setCustomWhereClauses([]);
        this.setCustomWhereParameters([]);
    },

    /**
     * Adds a custom where clause
     * @param {string} clause
     */
    addCustomWhereClause: function(clause) {
        this.getCustomWhereClauses().push(clause);
    },

    /**
     * Clears the custom where clauses
     */
    clearCustomWhereParameters: function() {
        this.setCustomWhereParameters([]);
    },

    /**
     * Adds a custom where clause
     * @param param
     */
    addCustomWhereParameter: function(param) {
        this.getCustomWhereParameters().push(param);
    },

    /**
     * Executes a query
     * @param {SQLTransaction} transaction
     * @param {string} query
     * @param {Array} [args]
     * @param {Function} [success]
     * @param {Function} [fail]
     * @param {Object} [scope]
     */
    doQuery: function (transaction, query, args, success, fail, scope) {
        if (!Ext.isFunction(success)) {
            success = Ext.emptyFn;
        }
        //<debug>
//        console.log('EXEC_QUERY: ', query, args);
        //</debug>
        transaction.executeSql(query, args,
            Ext.bind(success, scope || this),
            Ext.bind(this.queryError, this, [query, args, fail, scope], true)
        );
    },

    /**
     * Executes a single query, automaticly creates a transaction
     * @param {string} query
     * @param {Array} [args]
     * @param {Function} [success]
     * @param {Function} [fail]
     * @param {Object} [scope]
     */
    doSingleQuery: function(query, args, success, fail, scope) {
        var me = this,
            db = me.database;

        db.transaction(function(transaction) {
            me.doQuery(transaction, query, args, success, fail, scope);
        });
    },

    /**
     * Called when a query has an error
     * @param {SQLTransaction} transaction
     * @param {SQLError} error
     * @param {string} query
     * @param {Array} args
     * @param {Function} fail
     * @param {Object} scope
     * @throws {Object} Exception
     */
    queryError: function (transaction, error, query, args, fail, scope) {
        if (Ext.isFunction(fail)) {
            fail.call(scope || this, transaction, error);
        }
        //<debug>
        console.log('QUERY_ERROR: ', error, query, args);
        //</debug>
        throw {
            code: 'websql_error',
            message: "SQL error: " + error.message + "\nSQL query: " + query + (args && args.length ? ("\nSQL params: " + args.join(', ')) : '' )
        };
    },

    /**
     * @private
     * Sets up the Proxy by opening database and creating table if necessary
     */
    initialize: function () {
        var me = this,
            pk = 'id',
            db = openDatabase(me.getDbName(), me.getDbVersion(), me.getDbDescription(), me.getDbSize()),
            query;

        this.database = db;

        db.transaction(function (transaction) {
            pk = me.getPkField() || (me.getReader() && me.getReader().getIdProperty()) || pk;
            me.setPkField(pk);

            query = 'CREATE TABLE IF NOT EXISTS ' + me.getDbTable() + ' (' + pk + ' ' + me.getPkType() + ', ' + me.getDbFields().join(', ') + ')';

            me.doQuery(transaction, query);
        });
    },

    /**
     * Drops the table
     * @param {Function} [callback]
     * @param {Object} [scope]
     */
    dropTable: function(callback, scope) {
        var me = this,
            dropCallback = function() {
                if (callback) {
                    callback.call(scope || me);
                }
            };

        me.database.transaction(function(transaction) {
            me.doQuery(transaction, 'DROP TABLE IF EXISTS ' + me.getDbTable());
        }, dropCallback, dropCallback);
    },

    /**
     * Empties (truncates) the table
     * @param {Function} [callback]
     * @param {Object} [scope]
     */
    emptyTable: function(callback, scope) {
        var me = this,
            emptyCallback = function() {
                if (callback) {
                    callback.call(scope || me);
                }
            };

        me.database.transaction(function (transaction) {
            me.doQuery(transaction, 'DELETE FROM ' + me.getDbTable());
        }, emptyCallback, emptyCallback);
    },

    /**
     * @private
     * Get reader data and set up fields accordingly
     * Used for table creation only
     * @return {Array} Fields array
     */
    getDbFields: function () {
        var me = this,
            fields = me.getModel().getFields(),
            flatFields = [],
            pkField = me.getPkField().toLowerCase(),
            name,
            type,
            sqlType,
            i;

        for (i = 0; i < fields.length; i++) {
            name = fields.items[i].getName();
            type = fields.items[i].getType().type;

            if (name === pkField) {
                continue;
            }

            switch (type.toLowerCase()) {
                case 'int':
                    sqlType = 'INTEGER';
                    break;
                case 'float':
                    sqlType = 'FLOAT';
                    break;
                case 'bool':
                    sqlType = 'BOOLEAN';
                    break;
                case 'date':
                    sqlType = 'DATETIME';
                    break;
                default:
                    sqlType = 'TEXT';
                    break;
            }
            flatFields.push(name + ' ' + sqlType);
        }

        return flatFields;
    },
    /**
     * Gets an object of the form {key -> value} for every field in the database table
     * Called before saving a record to determine db structure
     * @param {Ext.data.Fields} fields
     * @param {Ext.data.Model} record
     * @returns {Object}
     */
    getDbFieldData: function(fields, record) {
        var object = {},
            fieldName,
            i;

        for (i = 0; i < fields.length; i++) {

            fieldName = fields.items[i].getName();
            object[fieldName] = this.convertFieldToDb(fields.items[i], record.get(fieldName));
        }
        return object;
    },

    /**
     * Reads a record from a DB row
     * @param {SQLResultSetRowList} row
     * @return {Object} Model object
     */
    readRecordFromRow: function(row) {
        var fields = this.getModel().getFields(),
            name,
            i,
        // Copy this object because apparently we are not allowed to alter the original parameter object, weird huh?
            rowObj = Ext.apply({}, row);

        for (i = 0; i < fields.length; i++) {
            name = fields.items[i].getName();
            rowObj[name] = this.convertFieldToRecord(fields.items[i], row[name]);
        }
        return rowObj;
    },

    /**
     * Converts a queried field value to the respective record value
     * @param {Ext.data.Field} field
     * @param value
     * @return
     */
    convertFieldToRecord: function(field, value) {
        var type = field.getType().type;
        switch (type.toLowerCase()) {
            case 'date':
                return Ext.Date.parse(value, 'Y-m-d H:i:s', true);
            case 'bool':
                return value ? true : false;
//            case 'auto':
//                return Ext.decode(value, true);
        }
        return value;
    },

    /**
     * Converts a record field to the respective DB field value
     * @param {Ext.data.Field} field
     * @param value
     * @return
     */
    convertFieldToDb: function(field, value) {
        var type = field.getType().type;

        switch (type.toLowerCase()) {
            case 'date':
                if (value) {
                    return Ext.Date.format(value, 'Y-m-d H:i:s');
                } else {
                    return '';
                }
            case 'bool':
                return value ? 1 : 0;
//            case 'auto':
//                return Ext.encode(value);
        }
        return value;
    },

    /**
     * Inserts or replaces the records of an operation
     * @param {Ext.data.Operation} operation
     * @param {Function} callback
     * @param {Object} scope
     */
    insertOrReplaceRecords: function(operation, callback, scope) {
        var me = this,
            records = operation.getRecords(),
            processedRecords = [];

        operation.setStarted();

        me.database.transaction(function (transaction) {
            if (!records.length) {
                return;
            }

            var fields = me.getModel().getFields(),
                query,
                queryParts,
                recordQueryParts,
                dbFieldData,
                args;

            Ext.each(records, function(record) {
                queryParts = [];
                recordQueryParts = [];
                args = [];

                query = 'INSERT OR REPLACE INTO ' + me.getDbTable() + "\n";
                dbFieldData = me.getDbFieldData(fields, record);

                for (var key in dbFieldData) {
                    if (dbFieldData.hasOwnProperty(key)) {
                        queryParts.push(key);
                        recordQueryParts.push('?');
                        if (dbFieldData[key] === undefined) {
                            args.push(null);
                        } else {
                            args.push(dbFieldData[key]);
                        }
                    }
                }
                query += ' ( ' + queryParts.join(', ') + " )\n";
                query += 'VALUES ( ' + recordQueryParts.join(', ') + " )\n";

                me.doQuery(transaction, query, args, function(transaction, resultset) {
                    processedRecords.push({
                        clientId: record.getId(),
                        id: record.getId()
                    });
                });
            });

        }, function(error) {
            // Error
            operation.setException(error);

            if (Ext.isFunction(callback)) {
                callback.call(scope || this, operation);
            }
        }, function () {
            // Success
            operation.setResultSet(Ext.create('Ext.data.ResultSet', {
                records: processedRecords,
                success: true
            }));

            operation.process(operation.getAction(), operation.getResultSet());

            operation.setSuccessful();
            operation.setCompleted();

            if (Ext.isFunction(callback)) {
                callback.call(scope || this, operation);
            }
        });
    },

    /**
     * Called when records are created
     * @param {Ext.data.Operation} operation
     * @param {Function} callback
     * @param {Object} scope
     */
    create: function (operation, callback, scope) {
        if (this.getInsertOrReplace()) {
            this.insertOrReplaceRecords(operation, callback, scope);
        } else {
            this.insertRecords(operation, callback, scope);
        }
    },

    /**
     * Executes insert queries for an operation
     * @param {Ext.data.Operation} operation
     * @param {Function} callback
     * @param {Object} scope
     */
    insertRecords: function (operation, callback, scope) {
        var me = this,
            records = operation.getRecords(),
            fields = me.getModel().getFields(),
            insertedRecords = [];

        operation.setStarted();

        me.database.transaction(function (transaction) {

            Ext.each(records, function(record) {
                var queryParts = [],
                    recordQueryParts = [],
                    args = [],
                    query = 'INSERT INTO ' + me.getDbTable() + "\n",
                    dbFieldData = me.getDbFieldData(fields, record),
                    tempId = record.getId();

                for (var key in dbFieldData) {
                    if (dbFieldData.hasOwnProperty(key)) {
                        queryParts.push(key);
                        recordQueryParts.push('?');

                        if (dbFieldData[key] === undefined || (record.phantom && key == me.getPkField())) {
                            args.push(null);
                        } else {
                            args.push(dbFieldData[key]);
                        }
                    }
                }
                query += ' ( ' + queryParts.join(', ') + " )\n";
                query += 'VALUES ( ' + recordQueryParts.join(', ') + " )\n";

                me.doQuery(transaction, query, args, function(transaction, resultset) {
                    insertedRecords.push({
                        clientId: record.getId(),
                        id: resultset.insertId
                    });
                });
            });

        }, function(error) {
            // Error
            operation.setException(error);

            if (Ext.isFunction(callback)) {
                callback.call(scope || this, operation);
            }
        }, function () {
            // Success
            operation.setResultSet(Ext.create('Ext.data.ResultSet', {
                records: insertedRecords,
                success: true
            }));

            operation.process(operation.getAction(), operation.getResultSet());

            operation.setSuccessful();
            operation.setCompleted();

            if (Ext.isFunction(callback)) {
                callback.call(scope || this, operation);
            }
        });
    },

    /**
     * Updates records
     * @param {Ext.data.Operation} operation
     * @param {Function} callback
     * @param {Object} scope
     */
    update: function (operation, callback, scope) {
        if (this.getInsertOrReplace()) {
            this.insertOrReplaceRecords(operation, callback, scope);
        } else {
            this.updateRecords(operation, callback, scope);
        }
    },

    /**
     * Executes update queries for an operation
     * @param {Ext.data.Operation} operation
     * @param {Function} callback
     * @param {Object} scope
     */
    updateRecords: function (operation, callback, scope) {
        var me = this,
            records = operation.getRecords(),
            updatedRecords = [];

        operation.setStarted();

        me.database.transaction(function (transaction) {

            var fields = me.getModel().getFields(),
                query,
                queryParts,
                dbFieldData,
                args;

            Ext.each(records, function(record) {
                queryParts = [];
                args = [];

                query = 'UPDATE ' + me.getDbTable() + " SET \n";
                dbFieldData = me.getDbFieldData(fields, record);

                for (var key in dbFieldData) {
                    if (dbFieldData.hasOwnProperty(key) && key != me.getPkField()) {
                        queryParts.push(key + ' = ?');

                        if (dbFieldData[key] === undefined) {
                            args.push(null);
                        } else {
                            args.push(dbFieldData[key]);
                        }
                    }
                }
                query += queryParts.join(', ');
                query += ' WHERE ' + me.getPkField() + ' = ? ';
                args.push(record.get(me.getPkField()));

                me.doQuery(transaction, query, args, function(transaction, resultset) {
                    updatedRecords.push({
                        clientId: record.getId(),
                        id: record.getId()
                    });
                });
            });

        }, function(error) {
            // Error
            operation.setException(error);

            if (Ext.isFunction(callback)) {
                callback.call(scope || this, operation);
            }
        }, function () {
            // Success
            operation.setResultSet(Ext.create('Ext.data.ResultSet', {
                records: updatedRecords,
                success: true
            }));

            operation.process(operation.getAction(), operation.getResultSet());

            operation.setSuccessful();
            operation.setCompleted();

            if (Ext.isFunction(callback)) {
                callback.call(scope || this, operation);
            }
        });
    },

    /**
     * Reads one or more records
     * @param {Ext.data.Operation} operation
     * @param {Function} callback
     * @param {Object} scope
     */
    read: function (operation, callback, scope) {
        var me = this,
            records = [],
            params = operation.getParams() || {},
            wheres = [],
            sorters = operation.getSorters(),
            sortProperty,
            orderBy = [],
            args = [],
            limit = operation.getLimit(),
            start = operation.getStart(),
            customClauses = me.getCustomWhereClauses(),
            customParams = me.getCustomWhereParameters(),

            query = 'SELECT t.* FROM ' + me.getDbTable() + ' t';

        if (params) {
            for (var key in params) {
                if (params.hasOwnProperty(key)) {
                    wheres.push('t.'+key + ' = ? ');
                    args.push(params[key]);
                }
            }
        }

        if (customClauses.length) {
            wheres = Ext.Array.merge(wheres, customClauses);
        }
        if (customParams.length) {
            args = Ext.Array.merge(args, customParams);
        }

        if (wheres.length) {
            query += ' WHERE ' + wheres.join(' AND ');
        }

        if (sorters) {
            for (var i = 0; i < sorters.length; i++) {
                sortProperty = sorters[i].getProperty();
                if (!sortProperty) {
                    sortProperty = sorters[i].getSortProperty();
                }
                orderBy.push('t.' + sortProperty + ' ' + sorters[i].getDirection());
            }
        }

        if (orderBy.length) {
            query += ' ORDER BY ' + orderBy.join(', ');
        }

        if (limit || start) {
            start = start || 0;
            query += ' LIMIT ' + limit + ' OFFSET ' + start;
        }

        me.database.transaction(function (transaction) {
            me.doQuery(transaction, query, args, function (transaction, resultset) {
                var length = resultset.rows.length,
                    row;

                for (var i = 0; i < length; i++) {
                    row = resultset.rows.item(i);
                    records.push(
                        me.readRecordFromRow(row)
                    );
                }

                operation.setCompleted();

                operation.setResultSet(Ext.create('Ext.data.ResultSet', {
                    records: records,
                    count: records.length,
                    total: records.length,
                    loaded: true
                }));
                operation.setRecords(records);
                operation.setSuccessful();

                if (typeof callback == 'function') {
                    callback.call(scope || this, operation);
                }
            });

        }, function(error) {
            // Error
            operation.setException(error);

            if (Ext.isFunction(callback)) {
                callback.call(scope || this, operation);
            }
        });
    },

    /**
     * Destroys records
     * @param {Ext.data.Operation} operation
     * @param {Function} callback
     * @param {Object} scope
     */
    destroy: function (operation, callback, scope) {
        var me = this,
            pkField = me.getPkField(),
            ids = [],
            records = operation.getRecords(),
            destroyedRecords = [],
            query,
            wheres,
            args,
            id,
            i;

        for (i = 0; i < records.length; i++) {
            ids.push(records[i].get(pkField));
        }

        me.database.transaction(function (transaction) {
            while (ids.length) {
                wheres = [];
                args = [];
                id = undefined;

                while (args.length + 1 <= me.maxArguments && ids.length) {
                    id = ids.pop();
                    wheres.push(pkField + ' = ? ');
                    args.push(id);

                    destroyedRecords.push({
                        id: id
                    });
                }

                query = 'DELETE FROM ' + me.getDbTable() + ' WHERE ' + wheres.join(' OR ');
                me.doQuery(transaction, query, args);
            }
        }, function(error) {
            // Error
            operation.setException(error);

            if (Ext.isFunction(callback)) {
                callback.call(scope || this, operation);
            }
        }, function () {
            // Success
            operation.process(operation.getAction(), Ext.create('Ext.data.ResultSet', {
                records: destroyedRecords,
                success: true
            }));

            operation.setSuccessful();
            operation.setCompleted();

            if (Ext.isFunction(callback)) {
                callback.call(scope || this, operation);
            }
        });
    }
});