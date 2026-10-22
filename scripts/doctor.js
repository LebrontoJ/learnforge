import {chromium} from 'playwright';
import {existsSync} from 'node:fs';
console.log(JSON.stringify({node:process.version,provider:process.env.PROVIDER||'fixture',apiKeyConfigured:!!process.env.API_KEY,model:process.env.MODEL||null,baseUrl:process.env.MODEL_BASE_URL||'https://api.openai.com/v1',searchConfigured:!!process.env.SEARCH_API_KEY,browserInstalled:existsSync(chromium.executablePath()),ports:[process.env.PORT||3043,process.env.PREVIEW_PORT||3044]},null,2));
