// brandConceptGallery.js
import { LightningElement, api, wire } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';
import BRAND_FIELD from '@salesforce/schema/Opportunity.sf_product__c';

// Static Resources import
// 프리미엄 호텔
import PREMIUM_EXTERIOR from '@salesforce/resourceUrl/premium_exterior';
import PREMIUM_LOBBY from '@salesforce/resourceUrl/premium_lobby';
import PREMIUM_ROOM from '@salesforce/resourceUrl/premium_room';

// 부띠크 호텔
import BOUTIQUE_EXTERIOR from '@salesforce/resourceUrl/boutique_exterior';
import BOUTIQUE_LOBBY from '@salesforce/resourceUrl/boutique_lobby';
import BOUTIQUE_ROOM from '@salesforce/resourceUrl/boutique_room';

// 스탠다드 호텔
import STANDARD_EXTERIOR from '@salesforce/resourceUrl/standard_exterior';
import STANDARD_LOBBY from '@salesforce/resourceUrl/standard_lobby';
import STANDARD_ROOM from '@salesforce/resourceUrl/standard_room';

export default class BrandConceptGallery extends LightningElement {
    @api recordId;
    selectedBrand = '프리미엄 호텔';
    currentImageIndex = 0;
    
    // 브랜드별 이미지 배열 (외부 → 로비 → 내부 순서)
    brandImages = {
        '프리미엄 호텔': [
            PREMIUM_EXTERIOR,
            PREMIUM_LOBBY,
            PREMIUM_ROOM
        ],
        '부띠크 호텔': [
            BOUTIQUE_EXTERIOR,
            BOUTIQUE_LOBBY,
            BOUTIQUE_ROOM
        ],
        '스탠다드 호텔': [
            STANDARD_EXTERIOR,
            STANDARD_LOBBY,
            STANDARD_ROOM
        ]
    };
    
    /* 테스트용 - 일부만 사용할 때
    brandImages = {
        '프리미엄 호텔': [PREMIUM_EXTERIOR],
        '부띠크 호텔': [BOUTIQUE_EXTERIOR],
        '스탠다드 호텔': [STANDARD_EXTERIOR]
    };
    */
    
    brandOptions = [
        { label: '로비', value: '프리미엄 호텔' },
        { label: '내부 룸', value: '부띠크 호텔' },
        { label: '외관', value: '스탠다드 호텔' }
    ];
    
    @wire(getRecord, { recordId: '$recordId', fields: [BRAND_FIELD] })
    wiredRecord({ data, error }) {
        if (data) {
            const brandValue = data.fields.sf_product__c?.value;
            if (brandValue && this.brandImages[brandValue]) {
                this.selectedBrand = brandValue;
                this.currentImageIndex = 0;
            }
        }
    }
    
    get currentImage() {
        const images = this.brandImages[this.selectedBrand];
        return images ? images[this.currentImageIndex] : '';
    }
    
    get imageCounter() {
        const images = this.brandImages[this.selectedBrand];
        if (images) {
            const types = ['현장사진', '도면', '시안'];
            const currentType = types[this.currentImageIndex] || '';
            return `${currentType} (${this.currentImageIndex + 1}/${images.length})`;
        }
        return '';
    }
    
    get hasPrevious() {
        return this.currentImageIndex > 0;
    }
    
    get hasNext() {
        const images = this.brandImages[this.selectedBrand];
        return images && this.currentImageIndex < images.length - 1;
    }
    
get disablePrevious() {
    return !this.hasPrevious;
}

get disableNext() {
    return !this.hasNext;
}

    handleBrandChange(event) {
        this.selectedBrand = event.detail.value;
        this.currentImageIndex = 0;
    }
    
    handlePrevious() {
        if (this.currentImageIndex > 0) {
            this.currentImageIndex--;
        }
    }
    
    handleNext() {
        const images = this.brandImages[this.selectedBrand];
        if (images && this.currentImageIndex < images.length - 1) {
            this.currentImageIndex++;
        }
    }
}