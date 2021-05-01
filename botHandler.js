const _ = require('lodash');
const { updateAllDeals } = require('./services/apiService');

const ACCOUNT_ID_TOM = process.env.THREE_COMMAS_ACCOUNT_ID;
const ACCOUNT_ID_CHRIS = process.env.THREE_COMMAS_ACCOUNT_ID_CHRIS;

module.exports.handleBots = async () => {
    console.log("STARTING update of all bots");

    const deals = await updateAllDeals(ACCOUNT_ID_TOM,3, {
        trailing_enabled: true,
        take_profit: 2,
        trailing_deviation: 0.5
    });

    console.log("FINISHED update of all bots");
    return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Updated all bots, see logs', success: true, deals }),
    };
};

module.exports.handleChrisBots = async () => {
    console.log("STARTING update of all Chris bots");

    const deals = await updateAllDeals(ACCOUNT_ID_CHRIS, 2, {
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
    const deals = await updateAllDeals(3, {
        trailing_enabled: false,
        take_profit: 1.5,
        trailing_deviation: 0.5
    });

    return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Updated all bots, see logs', success: true, deals }),
    };
};
