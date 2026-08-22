import axios from 'axios';
export class ApkAnalyzerClient {
    baseUrl;
    constructor(baseUrl = 'http://127.0.0.1:8082') {
        this.baseUrl = baseUrl;
    }
    async analyzeApk(apkPath) {
        try {
            const response = await axios.post(`${this.baseUrl}/analyze`, {
                apk_path: apkPath
            });
            return response.data;
        }
        catch (error) {
            console.error('Failed to analyze APK:', error);
            throw error;
        }
    }
}
