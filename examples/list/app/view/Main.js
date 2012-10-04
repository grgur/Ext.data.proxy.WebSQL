Ext.define("App.view.Main", {
    extend   : 'Ext.Container',
    requires : [
        'Ext.TitleBar',
        'Ext.dataview.List'
    ],
    config   : {
        layout : 'fit',
        items  : [
            {
                xtype   : 'list',
                itemTpl : '{name}',
                store   : 'companies'
            },

            {
                xtype  : 'titlebar',
                docked : 'top',
                title  : 'WebSql Proxy Example',
                items  : [
                    {
                        itemId : 'changeFirstItem',
                        text   : 'Change first item'
                    },

                    {
                        itemId : 'syncStore',
                        text   : 'Sync changes',
                        align  : 'right'
                    }
                ]

            }
        ]
    }
});
