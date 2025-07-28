public class OpportunityAssignmentHandler {
    
    public static void assignOpportunities(List<Opportunity> opportunities, Set<String> hotelTypes) {
        
        // 활성 사용자 중 해당 브랜드 담당자 조회
        Map<String, List<User>> brandToUsersMap = new Map<String, List<User>>();
        
        for (User u : [
            SELECT Id, sales_product__c 
            FROM User 
            WHERE sales_product__c IN :hotelTypes
            AND IsActive = true
        ]) {
            if (!brandToUsersMap.containsKey(u.sales_product__c)) {
                brandToUsersMap.put(u.sales_product__c, new List<User>());
            }
            brandToUsersMap.get(u.sales_product__c).add(u);
        }
        
        // Round-robin 할당을 위한 인덱스 맵
        Map<String, Integer> brandIndexMap = new Map<String, Integer>();
        
        // 각 Opportunity에 담당자 할당
        for (Opportunity opp : opportunities) {
            if (brandToUsersMap.containsKey(opp.sf_product__c)) {
                List<User> availableUsers = brandToUsersMap.get(opp.sf_product__c); // 해당 브랜드 담당 User 불러오기
                
                if (!availableUsers.isEmpty()) {
                    // Round-robin 방식으로 할당
                    Integer currentIndex = brandIndexMap.get(opp.sf_product__c) != null // 해당 브랜드의 인덱스 매핑이 null이면 0부터 시작
                        ? brandIndexMap.get(opp.sf_product__c) : 0;
                    
                    // 사용자 할당
                    opp.OwnerId = availableUsers[Math.mod(currentIndex, availableUsers.size())].Id;
                    
                    // 다음 인덱스 저장
                    brandIndexMap.put(opp.sf_product__c, currentIndex + 1);
                    
                }
            }
        }
    }
}