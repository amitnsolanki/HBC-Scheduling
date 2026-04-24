const dns = require('dns');
dns.resolveCname('badmintonschedule.org', (err, addresses) => { if (err) console.error(err); else console.log(addresses); });
dns.resolveCname('www.badmintonschedule.org', (err, addresses) => { if (err) console.error(err); else console.log(addresses); });
