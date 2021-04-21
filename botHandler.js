const _ = require('lodash');
const { updateAllDeals, getAllActiveDeals, getDeal } = require('./services/apiService');


module.exports.handleBots = async () => {
    console.log("STARTING update of all bots");

    const deals = await updateAllDeals(3, {
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
