import { LightningElement, track, wire } from 'lwc';
import { loadStyle, loadScript } from 'lightning/platformResourceLoader';
import { refreshApex } from '@salesforce/apex';
import LEAFLET_CSS from '@salesforce/resourceUrl/leafletCSS'; // static resource
import LEAFLET_JS from '@salesforce/resourceUrl/leafletJS'; // static resource
import getMapData from '@salesforce/apex/MapDataController.getMapData';
import refreshMapData from '@salesforce/apex/MapDataController.refreshMapData';

export default class leafletMapV2 extends LightningElement {
    @track isLoading = true;
    @track errorMessage = '';
    @track activeFilters = new Set(['event', 'account', 'opportunity', 'campaign']);
    @track isMapInitialized = false;
    @track scheduleData = [];
    
    map;
    markerLayers = {};
    headquartersLayer; // 본사 레이어는 별도 관리
    wiredMapDataResult;
    mapData;
    
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

    // 더미 데이터 (Account, Campaign, 본사)
    dummyData = {
        headquarters: [
            { 
                lat: 37.4449168, 
                lng: 127.1388684, 
                name: '야쉬자본사', 
                description: '텐엑스타워',
                address: '경기도 성남시 수정구 금토로 70'
            }
        ],
        accounts: [
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
        campaigns: [
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

    // Wire adapter로 데이터 가져오기
    @wire(getMapData)
    wiredMapData(result) {
        this.wiredMapDataResult = result;
        
        if (result.data) {
            // 백엔드 데이터와 더미 데이터 병합
            this.mapData = {
                headquarters: this.dummyData.headquarters,
                accounts: this.dummyData.accounts,
                opportunities: result.data.opportunities || [],
                events: result.data.events || [],
                campaigns: this.dummyData.campaigns
            };
            
            this.processMapData();
            this.isLoading = false;
            
            // 지도가 이미 초기화되어 있으면 마커 업데이트
            if (this.isMapInitialized) {
                this.updateMarkers();
            }
        } else if (result.error) {
            this.errorMessage = '데이터를 불러올 수 없습니다: ' + result.error.body.message;
            this.isLoading = false;
        }
    }

    connectedCallback() {
        this.loadLeafletResources();
    }

    // 데이터 처리
    processMapData() {
        if (this.mapData && this.mapData.events) {
            // 이벤트 데이터 매핑
            this.scheduleData = this.mapData.events.map(evt => ({
                id: evt.id,
                assignedTo: evt.assignedTo,
                customerName: evt.customerName,
                opportunityName: evt.opportunityName || evt.subject, // 영업기회명 추가
                date: evt.date,
                time: evt.time,
                location: evt.location,
                phone: evt.phone || '',
                lat: evt.lat,
                lng: evt.lng,
                subject: evt.subject
            }));
        }
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
            this.isLoading = false;
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
            
            // 데이터가 이미 로드되어 있으면 마커 추가
            if (this.mapData) {
                this.updateMarkers();
            }
            
            this.isMapInitialized = true;
            console.log('지도 초기화 완료');
            
        } catch (error) {
            console.error('지도 초기화 실패:', error);
            this.errorMessage = '지도를 초기화할 수 없습니다.';
        }
    }

    // 마커 레이어 그룹 초기화
    initializeMarkerLayers() {
        // 본사 레이어는 별도로 생성하고 항상 표시
        this.headquartersLayer = L.layerGroup().addTo(this.map);
        
        // 나머지 마커 타입들
        const markerTypes = ['event', 'account', 'opportunity', 'campaign'];
        
        markerTypes.forEach(type => {
            this.markerLayers[type] = L.layerGroup().addTo(this.map);
        });
    }

    // 모든 마커 업데이트
    updateMarkers() {
        // 기존 마커 제거
        if (this.headquartersLayer) {
            this.headquartersLayer.clearLayers();
        }
        Object.values(this.markerLayers).forEach(layer => {
            layer.clearLayers();
        });

        if (!this.mapData) return;

        // 본사 마커 (항상 표시)
        if (this.mapData.headquarters) {
            this.mapData.headquarters.forEach(item => {
                const marker = this.createHeadquartersMarker(item);
                this.headquartersLayer.addLayer(marker);
            });
        }

        // 어카운트 마커
        if (this.mapData.accounts) {
            this.mapData.accounts.forEach(item => {
                const marker = this.createAccountMarker(item);
                this.markerLayers.account.addLayer(marker);
            });
        }

        // 기회 마커
        if (this.mapData.opportunities) {
            this.mapData.opportunities.forEach(item => {
                const marker = this.createOpportunityMarker(item);
                this.markerLayers.opportunity.addLayer(marker);
            });
        }

        // 이벤트 마커
        if (this.mapData.events) {
            this.mapData.events.forEach(item => {
                const marker = this.createEventMarker(item);
                this.markerLayers.event.addLayer(marker);
            });
        }

        // 캠페인 마커
        if (this.mapData.campaigns) {
            this.mapData.campaigns.forEach(item => {
                const marker = this.createCampaignMarker(item);
                this.markerLayers.campaign.addLayer(marker);
            });
        }

        // 필터 적용
        this.applyFilters();
    }

    // 필터 적용
    applyFilters() {
        Object.keys(this.markerLayers).forEach(type => {
            if (this.activeFilters.has(type)) {
                this.map.addLayer(this.markerLayers[type]);
            } else {
                this.map.removeLayer(this.markerLayers[type]);
            }
        });
    }

    // 카카오맵 길찾기 URL 생성
    generateDirectionsUrl(destinationName, lat, lng) {
        const encodedName = encodeURIComponent(destinationName);
        return `https://map.kakao.com/link/to/${encodedName},${lat},${lng}`;
    }

    // 전화 걸기 URL 생성
    generatePhoneUrl(phoneNumber) {
        if (!phoneNumber) return '';
        const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
        return `tel:${cleanPhone}`;
    }

    // Salesforce 레코드 URL 생성
    generateRecordUrl(recordId) {
        return `/lightning/r/${recordId}/view`;
    }

    // 팝업 내용 생성 (실제 데이터 기반)
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
                    data.accountName && data.accountName !== '미지정' ? `고객: ${data.accountName}` : null,
                    `단계: ${data.stage}`,
                    `금액: ${data.amount}`,
                    data.phone ? `연락처: ${data.phone}` : null,
                    data.closeDate ? `마감일: ${data.closeDate}` : null
                ].filter(Boolean);
                break;
            case 'campaign':
                details = [
                    data.name,
                    `상세설명: ${data.description || ''}`,
                    `예산: ${data.budget}`,
                    `상태: ${data.status}`,
                    `멤버 수: ${data.memberCount}`
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
        
        // Salesforce 레코드 보기 버튼 추가 (본사 제외)
        if (data.id && type !== 'headquarters') {
            const recordUrl = this.generateRecordUrl(data.id);
            buttonsHtml += `
                <a href="${recordUrl}" target="_blank" class="popup-btn record">
                    <svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                    상세
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

    // 이벤트 마커 생성
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
                    <div class="marker-count">${data.memberCount || 0}</div>
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
            
            // 본사 마커 팝업 열기
            if (this.headquartersLayer) {
                this.headquartersLayer.eachLayer(layer => {
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
            // 브라우저 위치 정보 사용
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const lat = position.coords.latitude;
                        const lng = position.coords.longitude;
                        
                        this.currentLocation = {
                            lat: lat,
                            lng: lng,
                            name: '현재 위치'
                        };
                        
                        this.map.setView([lat, lng], 15);
                        
                        // 현재위치 마킹
                        const currentLocationIcon = L.divIcon({
                            html: `
                                <div class="marker current-location">
                                    <div class="marker-center">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
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
                        
                        if (this.currentLocationMarker) {
                            this.map.removeLayer(this.currentLocationMarker);
                        }
                        
                        this.currentLocationMarker = L.marker([lat, lng], { icon: currentLocationIcon })
                            .addTo(this.map);
                    },
                    (error) => {
                        console.error('위치 정보를 가져올 수 없습니다:', error);
                        this.showToast('알림', '위치 정보를 가져올 수 없습니다. 본사 위치로 이동합니다.', 'warning');
                        // 위치 정보를 가져올 수 없으면 본사로 이동
                        this.goToHome();
                    }
                );
            } else {
                this.showToast('알림', '브라우저가 위치 정보를 지원하지 않습니다.', 'warning');
                this.goToHome();
            }
        }
    }

    // 현재 위치 마커 표시
    showCurrentLocationMarker() {
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

    // 데이터 새로고침
    handleRefreshData() {
        this.isLoading = true;
        refreshApex(this.wiredMapDataResult).then(() => {
            this.isLoading = false;
        }).catch(error => {
            this.errorMessage = '데이터 새로고침 실패: ' + error.body.message;
            this.isLoading = false;
        });
    }

    // Salesforce 레코드 보기
    handleViewRecord(event) {
        const recordId = event.currentTarget.dataset.recordId;
        if (recordId) {
            window.open(`/lightning/r/${recordId}/view`, '_blank');
        }
    }

    // 버튼 클래스 getter들
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