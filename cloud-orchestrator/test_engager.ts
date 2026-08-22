import { LinkedInEngager } from './src/services/LinkedInEngager';

async function main() {
    // Instantiate the engager on the first emulator
    const engager = new LinkedInEngager('emulator-5554');
    
    console.log("Starting Engagement Test...");
    
    const commentPayload = "Absolutely! The rapid advancements in this space are incredible. The intersection of these technologies will define the next decade of innovation. Great post!";

    await engager.engageWithFeed(commentPayload);
}

main().catch(console.error);
