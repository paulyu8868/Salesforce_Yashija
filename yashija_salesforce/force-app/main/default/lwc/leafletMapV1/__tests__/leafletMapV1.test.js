import { createElement } from '@lwc/engine-dom';
import LeafletMapV1 from 'c/leafletMapV1';

describe('c-leaflet-map-v-1', () => {
    afterEach(() => {
        // The jsdom instance is shared across test cases in a single file so reset the DOM
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('TODO: test case generated by CLI command, please fill in test logic', () => {
        // Arrange
        const element = createElement('c-leaflet-map-v-1', {
            is: LeafletMapV1
        });

        // Act
        document.body.appendChild(element);

        // Assert
        // const div = element.shadowRoot.querySelector('div');
        expect(1).toBe(1);
    });
});