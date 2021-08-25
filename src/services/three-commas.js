const { join } = require("path");
const fetch = require("node-fetch");
const { threeCommas: config } = require("../../config.json");
const { sign } = require("../utils");

// make the api object
module.exports = factory({
  getDeals: {
    method: "GET",
    path: "/ver1/deals",
    signed: true,
  },
});

/**
 * Factory function for build an object for the 3Commas API service.
 *
 * @example
 *   // example of the API definition object
 *   const definitions = {
 *     methodName: {
 *       method:"GET|POST|PUT|...",
 *       path: "/api/path",
 *       signed: true, // use a signed request
 *     }
 *   };
 *
 * @param {Object} definitions
 * @returns {Object}
 */
function factory(definitions) {
  const api = {};

  for (const [name, define] of Object.entries(definitions)) {
    const { method, path, signed } = define;
    const func = signed ? signedRequest : request;

    api[name] = func.bind(null, method, path);
  }

  return api;
}

/**
 * Makes a generic request to 3Commas API service.
 *
 * @param {string} method
 * @param {string} apiPath
 * @param {Object} [params]
 * @param {Object} [headers]
 * @returns {*}
 */
async function request(method, apiPath, params = {}, headers = {}) {
  let body = method !== "GET" ? params : undefined;
  const url = toURL(apiPath, body ? undefined : params);

  // use the params as the body for non-GET requests
  if (body) {
    const searchParams = new URLSearchParams(params);
    body = searchParams.toString();
  }

  const response = await fetch(url.toString(), {
    method,
    headers,
    body,
  });

  return response.json();
}

/**
 * Makes a signed request to 3Commas API service.
 *
 * @param {string} method
 * @param {string} apiPath
 * @param {Object} [params]
 * @param {Object} [headers]
 * @returns {*}
 */
function signedRequest(method, apiPath, params = {}, headers = {}) {
  const { apiKey, secretKey } = config;
  const fullURL = toURL(apiPath, params);
  const pathToSign = toPathWithQueryString(fullURL);
  const signature = sign(pathToSign, secretKey);

  return request(method, apiPath, params, {
    APIKEY: apiKey,
    Signature: signature,
    ...headers,
  });
}

/**
 * Constructs a full 3Commas URL with a given API path.
 *
 * @param {string} apiPath
 * @param {Object} [params]
 * @returns {URL}
 */
function toURL(apiPath, params = {}) {
  const baseURL = new URL(config.baseURL);
  const path = join(baseURL.pathname, apiPath);
  const url = new URL(path, baseURL.origin);

  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, value);
  }

  return url;
}

/**
 * Converts a URL to path with query string appended.
 *
 * @param {URL} url
 * @returns {string}
 */
function toPathWithQueryString(url) {
  const urlString = url.toString();
  return urlString.substr(url.origin.length);
}
