public with sharing class LeafletMapController {
    
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getMapData() {
        try {
            Map<String, Object> result = new Map<String, Object>();
            
            // 1. 오늘의 Event 조회
            Date today = Date.today();
            List<Event> events = [
                SELECT Id, Subject, ActivityDate, StartDateTime, EndDateTime,
                       Location, Description,
                       WhoId, Who.Name, Who.Phone,
                       WhatId, What.Name,
                       OwnerId, Owner.Name
                FROM Event
                WHERE ActivityDate = :today
                AND WhatId != null
                ORDER BY StartDateTime
                LIMIT 50
            ];
            
            // Event의 Opportunity ID 수집
            Set<Id> opportunityIds = new Set<Id>();
            for (Event evt : events) {
                if (evt.WhatId != null && String.valueOf(evt.WhatId).startsWith('006')) {
                    opportunityIds.add(evt.WhatId);
                }
            }
            
            // Opportunity 위치 정보 별도 조회
            Map<Id, Opportunity> oppMap = new Map<Id, Opportunity>();
            if (!opportunityIds.isEmpty()) {
                oppMap = new Map<Id, Opportunity>([
                    SELECT Id, Name, Location__Latitude__s, Location__Longitude__s,
                           BillingStreet__c, Geocoding_Status__c
                    FROM Opportunity
                    WHERE Id IN :opportunityIds
                    AND Geocoding_Status__c = '성공'
                    AND Location__Latitude__s != null
                    AND Location__Longitude__s != null
                ]);
            }
            
            List<Map<String, Object>> eventList = new List<Map<String, Object>>();
            
            // Event 데이터 구성
            for (Event evt : events) {
                // Opportunity 위치 정보가 있는 경우만 처리
                if (oppMap.containsKey(evt.WhatId)) {
                    Opportunity opp = oppMap.get(evt.WhatId);
                    
                    // 시간 포맷팅
                    String startTime = evt.StartDateTime != null ? 
                        evt.StartDateTime.format('HH:mm') : '';
                    String endTime = evt.EndDateTime != null ? 
                        evt.EndDateTime.format('HH:mm') : '';
                    
                    Map<String, Object> eventData = new Map<String, Object>{
                        'id' => evt.Id,
                        'lat' => opp.Location__Latitude__s,
                        'lng' => opp.Location__Longitude__s,
                        'subject' => evt.Subject,
                        'customerName' => evt.What.Name,
                        'assignedTo' => evt.Owner.Name,
                        'date' => evt.ActivityDate.format(),
                        'time' => startTime,
                        'startTime' => startTime,
                        'endTime' => endTime,
                        'location' => opp.BillingStreet__c,
                        'phone' => evt.Who != null ? evt.Who.Phone : null,
                        'description' => evt.Description
                    };
                    eventList.add(eventData);
                }
            }
            
            result.put('events', eventList);
            
            // 2. 진행 중인 Opportunity (Event와 별개로 지도에 표시할 기회들)
            List<Opportunity> opportunities = [
                SELECT Id, Name, StageName, Amount, CloseDate,
                       Location__Latitude__s, Location__Longitude__s,
                       BillingStreet__c, Geocoding_Status__c,
                       AccountId, Account.Name, Account.Phone
                FROM Opportunity
                WHERE IsClosed = false
                AND Geocoding_Status__c = '성공'
                AND Location__Latitude__s != null
                AND Location__Longitude__s != null
                ORDER BY CreatedDate DESC
                LIMIT 30
            ];
            
            List<Map<String, Object>> oppList = new List<Map<String, Object>>();
            for (Opportunity opp : opportunities) {
                Map<String, Object> oppData = new Map<String, Object>{
                    'id' => opp.Id,
                    'lat' => opp.Location__Latitude__s,
                    'lng' => opp.Location__Longitude__s,
                    'name' => opp.Name,
                    'description' => opp.StageName,
                    'isNew' => opp.StageName == 'Prospecting' || opp.StageName == 'Qualification',
                    'amount' => opp.Amount != null ? opp.Amount.format() : '미정',
                    'stage' => opp.StageName,
                    'address' => opp.BillingStreet__c,
                    'accountName' => opp.Account != null ? opp.Account.Name : null,
                    'phone' => opp.Account != null ? opp.Account.Phone : null
                };
                oppList.add(oppData);
            }
            
            result.put('opportunities', oppList);
            
            // 3. 통계 정보 (선택사항 - 대시보드용)
            result.put('statistics', new Map<String, Object>{
                'todayEvents' => eventList.size(),
                'activeOpportunities' => oppList.size()
            });
            
            return result;
            
        } catch (Exception e) {
            throw new AuraHandledException('데이터 조회 중 오류 발생: ' + e.getMessage());
        }
    }
}