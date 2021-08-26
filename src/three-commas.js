const { join } = require("path");
const fetch = require("node-fetch");
const parse = require("json-templates");
const omit = require("object.omit");
const debug = require("debug")("3commas-control:api");
const { SecretManagerServiceClient } = require("@google-cloud/secret-manager");
const { sign } = require("./utils");

const baseURL = new URL("https://api.3commas.io/public/api");

const secretManagerClient = new SecretManagerServiceClient();

/**
 * Builds the 3Commas API object.
 *
 */
module.exports = factory({
  getDeals: {
    signed: true,
    iterator: true,
    method: "GET",
    path: "/ver1/deals",
  },
  updateDeal: {
    signed: true,
    method: "PATCH",
    path: "/ver1/deals/{{deal_id}}/update_deal",
  },
  getBots: {
    signed: true,
    iterator: true,
    method: "GET",
    path: "/ver1/bots",
  },
  updateBot: {
    signed: true,
    method: "PATCH",
    path: "/ver1/bots/{{bot_id}}/update",
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
    const { method, path, signed, iterator } = define;
    const func = signed ? signedRequest : request;
    const boundFunc = func.bind(null, method, path);

    api[name] = iterator ? assignIterate(boundFunc) : boundFunc;
  }

  return api;
}

function assignIterate(func) {
  return Object.assign(func, {
    async *iterate({ limit = 1000, offset = 0, ...params }) {
      const deals = await func({
        ...params,
        limit,
        offset,
      });

      for (let i = 0; i < deals.length; ++i) {
        yield deals[i];
      }

      if (deals.length === limit) {
        yield* func.iterate({
          ...params,
          offset: offset + limit,
          limit,
        });
      }
    },
  });
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
  [apiPath, params] = replacePathParams(apiPath, params);

  let body = method !== "GET" ? params : undefined;
  const url = toURL(apiPath, body ? undefined : params);

  // use the params as the body for non-GET requests
  if (body) {
    const searchParams = new URLSearchParams(params);
    body = searchParams.toString();
  }

  debug("[%s] %s", method, url.toString());

  const response = await fetch(url.toString(), {
    method,
    body,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...headers,
    },
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
async function signedRequest(method, apiPath, params = {}, headers = {}) {
  [apiPath, params] = replacePathParams(apiPath, params);

  const [apiKey, secretKey] = await getAPIKeys();

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

function replacePathParams(path, params = {}) {
  const template = parse(path);

  if (template.parameters.length) {
    const omitKeys = template.parameters.map(({ key }) => key);

    path = template(params);
    params = omit(params, omitKeys);
  }

  return [path, params];
}

/**
 * Returns the API and Secret keys.
 *
 * @returns {Promise<[string, string]>}
 */
async function getAPIKeys() {
  const projectId = process.env.GCP_PROJECT;

  // fallback to envs
  if (!projectId) {
    return [
      process.env.THREE_COMMAS_API_KEY,
      process.env.THREE_COMMAS_SECRET_KEY,
    ];
  }

  const apiKeyName = `projects/${projectId}/secrets/3commas-api-key/versions/latest`;
  const secretKeyName = `projects/${projectId}/secrets/3commas-secret-key/versions/latest`;

  return Promise.all([apiKeyName, secretKeyName].map(getSecretValue));
}

/**
 * Gets a secret value.
 *
 * @param {string} name
 * @returns {Promise<string>}
 */
async function getSecretValue(name) {
  const [version] = await secretManagerClient.accessSecretVersion({
    name,
  });

  return version.payload.data.toString();
}
