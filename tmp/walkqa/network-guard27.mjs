// Final QA is cache-only. Never let the API contact a provider on a cache miss.
import http from 'node:http';
import https from 'node:https';
import {syncBuiltinESMExports} from 'node:module';
const local = input => {
 const value = typeof input === 'string' || input instanceof URL ? new URL(input) : input;
 const host = value.hostname ?? value.host?.split(':')[0];
 if (!['localhost','127.0.0.1','::1'].includes(host)) throw new Error('Brief 27: external network disabled');
};
const fetch = globalThis.fetch;
globalThis.fetch = (input, init) => {local(typeof input === 'object' && 'url' in input ? input.url : input);return fetch(input,init);};
for (const protocol of [http,https]) for(const name of ['request','get']) {
 const original=protocol[name];
 protocol[name]=function(input,...args){local(input);return original.call(this,input,...args);};
}
syncBuiltinESMExports();
