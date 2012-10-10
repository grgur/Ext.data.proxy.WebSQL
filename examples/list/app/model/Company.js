Ext.define('App.model.Company', {
    extend   : 'Ext.data.Model',
    requires : [
        'App.ux.WebSqlProxy'
    ],
    config   : {
        proxy  : {
            type        : 'websql',
            dbName      : 'companies64',
            dbTable     : 'company',
            dbVersion   : '1.22',
            writer      : {
                type           : 'json',
                writeAllFields : false
            },
            reader      : {
                type       : 'json',
                idProperty : 'id'
            },
            initialData : [
                {
                    id            : 1,
                    name          : 'IBM',
                    employees     : 33,
                    incorporation : new Date()
                },
                {
                    id            : 2,
                    name          : 'Hilton',
                    employees     : 411,
                    incorporation : new Date()
                }
            ]
        },
        fields : [
            {name : 'name', type : 'string'},
            {name : 'employees', type : 'int'},
            {name : 'incorporation', type : 'date'}
        ]
    }
});