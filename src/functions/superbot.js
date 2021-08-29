const debug = require("debug")("3commas-control:superbot");
const date = require("date-fns");
const { getDeals, getBots, updateBot } = require("../three-commas");
const { parseEventJSON, delay } = require("../utils");

const superbotPrefix = "SUPERBOT:";
const superbotRegExp = new RegExp(
  `^${superbotPrefix}\\s+(.+)\\s+\\[(\\d+\\.\\d+)\\/(\\d+\\.\\d+)\\]$`
);

const botCache = new Map();

/**
 * Superbot function.
 *
 * Enables/disables superbot mode for running bots.
 *
 * @returns {Promise<void>}
 */
module.exports = async function superbot(event) {
  const options = parseEventJSON(event);
  const {
    accountId,
    minDealsClosed,
    intervalInMins,
    maxSuperbots,
    maxDurationInMins,
    baseOrderAmount,
    safetyOrderAmount,
  } = options;

  const now = new Date();
  const minStartDate = date.sub(now, { minutes: intervalInMins });
  const minDurationDate = date.sub(now, {
    minutes: maxDurationInMins,
  });

  // --------------------------------------------------------------------------

  // Part 1: Pre-fetch bots
  //   Warm up a cache of all active bots associated with account.

  const botParams = {
    limit: 100,
    account_id: accountId,
    scope: "enabled",
  };

  for await (const bot of getBots.iterate(botParams)) botCache.set(bot.id, bot);

  // --------------------------------------------------------------------------

  // Part 2: Superbot suppression
  //   Firstly, work out from the deals which bots are superbots and of which,
  //   disable any that have went past their max deal duration.

  const activeDeals = await getDeals({
    account_id: accountId,
    order_direction: "desc",
    scope: "active",
  });

  const activeSuperbotDeals = activeDeals.filter(
    filterSuperbotDeals(baseOrderAmount, safetyOrderAmount)
  );
  const activeEnabledSuperbotDeals = activeSuperbotDeals.filter(isSuperbot);
  const activeExpiredSuperbotDeals = activeEnabledSuperbotDeals.filter(
    filterExpiredSuperbotDeals(minDurationDate)
  );

  const botIdsToDisable = activeExpiredSuperbotDeals.map((deal) => deal.bot_id);
  await Promise.all(botIdsToDisable.map(disableSuperbot));

  // --------------------------------------------------------------------------

  // Part 3: Superbot detection
  //   Next let's see if we can detect if a bot has been pumping to turn
  //   superbot mode on.

  let superbotsCount = activeSuperbotDeals.length;
  const activeSuperbotIds = activeSuperbotDeals.map((deal) => deal.bot_id);

  for (const [id, bot] of botCache) {
    // superbot limit reached
    if (superbotsCount >= maxSuperbots) {
      break;
    }

    // already a superbot
    const superbot = activeSuperbotIds.includes(id);
    if (superbot) {
      continue;
    }

    // 3Commas `from` parameter goes from the created date so we need to fetch
    // the latest 3 closed deals per bot. However 3Commas weights this request
    // heavily so we need to backoff so our IP doesn't get blocked. A simple
    // 1000ms delay seems to do the trick.
    await delay(1000);

    debug("checking %s deals", bot.name);

    // recent deals
    const deals = await getDeals({
      account_id: accountId,
      bot_id: id,
      order_direction: "desc",
      scope: "completed",
      limit: minDealsClosed,
    });

    // count how many closed within the interval
    const innerDealsClosed = deals.filter(({ closed_at: closedAt }) => {
      const closed = new Date(closedAt);
      return minStartDate < closed;
    });

    if (innerDealsClosed.length === minDealsClosed) {
      await updateBot({
        ...requiredFields(bot),
        bot_id: id,
        name: superbotName(bot),
        base_order_volume: baseOrderAmount,
        safety_order_volume: safetyOrderAmount,
      });

      superbotsCount += 1;
      debug("%s SUPERBOT enabled", bot.name);
    }
  }
};

function filterSuperbotDeals(baseOrderAmount, safetyOrderAmount) {
  return (deal) => {
    // detect by the bot name
    if (isSuperbot(deal)) {
      return true;
    }

    const dealBaseOrderAmount = parseFloat(deal.base_order_volume);
    const dealSafetyOrderAmount = parseFloat(deal.safety_order_volume);

    // Is the active deal the same order amounts. This is a fallback detection
    // for when a superbot has been disabled however it still has an open deal.
    return (
      dealSafetyOrderAmount === safetyOrderAmount &&
      dealBaseOrderAmount === baseOrderAmount
    );
  };
}

function filterExpiredSuperbotDeals(minDate) {
  return (deal) => {
    const created = new Date(deal.created_at);
    return created < minDate;
  };
}

function isSuperbot({ name, bot_name: botName }) {
  return (botName || name).startsWith(superbotPrefix);
}

function superbotName({
  name,
  base_order_volume: oldBaseOrderAMount,
  safety_order_volume: oldSafetyOrderAmount,
}) {
  return [
    superbotPrefix,
    name,
    `[${oldBaseOrderAMount}/${oldSafetyOrderAmount}]`,
  ].join(" ");
}

function extractNameAndOrders({ name }) {
  return name.match(superbotRegExp).slice(1);
}

async function disableSuperbot(id) {
  const bot = botCache.get(id);

  const [originalName, originalBaseOrderAmount, originalSafetyORderAmount] =
    extractNameAndOrders(bot);

  await updateBot({
    ...requiredFields(bot),
    bot_id: id,
    name: originalName,
    base_order_volume: originalBaseOrderAmount,
    safety_order_volume: originalSafetyORderAmount,
  });

  debug("%s SUPERBOT disabled", originalName);
}

function requiredFields(bot) {
  // stupid 3Commas required fields
  return {
    name: bot.name,
    base_order_volume: bot.base_order_volume,
    safety_order_volume: bot.safety_order_volume,
    pairs: JSON.stringify(bot.pairs),
    take_profit: bot.take_profit,
    martingale_volume_coefficient: bot.martingale_volume_coefficient,
    martingale_step_coefficient: bot.martingale_step_coefficient,
    max_safety_orders: bot.max_safety_orders,
    active_safety_orders_count: bot.active_safety_orders_count,
    safety_order_step_percentage: bot.safety_order_step_percentage,
    take_profit_type: bot.take_profit_type,
    strategy_list: JSON.stringify(bot.strategy_list),
  };
}
