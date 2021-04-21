const HmacSHA256 = require('crypto-js/hmac-sha256');
const Hex = require('crypto-js/enc-hex');

module.exports.sign = function sign(secret, url, params) {
    return HmacSHA256(`${url}?${params}`, secret).toString(Hex);
}
