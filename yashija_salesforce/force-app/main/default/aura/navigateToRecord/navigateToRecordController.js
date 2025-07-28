({
    invoke : function(component, event, helper) {
        var recordId = component.get("v.recordId");
        
        if(recordId) {
            var navEvent = $A.get("e.force:navigateToSObject");
            navEvent.setParams({
                "recordId": recordId,
                "slideDevName": "detail"
            });
            navEvent.fire();
        }
    }
})