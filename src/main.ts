import { HLSController } from './core/controller/HLSController';
import Hls from 'hls.js';
import './style.css';

const TEST_STREAM = 'https://kr.object.ncloudstorage.com/lico/live/ad0c7589-ed03-4496-ab79-8273a7e93307/index.m3u8';

class PerformanceTester {
    private customPlayer: HLSController | null = null;
    private hlsjs: Hls | null = null;
    private memoryInterval: number | null = null;

    constructor() {
        this.initializeEventListeners();
    }

    private initializeEventListeners() {
        const customButton = document.getElementById('testCustom');
        const hlsjsButton = document.getElementById('testHlsjs');
        const resetButton = document.getElementById('resetTest');

        if (customButton) {
            customButton.addEventListener('click', () => this.startCustomTest());
        }
        if (hlsjsButton) {
            hlsjsButton.addEventListener('click', () => this.startHlsjsTest());
        }
        if (resetButton) {
            resetButton.addEventListener('click', () => this.resetTests());
        }
    }

    private updateMetric(prefix: string, metric: string, value: string) {
        const element = document.getElementById(`${prefix}${metric}`);
        if (element) {
            element.textContent = value;
        }
    }

    private async startCustomTest() {
        this.resetCustomPlayer();
        const startTime = performance.now();
        const video = document.getElementById('customPlayer') as HTMLVideoElement;
        
        let firstFrameRecorded = false;
        video.addEventListener('loadeddata', () => {
            if (!firstFrameRecorded) {
                const firstFrameTime = performance.now() - startTime;
                this.updateMetric('custom', 'FirstFrame', `${firstFrameTime.toFixed(0)}ms`);
                firstFrameRecorded = true;
            }
        });

        this.customPlayer = new HLSController({
            videoElement: video,
            initialBufferSize: 3,
            maxBufferSize: 6
        });

        video.addEventListener('playing', () => {
            const loadTime = performance.now() - startTime;
            this.updateMetric('custom', 'LoadTime', `${loadTime.toFixed(0)}ms`);
        });

        this.startMemoryTracking('custom');
        await this.customPlayer.loadStream(TEST_STREAM);
    }

    private async startHlsjsTest() {
        this.resetHlsjsPlayer();
        const startTime = performance.now();
        const video = document.getElementById('hlsjsPlayer') as HTMLVideoElement;

        let firstFrameRecorded = false;
        video.addEventListener('loadeddata', () => {
            if (!firstFrameRecorded) {
                const firstFrameTime = performance.now() - startTime;
                this.updateMetric('hlsjs', 'FirstFrame', `${firstFrameTime.toFixed(0)}ms`);
                firstFrameRecorded = true;
            }
        });

        if (Hls.isSupported()) {
            this.hlsjs = new Hls();
            this.hlsjs.loadSource(TEST_STREAM);
            this.hlsjs.attachMedia(video);

            this.hlsjs.on(Hls.Events.MANIFEST_PARSED, () => {
                video.play().catch(console.error);
            });

            video.addEventListener('playing', () => {
                const loadTime = performance.now() - startTime;
                this.updateMetric('hlsjs', 'LoadTime', `${loadTime.toFixed(0)}ms`);
            });

            this.startMemoryTracking('hlsjs');
        }
    }

    private startMemoryTracking(prefix: string) {
        if (!(performance as any).memory) {
            this.updateMetric(prefix, 'Memory', 'Not available');
            return;
        }

        if (this.memoryInterval) {
            clearInterval(this.memoryInterval);
        }

        this.memoryInterval = window.setInterval(() => {
            const memory = (performance as any).memory;
            const usedMB = (memory.usedJSHeapSize / 1024 / 1024).toFixed(2);
            this.updateMetric(prefix, 'Memory', `${usedMB} MB`);
        }, 1000);
    }

    private resetCustomPlayer() {
        if (this.customPlayer) {
            this.customPlayer.dispose();
            this.customPlayer = null;
        }
        this.resetMetrics('custom');
    }

    private resetHlsjsPlayer() {
        if (this.hlsjs) {
            this.hlsjs.destroy();
            this.hlsjs = null;
        }
        this.resetMetrics('hlsjs');
    }

    private resetMetrics(prefix: string) {
        this.updateMetric(prefix, 'LoadTime', '-');
        this.updateMetric(prefix, 'FirstFrame', '-');
        this.updateMetric(prefix, 'Memory', '-');
    }

    private resetTests() {
        this.resetCustomPlayer();
        this.resetHlsjsPlayer();
        if (this.memoryInterval) {
            clearInterval(this.memoryInterval);
            this.memoryInterval = null;
        }
    }
}

// Initialize the performance tester when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new PerformanceTester();
});