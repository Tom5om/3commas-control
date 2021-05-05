const fs = require('fs').promises;
const readline = require('readline');
const { google } = require('googleapis');
const path = require('path');
const apiService = require('./services/apiService');
const _ = require('lodash');
const dynamoDb = require('./lib/db');
const uuid = require('uuid');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

/**
 * Get the token
 */
const getAuth = async () => {

    const content = await fs.readFile(path.resolve(__dirname, './credentials.json'));
    const credentials = JSON.parse(content);

    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);

    const params = {
        TableName: process.env.DYNAMODB_TABLE,
        Key: {
            id: 'token',
        },
    };

    // Check if we have previously stored a token.
    const tokenRecord = await dynamoDb.get(params).promise();
    let token = tokenRecord.Item ? tokenRecord.Item.token : false;

    if (!token) {
        return getNewToken(oAuth2Client);
    }
    oAuth2Client.setCredentials(JSON.parse(token));
    return oAuth2Client;
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client) {

    return new Promise((resolve, reject) => {
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
        });
        console.log('Authorize this app by visiting this url:', authUrl);
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        rl.question('Enter the code from that page here: ', (code) => {
            rl.close();
            oAuth2Client.getToken(code, async (err, token) => {
                if (err) {
                    reject(err)
                }

                oAuth2Client.setCredentials(token);

                const params = {
                    TableName: process.env.DYNAMODB_TABLE,
                    Item: {
                        id: "token",
                        token: JSON.stringify(token),
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    },
                };

                await dynamoDb.put(params).promise();
                resolve(oAuth2Client);
            });
        });
    });
}

module.exports.updateSheets = async () => {

    // const botStats = apiService.getBotStats({account_id: apiService.ACCOUNT_ID_TOM, bot_id: 3460139});
    //
    // return {
    //     statusCode: 200,
    //     body: JSON.stringify({ botStats }),
    // }

    const balances = await apiService.getBalances(process.env.THREE_COMMAS_ACCOUNT_ID);

    const balanceFields = ['currency_code', 'usd_value'];
    const usd = balances.map(item => {
        return Object.values(_.pick(item, balanceFields))
    });

    usd.unshift(balanceFields);

    const balanceResources = {
        values: usd,
    };

    const result = await updateSheets(balanceResources, 'Balances!A1:C5');

    let deals = await apiService.getAllActiveDeals();
    console.log(deals[0]);

    const fields = ['id', 'pair', 'account_id', 'bot_id', 'bot_name', 'completed_safety_orders_count', 'take_profit', 'trailing_enabled', 'trailing_deviation', 'base_order_volume', 'safety_order_volume', 'bought_average_price', 'take_profit_price', 'actual_profit', 'reserved_base_coin', 'reserved_second_coin'];
    deals = deals.map(deal => {
        return Object.values(_.pick(deal, fields))
    });


    deals.unshift(fields);

    // let values = [
    //     [
    //         // Cell values ...
    //     ],
    //     // Additional rows ...
    // ];
    const resource = {
        values: deals,
    };

    try {
        const result = await updateSheets(resource, 'A1:Z200');
        return result;
    } catch (error) {
        return error;
    }
}

const updateSheets = (resource, range) => {
    return new Promise(async (resolve, reject) => {

        const auth = await getAuth();

        const sheets = google.sheets({ version: 'v4', auth });

        sheets.spreadsheets.values.update({
            spreadsheetId: '1SGWamuCKD2rct5M9ADMSk8_ttysHVFIKBrgta8flRfs',
            valueInputOption: "RAW",
            range,
            resource,
        }, (err, result) => {
            if (err) {
                // Handle error
                console.log(err);
                return reject({
                    statusCode: 400,
                    body: JSON.stringify({ message: 'Error updating your sheets', success: false }),
                });
            } else {

                console.log('%d cells updated.', result.updatedCells);
                return resolve({
                    statusCode: 200,
                    body: JSON.stringify({ message: 'Updated your sheets, see logs', success: true, resource }),
                });
            }
        });
    });
}
