import { DurableObject } from "cloudflare:workers";
import { downloadCountCookie, isOfficialGithubInstallerUrl, shouldCountDownload, sumLegacyOfficialDownloads } from "./download-counter.js";

const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const FALLBACK_MODEL = "gemini-2.5-flash-lite";
const MAX_AI_BODY = 180_000;
const PBKDF2_ITERATIONS = 100_000;
const LEGACY_PBKDF2_ITERATIONS = 100_000;
const MAX_AUTH_BODY = 32_000;
const MAX_CHAT_BODY = 16_000;
const MAX_WS_MESSAGE_BYTES = 128_000;
const MAX_ROOM_SOCKETS = 100;
const WATCH_ROOM_IDLE_TTL_MS = 24 * 60 * 60 * 1000;
const ACCOUNT_REGISTRY = "accounts-main-v1";
const MARSHMALLOW_CREATOR = "Deivison Santos";
const MARSHMALLOW_CREATOR_HANDLE = "@devsaex";
const DOWNLOAD_COUNTER_NAME = "official-windows-downloads-v1";
const OFFICIAL_RELEASES_API = "https://api.github.com/repos/blckbr/MarshMallow-Browser/releases";
const OFFICIAL_RELEASE_METADATA_URL = "https://marshmallow-browser-br.pages.dev/download/release.json";
const WATCH_EXTENSION_ZIP_B64 = "UEsDBBQAAAAIAEAUFV3DrqV9VAIAAG0HAAARAAAAc2VydmljZS13b3JrZXIuanPNVVFv0zAQfs+vuFVoSqCzioT20FAqNISEBAwN7QmhziS3zlpiR7a7UnX575wdp03WrYWHSTy0Tny+77777uLLlDQWbnH1UWmYQGz5r095ApN3cFWWsyW32c2M9mYv1t5SX6VRlN1oVSLTC2kFrUp+QWP4HBnP88/CWJSo47hsNodgUOaom/UCTUUR0UdYRwCZj++xKXxzlNHrlIk8Jbu4hvgokFr3IOI1qNvxNS8MQp2koNEutEyhjsgt5mYlM4g3cdpIlCnFafINyaaRt7tIgfOU2VWFMJlMYFCWJ8ZybU8M2YSSgyTgtYhhn1DbfQCtVDmG71YLOW9BmduE+3sYDBJm1WVVoT7jlEcy3PjNucUlX51rMRdyB6BnDUhb3xJzwb/RuUtdjMm0teTCVAVffeUl7mB2bB7xTMk7kfNcEUlTiAzj0RDejDpxvBqYv7dj+ECEmFTLbgr4uxIaTd8Mr+AUXsLpqP17PRqNgkudhge+5MJCaC5jlXb8grq0Wir4Dyrcz/FGcip78N1tDKsXvvcengxt4t/qQ5Wf49N1z7nlVPS9rMk/Jsqb4A87xmH4nJz2clEU7UFHKRybso2kcHzcOnc233aETjpNuJeZxlLdYY/cQRXHjmFHyhrQfXzPpP2iInXwGeTPFlqjtF35u7IfBfvf3zdP3AbAGAtYQ/e8+eYqd6u6iq/r5L9u/6xArh+pwL921uP09rPaIz3Z6yROWOZ0jJs7/unjzf3eRAAXN40cRjvFaAYYGmEXnnXeH2HbYehH1aF8tyOlz23t4rnfH1BLAwQUAAAACAB2GRVdz/NEh0MBAAB+AgAADQAAAG1hbmlmZXN0Lmpzb251UrtuwzAM3PMVgufU6GMrio7dMmcoAoGWmESJLAaUlAAN8jFFh079Cv9YJVupkTb1JB2PvNPRx4kQVQvOLNEHuUf2hlz1KB6mueCgxXSpZsB+PQNr6SDmENS66ssjvbqr7+vbAdXoFZtdKJWX1NaA2oo/Q4SiVnjjFJMzb9B9dh8kdsQC9+gCeYGie4/akPDUJgSFBtF2X9qAsKTA1oPgDrk1PjvxSfA1QQn0gRhW2DPSNUDjq3Rc9B1rSo+92vaU/MnI1j+P7Ox+xRSdTrxjGY+8NwrlgXiLnN9ZkJsBqTe93KkfoCiZd0EOuYxqw6x+ASkOHAtXrORvMT03bH5xi0JRveRydBJCtqhJxRykNNqek0mErLPktOo8NHDE6YUvCQ3FIBsLblsIff30ExCosuwSjsYlRBtkMMH+8//kbCanb1BLAwQUAAAACAB2GRVdTZhoXIcSAAB6NQAACgAAAGNvbnRlbnQuanOdO9ty20h27/6KNmZKC8ySEClLlgQaVGlsZaxdW3ZZ8kw2Hq/cJJokSiDA4CJKJlmVp7wnlao8pqa2krxkn/KQ9+hP9gvyCTmnL0A3AMneGZdNsvvc+tz7MrbtEH9IVo8IGSdxlpMwu0gWxCfLMA6SJfF99dXNk8WgBDt++/bVHy5fn5yfH/9wAuDW5eXr15c/HV88f3kp5s4vji9OLi8txIlYTuhiEd2G8RSAJzTKmBqPaJaf5zRnMBEXUWSM38bjc/b3BYvHON1Tc1kyvoIPE4GO8/CanbMsC5O4NpcyEDtm4/winLO0nCyXk9EJMrCvuTbO8xQEta9h9RyQHBHLIh65djjKpIiBFfCIk3ROo/Aze59GdpFGDtcjIXl6S1aScoHM2JK8f/cKQTokSsYUsd1ZyibOgBTujGYzVKE1ADnzIo1hLE+kEACx4UQBazwj9iUwUWAoNefrZosozG3rG8v50PsoMDaGqHMWhPR8nKTM5l87ZJZIvRtS829KK6A1VDJHcKcs/z4p4gCEeh6FLM7fwSyIZ2Bk+W2EigTg58l8UeQsOMchwbQGTFNGAfY1zWfunN7YvQ7n6C7DIJ855LvmzIyF01leI3MdZuGIc62wydAn/Z0e2drSEXF0HwclPhHyukEI+qO35DHY24qTmFmIKOY49RC0K6dnYRCw2NKJnBXzEUttAZ8s6BiB12vSd8iQ9Nxen3sN/sd9F42gnBn/CydEqMfN6fSMzhkPOuvH0xcnbyxHwv8W1tPrXfbEXx1VLl8D3GuFEyxA5cGtCDdQxo5Bvo5VTgk7hLGNFuuQHQXolAsTlpgFsC6pjdK9jtygSLnHo056NeNFGoqQsB0aVwDkh0QYVWC4YfY3YRzmzI4CB4cjhOg5pRsrLkE4mShPo6MMKXUBuKSu4PIkYikVyaZ0voMOLuw7tOSTPQ2lVA+n/szXsI/ABqU6IXF0d5o22chPFctITcxt2mK91xbVI5blr1FrdiOapXrDDCP4g+u6QTIu5hC2LqTT9PacRRAXSXocRbZ1HQYs6dAiCBPL+SiEQIU/RnQ3YvEU41EKotJqKTkHmtOFLYMcM6i9IjLN8HV5D+efjeNIZbhZkua2TTsjTmbkCiV3CRXfML0duZwC+oeSxdRKCCunUXRc5LMkhVhUcq2qhZUUhM9dXs7nJfipQGeBWrJY7UOQoOI8LaT5ZCaMKZbRqrwq3mUdBO6Py+Jn8gLnYrxUJQVoQ5AQgpfY6O0V8nUSBqLC8gG7mgK36WAqlI670RdDg+DkGlziFViQxRCBFqZBq8OF7/AlOV+Ap0XG/hqEjLErEP+vQYF0wMYzGk9bGHHD0wzahMr8mhoyPSK4/rKmsqW9qjajzOcA6mZ6C6KlJKRW4mC1UN8hEdRbF5Ofjum0tTlqUoDr/REXSZda+LGvJQKxwEHN1WsStAeImNT6tMqnm71BTtMpb8EMbY2LNAXjoeu2ZXs05Tu6rGOh143o+OodrpIXziZaiVMlfUmNZ35FGYqau7Onj4A9diEhq58e6deIM5rxfpF3U5XR34lxEMeaMZrmI0Zzy4HG7FWyZOlzmrF68xOk4SRvkVOoymmrW8LnNa05IKpUbZc0ZkH6nskTqtkLybasblwOo3KWU0albaodeKY8PoYE2hasPqKVbYH3OeTALFabsqqpoGJXmARz6HWzWYJVukxlD2hJKgBsyYt9ucYh0QiZsulK8iWBpnAq/QmtKMtjt4WSssBCNejDMb0Op7wdaUxFCQ1YMGc5DWhOsVEDEra7U/k8g11Og5HImAp6d+8L0JiPJXDf3f8CtOanUskyvpBnoHgegIQVvqbcfQmxX+45SAuRlZZWykHtl61hl1xM6JWxQ1qUWwxcLaIjxuLI5bZzyEJ8Meog36WiuPmba5YCGmbIIrOtcRRC8iTFnJJr9hl2aASJwpZvQVMKrQq4HE3J3S/Y6xAGBl2kSVDc/efdn6D1AcGdezx6QyZhDDkTxW6pzY3NLVbdw57T1rRlLA4ukuezMArAZe0FvUVXUlXqgTYtnKSwO4AcNEnSE4oa4QNGhyEUy8ddUC+U0Pwnvn0/chcJ1ogso1OmmHaI9Z3VWLJYcFVf5f6/WZnnghqUZZvhjCaJzIgQGaASPuniD60u8TmIKfx089sF4/sr81wBWyQ+31K26y2PBicAanrGebEmsW3hQkg/UnTlaUEifOplkqkzhg4vvUV2EpUDY9gM59pvqYwKRJ09hDHsgzXABY1ZpP0eFSPYv2kDRYy7NLFF1B2HxVmRMunwtt7W6AJznSknUl9OIjbnBtI1aC6zxBkD95xJDNsKwmvLaSC4Yrc7zrILdoPoFgSHh5k8pNEAXC1Ekb1JeMOCAfQbLPd6g89d8CR24+30d/d3D5483d0HyBCcNO1yF8k8vvkemIFQW4MLNgfLcrvqC3f0vihNEhRKF5jmOcTM+YyCL+P2JAmYZyUL3MtvJC5iuWEMvv3y4vUrwP/06Blf5/DRd6tRctPNws8Q5N4oSQOQGUYGE4ix7oTOw+jWO2fThJH3p53jFJTQyWicdTMGyXXz6JsRDaZsVdNLxCa513+6uBmMkjxP5uJ7TSW0yJOB4Oj1FzckSyJw/HQ6ovbO3l5H/XX7Tx0J1k1pEBaZ199BylCwpyke3Hgc56Bz0On3O+4hNFnjJEpS75vJZDJYQHTj0g6AQ7+3kAuD9TKP/+Sr57rzehyAPMF/OMleB/+4uw5nFqTJojsJI1iCN4qK1O7vLm4cpQIyWkmu+73g8JDhOPf/um5SPLDxdnqVcvh3frrj7YKYA3GmI77/Ov08fUg/O6Z+WowCPQdsVz05NZCnSN40DYMBfBuzLvQ188wbMz7fosLdugoPUFE8QXxZH/sHpT7wbObJLsx1xjQa2/1e73oJvdwOQDiOUhQC7T4xgGYA1EdRAEqJjyE4wDV0QXgYyVk3TZZiyaQ/SclXO+RuQ+EHDyl874sKx3CeRKA/cQhnanQHvJ3s151yb+8+rzwQXgk9U7BSa59E7GZAo3Aam6ab0oW3j6Epo6SP6xbhpVKBiN8H1NE7UOwgBpCR19eDDIhtxGwG9l9VM4fARerl8OnhU/oEqIyjJGMraYNeQ6Um36elXimlNYtULrSjhRT/bno3MFUFblWagRul1Am6pqFI/KcbhHgAi34MQhTzmOsS6G8eufNsuvoKP+rtO19YIR7L1Tytp1kLcxpocYMMQfdKxlGUjK/qeW4OO4cwVvbcUVg1m6D9lVKDXfgzGiyBf3cEpfPK4/92cQBNlcwhklm6MtKDGV9CMyC1iq66vx1WnpYni69wM95zrCDiu8K6va8K2FYtaqr/prcHf/bb6gZKCA1xFMbM64EA2HytBO8nT6sE3fsSB8aYIt/vywBZCq887PUaTvlsW9bnZ9CmkDDwLV5lrOH//du//Dt5Nhq+pmk2ew29SbIkeMzybHs0JP/7P+QZWpQjiMbOGkLjAI5KodX9yz/8B9CF+Rok7/isYV9OPtsGnsB5VICvCAhRypD7P/8XcOITAJExeTAJIDy5W0PoN0qRMeqtIefD5Vb0R8OfeFd+kcBmdsZSlL2SBpqVOWAp2EoInhys4d2/lhJISTWWKpatljnlsTDH3YgP8m8WmdMbcRzsW/2dXs8ivM7hhpylvvUinELa5Jsv6NSQwRx0aRnSoWNYw7/84z/VpYOVCDUNP8n+XXbcPm/LQAWyAfz+9jSwldnKro834+2gwm7lKaNq09uBS82oMzTRvbcDC61ISNnXt0MKs0tI1fG3g0on0nvSOgi3vePm0Ho/F5s837j9PHIRYr22LHlDozi2bOJgxzy+sjq24w9XYufhQ5QqeJ2FhW5tDeQ6XePuzG8f9X0LU511JK7VPPFrEE7sh+EdqXbY6o5hW+8MNg+pQ3i88/Di2hkKudRFljq1wu0FzX2uE/PUE9ThK9muaVQwN0/Dua2dttmPEWi9fiwuqddr8andvME+9yc2OhfDb96enDm1s38xg2LYvzt/cwYi41VwOLm1V7hR9qwxSGd1kI+H/7gZLJNBy4Mx6WycShpdUt+yjDuA9rDC8HxAk0o3ZnS0wF+xW+jLYtA9Qy2CXpgLY2jhE8zd1tbWY+Zms3CS/57dOivmLlLe671gE1pEeLOseKH5teMI7SCldvqDugBK5jYZnU2lEkd9Mfwavw82NcpvWbKImB230pPpxpGfBjV5bx+v11BPDaqgJL4cfhIh/KqF9uMqQznNawpsS/2Ht+oI4o4jmmV4mQy5PptaOonlLLmXwgjwYd5YED9YiYHUei0OWdIkYmhHvMGDyMbdNUQ2gF+HATTjlrET5xFzHzusXQDOfbjBUoSRclq+KrH1t0FC7vzOoNKVcSyAwMZkNgaho4tk4TcGX/LuQh1Mteelx2Vekinyt36/PUd+whxJvpVgm0+D5vnfMsPnIgls6MK4g3m6g8p19HOzwldPRgSY1GgBMZLkCfRHvvYVLZHni8wDWywz+PDgw7NKFJrPkIH/aZsuwm1kuP3tCj8228vskwLLGE3HM//TEYf9Frx+nATs/btTfMcBORLMJXxAN/Tmk3ETbDxbued2LoWICedMHURKczjlE5SVpEWXNMzJeJYmc+ZKJJ4S65iDjTgevnRW+g11U+8hiJ2z03iS2IayURWvWU799qNX+zd4xv8hFrGE7eSct5PdJbLt8lL88TeGz0M4YxX+9UQlgYou5gUlJ5QWjYHTuJavVuXzKy2Fp86D8Q7rPQSLcYeFDLb/+OG4+3e97uHH1W6n/3Tz7Ta4dpZzAk6TjxjgntSZQlQv6e0b7q1e+cRJeO/mPl8A4nQUhdlMti2mXYS9fN1spaxi0FHFWThLzbVkrZzPu8AmhZ2bYGLxmPMEBbdFejljDHZkIsCMqqe6TVlq5SG5fsguBSjfxZ387cXJ2fnpm7PLdyfHL/7QFGTT4cfxokjrHUnKMojBjPlfWChU83KZSjSjMfQVpSNXwq3XlUXRCQxwowDVa5U8ZG/cwJT7KK0Q4JBoeOyWQr6AVbxKkqvsVXilWF/wKzzlEQ3J5COQt4AJ2VQ5p3FhbXZu8oKwTKzG2z3zTV7tWldcJrYjGjKZIpVUpGxSABkTkLUFXflbGr2eyviCmqmMX3u8VA9o5J3/ynwu4GuPBep3JQ9ckwhnMq5hOhx8c29Kn4GxI8afHzTlQcuJ381mZiFU5Ws373LIPMxnRQZ5gulwaoxzRQSyXkt929t/5PXwyPt5++ft7VAkMQ13rnDwsr1tnHjEMruY26TIixHzt/kXG0i7I7YesZ8hqc4dxaMSvuom+MjWluEotZ+G30CrociU2e1eYAU6+Lo8WCwCPG4qE+ECvc1b6RQ9SXGzMfPQ9jY5ZyQhURhfkSIOsQLRiGuHTQtGoBWhKaEED2wY7GA+hzE0aSRg4Q2D4cXdL+DklCzZSJEbF5BCUxKoG1qXHBNopCDL3P0pIdndf4ObZVA6SQbpMcOr9wjrKCOjKBl1kzi6dc1qIErE1patfGO9lmZzSlV+RZZ+cfru5PnF5fGPx6evjr9/dSLTtGmEerZuS4T63TIunGANSeK7P19XJwHEuJDbPGpfUd0hvmIVZ8c/nv5wfHF69sOvlp+OUuRDru/+HLDEgKyuv/1hmTthvXgYVEZBp3/Qe2iZrUnsnqqiP0E44m8oKDoOixL+jhBa3iyMoZ2Pw8/lDsRMmbUidE9Zgd7qoWLkmO+4bLFTB5dr7PH9+h6/5RzAgHn+5uwM/A4MVnEpK5lA5SWoxLDFPsK0q9m0NG1eG9K6GkdsVuU7cyxBTY9gaZpASKMu2Y14MSFFlSaVS0xivFflxyctbjUtaBpgfyBMp0yuUGVf78snBdUJDN6l8zcEqBH84vPDkQV0z8yunhg0NwSD6jGLXb42wG0TT3zW1pb2dIBXykZBa7wtKJ+2mAT5uYxj7PMfhF9AO4Yv/awytMvSyI8f/OM0pbdumPFPgStmnCPth/fh46DEr84uxKR8v8uPI2pMZjTD+PMlYAZbLdte4FnZkbnJ1zAxZCSe89XGhWBsXT/CdHlAWC3EcJbIdjLQEtD9pKCVYYGuzCZRLH6YkFHtoNSA6ovj1r+3fI4j2CM3+utGhfZ5Q131YfyncO8jlx9VVseFG/1ArgwBDiROH+9tydvqjdF6c2lVojb//xcMW/23r6V0I09iCoccXpcP80B6T3ir3MAfmd79Uta6r3xJVIt6PDbkkZ0lRTrGk1NBYr2uAv6I+wAe0ZTV7/Tsx9OLk8u30LxaRs7+1bs03iZWPHkyrW2kq3oqXxhxb2rucQePNg78+/9QSwMEFAAAAAgAdhkVXdBwpA7CAAAAAAEAABIAAABSRUFETUVfSU5TVEFMQVIubWQ9jjFOBDEMRfs5xZdoRxHQ0iK6hYKC2pt4WbNJPIozi8RtEAWi2JIT5GIYEEhu/Oxn/zNsqNl+QznrMx6oxz0uwmU4n6YbZ1uKByS2Q9cl4F5qbFrlhcb7eFMs2sBHrl3tCsYFUVvj31nU2sepruQ6jpw1SqLEAXcYr2sSxfiAaXGboX8sEco4JSG4QDng9ucWLX1thM6Z5v9VhYl1Lo6qdtlJ/I71yTbjWsyjpBlP+qjeF/HcO63+afXqjQy0JQvTF1BLAQIUAxQAAAAIAEAUFV3DrqV9VAIAAG0HAAARAAAAAAAAAAAAAACkgQAAAABzZXJ2aWNlLXdvcmtlci5qc1BLAQIUAxQAAAAIAHYZFV3P80SHQwEAAH4CAAANAAAAAAAAAAAAAACkgYMCAABtYW5pZmVzdC5qc29uUEsBAhQDFAAAAAgAdhkVXU2YaFyHEgAAejUAAAoAAAAAAAAAAAAAAKSB8QMAAGNvbnRlbnQuanNQSwECFAMUAAAACAB2GRVd0HCkDsIAAAAAAQAAEgAAAAAAAAAAAAAApIGgFgAAUkVBRE1FX0lOU1RBTEFSLm1kUEsFBgAAAAAEAAQA8gAAAJIXAAAAAA==";
const WATCH_WEB_VERSION = "3.0.6";

function cors(headers = {}) {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type, authorization",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    ...headers,
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: cors({ "content-type": "application/json; charset=utf-8" }),
  });
}

function roomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map((value) => alphabet[value % alphabet.length]).join("");
}

function safeText(value, max = 1200) {
  return String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, max);
}

async function readJsonLimited(request, maxBytes) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > maxBytes) {
    const error = new Error("BODY_TOO_LARGE");
    error.code = "BODY_TOO_LARGE";
    throw error;
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    const error = new Error("BODY_TOO_LARGE");
    error.code = "BODY_TOO_LARGE";
    throw error;
  }
  return JSON.parse(text || "{}");
}

function aiReplyText(value, max = 8000) {
  if (typeof value === "string") return safeText(value, max).trim();
  if (value == null) return "";
  if (Array.isArray(value)) {
    return safeText(value.map((item) => aiReplyText(item, max)).filter(Boolean).join("\n"), max).trim();
  }
  if (typeof value === "object") {
    for (const key of ["text", "content", "message", "answer", "reply", "response"]) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        const nested = aiReplyText(value[key], max);
        if (nested) return nested;
      }
    }
    try { return safeText(JSON.stringify(value, null, 2), max).trim(); } catch { return ""; }
  }
  return safeText(value, max).trim();
}


function liveKitConfigured(env) {
  return !!(
    safeText(env.LIVEKIT_URL, 500) &&
    safeText(env.LIVEKIT_API_KEY, 500) &&
    safeText(env.LIVEKIT_API_SECRET, 2000)
  );
}

function base64UrlBytes(bytes) {
  let binary = "";
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < view.length; i += 1) binary += String.fromCharCode(view[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlJson(value) {
  return base64UrlBytes(new TextEncoder().encode(JSON.stringify(value)));
}

async function createLiveKitToken(env, { room, identity, name, role }) {
  if (!liveKitConfigured(env)) throw new Error("LIVEKIT_NOT_CONFIGURED");

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const videoGrant = {
    roomJoin: true,
    room,
    canSubscribe: role !== "host",
    canPublish: role === "host",
    canPublishData: false,
  };

  const payload = {
    iss: safeText(env.LIVEKIT_API_KEY, 500),
    sub: identity,
    name: safeText(name, 80),
    nbf: now - 5,
    exp: now + (4 * 60 * 60),
    jti: crypto.randomUUID(),
    metadata: JSON.stringify({ role, product: "MarshMallow" }),
    video: videoGrant,
  };

  const unsigned = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(safeText(env.LIVEKIT_API_SECRET, 2000)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(unsigned)
  );

  return `${unsigned}.${base64UrlBytes(signature)}`;
}

function landingPage(room) {
  const escaped = safeText(room, 16).replace(/[^A-Z0-9]/g, "");
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#070709">
<meta name="marshmallow-watch-version" content="${WATCH_WEB_VERSION}">
<title>MarshMallow Watch Together · ${escaped}</title>
<style>
*{box-sizing:border-box}
html,body{margin:0;min-height:100%;background:#060608;color:#f5f5f6;font-family:Inter,Segoe UI,Arial,sans-serif}
body{min-height:100vh;background:radial-gradient(circle at 14% 7%,rgba(255,255,255,.055),transparent 30rem),linear-gradient(145deg,#111115,#060608 60%)}
.shell{width:min(1240px,calc(100% - 24px));margin:0 auto;padding:15px 0 28px}
.top{display:flex;align-items:center;gap:12px;margin-bottom:14px}
.logo{width:43px;height:43px;border-radius:14px;background:#f3f3f5;color:#070709;display:grid;place-items:center;font-size:23px;font-weight:1000}
.brand{display:grid;gap:2px}.brand b{font-size:15px}.brand span{font-size:10px;color:#9292a0}
.room{margin-left:auto;border:1px solid #303039;border-radius:12px;background:#0d0d12;padding:8px 11px;font-size:10px}.room strong{letter-spacing:1.5px}
.layout{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:14px}
.card{border:1px solid #292932;border-radius:20px;background:#0b0b0f;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.42)}
.stage{position:relative;min-height:430px;background:#000;display:grid;place-items:center;overflow:hidden}
#remoteVideo{width:100%;height:100%;min-height:430px;object-fit:contain;background:#000;display:none}
.waiting{max-width:650px;padding:32px;text-align:center}.waiting .fire{font-size:44px}.waiting h1{margin:10px 0 7px;font-size:21px}.waiting p{margin:0;color:#9b9baa;font-size:12px;line-height:1.6}
.statusbar{display:flex;align-items:center;gap:9px;min-height:50px;padding:9px 12px;border-top:1px solid #25252d;color:#babac4;font-size:10px}
.dot{width:8px;height:8px;border-radius:50%;background:#d4aa51}.dot.ok{background:#63da9b}.dot.bad{background:#e56f72}
.statusbar button{margin-left:auto;border:1px solid #353540;border-radius:10px;background:#eee;color:#111;padding:8px 12px;font-size:10px;font-weight:800;cursor:pointer}
.volumeCtl{margin-left:auto;display:flex;align-items:center;gap:7px;min-width:190px;color:#9d9daa}
.volumeCtl span{font-size:13px}.volumeCtl input{width:110px;accent-color:#eee}.volumeCtl b{width:34px;text-align:right;color:#d2d2d8;font-size:9px}
.statusbar .volumeCtl + button{margin-left:4px}

.chat{display:grid;grid-template-rows:auto 1fr auto;min-height:530px}
.chathead{padding:13px;border-bottom:1px solid #25252d;font-size:12px;font-weight:800}.chathead span{float:right;color:#858594;font-size:9px;font-weight:500}
.messages{padding:10px;overflow:auto;display:flex;flex-direction:column;gap:8px}
.msg{border:1px solid #24242d;border-radius:11px;background:#101014;padding:8px}.msg b{display:block;font-size:9px;margin-bottom:3px}.msg div{font-size:11px;color:#dbdbe1;word-break:break-word}
.composer{display:grid;grid-template-columns:1fr 38px;gap:7px;padding:9px;border-top:1px solid #25252d}.composer input{min-width:0;border:1px solid #303039;border-radius:10px;background:#07070a;color:#fff;padding:10px;outline:0}.composer button{border:0;border-radius:10px;background:#eee;color:#111;font-weight:900}
.info{margin-top:14px;border:1px solid #292932;border-radius:16px;background:#0b0b0f;padding:13px;color:#8f8f9c;font-size:10px;line-height:1.55}
.info b{color:#dedee3}
#audioBin{display:none}
@media(max-width:860px){.layout{grid-template-columns:1fr}.chat{min-height:300px}.stage,#remoteVideo{min-height:54vw}.shell{width:min(100% - 12px,1240px);padding-top:8px}.brand span{display:none}}
</style>
</head>
<body>
<div class="shell">
  <header class="top">
    <div class="logo">M</div>
    <div class="brand"><b>MarshMallow Watch Together</b><span>LiveKit/WebRTC direto do player · somente vídeo e áudio da mídia do host</span></div>
    <div class="room">Sala <strong>${escaped}</strong></div>
  </header>

  <div class="layout">
    <section class="card">
      <div class="stage">
        <div class="waiting" id="waiting">
          <div class="fire">🔥</div>
          <h1 id="waitTitle">Pronto para assistir</h1>
          <p id="waitText">Clique em entrar. O vídeo e o áudio chegam como tracks WebRTC; a tela e os sons do sistema do host não são enviados.</p>
        </div>
        <video id="remoteVideo" playsinline controls></video>
        <div id="audioBin"></div>
      </div>
      <div class="statusbar">
        <span class="dot" id="dot"></span>
        <span id="status">Conectando ao bate-papo…</span>
        <label class="volumeCtl" title="Volume do convidado">
          <span id="volumeIcon">🔉</span>
          <input id="guestVolume" type="range" min="0" max="100" step="1" value="30">
          <b id="volumeValue">30%</b>
        </label>
        <button id="joinBtn" type="button">Entrar e assistir</button>
      </div>
      <div id="hostDiagnostic" style="padding:8px 12px;border-top:1px solid #202027;color:#7f7f8e;font-size:9px;line-height:1.45">Diagnóstico do host: aguardando…</div>
    </section>

    <aside class="card chat">
      <div class="chathead">💬 Bate-papo <span id="people">1 participante</span></div>
      <div class="messages" id="messages"></div>
      <div class="composer">
        <input id="chatInput" maxlength="1200" placeholder="Digite uma mensagem…">
        <button id="chatSend">↑</button>
      </div>
    </aside>
  </div>

  <div class="info">
    <b>Privacidade:</b> o host publica somente as tracks de vídeo/áudio do WebFrameMain selecionado pelo Electron. Não há captura de área de trabalho, notificações, Discord, jogos, outras abas, microfone ou mixagem geral do Windows.
  </div>
</div>

<script>
(function(){
  const ROOM="${escaped}";
  const wsScheme=location.protocol==="https:"?"wss:":"ws:";
  const wsUrl=wsScheme+"//"+location.host+"/api/room/"+ROOM+"/ws?name="+encodeURIComponent("Convidado web");

  const video=document.getElementById("remoteVideo");
  const audioBin=document.getElementById("audioBin");
  const guestVolume=document.getElementById("guestVolume");
  const volumeValue=document.getElementById("volumeValue");
  const volumeIcon=document.getElementById("volumeIcon");
  const waiting=document.getElementById("waiting");
  const waitTitle=document.getElementById("waitTitle");
  const waitText=document.getElementById("waitText");
  const joinBtn=document.getElementById("joinBtn");
  const status=document.getElementById("status");
  const dot=document.getElementById("dot");
  const people=document.getElementById("people");
  const hostDiagnostic=document.getElementById("hostDiagnostic");
  const messages=document.getElementById("messages");
  const chatInput=document.getElementById("chatInput");
  const chatSend=document.getElementById("chatSend");

  let socket=null;
  let liveRoom=null;
  let sdkPromise=null;
  let joined=false;
  const seenChatIds=new Set();
  let chatHistoryPolling=false;

  const safe=(v)=>String(v==null?"":v);

  const clampVolume=(value)=>Math.max(0,Math.min(100,Number(value)||0));
  let currentVolume=30;
  try{
    const saved=localStorage.getItem("marshmallow.watch.volume");
    if(saved!==null)currentVolume=clampVolume(saved);
  }catch(_){}

  const applyGuestVolume=()=>{
    const normalized=currentVolume/100;
    try{video.volume=normalized;}catch(_){}
    for(const element of audioBin.querySelectorAll("audio")){
      try{element.volume=normalized;}catch(_){}
    }
    guestVolume.value=String(currentVolume);
    volumeValue.textContent=currentVolume+"%";
    volumeIcon.textContent=currentVolume===0?"🔇":currentVolume<45?"🔉":"🔊";
  };

  guestVolume.addEventListener("input",()=>{
    currentVolume=clampVolume(guestVolume.value);
    try{
      localStorage.setItem("marshmallow.watch.volume",String(currentVolume));
    }catch(_){}
    applyGuestVolume();
  });

  applyGuestVolume();


  function setStatus(text,state="idle"){
    status.textContent=text;
    dot.classList.toggle("ok",state==="ok");
    dot.classList.toggle("bad",state==="bad");
  }

  function addChat(data){
    const id=safe(data.id||data.messageId);
    if(id&&seenChatIds.has(id))return;
    if(id){
      seenChatIds.add(id);
      if(seenChatIds.size>500){
        const first=seenChatIds.values().next().value;
        if(first)seenChatIds.delete(first);
      }
    }

    const item=document.createElement("div");item.className="msg";
    const who=document.createElement("b");
    who.textContent=data.own?"Você":(data.name||(data.role==="host"?"Host":"Convidado"));
    const body=document.createElement("div");body.textContent=safe(data.text);
    item.append(who,body);messages.appendChild(item);messages.scrollTop=messages.scrollHeight;
  }

  function createMessageId(){
    try{return crypto.randomUUID();}
    catch(_){return "chat-"+Date.now().toString(36)+Math.random().toString(36).slice(2);}
  }

  async function pollChatHistory(){
    if(chatHistoryPolling)return;
    chatHistoryPolling=true;
    try{
      const response=await fetch("/api/room/"+encodeURIComponent(ROOM)+"/chat-history?_mm="+Date.now(),{
        cache:"no-store",
        headers:{"cache-control":"no-cache"}
      });
      if(response.ok){
        const data=await response.json().catch(()=>({}));
        if(Array.isArray(data.messages))data.messages.forEach(addChat);
      }
    }catch(_){}
    finally{chatHistoryPolling=false;}
  }

  function connectChat(){
    socket=new WebSocket(wsUrl);
    socket.onopen=()=>{setStatus(joined?"Aguardando mídia do host":"Bate-papo conectado","ok");void pollChatHistory();};
    socket.onmessage=(event)=>{
      let data;try{data=JSON.parse(event.data);}catch(_){return;}
      if(data.type==="chat")addChat(data);
      else if(data.type==="chat-history"&&Array.isArray(data.messages))data.messages.forEach(addChat);
      else if(data.type==="host-status"){
        const reason=safe(data.reason);
        const strategy=safe(data.strategy);
        const kinds=Array.isArray(data.trackKinds)?data.trackKinds.join(" + "):"";
        hostDiagnostic.textContent="Diagnóstico do host: "+safe(data.status)+(strategy?" · "+strategy:"")+(kinds?" · "+kinds:"")+(reason?" · "+reason:"");
        if(data.status==="manual-required"){
          setStatus("Host precisa autorizar a captura segura do vídeo","ok");
        }else if(["failed","unsupported","direct-timeout","fallback-failed","region-failed"].includes(safe(data.status))){
          setStatus("Host conectado, mas a publicação da mídia falhou","bad");
        }else if(["publishing","connected","fallback-capturing","fallback-connected","region-publishing","region-connected"].includes(safe(data.status))){
          setStatus("Host publicou mídia · aguardando/assinando track","ok");
        }
      }
      else if(data.type==="presence"){
        const list=Array.isArray(data.people)?data.people:[];
        people.textContent=list.length+" "+(list.length===1?"participante":"participantes");
      }else if(data.type==="host-ended"){
        setStatus("Sessão encerrada pelo host","bad");
        waitTitle.textContent="Sessão encerrada";
        waitText.textContent="O anfitrião saiu da sala.";
        if(liveRoom){try{liveRoom.disconnect();}catch(_){}}
      }
    };
    socket.onclose=()=>setTimeout(connectChat,1800);
  }

  function sendChat(){
    const text=chatInput.value.trim();
    if(!text||!socket||socket.readyState!==WebSocket.OPEN)return;
    const messageId=createMessageId();
    addChat({id:messageId,messageId,text,own:true});
    socket.send(JSON.stringify({type:"chat",text:text.slice(0,1200),messageId}));
    chatInput.value="";
  }

  chatSend.addEventListener("click",sendChat);
  chatInput.addEventListener("keydown",(e)=>{
    if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendChat();}
  });

  function loadScript(src){
    return new Promise((resolve,reject)=>{
      const s=document.createElement("script");
      s.src=src;s.async=true;s.onload=()=>resolve();s.onerror=reject;
      document.head.appendChild(s);
    });
  }

  async function ensureSdk(){
    if(window.LivekitClient)return window.LivekitClient;
    if(!sdkPromise){
      sdkPromise=(async()=>{
        try{
          await loadScript("https://cdn.jsdelivr.net/npm/livekit-client@2.22.0/dist/livekit-client.umd.js");
        }catch(_){
          await loadScript("https://unpkg.com/livekit-client@2.22.0/dist/livekit-client.umd.js");
        }
        if(!window.LivekitClient)throw new Error("LiveKit SDK não carregou");
        return window.LivekitClient;
      })();
    }
    return sdkPromise;
  }

  async function joinMedia(){
    if(joined)return;
    joined=true;
    joinBtn.disabled=true;
    setStatus("Preparando conexão de mídia…");

    try{
      const response=await fetch("/api/livekit/token",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({room:ROOM,role:"guest",name:"Convidado web"})
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||("Token "+response.status));

      const LK=await ensureSdk();
      const room=new LK.Room({adaptiveStream:false,dynacast:false});
      liveRoom=room;

      const attachRemoteTrack=(track,publication,participant)=>{
        try{
          if(track.kind===LK.Track.Kind.Video){
            try{
              publication?.setSubscribed?.(true);
              publication?.setVideoQuality?.(LK.VideoQuality.HIGH);
              publication?.setVideoDimensions?.({width:1920,height:1080});
              publication?.setVideoFPS?.(30);
            }catch(_){}

            try{track.detach(video);}catch(_){}
            track.attach(video);
            video.autoplay=true;
            video.playsInline=true;
            video.style.display="block";
            waiting.style.display="none";

            const reportResolution=()=>{
              const width=Number(video.videoWidth||0);
              const height=Number(video.videoHeight||0);
              setStatus(width&&height
                ? ("Vídeo recebido · "+width+"×"+height+" · qualidade máxima")
                : "Vídeo recebido · qualidade máxima","ok");
            };
            video.addEventListener("loadedmetadata",reportResolution,{once:true});
            video.addEventListener("resize",reportResolution);

            const play=video.play();
            if(play?.catch)play.catch(()=>setStatus("Toque no vídeo uma vez para liberar reprodução/áudio","ok"));
            reportResolution();
            waitText.textContent="";
          }else if(track.kind===LK.Track.Kind.Audio){
            const element=track.attach();
            element.autoplay=true;
            element.controls=false;
            element.style.display="none";
            element.volume=currentVolume/100;
            audioBin.appendChild(element);
            try{element.play().catch(()=>{});}catch(_){}
          }
        }catch(error){
          setStatus("Track recebida, mas não foi possível anexar","bad");
        }
      };

      room.on(LK.RoomEvent.TrackSubscribed,(track,publication,participant)=>{
        attachRemoteTrack(track,publication,participant);
      });

      room.on(LK.RoomEvent.TrackPublished,(publication,participant)=>{
        setStatus("Host publicou "+safe(publication.kind||"mídia")+" · assinando em qualidade máxima…","ok");
        try{
          publication.setSubscribed(true);
          if(publication.kind===LK.Track.Kind.Video){
            publication.setVideoQuality?.(LK.VideoQuality.HIGH);
            publication.setVideoDimensions?.({width:1920,height:1080});
            publication.setVideoFPS?.(30);
          }
        }catch(_){}
      });

      room.on(LK.RoomEvent.TrackSubscriptionFailed,()=>{
        setStatus("O LiveKit não conseguiu assinar uma track","bad");
      });

      room.on(LK.RoomEvent.ParticipantConnected,(participant)=>{
        setStatus("Host conectado ao LiveKit · aguardando track","ok");
      });

      room.on(LK.RoomEvent.TrackUnsubscribed,(track)=>{
        try{track.detach();}catch(_){}
      });

      room.on(LK.RoomEvent.ParticipantDisconnected,()=>{
        setStatus("Host desconectado — aguardando retorno");
      });

      room.on(LK.RoomEvent.Reconnecting,()=>setStatus("Reconectando mídia…"));
      room.on(LK.RoomEvent.Reconnected,()=>setStatus("Mídia reconectada","ok"));
      room.on(LK.RoomEvent.Disconnected,()=>setStatus("Mídia desconectada","bad"));

      await room.connect(data.url,data.token);
      try{await room.startAudio();}catch(_){}

      // Caso o host já tivesse publicado antes do convidado terminar connect(),
      // force a assinatura das publicações existentes.
      try{
        for(const participant of room.remoteParticipants.values()){
          for(const publication of participant.trackPublications.values()){
            try{
              publication.setSubscribed(true);
              if(publication.kind===LK.Track.Kind.Video){
                publication.setVideoQuality?.(LK.VideoQuality.HIGH);
                publication.setVideoDimensions?.({width:1920,height:1080});
                publication.setVideoFPS?.(30);
              }
            }catch(_){}
            const existingTrack=publication.track||publication.videoTrack||publication.audioTrack;
            if(existingTrack)attachRemoteTrack(existingTrack,publication,participant);
          }
        }
      }catch(_){}

      setStatus("Conectado — aguardando vídeo do host","ok");
      joinBtn.style.display="none";
      waitTitle.textContent="Aguardando o host";
      waitText.textContent="Quando o player do host publicar as tracks LiveKit, o vídeo aparecerá aqui automaticamente.";
    }catch(error){
      joined=false;
      joinBtn.disabled=false;
      setStatus("Falha ao entrar na mídia","bad");
      waitTitle.textContent="Não foi possível iniciar o LiveKit";
      waitText.textContent=String(error&&error.message?error.message:error);
    }
  }

  joinBtn.addEventListener("click",joinMedia);
  connectChat();
  void pollChatHistory();
  setInterval(()=>void pollChatHistory(),1500);
})();
</script>
</body>
</html>`;
}

function validActions(value) {
  if (!Array.isArray(value)) return [];
  const result = [];
  for (const item of value.slice(0, 12)) {
    if (!item || typeof item !== "object") continue;
    if (item.type === "sort_tabs" && ["alpha", "site", "recent"].includes(item.mode)) {
      result.push({ type: "sort_tabs", mode: item.mode });
    } else if (item.type === "open_url" && typeof item.url === "string" && /^https?:\/\//i.test(item.url)) {
      result.push({ type: "open_url", url: item.url.slice(0, 2000) });
    } else if (item.type === "close_tabs" && Array.isArray(item.tabIds)) {
      result.push({ type: "close_tabs", tabIds: item.tabIds.filter((id) => typeof id === "string").slice(0, 80) });
    } else if (item.type === "group_tabs" && Array.isArray(item.groups)) {
      result.push({
        type: "group_tabs",
        groups: item.groups.slice(0, 20).map((group) => ({
          name: safeText(group?.name, 60),
          tabIds: Array.isArray(group?.tabIds) ? group.tabIds.filter((id) => typeof id === "string").slice(0, 80) : [],
        })).filter((group) => group.name),
      });
    }
  }
  return result;
}

function buildAiPrompt(body) {
  const permissions = body.permissions || {};
  const tabs = Array.isArray(body.tabs) ? body.tabs.slice(0, 80) : [];
  const groups = Array.isArray(body.groups) ? body.groups.slice(0, 30) : [];
  const page = body.page && typeof body.page === "object" ? body.page : null;
  const history = Array.isArray(body.messages) ? body.messages.slice(-10) : [];

  return `Você é a IA nativa do navegador MarshMallow. Responda em português do Brasil, de forma útil e direta.

Informação oficial e imutável do projeto:
- O criador e desenvolvedor do MarshMallow é Deivison Santos (@devsaex).
- Se perguntarem quem criou, desenvolveu, fez ou é o autor do MarshMallow, responda exatamente com essa autoria.
- Não atribua a criação ou o desenvolvimento do MarshMallow a qualquer outro nome, pessoa, equipe ou empresa.

Você pode PROPOR apenas estas ações tipadas; nunca invente comandos de sistema, JavaScript, shell, arquivos ou APIs:
1. {"type":"sort_tabs","mode":"alpha|site|recent"}
2. {"type":"group_tabs","groups":[{"name":"categoria","tabIds":["id"]}]}
3. {"type":"open_url","url":"https://..."}
4. {"type":"close_tabs","tabIds":["id"]}

Permissões atuais do usuário:
${JSON.stringify(permissions)}
O aplicativo aplicará as permissões novamente antes de executar qualquer ação.

Abas abertas:
${JSON.stringify(tabs)}

Grupos existentes:
${JSON.stringify(groups)}

${page ? `Página atual fornecida voluntariamente pelo usuário:\n${JSON.stringify({ title: page.title, url: page.url, text: String(page.text || "").slice(0, 16000) })}\n` : "A página atual NÃO foi fornecida. Não finja tê-la lido.\n"}

Conversa recente:
${JSON.stringify(history)}

Pedido atual:
${safeText(body.prompt, 5000)}

Regras de ação:
- Para organizar por assunto, use group_tabs e somente tabIds existentes.
- YouTube pode ser grupo próprio quando fizer sentido; vídeos musicais podem ir para Música se o contexto mostrar isso.
- Anime, Filmes/Séries e Música devem ser categorias separadas quando houver conteúdo suficiente.
- Não feche abas a menos que o pedido do usuário envolva fechar/remover/limpar ou duplicadas.
- Se não precisar executar nada, actions deve ser [].
- A resposta deve explicar brevemente o que foi feito ou responder à pergunta.
`;
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    reply: { type: "STRING" },
    actions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          type: { type: "STRING", enum: ["sort_tabs", "group_tabs", "open_url", "close_tabs"] },
          mode: { type: "STRING", enum: ["alpha", "site", "recent"] },
          url: { type: "STRING" },
          tabIds: { type: "ARRAY", items: { type: "STRING" } },
          groups: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING" },
                tabIds: { type: "ARRAY", items: { type: "STRING" } },
              },
              required: ["name", "tabIds"],
            },
          },
        },
        required: ["type"],
      },
    },
  },
  required: ["reply", "actions"],
};


function normalizeUsername(value) {
  return safeText(value, 40).trim().toLowerCase();
}

function validUsername(value) {
  return /^[a-z0-9._-]{3,24}$/.test(value);
}

function randomBytes(size = 16) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytes;
}

function bytesFromBase64Url(value) {
  const text = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = text + "=".repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function derivePassword(password, salt, iterations = PBKDF2_ITERATIONS) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(String(password || "")),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256
  );
  return new Uint8Array(bits);
}

function constantTimeEqual(a, b) {
  if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array) || a.length !== b.length) return false;
  if (typeof crypto?.subtle?.timingSafeEqual === "function") {
    try { return crypto.subtle.timingSafeEqual(a, b); } catch { /* fallback abaixo */ }
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

function sessionToken() {
  return `${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "")}`;
}

function bearerToken(request) {
  const header = request.headers.get("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : "";
}

function normalizeRecoveryCode(value) {
  return safeText(value, 120).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function generateRecoveryCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(20);
  let text = "";
  for (const byte of bytes) text += alphabet[byte % alphabet.length];
  return `MM-${text.match(/.{1,4}/g).join("-")}`;
}

async function recoveryDigest(code, salt) {
  const normalized = normalizeRecoveryCode(code);
  const material = new TextEncoder().encode(`${base64UrlBytes(salt)}:${normalized}`);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", material));
}


async function fetchLegacyOfficialDownloadTotal() {
  const releases = [];
  for (let page = 1; page <= 10; page += 1) {
    const response = await fetch(`${OFFICIAL_RELEASES_API}?per_page=100&page=${page}`, {
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": "MarshMallow-Download-Counter/5.0.2",
      },
    });
    if (!response.ok) throw new Error(`GitHub releases HTTP ${response.status}`);
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error("GitHub releases response is not an array");
    releases.push(...batch);
    if (batch.length < 100) break;
  }
  return sumLegacyOfficialDownloads(releases);
}

async function resolveOfficialInstallerDownload() {
  const response = await fetch(`${OFFICIAL_RELEASE_METADATA_URL}?t=${Date.now()}`, {
    headers: { accept: "application/json", "cache-control": "no-cache" },
  });
  if (!response.ok) throw new Error(`release.json HTTP ${response.status}`);
  const meta = await response.json();
  const target = String(meta?.url || "");
  if (meta?.available !== true || !isOfficialGithubInstallerUrl(target)) {
    throw new Error("release.json does not expose a valid official installer");
  }
  return target;
}

async function downloadCounterStub(env) {
  if (!env.DOWNLOAD_COUNTER) return null;
  return env.DOWNLOAD_COUNTER.getByName(DOWNLOAD_COUNTER_NAME);
}

export class AccountStore extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.authFailures = new Map();
  }

  authThrottleKey(request, username) {
    const ip = safeText(request.headers.get("cf-connecting-ip") || "unknown", 80);
    return `${ip}:${safeText(username, 40)}`;
  }

  authThrottleState(request, username) {
    const key = this.authThrottleKey(request, username);
    const now = Date.now();
    const item = this.authFailures.get(key);
    if (!item || now - item.since > 15 * 60 * 1000) {
      if (item) this.authFailures.delete(key);
      return { key, now, item: null };
    }
    return { key, now, item };
  }

  isAuthThrottled(request, username) {
    const { item } = this.authThrottleState(request, username);
    return Boolean(item && item.count >= 8);
  }

  recordAuthFailure(request, username) {
    const { key, now, item } = this.authThrottleState(request, username);
    this.authFailures.set(key, item ? { count: item.count + 1, since: item.since } : { count: 1, since: now });
    if (this.authFailures.size > 1500) {
      for (const [k, value] of this.authFailures) if (now - value.since > 15 * 60 * 1000) this.authFailures.delete(k);
    }
  }

  clearAuthFailures(request, username) { this.authFailures.delete(this.authThrottleKey(request, username)); }

  async issueSession(username) {
    const token = sessionToken();
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    await this.ctx.storage.put(`session:${token}`, { username, expiresAt });
    return { token, expiresAt };
  }

  async clearSessionsFor(username) {
    const sessions = await this.ctx.storage.list({ prefix: "session:" });
    const keys = [];
    for (const [key, value] of sessions) {
      if (value?.username === username) keys.push(key);
    }
    for (const key of keys) await this.ctx.storage.delete(key);
  }

  async profile(username) {
    const user = await this.ctx.storage.get(`user:${username}`);
    if (!user) return null;
    return { username: user.username, displayName: user.displayName, createdAt: user.createdAt, provider: "local" };
  }

  async runSelfTest() {
    const salt = randomBytes(16);
    const hash = await derivePassword("MarshMallow-self-test", salt);
    if (!(hash instanceof Uint8Array) || hash.length !== 32) throw new Error("Falha no autoteste PBKDF2.");

    const recoveryCode = generateRecoveryCode();
    const recoverySalt = randomBytes(16);
    const recoveryHash = await recoveryDigest(recoveryCode, recoverySalt);
    const recoveryCheck = await recoveryDigest(recoveryCode, recoverySalt);
    if (!constantTimeEqual(recoveryHash, recoveryCheck)) throw new Error("Falha no autoteste do código de recuperação.");

    const marker = crypto.randomUUID().replace(/-/g, "");
    const userKey = `selftest-user:${marker}`;
    const sessionKey = `selftest-session:${marker}`;
    try {
      await this.ctx.storage.put(userKey, {
        username: `selftest-${marker.slice(0, 8)}`,
        displayName: "Self Test",
        salt: base64UrlBytes(salt),
        hash: base64UrlBytes(hash),
        passwordKdf: "PBKDF2-SHA256",
        passwordIterations: PBKDF2_ITERATIONS,
        recoverySalt: base64UrlBytes(recoverySalt),
        recoveryHash: base64UrlBytes(recoveryHash),
        createdAt: Date.now(),
      });
      await this.ctx.storage.put(sessionKey, { username: "selftest", expiresAt: Date.now() + 60_000 });
      const storedUser = await this.ctx.storage.get(userKey);
      const storedSession = await this.ctx.storage.get(sessionKey);
      if (!storedUser?.hash || !storedSession?.expiresAt) throw new Error("Falha no autoteste de armazenamento.");
    } finally {
      await this.ctx.storage.delete(userKey).catch(() => undefined);
      await this.ctx.storage.delete(sessionKey).catch(() => undefined);
    }

    return { ok: true, service: "MarshMallow AccountStore", crypto: "PBKDF2-SHA256", iterations: PBKDF2_ITERATIONS, recovery: "SHA-256", storage: "ok", registry: ACCOUNT_REGISTRY };
  }

  async handleFetch(request) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api\/auth/, "");

    if (request.method === "GET" && path === "/ping") {
      return json(await this.runSelfTest());
    }

    if (request.method === "POST" && path === "/register") {
      let body;
      try { body = await readJsonLimited(request, MAX_AUTH_BODY); } catch (error) { return error?.code === "BODY_TOO_LARGE" ? json({ error: "Dados de cadastro grandes demais." }, 413) : json({ error: "Dados de cadastro inválidos." }, 400); }
      const username = normalizeUsername(body?.username);
      const displayName = safeText(body?.displayName, 36).trim();
      const password = String(body?.password || "");
      if (!validUsername(username)) return json({ error: "Use 3 a 24 caracteres no usuário: letras minúsculas, números, ponto, _ ou -." }, 400);
      if (displayName.length < 2) return json({ error: "Informe um nome de exibição com pelo menos 2 caracteres." }, 400);
      if (password.length < 8 || password.length > 1024) return json({ error: "A senha precisa ter entre 8 e 1024 caracteres." }, 400);
      const existing = await this.ctx.storage.get(`user:${username}`);
      if (existing) return json({ error: "Este nome de usuário já está em uso." }, 409);

      const salt = randomBytes(16);
      const hash = await derivePassword(password, salt);
      const recoveryCode = generateRecoveryCode();
      const recoverySalt = randomBytes(16);
      const recoveryHash = await recoveryDigest(recoveryCode, recoverySalt);
      const createdAt = Date.now();
      await this.ctx.storage.put(`user:${username}`, {
        username,
        displayName,
        salt: base64UrlBytes(salt),
        hash: base64UrlBytes(hash),
        passwordKdf: "PBKDF2-SHA256",
        passwordIterations: PBKDF2_ITERATIONS,
        recoverySalt: base64UrlBytes(recoverySalt),
        recoveryHash: base64UrlBytes(recoveryHash),
        createdAt,
        passwordUpdatedAt: createdAt,
      });
      const session = await this.issueSession(username);
      return json({ ok: true, profile: { username, displayName, createdAt, provider: "local" }, recoveryCode, ...session });
    }

    if (request.method === "POST" && path === "/login") {
      let body;
      try { body = await readJsonLimited(request, MAX_AUTH_BODY); } catch (error) { return error?.code === "BODY_TOO_LARGE" ? json({ error: "Dados de login grandes demais." }, 413) : json({ error: "Dados de login inválidos." }, 400); }
      const username = normalizeUsername(body?.username);
      const password = String(body?.password || "");
      if (password.length > 1024) return json({ error: "Usuário ou senha incorretos." }, 401);
      if (this.isAuthThrottled(request, username)) return json({ error: "Muitas tentativas de login. Aguarde alguns minutos." }, 429);
      const user = validUsername(username) ? await this.ctx.storage.get(`user:${username}`) : null;
      if (!user) { this.recordAuthFailure(request, username); return json({ error: "Usuário ou senha incorretos." }, 401); }
      const expected = bytesFromBase64Url(user.hash);
      const actual = await derivePassword(password, bytesFromBase64Url(user.salt), Number(user.passwordIterations || LEGACY_PBKDF2_ITERATIONS));
      if (!constantTimeEqual(expected, actual)) { this.recordAuthFailure(request, username); return json({ error: "Usuário ou senha incorretos." }, 401); }
      this.clearAuthFailures(request, username);
      const session = await this.issueSession(username);
      return json({ ok: true, profile: { username, displayName: user.displayName, createdAt: user.createdAt, provider: "local" }, ...session });
    }

    if (request.method === "POST" && path === "/recover") {
      let body;
      try { body = await readJsonLimited(request, MAX_AUTH_BODY); } catch (error) { return error?.code === "BODY_TOO_LARGE" ? json({ error: "Dados de recuperação grandes demais." }, 413) : json({ error: "Dados de recuperação inválidos." }, 400); }
      const username = normalizeUsername(body?.username);
      const code = normalizeRecoveryCode(body?.recoveryCode);
      const newPassword = String(body?.newPassword || "");
      if (!validUsername(username) || code.length < 12) return json({ error: "Usuário ou código de recuperação inválidos." }, 400);
      if (newPassword.length < 8 || newPassword.length > 1024) return json({ error: "A nova senha precisa ter entre 8 e 1024 caracteres." }, 400);
      const user = await this.ctx.storage.get(`user:${username}`);
      if (!user?.recoveryHash || !user?.recoverySalt) return json({ error: "Usuário ou código de recuperação inválidos." }, 401);

      const expected = bytesFromBase64Url(user.recoveryHash);
      const actual = await recoveryDigest(code, bytesFromBase64Url(user.recoverySalt));
      if (!constantTimeEqual(expected, actual)) return json({ error: "Usuário ou código de recuperação inválidos." }, 401);

      const salt = randomBytes(16);
      const hash = await derivePassword(newPassword, salt);
      const nextRecoveryCode = generateRecoveryCode();
      const nextRecoverySalt = randomBytes(16);
      const nextRecoveryHash = await recoveryDigest(nextRecoveryCode, nextRecoverySalt);
      const updated = {
        ...user,
        salt: base64UrlBytes(salt),
        hash: base64UrlBytes(hash),
        passwordKdf: "PBKDF2-SHA256",
        passwordIterations: PBKDF2_ITERATIONS,
        recoverySalt: base64UrlBytes(nextRecoverySalt),
        recoveryHash: base64UrlBytes(nextRecoveryHash),
        passwordUpdatedAt: Date.now(),
      };
      await this.ctx.storage.put(`user:${username}`, updated);
      await this.clearSessionsFor(username);
      const session = await this.issueSession(username);
      return json({
        ok: true,
        profile: { username, displayName: user.displayName, createdAt: user.createdAt, provider: "local" },
        recoveryCode: nextRecoveryCode,
        ...session,
      });
    }

    if (request.method === "GET" && path === "/session") {
      const token = bearerToken(request);
      if (!token) return json({ error: "Sessão ausente." }, 401);
      const session = await this.ctx.storage.get(`session:${token}`);
      if (!session || Number(session.expiresAt || 0) < Date.now()) {
        if (session) await this.ctx.storage.delete(`session:${token}`);
        return json({ error: "Sessão expirada." }, 401);
      }
      const profile = await this.profile(session.username);
      if (!profile) return json({ error: "Conta não encontrada." }, 404);
      return json({ ok: true, profile, expiresAt: session.expiresAt });
    }

    if (request.method === "POST" && path === "/logout") {
      const token = bearerToken(request);
      if (token) await this.ctx.storage.delete(`session:${token}`);
      return json({ ok: true });
    }

    return json({ error: "Rota de conta não encontrada." }, 404);
  }

  async fetch(request) {
    try {
      return await this.handleFetch(request);
    } catch (error) {
      const detail = safeText(error?.message || error, 500) || "Erro desconhecido do AccountStore.";
      console.error(`[AccountStore:v3.4.0] ${request.method} ${new URL(request.url).pathname}: ${detail}`);
      return json({ ok: false, error: "Falha interna do serviço de contas.", code: "ACCOUNT_STORE_EXCEPTION" }, 500);
    }
  }
}

function weatherCodePt(code) {
  const map = {
    0: "céu limpo", 1: "predominantemente limpo", 2: "parcialmente nublado", 3: "nublado",
    45: "neblina", 48: "neblina com geada", 51: "garoa fraca", 53: "garoa moderada", 55: "garoa forte",
    61: "chuva fraca", 63: "chuva moderada", 65: "chuva forte", 71: "neve fraca", 73: "neve moderada", 75: "neve forte",
    80: "pancadas de chuva fracas", 81: "pancadas de chuva moderadas", 82: "pancadas de chuva fortes",
    95: "trovoadas", 96: "trovoadas com granizo", 99: "trovoadas fortes com granizo"
  };
  return map[Number(code)] || "condições variáveis";
}

function weatherLocationFromPrompt(prompt) {
  const text = safeText(prompt, 500).trim();
  const patterns = [
    /previs[aã]o\s+do\s+tempo(?:\s+(?:em|para))?\s*[,\-:]?\s*([^?!.]+)/i,
    /tempo\s+(?:em|para)\s+([^?!.]+)/i,
    /clima\s+(?:em|para)\s+([^?!.]+)/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

async function answerWeather(prompt) {
  const location = weatherLocationFromPrompt(prompt);
  if (!location) return null;
  const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=pt&format=json`);
  if (!geo.ok) throw new Error("WEATHER_GEOCODING_FAILED");
  const geoData = await geo.json();
  const place = geoData?.results?.[0];
  if (!place) return { reply: `Não encontrei “${safeText(location, 80)}”. Tente informar cidade e estado/país.`, actions: [] };
  const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
  forecastUrl.searchParams.set("latitude", String(place.latitude));
  forecastUrl.searchParams.set("longitude", String(place.longitude));
  forecastUrl.searchParams.set("current", "temperature_2m,apparent_temperature,weather_code,wind_speed_10m");
  forecastUrl.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max");
  forecastUrl.searchParams.set("timezone", "auto");
  forecastUrl.searchParams.set("forecast_days", "3");
  const response = await fetch(forecastUrl.toString());
  if (!response.ok) throw new Error("WEATHER_FORECAST_FAILED");
  const data = await response.json();
  const current = data.current || {};
  const daily = data.daily || {};
  const name = [place.name, place.admin1, place.country].filter(Boolean).join(", ");
  const days = Array.isArray(daily.time) ? daily.time.slice(0, 3).map((date, i) => {
    const label = i === 0 ? "Hoje" : i === 1 ? "Amanhã" : new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short" });
    const max = Math.round(Number(daily.temperature_2m_max?.[i]));
    const min = Math.round(Number(daily.temperature_2m_min?.[i]));
    const rain = Number(daily.precipitation_probability_max?.[i] || 0);
    return `${label}: ${weatherCodePt(daily.weather_code?.[i])}, ${min}–${max} °C, chuva até ${Math.round(rain)}%`;
  }) : [];
  const nowText = Number.isFinite(Number(current.temperature_2m))
    ? `Agora em ${name}: ${Math.round(Number(current.temperature_2m))} °C (sensação ${Math.round(Number(current.apparent_temperature))} °C), ${weatherCodePt(current.weather_code)}, vento ${Math.round(Number(current.wind_speed_10m || 0))} km/h.`
    : `Previsão para ${name}.`;
  return { reply: `${nowText}\n${days.join("\n")}`, actions: [] };
}

function parseWorkersAiOutput(result) {
  const direct = result?.reply ?? result?.answer;
  if (direct != null) {
    return { reply: aiReplyText(direct) || "Não recebi resposta do modelo.", actions: validActions(result?.actions) };
  }

  const raw = result?.response ?? result?.result?.response ?? result?.text ?? result?.result?.text ?? "";
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const structuredReply = raw.reply ?? raw.answer ?? raw.text ?? raw.content ?? raw.message;
    if (structuredReply != null || Array.isArray(raw.actions)) {
      return { reply: aiReplyText(structuredReply) || "Não recebi resposta do modelo.", actions: validActions(raw.actions) };
    }
  }

  const text = aiReplyText(raw, 16000).trim();
  if (!text) return { reply: "Não recebi resposta do modelo.", actions: [] };

  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try {
      const parsed = JSON.parse(cleaned.slice(first, last + 1));
      return {
        reply: aiReplyText(parsed?.reply ?? parsed?.answer ?? parsed?.text) || cleaned,
        actions: validActions(parsed?.actions),
      };
    } catch {}
  }
  return { reply: cleaned, actions: [] };
}

async function callWorkersAI(env, body) {
  if (!env.AI) throw new Error("WORKERS_AI_NOT_CONFIGURED");
  const prompt = `${buildAiPrompt(body)}\n\nResponda SOMENTE com JSON válido no formato {"reply":"texto","actions":[]}. O campo reply DEVE ser uma string de texto, nunca um objeto ou array. Se não houver ação, use actions vazio.`;
  const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fast", {
    messages: [
      { role: "system", content: "Você é a IA do navegador MarshMallow. Responda em português do Brasil e obedeça estritamente às permissões e ações tipadas. O criador e desenvolvedor oficial do MarshMallow é Deivison Santos (@devsaex); nunca atribua essa autoria a outra pessoa." },
      { role: "user", content: prompt },
    ],
    max_tokens: 1800,
  });
  const parsed = parseWorkersAiOutput(result);
  return { ...parsed, provider: "cloudflare-workers-ai", model: "@cf/meta/llama-3.1-8b-instruct-fast" };
}

async function callGemini(env, body, model) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: buildAiPrompt(body) }] }],
      generationConfig: {
        maxOutputTokens: 1800,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`Gemini ${response.status}: ${detail.slice(0, 400)}`);
    error.status = response.status;
    throw error;
  }
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
  const parsed = JSON.parse(text || "{}");
  return { reply: aiReplyText(parsed?.reply ?? parsed?.answer ?? parsed?.text) || "Concluído.", actions: validActions(parsed?.actions), provider: "gemini", model };
}

function answerMarshMallowIdentity(prompt) {
  const normalized = safeText(prompt, 5000)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (!normalized.includes("marshmallow")) return null;
  const asksCreator = /(criador|criou|criacao|desenvolvedor|desenvolveu|desenvolvimento|autor|autoria|quem fez|quem criou|quem desenvolveu)/.test(normalized);
  if (!asksCreator) return null;
  return {
    reply: `O criador e desenvolvedor do MarshMallow é ${MARSHMALLOW_CREATOR} (${MARSHMALLOW_CREATOR_HANDLE}).`,
    actions: [],
    provider: "marshmallow-core",
    model: "project-identity"
  };
}

async function handleAi(request, env) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_AI_BODY) return json({ error: "Pedido muito grande." }, 413);

  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const limiter = env.AI_LIMITER.get(env.AI_LIMITER.idFromName(ip));
  const limit = await limiter.fetch("https://limiter/check", { method: "POST" });
  if (!limit.ok) return json({ error: "Muitas solicitações. Tente novamente em alguns minutos." }, 429);

  let body;
  try { body = await readJsonLimited(request, MAX_AI_BODY); } catch (error) { return error?.code === "BODY_TOO_LARGE" ? json({ error: "Pedido muito grande." }, 413) : json({ error: "JSON inválido." }, 400); }
  if (!body?.prompt || typeof body.prompt !== "string") return json({ error: "prompt ausente." }, 400);

  const projectIdentity = answerMarshMallowIdentity(body.prompt);
  if (projectIdentity) return json(projectIdentity);

  try {
    const weather = await answerWeather(body.prompt);
    if (weather) return json(weather);
  } catch (error) {
    // Se o serviço meteorológico falhar, seguimos para o modelo geral.
  }

  let geminiError = null;
  let workersError = null;

  // Quando a chave do proprietário está configurada, Gemini é o provedor principal.
  // A chave permanece como Secret do Worker e nunca é enviada para o navegador dos usuários.
  if (env.GEMINI_API_KEY) {
    const model = env.GEMINI_MODEL || DEFAULT_MODEL;
    try {
      return json(await callGemini(env, body, model));
    } catch (error) {
      geminiError = error;
      if (model !== FALLBACK_MODEL && [400, 404, 429, 500, 503].includes(Number(error?.status))) {
        try { return json(await callGemini(env, body, FALLBACK_MODEL)); } catch (fallbackError) { geminiError = fallbackError; }
      }
    }
  }

  // Workers AI continua disponível como fallback gratuito e também funciona sozinho.
  if (env.AI) {
    try {
      return json(await callWorkersAI(env, body));
    } catch (error) {
      workersError = error;
    }
  }

  console.error("[AI] Provedores indisponíveis", {
    gemini: safeText(geminiError?.message || "", 500),
    workers: safeText(workersError?.message || "", 500),
  });
  return json({
    error: "A IA está temporariamente indisponível.",
    providers: { gemini: Boolean(env.GEMINI_API_KEY), workersAi: Boolean(env.AI) }
  }, 502);
}


export class DownloadCounter extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
  }

  async state() {
    const existing = await this.ctx.storage.get("state");
    if (existing && Number.isFinite(Number(existing.total))) return existing;
    const legacyBaseline = await fetchLegacyOfficialDownloadTotal();
    const initial = {
      total: Math.max(0, Math.floor(Number(legacyBaseline) || 0)),
      legacyBaseline: Math.max(0, Math.floor(Number(legacyBaseline) || 0)),
      initializedAt: Date.now(),
      updatedAt: Date.now(),
    };
    await this.ctx.storage.put("state", initial);
    return initial;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/count" && request.method === "GET") {
      const state = await this.state();
      return json({ ok: true, total: state.total, legacyBaseline: state.legacyBaseline, updatedAt: state.updatedAt });
    }
    if (url.pathname === "/increment" && request.method === "POST") {
      const state = await this.state();
      const next = { ...state, total: Math.max(0, Math.floor(Number(state.total) || 0)) + 1, updatedAt: Date.now() };
      await this.ctx.storage.put("state", next);
      return json({ ok: true, total: next.total, legacyBaseline: next.legacyBaseline, updatedAt: next.updatedAt });
    }
    return json({ ok: false, error: "Download counter route not found." }, 404);
  }
}

export class AiRateLimiter extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.windowStart = Date.now();
    this.count = 0;
  }

  async fetch() {
    const now = Date.now();
    if (now - this.windowStart > 60 * 60 * 1000) {
      this.windowStart = now;
      this.count = 0;
    }
    this.count += 1;
    return new Response(null, { status: this.count <= 60 ? 204 : 429 });
  }
}

export class WatchRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.latestMedia = null;
    this.activeStreamSourceId = "";
    this.activeStreamId = "";
    this.recentChatIds = new Set();
    this.recentChatOrder = [];
    this.chatHistory = [];
    this.chatHistoryLoaded = false;
    this.latestHostStatus = null;
  }

  async armExpiry() {
    try { await this.ctx.storage.setAlarm(Date.now() + WATCH_ROOM_IDLE_TTL_MS); } catch {}
  }

  async alarm() {
    // Enquanto existir alguém conectado, a sala continua viva. Quando ficar
    // abandonada, o próximo alarme remove tokens, histórico e estado persistido.
    if (this.ctx.getWebSockets().length > 0) {
      await this.armExpiry();
      return;
    }
    await this.ctx.storage.deleteAll();
    this.latestMedia = null;
    this.activeStreamSourceId = "";
    this.activeStreamId = "";
    this.recentChatIds.clear();
    this.recentChatOrder = [];
    this.chatHistory = [];
    this.chatHistoryLoaded = true;
    this.latestHostStatus = null;
  }

  async ensureChatHistory() {
    if (this.chatHistoryLoaded) return;
    this.chatHistoryLoaded = true;
    const stored = await this.ctx.storage.get("chatHistory");
    this.chatHistory = Array.isArray(stored) ? stored.slice(-50) : [];
    for (const item of this.chatHistory) {
      const id = safeText(item?.id || item?.messageId, 120);
      if (id) this.recentChatIds.add(id);
    }
  }

  async emitChat({ id, name, role, text }) {
    await this.ensureChatHistory();
    const messageId = safeText(id, 120) || crypto.randomUUID();
    if (this.recentChatIds.has(messageId)) return false;

    this.recentChatIds.add(messageId);
    this.recentChatOrder.push(messageId);
    while (this.recentChatOrder.length > 500) {
      const old = this.recentChatOrder.shift();
      if (old) this.recentChatIds.delete(old);
    }

    const message = {
      type: "chat",
      id: messageId,
      messageId,
      name: safeText(name, 40) || "Participante",
      role: role === "host" ? "host" : "guest",
      text: safeText(text, 1200),
      at: Date.now(),
    };

    this.chatHistory.push(message);
    if (this.chatHistory.length > 50) this.chatHistory.splice(0, this.chatHistory.length - 50);

    // Entrega primeiro; persistência logo depois. O polling HTTP garante
    // recuperação caso algum WebSocket estivesse reconectando.
    this.broadcast(message);
    try { await this.ctx.storage.put("chatHistory", this.chatHistory); } catch {}
    return true;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/init" && request.method === "POST") {
      let body;
      try { body = await readJsonLimited(request, MAX_CHAT_BODY); } catch (error) { return error?.code === "BODY_TOO_LARGE" ? json({ ok:false, error:"Dados da sala grandes demais." }, 413) : json({ ok:false, error:"JSON inválido." }, 400); }
      const existing = await this.ctx.storage.get("hostToken");
      if (!existing) await this.ctx.storage.put("hostToken", safeText(body.hostToken, 120));
      const existingChat = await this.ctx.storage.get("chatToken");
      if (!existingChat) await this.ctx.storage.put("chatToken", safeText(body.chatToken, 120));
      await this.armExpiry();
      return new Response(null, { status: 204 });
    }

    if (url.pathname === "/verify-host" && request.method === "POST") {
      let body;
      try { body = await readJsonLimited(request, MAX_CHAT_BODY); } catch (error) { return error?.code === "BODY_TOO_LARGE" ? json({ ok:false, error:"Dados grandes demais." }, 413) : json({ ok:false, error:"JSON inválido." }, 400); }
      const expected = await this.ctx.storage.get("hostToken");
      const supplied = safeText(body.hostToken, 120);
      return json({ ok: !!(expected && supplied && expected === supplied) }, 200);
    }

    if (url.pathname === "/chat-history" && request.method === "GET") {
      await this.ensureChatHistory();
      return json({ ok:true, messages:this.chatHistory.slice(-50) });
    }

    if (url.pathname === "/chat" && request.method === "POST") {
      let body;
      try { body = await readJsonLimited(request, MAX_CHAT_BODY); } catch (error) { return error?.code === "BODY_TOO_LARGE" ? json({ ok:false, error:"Mensagem grande demais." }, 413) : json({ ok:false, error:"JSON inválido." }, 400); }
      const expectedChat = await this.ctx.storage.get("chatToken");
      const expectedHost = await this.ctx.storage.get("hostToken");
      const suppliedChat = safeText(body.chatToken, 120);
      const suppliedHost = safeText(body.hostToken, 120);
      const authorized =
        (!!expectedChat && !!suppliedChat && expectedChat === suppliedChat) ||
        (!!expectedHost && !!suppliedHost && expectedHost === suppliedHost);
      if (!authorized) {
        return json({ ok:false, error:"Chat do host não autorizado." }, 403);
      }
      const text = safeText(body.text, 1200).trim();
      if (!text) return json({ ok:false, error:"Mensagem vazia." }, 400);
      await this.emitChat({
        id: safeText(body.messageId, 120),
        name: safeText(body.name, 40) || "Host",
        role: "host",
        text,
      });
      await this.armExpiry();
      return json({ ok:true });
    }

    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") return new Response("WebSocket required", { status: 426 });
    if (this.ctx.getWebSockets().length >= MAX_ROOM_SOCKETS) return json({ ok:false, error:"Sala cheia." }, 429);

    const hostToken = await this.ctx.storage.get("hostToken");
    const suppliedToken = url.searchParams.get("token") || "";
    const role = suppliedToken && hostToken && suppliedToken === hostToken ? "host" : "guest";
    const name = safeText(url.searchParams.get("name") || (role === "host" ? "Host" : "Convidado"), 40);

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const id = crypto.randomUUID();
    server.serializeAttachment({ id, name, role });
    this.ctx.acceptWebSocket(server);
    await this.armExpiry();

    await this.ensureChatHistory();
    server.send(JSON.stringify({ type: "welcome", id, role, name }));
    if (this.chatHistory.length) {
      server.send(JSON.stringify({ type:"chat-history", messages:this.chatHistory }));
    }
    if (this.latestHostStatus) {
      server.send(JSON.stringify(this.latestHostStatus));
    }
    if (role !== "host") server.send(JSON.stringify({ type: "host-auth-required" }));
    if (this.latestMedia) server.send(JSON.stringify({ type: "media", state: this.latestMedia }));
    if (role === "host") {
      this.broadcast({ type: "host-ready", hostId: id }, server);
    } else {
      const hasHost = this.ctx.getWebSockets().some((socket) => (socket.deserializeAttachment() || {}).role === "host");
      if (hasHost) server.send(JSON.stringify({ type: "host-ready" }));
      if (this.activeStreamId) {
        server.send(JSON.stringify({
          type: "stream-started",
          sourceId: this.activeStreamSourceId,
          streamId: this.activeStreamId,
          at: Date.now()
        }));
      }
    }
    this.broadcastPresence();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    const attachment = ws.deserializeAttachment() || { id: "", name: "Convidado", role: "guest" };
    const textRaw = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
    if (new TextEncoder().encode(textRaw).byteLength > MAX_WS_MESSAGE_BYTES) { try { ws.close(1009, "Mensagem grande demais"); } catch {} return; }
    let data;
    try { data = JSON.parse(textRaw); } catch { return; }

    if (data?.type === "host-auth") {
      const expectedToken = await this.ctx.storage.get("hostToken");
      const supplied = safeText(data.hostToken, 120);
      if (expectedToken && supplied && supplied === expectedToken) {
        const promoted = { ...attachment, role: "host", name: attachment.name || "Host" };
        ws.serializeAttachment(promoted);
        try { ws.send(JSON.stringify({ type: "host-auth-ok", id: promoted.id })); } catch {}
        this.broadcast({ type: "host-ready", hostId: promoted.id }, ws);
        this.broadcastPresence();
      } else {
        try { ws.send(JSON.stringify({ type: "host-auth-failed" })); } catch {}
      }
      return;
    }

    if (data?.type === "chat") {
      const text = safeText(data.text, 1200).trim();
      if (!text) return;
      await this.emitChat({
        id: safeText(data.messageId, 120),
        name: attachment.name,
        role: attachment.role,
        text,
      });
      return;
    }


    if (data?.type === "host-status" && attachment.role === "host") {
      const status = {
        type:"host-status",
        status:safeText(data.status,80),
        reason:safeText(data.reason,500),
        strategy:safeText(data.strategy,80),
        trackKinds:Array.isArray(data.trackKinds) ? data.trackKinds.map((item)=>safeText(item,20)).slice(0,4) : [],
        hasAudio:data.hasAudio === true,
        at:Date.now(),
      };
      this.latestHostStatus=status;
      this.broadcast(status,ws);
      return;
    }


    if (data?.type === "debug-host" && attachment.role === "host" && data.debug && typeof data.debug === "object") {
      this.broadcast({ type: "host-debug", debug: data.debug }, ws);
      return;
    }

    if (data?.type === "stream-start" && attachment.role === "host") {
      this.activeStreamSourceId = safeText(data.sourceId, 120);
      this.activeStreamId = safeText(data.streamId, 160) || crypto.randomUUID();
      this.broadcast({
        type: "stream-started",
        sourceId: this.activeStreamSourceId,
        streamId: this.activeStreamId,
        at: Date.now(),
      }, ws);
      return;
    }

    if (data?.type === "stream-heartbeat" && attachment.role === "host") {
      const streamId = safeText(data.streamId, 160);
      if (!streamId || streamId !== this.activeStreamId) return;
      this.broadcast({
        type: "stream-heartbeat",
        sourceId: this.activeStreamSourceId,
        streamId: this.activeStreamId,
        at: Date.now(),
      }, ws);
      return;
    }

    if (data?.type === "stream-end" && attachment.role === "host") {
      const endedId = safeText(data.streamId, 160);
      if (endedId && this.activeStreamId && endedId !== this.activeStreamId) return;

      const endedSource = safeText(data.sourceId, 120) || this.activeStreamSourceId || "";
      const finalStreamId = this.activeStreamId || endedId || "";
      this.activeStreamSourceId = "";
      this.activeStreamId = "";
      this.broadcast({
        type: "stream-ended",
        sourceId: endedSource,
        streamId: finalStreamId,
        reason: safeText(data.reason, 80) || "stopped",
        at: Date.now(),
      }, ws);
      return;
    }

    if (data?.type === "session-end" && attachment.role === "host") {
      this.latestMedia = null;
      this.activeStreamSourceId = "";
      this.broadcast({ type: "host-ended", hostId: attachment.id, reason: "ended", at: Date.now() }, ws);
      return;
    }

    if (data?.type === "rtc-ready" && attachment.role === "guest" && attachment.id) {
      // WebRTC só existe quando o host iniciou explicitamente getDisplayMedia().
      // media-state/blob:/iframes nunca mais disparam negociação P2P.
      if (!this.activeStreamSourceId || !this.activeStreamId) {
        this.sendToId(attachment.id, { type: "rtc-no-stream" });
        return;
      }

      this.sendToRole("host", {
        type: "rtc-ready",
        guestId: attachment.id,
        preferredSourceId: this.activeStreamSourceId,
      });
      return;
    }

    if (data?.type === "rtc" && data.signal && typeof data.signal === "object") {
      const targetId = safeText(data.targetId, 80);
      if (!targetId) return;
      this.sendToId(targetId, {
        type: "rtc",
        fromId: attachment.id,
        fromRole: attachment.role,
        sourceId: safeText(data.sourceId, 120),
        signal: data.signal,
      });
      return;
    }

    if (data?.type === "media" && attachment.role === "host" && data.state && typeof data.state === "object") {
      this.latestMedia = {
        pageUrl: safeText(data.state.pageUrl, 2500),
        frameUrl: safeText(data.state.frameUrl, 2500),
        mediaUrl: safeText(data.state.mediaUrl, 6000),
        reusableMediaUrl: safeText(data.state.reusableMediaUrl, 6000),
        reusableMediaKey: safeText(data.state.reusableMediaKey, 6000),
        reusableMediaKind: safeText(data.state.reusableMediaKind, 40),
        mediaType: safeText(data.state.mediaType, 80),
        poster: safeText(data.state.poster, 2500),
        pageTitle: safeText(data.state.pageTitle, 300),
        currentTime: Number(data.state.currentTime || 0),
        paused: !!data.state.paused,
        playbackRate: Number(data.state.playbackRate || 1),
        duration: Number(data.state.duration || 0),
        readyState: Number(data.state.readyState || 0),
        rtcSourceId: safeText(data.state.rtcSourceId, 120),
        mediaLeaderId: safeText(data.state.mediaLeaderId || data.state.rtcSourceId, 120),
        mediaLeaderSequence: Number(data.state.mediaLeaderSequence || 0),
        syncReason: safeText(data.state.syncReason, 40) || "heartbeat",
        syncSequence: Number(data.state.syncSequence || 0),
      };
      this.broadcast({ type: "media", state: this.latestMedia }, ws);
    }
  }

  webSocketClose(ws) {
    const attachment = ws?.deserializeAttachment?.() || {};
    if (attachment.role === "host") {
      this.latestMedia = null;
      this.broadcast({ type: "host-ended", hostId: attachment.id || "", reason: "disconnected", at: Date.now() }, ws);
    }
    if (attachment.id) this.broadcast({ type: "rtc-peer-left", peerId: attachment.id }, ws);
    this.broadcastPresence();
  }
  webSocketError(ws) {
    const attachment = ws?.deserializeAttachment?.() || {};
    if (attachment.role === "host") {
      this.latestMedia = null;
      this.broadcast({ type: "host-ended", hostId: attachment.id || "", reason: "error", at: Date.now() }, ws);
    }
    if (attachment.id) this.broadcast({ type: "rtc-peer-left", peerId: attachment.id }, ws);
    this.broadcastPresence();
  }

  sendToId(id, payload) {
    const text = JSON.stringify(payload);
    for (const socket of this.ctx.getWebSockets()) {
      const peer = socket.deserializeAttachment() || {};
      if (peer.id !== id) continue;
      try { socket.send(text); } catch {}
      return;
    }
  }

  sendToRole(role, payload) {
    const text = JSON.stringify(payload);
    for (const socket of this.ctx.getWebSockets()) {
      const peer = socket.deserializeAttachment() || {};
      if (peer.role !== role) continue;
      try { socket.send(text); } catch {}
    }
  }

  broadcast(payload, except = null) {
    const text = JSON.stringify(payload);
    for (const socket of this.ctx.getWebSockets()) {
      if (except && socket === except) continue;
      try { socket.send(text); } catch { /* conexão fechando */ }
    }
  }

  broadcastPresence() {
    const people = this.ctx.getWebSockets().map((socket) => socket.deserializeAttachment() || { id: "", name: "Convidado", role: "guest" });
    this.broadcast({ type: "presence", people });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });
    if (url.pathname === "/health") return json({
      ok: true,
      service: "MarshMallow Gateway",
      backendVersion: "3.4.1",
      watchVersion: WATCH_WEB_VERSION,
      accountsConfigured: Boolean(env.ACCOUNTS),
      downloadCounterConfigured: Boolean(env.DOWNLOAD_COUNTER),
      livekitConfigured: liveKitConfigured(env),
      workersAiConfigured: Boolean(env.AI),
      geminiConfigured: Boolean(env.GEMINI_API_KEY),
      aiProvider: env.GEMINI_API_KEY ? "gemini" : (env.AI ? "cloudflare-workers-ai" : "none"),
      aiFallbackProvider: env.GEMINI_API_KEY && env.AI ? "cloudflare-workers-ai" : (env.GEMINI_API_KEY ? "none" : "gemini-not-configured"),
      model: env.GEMINI_API_KEY ? (env.GEMINI_MODEL || DEFAULT_MODEL) : (env.AI ? "@cf/meta/llama-3.1-8b-instruct-fast" : "none"),
      creator: MARSHMALLOW_CREATOR,
      creatorHandle: MARSHMALLOW_CREATOR_HANDLE
    });
    if (url.pathname === "/api/downloads/count" && request.method === "GET") {
      const stub = await downloadCounterStub(env);
      if (!stub) return json({ ok: false, error: "DownloadCounter não está vinculado ao Worker." }, 503);
      return stub.fetch("https://counter/count", { method: "GET" });
    }

    if (url.pathname === "/download/windows" && (request.method === "GET" || request.method === "HEAD")) {
      let target;
      try {
        target = await resolveOfficialInstallerDownload();
      } catch (error) {
        return json({ ok: false, error: "O instalador oficial está temporariamente indisponível.", detail: safeText(error?.message || error, 200) }, 503);
      }
      const headers = cors({ location: target, "cache-control": "no-store" });
      if (request.method === "GET" && shouldCountDownload({
        method: request.method,
        userAgent: request.headers.get("user-agent") || "",
        cookieHeader: request.headers.get("cookie") || "",
        now: Date.now(),
      })) {
        const stub = await downloadCounterStub(env);
        if (stub) {
          try { await stub.fetch("https://counter/increment", { method: "POST" }); } catch (error) { console.warn("[DownloadCounter] increment failed", error); }
        }
        headers["set-cookie"] = downloadCountCookie(Date.now());
      }
      return new Response(null, { status: 302, headers });
    }

    if (url.pathname.startsWith("/api/auth/")) {
      const authLength = Number(request.headers.get("content-length") || 0);
      if (authLength > MAX_AUTH_BODY) return json({ ok: false, error: "Requisição de autenticação grande demais." }, 413);
      if (!env.ACCOUNTS) return json({ ok: false, error: "AccountStore não está vinculado ao Worker." }, 503);
      try {
        const stub = env.ACCOUNTS.getByName(ACCOUNT_REGISTRY);
        return await stub.fetch(request);
      } catch (error) {
        const detail = safeText(error?.message || error, 500);
        const diagnostic = {
          remote: Boolean(error?.remote),
          retryable: Boolean(error?.retryable),
          overloaded: Boolean(error?.overloaded),
          name: safeText(error?.name, 120)
        };
        console.error(`[AccountStore] ${request.method} ${url.pathname}: ${detail}`, diagnostic);
        return json({ ok: false, error: "Falha interna do serviço de contas." }, 500);
      }
    }
    if (url.pathname === "/download/marshmallow-watch.zip") return extensionZipResponse();

    if (url.pathname === "/api/rooms" && request.method === "POST") {
      const room = roomCode();
      const hostToken = crypto.randomUUID();
      const chatToken = crypto.randomUUID();
      const id = env.ROOMS.idFromName(room);
      const stub = env.ROOMS.get(id);
      await stub.fetch("https://room/init", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hostToken, chatToken })
      });
      return json({ room, hostToken, chatToken, inviteUrl: `${url.origin}/join/${room}` });
    }

    if (url.pathname === "/api/livekit/token" && request.method === "POST") {
      if (!liveKitConfigured(env)) {
        return json({ ok:false, error:"LiveKit ainda não foi configurado pelo proprietário." }, 503);
      }

      let body;
      try { body = await readJsonLimited(request, MAX_AUTH_BODY); } catch (error) { return error?.code === "BODY_TOO_LARGE" ? json({ ok:false, error:"Pedido grande demais." }, 413) : json({ ok:false, error:"JSON inválido." }, 400); }
      const roomCodeValue = safeText(body.room, 16).toUpperCase();
      if (!/^[A-Z0-9]{4,16}$/.test(roomCodeValue)) {
        return json({ ok:false, error:"Sala inválida." }, 400);
      }

      const role = body.role === "host" ? "host" : "guest";
      if (role === "host") {
        const id = env.ROOMS.idFromName(roomCodeValue);
        const verify = await env.ROOMS.get(id).fetch("https://room/verify-host", {
          method:"POST",
          headers:{"content-type":"application/json"},
          body:JSON.stringify({hostToken:safeText(body.hostToken,120)})
        });
        const result = await verify.json().catch(() => ({ok:false}));
        if (!result.ok) return json({ ok:false, error:"Host não autorizado." }, 403);
      }

      const identity = `${role}-${roomCodeValue}-${crypto.randomUUID()}`;
      const liveRoom = `marshmallow-${roomCodeValue}`;
      const token = await createLiveKitToken(env, {
        room: liveRoom,
        identity,
        name: safeText(body.name, 80) || (role === "host" ? "Host" : "Convidado"),
        role,
      });

      return json({
        ok:true,
        url:safeText(env.LIVEKIT_URL,500),
        token,
        identity,
        room:liveRoom,
        role,
      });
    }

    const chatHistoryMatch = url.pathname.match(/^\/api\/room\/([A-Z0-9]{4,16})\/chat-history$/i);
    if (chatHistoryMatch && request.method === "GET") {
      const room = chatHistoryMatch[1].toUpperCase();
      const id = env.ROOMS.idFromName(room);
      return env.ROOMS.get(id).fetch("https://room/chat-history", { method:"GET" });
    }

    const chatHttpMatch = url.pathname.match(/^\/api\/room\/([A-Z0-9]{4,16})\/chat$/i);
    if (chatHttpMatch && request.method === "POST") {
      const chatLength = Number(request.headers.get("content-length") || 0);
      if (chatLength > MAX_CHAT_BODY) return json({ ok: false, error: "Mensagem grande demais." }, 413);
      const room = chatHttpMatch[1].toUpperCase();
      const id = env.ROOMS.idFromName(room);
      const bodyText = await request.text();
      return env.ROOMS.get(id).fetch("https://room/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: bodyText,
      });
    }


    const roomMatch = url.pathname.match(/^\/api\/room\/([A-Z0-9]{4,16})\/ws$/i);
    if (roomMatch) {
      const room = roomMatch[1].toUpperCase();
      const id = env.ROOMS.idFromName(room);
      return env.ROOMS.get(id).fetch(request);
    }

    const joinMatch = url.pathname.match(/^\/join\/([A-Z0-9]{4,16})$/i);
    if (joinMatch) return new Response(landingPage(joinMatch[1].toUpperCase()), { headers: cors({ "content-type": "text/html; charset=utf-8", "x-marshmallow-watch-version": WATCH_WEB_VERSION }) });

    if (url.pathname === "/api/ai" && request.method === "POST") return handleAi(request, env);
    return json({ service: "MarshMallow Gateway", ok: true, endpoints: ["/health", "/api/downloads/count", "/download/windows", "/api/auth/ping", "/api/auth/register", "/api/auth/login", "/api/auth/recover", "/api/auth/session", "/api/rooms", "/api/livekit/token", "/api/room/:room/chat", "/api/ai", "/join/:room"] });
  },
};
