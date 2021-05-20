const _ = require('lodash');
const { updateAllDeals } = require('./services/apiService');

const ACCOUNT_ID_TOM = process.env.THREE_COMMAS_ACCOUNT_ID;
const ACCOUNT_ID_CHRIS = process.env.THREE_COMMAS_ACCOUNT_ID_CHRIS;

module.exports.handleBots = async () => {
    console.log("STARTING update of all bots");

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
    filters.push({trailing_enabled: false});
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
