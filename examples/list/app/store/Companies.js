Ext.define('App.store.Companies', {
    extend : 'Ext.data.Store',

    config : {
        storeId  : 'companies',
        autoLoad : true,
        model    : 'App.model.Company'
    }
});