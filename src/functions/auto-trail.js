const debug = require("debug")("3commas-control:auto-trailing");
const { getDeals, updateDeal } = require("../three-commas");
const { parseEventJSON } = require("../utils");

/**
 * Auto trail function.
 *
 * Queries active deals looking for potential trailing take profit opportunities.
 *
 * @returns {Promise<void>}
 */
module.exports = async function autoTrail(event) {
  const { accountId, ignore, minSafetyOrders, takeProfit, trailing } =
    parseEventJSON(event);

  const params = {
    scope: "active",
    account_id: accountId,
  };

  const updates = [];

  for await (const deal of getDeals.iterate(params)) {
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

  await Promise.all(updates);
};

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
