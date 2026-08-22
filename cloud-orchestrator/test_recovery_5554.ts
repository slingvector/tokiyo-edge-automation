import { LinkedInEngager } from './src/services/LinkedInEngager';

async function testRecovery() {
    const engager = new LinkedInEngager('emulator-5554');
    const url = "https://www.linkedin.com/posts/nihal8132_ive-worked-with-founders-who-spent-months-share-7495802404295241728-Zq0e";
    const comment = "This is a recovery test. Quality over quantity!";
    
    console.log("Testing recovery on 5554...");
    await engager.commentOnPost(url, comment);
}

testRecovery().catch(console.error);
