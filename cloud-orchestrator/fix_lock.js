const Redis = require('ioredis');
const redis = new Redis('redis://10.222.254.171:6379');
redis.keys('node_lock:*').then(keys => {
  if (keys.length > 0) {
    redis.del(...keys).then(() => {
      console.log('Cleared locks:', keys);
      process.exit(0);
    });
  } else {
    console.log('No locks found');
    process.exit(0);
  }
});
