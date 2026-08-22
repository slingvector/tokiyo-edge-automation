import { ApkAnalyzerClient, DeepLink } from './ApkAnalyzerClient';

class DeepLinkRegistryService {
    private analyzerClient = new ApkAnalyzerClient();
    private cache = new Map<string, DeepLink[]>();

    async ingestApk(apkPath: string) {
        console.log(`[DeepLinkRegistry] Ingesting APK: ${apkPath}`);
        const result = await this.analyzerClient.analyzeApk(apkPath);
        this.cache.set(result.package_name, result.deep_links);
        console.log(`[DeepLinkRegistry] Successfully ingested ${result.package_name} with ${result.deep_links.length} deep links.`);
    }

    getDeepLinks(packageName: string): DeepLink[] {
        return this.cache.get(packageName) || [];
    }

    findDeepLinkForGoal(packageName: string, goal: string): DeepLink | null {
        const links = this.getDeepLinks(packageName);
        // Simple heuristic: if goal mentions a keyword matching the intent path or host
        for (const link of links) {
            const filters = link.intent_filters;
            if (filters && filters.data) {
                for (const data of filters.data) {
                    if (data.host && goal.toLowerCase().includes(data.host.toLowerCase())) {
                        return link;
                    }
                    if (data.pathPrefix && goal.toLowerCase().includes(data.pathPrefix.toLowerCase().replace('/', ''))) {
                        return link;
                    }
                }
            }
        }
        return null;
    }
}

export const DeepLinkRegistry = new DeepLinkRegistryService();
