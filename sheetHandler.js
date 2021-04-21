const fs = require('fs').promises;
const readline = require('readline');
const { google } = require('googleapis');
const path = require('path');
const { updateAllDeals, getAllActiveDeals, getDeal } = require('./services/apiService');
const _ = require('lodash');
const dynamoDb = require('./lib/db');
const uuid = require('uuid');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';

module.exports.setup = () => {

    // Load client secrets from a local file.
    fs.readFile(path.resolve(__dirname, './credentials.json'), (err, content) => {
        if (err) return console.log('Error loading client secret file:', err);
        // Authorize a client with credentials, then call the Google Sheets API.
        return authorize(JSON.parse(content), listMajors);
    });
}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
async function authorize(credentials, callback) {
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
    const token = tokenRecord.token;

    if(!token) {
        return getNewToken(oAuth2Client, callback);
    } else {
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client);
    }
}


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
    const token = tokenRecord.token;

    if (!token) {
        return getNewToken(oAuth2Client, callback);
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
function getNewToken(oAuth2Client, callback) {
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
        oAuth2Client.getToken(code, (err, token) => {
            if (err) return console.error('Error while trying to retrieve access token', err);
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

            dynamoDb.put(params).promise().then(() => {
                callback(oAuth2Client);
            }).catch(error => {
                if (error) {
                    console.error(error);
                    callback(null, {
                        statusCode: error.statusCode || 501,
                        headers: { 'Content-Type': 'text/plain' },
                        body: 'Couldn\'t create the token.',
                    });
                    return;
                }
            });
        });
    });
}

module.exports.updateSheets = async () => {
    let deals = await getAllActiveDeals();

    const fields = ['id', 'pair', 'account_id', 'bot_name', 'completed_safety_orders_count', 'take_profit', 'trailing_enabled', 'trailing_deviation', 'base_order_volume', 'safety_order_volume', 'bought_average_price', 'take_profit_price', 'final_profit'];
    deals = deals.map(deal => {
        return Object.values(_.pick(deal, fields))
    });

    deals.unshift(fields);

    const values = deals;

    // let values = [
    //     [
    //         // Cell values ...
    //     ],
    //     // Additional rows ...
    // ];
    const resource = {
        values,
    };

    try {
        const result = await updateSheets();
        return result;
    } catch (error) {
        return error;
    }
}

const updateSheets = (resource) => {
    return new Promise(async (resolve, reject) => {

        const auth = await getAuth();

        const sheets = google.sheets({ version: 'v4', auth });

        sheets.spreadsheets.values.update({
            spreadsheetId: '1SGWamuCKD2rct5M9ADMSk8_ttysHVFIKBrgta8flRfs',
            valueInputOption: "RAW",
            range: 'A1:Z200',
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
                    body: JSON.stringify({ message: 'Updated your sheets, see logs', success: true, deals }),
                });
            }
        });
    });
}
