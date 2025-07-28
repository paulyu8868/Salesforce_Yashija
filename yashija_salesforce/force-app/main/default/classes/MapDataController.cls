public with sharing class MapDataController {
    
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getMapData() {
        Map<String, Object> result = new Map<String, Object>();
        
        try {
            // 현재 사용자 ID
            Id currentUserId = UserInfo.getUserId();
            
            // 1. Opportunity 데이터 (현재 사용자가 Owner인 것만)
            result.put('opportunities', getOpportunities(currentUserId));
            
            // 2. Event 데이터 (현재 사용자가 Owner이고 아직 종료되지 않은 것만)
            result.put('events', getActiveEvents(currentUserId));
            
            return result;
            
        } catch (Exception e) {
            throw new AuraHandledException('데이터 로딩 중 오류 발생: ' + e.getMessage());
        }
    }
    
    // Opportunity 데이터 조회 (현재 사용자 소유)
    private static List<Map<String, Object>> getOpportunities(Id userId) {
        List<Map<String, Object>> oppList = new List<Map<String, Object>>();
        
        List<Opportunity> opportunities = [
            SELECT Id, Name, Account.Name, Account.Phone, Amount, StageName, 
                   Location__Latitude__s, Location__Longitude__s,
                   BillingStreet__c, CreatedDate, CloseDate
            FROM Opportunity
            WHERE OwnerId = :userId
            AND Location__Latitude__s != null 
            AND Location__Longitude__s != null
            AND IsClosed = false
            ORDER BY CreatedDate DESC
            LIMIT 200
        ];
        
        for (Opportunity opp : opportunities) {
            Map<String, Object> oppMap = new Map<String, Object>{
                'id' => opp.Id,
                'lat' => opp.Location__Latitude__s,
                'lng' => opp.Location__Longitude__s,
                'name' => opp.Name,
                'description' => opp.StageName,
                'isNew' => false,  // 7일 체크 제거
                'amount' => opp.Amount != null ? 
                    String.valueOf(opp.Amount.format()) + '원' : '미정',
                'stage' => opp.StageName,
                'phone' => opp.Account != null ? opp.Account.Phone : null,
                'accountName' => opp.Account != null ? opp.Account.Name : '미지정',
                'address' => opp.BillingStreet__c,
                'closeDate' => opp.CloseDate?.format()
            };
            oppList.add(oppMap);
        }
        
        return oppList;
    }
    
    // 활성 Event 조회 (현재 사용자 소유, 종료되지 않은 것)
    private static List<Map<String, Object>> getActiveEvents(Id userId) {
        List<Map<String, Object>> eventList = new List<Map<String, Object>>();
        
        DateTime currentTime = System.now();
        
        // Opportunity와 연결된 Event만 조회
        List<Event> events = [
            SELECT Id, Subject, WhatId, What.Name, What.Type,
                   WhoId, Who.Name, Who.Phone,
                   StartDateTime, EndDateTime, Location, Description,
                   Owner.Name
            FROM Event
            WHERE OwnerId = :userId
            AND EndDateTime >= :currentTime
            AND WhatId != null
            AND What.Type = 'Opportunity'
            ORDER BY StartDateTime ASC
            LIMIT 100
        ];
        
        // Event와 연결된 Opportunity들의 ID 수집
        Set<Id> opportunityIds = new Set<Id>();
        for (Event evt : events) {
            if (evt.WhatId != null && evt.What.Type == 'Opportunity') {
                opportunityIds.add(evt.WhatId);
            }
        }
        
        // Opportunity 위치 정보 조회
        Map<Id, Opportunity> opportunityMap = new Map<Id, Opportunity>([
            SELECT Id, Name, Location__Latitude__s, Location__Longitude__s,
                   BillingStreet__c, Account.Name, Account.Phone
            FROM Opportunity
            WHERE Id IN :opportunityIds
            AND Location__Latitude__s != null
            AND Location__Longitude__s != null
        ]);
        
        // Contact 정보 조회 (전화번호를 위해)
        Set<Id> contactIds = new Set<Id>();
        for (Event evt : events) {
            if (evt.WhoId != null) {
                contactIds.add(evt.WhoId);
            }
        }
        
        Map<Id, Contact> contactMap = new Map<Id, Contact>([
            SELECT Id, Name, Phone, MobilePhone
            FROM Contact
            WHERE Id IN :contactIds
        ]);
        
        for (Event evt : events) {
            // Opportunity에서 위치 정보 가져오기
            Opportunity relatedOpp = opportunityMap.get(evt.WhatId);
            
            if (relatedOpp != null) {
                // 전화번호 우선순위: Contact Phone > Contact Mobile > Account Phone
                String phone = null;
                if (evt.WhoId != null && contactMap.containsKey(evt.WhoId)) {
                    Contact relatedContact = contactMap.get(evt.WhoId);
                    phone = relatedContact.Phone != null ? relatedContact.Phone : relatedContact.MobilePhone;
                }
                if (phone == null && relatedOpp.Account?.Phone != null) {
                    phone = relatedOpp.Account.Phone;
                }
                
                Map<String, Object> eventMap = new Map<String, Object>{
                    'id' => evt.Id,
                    'lat' => relatedOpp.Location__Latitude__s,
                    'lng' => relatedOpp.Location__Longitude__s,
                    'subject' => evt.Subject,
                    'assignedTo' => evt.Owner.Name,
                    'customerName' => relatedOpp.Account != null && relatedOpp.Account.Name != null ? 
                        relatedOpp.Account.Name : relatedOpp.Name,
                    'date' => evt.StartDateTime.format('yyyy-MM-dd'),
                    'time' => evt.StartDateTime.format('HH:mm'),
                    'location' => evt.Location != null ? evt.Location : relatedOpp.BillingStreet__c,
                    'phone' => phone,
                    'whatId' => evt.WhatId,
                    'whoId' => evt.WhoId,
                    'contactName' => evt.Who?.Name,
                    'opportunityName' => relatedOpp.Name,
                    'endTime' => evt.EndDateTime.format('HH:mm'),
                    'description' => evt.Description
                };
                eventList.add(eventMap);
            }
        }
        
        return eventList;
    }
    
    // 데이터 새로고침을 위한 메서드 (캐시 무효화)
    @AuraEnabled
    public static Map<String, Object> refreshMapData() {
        // cacheable=false이므로 항상 새로운 데이터를 가져옴
        return getMapData();
    }
}