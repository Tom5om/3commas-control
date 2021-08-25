const { createHmac } = require("crypto");

module.exports = {
  sign,
};

/**
 * Signs data with a secret key.
 *
 * @param {import("crypto").BinaryLike} data
 * @param {import("crypto").BinaryLike} secretKey
 * @returns {string}
 */
function sign(data, secretKey) {
  const hash = createHmac("SHA256", secretKey);
  const sig = hash.update(data).digest("hex");

  return sig;
}
