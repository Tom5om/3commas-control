const apiLib = require('../lib/api');
const api = new apiLib({
    apiKey: process.env.THREE_COMMAS_API_KEY,
    apiSecret: process.env.THREE_COMMAS_API_SECRET,
    // url: 'https://api.3commas.io' // this is optional in case of defining other endpoint
});
const _ = require("lodash");

const ACCOUNT_ID_TOM = process.env.THREE_COMMAS_ACCOUNT_ID;

const getAllActiveDeals = async () => {
    const allDeals = await api.getDeals({ scope: "active", limit: 100 });
    const filteredDeals = _.filter(allDeals, { account_id: parseInt(ACCOUNT_ID_TOM,10) });
    return filteredDeals;
}

const getDeal = async (dealId) => {
    console.log(await api.getDeal(dealId));
}

const updateAllDeals = async (minSafetyOrders, params) => {
    const deals = await getAllActiveDeals();

    const promiseList = [];

    const newDeals = [];
    deals.forEach(deal => {
        const partialDeal = _.pick(deal, ['id', 'pair', 'account_id', 'bot_name', 'completed_safety_orders_count', 'take_profit', 'trailing_enabled', 'trailing_deviation', 'base_order_volume'])
        if (deal.completed_safety_orders_count >= minSafetyOrders && !deal.trailing_enabled) {
            newDeals.push(partialDeal);
            promiseList.push(new Promise((resolve, reject) => {
                return api.dealUpdate(deal.id, params).then(updatedDeal => {
                    console.log(`Updated: ${updatedDeal.id} |  ${deal.bot_name} | ${updatedDeal.trailing_enabled} | ${updatedDeal.trailing_deviation}`);
                    resolve(updatedDeal);
                }).catch(error => {
                    console.log(error);
                    reject(error);
                })
            }));
        }
    });


    try {
        if(promiseList.length > 0) {
            await Promise.all(promiseList).catch(error => {
                console.log(error);
            })
        }
    } catch (error) {
        console.error("Something went wrong", {error});
        throw error;
    }
    return newDeals;
}

module.exports = {
    getAllActiveDeals,
    getDeal,
    updateAllDeals
};
