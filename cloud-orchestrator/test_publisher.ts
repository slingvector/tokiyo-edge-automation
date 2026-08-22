import { LinkedInPublisher } from './src/services/LinkedInPublisher';

async function main() {
    console.log("Starting the Node.js multi-device publisher test...");
    
    // Instantiate two publishers with different device IDs
    const publisher1 = new LinkedInPublisher('emulator-5554');
    const publisher2 = new LinkedInPublisher('emulator-5556');
    const publisher3 = new LinkedInPublisher('emulator-5558');
    
    console.log("Firing concurrent posts to emulator-5554, emulator-5556, and emulator-5558...");

    const timestamp = Date.now();
    
    // ADB input text is sensitive to special characters
    const dronePost = `The%sintegration%sof%scomputer%svision%sand%sedge%sAI%sin%sautonomous%sUAV%ssystems%sis%sfundamentally%sshifting%smodern%slogistics%sand%ssurveillance%sarchitectures.%sBy%semploying%slightweight%sconvolutional%sneural%snetworks%sdirectly%son%sthe%sedge%shardware,%sdrones%scan%sperform%sreal-time%sobject%sdetection%sand%spath%splanning%swith%ssub-millisecond%slatency.%sThis%sdecentralized%scomputational%sapproach%sheavily%smitigates%sreliance%son%scloud%stelemetry,%sreducing%sbandwidth%sbottlenecks%sand%sensuring%soperational%sresilience%seven%sin%sGPS-denied%senvironments.%s[${timestamp}]`;
    
    const printingPost = `Additive%smanufacturing%sis%srapidly%stransitioning%sfrom%sa%srapid%sprototyping%snovelty%sinto%sa%smission-critical%sindustrial%sprocess.%sThe%sutilization%sof%sDirect%sMetal%sLaser%sSintering%scombined%swith%sgenerative%sdesign%salgorithms%sallows%sfor%sthe%screation%sof%stopologically%soptimized%scomponents%sthat%sexhibit%sunprecedented%sstrength-to-weight%sratios.%sAs%smaterial%sscience%sadvances,%sthe%sability%sto%smicro-structure%sanisotropic%smaterials%sduring%sthe%sprint%sphase%swill%sunlock%snew%sparadigms%sin%sthermal%smanagement.%s[${timestamp}]`;
    
    const systemPost = `Designing%srobust%sdistributed%ssystems%srequires%sa%srigorous%sunderstanding%sof%sthe%sCAP%stheorem%sand%sthe%sinherent%stradeoffs%sbetween%sconsistency%sand%savailability%sunder%snetwork%spartitions.%sImplementing%sconsensus%sprotocols%slike%sRaft%sor%sMulti-Paxos%sis%snon-trivial%swhen%sscaling%smicroservices%sacross%smulti-region%scloud%sdeployments.%sBy%sadopting%sevent%ssourcing%spatterns%sand%sleveraging%sidempotent%soperations,%sarchitectures%scan%sachieve%seventual%sconsistency%swhile%spreserving%sstrict%sordering%sguarantees.%s[${timestamp}]`;

    const results = await Promise.allSettled([
        publisher1.publishPost(dronePost),
        publisher2.publishPost(printingPost),
        publisher3.publishPost(systemPost)
    ]);

    results.forEach((result, index) => {
        const deviceId = index === 0 ? 'emulator-5554' : 'emulator-5556';
        if (result.status === 'fulfilled' && result.value === true) {
            console.log(`✅ [${deviceId}] Test Passed: Post was successfully published!`);
        } else {
            console.error(`❌ [${deviceId}] Test Failed: ${result.status === 'rejected' ? result.reason : 'Publishing flow did not complete'}`);
        }
    });
}

main().catch(console.error);
