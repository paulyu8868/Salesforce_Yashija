trigger OpportunityAssignmentTrigger on Opportunity (before insert, before update) {
    
    // 브랜드 매칭이 필요한 Opportunity 처리
    List<Opportunity> oppsNeedingAssignment = new List<Opportunity>();
    Set<String> hotelTypes = new Set<String>();
    Set<Id> ownerIds = new Set<Id>();
    
    // 현재 Owner들의 정보를 가져오기 위해 ID 수집
    for (Opportunity opp : Trigger.new) {
        if (opp.OwnerId != null) {
            ownerIds.add(opp.OwnerId);
        }
    }
    
    // Owner들의 담당 브랜드 정보 조회
    Map<Id, User> ownerMap = new Map<Id, User>([
        SELECT Id, sales_product__c 
        FROM User 
        WHERE Id IN :ownerIds
    ]);
    
    for (Opportunity opp : Trigger.new) {
        Boolean needsAssignment = false;
        
        if (opp.sf_product__c != null) {
            // 현재 Owner의 담당 브랜드 확인
            User currentOwner = ownerMap.get(opp.OwnerId);
            
            // Owner의 브랜드와 Opportunity의 브랜드가 다른 경우
            if (currentOwner == null || currentOwner.sales_product__c != opp.sf_product__c) {
                needsAssignment = true;
            }
            
            // Update 시 브랜드가 변경된 경우도 체크
            if (Trigger.isUpdate) {
                Opportunity oldOpp = Trigger.oldMap.get(opp.Id);
                if (opp.sf_product__c != oldOpp.sf_product__c) {
                    needsAssignment = true;
                }
            }
            
            if (needsAssignment) {
                oppsNeedingAssignment.add(opp);
                hotelTypes.add(opp.sf_product__c);
            }
        }
    }
    
    // 처리할 Opportunity가 있는 경우
    if (!oppsNeedingAssignment.isEmpty()) {
        OpportunityAssignmentHandler.assignOpportunities(oppsNeedingAssignment, hotelTypes);
    }
}