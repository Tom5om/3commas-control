const _ = require('lodash');
const { updateAllDeals, getLastDealsInTimePeriod, updateBot } = require('./services/apiService');
const subMinutes = require('date-fns/subMinutes');

const ACCOUNT_ID_TOM = process.env.THREE_COMMAS_ACCOUNT_ID;
const ACCOUNT_ID_CHRIS = process.env.THREE_COMMAS_ACCOUNT_ID_CHRIS;
const SHOULD_RUN_BOTS = true;

const paramsToEnableSuperBot = {
    timePeriod: 45,
    amountOfStartedAndClosedDeals: 2,
    baseOrder: 40,
    safetyOrder: 20,
    maxAmountOfSuperBots: 1,
}


const paramsToDisableSuperBot = {
    timePeriod: 40,
    amountOfStartedAndClosedDeals: 0,
    baseOrder: 20,
    safetyOrder: 10,
}

module.exports.handleBots = async () => {
    console.log("STARTING update of all bots");

    if (!SHOULD_RUN_BOTS) {
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'NOT UPDATING BOTS', success: true }),
        };
    }
    const filters = [];

    filters.push((deal) => deal.completed_safety_orders_count >= 3);
    filters.push({trailing_enabled: false});
    filters.push((deal) => !deal.bot_name.includes("(SKIP)"));

    const deals = await updateAllDeals(ACCOUNT_ID_TOM, filters, {
        trailing_enabled: true,
        take_profit: 1.9,
        trailing_deviation: 0.4
    });

    console.log("FINISHED update of all bots");
    return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Updated all bots, see logs', success: true, deals }),
    };
};

module.exports.toggleSuperBots = async () => {
    console.log("STARTING review of bots to enabled a superbot");

    if (!SHOULD_RUN_BOTS) {
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'NOT UPDATING BOTS', success: true }),
        };
    }

    const lastDeals = await getLastDealsInTimePeriod(ACCOUNT_ID_TOM, subMinutes(new Date(), paramsToEnableSuperBot.timePeriod));

    const groups = _.map(_.groupBy(lastDeals, 'pair'), (item,index) => {
        return {
            count: item.length,
            botId: item[0].bot_id,
            name: item[0].bot_name,
            pairs: [item[0].pair],
            take_profit: item[0].take_profit,
            martingale_step_coefficient: item[0].martingale_step_coefficient,
            martingale_volume_coefficient: item[0].martingale_volume_coefficient,
            max_safety_orders: item[0].max_safety_orders,
            active_safety_orders_count: item[0].active_safety_orders_count,
            safety_order_step_percentage: item[0].safety_order_step_percentage,
            take_profit_type: item[0].take_profit_type,
            strategy_list: [{"strategy":"nonstop"}],
        }
    });

    const superBotToEnable = _.first(groups, pair => pair.count >= paramsToEnableSuperBot.amountOfStartedAndClosedDeals);
    if (superBotToEnable) {
        console.log(`Upgrading bot to SUPERBOT: ${superBotToEnable.name}(${superBotToEnable.botId}) count: ${superBotToEnable.count}`);

        const params = {
            base_order_volume: paramsToEnableSuperBot.baseOrder,
            safety_order_volume: paramsToEnableSuperBot.safetyOrder,
            ...superBotToEnable,
            name: superBotToEnable.name + ` - SUPERBOT`
        };
        delete params.count;
        const succes = await updateBot(superBotToEnable.botId, params);
    }

    /**
     * @todo find bots that have the superbot params (maybe also change the name to superbot)
     * Change the superbots back to normal bots
     */

    return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Updated all bots, see logs', success: true, lastDeals, groups }),
    };
};

module.exports.handleChrisBots = async () => {
    console.log("STARTING update of all Chris bots");

    const filters = [];

    filters.push((deal) => deal.completed_safety_orders_count >= 3);
    filters.push({trailing_enabled: false});
    filters.push((deal) => !deal.bot_name.includes("(SKIP)"));

    const deals = await updateAllDeals(ACCOUNT_ID_CHRIS, filters, {
        trailing_enabled: true,
        take_profit: 2,
        trailing_deviation: 0.5
    });

    console.log("FINISHED update of all Chris bots");
    return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Updated all bots, see logs', success: true, deals }),
    };
};

module.exports.updateAllDeals = async () => {

    const filters = [];

    filters.push((deal) => deal.completed_safety_orders_count >= 1);
    filters.push({trailing_enabled: true});
    filters.push((deal) => !deal.bot_name.includes("(SKIP)"));

    const deals = await updateAllDeals(ACCOUNT_ID_TOM, filters, {
        trailing_enabled: false,
        take_profit: 1.5,
        trailing_deviation: 0.5,
        profit_currency: 'quote_currency'
    });

    return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Updated all bots, see logs', success: true, deals }),
    };
};
