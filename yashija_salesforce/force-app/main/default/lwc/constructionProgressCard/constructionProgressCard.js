import { LightningElement, api, track, wire } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import getConstructionProject from '@salesforce/apex/ConstructionProjectController.getConstructionProject';

export default class ConstructionProgressViewer extends LightningElement {
    @api recordId;
    @track projectData = {};
    @track isLoading = true;
    @track errorMessage = '';
    
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
            this.loadProjectData();
        } else {
            console.error('No recordId available');
            this.errorMessage = 'Construction Project ID가 필요합니다.';
            this.isLoading = false;
        }
    }

    async loadProjectData() {
        if (!this.recordId) {
            console.error('Cannot load project without recordId');
            return;
        }
        
        try {
            this.isLoading = true;
            console.log('Loading project data for:', this.recordId);
            
            // Apex에서 프로젝트 데이터 가져오기
            const data = await getConstructionProject({ projectId: this.recordId });
            
            console.log('Project data received:', data);
            
            if (data) {
                // 데이터 가공
                this.projectData = {
                    hotelName: data.Hotel_Account__r?.Name || '호텔명 없음',
                    status: data.Status__c || '진행',
                    phase: data.Phase__c || '',
                    progress: data.Progress__c || 0,
                    expectedEndDate: data.Expected_End_Date__c,
                    daysRemaining: data.Days_Remaining__c
                };
                
                console.log('Processed project data:', this.projectData);
            }
            this.errorMessage = '';
        } catch (error) {
            this.errorMessage = '데이터를 불러오는 중 오류가 발생했습니다.';
            this.projectData = {};
            console.error('Error loading project:', error);
            console.error('Error details:', JSON.stringify(error));
        } finally {
            this.isLoading = false;
        }
    }

    // D-Day 계산
    get dDay() {
        if (!this.projectData.expectedEndDate) return 'D-?';
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const end = new Date(this.projectData.expectedEndDate);
        end.setHours(0, 0, 0, 0);
        
        const diffTime = end - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays > 0) {
            return 'D-' + diffDays;
        } else if (diffDays === 0) {
            return 'D-Day';
        } else {
            return 'D+' + Math.abs(diffDays);
        }
    }

    // 날짜 포맷
    get formattedEndDate() {
        if (!this.projectData.expectedEndDate) return '';
        
        const date = new Date(this.projectData.expectedEndDate);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        return year + '.' + month + '.' + day;
    }

    // 컴포넌트 렌더링 후 실행
    renderedCallback() {
        // 진행률 바 업데이트
        const progressBar = this.template.querySelector('.progress-bar');
        if (progressBar && this.projectData.progress !== undefined) {
            progressBar.style.width = this.projectData.progress + '%';
        }
        
        // 단계 진행 라인 업데이트
        const phaseProgress = this.template.querySelector('.phase-line-progress');
        if (phaseProgress && this.projectData.progress !== undefined) {
            phaseProgress.style.width = this.projectData.progress + '%';
        }
    }

    // 단계별 완료 상태 확인
    isPhaseCompleted(phase) {
        const phases = ['철거', '전기', '배관', '인테리어', '마감'];
        const currentIndex = phases.indexOf(this.projectData.phase);
        const checkIndex = phases.indexOf(phase);
        
        return checkIndex < currentIndex;
    }

    // 현재 진행 중인 단계인지 확인
    isPhaseActive(phase) {
        return this.projectData.phase === phase;
    }

    // 단계별 클래스 getter 메서드들
    get phaseClass1() {
        if (this.isPhaseCompleted('철거')) return 'phase-icon completed';
        if (this.isPhaseActive('철거')) return 'phase-icon active';
        return 'phase-icon';
    }

    get phaseClass2() {
        if (this.isPhaseCompleted('전기')) return 'phase-icon completed';
        if (this.isPhaseActive('전기')) return 'phase-icon active';
        return 'phase-icon';
    }

    get phaseClass3() {
        if (this.isPhaseCompleted('배관')) return 'phase-icon completed';
        if (this.isPhaseActive('배관')) return 'phase-icon active';
        return 'phase-icon';
    }

    get phaseClass4() {
        if (this.isPhaseCompleted('인테리어')) return 'phase-icon completed';
        if (this.isPhaseActive('인테리어')) return 'phase-icon active';
        return 'phase-icon';
    }

    get phaseClass5() {
        if (this.isPhaseCompleted('마감')) return 'phase-icon completed';
        if (this.isPhaseActive('마감')) return 'phase-icon active';
        return 'phase-icon';
    }

    // 단계별 완료 여부 getter
    get isPhase1Completed() {
        return this.isPhaseCompleted('철거');
    }

    get isPhase2Completed() {
        return this.isPhaseCompleted('전기');
    }

    get isPhase3Completed() {
        return this.isPhaseCompleted('배관');
    }

    get isPhase4Completed() {
        return this.isPhaseCompleted('인테리어');
    }

    get isPhase5Completed() {
        return this.isPhaseCompleted('마감');
    }

    // 현재 단계 설명
    get currentPhaseDescription() {
        const descriptions = {
            '철거': '기존 시설 철거 작업',
            '전기': '전기 배선 공사',
            '배관': '급배수 배관 공사',
            '인테리어': '인테리어 공사 진행중',
            '마감': '최종 마감 작업'
        };
        
        return descriptions[this.projectData.phase] || '진행 중';
    }

    // 새로고침
    handleRefresh() {
        this.loadProjectData();
    }
}