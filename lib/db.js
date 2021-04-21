const AWS = require('aws-sdk'); // eslint-disable-line import/no-extraneous-dependencies

const CONFIG_DYNAMODB_ENDPOINT = process.env.CONFIG_DYNAMODB_ENDPOINT;
const IS_OFFLINE = process.env.IS_OFFLINE;

let dynamoDb;
if (IS_OFFLINE === 'true') {
    console.log("offline true");
    dynamoDb = new AWS.DynamoDB.DocumentClient({
        region: 'localhost',
        endpoint: CONFIG_DYNAMODB_ENDPOINT,
    });
} else {
    dynamoDb = new AWS.DynamoDB.DocumentClient();
}

module.exports.db = dynamoDb;
