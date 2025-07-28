public without sharing class DailyReportController {
    
    @AuraEnabled(cacheable=false)
    public static List<DailyReportWrapper> getDailyReports(Id constructionProjectId) {
        try {
            // 디버그 로그 추가
            System.debug('Construction Project ID: ' + constructionProjectId);
            System.debug('Current User: ' + UserInfo.getUserId());
            
            // 해당 시공 프로젝트의 일일 보고를 최신순으로 조회
            List<Daily_Report__c> reports = [
                SELECT Id, 
                       Name,
                       Report_Date__c,
                       Report_Type__c,
                       Today_Progress__c,
                       Tomorrow_Plan__c,
                       Primary_Photo_Id__c,
                       Reporter__r.Name,
                       Reporter__c,
                       CreatedDate
                FROM Daily_Report__c
                WHERE Construction_Project__c = :constructionProjectId
                WITH SECURITY_ENFORCED
                ORDER BY Report_Date__c DESC, CreatedDate DESC
                LIMIT 50
            ];
            
            System.debug('Reports found: ' + reports.size());
            
            // Wrapper 리스트 생성
            List<DailyReportWrapper> wrapperList = new List<DailyReportWrapper>();
            
            // ContentDocument ID 수집
            Set<String> contentDocIds = new Set<String>();
            for (Daily_Report__c report : reports) {
                if (String.isNotBlank(report.Primary_Photo_Id__c)) {
                    contentDocIds.add(report.Primary_Photo_Id__c);
                }
            }
            
            // ContentVersion 조회
            Map<Id, ContentVersion> contentVersionMap = new Map<Id, ContentVersion>();
            if (!contentDocIds.isEmpty()) {
                for (ContentVersion cv : [
                    SELECT Id, ContentDocumentId, VersionDataUrl
                    FROM ContentVersion
                    WHERE ContentDocumentId IN :contentDocIds
                    AND IsLatest = true
                ]) {
                    contentVersionMap.put(cv.ContentDocumentId, cv);
                }
            }
            
            // Wrapper 생성
            for (Daily_Report__c report : reports) {
                DailyReportWrapper wrapper = new DailyReportWrapper();
                wrapper.report = report;
                
                if (String.isNotBlank(report.Primary_Photo_Id__c)) {
                    ContentVersion cv = contentVersionMap.get(report.Primary_Photo_Id__c);
                    if (cv != null) {
                        wrapper.imageVersionId = cv.Id;
                    }
                }
                
                wrapperList.add(wrapper);
            }
            
            return wrapperList;
            
        } catch (Exception e) {
            System.debug('Error: ' + e.getMessage());
            throw new AuraHandledException('일일 보고를 불러오는 중 오류가 발생했습니다: ' + e.getMessage());
        }
    }
    
    public class DailyReportWrapper {
        @AuraEnabled public Daily_Report__c report { get; set; }
        @AuraEnabled public String imageVersionId { get; set; }
    }
}