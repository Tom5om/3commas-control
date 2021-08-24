'use strict'
const qs = require('qs');
const sign = require('./crypto').sign;

const axios = require('axios');

const API_URL = 'https://api.3commas.io'

class threeCommasAPI {
    constructor(opts = {}) {
        this._url = opts.url || API_URL
        this._apiKey = opts.apiKey || ''
        this._apiSecret = opts.apiSecret || ''

        this._instance = axios.create({
            baseURL: API_URL,
            timeout: 10000,
        });

        this._instance.interceptors.request.use(
            (config) => {
                let data = config.data;
                let payload = JSON.stringify(data);

                if (config.method === 'get') {
                    payload = qs.stringify(config.params, { encode: false });
                    data = null;
                }

                const relativeUrl = config.url.replace(config.baseURL, '');
                const signature = sign(this._apiSecret, relativeUrl, payload);
                const newConfig = {
                    ...config,
                    data,
                    headers: {
                        ...config.headers,
                        'APIKEY': this._apiKey,
                        Signature: signature,
                    },
                };

                return newConfig;
            },
            (error) => {
                return Promise.reject(error);
            }
        );
    }

    async makeRequest (method, path, params) {
        if (!this._apiKey || !this._apiSecret) {
            return new Error('missing api key or secret')
        }

        const config = {
            url: path,
            method,
            agent: '',
        };

        if (method === "GET") {
            config.params = params;
        } else {
            config.data = params;
        }

        try {
            let response = await this._instance.request(config);

            return await response.data;
        } catch (e) {
            console.log("++++++++++++++++++ERROR++++++++++++++++++");
            console.log(e.response.data);
            console.log("++++++++++++++++++ERROR++++++++++++++++++");
            return false
        }
    }

    /**
     * Deals methods
     */

    async getDeals (params) {
        return await this.makeRequest('GET', '/public/api/ver1/deals', params)
    }

    async dealUpdateMaxSafetyOrders (deal_id, max_safety_orders) {
        return await this.makeRequest('POST', `/public/api/ver1/deals/${deal_id}/update_max_safety_orders`, { deal_id, max_safety_orders })
    }

    async dealPanicSell (deal_id) {
        return await this.makeRequest('POST', `/public/api/ver1/deals/${deal_id}/panic_sell`, { deal_id })
    }

    async dealCancel (deal_id) {
        return await this.makeRequest('POST', `/public/api/ver1/deals/${deal_id}/cancel`, { deal_id })
    }

    async dealUpdateTp (deal_id, new_take_profit_percentage) {
        return await this.makeRequest('POST', `/public/api/ver1/deals/${deal_id}/update_tp`, { deal_id, new_take_profit_percentage })
    }

    async dealUpdate (deal_id, data) {
        return await this.makeRequest('PATCH', `/public/api/ver1/deals/${deal_id}/update_deal`, data)
    }

    async getDeal (deal_id) {
        return await this.makeRequest('GET', `/public/api/ver1/deals/${deal_id}/show`, { deal_id })
    }

    async getDealSafetyOrders (deal_id) {
        return await this.makeRequest('GET', `/public/api/ver1/deals/${deal_id}/market_orders`, { deal_id })
    }

    async dealAddFunds (params) {
        return await this.makeRequest('POST', `/public/api/ver1/deals/${params.deal_id}/add_funds`, params)
    }

    /**
     * Bots methods
     */

    async getBotsBlackList () {
        return await this.makeRequest('GET', `/public/api/ver1/bots/pairs_black_list`, null)
    }

    async botsUpdateBlackList (params) {
        return await this.makeRequest('POST', '/public/api/ver1/bots/update_pairs_black_list', params)
    }

    async botCreate (params) {
        return await this.makeRequest('POST', '/public/api/ver1/bots/create_bot', params)
    }

    async getBots (params) {
        return await this.makeRequest('GET', `/public/api/ver1/bots`, params)
    }

    async getBotsStats (params) {
        return await this.makeRequest('GET', `/public/api/ver1/bots/stats`, params)
    }

    async updateBot (bot_id, params) {
        return await this.makeRequest('PATCH', `/public/api/ver1/bots/${bot_id}/update`, params)
    }

    async botDisable (bot_id) {
        return await this.makeRequest('POST', `/public/api/ver1/bots/${bot_id}/disable`, { bot_id })
    }

    async botEnable (bot_id) {
        return await this.makeRequest('POST', `/public/api/ver1/bots/${bot_id}/enable`, { bot_id })
    }

    async botStartNewDeal (params) {
        return await this.makeRequest('POST', `/public/api/ver1/bots/${params.bot_id}/start_new_deal`, params)
    }

    async botDelete (bot_id) {
        return await this.makeRequest('POST', `/public/api/ver1/bots/${bot_id}/delete`, { bot_id })
    }

    async botPaniceSellAllDeals (bot_id) {
        return await this.makeRequest('POST', `/public/api/ver1/bots/${bot_id}/panic_sell_all_deals`, { bot_id })
    }

    async botCancelAllDeals (bot_id) {
        return await this.makeRequest('POST', `/public/api/ver1/bots/${bot_id}/cancel_all_deals`, { bot_id })
    }

    async botShow (bot_id) {
        return await this.makeRequest('GET', `/public/api/ver1/bots/${bot_id}/show`, { bot_id })
    }

    /**
     * Smart Trades methods
     */

    async smartTradesCreateSimpleSell (params) {
        return await this.makeRequest('POST', `/public/api/ver1/smart_trades/create_simple_sell`, params)
    }

    async smartTradesCreateSimpleBuy (params) {
        return await this.makeRequest('POST', `/public/api/ver1/smart_trades/create_simple_buy`, params)
    }

    async smartTradesCreateSmartSell (params) {
        return await this.makeRequest('POST', `/public/api/ver1/smart_trades/create_smart_sell`, params)
    }

    async smartTradesCreateSmartCover (params) {
        return await this.makeRequest('POST', `/public/api/ver1/smart_trades/create_smart_cover`, params)
    }

    async smartTradesCreateSmartTrade (params) {
        return await this.makeRequest('POST', `/public/api/ver1/smart_trades/create_smart_trade`, params)
    }

    async smartTrades (params) {
        return await this.makeRequest('GET', `/public/api/ver1/smart_trades`, params)
    }

    async smartTradesV2 (params) {
        return await this.makeRequest('GET', `/public/api/v2/smart_trades`, params)
    }

    async smartTradesStepPanicSell (params) {
        return await this.makeRequest('POST', `/public/api/ver1/smart_trades/${params.smart_trade_id}/step_panic_sell`, params)
    }

    async smartTradesUpdate (params) {
        return await this.makeRequest('PATCH', `/public/api/ver1/smart_trades/${params.smart_trade_id}/update`, params)
    }

    async smartTradesCancel (smart_trade_id) {
        return await this.makeRequest('POST', `/public/api/ver1/smart_trades/${smart_trade_id}/cancel`, { smart_trade_id })
    }

    async smartTradesPanicSell (smart_trade_id) {
        return await this.makeRequest('POST', `/public/api/ver1/smart_trades/${smart_trade_id}/panic_sell`, { smart_trade_id })
    }

    async smartTradesForceProcess (smart_trade_id) {
        return await this.makeRequest('POST', `/public/api/ver1/smart_trades/${smart_trade_id}/force_process`, { smart_trade_id })
    }

    /**
     * Accounts methods
     */

    async accountsNew (params) {
        return await this.makeRequest('POST', `/public/api/ver1/accounts/new`, params)
    }

    async accounts () {
        return await this.makeRequest('GET', `/public/api/ver1/accounts`, null)
    }

    async accountsMarketList () {
        return await this.makeRequest('GET', `/public/api/ver1/accounts/market_list`, null)
    }

    async accountsCurrencyRates () {
        return await this.makeRequest('GET', `/public/api/ver1/accounts/currency_rates`, null)
    }

    async accountSellAllToUsd (account_id) {
        return await this.makeRequest('POST', `/public/api/ver1/accounts/${account_id}/sell_all_to_usd`, { account_id })
    }

    async accountSellAllToBtc (account_id) {
        return await this.makeRequest('POST', `/public/api/ver1/accounts/${account_id}/sell_all_to_btc`, { account_id })
    }

    async accountLoadBalances (account_id) {
        return await this.makeRequest('POST', `/public/api/ver1/accounts/${account_id}/load_balances`, { account_id: parseInt(account_id, 10) })
    }

    async accountRename (params) {
        return await this.makeRequest('POST', `/public/api/ver1/accounts/${params.account_id}/rename`, params)
    }

    async accountPieChartData (account_id) {
        return await this.makeRequest('POST', `/public/api/ver1/accounts/${account_id}/pie_chart_data`, { account_id })
    }

    async accountTableData (account_id) {
        return await this.makeRequest('POST', `/public/api/ver1/accounts/${account_id}/account_table_data`, { account_id })
    }

    async accountRemove (account_id) {
        return await this.makeRequest('POST', `/public/api/ver1/accounts/${account_id}/remove`, { account_id })
    }

}

module.exports = threeCommasAPI
