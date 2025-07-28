public class EventTriggerHandler {
    
    public static void updateHasVisitEvent(Set<Id> opportunityIds) {
        // 방문 관련 Event가 있는 Opportunity Id 수집
        Set<Id> oppsWithVisitEvent = new Set<Id>();
        
        // 각 Opportunity의 방문 Event 확인
        for (Event evt : [
            SELECT Id, WhatId, Subject 
            FROM Event 
            WHERE WhatId IN :opportunityIds
            AND IsDeleted = false
        ]) {
            // Subject에 "방문견적"이 포함되어 있는지 확인
            if (evt.Subject != null && evt.Subject.contains('방문견적')) {
                oppsWithVisitEvent.add(evt.WhatId);
            }
        }
        
        // Opportunity 업데이트
        List<Opportunity> oppsToUpdate = new List<Opportunity>();
        
        for (Opportunity opp : [
            SELECT Id, Has_Visit_Event__c 
            FROM Opportunity 
            WHERE Id IN :opportunityIds
        ]) {
            Boolean hasEvent = oppsWithVisitEvent.contains(opp.Id);
            
            // 값이 변경된 경우에만 업데이트
            if (opp.Has_Visit_Event__c != hasEvent) {
                opp.Has_Visit_Event__c = hasEvent;
                oppsToUpdate.add(opp);
            }
        }
        
        // DML 실행
        if (!oppsToUpdate.isEmpty()) {
            update oppsToUpdate;
        }
    }
}