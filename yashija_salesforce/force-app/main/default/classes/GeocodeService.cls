public with sharing class GeocodeService {
    
    // Nominatim (OpenStreetMap) API를 사용한 주소 지오코딩
    @future(callout=true)
    public static void geocodeOpportunities(Set<Id> opportunityIds) {
        // 지오코딩할 Opportunity 조회
        List<Opportunity> opportunities = [
            SELECT Id, BillingStreet__c, Location__c, Geocoding_Status__c
            FROM Opportunity
            WHERE Id IN :opportunityIds
            AND BillingStreet__c != null
        ];
        
        List<Opportunity> oppsToUpdate = new List<Opportunity>();
        
        for (Opportunity opp : opportunities) {
            try {
                // Nominatim API 호출
                HttpRequest req = new HttpRequest();
                String endpoint = 'https://nominatim.openstreetmap.org/search';
                String query = '?format=json&limit=1&countrycodes=kr'; // 한국으로 제한
                query += '&q=' + EncodingUtil.urlEncode(opp.BillingStreet__c, 'UTF-8');
                
                req.setEndpoint(endpoint + query);
                req.setMethod('GET');
                req.setHeader('User-Agent', 'Salesforce Geocoding Service'); // Nominatim 필수
                req.setTimeout(10000); // 10초 타임아웃
                
                Http http = new Http();
                HttpResponse res = http.send(req);
                
                if (res.getStatusCode() == 200) {
                    // 응답 파싱
                    String responseBody = res.getBody();
                    List<Object> results = (List<Object>) JSON.deserializeUntyped(responseBody);
                    
                    if (results != null && !results.isEmpty()) {
                        Map<String, Object> firstResult = (Map<String, Object>) results[0];
                        
                        // 위도/경도 추출
                        Decimal latitude = Decimal.valueOf((String) firstResult.get('lat'));
                        Decimal longitude = Decimal.valueOf((String) firstResult.get('lon'));
                        
                        // Geolocation 필드 업데이트
                        opp.Location__Latitude__s = latitude;
                        opp.Location__Longitude__s = longitude;
                        opp.Geocoding_Status__c = '성공';
                        
                        oppsToUpdate.add(opp);
                    } else {
                        // 결과 없음
                        opp.Geocoding_Status__c = '실패';
                        oppsToUpdate.add(opp);
                    }
                } else {
                    // 기타 오류
                    opp.Geocoding_Status__c = '실패'; // 지오코딩 상태 실패
                    oppsToUpdate.add(opp);
                }
                
            } catch (Exception e) {
                opp.Geocoding_Status__c = '실패';// 지오코딩 상태 실패
                oppsToUpdate.add(opp);
            }
        }
        
        // 업데이트 실행
        if (!oppsToUpdate.isEmpty()) {
            update oppsToUpdate;
        }

        
    }

    // Account 지오코딩 추가
    @future(callout=true)
    public static void geocodeAccounts(Set<Id> accountIds) {
        // 지오코딩할 Account 조회
        List<Account> accounts = [
            SELECT Id, Account_BillingStreet__c, Account_Location__c, Acc_Geocoding_Status__c
            FROM Account
            WHERE Id IN :accountIds
            AND Account_BillingStreet__c != null
        ];
        
        List<Account> accountsToUpdate = new List<Account>();
        
        for (Account acc : accounts) {
            try {
                // Nominatim API 호출
                HttpRequest req = new HttpRequest();
                String endpoint = 'https://nominatim.openstreetmap.org/search';
                String query = '?format=json&limit=1&countrycodes=kr';
                query += '&q=' + EncodingUtil.urlEncode(acc.Account_BillingStreet__c, 'UTF-8');
                
                req.setEndpoint(endpoint + query);
                req.setMethod('GET');
                req.setHeader('User-Agent', 'Salesforce Geocoding Service');
                req.setTimeout(10000);
                
                Http http = new Http();
                HttpResponse res = http.send(req);
                
                if (res.getStatusCode() == 200) {
                    String responseBody = res.getBody();
                    List<Object> results = (List<Object>) JSON.deserializeUntyped(responseBody);
                    
                    if (results != null && !results.isEmpty()) {
                        Map<String, Object> firstResult = (Map<String, Object>) results[0];
                        
                        Decimal latitude = Decimal.valueOf((String) firstResult.get('lat'));
                        Decimal longitude = Decimal.valueOf((String) firstResult.get('lon'));
                        
                        acc.Account_Location__Latitude__s = latitude;
                        acc.Account_Location__Longitude__s = longitude;
                        acc.Acc_Geocoding_Status__c = '성공';
                        
                        accountsToUpdate.add(acc);
                      
                    } else {
                        acc.Acc_Geocoding_Status__c = '실패';
                        accountsToUpdate.add(acc);
                       
                    }
                } else {
                    acc.Acc_Geocoding_Status__c = '실패';
                    accountsToUpdate.add(acc);
                }
                
            } catch (Exception e) {
                acc.Acc_Geocoding_Status__c = '실패';
                accountsToUpdate.add(acc);
            }
        }
        
        if (!accountsToUpdate.isEmpty()) {
            update accountsToUpdate;
        }
    }
}