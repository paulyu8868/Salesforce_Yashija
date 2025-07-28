trigger EventTrigger on Event (after insert, after update, after delete, after undelete) {
    
    Set<Id> opportunityIds = new Set<Id>();
    
    // Insert, Update, Undelete 시 - 새로운 레코드에서 Opportunity Id 수집
    if (Trigger.isInsert || Trigger.isUpdate || Trigger.isUndelete) {
        for (Event evt : Trigger.new) {
            if (evt.WhatId != null && String.valueOf(evt.WhatId).startsWith('006')) {
                opportunityIds.add(evt.WhatId);
            }
        }
    }
    
    // Update 시 - WhatId가 변경된 경우 이전 Opportunity도 업데이트
    if (Trigger.isUpdate) {
        for (Event evt : Trigger.old) {
            if (evt.WhatId != null && String.valueOf(evt.WhatId).startsWith('006')) {
                opportunityIds.add(evt.WhatId);
            }
        }
    }
    
    // Delete 시 - 삭제되는 레코드에서 Opportunity Id 수집
    if (Trigger.isDelete) {
        for (Event evt : Trigger.old) {
            if (evt.WhatId != null && String.valueOf(evt.WhatId).startsWith('006')) {
                opportunityIds.add(evt.WhatId);
            }
        }
    }
    
    // Handler 클래스 호출
    if (!opportunityIds.isEmpty()) {
        EventTriggerHandler.updateHasVisitEvent(opportunityIds);
    }
}