import axios from 'axios';

export interface DeepLink {
    activity: string;
    intent_filters: any;
}

export interface ApkAnalysisResult {
    package_name: string;
    version_name: string;
    deep_links: DeepLink[];
}

export class ApkAnalyzerClient {
    private baseUrl: string;

    constructor(baseUrl: string = 'http://127.0.0.1:8082') {
        this.baseUrl = baseUrl;
    }

    async analyzeApk(apkPath: string): Promise<ApkAnalysisResult> {
        try {
            const response = await axios.post(`${this.baseUrl}/analyze`, {
                apk_path: apkPath
            });
            return response.data;
        } catch (error) {
            console.error('Failed to analyze APK:', error);
            throw error;
        }
    }

    async unmergeCompose(imageBase64: string, targetText: string, bbox?: number[]): Promise<any> {
        try {
            const response = await axios.post(`${this.baseUrl}/unmerge`, {
                image_base64: imageBase64,
                target_text: targetText,
                bbox: bbox
            });
            return response.data;
        } catch (error) {
            console.error('Failed to unmerge image:', error);
            throw error;
        }
    }
}
