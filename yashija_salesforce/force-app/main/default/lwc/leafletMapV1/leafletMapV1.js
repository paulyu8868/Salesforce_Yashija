import { LightningElement, track } from 'lwc';
import { loadStyle, loadScript } from 'lightning/platformResourceLoader';
import LEAFLET_CSS from '@salesforce/resourceUrl/leafletCSS';
import LEAFLET_JS from '@salesforce/resourceUrl/leafletJS';

export default class leafletMapV1 extends LightningElement {
    @track isLoading = false;
    @track errorMessage = '';
    @track activeFilters = new Set(['headquarters', 'event', 'account', 'opportunity', 'campaign']);
    @track isMapInitialized = false;
    
    map;
    markerLayers = {};
    
    // 다른 샘플 데이터 (이벤트 제외)
    sampleData = {
        headquarters: [
            { 
                lat: 37.4449168, 
                lng: 127.1388684, 
                name: '야쉬자본사', 
                description: '텐엑스타워',
                address: '경기도 성남시 수정구 금토로 70'
            }
        ],
        account: [
            { 
                lat: 37.5230, 
                lng: 126.9244, 
                name: '브라운호텔 여의도점', 
                description: '파트너 기업', 
                isPartner: true,
                phone: '02-2255-0114',
                address: '서울시 중구 태평로2가'
            },
            { 
                lat: 37.5662, 
                lng: 126.9779, 
                name: 'SF호텔', 
                description: '고객사', 
                isPartner: false,
                phone: '02-3777-1114',
                address: '서울시 종로구 종로'
            }
        ],
        opportunity: [
            { 
                lat: 37.5505, 
                lng: 126.9882, 
                name: '김철수', 
                description: '신규 기회', 
                isNew: true,
                amount: '50,000,000원',
                stage: '제안/견적'
            },
            { 
                lat: 37.5407, 
                lng: 127.0699, 
                name: '이영희', 
                description: '진행 중인 기회', 
                isNew: false,
                phone: '010-9876-5432',
                amount: '30,000,000원',
                stage: '협상/검토'
            }
        ],
        campaign: [
            { 
                lat: 37.5596, 
                lng: 126.9927, 
                name: '디지털 마케팅', 
                description: '온라인 캠페인', 
                memberCount: 15,
                budget: '10,000,000원',
                status: '진행중'
            },
            { 
                lat: 37.5158, 
                lng: 127.1034, 
                name: '제품 론칭', 
                description: '신제품 출시', 
                memberCount: 8,
                budget: '25,000,000원',
                status: '계획중'
            }
        ]
    };

    // 오늘의 일정 데이터 (이벤트 마커와 동일)
    scheduleData = [
        {
            id: 'schedule1',
            assignedTo: '김영업',
            customerName: '삼성전자',
            date: '2025-01-15',
            time: '10:00',
            location: '서울시 중구 태평로',
            phone: '02-1234-5678',
            lat: 37.5230,
            lng: 126.9244,
            subject: '세일즈포스 도입 미팅'
        },
        {
            id: 'schedule2',
            assignedTo: '박세일즈',
            customerName: 'LG전자',
            date: '2025-01-15',
            time: '14:00',
            location: '서울시 종로구 종로',
            phone: '02-9876-5432',
            lat: 37.5662,
            lng: 126.9779,
            subject: '프로젝트 진행 회의'
        },
        {
            id: 'schedule3',
            assignedTo: '최마케팅',
            customerName: '현대자동차',
            date: '2025-01-15',
            time: '16:30',
            location: '서울시 서초구 양재동',
            phone: '02-5555-1234',
            lat: 37.4844,
            lng: 127.0374,
            subject: '마케팅 전략 수립'
        }
    ];
    
    // 기본 중심점 (default:본사)
    defaultCenter = {
        lat: 37.4449168,
        lng: 127.1388684
    };

    // 현재위치 (default:본사)
    currentLocation = {
        lat: 37.4449168,
        lng: 127.1388684,
        name: '현재 위치'
    };

    connectedCallback() {
        this.loadLeafletResources();
    }

    // Leaflet 리소스 로딩
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

    // 지도 초기화
    initializeMap() {
        try {
            const mapContainer = this.template.querySelector('.map-div');
            
            if (!mapContainer) {
                console.error('지도 컨테이너를 찾을 수 없습니다');
                return;
            }

            // Leaflet 지도 생성
            this.map = L.map(mapContainer).setView([this.defaultCenter.lat, this.defaultCenter.lng], 11);

            // OpenStreetMap 타일 레이어 추가
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19
            }).addTo(this.map);

            // 마커 레이어 그룹 초기화
            this.initializeMarkerLayers();
            
            // 마커들 추가
            this.addAllMarkers();
            
            this.isMapInitialized = true;
            console.log('지도 초기화 완료');
            
        } catch (error) {
            console.error('지도 초기화 실패:', error);
            this.errorMessage = '지도를 초기화할 수 없습니다.';
        }
    }

    // 마커 레이어 그룹 초기화
    initializeMarkerLayers() {
        const markerTypes = ['headquarters', 'event', 'account', 'opportunity', 'campaign'];
        
        markerTypes.forEach(type => {
            this.markerLayers[type] = L.layerGroup().addTo(this.map);
        });
    }

    // 모든 마커들 추가
    addAllMarkers() {
        // 본사 마커
        this.sampleData.headquarters.forEach(item => {
            const marker = this.createHeadquartersMarker(item);
            this.markerLayers.headquarters.addLayer(marker);
        });

        // 이벤트 마커 (scheduleData 기준)
        this.scheduleData.forEach(item => {
            const marker = this.createEventMarker(item);
            this.markerLayers.event.addLayer(marker);
        });

        // 어카운트 마커
        this.sampleData.account.forEach(item => {
            const marker = this.createAccountMarker(item);
            this.markerLayers.account.addLayer(marker);
        });

        // 기회 마커
        this.sampleData.opportunity.forEach(item => {
            const marker = this.createOpportunityMarker(item);
            this.markerLayers.opportunity.addLayer(marker);
        });

        // 캠페인 마커
        this.sampleData.campaign.forEach(item => {
            const marker = this.createCampaignMarker(item);
            this.markerLayers.campaign.addLayer(marker);
        });
    }

    // 카카오맵 길찾기 URL 생성
    generateDirectionsUrl(destinationName, lat, lng) {
        const encodedName = encodeURIComponent(destinationName);
        return `https://map.kakao.com/link/to/${encodedName},${lat},${lng}`;
    }

    // 전화 걸기 URL 생성
    generatePhoneUrl(phoneNumber) {
        const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
        return `tel:${cleanPhone}`;
    }

    // 팝업 내용 생성 (전화번호 유무에 따라 동적 생성)
    createPopupContent(data, type) {
        let title = data.name || data.subject || data.customerName;
        let details = [];
        
        // 타입별 상세 정보 구성
        switch(type) {
            case 'headquarters':
                details = [data.description, data.address];
                break;
            case 'event':
                details = [
                    `고객: ${data.customerName}`,
                    `날짜: ${data.date}`,
                    `시간: ${data.time}`,
                    data.phone ? `연락처: ${data.phone}` : null,
                    `위치: ${data.location}`
                ].filter(Boolean);
                break;
            case 'account':
                details = [
                    data.isPartner ? '야쉬자 브랜드 호텔' : '일반고객',
                    data.phone ? `연락처: ${data.phone}` : null,
                    data.address
                ].filter(Boolean);
                break;
            case 'opportunity':
                details = [
                    data.description,
                    `금액: ${data.amount}`,
                    `단계: ${data.stage}`,
                    data.phone ? `연락처: ${data.phone}` : null
                ].filter(Boolean);
                break;
            case 'campaign':
                details = [
                    data.name,
                    `상세설명: ${data.description}`,
                    `예산: ${data.budget}`,
                    `상태: ${data.status}`
                ];
                break;
        }

        // 팝업 HTML 생성
        const detailsHtml = details.map(detail => `<div>${detail}</div>`).join('');
        const directionsUrl = this.generateDirectionsUrl(title, data.lat, data.lng);
        
        let buttonsHtml = `
            <div class="popup-buttons">
                <a href="${directionsUrl}" target="_blank" class="popup-btn directions">
                    <svg viewBox="0 0 24 24"><path d="M2,3L2,9L7,12L2,15L2,21L22,12L2,3Z"/></svg>
                    경로 안내
                </a>
        `;
        
        // 전화번호가 있으면 전화 버튼 추가
        if (data.phone) {
            const phoneUrl = this.generatePhoneUrl(data.phone);
            buttonsHtml += `
                <a href="${phoneUrl}" class="popup-btn phone">
                    <svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
                    전화
                </a>
            `;
        }
        
        buttonsHtml += '</div>';

        return `
            <div style="margin-bottom: 8px;">
                <strong style="color: #080707; font-size: 14px;">${title}</strong>
            </div>
            <div style="font-size: 13px; color: #706E6B; margin-bottom: 12px;">
                ${detailsHtml}
            </div>
            ${buttonsHtml}
        `;
    }

    // 본사 마커 생성
    createHeadquartersMarker(data) {
        const icon = L.divIcon({
            html: `
                <div class="marker headquarters">
                    <div class="marker-icon"></div>
                    <div class="marker-label">${data.name}</div>
                </div>
            `,
            className: 'custom-marker-container',
            iconSize: [50, 60],
            iconAnchor: [25, 50]
        });
        
        const popupContent = this.createPopupContent(data, 'headquarters');
        const marker = L.marker([data.lat, data.lng], { icon: icon })
            .bindPopup(popupContent, { autoPan: false });

        marker.on('click', (e) => {
            this.map.setView(e.latlng, this.map.getZoom());
            setTimeout(() => {
                marker.openPopup();
            }, 300);
        });

        return marker;
    }

    // 이벤트 마커 생성 (scheduleData 기준)
    createEventMarker(data) {
        const icon = L.divIcon({
            html: `
                <div class="marker event">
                    <div class="marker-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z"/>
                            <rect x="7" y="10" width="2" height="2"/>
                            <rect x="11" y="10" width="2" height="2"/>
                            <rect x="15" y="10" width="2" height="2"/>
                            <rect x="7" y="13" width="2" height="2"/>
                            <rect x="11" y="13" width="2" height="2"/>
                            <rect x="15" y="13" width="2" height="2"/>
                        </svg>
                    </div>
                    <div class="marker-pulse"></div>
                </div>
            `,
            className: 'custom-marker-container',
            iconSize: [36, 36],
            iconAnchor: [18, 18]
        });
        
        const popupContent = this.createPopupContent(data, 'event');
        const marker = L.marker([data.lat, data.lng], { icon: icon })
            .bindPopup(popupContent, { autoPan: false });

        marker.on('click', (e) => {
            this.map.setView(e.latlng, this.map.getZoom());
            setTimeout(() => {
                marker.openPopup();
            }, 300);
        });

        return marker;
    }

    // 어카운트 마커 생성
    createAccountMarker(data) {
        const badge = data.isPartner ? '<div class="marker-badge">P</div>' : '';
        const icon = L.divIcon({
            html: `
                <div class="marker account">
                    <div class="marker-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.5 7H17v-.5C17 4.57 15.43 3 13.5 3h-3C8.57 3 7 4.57 7 6.5V7h-.5C5.67 7 5 7.67 5 8.5v11c0 .83.67 1.5 1.5 1.5h11c.83 0 1.5-.67 1.5-1.5v-11c0-.83-.67-1.5-1.5-1.5zM9 6.5C9 5.67 9.67 5 10.5 5h3c.83 0 1.5.67 1.5 1.5V7H9v-.5zM8 10h2v2H8v-2zm3 0h2v2h-2v-2zm3 0h2v2h-2v-2zM8 13h2v2H8v-2zm3 0h2v2h-2v-2zm3 0h2v2h-2v-2z"/>
                        </svg>
                    </div>
                    ${badge}
                </div>
            `,
            className: 'custom-marker-container',
            iconSize: [36, 36],
            iconAnchor: [18, 18]
        });
        
        const popupContent = this.createPopupContent(data, 'account');
        const marker = L.marker([data.lat, data.lng], { icon: icon })
            .bindPopup(popupContent, { autoPan: false });

        marker.on('click', (e) => {
            this.map.setView(e.latlng, this.map.getZoom());
            setTimeout(() => {
                marker.openPopup();
            }, 300);
        });

        return marker;
    }

    // 기회 마커 생성
    createOpportunityMarker(data) {
        const status = data.isNew ? '<div class="marker-status new"></div>' : '';
        const icon = L.divIcon({
            html: `
                <div class="marker opportunity">
                    <div class="marker-icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 6L9.5 9L7 6l-.5 7h11L17 6l-2.5 3L12 6z"/>
                            <circle cx="7" cy="4" r="2"/>
                            <circle cx="12" cy="2" r="2"/>
                            <circle cx="17" cy="4" r="2"/>
                            <rect x="5" y="18" width="14" height="2"/>
                        </svg>
                    </div>
                    ${status}
                </div>
            `,
            className: 'custom-marker-container',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });
        
        const popupContent = this.createPopupContent(data, 'opportunity');
        const marker = L.marker([data.lat, data.lng], { icon: icon })
            .bindPopup(popupContent, { autoPan: false });

        marker.on('click', (e) => {
            this.map.setView(e.latlng, this.map.getZoom());
            setTimeout(() => {
                marker.openPopup();
            }, 300);
        });

        return marker;
    }

    // 캠페인 마커 생성
    createCampaignMarker(data) {
        const icon = L.divIcon({
            html: `
                <div class="marker campaign">
                    <div class="marker-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                        </svg>
                    </div>
                    <div class="marker-count">${data.memberCount}</div>
                </div>
            `,
            className: 'custom-marker-container',
            iconSize: [36, 36],
            iconAnchor: [18, 18]
        });
        
        const popupContent = this.createPopupContent(data, 'campaign');
        const marker = L.marker([data.lat, data.lng], { icon: icon })
            .bindPopup(popupContent, { autoPan: false });

        marker.on('click', (e) => {
            this.map.setView(e.latlng, this.map.getZoom());
            setTimeout(() => {
                marker.openPopup();
            }, 300);
        });

        return marker;
    }

    // 홈 버튼 클릭 (본사로 이동)
    goToHome() {
        if (this.map) {
            this.map.setView([this.defaultCenter.lat, this.defaultCenter.lng], 13);
            
            // 본사 마커가 활성화되어 있으면 팝업 열기
            if (this.activeFilters.has('headquarters') && this.markerLayers.headquarters) {
                this.markerLayers.headquarters.eachLayer(layer => {
                    if (layer.openPopup) {
                        setTimeout(() => layer.openPopup(), 500);
                    }
                });
            }
        }
    }

    // 현재위치 버튼 클릭 이벤트
    goToCurrentLocation() {
        if (this.map) {
            this.map.setView([this.currentLocation.lat, this.currentLocation.lng], 15);
            
            // 현재위치 마킹
            const currentLocationIcon = L.divIcon({
                html: `
                    <div class="marker current-location">
                        <div class="marker-center">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                            </svg>
                        </div>
                        <div class="marker-ring"></div>
                        <div class="marker-ring-outer"></div>
                    </div>
                `,
                className: 'custom-marker-container',
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            });
            
            //기존 현재위치 마커 제거 후 새로 추가
            if (this.currentLocationMarker) {
                this.map.removeLayer(this.currentLocationMarker);
            }
            
            this.currentLocationMarker = L.marker([this.currentLocation.lat, this.currentLocation.lng], { icon: currentLocationIcon })
                .addTo(this.map);
        }
    }

    // 일정 위치로 이동
    handleMoveToLocation(event) {
        const scheduleId = event.currentTarget.dataset.scheduleId;
        const schedule = this.scheduleData.find(item => item.id === scheduleId);
        
        if (schedule && this.map) {
            this.map.setView([schedule.lat, schedule.lng], 16);
            
            // 해당 이벤트 마커의 팝업 열기
            if (this.activeFilters.has('event') && this.markerLayers.event) {
                this.markerLayers.event.eachLayer(layer => {
                    const layerLatLng = layer.getLatLng();
                    if (Math.abs(layerLatLng.lat - schedule.lat) < 0.0001 && 
                        Math.abs(layerLatLng.lng - schedule.lng) < 0.0001) {
                        setTimeout(() => layer.openPopup(), 500);
                    }
                });
            }
        }
    }

    // 필터 토글 핸들러
    handleFilterToggle(event) {
        const markerType = event.currentTarget.dataset.markerType;
        
        if (this.activeFilters.has(markerType)) {
            // 비활성화
            this.activeFilters.delete(markerType);
            if (this.markerLayers[markerType]) {
                this.map.removeLayer(this.markerLayers[markerType]);
            }
        } else {
            // 활성화
            this.activeFilters.add(markerType);
            if (this.markerLayers[markerType]) {
                this.map.addLayer(this.markerLayers[markerType]);
            }
        }
        
        // 반응성을 위해 새로운 Set 생성
        this.activeFilters = new Set(this.activeFilters);
    }

    // 버튼 클래스 getter들
    get headquartersButtonClass() {
        const baseClass = 'slds-button slds-button_neutral';
        return this.activeFilters.has('headquarters') ? `${baseClass} active` : baseClass;
    }

    get eventButtonClass() {
        const baseClass = 'slds-button slds-button_neutral';
        return this.activeFilters.has('event') ? `${baseClass} active` : baseClass;
    }

    get accountButtonClass() {
        const baseClass = 'slds-button slds-button_neutral';
        return this.activeFilters.has('account') ? `${baseClass} active` : baseClass;
    }

    get opportunityButtonClass() {
        const baseClass = 'slds-button slds-button_neutral';
        return this.activeFilters.has('opportunity') ? `${baseClass} active` : baseClass;
    }

    get campaignButtonClass() {
        const baseClass = 'slds-button slds-button_neutral';
        return this.activeFilters.has('campaign') ? `${baseClass} active` : baseClass;
    }

   
}