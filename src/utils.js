const { createHmac } = require("crypto");
const { threeCommas: config } = require("../config.json");

module.exports = {
  sign,
};

/**
 * Signs data with a secret key. If no key given it will use the
 * `threeCommas.secretKey` set in `config.json`.
 *
 * @param {import("crypto").BinaryLike} data
 * @param {import("crypto").BinaryLike} [secretKey]
 * @returns {string}
 */
function sign(data, secretKey = config.secretKey) {
  const hash = createHmac("SHA256", secretKey);
  const sig = hash.update(data).digest("hex");

  return sig;
}
