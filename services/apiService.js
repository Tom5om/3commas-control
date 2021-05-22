const apiLib = require('../lib/api');
const api = new apiLib({
    apiKey: process.env.THREE_COMMAS_API_KEY,
    apiSecret: process.env.THREE_COMMAS_API_SECRET,
    // url: 'https://api.3commas.io' // this is optional in case of defining other endpoint
});
const _ = require("lodash");


const getAllActiveDeals = async (accountId, filters) => {
    const allDeals = await api.getDeals({ scope: "active", limit: 100 });

    let dealsForAccount = _.filter(allDeals, { account_id: parseInt(accountId,10) });
    let newFilteredDeals;

    if (filters && filters.length > 0) {
        const newCombinedPredicate = _.overEvery(filters);
        newFilteredDeals = _.filter(dealsForAccount, newCombinedPredicate)
    } else {
        newFilteredDeals = dealsForAccount
    }


    return newFilteredDeals;
}

/**
 * Get account from accounts list (holds the total USD)
 * @param accountId
 * @returns {Promise<unknown>}
 */
const getAccount = async (accountId) => {
    const accounts = await api.accounts();
    return _.find(accounts, {id: parseInt(accountId, 10)})
}

const getBalances = async (accountId) => {
    const accounts = await api.accountTableData(accountId);
    return _.filter(accounts, (account) => account.currency_code.includes('USD'));
}

const getBotStats = async (params) => {
    const result = await api.getDeals(params);
    return result;
    // return _.filter(accounts, (account) => account.currency_code.includes('USD'));
}

const getDeal = async (dealId) => {
    console.log(await api.getDeal(dealId));
}

const updateAllDeals = async (accountId, filters, params) => {
    const deals = await getAllActiveDeals(accountId, filters);

    const promiseList = [];

    const newDeals = [];
    deals.forEach(deal => {
        const partialDeal = _.pick(deal, ['id', 'pair', 'account_id', 'bot_name', 'profit_currency', 'completed_safety_orders_count', 'take_profit', 'trailing_enabled', 'trailing_deviation', 'base_order_volume'])

        newDeals.push(partialDeal);
        promiseList.push(new Promise((resolve, reject) => {
            return api.dealUpdate(deal.id, params).then(updatedDeal => {
                console.log(`Updated: ${updatedDeal.id} |  ${deal.bot_name} | ${updatedDeal.trailing_enabled} | ${updatedDeal.trailing_deviation} | ${updatedDeal.profit_currency} `);
                resolve(updatedDeal);
            }).catch(error => {
                console.log(error);
                reject(error);
            })
        }));
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
    updateAllDeals,
    getAccount,
    getBalances,
    getBotStats
};
