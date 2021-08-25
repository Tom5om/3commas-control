const debug = require("debug")("3commas-control:auto-trailing");
const { functions } = require("../../config.json");
const { getDeals, updateDeal } = require("../three-commas");

const autoTrails = functions.autoTrail;

/**
 * Auto trail function. Queries active deals looking for potential trailing take
 * profit opportunities defined in `config.json`.
 *
 * @returns {Promise<void>}
 */
module.exports = async function autoTrail() {
  const updates = [];

  for (let i = 0, l = autoTrails.length; i < l; ++i) {
    const {
      enabled,
      accountId,
      ignore,
      minSafetyOrders,
      takeProfit,
      trailing,
    } = autoTrails[i];

    if (!enabled) {
      continue;
    }

    const params = {
      scope: "active",
      account_id: accountId,
    };

    for await (const deal of iterate(params)) {
      if (!shouldTrail(deal, minSafetyOrders, ignore)) {
        debug("%s skipping", deal.bot_name);
        continue;
      }

      const update = updateDeal({
        deal_id: deal.id,
        trailing_enabled: true,
        take_profit: takeProfit,
        trailing_deviation: trailing,
      });

      updates.push(update);

      debug(
        "%s trailing enabled (TTP %d% / %d%)",
        deal.bot_name,
        takeProfit,
        trailing
      );
    }
  }

  return Promise.all(updates);
};

/**
 * Utility iterator for looping over deals.
 *
 * @param {Object} [params]
 * @returns {AsyncIterator}
 */
async function* iterate({ limit = 1000, offset = 0, ...params }) {
  const deals = await getDeals({
    ...params,
    limit,
    offset,
  });

  for (let i = 0; i < deals.length; ++i) {
    yield deals[i];
  }

  if (deals.length === limit) {
    yield* iterateDeals({
      ...params,
      offset: offset + limit,
      limit,
    });
  }
}

/**
 * Returns if a given deal should enable trailing take profits.
 *
 * @param {Object} deal
 * @param {number} minSafetyOrders
 * @param {Array} [ignore]
 * @returns {boolean}
 */
function shouldTrail(deal, minSafetyOrders, ignore = []) {
  // already trailing, don't touch it
  if (deal.trailing_enabled) {
    return false;
  }

  // doesn't have minimum safet orders
  if (deal.completed_safety_orders_count < minSafetyOrders) {
    return false;
  }

  // should bot be ignored
  return !ignore.some((predicate) => {
    // match bot_ids
    if (typeof predicate === "number") {
      return deal.bot_id === predicate;
    }

    // match bot_names
    const regexp = new RegExp(predicate);
    return regexp.test(deal.bot_name);
  });
}
