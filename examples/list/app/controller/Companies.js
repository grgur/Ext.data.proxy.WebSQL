Ext.define('App.controller.Companies', {
    extend : 'Ext.app.Controller',

    requires : [
        'Ext.data.identifier.Uuid'
    ],

    config : {
        control : {
            'button#changeFirstItem' : {
                tap : 'firstItemChange'
            },

            'button#syncStore' : {
                tap : 'syncStore'
            }
        }
    },

    firstItemChange : function () {
        var store = Ext.StoreMgr.lookup('companies'),
            record = store.getAt(0),
            random = Ext.data.identifier.Uuid.Global.generate()

        record.set('name', random);
    },

    syncStore: function () {
        var store = Ext.StoreMgr.lookup('companies');

        store.sync();
    }
});