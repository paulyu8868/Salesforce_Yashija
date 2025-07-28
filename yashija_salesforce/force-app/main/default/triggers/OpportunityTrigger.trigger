trigger OpportunityTrigger on Opportunity (after insert, after update) {
    
    Set<Id> opportunitiesToGeocode = new Set<Id>();
    
    if (Trigger.isInsert) {
        for (Opportunity opp : Trigger.new) {
            // 도로명 주소가 있고 위치 정보가 없는 경우
            if (opp.BillingStreet__c != null && opp.Location__c == null) {
                opportunitiesToGeocode.add(opp.Id);
            }
        }
    }
    
    if (Trigger.isUpdate) {
        for (Opportunity opp : Trigger.new) {
            Opportunity oldOpp = Trigger.oldMap.get(opp.Id);
            
            // 주소가 변경된 경우
            Boolean addressChanged = (oldOpp.BillingStreet__c != opp.BillingStreet__c);
            
            if (opp.BillingStreet__c != null && addressChanged) {
                opportunitiesToGeocode.add(opp.Id);
            }
        }
    }
    
    // 지오코딩 실행 (Future 메서드)
    if (!opportunitiesToGeocode.isEmpty() && !System.isFuture()) {
        GeocodeService.geocodeOpportunities(opportunitiesToGeocode);
    }
}