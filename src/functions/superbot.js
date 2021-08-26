const debug = require("debug")("3commas-control:superbot");
const date = require("date-fns");
const { getDeals, getBots, updateBot } = require("../three-commas");
const { parseEventJSON } = require("../utils");

const superbotPrefix = "SUPERBOT:";

/**
 * Superbot function.
 *
 * Enables/disables superbot mode for running bots.
 *
 * @returns {Promise<void>}
 */
module.exports = async function superbot(event) {
  const {
    accountId,
    minDealsClosed,
    intervalInMins,
    maxSuperbots,
    maxDurationInMins,
    baseOrderAmount,
    safetyOrderAmount,
  } = parseEventJSON(event);

  const botParams = {
    limit: 100,
    account_id: accountId,
    scope: "enabled",
  };

  // fetch enabled bots
  const bots = {};
  for await (const bot of getBots.iterate(botParams)) bots[bot.id] = bot;

  let superbotsCount = Object.keys(bots).reduce(
    (count, id) => count + isSuperbot(bots[id]),
    0
  );

  const now = new Date();
  const minStartDate = date.sub(now, { minutes: intervalInMins });
  // increase the from date a little as 3commas searches from the created date
  const searchFrom = date.sub(now, {
    minutes: intervalInMins * minDealsClosed,
  });

  const counters = {};
  const botIdsEnabled = new Set();
  const updates = [];

  const dealParams = {
    scope: "completed",
    account_id: accountId,
    from: searchFrom.toISOString(),
  };

  // enable superbots
  for await (const deal of getDeals.iterate(dealParams)) {
    // check if we haven't reached max superbots
    if (superbotsCount >= maxSuperbots) {
      break;
    }

    // check the min start date
    const created = new Date(deal.created_at);
    if (created < minStartDate) {
      // deal was in the buffer, skip
      continue;
    }

    const botId = deal.bot_id;

    // init bot deals counter
    if (counters[botId] === undefined) {
      counters[botId] = 0;
    }

    const count = ++counters[botId];
    const bot = bots[botId];

    if (
      !bot || // no bot ???
      isSuperbot(bot) || // no super-duperbots XD
      count < minDealsClosed || // doesn't meet the min deals
      botIdsEnabled.has(botId) // already enabled
    ) {
      continue;
    }

    const update = updateBot({
      bot_id: botId,
      name: superbotName(bot),
      base_order_volume: baseOrderAmount,
      safety_order_volume: safetyOrderAmount,

      // 3commas required fields :S
      pairs: JSON.stringify(bot.pairs),
      take_profit: bot.take_profit,
      martingale_volume_coefficient: bot.martingale_volume_coefficient,
      martingale_step_coefficient: bot.martingale_step_coefficient,
      max_safety_orders: bot.max_safety_orders,
      active_safety_orders_count: bot.active_safety_orders_count,
      safety_order_step_percentage: bot.safety_order_step_percentage,
      take_profit_type: bot.take_profit_type,
      strategy_list: JSON.stringify(bot.strategy_list),
    });

    debug("%s SUPERBOT enabled", bot.name);

    ++superbotsCount;
    botIdsEnabled.add(botId);
    updates.push(update);
  }

  // turn off superbots
  const superbotIds = Object.keys(bots).filter((id) => isSuperbot(bots[id]));
  for (let i = 0, l = superbotIds.length; i < l; ++i) {
    const id = superbotIds[i];
    const bot = bots[id];

    const deals = await getDeals({
      account_id: accountId,
      bot_id: id,
      scope: "active",
      limit: 1000, // highly unlikely to have a 1000 deals open
    });

    const minDurationDate = date.sub(new Date(), {
      minutes: maxDurationInMins,
    });
    const disableSuperbot = deals.some((deal) => {
      const created = new Date(deal.created_at);
      return created < minDurationDate;
    });

    if (disableSuperbot) {
      const [originalName, originalBaseOrderAmount, originalSafetyORderAmount] =
        extractNameAndOrders(bot);

      const update = updateBot({
        bot_id: id,
        name: originalName,
        base_order_volume: originalBaseOrderAmount,
        safety_order_volume: originalSafetyORderAmount,

        // 3commas required fields :S
        pairs: JSON.stringify(bot.pairs),
        take_profit: bot.take_profit,
        martingale_volume_coefficient: bot.martingale_volume_coefficient,
        martingale_step_coefficient: bot.martingale_step_coefficient,
        max_safety_orders: bot.max_safety_orders,
        active_safety_orders_count: bot.active_safety_orders_count,
        safety_order_step_percentage: bot.safety_order_step_percentage,
        take_profit_type: bot.take_profit_type,
        strategy_list: JSON.stringify(bot.strategy_list),
      });

      updates.push(update);

      debug("%s SUPERBOT disabled", originalName);
    }
  }

  await Promise.all(updates);
};

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
  const regexp = new RegExp(
    `^${superbotPrefix}\\s+(.+)\\s+\\[(\\d+\\.\\d+)\\/(\\d+\\.\\d+)\\]$`
  );

  return name.match(regexp).slice(1);
}
