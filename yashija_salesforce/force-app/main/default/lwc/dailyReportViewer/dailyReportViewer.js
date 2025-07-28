import { LightningElement, api, track, wire } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import getDailyReports from '@salesforce/apex/DailyReportController.getDailyReports';
import { NavigationMixin } from 'lightning/navigation';

export default class DailyReportViewer extends NavigationMixin(LightningElement) {
    @api recordId;
    @track reports = [];
    @track currentIndex = 0;
    @track isLoading = true;
    @track errorMessage = '';
    @track activeFilters = new Set(['headquarters', 'event', 'account', 'opportunity', 'campaign']);
    @track isMapInitialized = false;
    
    // 이미지 URL 매핑
    imageUrls = {};
    
    // PageReference를 위한 wire
    @wire(CurrentPageReference)
    pageRef;

    connectedCallback() {
        console.log('Component connected');
        console.log('RecordId:', this.recordId);
        
        // Experience Cloud에서 recordId가 없을 경우 처리
        if (!this.recordId) {
            console.log('No recordId found, checking URL params...');
            // URL에서 recordId 추출 시도
            const pageRef = this.pageRef;
            if (pageRef && pageRef.attributes && pageRef.attributes.recordId) {
                this.recordId = pageRef.attributes.recordId;
                console.log('RecordId from pageRef:', this.recordId);
            }
        }
        
        if (this.recordId) {
            this.loadReports();
        } else {
            console.error('No recordId available');
            this.error = { message: 'Construction Project ID가 필요합니다.' };
            this.isLoading = false;
        }
    }

    async loadReports() {
        if (!this.recordId) {
            console.error('Cannot load reports without recordId');
            return;
        }
        
        try {
            this.isLoading = true;
            console.log('Loading reports for Construction Project:', this.recordId);
            
            // Apex에서 일일보고 데이터 가져오기
            const data = await getDailyReports({ constructionProjectId: this.recordId });
            
            console.log('Reports received:', data);
            
            if (data && data.length > 0) {
                // Wrapper 객체에서 report 추출
                this.reports = data.map(wrapper => wrapper.report);
                
                // 각 보고서의 이미지 URL 생성
                data.forEach((wrapper, index) => {
                    if (wrapper.imageVersionId) {
                        // ContentVersion ID를 사용한 URL 생성
                        const isExperience = window.location.hostname.includes('salesforce-experience.com') || 
                                           window.location.hostname.includes('.site.com') ||
                                           window.location.pathname.includes('/s/');
                        
                        if (isExperience) {
                            // Experience Cloud용 URL - ContentVersion 사용
                            this.imageUrls[wrapper.report.Id] = `/sfsites/c/sfc/servlet.shepherd/version/renditionDownload?rendition=THUMB720BY480&versionId=${wrapper.imageVersionId}`;
                        } else {
                            // 내부 org용 URL
                            this.imageUrls[wrapper.report.Id] = `/sfc/servlet.shepherd/version/renditionDownload?rendition=THUMB720BY480&versionId=${wrapper.imageVersionId}`;
                        }
                        
                        console.log('Image URL for report', wrapper.report.Id, ':', this.imageUrls[wrapper.report.Id]);
                    }
                });
            }
            this.error = undefined;
        } catch (error) {
            this.error = error;
            this.reports = [];
            console.error('Error loading reports:', error);
            console.error('Error details:', JSON.stringify(error));
        } finally {
            this.isLoading = false;
        }
    }

    get currentReport() {
        return this.reports[this.currentIndex] || {};
    }

    get currentImageUrl() {
        const report = this.currentReport;
        return this.imageUrls[report.Id] || null;
    }

    get hasImage() {
        return !!this.currentImageUrl;
    }

    get reportTypeClass() {
        const type = this.currentReport.Report_Type__c;
        switch(type) {
            case '정상진행':
                return 'report-type report-type-normal';
            case '검수요청':
                return 'report-type report-type-inspection';
            case '기타':
                return 'report-type report-type-other';
            default:
                return 'report-type';
        }
    }

    get reportTypeIcon() {
        const type = this.currentReport.Report_Type__c;
        switch(type) {
            case '정상진행':
                return 'utility:check';
            case '검수요청':
                return 'utility:preview';
            case '기타':
                return 'utility:info';
            default:
                return 'utility:info';
        }
    }

    get formattedDate() {
        if (!this.currentReport.Report_Date__c) return '';
        
        const date = new Date(this.currentReport.Report_Date__c);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
        const weekday = weekdays[date.getDay()];
        
        return `${month}월 ${day}일 (${weekday})`;
    }

    get progressText() {
        return this.currentReport.Today_Progress__c || '작업 내용이 없습니다.';
    }

    get reporterName() {
        return this.currentReport.Reporter__r?.Name || '보고자 정보 없음';
    }

    get isPreviousDisabled() {
        return this.currentIndex === 0;
    }

    get isNextDisabled() {
        return this.currentIndex >= this.reports.length - 1;
    }

    get currentPageInfo() {
        if (this.reports.length === 0) return '0 / 0';
        return `${this.currentIndex + 1} / ${this.reports.length}`;
    }

    get hasNoReports() {
        return !this.isLoading && this.reports.length === 0;
    }

    handlePrevious() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
        }
    }

    handleNext() {
        if (this.currentIndex < this.reports.length - 1) {
            this.currentIndex++;
        }
    }

    handleImageError(event) {
        // 이미지 로드 실패 시 처리
        event.target.style.display = 'none';
        event.target.nextElementSibling.style.display = 'flex';
    }

    handleRefresh() {
        this.loadReports();
    }
}