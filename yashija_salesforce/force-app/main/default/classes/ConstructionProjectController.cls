public with sharing class ConstructionProjectController {
    
    @AuraEnabled(cacheable=false)
    public static Construction_Project__c getConstructionProject(String projectId) {
        try {
            // Experience Cloud 권한 고려
            List<Construction_Project__c> projects = [
                SELECT Id, 
                       Name,
                       Hotel_Account__r.Name,
                       Status__c,
                       Phase__c,
                       Progress__c,
                       Expected_End_Date__c,
                       Days_Remaining__c,
                       Start_Date__c,
                       Original_End_Date__c
                FROM Construction_Project__c
                WHERE Id = :projectId
                WITH SECURITY_ENFORCED
                LIMIT 1
            ];
            
            if (projects.isEmpty()) {
                throw new AuraHandledException('프로젝트를 찾을 수 없습니다.');
            }
            
            return projects[0];
            
        } catch (Exception e) {
            throw new AuraHandledException('데이터 조회 중 오류 발생: ' + e.getMessage());
        }
    }
}