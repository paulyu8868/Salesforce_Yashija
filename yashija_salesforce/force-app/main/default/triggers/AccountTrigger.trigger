trigger AccountTrigger on Account (after insert, after update) {
    
    Set<Id> accountsToGeocode = new Set<Id>();
    
    if (Trigger.isInsert) {
        for (Account acc : Trigger.new) {
            // 도로명 주소가 있고 위치 정보가 없는 경우
            if (acc.Account_BillingStreet__c != null && acc.Account_Location__c == null) {
                accountsToGeocode.add(acc.Id);
            }
        }
    }
    
    if (Trigger.isUpdate) {
        for (Account acc : Trigger.new) {
            Account oldAcc = Trigger.oldMap.get(acc.Id);
            
            // 주소가 변경된 경우
            Boolean addressChanged = (oldAcc.Account_BillingStreet__c != acc.Account_BillingStreet__c);
            
            if (acc.Account_BillingStreet__c != null && addressChanged) {
                accountsToGeocode.add(acc.Id);
            }
        }
    }
    
    // 지오코딩 실행 (Future 메서드)
    if (!accountsToGeocode.isEmpty() && !System.isFuture()) {
        GeocodeService.geocodeAccounts(accountsToGeocode);
    }
}