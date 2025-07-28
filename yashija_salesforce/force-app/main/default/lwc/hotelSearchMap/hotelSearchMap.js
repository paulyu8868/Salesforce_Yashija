import { LightningElement, track } from 'lwc';
import { loadStyle, loadScript } from 'lightning/platformResourceLoader';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import LEAFLET_CSS from '@salesforce/resourceUrl/leafletCSS';
import LEAFLET_JS from '@salesforce/resourceUrl/leafletJS';
import getHotelsByDistrict from '@salesforce/apex/HotelSearchController.getHotelsByDistrict';
import getNearbyAreas from '@salesforce/apex/HotelSearchController.getNearbyAreas';

export default class HotelSearchMap extends LightningElement {
    @track isLoading = false;
    @track errorMessage = '';
    @track isMapInitialized = false;
    @track hotels = [];
    @track selectedRegion = '';
    @track selectedDistrict = '';
    @track selectedGrade = '';
    
    map;
    hotelMarkers = null;
    areaMarkers = null; // 상권 마커 레이어 // L.layerGroup()는 나중에 초기화
    
    // 서울시, 경기도 법정동 코드 (구 단위)
    regionData = {
        seoul: {
            name: '서울특별시',
            code: '1100000000',
            districts: [
                { name: '종로구', code: '1111000000' },
                { name: '중구', code: '1114000000' },
                { name: '용산구', code: '1117000000' },
                { name: '성동구', code: '1120000000' },
                { name: '광진구', code: '1121500000' },
                { name: '동대문구', code: '1123000000' },
                { name: '중랑구', code: '1126000000' },
                { name: '성북구', code: '1129000000' },
                { name: '강북구', code: '1130500000' },
                { name: '도봉구', code: '1132000000' },
                { name: '노원구', code: '1135000000' },
                { name: '은평구', code: '1138000000' },
                { name: '서대문구', code: '1141000000' },
                { name: '마포구', code: '1144000000' },
                { name: '양천구', code: '1147000000' },
                { name: '강서구', code: '1150000000' },
                { name: '구로구', code: '1153000000' },
                { name: '금천구', code: '1154500000' },
                { name: '영등포구', code: '1156000000' },
                { name: '동작구', code: '1159000000' },
                { name: '관악구', code: '1162000000' },
                { name: '서초구', code: '1165000000' },
                { name: '강남구', code: '1168000000' },
                { name: '송파구', code: '1171000000' },
                { name: '강동구', code: '1174000000' }
            ]
        },
        gyeonggi: {
            name: '경기도',
            code: '4100000000',
            districts: [
                { name: '수원시', code: '4111000000' },
                { name: '성남시', code: '4113000000' },
                { name: '의정부시', code: '4115000000' },
                { name: '안양시', code: '4117000000' },
                { name: '부천시', code: '4119000000' },
                { name: '광명시', code: '4121000000' },
                { name: '평택시', code: '4122000000' },
                { name: '동두천시', code: '4125000000' },
                { name: '안산시', code: '4127000000' },
                { name: '고양시', code: '4128000000' },
                { name: '과천시', code: '4129000000' },
                { name: '구리시', code: '4131000000' },
                { name: '남양주시', code: '4136000000' },
                { name: '오산시', code: '4137000000' },
                { name: '시흥시', code: '4139000000' },
                { name: '군포시', code: '4141000000' },
                { name: '의왕시', code: '4143000000' },
                { name: '하남시', code: '4145000000' },
                { name: '용인시', code: '4146000000' },
                { name: '파주시', code: '4148000000' },
                { name: '이천시', code: '4150000000' },
                { name: '안성시', code: '4155000000' },
                { name: '김포시', code: '4157000000' },
                { name: '화성시', code: '4159000000' },
                { name: '광주시', code: '4161000000' },
                { name: '양주시', code: '4163000000' },
                { name: '포천시', code: '4165000000' },
                { name: '여주시', code: '4167000000' }
            ]
        }
    };
    
    // 호텔 등급
    hotelGrades = [
        { label: '전체', value: '' },
        { label: '5성급', value: '5' },
        { label: '4성급', value: '4' },
        { label: '3성급', value: '3' },
        { label: '2성급', value: '2' },
        { label: '1성급', value: '1' }
    ];
    
    // 기본 중심점 (서울 시청)
    defaultCenter = {
        lat: 37.5665,
        lng: 126.9780
    };
    
    connectedCallback() {
        this.loadLeafletResources();
    }
    
    // 컴포넌트가 DOM에 추가된 후 전역 함수 등록
    renderedCallback() {
        if (!window.handleHotelAnalysis) {
            window.handleHotelAnalysis = (poiId) => {
                console.log('전역 함수 호출 - POI ID:', poiId);
                this.handleNearbyAnalysis(poiId);
            };
        }
    }
    
    async loadLeafletResources() {
        try {
            await Promise.all([
                loadStyle(this, LEAFLET_CSS),
                loadScript(this, LEAFLET_JS)
            ]);
            
            console.log('Leaflet 리소스 로딩 완료');
            this.initializeMap();
        } catch (error) {
            console.error('Leaflet 리소스 로딩 실패:', error);
            this.errorMessage = 'Leaflet 라이브러리를 불러올 수 없습니다.';
        }
    }
    
    initializeMap() {
        try {
            const mapContainer = this.template.querySelector('.map-div');
            
            if (!mapContainer) {
                console.error('지도 컨테이너를 찾을 수 없습니다');
                return;
            }
            
            // Leaflet 지도 생성
            this.map = window.L.map(mapContainer).setView([this.defaultCenter.lat, this.defaultCenter.lng], 10);
            
            // OpenStreetMap 타일 레이어 추가
            window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19
            }).addTo(this.map);
            
            // 호텔 마커 레이어 그룹 초기화
            this.hotelMarkers = window.L.layerGroup();
            this.hotelMarkers.addTo(this.map);
            
            // 상권 마커 레이어 그룹 초기화
            this.areaMarkers = window.L.layerGroup();
            this.areaMarkers.addTo(this.map);
            
            this.isMapInitialized = true;
            console.log('지도 초기화 완료');
            
        } catch (error) {
            console.error('지도 초기화 실패:', error);
            this.errorMessage = '지도를 초기화할 수 없습니다.';
        }
    }
    
    // 지역 선택 옵션
    get regionOptions() {
        return [
            { label: '지역 선택', value: '' },
            { label: '서울특별시', value: 'seoul' },
            { label: '경기도', value: 'gyeonggi' }
        ];
    }
    
    // 구/시 선택 옵션
    get districtOptions() {
        if (!this.selectedRegion) {
            return [{ label: '지역을 먼저 선택하세요', value: '' }];
        }
        
        const districts = this.regionData[this.selectedRegion].districts;
        return [
            { label: '구/시 선택', value: '' },
            ...districts.map(d => ({ label: d.name, value: d.code }))
        ];
    }
    
    // 등급 선택 옵션
    get gradeOptions() {
        return this.hotelGrades;
    }
    
    // 지역 선택 변경
    handleRegionChange(event) {
        this.selectedRegion = event.detail.value;
        this.selectedDistrict = '';
        this.clearHotels();
    }
    
    // 구/시 선택 변경
    handleDistrictChange(event) {
        this.selectedDistrict = event.detail.value;
    }
    
    // 등급 선택 변경
    handleGradeChange(event) {
        this.selectedGrade = event.detail.value;
    }
    
    // 검색 버튼 클릭
    async handleSearch() {
        if (!this.selectedDistrict) {
            this.showToast('알림', '지역과 구/시를 선택해주세요.', 'warning');
            return;
        }
        
        this.isLoading = true;
        this.clearHotels();
        
        try {
            // SK API 호출 (실제로는 Apex를 통해 호출해야 함)
            // 여기서는 더미 데이터로 시뮬레이션
            await this.fetchHotels(this.selectedDistrict);
            
        } catch (error) {
            console.error('호텔 데이터 조회 실패:', error);
            this.showToast('오류', '호텔 데이터를 불러올 수 없습니다.', 'error');
        } finally {
            this.isLoading = false;
        }
    }
    
    // 호텔 데이터 가져오기
    async fetchHotels(districtCode) {
        try {
            console.log('=== API 호출 시작 ===');
            console.log('District Code:', districtCode);
            
            // 실제 API 호출
            const hotels = await getHotelsByDistrict({ districtCode: districtCode });
            
            console.log('API 응답 성공:', hotels);
            
            if (hotels && hotels.length > 0) {
                // 등급 필터링
                if (this.selectedGrade) {
                    this.hotels = hotels.filter(h => h.category.includes(this.selectedGrade));
                } else {
                    this.hotels = hotels;
                }
                
                // 지도에 마커 추가
                this.addHotelMarkers();
                
                // 검색 결과가 있으면 첫 번째 호텔 위치로 이동
                this.map.setView([this.hotels[0].lat, this.hotels[0].lng], 13);
            } else {
                console.log('호텔 데이터가 없습니다.');
                this.showToast('알림', '해당 지역에 호텔 데이터가 없습니다.', 'info');
                this.hotels = [];
                this.clearHotels();
            }
        } catch (error) {
            console.error('=== API 호출 실패 ===');
            console.error('전체 에러 객체:', error);
            console.error('에러 타입:', typeof error);
            
            // 에러 객체의 모든 키 출력
            if (error) {
                console.error('에러 객체 키들:', Object.keys(error));
                
                // 각 속성 출력
                for (let key in error) {
                    console.error(`error.${key}:`, error[key]);
                }
            }
            
            // body가 있는 경우 상세 정보
            if (error.body) {
                console.error('error.body 타입:', typeof error.body);
                console.error('error.body 내용:', JSON.stringify(error.body, null, 2));
                
                if (error.body.message) {
                    console.error('에러 메시지:', error.body.message);
                }
                if (error.body.stackTrace) {
                    console.error('스택 트레이스:', error.body.stackTrace);
                }
                if (error.body.exceptionType) {
                    console.error('예외 타입:', error.body.exceptionType);
                }
            }
            
            // 명확한 에러 메시지 표시
            let errorMessage = '호텔 데이터를 불러올 수 없습니다.';
            
            if (error.body && error.body.message) {
                errorMessage = error.body.message;
            } else if (error.message) {
                errorMessage = error.message;
            } else if (typeof error === 'string') {
                errorMessage = error;
            }
            
            this.showToast('오류', errorMessage, 'error');
            this.hotels = [];
            this.clearHotels();
        }
    }
    
    // 주변 상권 분석
    async handleNearbyAnalysis(poiId) {
        try {
            console.log('주변 상권 분석 시작 - POI ID:', poiId);
            
            // 기존 상권 마커 제거
            this.areaMarkers.clearLayers();
            
            // 로딩 표시
            const visitorCountDiv = document.getElementById(`visitor-count-${poiId}`);
            if (visitorCountDiv) {
                visitorCountDiv.textContent = '분석 중...';
            }
            
            // API 호출
            const result = await getNearbyAreas({ poiId: poiId });
            
            console.log('상권 분석 결과:', result);
            
            if (result && result.areas) {
                // 유동인구 총합 표시
                if (visitorCountDiv) {
                    visitorCountDiv.textContent = `유동인구 예측/3개월: ${result.totalVisitors.toLocaleString()}명`;
                }
                
                // 상권 마커 추가
                result.areas.forEach(area => {
                    const icon = window.L.divIcon({
                        html: `
                            <div class="marker area">
                                <div class="marker-icon">🎯</div>
                            </div>
                        `,
                        className: 'custom-marker-container',
                        iconSize: [40, 40],
                        iconAnchor: [20, 20]
                    });
                    
                    const popupContent = `
                        <div style="min-width: 200px;">
                            <div style="margin-bottom: 8px;">
                                <strong style="color: #FF6900; font-size: 14px;">핫플레이스: ${area.areaName}</strong>
                            </div>
                            <div style="font-size: 13px; color: #080707;">
                                <strong>3개월 평균 방문자수: ${area.visitorCount.toLocaleString()}명</strong>
                            </div>
                        </div>
                    `;
                    
                    const marker = window.L.marker([area.lat, area.lng], { icon: icon })
                        .bindPopup(popupContent, { autoPan: false });
                    
                    this.areaMarkers.addLayer(marker);
                });
                
                this.showToast('성공', '주변 상권 분석이 완료되었습니다.', 'success');
            }
        } catch (error) {
            console.error('주변 상권 분석 실패:', error);
            
            // 에러 메시지 표시
            const visitorCountDiv = document.getElementById(`visitor-count-${poiId}`);
            if (visitorCountDiv) {
                visitorCountDiv.textContent = '분석 실패';
            }
            
            this.showToast('오류', '주변 상권 데이터를 불러올 수 없습니다.', 'error');
        }
    }
    
    // 구/시 이름 가져오기
    getDistrictName(districtCode) {
        for (const region of Object.values(this.regionData)) {
            const district = region.districts.find(d => d.code === districtCode);
            if (district) return district.name;
        }
        return '';
    }
    
    // 호텔 마커 추가
    addHotelMarkers() {
        this.hotels.forEach(hotel => {
            const gradeColor = this.getGradeColor(hotel.category);
            const gradeNumber = parseInt(hotel.category.charAt(0)) || 1;
            
            const icon = window.L.divIcon({
                html: `
                    <div class="marker hotel" style="background-color: ${gradeColor};">
                        <div class="marker-icon">🏨</div>
                        <div class="top-number-badge" style="color: ${gradeColor}; border-color: ${gradeColor};">
                            ${gradeNumber}
                        </div>
                    </div>
                `,
                className: 'custom-marker-container',
                iconSize: [50, 50],
                iconAnchor: [25, 25]
            });
            
            const popupContent = this.createHotelPopupContent(hotel);
            const marker = window.L.marker([hotel.lat, hotel.lng], { icon: icon });
            
            // Leaflet 팝업에 이벤트 처리를 위한 대안
            const popup = window.L.popup({ autoPan: false })
                .setContent(popupContent);
            
            marker.bindPopup(popup);
            
            marker.on('click', (e) => {
                this.map.setView(e.latlng, this.map.getZoom());
                setTimeout(() => {
                    marker.openPopup();
                }, 300);
            });
            
            // 마커에 호텔 정보 저장
            marker.hotelData = hotel;
            
            this.hotelMarkers.addLayer(marker);
        });
    }
    
    // 등급별 색상
    getGradeColor(category) {
        const gradeColors = {
            '5성급': '#6B46C1', // 보라
            '4성급': '#EC4899', // 핑크
            '3성급': '#3B82F6', // 파랑
            '2성급': '#10B981', // 초록
            '1성급': '#6B7280'  // 회색
        };
        return gradeColors[category] || '#6B7280';
    }
    
    // 호텔 팝업 내용 생성 - onclick 직접 사용
    createHotelPopupContent(hotel) {
        return `
            <div style="min-width: 250px;">
                <div style="margin-bottom: 8px;">
                    <strong style="color: #080707; font-size: 14px;">${hotel.poiName}</strong>
                </div>
                <div style="font-size: 13px; color: #706E6B;">
                    <div><strong>등급:</strong> ${hotel.category}</div>
                    <div><strong>주소:</strong> ${hotel.addr}</div>
                    ${hotel.phoneNumber ? `<div><strong>전화:</strong> ${hotel.phoneNumber}</div>` : ''}
                    <div id="visitor-count-${hotel.poiId}" style="margin-top: 8px; font-weight: bold; color: #1B96FF;"></div>
                </div>
                <div style="margin-top: 12px;">
                    <button 
                        onclick="window.handleHotelAnalysis('${hotel.poiId}')" 
                        style="width: 100%; background: #1B96FF; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer;">
                        주변 상권 분석
                    </button>
                </div>
            </div>
        `;
    }
    
    // 호텔 마커 초기화
    clearHotels() {
        this.hotelMarkers.clearLayers();
        this.hotels = [];
    }
    
    // 홈 버튼 클릭
    goToHome() {
        if (this.map) {
            this.map.setView([this.defaultCenter.lat, this.defaultCenter.lng], 10);
        }
    }
    
    // Toast 메시지 표시
    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant
        });
        this.dispatchEvent(event);
    }
    
    // 검색된 호텔 수
    get hotelCount() {
        return this.hotels.length;
    }
    
    // 구/시 선택 비활성화 여부
    get isDistrictDisabled() {
        return !this.selectedRegion;
    }
    
    // 검색 버튼 비활성화 여부
    get isSearchDisabled() {
        return !this.selectedDistrict || this.isLoading;
    }
}