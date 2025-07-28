public with sharing class HotelSearchController {
    
    // SK API 앱키 - 실제 발급받은 키로 교체 필요
    private static final String APP_KEY = 'mp9z2TMGXP3SaVauSPx027uQEo5tU2176in8B3DA';
    private static final String API_BASE_URL = 'https://apis.openapi.sk.com/puzzle/travel/meta/accommodation/districts/';
    
    @AuraEnabled(cacheable=true)
    public static List<HotelWrapper> getHotelsByDistrict(String districtCode) {
        List<HotelWrapper> hotels = new List<HotelWrapper>();
        
        try {
            System.debug('=== getHotelsByDistrict 시작 ===');
            System.debug('District Code: ' + districtCode);
            System.debug('APP_KEY: ' + (String.isBlank(APP_KEY) ? 'NOT SET' : 'SET'));
            
            // APP_KEY 체크
            if (APP_KEY == 'YOUR_APP_KEY_HERE' || String.isBlank(APP_KEY)) {
                throw new AuraHandledException('SK API 앱키가 설정되지 않았습니다. HotelSearchController.cls에서 APP_KEY를 설정하세요.');
            }
            
            // HTTP Request 생성
            Http http = new Http();
            HttpRequest request = new HttpRequest();
            
            // API 엔드포인트 설정
            String endpoint = API_BASE_URL + districtCode;
            System.debug('API Endpoint: ' + endpoint);
            
            request.setEndpoint(endpoint);
            request.setMethod('GET');
            
            // 헤더 설정
            request.setHeader('appKey', APP_KEY);
            request.setHeader('Accept', 'application/json');
            request.setTimeout(10000); // 10초 타임아웃
            
            // API 호출
            System.debug('API 호출 시작...');
            HttpResponse response = http.send(request);
            
            System.debug('API Response Code: ' + response.getStatusCode());
            System.debug('API Response Body: ' + response.getBody());
            
            if (response.getStatusCode() == 200) {
                // JSON 파싱
                Map<String, Object> jsonResponse = (Map<String, Object>) JSON.deserializeUntyped(response.getBody());
                
                // status 확인
                Map<String, Object> status = (Map<String, Object>) jsonResponse.get('status');
                String statusCode = (String) status.get('code');
                
                if (statusCode == '00') {
                    // contents 배열 추출
                    List<Object> contents = (List<Object>) jsonResponse.get('contents');
                    
                    if (contents != null) {
                        System.debug('호텔 수: ' + contents.size());
                        
                        for (Object content : contents) {
                            Map<String, Object> hotel = (Map<String, Object>) content;
                            
                            HotelWrapper wrapper = new HotelWrapper();
                            wrapper.poiId = (String) hotel.get('poiId');
                            wrapper.poiName = (String) hotel.get('poiName');
                            wrapper.category = (String) hotel.get('category');
                            wrapper.lat = (Decimal) hotel.get('lat');
                            wrapper.lng = (Decimal) hotel.get('lng');
                            wrapper.addr = (String) hotel.get('addr');
                            wrapper.phoneNumber = (String) hotel.get('phoneNumber');
                            
                            hotels.add(wrapper);
                        }
                    }
                } else {
                    String errorMessage = (String) status.get('message');
                    System.debug('API 에러: ' + errorMessage);
                    throw new AuraHandledException('API 오류: ' + errorMessage);
                }
            } else {
                System.debug('HTTP 에러 - Status: ' + response.getStatusCode());
                System.debug('Response Body: ' + response.getBody());
                throw new AuraHandledException('API 호출 실패. 상태 코드: ' + response.getStatusCode());
            }
            
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, '=== 에러 발생 ===');
            System.debug(LoggingLevel.ERROR, 'Message: ' + e.getMessage());
            System.debug(LoggingLevel.ERROR, 'Type: ' + e.getTypeName());
            System.debug(LoggingLevel.ERROR, 'Stack: ' + e.getStackTraceString());
            throw new AuraHandledException('호텔 데이터를 불러오는 중 오류가 발생했습니다: ' + e.getMessage());
        }
        
        System.debug('=== getHotelsByDistrict 종료 - 호텔 수: ' + hotels.size() + ' ===');
        return hotels;
    }
    
    // 호텔 정보 Wrapper 클래스
    public class HotelWrapper {
        @AuraEnabled public String poiId { get; set; }
        @AuraEnabled public String poiName { get; set; }
        @AuraEnabled public String category { get; set; }
        @AuraEnabled public Decimal lat { get; set; }
        @AuraEnabled public Decimal lng { get; set; }
        @AuraEnabled public String addr { get; set; }
        @AuraEnabled public String phoneNumber { get; set; }
    }
    
    // 주변 인기 상권 조회
    @AuraEnabled
    public static NearbyAreaResponse getNearbyAreas(String poiId) {
        try {
            System.debug('=== getNearbyAreas 시작 ===');
            System.debug('POI ID: ' + poiId);
            
            // APP_KEY 체크
            if (APP_KEY == 'mp9z2TMGXP3SaVauSPx027uQEo5tU2176in8B3DA' || String.isBlank(APP_KEY)) {
                throw new AuraHandledException('SK API 앱키가 설정되지 않았습니다.');
            }
            
            // HTTP Request 생성
            Http http = new Http();
            HttpRequest request = new HttpRequest();
            
            // API 엔드포인트 설정
            String endpoint = 'https://apis.openapi.sk.com/puzzle/travel/accommodation/nearby/area/pois/' + poiId;
            System.debug('API Endpoint: ' + endpoint);
            
            request.setEndpoint(endpoint);
            request.setMethod('GET');
            request.setHeader('appKey', APP_KEY);
            request.setHeader('Accept', 'application/json');
            request.setTimeout(10000);
            
            // API 호출
            HttpResponse response = http.send(request);
            
            System.debug('Response Code: ' + response.getStatusCode());
            
            if (response.getStatusCode() == 200) {
                Map<String, Object> jsonResponse = (Map<String, Object>) JSON.deserializeUntyped(response.getBody());
                Map<String, Object> status = (Map<String, Object>) jsonResponse.get('status');
                
                if ((String)status.get('code') == '00') {
                    Map<String, Object> contents = (Map<String, Object>) jsonResponse.get('contents');
                    List<Object> stat = (List<Object>) contents.get('stat');
                    
                    NearbyAreaResponse result = new NearbyAreaResponse();
                    result.areas = new List<AreaWrapper>();
                    result.totalVisitors = 0;
                    
                    if (stat != null) {
                        for (Object s : stat) {
                            Map<String, Object> area = (Map<String, Object>) s;
                            
                            AreaWrapper wrapper = new AreaWrapper();
                            wrapper.areaName = (String) area.get('areaName');
                            wrapper.lat = (Decimal) area.get('lat');
                            wrapper.lng = (Decimal) area.get('lng');
                            wrapper.visitorCount = ((Decimal) area.get('count')).intValue();
                            
                            result.areas.add(wrapper);
                            result.totalVisitors += wrapper.visitorCount;
                        }
                    }
                    
                    return result;
                } else {
                    throw new AuraHandledException('API 오류: ' + status.get('message'));
                }
            } else {
                throw new AuraHandledException('API 호출 실패: ' + response.getStatusCode());
            }
            
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'Error: ' + e.getMessage());
            throw new AuraHandledException('주변 상권 데이터를 불러오는 중 오류가 발생했습니다: ' + e.getMessage());
        }
    }
    
    // 주변 상권 응답 Wrapper
    public class NearbyAreaResponse {
        @AuraEnabled public List<AreaWrapper> areas { get; set; }
        @AuraEnabled public Integer totalVisitors { get; set; }
    }
    
    // 상권 정보 Wrapper
    public class AreaWrapper {
        @AuraEnabled public String areaName { get; set; }
        @AuraEnabled public Decimal lat { get; set; }
        @AuraEnabled public Decimal lng { get; set; }
        @AuraEnabled public Integer visitorCount { get; set; }
    }
}